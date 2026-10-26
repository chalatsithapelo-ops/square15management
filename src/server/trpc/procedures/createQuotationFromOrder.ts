// PR-QF — "Quote First" for self-initiated / no-PO jobs.
//
// Admin flow (Ready for Invoicing panel):
//   1. Artisan finishes a self-initiated job → order lands in
//      "Ready for Invoicing" with no client PO yet.
//   2. Admin clicks "Send Quote First" → this procedure creates a DRAFT
//      Quotation linked to the source Order (Order.quotationId).
//   3. Admin edits the quote on /admin/quotations, sends it to the client.
//   4. Client returns their PO number → admin invoices the order (either
//      via convertOrderToInvoice or the existing form) — because the order
//      is linked to the quote, invoice pre-population + traceability are
//      automatic.
//
// Traceability:
//   - Order.quotationId  → back-link to the generated quote (one-to-one)
//   - Quotation.notes    → "Generated from Order ORD-#### on <date>"
//   - Quotation.clientId + clientBuildingId → copied from source order
//   - Order.invoicingBlockers gains a { type: "QUOTE_SENT_AWAITING_CLIENT_PO",
//     quotationId, quoteNumber, since } entry so the order visibly waits
//     for a client PO before it can be turned into an invoice.
//   - AuditLog entries:
//        entityType="Order",     action="CONVERT"  ("QUOTE_CREATED_FROM_ORDER" desc)
//        entityType="Quotation", action="CREATE"   ("CREATED_FROM_ORDER"       desc)

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getNextQuoteNumber } from "~/server/utils/documentNumbers";
import { computeInvoiceTotals } from "~/utils/money";
import { writeAuditLog } from "~/server/utils/auditLog";

const QUOTE_CREATOR_ROLES = [
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
] as const;

type QuotationLineItem = {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
};

export const createQuotationFromOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      // Optional overrides — admin may want to tweak deposit/validity before
      // sending. If omitted we use sensible defaults.
      validUntilDays: z.number().min(1).max(365).optional(),
      depositRequestedPercent: z.number().min(0).max(100).optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!QUOTE_CREATOR_ROLES.includes(user.role as any)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to create quotations.",
      });
    }

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: {
        materials: true,
        jobActivities: true,
        client: true,
        clientBuilding: true,
        quotation: { select: { id: true, quoteNumber: true, status: true } },
        invoice: { select: { id: true, invoiceNumber: true, status: true } },
      },
    });

    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }

    // Guard: quote must not already exist for this order.
    if (order.quotationId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Order ${order.orderNumber} is already linked to quotation ` +
          `${order.quotation?.quoteNumber ?? `#${order.quotationId}`}. ` +
          `Open that quote instead of creating a new one.`,
      });
    }

    // Guard: if this order already has a FINALISED invoice (APPROVED / SENT /
    // PAID / OVERDUE), refuse quote-first — the client has already been
    // billed, so quoting after the fact is almost always a mistake.
    // Draft/pending invoices are OK to replace and will be cancelled below.
    const finalisedInvoiceStatuses = new Set(["APPROVED", "SENT", "PAID", "OVERDUE"]);
    if (order.invoice && finalisedInvoiceStatuses.has(String(order.invoice.status).toUpperCase())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Order ${order.orderNumber} already has invoice ${order.invoice.invoiceNumber} ` +
          `in ${order.invoice.status} state. Cancel or credit-note that invoice ` +
          `before sending a quote for the same job.`,
      });
    }

    // Guard: order must be COMPLETED (ready for invoicing). We allow
    // AWAITING_ORDER_NUMBER too so admin can quote a job that's finished
    // but still waiting on the client's PO.
    const invoiceableStatuses = ["COMPLETED", "AWAITING_ORDER_NUMBER"];
    if (!invoiceableStatuses.includes(order.status as any)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Order ${order.orderNumber} is ${order.status}. ` +
          `Only completed jobs (or jobs awaiting a client PO number) can be quoted.`,
      });
    }

    // Guard: cost-to-company must not be zero (mirror the guardrail on
    // invoice creation — quoting a R0-cost job is almost always a mistake).
    const materialCost = order.materialCost ?? 0;
    const labourCost = order.labourCost ?? 0;
    const callOutFee = order.callOutFee ?? 0;
    const costToCompany = materialCost + labourCost + callOutFee;
    if (costToCompany <= 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Cannot quote ${order.orderNumber}: Cost to Company is R 0.00 ` +
          `(materials R${materialCost.toFixed(2)}, labour R${labourCost.toFixed(2)}, ` +
          `call-out R${callOutFee.toFixed(2)}). Record the actual costs on the order first.`,
      });
    }

    // Build line items — prefer detailed materials + job activities, fall
    // back to summary lines derived from order costs.
    const items: QuotationLineItem[] = [];

    if (order.materials && order.materials.length > 0) {
      for (const material of order.materials) {
        const qty = material.quantity ?? 1;
        const price = material.unitPrice ?? 0;
        items.push({
          description: material.description || material.itemName || "Material",
          quantity: qty,
          unitPrice: price,
          total: qty * price,
          unitOfMeasure: material.unit || "Sum",
        });
      }
    }

    if (order.jobActivities && order.jobActivities.length > 0) {
      for (const activity of order.jobActivities) {
        const qty = activity.hoursWorked ?? 1;
        const rate = activity.rate ?? 0;
        items.push({
          description: activity.description || "Labour",
          quantity: qty,
          unitPrice: rate,
          total: qty * rate,
          unitOfMeasure: "Hr",
        });
      }
    }

    if (items.length === 0) {
      // Nothing itemised — synthesise two summary lines from stored costs so
      // the client still sees a coherent quote.
      if (materialCost > 0) {
        items.push({
          description: "Materials",
          quantity: 1,
          unitPrice: materialCost,
          total: materialCost,
          unitOfMeasure: "Sum",
        });
      }
      if (labourCost > 0) {
        items.push({
          description: "Labour",
          quantity: 1,
          unitPrice: labourCost,
          total: labourCost,
          unitOfMeasure: "Sum",
        });
      }
      if (callOutFee > 0) {
        items.push({
          description: "Call-out fee",
          quantity: 1,
          unitPrice: callOutFee,
          total: callOutFee,
          unitOfMeasure: "Sum",
        });
      }
    }

    if (items.length === 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message:
          `Cannot quote ${order.orderNumber}: no materials, labour or costs recorded. ` +
          `Record the job's costs on the order first.`,
      });
    }

    // Canonicalise totals server-side (matches createQuotation behaviour so
    // stored values are byte-for-byte what the PDF will render).
    const canonical = computeInvoiceTotals(items, 0);

    // Deposit request derivation — percent authoritative.
    const roundMoney2 = (n: number) =>
      Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
    const depPct = Math.max(
      0,
      Math.min(100, Number(input.depositRequestedPercent) || 0)
    );
    const depAmt =
      depPct > 0 ? roundMoney2((canonical.total * depPct) / 100) : 0;

    // Quote number.
    const companyDetails = await getCompanyDetails();
    const quoteNumber = await getNextQuoteNumber(
      db,
      companyDetails?.quotationPrefix || "QUO"
    );

    const validUntilDays = input.validUntilDays ?? 30;
    const validUntil = new Date(
      Date.now() + validUntilDays * 24 * 60 * 60 * 1000
    );

    const traceabilityNote =
      `Generated from Order ${order.orderNumber} on ` +
      `${new Date().toISOString().slice(0, 10)}. ` +
      `Client PO to be provided by ${order.customerName}.`;

    const notes = input.notes
      ? `${input.notes}\n\n${traceabilityNote}`
      : traceabilityNote;

    // Company cost snapshot — carried across from the source order so the
    // quote reports the same profit picture as the order it was built from.
    const companyMaterialCost = materialCost;
    const companyLabourCost = labourCost;
    const estimatedProfit = canonical.total - materialCost - labourCost - callOutFee;

    // Create the quotation.
    const quotation = await db.quotation.create({
      data: {
        quoteNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        address: order.address,
        items: items as any,
        subtotal: canonical.subtotal,
        discountPercent: 0,
        discountAmount: 0,
        tax: canonical.tax,
        total: canonical.total,
        depositRequestedPercent: depPct,
        depositRequestedAmount: depAmt,
        companyMaterialCost,
        companyLabourCost,
        estimatedProfit,
        status: "DRAFT",
        validUntil,
        notes,
        projectDescription: order.description ?? null,
        assignedToId: order.assignedToId ?? null,
        clientId: order.clientId,
        clientBuildingId: order.clientBuildingId,
        createdById: user.id,
      },
    });

    // Link the order → quotation (traceability). Also append an invoicing
    // blocker so this order visibly waits for the client's PO before it can
    // slip into an invoice.
    const priorBlockers = Array.isArray(order.invoicingBlockers)
      ? (order.invoicingBlockers as any[])
      : [];
    const nextBlockers = [
      ...priorBlockers.filter(
        (b) =>
          b?.type !== "QUOTE_SENT_AWAITING_CLIENT_PO" &&
          b?.type !== "PENDING_ADMIN_REVIEW"
      ),
      {
        type: "QUOTE_SENT_AWAITING_CLIENT_PO",
        quotationId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        since: new Date().toISOString(),
      },
    ];

    await db.order.update({
      where: { id: order.id },
      data: {
        quotationId: quotation.id,
        invoicingBlockers: nextBlockers as any,
      },
    });

    // If the artisan's completion flow auto-generated a DRAFT / PENDING_REVIEW
    // invoice on this order, cancel it — the client's next document is the
    // quote, and a real invoice will be created against their PO later.
    // We CANCEL rather than delete so the audit trail survives.
    const draftInvoiceStatuses = new Set(["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL"]);
    if (
      order.invoice &&
      draftInvoiceStatuses.has(String(order.invoice.status).toUpperCase())
    ) {
      await db.invoice.update({
        where: { id: order.invoice.id },
        data: {
          status: "CANCELLED",
          rejectionReason:
            `Cancelled because quote ${quotation.quoteNumber} was sent first — ` +
            `a fresh invoice will be raised against the client's PO.`,
        },
      });
      await writeAuditLog(db, {
        actor: user,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: order.invoice.id,
        after: { status: "CANCELLED", replacedByQuote: quotation.quoteNumber },
        description:
          `Invoice ${order.invoice.invoiceNumber} cancelled — replaced by ` +
          `quote ${quotation.quoteNumber} on order ${order.orderNumber}.`,
        module: "invoicing",
      });
    }

    // Audit trail — one entry per entity so the change is visible from both
    // the Order and the Quotation history views.
    await writeAuditLog(db, {
      actor: user,
      action: "CONVERT",
      entityType: "Order",
      entityId: order.id,
      after: {
        orderNumber: order.orderNumber,
        quotationId: quotation.id,
        quoteNumber: quotation.quoteNumber,
        quotedTotal: canonical.total,
      },
      description:
        `Quote-first: created draft quotation ${quotation.quoteNumber} ` +
        `from order ${order.orderNumber} — awaiting client PO before invoicing.`,
      module: "invoicing",
    });

    await writeAuditLog(db, {
      actor: user,
      action: "CREATE",
      entityType: "Quotation",
      entityId: quotation.id,
      after: {
        quoteNumber: quotation.quoteNumber,
        sourceOrderId: order.id,
        sourceOrderNumber: order.orderNumber,
        total: canonical.total,
        status: quotation.status,
      },
      description:
        `Draft quotation ${quotation.quoteNumber} created from ` +
        `order ${order.orderNumber} (quote-first flow).`,
      module: "quotations",
    });

    return {
      quotationId: quotation.id,
      quoteNumber: quotation.quoteNumber,
      total: canonical.total,
      status: quotation.status,
    };
  });
