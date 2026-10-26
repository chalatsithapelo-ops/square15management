// PR-3 — Artisan "Start a Job" workflow.
// Lets an artisan self-initiate an order in the field, then complete a small
// Site-Specific Risk Assessment (SSRA) before doing the work.
// Admins receive a notification + can review under /admin/jobs/needs-review.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { notifyAdmins, createNotification } from "~/server/utils/notifications";
import { getSsraTemplate, listSsraServiceTypes } from "~/server/utils/ssraTemplates";
import { generateSsraQuestionsForJob, type AiSsraQuestion } from "~/server/utils/ohs-ai";
import { generateUniqueJoinCode } from "~/server/utils/orderAccess";
import { getNextOrderNumber } from "~/server/utils/documentNumbers";
import { logTmAssignment, type TmAssignmentSource } from "~/server/utils/tmAssignmentLog";

function isArtisan(role: string) {
  return role === "ARTISAN" || role === "CONTRACTOR";
}

function ensureArtisan(role: string) {
  if (!isArtisan(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Artisan only" });
  }
}

// ----- get my "start a job" context (buildings I've previously worked in) ----

export const artisanGetStartJobContext = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisan(user.role);

    // Pull the artisan's recent buildings/clients for quick selection.
    const recentOrders = await db.order.findMany({
      where: { assignedToId: user.id, clientBuildingId: { not: null } },
      select: {
        clientBuilding: {
          select: { id: true, name: true, address: true, client: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    const seen = new Set<number>();
    const recentBuildings: any[] = [];
    for (const o of recentOrders) {
      const b = o.clientBuilding;
      if (b && !seen.has(b.id)) {
        seen.add(b.id);
        recentBuildings.push(b);
      }
    }

    const allBuildings = await db.clientBuilding.findMany({
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, address: true, client: { select: { id: true, name: true } } },
    });

    // Full client list so the "building not listed" flow can pick an existing client
    // (or create a new one inline) without leaving the wizard.
    const clients = await db.client.findMany({
      orderBy: { name: "asc" },
      take: 500,
      select: { id: true, name: true, companyName: true, phone: true, email: true },
    });

    return {
      recentBuildings,
      allBuildings,
      clients,
      serviceTypes: listSsraServiceTypes(),
    };
  });

// ----- the main artisan create-order procedure ------------------------------

export const artisanCreateOrder = baseProcedure
  .input(z.object({
    token: z.string(),
    clientBuildingId: z.number().optional(),
    // Quick-add a building for a client they previously worked with, OR create
    // a brand-new client + building inline when neither is on record yet.
    quickAddBuilding: z.object({
      clientId: z.number().optional(),
      newClient: z.object({
        name: z.string().min(1),
        phone: z.string().min(1),
        email: z.string().email().optional().or(z.literal("")).optional(),
      }).optional(),
      name: z.string().min(1),
      address: z.string().min(1),
      notes: z.string().optional(),
    }).optional(),
    // Order-number handling
    orderNumberStatus: z.enum(["HAS_NUMBER", "PENDING_FROM_CLIENT", "NO_ORDER_REQUIRED"]),
    clientOrderNumber: z.string().optional(),
    noOrderReason: z.string().optional(),
    // Job basics
    serviceType: z.string().min(1),
    description: z.string().min(3),
    // Before-photos are required per TM policy: at least 3 site photos before work begins.
    // Presigned URLs may be relative (/minio/...) so we only require a non-empty string.
    beforePhotos: z.array(z.string().min(1)).min(3, "Upload at least 3 before-photos"),
    // Site geo (optional) — anchors geofence for later joiners
    lat: z.number().optional(),
    lng: z.number().optional(),
    // PR-8 — Technical Manager selected by the artisan at start-job time.
    // Optional at the schema level (nullable) so older clients keep working,
    // but the UI must supply one and the server falls back to the caller's
    // `defaultTechnicalManagerId` when omitted. Must be a user with an
    // active CommissionRule of role="TM" — enforced server-side below.
    technicalManagerId: z.number().nullable().optional(),
    // PR-8 F — Site Lead + Ops Manager pickers, same treatment as TM.
    // Must be active users with matching CommissionRule role.
    siteLeadId: z.number().nullable().optional(),
    opsManagerId: z.number().nullable().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisan(user.role);

    // Resolve building
    let buildingId = input.clientBuildingId;
    if (!buildingId && input.quickAddBuilding) {
      let clientId = input.quickAddBuilding.clientId;
      if (!clientId && input.quickAddBuilding.newClient) {
        const nc = input.quickAddBuilding.newClient;
        const createdClient = await db.client.create({
          data: {
            name: nc.name,
            phone: nc.phone,
            email: nc.email || `${nc.name.toLowerCase().replace(/[^a-z0-9]/g, "")}@placeholder.local`,
            createdById: user.id,
          },
        });
        clientId = createdClient.id;
      }
      if (!clientId) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Client is required when adding a new building" });
      }
      const created = await db.clientBuilding.create({
        data: {
          clientId,
          name: input.quickAddBuilding.name,
          address: input.quickAddBuilding.address,
          notes: input.quickAddBuilding.notes,
        },
      });
      buildingId = created.id;
    }

    if (!buildingId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Building required" });
    }

    // PR-6 — duplicate guard. If an active job already exists at this building
    // for the same serviceType within the last 24h, refuse and surface the
    // existing order so the UI can offer "Join this job instead".
    const dupWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const dup = await db.order.findFirst({
      where: {
        clientBuildingId: buildingId,
        serviceType: input.serviceType,
        status: { notIn: ["COMPLETED", "CANCELLED"] as any },
        createdAt: { gte: dupWindow },
      },
      select: { id: true, orderNumber: true, joinCode: true, assignedToId: true, assignedTo: { select: { firstName: true, lastName: true } } },
      orderBy: { createdAt: "desc" },
    });
    if (dup && dup.assignedToId !== user.id) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `${dup.assignedTo?.firstName ?? "Another artisan"} ${dup.assignedTo?.lastName ?? ""} already started ${dup.orderNumber} for ${input.serviceType} here. Join with code ${dup.joinCode ?? "(no code)"} instead.`.trim(),
        cause: { existingOrderId: dup.id, orderNumber: dup.orderNumber, joinCode: dup.joinCode } as any,
      });
    }

    const building = await db.clientBuilding.findUnique({
      where: { id: buildingId },
      include: { client: true },
    });
    if (!building) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Building not found" });
    }

    // Validate order-number choice
    if (input.orderNumberStatus === "HAS_NUMBER" && !input.clientOrderNumber) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Client order number is required when status is HAS_NUMBER" });
    }
    if ((input.orderNumberStatus === "PENDING_FROM_CLIENT" || input.orderNumberStatus === "NO_ORDER_REQUIRED")
        && !input.noOrderReason) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Reason is required when no order number" });
    }

    // Auto-generate our internal order number (shared helper skips poisoned suffixes)
    const companyDetails = await getCompanyDetails();
    const orderNumber = await getNextOrderNumber(db, companyDetails.orderPrefix || "SQR");

    // Decide initial status
    const initialStatus =
      input.orderNumberStatus === "PENDING_FROM_CLIENT" ? "AWAITING_ORDER_NUMBER" : "SELF_INITIATED";

    // Build invoicingBlockers snapshot
    const invoicingBlockers: any[] = [{ type: "PENDING_ADMIN_REVIEW", since: new Date().toISOString() }];
    if (input.orderNumberStatus === "PENDING_FROM_CLIENT") {
      invoicingBlockers.push({ type: "NO_ORDER_NUMBER", since: new Date().toISOString() });
    }

    // PR-6 — generate a unique 6-digit join code so crew can join via mobile
    const joinCode = await generateUniqueJoinCode();
    // Short-lived TTL so codes cannot be shared/reused far in the future.
    const joinCodeExpiresAt = new Date(Date.now() + 15 * 60_000);

    // Resolve TM responsibility so the job attributes correctly even on
    // self-initiated jobs.
    // Priority:
    //   1. Explicit `technicalManagerId` from the wizard (legacy TmPicker)
    //   2. NEW: The unified "Site Lead / Technical Manager / Ops Manager" pick
    //      — whoever the artisan chose becomes the statement owner for this
    //      job. Same id is mirrored to `siteLeadId` and `opsManagerId` further
    //      down so the job appears on that person's statement regardless of
    //      which role they hold.
    //   3. Explicit `opsManagerId` from the wizard (legacy OpsManagerPicker)
    //   4. Their configured defaultTechnicalManagerId
    //   5. Themselves (last-resort so we NEVER leave technicalManagerId null on
    //      self-initiated jobs — those show up as "Unassigned TM" and are hard
    //      to attribute after the fact).
    // Validate the picked user has an active CommissionRule of role="TM",
    // "SITE_LEAD" **or** "OPS_MANAGER" (the wizard now presents them as a
    // single combined supervisor list, and whoever is picked becomes the
    // statement holder for this job — no separate TM/OM step, no admin
    // re-confirmation).
    let resolvedTechnicalManagerId: number;
    let tmSource: TmAssignmentSource;
    const pickedLeadId =
      input.technicalManagerId ?? input.siteLeadId ?? input.opsManagerId ?? null;
    if (pickedLeadId) {
      const activeTm = await db.commissionRule.findFirst({
        where: {
          userId: pickedLeadId,
          role: { in: ["TM", "SITE_LEAD", "OPS_MANAGER"] as any },
          effectiveFrom: { lte: new Date() },
          OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
        },
        select: { id: true },
      });
      if (!activeTm) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Selected supervisor is not active — refresh the list and choose again.",
        });
      }
      resolvedTechnicalManagerId = pickedLeadId;
      tmSource = "ARTISAN_PICKED";
    } else {
      const initiator = await db.user.findUnique({
        where: { id: user.id },
        select: { defaultTechnicalManagerId: true },
      });
      if (initiator?.defaultTechnicalManagerId) {
        resolvedTechnicalManagerId = initiator.defaultTechnicalManagerId;
        tmSource = "INITIATOR_DEFAULT_TM";
      } else {
        // Last resort: self-attribute so the row never has NULL TM.
        resolvedTechnicalManagerId = user.id;
        tmSource = "CREW_LEAD";
      }
    }

    const order = await db.order.create({
      data: {
        orderNumber,
        // snapshots from building/client
        customerName: building.client?.name ?? "Unknown",
        customerEmail: building.client?.email ?? "",
        customerPhone: building.client?.phone ?? "",
        address: building.address,
        serviceType: input.serviceType,
        description: input.description,
        status: initialStatus as any,
        assignedToId: user.id,
        technicalManagerId: resolvedTechnicalManagerId,
        clientId: building.clientId,
        clientBuildingId: building.id,
        // PR-3 self-initiated fields
        selfInitiated: true,
        initiatedById: user.id,
        clientOrderNumber: input.clientOrderNumber,
        orderNumberStatus: input.orderNumberStatus as any,
        noOrderReason: input.noOrderReason,
        invoicingBlockers,
        startTime: new Date(),
        joinCode,
        joinCodeExpiresAt,
        siteLat: typeof input.lat === "number" ? input.lat : null,
        siteLng: typeof input.lng === "number" ? input.lng : null,
        beforePictures: input.beforePhotos,
      },
    });

    // PR-6 — register the creator as the LEAD crew member with rate snapshot
    const me = await db.user.findUnique({
      where: { id: user.id },
      select: { hourlyRate: true, dailyRate: true },
    });
    await db.orderCrew.create({
      data: {
        orderId: order.id,
        userId: user.id,
        role: "LEAD",
        hourlyRate: me?.hourlyRate ?? null,
        dailyRate: me?.dailyRate ?? null,
        ssraAckedAt: new Date(), // lead implicitly acks by initiating SSRA next
        joinLat: typeof input.lat === "number" ? input.lat : null,
        joinLng: typeof input.lng === "number" ? input.lng : null,
        joinDistanceMeters: 0,
      },
    });

    // PR-8 — Log the initial TM assignment for this self-initiated order.
    await logTmAssignment(db, {
      orderId: order.id,
      fromTmId: null,
      toTmId: resolvedTechnicalManagerId,
      source: tmSource,
      actorId: user.id,
      reason: `Self-initiated order ${order.orderNumber}`,
    });

    // PR-8 E — Auto-attach sales agent from client/building defaults.
    try {
      const { resolveSalesAgentFromDefaults, logSalesAgentAssignment } = await import(
        "~/server/utils/salesAgentAssignmentLog"
      );
      const resolvedSa = await resolveSalesAgentFromDefaults({
        clientBuildingId: building.id,
        clientId: building.clientId,
      });
      if (resolvedSa.salesAgentId && resolvedSa.source) {
        await db.order.update({
          where: { id: order.id },
          data: { salesAgentId: resolvedSa.salesAgentId },
        });
        await logSalesAgentAssignment(db, {
          orderId: order.id,
          fromSalesAgentId: null,
          toSalesAgentId: resolvedSa.salesAgentId,
          source: resolvedSa.source,
          actorId: user.id,
          reason: `Self-initiated order ${order.orderNumber}`,
        });
      }
    } catch (saErr) {
      console.error("Failed to auto-resolve sales agent on artisan-initiated order:", saErr);
    }

    // PR-8 F — Site Lead + Ops Manager: honour artisan-picked values (validate
    // active CommissionRule of matching role), otherwise resolve from defaults.
    try {
      const {
        resolveSiteLeadFromDefaults,
        logSiteLeadAssignment,
        resolveOpsManagerFromDefaults,
        logOpsManagerAssignment,
      } = await import("~/server/utils/crewRoleAssignmentLog");

      // ----- Site Lead -----
      let resolvedSlId: number | null = null;
      let slSource: string | null = null;
      if (input.siteLeadId) {
        // Combined picker: accept anyone with an active SITE_LEAD, TM **or**
        // OPS_MANAGER commission rule (mirrors getActiveSiteLeads / the
        // "Site Lead / Technical Manager / Ops Manager" dropdown on the
        // artisan job-start wizard).
        const active = await db.commissionRule.findFirst({
          where: {
            userId: input.siteLeadId,
            role: { in: ["SITE_LEAD", "TM", "OPS_MANAGER"] as any },
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (!active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected supervisor is not active — refresh the list and choose again.",
          });
        }
        resolvedSlId = input.siteLeadId;
        slSource = "ARTISAN_PICKED";
      } else {
        const r = await resolveSiteLeadFromDefaults({
          initiatorId: user.id,
          assigneeId: user.id,
          clientBuildingId: building.id,
          clientId: building.clientId,
        });
        resolvedSlId = r.siteLeadId;
        slSource = r.source;
      }
      if (resolvedSlId && slSource) {
        await db.order.update({
          where: { id: order.id },
          data: { siteLeadId: resolvedSlId },
        });
        await logSiteLeadAssignment(db, {
          orderId: order.id,
          fromSiteLeadId: null,
          toSiteLeadId: resolvedSlId,
          source: slSource as any,
          actorId: user.id,
          reason: `Self-initiated order ${order.orderNumber}`,
        });
      }

      // ----- Ops Manager -----
      // Combined picker: the wizard sends a single `siteLeadId` and we mirror
      // that same id into `opsManagerId` when the caller didn't supply one
      // explicitly — so whoever the artisan picked is the supervisor across
      // Site Lead, Technical Manager and Ops Manager statements.
      let resolvedOmId: number | null = null;
      let omSource: string | null = null;
      const opsManagerCandidateId = input.opsManagerId ?? input.siteLeadId ?? null;
      if (opsManagerCandidateId) {
        const active = await db.commissionRule.findFirst({
          where: {
            userId: opsManagerCandidateId,
            role: { in: ["OPS_MANAGER", "TM", "SITE_LEAD"] as any },
            effectiveFrom: { lte: new Date() },
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: new Date() } }],
          },
          select: { id: true },
        });
        if (!active) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected supervisor is not active — refresh the list and choose again.",
          });
        }
        resolvedOmId = opsManagerCandidateId;
        omSource = "ARTISAN_PICKED";
      } else {
        const r = await resolveOpsManagerFromDefaults({
          initiatorId: user.id,
          assigneeId: user.id,
          clientBuildingId: building.id,
          clientId: building.clientId,
        });
        resolvedOmId = r.opsManagerId;
        omSource = r.source;
      }
      if (resolvedOmId && omSource) {
        await db.order.update({
          where: { id: order.id },
          data: { opsManagerId: resolvedOmId },
        });
        await logOpsManagerAssignment(db, {
          orderId: order.id,
          fromOpsManagerId: null,
          toOpsManagerId: resolvedOmId,
          source: omSource as any,
          actorId: user.id,
          reason: `Self-initiated order ${order.orderNumber}`,
        });
      }
    } catch (crewErr) {
      // Bubble up validation TRPCErrors (BAD_REQUEST) so the artisan sees "pick again".
      if (crewErr instanceof TRPCError) throw crewErr;
      console.error("Failed to auto-resolve site-lead/ops-manager on artisan-initiated order:", crewErr);
    }

    // Notify admins
    try {
      await notifyAdmins({
        message: `Artisan ${user.firstName} ${user.lastName} self-initiated order ${order.orderNumber} at ${building.name}.`,
        type: "ARTISAN_SELF_INITIATED_JOB" as any,
        relatedEntityId: order.id,
        relatedEntityType: "Order",
      });
    } catch (e) {
      console.error("[artisanCreateOrder] notifyAdmins failed:", e);
    }

    return { orderId: order.id, orderNumber: order.orderNumber, joinCode, joinCodeExpiresAt, requiresSsra: true };
  });

// ----- SSRA template fetch + submission --------------------------------------

export const artisanGetSsraTemplate = baseProcedure
  .input(z.object({ token: z.string(), serviceType: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisan(user.role);
    return getSsraTemplate(input.serviceType);
  });

// AI-powered SSRA question generator. Returns job-specific yes/no questions
// with metadata (safeAnswer, criticality, onUnsafe risk item). Called by the
// artisan wizard on step 4 entry AFTER the order has been created so we have
// the real service type + description + location to feed the model.
export const artisanGenerateSsraForOrder = baseProcedure
  .input(z.object({ token: z.string(), orderId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisan(user.role);

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      select: {
        id: true,
        serviceType: true,
        description: true,
        address: true,
        customerName: true,
        assignedToId: true,
      },
    });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.assignedToId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your order" });
    }

    try {
      const set = await generateSsraQuestionsForJob({
        serviceType: order.serviceType,
        description: order.description,
        location: order.address ?? undefined,
        customerName: order.customerName ?? undefined,
      });
      return {
        aiGenerated: true,
        jobSummary: set.jobSummary,
        overallRiskProfile: set.overallRiskProfile,
        questions: set.questions,
      };
    } catch (err) {
      // Fall back to static template so the artisan is never blocked from
      // starting a job by an AI-provider outage. Convert static template
      // questions to the same shape but mark them as WARN-only.
      console.error("[artisanGenerateSsraForOrder] AI failed, falling back to static template:", err);
      const template = getSsraTemplate(order.serviceType);
      const fallback: AiSsraQuestion[] = template.questions.map((q) => ({
        id: q.id,
        prompt: q.prompt,
        category: "HAZARD" as const,
        safeAnswer: "no" as const,
        criticality: "WARN" as const,
        rationale: "Static fallback template — AI generator unavailable.",
        onUnsafe: {
          hazard: q.onYes[0]?.hazard ?? q.prompt,
          potentialHarm: q.onYes[0]?.potentialHarm ?? "Injury or property damage",
          inherentLikelihood: q.onYes[0]?.inherentLikelihood ?? 3,
          inherentSeverity: q.onYes[0]?.inherentSeverity ?? 3,
          controls: q.onYes[0]?.controls ?? "Follow standard safe work practices",
          responsiblePerson: "Artisan",
          residualLikelihood: q.onYes[0]?.residualLikelihood ?? 2,
          residualSeverity: q.onYes[0]?.residualSeverity ?? 2,
          ppeRequired: q.onYes[0]?.ppeRequired ?? [],
          trainingRequired: q.onYes[0]?.trainingRequired ?? [],
          legalReferences: ["OHS Act 85 of 1993", "Construction Regulations 2014"],
        },
      }));
      return {
        aiGenerated: false,
        jobSummary: `${order.serviceType} — ${order.description.slice(0, 120)}`,
        overallRiskProfile: "MEDIUM" as const,
        questions: fallback,
      };
    }
  });

// SSRA submission — accepts EITHER the AI-generated question set (preferred)
// with a full `questions` payload, or falls back to the legacy static
// template path (`answers` only) for backwards compatibility.
export const artisanSubmitSsra = baseProcedure
  .input(z.object({
    token: z.string(),
    orderId: z.number(),
    answers: z.array(z.object({ questionId: z.string(), answer: z.enum(["yes", "no"]) })),
    // When present, the SSRA is validated against the AI-generated set with
    // BLOCK-criticality gating. When absent we fall back to the legacy
    // static template (kept only for backward compat with older clients).
    questions: z
      .array(z.object({
        id: z.string(),
        prompt: z.string(),
        category: z.string().optional(),
        safeAnswer: z.enum(["yes", "no"]),
        criticality: z.enum(["BLOCK", "WARN"]),
        rationale: z.string().optional(),
        onUnsafe: z.object({
          hazard: z.string(),
          potentialHarm: z.string(),
          inherentLikelihood: z.number(),
          inherentSeverity: z.number(),
          controls: z.string(),
          residualLikelihood: z.number(),
          residualSeverity: z.number(),
          ppeRequired: z.array(z.string()).default([]),
          trainingRequired: z.array(z.string()).default([]),
          legalReferences: z.array(z.string()).default([]),
        }),
      }))
      .optional(),
    aiGenerated: z.boolean().optional(),
    additionalNotes: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureArtisan(user.role);

    const order = await db.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    if (order.assignedToId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your order" });
    }

    const items: any[] = [];
    let overallSeverity = 1;
    let overallLikelihood = 1;

    // -------- AI-generated path (preferred) ---------------------------------
    if (input.questions && input.questions.length > 0) {
      // 1. Enforce BLOCK gate. Any BLOCK-criticality question that is
      //    answered unsafely halts SSRA submission and returns a structured
      //    error so the UI can surface it as a red banner.
      const answerMap = new Map(input.answers.map((a) => [a.questionId, a.answer]));
      const blockers: Array<{ id: string; prompt: string; required: string; rationale?: string }> = [];
      for (const q of input.questions) {
        const answered = answerMap.get(q.id);
        if (!answered) {
          // Missing answers are treated as blockers only if criticality is BLOCK.
          if (q.criticality === "BLOCK") {
            blockers.push({
              id: q.id,
              prompt: q.prompt,
              required: q.safeAnswer,
              rationale: q.rationale,
            });
          }
          continue;
        }
        if (q.criticality === "BLOCK" && answered !== q.safeAnswer) {
          blockers.push({
            id: q.id,
            prompt: q.prompt,
            required: q.safeAnswer,
            rationale: q.rationale,
          });
        }
      }

      if (blockers.length > 0) {
        // Structured error — the UI reads `cause.blockers` to list them.
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            `Cannot start job: ${blockers.length} critical safety item${blockers.length > 1 ? "s" : ""} not satisfied. ` +
            blockers.map((b) => `\u2022 ${b.prompt} (required: ${b.required.toUpperCase()})`).join(" "),
          cause: { blockers } as any,
        });
      }

      // 2. Build risk items — one per question answered unsafely (both BLOCK
      //    and WARN, though BLOCK would have thrown already so in practice
      //    only WARN items reach here).
      for (const q of input.questions) {
        const answered = answerMap.get(q.id);
        if (!answered || answered === q.safeAnswer) continue;
        const it = q.onUnsafe;
        items.push({
          hazard: it.hazard,
          potentialHarm: it.potentialHarm,
          inherentLikelihood: it.inherentLikelihood,
          inherentSeverity: it.inherentSeverity,
          inherentRisk: riskLevelFrom(it.inherentLikelihood * it.inherentSeverity),
          controls: it.controls,
          residualLikelihood: it.residualLikelihood,
          residualSeverity: it.residualSeverity,
          residualRisk: riskLevelFrom(it.residualLikelihood * it.residualSeverity),
          ppeRequired: it.ppeRequired ?? [],
          trainingRequired: it.trainingRequired ?? [],
          legalReferences: it.legalReferences?.length ? it.legalReferences : ["OHS Act 85 of 1993", "Construction Regulations 2014"],
        });
        if (it.residualSeverity > overallSeverity) overallSeverity = it.residualSeverity;
        if (it.residualLikelihood > overallLikelihood) overallLikelihood = it.residualLikelihood;
      }
    } else {
      // -------- Legacy static-template path ---------------------------------
      const template = getSsraTemplate(order.serviceType);
      for (const ans of input.answers) {
        if (ans.answer !== "yes") continue;
        const q = template.questions.find((qq) => qq.id === ans.questionId);
        if (!q) continue;
        for (const it of q.onYes) {
          const inherentRiskLevel = riskLevelFrom(it.inherentLikelihood * it.inherentSeverity);
          const residualRiskLevel = riskLevelFrom(it.residualLikelihood * it.residualSeverity);
          items.push({
            hazard: it.hazard,
            potentialHarm: it.potentialHarm,
            inherentLikelihood: it.inherentLikelihood,
            inherentSeverity: it.inherentSeverity,
            inherentRisk: inherentRiskLevel,
            controls: it.controls,
            residualLikelihood: it.residualLikelihood,
            residualSeverity: it.residualSeverity,
            residualRisk: residualRiskLevel,
            ppeRequired: it.ppeRequired,
            trainingRequired: it.trainingRequired ?? [],
            legalReferences: ["OHS Act 85 of 1993", "Construction Regulations 2014"],
          });
          if (it.residualSeverity > overallSeverity) overallSeverity = it.residualSeverity;
          if (it.residualLikelihood > overallLikelihood) overallLikelihood = it.residualLikelihood;
        }
      }
    }

    const overallRisk = riskLevelFrom(overallSeverity * overallLikelihood);
    const reference = `SSRA-${order.orderNumber}-${Date.now().toString().slice(-5)}`;

    const summaryParts: string[] = [];
    if (input.aiGenerated) summaryParts.push("AI-generated job-specific SSRA.");
    if (input.additionalNotes) summaryParts.push(`Artisan notes: ${input.additionalNotes}`);

    const ra = await db.ohsRiskAssessment.create({
      data: {
        reference,
        title: `SSRA for ${order.orderNumber} \u2014 ${order.serviceType}`,
        activity: order.description.slice(0, 240),
        location: order.address,
        status: "PUBLISHED",
        effectiveDate: new Date(),
        reviewDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        orderId: order.id,
        clientBuildingId: order.clientBuildingId,
        createdById: user.id,
        contractorId: user.id,
        overallRisk: overallRisk as any,
        aiGenerated: !!input.aiGenerated,
        aiSummary: summaryParts.length ? summaryParts.join(" ") : null,
        items: { create: items },
      },
      include: { items: true },
    });

    if (order.status === ("SELF_INITIATED" as any) || order.status === ("AWAITING_ORDER_NUMBER" as any)) {
      await db.order.update({
        where: { id: order.id },
        data: {
          status: "IN_PROGRESS" as any,
          startTime: order.startTime ?? new Date(),
        },
      });
    }

    return { riskAssessmentId: ra.id, reference: ra.reference, overallRisk: ra.overallRisk, itemCount: ra.items.length };
  });

function riskLevelFrom(score: number): string {
  if (score >= 20) return "CRITICAL";
  if (score >= 12) return "HIGH";
  if (score >= 6) return "MEDIUM";
  return "LOW";
}

// ----- admin: list + review self-initiated jobs ------------------------------

export const adminListSelfInitiated = baseProcedure
  .input(z.object({
    token: z.string(),
    status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) {
      // Allow managers too
      if (!["MANAGER", "TECHNICAL_MANAGER", "SENIOR_ADMIN"].includes(user.role)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
      }
    }

    const where: any = { selfInitiated: true };
    if (input.status === "pending") {
      where.adminReviewedAt = null;
      where.selfInitiatedRejected = false;
    } else if (input.status === "approved") {
      where.adminReviewedAt = { not: null };
      where.selfInitiatedRejected = false;
    } else if (input.status === "rejected") {
      where.selfInitiatedRejected = true;
    }

    const rows = await db.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        client: { select: { id: true, name: true } },
        clientBuilding: { select: { id: true, name: true, address: true } },
        initiatedBy: { select: { id: true, firstName: true, lastName: true, email: true } },
        ohsRiskAssessments: { select: { id: true, reference: true, overallRisk: true } },
      },
    });

    return rows;
  });

export const adminApproveSelfInitiated = baseProcedure
  .input(z.object({
    token: z.string(),
    orderId: z.number(),
    note: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && !["MANAGER", "TECHNICAL_MANAGER", "SENIOR_ADMIN"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const order = await db.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    const blockers = Array.isArray(order.invoicingBlockers)
      ? (order.invoicingBlockers as any[]).filter((b) => b.type !== "PENDING_ADMIN_REVIEW")
      : [];

    // If the artisan already finished the work before admin got to review it
    // (endTime set), promote straight to COMPLETED so it lands in Ready for
    // Invoicing immediately — no bottleneck at IN_PROGRESS.
    const alreadyDone = !!order.endTime;
    const nextStatus =
      order.status === ("SELF_INITIATED" as any)
        ? alreadyDone
          ? ("COMPLETED" as any)
          : ("IN_PROGRESS" as any)
        : order.status;

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        adminReviewedAt: new Date(),
        adminReviewedById: user.id,
        invoicingBlockers: blockers,
        // promote status if it was SELF_INITIATED → in progress (or COMPLETED if already done)
        status: nextStatus,
        notes: input.note ? `${order.notes ?? ""}\n[Admin approval ${new Date().toISOString()}]: ${input.note}` : order.notes,
      },
    });

    if (order.initiatedById) {
      try {
        await createNotification({
          recipientId: order.initiatedById,
          recipientRole: "ARTISAN",
          message: `Your self-initiated job ${order.orderNumber} was approved.`,
          type: "ARTISAN_SELF_INITIATED_JOB" as any,
          relatedEntityId: order.id,
          relatedEntityType: "Order",
        });
      } catch {}
    }

    return updated;
  });

export const adminRejectSelfInitiated = baseProcedure
  .input(z.object({
    token: z.string(),
    orderId: z.number(),
    reason: z.string().min(3),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && !["MANAGER", "TECHNICAL_MANAGER", "SENIOR_ADMIN"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const order = await db.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        adminReviewedAt: new Date(),
        adminReviewedById: user.id,
        selfInitiatedRejected: true,
        selfInitiatedRejectReason: input.reason,
        status: "CANCELLED" as any,
      },
    });

    if (order.initiatedById) {
      try {
        await createNotification({
          recipientId: order.initiatedById,
          recipientRole: "ARTISAN",
          message: `Your self-initiated job ${order.orderNumber} was rejected: ${input.reason}`,
          type: "ARTISAN_SELF_INITIATED_JOB" as any,
          relatedEntityId: order.id,
          relatedEntityType: "Order",
        });
      } catch {}
    }

    return updated;
  });

// Attach the client's PO / order number to an existing order — used when the
// job was self-initiated with orderNumberStatus PENDING_FROM_CLIENT and the
// admin has since received the number from the client. Clears the
// NO_ORDER_NUMBER invoicing blocker and promotes AWAITING_ORDER_NUMBER →
// SELF_INITIATED (or IN_PROGRESS if admin has already reviewed).
export const adminAttachClientOrderNumber = baseProcedure
  .input(z.object({
    token: z.string(),
    orderId: z.number(),
    clientOrderNumber: z.string().min(1, "Order number is required"),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user) && !["MANAGER", "TECHNICAL_MANAGER", "SENIOR_ADMIN"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
    }

    const order = await db.order.findUnique({ where: { id: input.orderId } });
    if (!order) throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });

    const blockers = Array.isArray(order.invoicingBlockers)
      ? (order.invoicingBlockers as any[]).filter((b) => b.type !== "NO_ORDER_NUMBER")
      : [];

    let nextStatus: any = order.status;
    if (order.status === ("AWAITING_ORDER_NUMBER" as any)) {
      nextStatus = order.adminReviewedAt ? ("IN_PROGRESS" as any) : ("SELF_INITIATED" as any);
    }

    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        clientOrderNumber: input.clientOrderNumber.trim(),
        orderNumberStatus: "HAS_NUMBER" as any,
        noOrderReason: null,
        invoicingBlockers: blockers,
        status: nextStatus,
      },
    });

    if (order.initiatedById) {
      try {
        await createNotification({
          recipientId: order.initiatedById,
          recipientRole: "ARTISAN",
          message: `Client PO captured for ${order.orderNumber}: ${input.clientOrderNumber.trim()}`,
          type: "ARTISAN_SELF_INITIATED_JOB" as any,
          relatedEntityId: order.id,
          relatedEntityType: "Order",
        });
      } catch {}
    }

    return updated;
  });
