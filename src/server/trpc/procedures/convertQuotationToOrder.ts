import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";

export const convertQuotationToOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      assignedToId: z.number().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!["JUNIOR_ADMIN", "SENIOR_ADMIN", "CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"].includes(user.role)) {
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
    const orderCount = await db.order.count();
    const orderPrefix = companyDetails?.orderPrefix || "ORD";
    let orderNumber = `${orderPrefix}-${String(orderCount + 1).padStart(5, "0")}`;

    let attempts = 0;
    while (attempts < 10) {
      const existing = await db.order.findUnique({ where: { orderNumber } });
      if (!existing) break;
      attempts++;
      orderNumber = `${orderPrefix}-${String(orderCount + attempts + 1).padStart(5, "0")}`;
    }

    const serviceType = quotation.lead?.serviceType || quotation.projectDescription || "Service from Quotation";

    const order = await db.order.create({
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

    return {
      order,
      message: `Order ${order.orderNumber} created from quotation ${quotation.quoteNumber}`,
    };
  });
