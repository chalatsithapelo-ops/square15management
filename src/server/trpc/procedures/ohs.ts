// All OHS module tRPC procedures bundled into a single file for compactness.
// Each procedure is exported individually so root.ts can register them.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";
import {
  analyzeActivityRisks,
  analyzeIncident,
  generateToolboxTalk as aiGenerateToolboxTalk,
  levelFromScore,
} from "~/server/utils/ohs-ai";
import {
  buildRiskAssessmentPdf,
  buildIncidentPdf,
  buildToolboxTalkPdf,
  buildOhsDocumentPdf,
} from "~/server/utils/ohs-pdf";
import { getCompanyDetails } from "~/server/utils/company-details";

// ---------- helpers ----------
const AdminRoles = ["SENIOR_ADMIN", "JUNIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"] as const;
const ContractorRoles = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"] as const;
const RoleAdminContractor: readonly string[] = [...AdminRoles, ...ContractorRoles];

function assertOhsManager(user: { role: string }) {
  if (!RoleAdminContractor.includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "OHS management requires admin or contractor role." });
  }
}

function isContractorRoleStr(role: string): boolean {
  return (ContractorRoles as readonly string[]).includes(role);
}

// ---- AI rate limiter (simple in-memory token bucket per user) ----
const _aiHits = new Map<number, { count: number; resetAt: number }>();
const AI_LIMIT_PER_MIN = 8;
function enforceAiRateLimit(userId: number) {
  const now = Date.now();
  const bucket = _aiHits.get(userId);
  if (!bucket || bucket.resetAt < now) {
    _aiHits.set(userId, { count: 1, resetAt: now + 60_000 });
    return;
  }
  if (bucket.count >= AI_LIMIT_PER_MIN) {
    throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "AI rate limit reached. Please wait a minute before retrying." });
  }
  bucket.count++;
}

// Race-safe reference numbering: date-prefixed + retry on unique constraint.
// Uses count() as starting point, retries up to 5 times if a collision occurs at insert time.
async function nextRef(prefix: string, table: "incident" | "risk" | "toolbox" | "doc", attempt = 0): Promise<string> {
  const year = new Date().getUTCFullYear();
  let n = 1;
  if (table === "incident") n = (await db.ohsIncident.count()) + 1 + attempt;
  if (table === "risk") n = (await db.ohsRiskAssessment.count()) + 1 + attempt;
  if (table === "toolbox") n = (await db.ohsToolboxTalk.count()) + 1 + attempt;
  if (table === "doc") n = (await db.ohsDocument.count()) + 1 + attempt;
  return `${prefix}-${year}-${String(n).padStart(5, "0")}`;
}

// Wrap a create that uses a generated reference; retries on P2002 (unique violation) up to 5 times.
async function withRefRetry<T>(prefix: string, table: "incident" | "risk" | "toolbox" | "doc", fn: (ref: string) => Promise<T>): Promise<T> {
  let lastErr: any;
  for (let i = 0; i < 5; i++) {
    const ref = await nextRef(prefix, table, i);
    try {
      return await fn(ref);
    } catch (e: any) {
      lastErr = e;
      if (e?.code !== "P2002") throw e; // not a unique-constraint error
    }
  }
  throw lastErr;
}

async function companyHeader() {
  const c = await getCompanyDetails();
  return {
    name: c?.companyName || "Square 15 Property Management",
    email: c?.companyEmail || null,
    phone: c?.companyPhone || null,
    address: c?.companyPhysicalAddress || null,
    vatNumber: c?.companyVatNumber || null,
  };
}

// ===========================================================================
// AI procedures
// ===========================================================================
export const ohsAnalyzeRisks = baseProcedure
  .input(z.object({
    token: z.string(),
    activity: z.string().min(3),
    location: z.string().optional(),
    industryContext: z.string().optional(),
    knownHazards: z.array(z.string()).optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    enforceAiRateLimit(user.id);
    try {
      const result = await analyzeActivityRisks({
        activity: input.activity,
        location: input.location,
        industryContext: input.industryContext,
        knownHazards: input.knownHazards,
      });
      return result;
    } catch (e: any) {
      if (e instanceof TRPCError) throw e;
      console.error("ohsAnalyzeRisks AI error:", e);
      const reason = e?.message || "unknown error";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI risk analysis failed (${reason}). Please try again or fill in manually.` });
    }
  });

export const ohsAnalyzeIncident = baseProcedure
  .input(z.object({
    token: z.string(),
    description: z.string().min(10),
    location: z.string().optional(),
    injuredPersonRole: z.string().optional(),
    immediateActions: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    // Any authenticated user can analyse an incident they're reporting; rate-limit to prevent abuse.
    enforceAiRateLimit(user.id);
    try {
      return await analyzeIncident(input);
    } catch (e: any) {
      if (e instanceof TRPCError) throw e;
      console.error("ohsAnalyzeIncident AI error:", e);
      const reason = e?.message || "unknown error";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI incident analysis failed (${reason}).` });
    }
  });

export const ohsGenerateToolboxTalk = baseProcedure
  .input(z.object({
    token: z.string(),
    topic: z.string().min(3),
    context: z.string().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    enforceAiRateLimit(user.id);
    try {
      return await aiGenerateToolboxTalk(input);
    } catch (e: any) {
      if (e instanceof TRPCError) throw e;
      console.error("ohsGenerateToolboxTalk AI error:", e);
      const reason = e?.message || "unknown error";
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI toolbox talk generation failed (${reason}).` });
    }
  });

// ===========================================================================
// Risk Assessments
// ===========================================================================
const RiskItemInput = z.object({
  hazard: z.string().min(2),
  potentialHarm: z.string().min(2),
  inherentLikelihood: z.number().min(1).max(5),
  inherentSeverity: z.number().min(1).max(5),
  controls: z.string(),
  responsiblePerson: z.string().optional().nullable(),
  residualLikelihood: z.number().min(1).max(5),
  residualSeverity: z.number().min(1).max(5),
  ppeRequired: z.array(z.string()).default([]),
  trainingRequired: z.array(z.string()).default([]),
  legalReferences: z.array(z.string()).default([]),
  notes: z.string().optional().nullable(),
  aiSuggested: z.boolean().optional(),
});

export const ohsCreateRiskAssessment = baseProcedure
  .input(z.object({
    token: z.string(),
    title: z.string().min(2),
    activity: z.string().min(2),
    location: z.string().optional().nullable(),
    projectId: z.number().optional().nullable(),
    orderId: z.number().optional().nullable(),
    clientBuildingId: z.number().optional().nullable(),
    effectiveDate: z.string().optional().nullable(),
    reviewDate: z.string().optional().nullable(),
    aiSummary: z.string().optional().nullable(),
    aiGenerated: z.boolean().optional(),
    items: z.array(RiskItemInput).min(1),
    publish: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);

    // Compute overall residual risk = highest item residual.
    const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
    let overall: typeof order[number] = "LOW";
    for (const it of input.items) {
      const lvl = levelFromScore(it.residualLikelihood, it.residualSeverity);
      if (order.indexOf(lvl) > order.indexOf(overall)) overall = lvl;
    }

    const ra = await withRefRetry("OHS-RA", "risk", (reference) => db.ohsRiskAssessment.create({
      data: {
        reference,
        title: input.title,
        activity: input.activity,
        location: input.location ?? null,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
        projectId: input.projectId ?? null,
        orderId: input.orderId ?? null,
        clientBuildingId: input.clientBuildingId ?? null,
        createdById: user.id,
        contractorId: isContractorRoleStr(user.role) ? user.id : null,
        overallRisk: overall,
        aiGenerated: !!input.aiGenerated,
        aiSummary: input.aiSummary ?? null,
        items: {
          create: input.items.map((it) => ({
            hazard: it.hazard,
            potentialHarm: it.potentialHarm,
            inherentLikelihood: it.inherentLikelihood,
            inherentSeverity: it.inherentSeverity,
            inherentRisk: levelFromScore(it.inherentLikelihood, it.inherentSeverity),
            controls: it.controls,
            responsiblePerson: it.responsiblePerson ?? null,
            residualLikelihood: it.residualLikelihood,
            residualSeverity: it.residualSeverity,
            residualRisk: levelFromScore(it.residualLikelihood, it.residualSeverity),
            ppeRequired: it.ppeRequired ?? [],
            trainingRequired: it.trainingRequired ?? [],
            legalReferences: it.legalReferences ?? [],
            notes: it.notes ?? null,
            aiSuggested: !!it.aiSuggested,
          })),
        },
      },
      include: { items: true },
    }));

    // Notify admins on publish.
    if (input.publish) {
      const admins = await db.user.findMany({ where: { role: { in: ["SENIOR_ADMIN", "JUNIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"] } }, select: { id: true, role: true } });
      for (const a of admins) {
        await createNotification({
          recipientId: a.id,
          recipientRole: a.role,
          message: `Risk assessment ${ra.reference} (${ra.title}) published — overall risk ${ra.overallRisk}.`,
          type: "OHS_RISK_ASSESSMENT_PUBLISHED",
          relatedEntityId: ra.id,
          relatedEntityType: "OHS_RISK_ASSESSMENT",
        });
      }
    }

    return ra;
  });

export const ohsListRiskAssessments = baseProcedure
  .input(z.object({
    token: z.string(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    projectId: z.number().optional(),
    orderId: z.number().optional(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const where: any = {};
    if (input.status) where.status = input.status;
    if (input.projectId) where.projectId = input.projectId;
    if (input.orderId) where.orderId = input.orderId;
    if (!isAdmin(user) && isContractorRoleStr(user.role)) {
      where.OR = [{ contractorId: user.id }, { createdById: user.id }];
    }
    return db.ohsRiskAssessment.findMany({
      where,
      include: {
        items: true,
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
        project: { select: { projectNumber: true, name: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

export const ohsApproveRiskAssessment = baseProcedure
  .input(z.object({ token: z.string(), riskAssessmentId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can approve." });
    return db.ohsRiskAssessment.update({
      where: { id: input.riskAssessmentId },
      data: { approvedById: user.id, approvedAt: new Date(), status: "PUBLISHED" },
    });
  });

export const ohsDeleteRiskAssessment = baseProcedure
  .input(z.object({ token: z.string(), riskAssessmentId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete." });
    await db.ohsRiskAssessment.delete({ where: { id: input.riskAssessmentId } });
    return { success: true };
  });

export const ohsUpdateRiskAssessment = baseProcedure
  .input(z.object({
    token: z.string(),
    riskAssessmentId: z.number(),
    title: z.string().optional(),
    activity: z.string().optional(),
    location: z.string().optional().nullable(),
    effectiveDate: z.string().optional().nullable(),
    reviewDate: z.string().optional().nullable(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    items: z.array(RiskItemInput).optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const existing = await db.ohsRiskAssessment.findUnique({ where: { id: input.riskAssessmentId }, select: { contractorId: true, status: true } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Risk assessment not found" });
    // Scope: admin, or owning contractor.
    if (!isAdmin(user)) {
      if (!isContractorRoleStr(user.role) || existing.contractorId !== user.id) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised to edit this risk assessment." });
      }
    }

    let overallUpdate: any = undefined;
    if (input.items && input.items.length > 0) {
      const order = ["LOW", "MEDIUM", "HIGH", "CRITICAL"] as const;
      let overall: typeof order[number] = "LOW";
      for (const it of input.items) {
        const lvl = levelFromScore(it.residualLikelihood, it.residualSeverity);
        if (order.indexOf(lvl) > order.indexOf(overall)) overall = lvl;
      }
      overallUpdate = overall;
      // Replace all items in a transaction.
      await db.$transaction([
        db.ohsRiskItem.deleteMany({ where: { riskAssessmentId: input.riskAssessmentId } }),
        db.ohsRiskItem.createMany({
          data: input.items.map((it) => ({
            riskAssessmentId: input.riskAssessmentId,
            hazard: it.hazard,
            potentialHarm: it.potentialHarm,
            inherentLikelihood: it.inherentLikelihood,
            inherentSeverity: it.inherentSeverity,
            inherentRisk: levelFromScore(it.inherentLikelihood, it.inherentSeverity),
            controls: it.controls,
            responsiblePerson: it.responsiblePerson ?? null,
            residualLikelihood: it.residualLikelihood,
            residualSeverity: it.residualSeverity,
            residualRisk: levelFromScore(it.residualLikelihood, it.residualSeverity),
            ppeRequired: it.ppeRequired ?? [],
            trainingRequired: it.trainingRequired ?? [],
            legalReferences: it.legalReferences ?? [],
            notes: it.notes ?? null,
            aiSuggested: !!it.aiSuggested,
          })),
        }),
      ]);
    }

    const updated = await db.ohsRiskAssessment.update({
      where: { id: input.riskAssessmentId },
      data: {
        title: input.title,
        activity: input.activity,
        location: input.location ?? undefined,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : undefined,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : undefined,
        status: input.status,
        ...(overallUpdate ? { overallRisk: overallUpdate } : {}),
      },
      include: { items: true },
    });
    return updated;
  });

export const ohsExportRiskAssessmentPdf = baseProcedure
  .input(z.object({ token: z.string(), riskAssessmentId: z.number() }))
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);
    const ra = await db.ohsRiskAssessment.findUnique({
      where: { id: input.riskAssessmentId },
      include: {
        items: true,
        createdBy: { select: { firstName: true, lastName: true } },
        approvedBy: { select: { firstName: true, lastName: true } },
      },
    });
    if (!ra) throw new TRPCError({ code: "NOT_FOUND", message: "Risk assessment not found" });
    const company = await companyHeader();
    const buffer = await buildRiskAssessmentPdf({
      reference: ra.reference,
      title: ra.title,
      activity: ra.activity,
      location: ra.location,
      status: ra.status,
      overallRisk: ra.overallRisk,
      effectiveDate: ra.effectiveDate,
      reviewDate: ra.reviewDate,
      createdByName: ra.createdBy ? `${ra.createdBy.firstName} ${ra.createdBy.lastName}` : undefined,
      approvedByName: ra.approvedBy ? `${ra.approvedBy.firstName} ${ra.approvedBy.lastName}` : null,
      aiSummary: ra.aiSummary,
      items: ra.items.map((it) => ({
        hazard: it.hazard,
        potentialHarm: it.potentialHarm,
        inherentLikelihood: it.inherentLikelihood,
        inherentSeverity: it.inherentSeverity,
        inherentRisk: it.inherentRisk,
        controls: it.controls,
        responsiblePerson: it.responsiblePerson,
        residualLikelihood: it.residualLikelihood,
        residualSeverity: it.residualSeverity,
        residualRisk: it.residualRisk,
        ppeRequired: it.ppeRequired,
        trainingRequired: it.trainingRequired,
        legalReferences: it.legalReferences,
      })),
      company,
    });
    return { pdf: buffer.toString("base64"), filename: `${ra.reference || "risk-assessment"}.pdf` };
  });

// ===========================================================================
// Incidents (any authenticated user can report)
// ===========================================================================
export const ohsReportIncident = baseProcedure
  .input(z.object({
    token: z.string(),
    type: z.enum(["NEAR_MISS", "FIRST_AID", "MEDICAL_TREATMENT", "LOST_TIME_INJURY", "FATALITY", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "DANGEROUS_OCCURRENCE", "OCCUPATIONAL_DISEASE", "OTHER"]),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    occurredAt: z.string(),
    location: z.string().min(2),
    description: z.string().min(10),
    immediateActions: z.string().optional().nullable(),
    injuredPersonName: z.string().optional().nullable(),
    injuredPersonRole: z.string().optional().nullable(),
    injuredPersonContact: z.string().optional().nullable(),
    injuredUserId: z.number().optional().nullable(),
    witnesses: z.string().optional().nullable(),
    projectId: z.number().optional().nullable(),
    orderId: z.number().optional().nullable(),
    clientBuildingId: z.number().optional().nullable(),
    attachments: z.array(z.string()).optional(),
    runAi: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    let aiInsightsText: string | undefined;
    let aiClassification: any = null;
    if (input.runAi) {
      try {
        const ai = await analyzeIncident({
          description: input.description,
          location: input.location,
          injuredPersonRole: input.injuredPersonRole ?? undefined,
          immediateActions: input.immediateActions ?? undefined,
        });
        aiClassification = ai;
        aiInsightsText = `Suggested type: ${ai.classification}\nSuggested severity: ${ai.severity}\nReportable to DoL: ${ai.reportableToDol ? "YES" : "NO"}\n\nRoot cause hypothesis: ${ai.rootCauseHypothesis}\n\nImmediate actions:\n${ai.immediateActions.map((s) => "• " + s).join("\n")}\n\nLearnings: ${ai.learnings}`;
      } catch (e) {
        console.error("AI analyse failed (non-fatal):", e);
      }
    }

    const incident = await withRefRetry("OHS-INC", "incident", (reference) => db.ohsIncident.create({
      data: {
        reference,
        type: input.type,
        severity: input.severity,
        status: "REPORTED",
        occurredAt: new Date(input.occurredAt),
        location: input.location,
        description: input.description,
        immediateActions: input.immediateActions ?? null,
        injuredPersonName: input.injuredPersonName ?? null,
        injuredPersonRole: input.injuredPersonRole ?? null,
        injuredPersonContact: input.injuredPersonContact ?? null,
        injuredUserId: input.injuredUserId ?? null,
        witnesses: input.witnesses ?? null,
        reportedById: user.id,
        projectId: input.projectId ?? null,
        orderId: input.orderId ?? null,
        clientBuildingId: input.clientBuildingId ?? null,
        contractorId: isContractorRoleStr(user.role) ? user.id : null,
        attachments: input.attachments ?? [],
        aiInsights: aiInsightsText,
        aiClassification,
        // dolReportable = AI suggestion; reportedToDol stays false until manually filed.
        dolReportable: aiClassification?.reportableToDol ?? false,
        reportedToDol: false,
      },
    }));

    // Notify all admins immediately. Critical/High also wake them up.
    const admins = await db.user.findMany({
      where: { role: { in: ["SENIOR_ADMIN", "JUNIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER"] } },
      select: { id: true, role: true },
    });
    const sevPrefix = input.severity === "CRITICAL" ? "🚨 CRITICAL " : input.severity === "HIGH" ? "⚠ HIGH " : "";
    for (const a of admins) {
      await createNotification({
        recipientId: a.id,
        recipientRole: a.role,
        message: `${sevPrefix}OHS incident ${incident.reference} reported at ${input.location} — ${input.type.replace(/_/g, " ")}.`,
        type: "OHS_INCIDENT_REPORTED",
        relatedEntityId: incident.id,
        relatedEntityType: "OHS_INCIDENT",
      });
    }

    return incident;
  });

export const ohsListIncidents = baseProcedure
  .input(z.object({
    token: z.string(),
    status: z.enum(["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTION", "CLOSED", "REPORTED_TO_DOL"]).optional(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
    mineOnly: z.boolean().optional(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const where: any = {};
    if (input.status) where.status = input.status;
    if (input.severity) where.severity = input.severity;
    if (input.mineOnly) where.reportedById = user.id;
    if (!isAdmin(user) && !input.mineOnly) {
      // Non-admins only see what they reported, were injured in, plus their contractor's incidents
      where.OR = [
        { reportedById: user.id },
        { injuredUserId: user.id },
        ...(isContractorRoleStr(user.role) ? [{ contractorId: user.id }] : []),
      ];
    }
    return db.ohsIncident.findMany({
      where,
      include: {
        reportedBy: { select: { firstName: true, lastName: true } },
        correctiveActions: true,
        project: { select: { projectNumber: true, name: true } },
        order: { select: { orderNumber: true } },
      },
      orderBy: { occurredAt: "desc" },
      take: 200,
    });
  });

export const ohsUpdateIncident = baseProcedure
  .input(z.object({
    token: z.string(),
    incidentId: z.number(),
    status: z.enum(["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTION", "CLOSED", "REPORTED_TO_DOL"]).optional(),
    rootCause: z.string().optional().nullable(),
    investigationNotes: z.string().optional().nullable(),
    reportedToDol: z.boolean().optional(),
    reportedToDolBy: z.string().optional().nullable(),
    reportedToDolRef: z.string().optional().nullable(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    // Scope: admin, or owning contractor of the incident.
    const existing = await db.ohsIncident.findUnique({ where: { id: input.incidentId }, select: { contractorId: true, reportedToDol: true, reportedById: true } });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
    if (!isAdmin(user)) {
      const ownsAsContractor = isContractorRoleStr(user.role) && existing.contractorId === user.id;
      if (!ownsAsContractor) throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised for this incident." });
    }
    // Only set reportedToDolAt on transition false -> true.
    const transitioningToReported = input.reportedToDol === true && existing.reportedToDol !== true;
    const updated = await db.ohsIncident.update({
      where: { id: input.incidentId },
      data: {
        status: input.status,
        rootCause: input.rootCause ?? undefined,
        investigationNotes: input.investigationNotes ?? undefined,
        reportedToDol: input.reportedToDol ?? undefined,
        reportedToDolAt: transitioningToReported ? new Date() : undefined,
        reportedToDolBy: input.reportedToDolBy ?? undefined,
        reportedToDolRef: input.reportedToDolRef ?? undefined,
      },
    });
    // Notify the original reporter when status changes.
    if (input.status && existing.reportedById && existing.reportedById !== user.id) {
      const reporter = await db.user.findUnique({ where: { id: existing.reportedById }, select: { id: true, role: true } });
      if (reporter) {
        await createNotification({
          recipientId: reporter.id,
          recipientRole: reporter.role,
          message: `OHS incident ${updated.reference} status updated: ${input.status.replace(/_/g, " ").toLowerCase()}.`,
          type: "OHS_INCIDENT_UPDATED",
          relatedEntityId: updated.id,
          relatedEntityType: "OHS_INCIDENT",
        });
      }
    }
    return updated;
  });

export const ohsAddCorrectiveAction = baseProcedure
  .input(z.object({
    token: z.string(),
    incidentId: z.number(),
    description: z.string().min(2),
    responsibleId: z.number(),
    dueDate: z.string(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const ca = await db.ohsCorrectiveAction.create({
      data: {
        incidentId: input.incidentId,
        description: input.description,
        responsibleId: input.responsibleId,
        dueDate: new Date(input.dueDate),
      },
    });
    const responsible = await db.user.findUnique({ where: { id: input.responsibleId }, select: { id: true, role: true } });
    if (responsible) {
      await createNotification({
        recipientId: responsible.id,
        recipientRole: responsible.role,
        message: `Corrective action assigned: ${input.description.slice(0, 80)} (due ${input.dueDate.slice(0, 10)}).`,
        type: "OHS_CORRECTIVE_ACTION_ASSIGNED",
        relatedEntityId: ca.id,
        relatedEntityType: "OHS_CORRECTIVE_ACTION",
      });
    }
    return ca;
  });

export const ohsUpdateCorrectiveAction = baseProcedure
  .input(z.object({
    token: z.string(),
    correctiveActionId: z.number(),
    status: z.enum(["OPEN", "IN_PROGRESS", "COMPLETED", "VERIFIED", "OVERDUE"]).optional(),
    evidenceUrl: z.string().optional().nullable(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const ca = await db.ohsCorrectiveAction.findUnique({ where: { id: input.correctiveActionId } });
    if (!ca) throw new TRPCError({ code: "NOT_FOUND", message: "Corrective action not found" });
    // Responsible user can update status; admins can verify.
    const isResponsible = ca.responsibleId === user.id;
    if (!isResponsible && !isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised." });
    const data: any = {};
    if (input.status) {
      data.status = input.status;
      if (input.status === "COMPLETED" && !ca.completedAt) data.completedAt = new Date();
      if (input.status === "VERIFIED") {
        if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can verify." });
        data.verifiedById = user.id;
        data.verifiedAt = new Date();
      }
    }
    if (input.evidenceUrl !== undefined) data.evidenceUrl = input.evidenceUrl;
    return db.ohsCorrectiveAction.update({ where: { id: input.correctiveActionId }, data });
  });

export const ohsListCorrectiveActions = baseProcedure
  .input(z.object({ token: z.string(), incidentId: z.number().optional(), mineOnly: z.boolean().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const where: any = {};
    if (input.incidentId) where.incidentId = input.incidentId;
    if (input.mineOnly) where.responsibleId = user.id;
    return db.ohsCorrectiveAction.findMany({
      where,
      include: {
        responsible: { select: { firstName: true, lastName: true, email: true, role: true } },
        verifiedBy: { select: { firstName: true, lastName: true } },
        incident: { select: { id: true, reference: true, severity: true } },
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }],
      take: 200,
    });
  });

export const ohsExportIncidentPdf = baseProcedure
  .input(z.object({ token: z.string(), incidentId: z.number() }))
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);
    const inc = await db.ohsIncident.findUnique({
      where: { id: input.incidentId },
      include: {
        reportedBy: { select: { firstName: true, lastName: true } },
        correctiveActions: { include: { responsible: { select: { firstName: true, lastName: true } } } },
      },
    });
    if (!inc) throw new TRPCError({ code: "NOT_FOUND", message: "Incident not found" });
    const company = await companyHeader();
    const buffer = await buildIncidentPdf({
      reference: inc.reference,
      type: inc.type,
      severity: inc.severity,
      status: inc.status,
      occurredAt: inc.occurredAt,
      reportedAt: inc.reportedAt,
      location: inc.location,
      description: inc.description,
      immediateActions: inc.immediateActions,
      injuredPersonName: inc.injuredPersonName,
      injuredPersonRole: inc.injuredPersonRole,
      witnesses: inc.witnesses,
      rootCause: inc.rootCause,
      investigationNotes: inc.investigationNotes,
      reportedToDol: inc.reportedToDol,
      reportedToDolAt: inc.reportedToDolAt,
      aiInsights: inc.aiInsights,
      reporterName: inc.reportedBy ? `${inc.reportedBy.firstName} ${inc.reportedBy.lastName}` : undefined,
      correctiveActions: inc.correctiveActions.map((ca) => ({
        description: ca.description,
        responsibleName: ca.responsible ? `${ca.responsible.firstName} ${ca.responsible.lastName}` : undefined,
        dueDate: ca.dueDate,
        status: ca.status,
      })),
      company,
    });
    return { pdf: buffer.toString("base64"), filename: `${inc.reference}.pdf` };
  });

// ===========================================================================
// Toolbox Talks
// ===========================================================================
export const ohsCreateToolboxTalk = baseProcedure
  .input(z.object({
    token: z.string(),
    title: z.string().min(2),
    topic: z.string().min(2),
    content: z.string().min(10),
    targetRoles: z.array(z.string()).default([]),
    targetUserIds: z.array(z.number()).default([]),
    projectId: z.number().optional().nullable(),
    orderId: z.number().optional().nullable(),
    ackDeadline: z.string().optional().nullable(),
    publish: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const tb = await withRefRetry("OHS-TBT", "toolbox", (reference) => db.ohsToolboxTalk.create({
      data: {
        reference,
        title: input.title,
        topic: input.topic,
        content: input.content,
        targetRoles: input.targetRoles,
        targetUserIds: input.targetUserIds,
        projectId: input.projectId ?? null,
        orderId: input.orderId ?? null,
        contractorId: isContractorRoleStr(user.role) ? user.id : null,
        createdById: user.id,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        publishedAt: input.publish ? new Date() : null,
        ackDeadline: input.ackDeadline ? new Date(input.ackDeadline) : null,
      },
    }));

    if (input.publish) {
      const recipientIds = new Set<number>();
      const recipients: Array<{ id: number; role: string }> = [];
      if (input.targetRoles.length > 0) {
        const byRole = await db.user.findMany({
          where: { role: { in: input.targetRoles } },
          select: { id: true, role: true },
        });
        for (const u of byRole) {
          if (!recipientIds.has(u.id)) { recipientIds.add(u.id); recipients.push(u); }
        }
      }
      if (input.targetUserIds.length > 0) {
        const byId = await db.user.findMany({
          where: { id: { in: input.targetUserIds } },
          select: { id: true, role: true },
        });
        for (const u of byId) {
          if (!recipientIds.has(u.id)) { recipientIds.add(u.id); recipients.push(u); }
        }
      }
      for (const u of recipients) {
        await createNotification({
          recipientId: u.id,
          recipientRole: u.role,
          message: `New toolbox talk: ${tb.title}. Please read and sign${input.ackDeadline ? ` by ${input.ackDeadline.slice(0, 10)}` : ""}.`,
          type: "OHS_TOOLBOX_TALK_PUBLISHED",
          relatedEntityId: tb.id,
          relatedEntityType: "OHS_TOOLBOX_TALK",
        });
      }
    }
    return tb;
  });

export const ohsListToolboxTalks = baseProcedure
  .input(z.object({ token: z.string(), forMe: z.boolean().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const where: any = {};
    if (input.forMe) {
      where.status = "PUBLISHED";
      where.OR = [
        { targetRoles: { has: user.role } },
        { targetRoles: { isEmpty: true }, targetUserIds: { isEmpty: true } },
        { targetUserIds: { has: user.id } },
      ];
    } else if (!isAdmin(user)) {
      // Non-admin (and not forMe filter): contractors see their own + admin-published.
      if (isContractorRoleStr(user.role)) {
        where.OR = [{ contractorId: user.id }, { contractorId: null }];
      } else {
        // Other roles only see what targets them.
        where.status = "PUBLISHED";
        where.OR = [
          { targetRoles: { has: user.role } },
          { targetUserIds: { has: user.id } },
        ];
      }
    }
    const talks = await db.ohsToolboxTalk.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        acks: { where: { userId: user.id }, select: { id: true, ackedAt: true } },
        _count: { select: { acks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return talks.map((t) => ({
      ...t,
      myAck: t.acks[0] || null,
      ackCount: t._count.acks,
    }));
  });

export const ohsAcknowledgeToolboxTalk = baseProcedure
  .input(z.object({ token: z.string(), toolboxTalkId: z.number(), signatureText: z.string().optional(), signatureImage: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!input.signatureImage && !input.signatureText) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A signature (drawn or typed) is required to acknowledge." });
    }
    return db.ohsAcknowledgement.upsert({
      where: { userId_toolboxTalkId: { userId: user.id, toolboxTalkId: input.toolboxTalkId } },
      update: { ackedAt: new Date(), signatureText: input.signatureText ?? null, signatureImage: input.signatureImage ?? null },
      create: { userId: user.id, toolboxTalkId: input.toolboxTalkId, signatureText: input.signatureText ?? null, signatureImage: input.signatureImage ?? null },
    });
  });

export const ohsExportToolboxTalkPdf = baseProcedure
  .input(z.object({ token: z.string(), toolboxTalkId: z.number() }))
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);
    const tb = await db.ohsToolboxTalk.findUnique({
      where: { id: input.toolboxTalkId },
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        acks: {
          include: { user: { select: { firstName: true, lastName: true, email: true, role: true } } },
          orderBy: { ackedAt: "asc" },
        },
      },
    });
    if (!tb) throw new TRPCError({ code: "NOT_FOUND", message: "Toolbox talk not found" });
    const company = await companyHeader();
    const buffer = await buildToolboxTalkPdf({
      reference: tb.reference,
      title: tb.title,
      topic: tb.topic,
      content: tb.content,
      publishedAt: tb.publishedAt,
      ackDeadline: tb.ackDeadline,
      createdByName: tb.createdBy ? `${tb.createdBy.firstName} ${tb.createdBy.lastName}` : undefined,
      company,
      attendance: tb.acks.map((a) => ({
        name: `${a.user.firstName} ${a.user.lastName}`,
        role: a.user.role,
        email: a.user.email,
        ackedAt: a.ackedAt,
        signatureImage: a.signatureImage,
        signatureText: a.signatureText,
      })),
    });
    return { pdf: buffer.toString("base64"), filename: `${tb.reference || "toolbox-talk"}.pdf` };
  });

// ===========================================================================
// Documents (policies, procedures, SOPs)
// ===========================================================================
export const ohsCreateDocument = baseProcedure
  .input(z.object({
    token: z.string(),
    type: z.enum(["POLICY", "PROCEDURE", "SAFE_WORK_METHOD", "RISK_ASSESSMENT", "EMERGENCY_PLAN", "TOOLBOX_TALK", "CHECKLIST", "MSDS", "PERMIT", "TRAINING_MATERIAL", "LEGAL_APPOINTMENT", "OTHER"]),
    title: z.string().min(2),
    reference: z.string().optional().nullable(),
    version: z.string().default("1.0"),
    effectiveDate: z.string().optional().nullable(),
    reviewDate: z.string().optional().nullable(),
    content: z.string().min(2),
    sourcePdfUrl: z.string().optional().nullable(),
    tags: z.array(z.string()).default([]),
    requiresAck: z.boolean().optional(),
    publish: z.boolean().optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const ref = input.reference || (await nextRef("OHS-DOC", "doc"));
    const d = await db.ohsDocument.create({
      data: {
        type: input.type,
        title: input.title,
        reference: ref,
        version: input.version,
        effectiveDate: input.effectiveDate ? new Date(input.effectiveDate) : null,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : null,
        status: input.publish ? "PUBLISHED" : "DRAFT",
        content: input.content,
        sourcePdfUrl: input.sourcePdfUrl ?? null,
        tags: input.tags,
        requiresAck: !!input.requiresAck,
        createdById: user.id,
        contractorId: isContractorRoleStr(user.role) ? user.id : null,
      },
    });
    return d;
  });

export const ohsListDocuments = baseProcedure
  .input(z.object({
    token: z.string(),
    type: z.enum(["POLICY", "PROCEDURE", "SAFE_WORK_METHOD", "RISK_ASSESSMENT", "EMERGENCY_PLAN", "TOOLBOX_TALK", "CHECKLIST", "MSDS", "PERMIT", "TRAINING_MATERIAL", "LEGAL_APPOINTMENT", "OTHER"]).optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const where: any = {};
    if (input.type) where.type = input.type;
    if (input.status) where.status = input.status;
    if (!isAdmin(user)) {
      where.status = "PUBLISHED";
      // Contractors see their own + admin-authored. Other roles see only admin-authored.
      if (isContractorRoleStr(user.role)) {
        where.OR = [{ contractorId: user.id }, { contractorId: null }];
      } else {
        where.contractorId = null;
      }
    }
    return db.ohsDocument.findMany({
      where,
      include: {
        createdBy: { select: { firstName: true, lastName: true } },
        acks: { where: { userId: user.id }, select: { id: true, ackedAt: true } },
        _count: { select: { acks: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

export const ohsUpdateDocument = baseProcedure
  .input(z.object({
    token: z.string(),
    documentId: z.number(),
    title: z.string().optional(),
    content: z.string().optional(),
    version: z.string().optional(),
    status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
    reviewDate: z.string().optional().nullable(),
    requiresAck: z.boolean().optional(),
    tags: z.array(z.string()).optional(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    return db.ohsDocument.update({
      where: { id: input.documentId },
      data: {
        title: input.title,
        content: input.content,
        version: input.version,
        status: input.status,
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : undefined,
        requiresAck: input.requiresAck,
        tags: input.tags,
      },
    });
  });

export const ohsDeleteDocument = baseProcedure
  .input(z.object({ token: z.string(), documentId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can delete." });
    await db.ohsDocument.delete({ where: { id: input.documentId } });
    return { success: true };
  });

export const ohsAcknowledgeDocument = baseProcedure
  .input(z.object({ token: z.string(), documentId: z.number(), signatureText: z.string().optional(), signatureImage: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!input.signatureImage && !input.signatureText) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "A signature (drawn or typed) is required to acknowledge." });
    }
    return db.ohsAcknowledgement.upsert({
      where: { userId_documentId: { userId: user.id, documentId: input.documentId } },
      update: { ackedAt: new Date(), signatureText: input.signatureText ?? null, signatureImage: input.signatureImage ?? null },
      create: { userId: user.id, documentId: input.documentId, signatureText: input.signatureText ?? null, signatureImage: input.signatureImage ?? null },
    });
  });

export const ohsExportDocumentPdf = baseProcedure
  .input(z.object({ token: z.string(), documentId: z.number() }))
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);
    const d = await db.ohsDocument.findUnique({
      where: { id: input.documentId },
      include: { createdBy: { select: { firstName: true, lastName: true } } },
    });
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
    const company = await companyHeader();
    const buffer = await buildOhsDocumentPdf({
      type: d.type,
      reference: d.reference,
      title: d.title,
      version: d.version,
      effectiveDate: d.effectiveDate,
      reviewDate: d.reviewDate,
      content: d.content,
      createdByName: d.createdBy ? `${d.createdBy.firstName} ${d.createdBy.lastName}` : undefined,
      company,
    });
    return { pdf: buffer.toString("base64"), filename: `${d.reference || "ohs-document"}.pdf` };
  });

// ===========================================================================
// Training records
// ===========================================================================
export const ohsListTraining = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const targetUserId = input.userId && isAdmin(user) ? input.userId : user.id;
    return db.ohsTrainingRecord.findMany({
      where: isAdmin(user) && !input.userId ? {} : { userId: targetUserId },
      include: { user: { select: { firstName: true, lastName: true, role: true, email: true } } },
      orderBy: { expiresAt: "asc" },
      take: 500,
    });
  });

export const ohsUpsertTraining = baseProcedure
  .input(z.object({
    token: z.string(),
    id: z.number().optional(),
    userId: z.number(),
    course: z.string().min(2),
    provider: z.string().optional().nullable(),
    competency: z.string().optional().nullable(),
    status: z.enum(["REQUIRED", "SCHEDULED", "COMPLETED", "EXPIRED"]),
    completedAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    certificateUrl: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
  }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const data = {
      userId: input.userId,
      course: input.course,
      provider: input.provider ?? null,
      competency: input.competency ?? null,
      status: input.status,
      completedAt: input.completedAt ? new Date(input.completedAt) : null,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      certificateUrl: input.certificateUrl ?? null,
      notes: input.notes ?? null,
    };
    if (input.id) {
      return db.ohsTrainingRecord.update({ where: { id: input.id }, data });
    }
    return db.ohsTrainingRecord.create({ data });
  });

// ===========================================================================
// Dashboard counts
// ===========================================================================
export const ohsDashboard = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const isMgr = isAdmin(user) || ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"].includes(user.role);
    if (!isMgr) {
      // worker view
      const [openCorrective, myAcks, myTraining] = await Promise.all([
        db.ohsCorrectiveAction.count({ where: { responsibleId: user.id, status: { in: ["OPEN", "IN_PROGRESS"] } } }),
        db.ohsToolboxTalk.count({ where: { status: "PUBLISHED", OR: [{ targetRoles: { has: user.role } }, { targetRoles: { isEmpty: true } }], acks: { none: { userId: user.id } } } }),
        db.ohsTrainingRecord.count({ where: { userId: user.id, status: { in: ["REQUIRED", "SCHEDULED"] } } }),
      ]);
      return { mode: "worker" as const, openCorrective, pendingAcks: myAcks, trainingRequired: myTraining };
    }

    const contractorScope = isContractorRoleStr(user.role) && !isAdmin(user) ? { contractorId: user.id } : {};
    const [ras, openIncidents, criticalIncidents, openCorrective, expiringTraining, recentIncidents, riskHigh] = await Promise.all([
      db.ohsRiskAssessment.count({ where: { status: "PUBLISHED", ...contractorScope } }),
      db.ohsIncident.count({ where: { status: { in: ["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTION"] }, ...contractorScope } }),
      db.ohsIncident.count({ where: { severity: { in: ["CRITICAL", "HIGH"] }, status: { not: "CLOSED" }, ...contractorScope } }),
      db.ohsCorrectiveAction.count({ where: { status: { in: ["OPEN", "IN_PROGRESS"] }, ...(isAdmin(user) ? {} : { incident: contractorScope }) } }),
      db.ohsTrainingRecord.count({ where: { status: { in: ["REQUIRED", "SCHEDULED"] }, OR: [{ expiresAt: { lte: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) } }, { expiresAt: null }] } }),
      db.ohsIncident.findMany({ where: contractorScope, orderBy: { occurredAt: "desc" }, take: 5, select: { id: true, reference: true, type: true, severity: true, status: true, occurredAt: true, location: true } }),
      db.ohsRiskAssessment.count({ where: { overallRisk: { in: ["HIGH", "CRITICAL"] }, status: "PUBLISHED", ...contractorScope } }),
    ]);
    return {
      mode: "manager" as const,
      publishedRiskAssessments: ras,
      openIncidents,
      criticalOpenIncidents: criticalIncidents,
      openCorrectiveActions: openCorrective,
      trainingDue: expiringTraining,
      highRiskAssessments: riskHigh,
      recentIncidents,
    };
  });

// ===========================================================================
// Acknowledgement-by-name lists (compliance evidence)
// ===========================================================================
export const ohsListToolboxAcks = baseProcedure
  .input(z.object({ token: z.string(), toolboxTalkId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const tb = await db.ohsToolboxTalk.findUnique({
      where: { id: input.toolboxTalkId },
      select: { id: true, contractorId: true, targetRoles: true, targetUserIds: true },
    });
    if (!tb) throw new TRPCError({ code: "NOT_FOUND", message: "Toolbox talk not found" });
    if (!isAdmin(user) && tb.contractorId && tb.contractorId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised." });
    }
    const candidateWhere: any = [];
    if (tb.targetRoles.length > 0) candidateWhere.push({ role: { in: tb.targetRoles } });
    if (tb.targetUserIds.length > 0) candidateWhere.push({ id: { in: tb.targetUserIds } });
    const [acks, candidates] = await Promise.all([
      db.ohsAcknowledgement.findMany({
        where: { toolboxTalkId: input.toolboxTalkId },
        include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
        orderBy: { ackedAt: "desc" },
      }),
      candidateWhere.length > 0
        ? db.user.findMany({
            where: { OR: candidateWhere },
            select: { id: true, firstName: true, lastName: true, email: true, role: true },
          })
        : Promise.resolve([] as Array<{ id: number; firstName: string; lastName: string; email: string; role: string }>),
    ]);
    const ackedIds = new Set(acks.map((a) => a.userId));
    const pending = candidates.filter((c) => !ackedIds.has(c.id));
    return { acks, pending };
  });

export const ohsListDocumentAcks = baseProcedure
  .input(z.object({ token: z.string(), documentId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const d = await db.ohsDocument.findUnique({ where: { id: input.documentId }, select: { id: true, contractorId: true } });
    if (!d) throw new TRPCError({ code: "NOT_FOUND", message: "Document not found" });
    if (!isAdmin(user) && d.contractorId && d.contractorId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorised." });
    }
    const acks = await db.ohsAcknowledgement.findMany({
      where: { documentId: input.documentId },
      include: { user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } } },
      orderBy: { ackedAt: "desc" },
    });
    return acks;
  });

// ===========================================================================
// Lookup helper for assigning corrective actions / training
// ===========================================================================
export const ohsListAssignableUsers = baseProcedure
  .input(z.object({ token: z.string(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertOhsManager(user);
    const where: any = {};
    if (input.search) {
      where.OR = [
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
      ];
    }
    return db.user.findMany({
      where,
      select: { id: true, firstName: true, lastName: true, email: true, role: true },
      orderBy: [{ firstName: "asc" }],
      take: 50,
    });
  });
