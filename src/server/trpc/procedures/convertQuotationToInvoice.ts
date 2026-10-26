import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { notifyArtisanOrderAssigned } from "~/server/utils/notifications";
import { getNextInvoiceNumber, getNextOrderNumber } from "~/server/utils/documentNumbers";
import { writeAuditLog } from "~/server/utils/auditLog";
import { logTmAssignment, type TmAssignmentSource } from "~/server/utils/tmAssignmentLog";

export const convertQuotationToInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      createOrder: z.boolean().default(false), // Also create an order (job card)
      assignedToId: z.number().optional(), // Artisan to assign order to
      technicalManagerId: z.number().optional(), // PR-8: explicit TM assignment for the auto-created order
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      // When set, and an invoice already exists for this quotation, refresh
      // that existing invoice with the latest quotation data instead of
      // rejecting the request. Lets users edit an approved quote and push
      // the changes into the previously-created invoice.
      updateExisting: z.boolean().default(false),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Only admins and contractors can convert
    if (!["JUNIOR_ADMIN", "SENIOR_ADMIN", "TECHNICAL_MANAGER", "MANAGER", "CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to convert quotations.",
      });
    }

    // Get quotation
    const quotation = await db.quotation.findUnique({
      where: { id: input.quotationId },
      include: { lead: true, project: true },
    });

    if (!quotation) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Quotation not found" });
    }

    if (quotation.status !== "APPROVED_BY_CUSTOMER" && quotation.status !== "APPROVED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only approved quotations can be converted to invoices.",
      });
    }

    // Check if already converted. If so, either refresh the existing invoice
    // (when the caller explicitly opted in) or return a CONFLICT so the UI can
    // prompt the user to confirm the update.
    const existingInvoice = await db.invoice.findUnique({
      where: { quotationId: quotation.id },
    });
    if (existingInvoice && !input.updateExisting) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Quotation already converted to invoice ${existingInvoice.invoiceNumber}. Confirm update to sync the latest quotation into that invoice.`,
      });
    }

    // Guardrail: block invoice creation when Cost to Company on the quote is zero.
    // Quotations must include material + labour cost estimates so the invoice
    // reflects the true profit. Zero-cost invoices were repeatedly getting rejected.
    const quoteCostToCompany = (quotation.companyMaterialCost ?? 0) + (quotation.companyLabourCost ?? 0);
    if (quoteCostToCompany <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Cannot create invoice from quotation ${quotation.quoteNumber}: Cost to Company is R 0.00 ` +
          `(materials R${(quotation.companyMaterialCost ?? 0).toFixed(2)}, labour R${(quotation.companyLabourCost ?? 0).toFixed(2)}). ` +
          `Edit the quotation to record the actual material and labour costs before converting to an invoice.`,
      });
    }

    // ─── Update-existing branch ──────────────────────────────────────────
    if (existingInvoice && input.updateExisting) {
      // Guard: refuse to overwrite a PAID invoice — that would corrupt the ledger.
      if (existingInvoice.status === "PAID") {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: `Invoice ${existingInvoice.invoiceNumber} is already PAID and cannot be updated from the quotation.`,
        });
      }
      const updatedInvoice = await db.invoice.update({
        where: { id: existingInvoice.id },
        data: {
          customerName: quotation.customerName,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          address: quotation.address,
          customerVatNumber: quotation.customerVatNumber,
          items: quotation.items as any,
          subtotal: quotation.subtotal,
          discountPercent: (quotation as any).discountPercent ?? 0,
          discountAmount: (quotation as any).discountAmount ?? 0,
          tax: quotation.tax,
          total: quotation.total,
          companyMaterialCost: quotation.companyMaterialCost,
          companyLabourCost: quotation.companyLabourCost,
          estimatedProfit: quotation.estimatedProfit,
          depositRequestedPercent: (quotation as any).depositRequestedPercent ?? 0,
          depositRequestedAmount: (quotation as any).depositRequestedAmount ?? 0,
          depositDueDate: (quotation as any).depositDueDate ?? null,
          notes: input.notes || quotation.notes,
          projectDescription: quotation.projectDescription,
          ...(input.dueDate ? { dueDate: new Date(input.dueDate) } : {}),
          clientReferenceNumber: quotation.clientReferenceQuoteNumber,
          clientId: quotation.clientId,
          clientBuildingId: quotation.clientBuildingId,
        },
      });
      await writeAuditLog(db, {
        actor: user,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: updatedInvoice.id,
        after: {
          invoiceNumber: updatedInvoice.invoiceNumber,
          total: updatedInvoice.total,
        },
        description: `Refreshed invoice ${updatedInvoice.invoiceNumber} from updated quotation ${quotation.quoteNumber}`,
      });
      return {
        invoice: updatedInvoice,
        order: null,
        updated: true as const,
        message: `Invoice ${updatedInvoice.invoiceNumber} refreshed from quotation ${quotation.quoteNumber}`,
      };
    }

    const companyDetails = await getCompanyDetails();
    const prefix = companyDetails?.invoicePrefix || "INV";
    const invoiceNumber = await getNextInvoiceNumber(db, prefix);

    // Create the invoice from quotation data
    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        customerName: quotation.customerName,
        customerEmail: quotation.customerEmail,
        customerPhone: quotation.customerPhone,
        address: quotation.address,
        customerVatNumber: quotation.customerVatNumber,
        items: quotation.items as any,
        subtotal: quotation.subtotal,
        discountPercent: (quotation as any).discountPercent ?? 0,
        discountAmount: (quotation as any).discountAmount ?? 0,
        tax: quotation.tax,
        total: quotation.total,
        companyMaterialCost: quotation.companyMaterialCost,
        companyLabourCost: quotation.companyLabourCost,
        estimatedProfit: quotation.estimatedProfit,
        // Carry the deposit-request terms across from the quotation so the
        // resulting invoice preserves the up-front payment the client agreed to.
        depositRequestedPercent: (quotation as any).depositRequestedPercent ?? 0,
        depositRequestedAmount: (quotation as any).depositRequestedAmount ?? 0,
        depositDueDate: (quotation as any).depositDueDate ?? null,
        status: "DRAFT",
        dueDate: input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: input.notes || quotation.notes,
        projectDescription: quotation.projectDescription,
        createdById: user.id,
        quotationId: quotation.id,
        projectId: quotation.projectId,
        clientReferenceNumber: quotation.clientReferenceQuoteNumber,
        clientId: quotation.clientId,
        clientBuildingId: quotation.clientBuildingId,
      },
    });

    // Optionally create an order (job card) as well
    let order = null;
    if (input.createOrder) {
      const orderPrefix = companyDetails?.orderPrefix || "ORD";
      const orderNumber = await getNextOrderNumber(db, orderPrefix);

      // Get service type from lead or quotation description
      const serviceType = quotation.lead?.serviceType || quotation.projectDescription || "Service from Quotation";

      // Resolve final artisan assignment (input wins, fall back to the artisan already on the quotation)
      const resolvedAssignedToId = input.assignedToId ?? quotation.assignedToId ?? null;

      // PR-8: Resolve Technical Manager at conversion time so the auto-created
      // order carries a TM. Without this, the order would have
      // `technicalManagerId = null` and the TM statement query would silently
      // fall back to matching by `assignedToId` (the ARTISAN, not the TM),
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

      order = await db.order.create({
        data: {
          orderNumber,
          customerName: quotation.customerName,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          address: quotation.address,
          serviceType,
          description: quotation.projectDescription || `Job from quotation ${quotation.quoteNumber}`,
          status: resolvedAssignedToId ? "ASSIGNED" : "PENDING",
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
        },
      });

      // Link order to invoice
      await db.invoice.update({
        where: { id: invoice.id },
        data: { orderId: order.id },
      });

      // PR-8 — Log the initial TM assignment (fromTm=null, toTm=resolved).
      if (resolvedTechnicalManagerId && tmSource) {
        await logTmAssignment(db, {
          orderId: order.id,
          fromTmId: null,
          toTmId: resolvedTechnicalManagerId,
          source: tmSource,
          actorId: user.id,
          reason: `Auto-created from quotation ${quotation.quoteNumber} → invoice`,
        });
      }

      // PR-8 E — Auto-attach sales agent from stored defaults.
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
            reason: `Auto-created from quotation ${quotation.quoteNumber} → invoice`,
          });
        }
      } catch (saErr) {
        console.error("Failed to auto-resolve sales agent (quotation → invoice):", saErr);
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
            reason: `Auto-created from quotation ${quotation.quoteNumber} → invoice`,
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
            reason: `Auto-created from quotation ${quotation.quoteNumber} → invoice`,
          });
        }
      } catch (crewErr) {
        console.error("Failed to auto-resolve site-lead/ops-manager (quotation → invoice):", crewErr);
      }

      // Notify the assigned artisan ONLY when THIS action is what assigned
      // them — i.e. the caller explicitly passed `input.assignedToId`. If we
      // merely carried the artisan forward from `quotation.assignedToId`, they
      // were already notified at quotation-assignment time and should not be
      // pinged again just because a JA created the invoice.
      const isFreshAssignment =
        !!input.assignedToId && input.assignedToId !== user.id;
      if (isFreshAssignment && resolvedAssignedToId) {
        void notifyArtisanOrderAssigned({
          artisanId: resolvedAssignedToId,
          orderNumber: order.orderNumber,
          orderId: order.id,
          serviceType: order.serviceType || undefined,
          address: order.address || undefined,
        }).catch((notifyError) => {
          console.error("Failed to notify artisan about order assignment:", notifyError);
        });
      }
    }

    await writeAuditLog(db, {
      actor: user,
      action: "CONVERT",
      entityType: "Quotation",
      entityId: quotation.id,
      description: `Converted quotation ${quotation.quoteNumber} to invoice ${invoice.invoiceNumber}${order ? ` and order ${order.orderNumber}` : ""}`,
    });
    await writeAuditLog(db, {
      actor: user,
      action: "CREATE",
      entityType: "Invoice",
      entityId: invoice.id,
      after: {
        invoiceNumber: invoice.invoiceNumber,
        customerName: invoice.customerName,
        total: invoice.total,
        status: invoice.status,
      },
      description: `Created invoice ${invoice.invoiceNumber} from quotation ${quotation.quoteNumber}`,
    });
    if (order) {
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
    }

    return {
      invoice,
      order,
      message: order
        ? `Invoice ${invoice.invoiceNumber} and Order ${order.orderNumber} created from quotation ${quotation.quoteNumber}`
        : `Invoice ${invoice.invoiceNumber} created from quotation ${quotation.quoteNumber}`,
    };
  });
