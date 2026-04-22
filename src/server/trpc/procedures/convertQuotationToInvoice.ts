import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";

export const convertQuotationToInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      createOrder: z.boolean().default(false), // Also create an order (job card)
      assignedToId: z.number().optional(), // Artisan to assign order to
      dueDate: z.string().optional(),
      notes: z.string().optional(),
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

    // Check if already converted
    const existingInvoice = await db.invoice.findUnique({
      where: { quotationId: quotation.id },
    });
    if (existingInvoice) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Quotation already converted to invoice ${existingInvoice.invoiceNumber}`,
      });
    }

    const companyDetails = await getCompanyDetails();

    // Generate invoice number by scanning true max suffix
    const allInvoices = await db.invoice.findMany({ select: { invoiceNumber: true } });
    const allPMInvoices = await db.propertyManagerInvoice.findMany({ select: { invoiceNumber: true } });
    let maxNum = 0;
    for (const inv of [...allInvoices, ...allPMInvoices]) {
      const match = inv.invoiceNumber.match(/(\d+)$/);
      if (match?.[1]) { const num = parseInt(match[1], 10); if (num > maxNum) maxNum = num; }
    }
    const prefix = companyDetails?.invoicePrefix || "INV";
    let invoiceNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;

    // Ensure uniqueness with retry loop
    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.invoice.findUnique({ where: { invoiceNumber } });
      const existingPM = await db.propertyManagerInvoice.findUnique({ where: { invoiceNumber } });
      if (!existing && !existingPM) break;
      attempts++;
      maxNum++;
      invoiceNumber = `${prefix}-${String(maxNum + 1).padStart(5, "0")}`;
    }

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
        tax: quotation.tax,
        total: quotation.total,
        companyMaterialCost: quotation.companyMaterialCost,
        companyLabourCost: quotation.companyLabourCost,
        estimatedProfit: quotation.estimatedProfit,
        status: "DRAFT",
        dueDate: input.dueDate ? new Date(input.dueDate) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: input.notes || quotation.notes,
        projectDescription: quotation.projectDescription,
        createdById: user.id,
        quotationId: quotation.id,
        projectId: quotation.projectId,
        clientReferenceNumber: quotation.clientReferenceQuoteNumber,
      },
    });

    // Optionally create an order (job card) as well
    let order = null;
    if (input.createOrder) {
      // Generate order number
      const orderCount = await db.order.count();
      const orderPrefix = companyDetails?.orderPrefix || "ORD";
      let orderNumber = `${orderPrefix}-${String(orderCount + 1).padStart(5, "0")}`;

      let orderAttempts = 0;
      while (orderAttempts < 10) {
        const existing = await db.order.findUnique({ where: { orderNumber } });
        if (!existing) break;
        orderAttempts++;
        orderNumber = `${orderPrefix}-${String(orderCount + orderAttempts + 1).padStart(5, "0")}`;
      }

      // Get service type from lead or quotation description
      const serviceType = quotation.lead?.serviceType || quotation.projectDescription || "Service from Quotation";

      order = await db.order.create({
        data: {
          orderNumber,
          customerName: quotation.customerName,
          customerEmail: quotation.customerEmail,
          customerPhone: quotation.customerPhone,
          address: quotation.address,
          serviceType,
          description: quotation.projectDescription || `Job from quotation ${quotation.quoteNumber}`,
          status: input.assignedToId ? "ASSIGNED" : "PENDING",
          assignedToId: input.assignedToId || quotation.assignedToId,
          leadId: quotation.leadId,
          quotationId: quotation.id,
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
    }

    return {
      invoice,
      order,
      message: order
        ? `Invoice ${invoice.invoiceNumber} and Order ${order.orderNumber} created from quotation ${quotation.quoteNumber}`
        : `Invoice ${invoice.invoiceNumber} created from quotation ${quotation.quoteNumber}`,
    };
  });
