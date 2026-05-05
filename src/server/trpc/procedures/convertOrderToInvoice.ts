import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";

/**
 * Convert a completed Order into an Invoice in one click.
 * Pre-populates customer info, line items, and totals from the order
 * (and its source quotation if linked) so the user does not have to
 * re-enter client information when invoicing a finished job.
 */
export const convertOrderToInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (
      ![
        "JUNIOR_ADMIN",
        "SENIOR_ADMIN",
        "TECHNICAL_MANAGER",
        "MANAGER",
        "CONTRACTOR",
        "CONTRACTOR_SENIOR_MANAGER",
      ].includes(user.role)
    ) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to create invoices.",
      });
    }

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: { quotation: true },
    });

    if (!order) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
    }

    // Block if invoice already exists for this order
    const existing = await db.invoice.findUnique({
      where: { orderId: order.id },
    });
    if (existing) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Order already invoiced as ${existing.invoiceNumber}`,
      });
    }

    // Generate invoice number
    const companyDetails = await getCompanyDetails();
    const prefix = companyDetails?.invoicePrefix || "INV";
    const allInvoices = await db.invoice.findMany({ select: { invoiceNumber: true } });
    const allPMInvoices = await db.propertyManagerInvoice.findMany({
      select: { invoiceNumber: true },
    });
    let maxNum = 0;
    const pattern = new RegExp(
      `^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`
    );
    for (const inv of [...allInvoices, ...allPMInvoices]) {
      const m = inv.invoiceNumber.match(pattern);
      if (m?.[1]) {
        const n = parseInt(m[1], 10);
        if (n > maxNum) maxNum = n;
      }
    }
    let invoiceNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
    for (let i = 0; i < 10; i++) {
      const a = await db.invoice.findUnique({ where: { invoiceNumber } });
      const b = await db.propertyManagerInvoice.findUnique({
        where: { invoiceNumber },
      });
      if (!a && !b) break;
      maxNum++;
      invoiceNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
    }

    // Source line items + totals: prefer the linked quotation's items
    // (richer breakdown). Fall back to a single line summarising the order.
    let items: Array<{
      description: string;
      quantity: number;
      unitPrice: number;
      total: number;
      unitOfMeasure: string;
    }>;
    let subtotal: number;
    let tax: number;
    let total: number;
    let companyMaterialCost: number;
    let companyLabourCost: number;
    let estimatedProfit: number;

    if (order.quotation) {
      items = (order.quotation.items as any[]) ?? [];
      subtotal = order.quotation.subtotal;
      tax = order.quotation.tax;
      total = order.quotation.total;
      companyMaterialCost = order.quotation.companyMaterialCost;
      companyLabourCost = order.quotation.companyLabourCost;
      estimatedProfit = order.quotation.estimatedProfit;
    } else {
      const lineTotal = order.totalCost || (order.materialCost + order.labourCost + order.callOutFee);
      const sub = +(lineTotal / 1.15).toFixed(2);
      const t = +(lineTotal - sub).toFixed(2);
      items = [
        {
          description: order.description || `Service: ${order.serviceType}`,
          quantity: 1,
          unitPrice: sub,
          total: sub,
          unitOfMeasure: "Sum",
        },
      ];
      subtotal = sub;
      tax = t;
      total = lineTotal;
      companyMaterialCost = order.materialCost;
      companyLabourCost = order.labourCost;
      estimatedProfit = lineTotal - order.materialCost - order.labourCost;
    }

    const invoice = await db.invoice.create({
      data: {
        invoiceNumber,
        customerName: order.customerName,
        customerEmail: order.customerEmail,
        customerPhone: order.customerPhone,
        address: order.address,
        items,
        subtotal,
        tax,
        total,
        companyMaterialCost,
        companyLabourCost,
        estimatedProfit,
        status: "DRAFT",
        dueDate: input.dueDate
          ? new Date(input.dueDate)
          : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: input.notes || `Invoice for completed order ${order.orderNumber}`,
        projectDescription: order.quotation?.projectDescription ?? null,
        orderId: order.id,
        quotationId: order.quotationId,
        clientId: order.clientId,
        clientBuildingId: order.clientBuildingId,
        createdById: user.id,
      },
    });

    return {
      invoice,
      message: `Invoice ${invoice.invoiceNumber} created from order ${order.orderNumber}`,
    };
  });
