import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { notifyAdmins, notifyArtisanOrderAssigned } from "~/server/utils/notifications";
import { sendOrderNotificationEmail } from "~/server/utils/email";
import { resolveClientId, resolveClientBuildingId } from "~/server/trpc/procedures/clients";
import { getNextOrderNumber } from "~/server/utils/documentNumbers";
import { writeAuditLog } from "~/server/utils/auditLog";
import { logTmAssignment, type TmAssignmentSource } from "~/server/utils/tmAssignmentLog";
import {
  resolveSalesAgentFromDefaults,
  logSalesAgentAssignment,
  type SalesAgentAssignmentSource,
} from "~/server/utils/salesAgentAssignmentLog";
import {
  resolveSiteLeadFromDefaults,
  logSiteLeadAssignment,
  resolveOpsManagerFromDefaults,
  logOpsManagerAssignment,
} from "~/server/utils/crewRoleAssignmentLog";

export const createOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderNumber: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().min(1).optional()
      ),
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(1),
      address: z.string().min(1),
      serviceType: z.string().min(1),
      description: z.string().min(1),
      assignedToId: z.number().optional(),
      technicalManagerId: z.number().optional(),
      leadId: z.number().optional(),
      callOutFee: z.number().default(0),
      labourRate: z.number().optional(),
      totalMaterialBudget: z.number().optional(),
      numLabourersNeeded: z.number().int().optional(),
      totalLabourCostBudget: z.number().optional(),
      documentUrls: z.array(z.string()).optional(),
      notes: z.string().optional(),
      materials: z.array(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
        supplier: z.string().optional(),
        supplierQuotationUrl: z.string().optional(),
        supplierQuotationAmount: z.number().optional(),
      })).optional(),
      // Reusable client linkage (auto-upsert if not provided)
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      companyName: z.string().optional(),
      customerVatNumber: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (
      user.role !== "CONTRACTOR" &&
      user.role !== "JUNIOR_ADMIN" &&
      user.role !== "SENIOR_ADMIN" &&
      user.role !== "TECHNICAL_MANAGER" &&
      user.role !== "MANAGER"
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to create orders.",
      });
    }

    const companyDetails = await getCompanyDetails();

    // Use user-provided orderNumber or auto-generate one with retry loop
    // to permanently avoid unique constraint violations
    let orderNumber: string;

    if (input.orderNumber) {
      // User provided a custom order number - check uniqueness
      const existing = await db.order.findUnique({ where: { orderNumber: input.orderNumber } });
      if (existing) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Order number "${input.orderNumber}" is already in use.`,
        });
      }
      orderNumber = input.orderNumber;
    } else {
      // Auto-generate using shared helper (skips poisoned suffixes)
      orderNumber = await getNextOrderNumber(db, companyDetails.orderPrefix);
    }

    // Determine assignment and status based on role and input
    let assignedToId = input.assignedToId || null;
    let status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' = 'PENDING';

    if (user.role === 'CONTRACTOR') {
      // If contractor provided an assignedToId (e.g., artisan), use it
      // Otherwise assign to themselves
      if (input.assignedToId) {
        assignedToId = input.assignedToId;
        status = 'ASSIGNED'; // Assigned to artisan
      } else {
        assignedToId = user.id;
        status = 'IN_PROGRESS'; // Contractor doing it themselves
      }
    } else {
      // Admin users
      if (input.assignedToId) {
        status = 'ASSIGNED';
      }
    }

    // TM responsibility — required for admin-created orders so commission is attributed correctly.
    // Fallback: use the assignee's default TM when no explicit selection is provided.
    const isAdminCreator =
      user.role === "JUNIOR_ADMIN" ||
      user.role === "SENIOR_ADMIN" ||
      user.role === "MANAGER" ||
      user.role === "TECHNICAL_MANAGER";

    let resolvedTechnicalManagerId: number | null = input.technicalManagerId ?? null;
    let tmSource: TmAssignmentSource | null = input.technicalManagerId ? "EXPLICIT_INPUT" : null;
    if (!resolvedTechnicalManagerId && assignedToId) {
      const assignee = await db.user.findUnique({
        where: { id: assignedToId },
        select: { defaultTechnicalManagerId: true },
      });
      if (assignee?.defaultTechnicalManagerId) {
        resolvedTechnicalManagerId = assignee.defaultTechnicalManagerId;
        tmSource = "ASSIGNEE_DEFAULT_TM";
      }
    }
    if (isAdminCreator && !resolvedTechnicalManagerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Responsible Technical Manager is required. Please select the TM responsible for this job.",
      });
    }

    // Resolve / auto-upsert client + building so the customer info is
    // saved on first input and reused on later orders/invoices.
    const resolvedClientId = await resolveClientId(db, user.id, {
      existingClientId: input.clientId ?? null,
      customerName: input.customerName,
      companyName: input.companyName ?? null,
      customerEmail: input.customerEmail,
      customerPhone: input.customerPhone,
      address: input.address,
      customerVatNumber: input.customerVatNumber ?? null,
    });
    const resolvedBuildingId = await resolveClientBuildingId(db, {
      existingClientBuildingId: input.clientBuildingId ?? null,
      clientId: resolvedClientId,
      address: input.address,
      // PR-8J — pass the site/building name so distinct sites sharing a
      // head-office accounting address get their own ClientBuilding row
      // (and therefore appear in the artisan dropdown).
      buildingName: input.customerName,
    });

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        address: input.address,
        serviceType: input.serviceType,
        description: input.description,
        assignedToId,
        technicalManagerId: resolvedTechnicalManagerId,
        status,
        leadId: input.leadId || null,
        clientId: resolvedClientId,
        clientBuildingId: resolvedBuildingId,
        callOutFee: input.callOutFee || 0,
        labourRate: input.labourRate || null,
        totalMaterialBudget: input.totalMaterialBudget || null,
        numLabourersNeeded: input.numLabourersNeeded || null,
        totalLabourCostBudget: input.totalLabourCostBudget || null,
        documents: input.documentUrls || [],
        notes: input.notes || null,
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // PR-8 — Log the initial TM assignment (fromTm=null, toTm=resolved).
    if (resolvedTechnicalManagerId && tmSource) {
      await logTmAssignment(db, {
        orderId: order.id,
        fromTmId: null,
        toTmId: resolvedTechnicalManagerId,
        source: tmSource,
        actorId: user.id,
        reason: `New order ${order.orderNumber}`,
      });
    }

    // PR-8 E — Auto-attach a sales agent from stored client/building defaults
    // when the order has no explicit sales-agent yet. The admin picker
    // (adminSetOrderSalesAgent) can still override this later.
    try {
      const resolvedSa = await resolveSalesAgentFromDefaults({
        clientBuildingId: resolvedBuildingId,
        clientId: resolvedClientId,
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
          source: resolvedSa.source as SalesAgentAssignmentSource,
          actorId: user.id,
          reason: `New order ${order.orderNumber}`,
        });
      }
    } catch (saErr) {
      console.error("Failed to auto-resolve sales agent for new order:", saErr);
    }

    // PR-8 F — Auto-attach Site Lead + Ops Manager from stored defaults.
    try {
      const resolvedSl = await resolveSiteLeadFromDefaults({
        initiatorId: user.id,
        assigneeId: assignedToId,
        clientBuildingId: resolvedBuildingId,
        clientId: resolvedClientId,
      });
      if (resolvedSl.siteLeadId && resolvedSl.source) {
        await db.order.update({
          where: { id: order.id },
          data: { siteLeadId: resolvedSl.siteLeadId },
        });
        await logSiteLeadAssignment(db, {
          orderId: order.id,
          fromSiteLeadId: null,
          toSiteLeadId: resolvedSl.siteLeadId,
          source: resolvedSl.source,
          actorId: user.id,
          reason: `New order ${order.orderNumber}`,
        });
      }
    } catch (slErr) {
      console.error("Failed to auto-resolve site lead for new order:", slErr);
    }
    try {
      const resolvedOm = await resolveOpsManagerFromDefaults({
        initiatorId: user.id,
        assigneeId: assignedToId,
        clientBuildingId: resolvedBuildingId,
        clientId: resolvedClientId,
      });
      if (resolvedOm.opsManagerId && resolvedOm.source) {
        await db.order.update({
          where: { id: order.id },
          data: { opsManagerId: resolvedOm.opsManagerId },
        });
        await logOpsManagerAssignment(db, {
          orderId: order.id,
          fromOpsManagerId: null,
          toOpsManagerId: resolvedOm.opsManagerId,
          source: resolvedOm.source,
          actorId: user.id,
          reason: `New order ${order.orderNumber}`,
        });
      }
    } catch (omErr) {
      console.error("Failed to auto-resolve ops manager for new order:", omErr);
    }

    // Send email notification to customer (best effort, non-blocking)
    void sendOrderNotificationEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderDescription: order.description,
      serviceType: order.serviceType || undefined,
      address: order.address || undefined,
      assignedToName: order.assignedTo ? `${order.assignedTo.firstName} ${order.assignedTo.lastName}` : undefined,
      userId: user.id, // Send from the user who created the order
    })
      .then(() => {
        console.log(`Order notification email sent to ${order.customerEmail}`);
      })
      .catch((emailError) => {
        console.error("Failed to send order notification email:", emailError);
      });

    // Notify the assigned artisan about the new order
    if (assignedToId && assignedToId !== user.id) {
      void notifyArtisanOrderAssigned({
        artisanId: assignedToId,
        orderNumber: order.orderNumber,
        orderId: order.id,
        serviceType: order.serviceType || undefined,
        address: order.address || undefined,
      }).catch((notifyError) => {
        console.error("Failed to notify artisan about order assignment:", notifyError);
      });
    }

    // Only notify admins if an admin created the order without assigning it.
    if (
      (user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN" || user.role === "TECHNICAL_MANAGER" || user.role === "MANAGER") &&
      !input.assignedToId
    ) {
      const loc = order.address
        ? (order.address
            .split(/\s*[,\n\r]|\s+C\/O\s|\s+Cor\.?\s|\s+Corner\s|\s+Street|\s+Str\b|\s+Road|\s+Rd\b|\s+Ave\b/i)[0] ?? "")
            .replace(/\s*\(Pty\)\s*Ltd\.?/i, "")
            .trim()
            .slice(0, 40)
        : "";
      const jobInfo = order.serviceType
        ? ` – ${order.serviceType}${loc ? ` at ${loc}` : ""}`
        : "";
      // Best effort, non-blocking
      void notifyAdmins({
        message: `New order ${order.orderNumber}${jobInfo} created by ${user.firstName} ${user.lastName}`,
        type: "PM_ORDER_SUBMITTED",
        relatedEntityId: order.id,
        relatedEntityType: "ORDER",
      }).catch((notifyError) => {
        console.error("Failed to notify admins about new order:", notifyError);
      });
    }

    await writeAuditLog(db, {
      actor: user,
      action: "CREATE",
      entityType: "Order",
      entityId: order.id,
      after: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        serviceType: order.serviceType,
        status: order.status,
      },
      description: `Created order ${order.orderNumber} for ${order.customerName}`,
    });

    return order;
  });
