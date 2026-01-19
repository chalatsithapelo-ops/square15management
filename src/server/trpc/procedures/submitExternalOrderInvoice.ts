import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";
import { createNotification } from "~/server/utils/notifications";

export const submitExternalOrderInvoice = baseProcedure
  .input(
    z.object({
      submissionToken: z.string().min(10),
      invoiceTotal: z.number().min(0),
      notes: z.string().optional(),
      attachments: z.array(z.string()).min(1, "Please upload or provide at least one invoice attachment."),
    })
  )
  .mutation(async ({ input }) => {
    const record = await getValidExternalTokenRecord(input.submissionToken);

    if (record.type !== "ORDER_INVOICE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This link is not for invoice submission.",
      });
    }

    if (record.usedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This invoice link has already been used.",
      });
    }

    if (!record.order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found for this link.",
      });
    }

    const order = record.order;

    // Generate unique invoice number
    const companyDetails = await getCompanyDetails();
    const invoiceCount = await db.invoice.count();
    const pmInvoiceCount = await db.propertyManagerInvoice.count();
    const totalCount = invoiceCount + pmInvoiceCount;
    const invoiceNumber = `${companyDetails.invoicePrefix}-${String(totalCount + 1).padStart(5, "0")}`;

    const subtotal = input.invoiceTotal;
    const tax = 0;
    const total = input.invoiceTotal;

    const invoice = await db.propertyManagerInvoice.create({
      data: {
        invoiceNumber,
        propertyManagerId: order.propertyManagerId,
        orderId: order.id,
        items: [
          {
            description: `Invoice for PM Order ${order.orderNumber}: ${order.title}`,
            quantity: 1,
            unitPrice: total,
            total: total,
            unitOfMeasure: "Sum",
          },
        ],
        subtotal,
        tax,
        total,
        status: "SENT_TO_PM",
        sentToPMDate: new Date(),
        attachments: input.attachments,
        notes:
          input.notes ||
          `External contractor invoice submitted via email link for order ${order.orderNumber} by ${record.email}.`,
      },
    });

    await createNotification({
      recipientId: order.propertyManagerId,
      recipientRole: "PROPERTY_MANAGER",
      message: `An invoice (${invoice.invoiceNumber}) was submitted for order ${order.orderNumber} by ${record.email}.`,
      type: "INVOICE_CREATED",
      relatedEntityId: invoice.id,
      relatedEntityType: "PROPERTY_MANAGER_INVOICE",
    });

    await db.externalSubmissionToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    return { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber };
  });
