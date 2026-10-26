import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getNextOrderNumber } from "~/server/utils/documentNumbers";
import { writeAuditLog } from "~/server/utils/auditLog";
import { logTmAssignment, type TmAssignmentSource } from "~/server/utils/tmAssignmentLog";

export const convertQuotationToOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      assignedToId: z.number().optional(),
      technicalManagerId: z.number().optional(),
      notes: z.string().optional(),
      slaHours: z.number().int().positive().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!["JUNIOR_ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER", "CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to convert quotations to orders.",
      });
    }

    const quotation = await db.quotation.findUnique({
      where: { id: input.quotationId },
      include: { lead: true },
    });

    if (!quotation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
    }

    if (quotation.status !== "APPROVED_BY_CUSTOMER" && quotation.status !== "APPROVED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only approved quotations can be converted to orders.",
      });
    }

    // Check if already converted
    const existingOrder = await db.order.findUnique({
      where: { quotationId: quotation.id },
    });
    if (existingOrder) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Quotation already converted to order ${existingOrder.orderNumber}`,
      });
    }

    const companyDetails = await getCompanyDetails();
    const orderPrefix = companyDetails?.orderPrefix || "ORD";
    const orderNumber = await getNextOrderNumber(db, orderPrefix);

    const serviceType = quotation.lead?.serviceType || quotation.projectDescription || "Service from Quotation";

    const resolvedAssignedToId = input.assignedToId ?? quotation.assignedToId ?? null;
    const willAssign = !!resolvedAssignedToId;
    const slaStartedAt = willAssign && input.slaHours ? new Date() : null;
    const slaDueAt = slaStartedAt && input.slaHours ? new Date(slaStartedAt.getTime() + input.slaHours * 60 * 60 * 1000) : null;

    // PR-8: Resolve Technical Manager at conversion time. Without this, the order
    // would have `technicalManagerId = null` and the TM statement query would
    // silently fall back to matching by `assignedToId` (the ARTISAN, not the TM),
    // attributing the job to the wrong TM. Priority:
    //   1. Explicit input from admin UI
    //   2. defaultTechnicalManagerId of the artisan we're assigning to
    //   3. defaultTechnicalManagerId of the quotation's original assignee
    //   4. null (admin can fix via the "Unassigned TM" cleanup screen)
    let resolvedTechnicalManagerId: number | null = input.technicalManagerId ?? null;
    let tmSource: TmAssignmentSource | null = input.technicalManagerId ? "EXPLICIT_INPUT" : null;
    if (!resolvedTechnicalManagerId && resolvedAssignedToId) {
      const assignee = await db.user.findUnique({
        where: { id: resolvedAssignedToId },
        select: { defaultTechnicalManagerId: true },
      });
      if (assignee?.defaultTechnicalManagerId) {
        resolvedTechnicalManagerId = assignee.defaultTechnicalManagerId;
        tmSource = "ASSIGNEE_DEFAULT_TM";
      }
    }
    if (!resolvedTechnicalManagerId && quotation.assignedToId && quotation.assignedToId !== resolvedAssignedToId) {
      const quoteOwner = await db.user.findUnique({
        where: { id: quotation.assignedToId },
        select: { defaultTechnicalManagerId: true },
      });
      if (quoteOwner?.defaultTechnicalManagerId) {
        resolvedTechnicalManagerId = quoteOwner.defaultTechnicalManagerId;
        tmSource = "QUOTE_OWNER_DEFAULT_TM";
      }
    }

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: quotation.customerName,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone,
        address: quotation.address,
        serviceType,
        description: quotation.projectDescription || `Job from quotation ${quotation.quoteNumber}`,
        status: willAssign ? "ASSIGNED" : "PENDING",
        assignedToId: resolvedAssignedToId,
        technicalManagerId: resolvedTechnicalManagerId,
        leadId: quotation.leadId,
        quotationId: quotation.id,
        clientId: quotation.clientId,
        clientBuildingId: quotation.clientBuildingId,
        materialCost: quotation.companyMaterialCost,
        labourCost: quotation.companyLabourCost,
        totalCost: quotation.total,
        notes: input.notes || `Created from quotation ${quotation.quoteNumber}`,
        slaHours: input.slaHours ?? null,
        slaStartedAt,
        slaDueAt,
      },
    });

    await writeAuditLog(db, {
      actor: user,
      action: "CONVERT",
      entityType: "Quotation",
      entityId: quotation.id,
      description: `Converted quotation ${quotation.quoteNumber} to order ${order.orderNumber}`,
    });
    await writeAuditLog(db, {
      actor: user,
      action: "CREATE",
      entityType: "Order",
      entityId: order.id,
      after: {
        orderNumber: order.orderNumber,
        customerName: order.customerName,
        status: order.status,
      },
      description: `Created order ${order.orderNumber} from quotation ${quotation.quoteNumber}`,
    });

    // PR-8 — Log the initial TM assignment (fromTm=null, toTm=resolved).
    if (resolvedTechnicalManagerId && tmSource) {
      await logTmAssignment(db, {
        orderId: order.id,
        fromTmId: null,
        toTmId: resolvedTechnicalManagerId,
        source: tmSource,
        actorId: user.id,
        reason: `Converted from quotation ${quotation.quoteNumber}`,
      });
    }

    // PR-8 E — Auto-attach sales agent from client/building defaults.
    try {
      const { resolveSalesAgentFromDefaults, logSalesAgentAssignment } = await import(
        "~/server/utils/salesAgentAssignmentLog"
      );
      const resolvedSa = await resolveSalesAgentFromDefaults({
        clientBuildingId: quotation.clientBuildingId,
        clientId: quotation.clientId,
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
          reason: `Converted from quotation ${quotation.quoteNumber}`,
        });
      }
    } catch (saErr) {
      console.error("Failed to auto-resolve sales agent on quotation conversion:", saErr);
    }

    // PR-8 F — Auto-attach Site Lead + Ops Manager from stored defaults.
    try {
      const {
        resolveSiteLeadFromDefaults,
        logSiteLeadAssignment,
        resolveOpsManagerFromDefaults,
        logOpsManagerAssignment,
      } = await import("~/server/utils/crewRoleAssignmentLog");

      const resolvedSl = await resolveSiteLeadFromDefaults({
        initiatorId: user.id,
        assigneeId: resolvedAssignedToId,
        clientBuildingId: quotation.clientBuildingId,
        clientId: quotation.clientId,
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
          reason: `Converted from quotation ${quotation.quoteNumber}`,
        });
      }

      const resolvedOm = await resolveOpsManagerFromDefaults({
        initiatorId: user.id,
        assigneeId: resolvedAssignedToId,
        clientBuildingId: quotation.clientBuildingId,
        clientId: quotation.clientId,
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
          reason: `Converted from quotation ${quotation.quoteNumber}`,
        });
      }
    } catch (crewErr) {
      console.error("Failed to auto-resolve site-lead/ops-manager on quotation conversion:", crewErr);
    }

    return {
      order,
      message: `Order ${order.orderNumber} created from quotation ${quotation.quoteNumber}`,
    };
  });
