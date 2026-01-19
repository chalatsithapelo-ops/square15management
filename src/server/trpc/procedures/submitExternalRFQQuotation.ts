import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getValidExternalTokenRecord } from "~/server/utils/external-submissions";

export const submitExternalRFQQuotation = baseProcedure
  .input(
    z.object({
      submissionToken: z.string().min(10),
      total: z.number().min(0),
      notes: z.string().optional(),
      attachments: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const record = await getValidExternalTokenRecord(input.submissionToken);

    if (record.type !== "RFQ_QUOTE") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This link is not for RFQ quotation submission.",
      });
    }

    if (record.usedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This quotation link has already been used.",
      });
    }

    if (!record.rfq) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "RFQ not found for this link.",
      });
    }

    const rfq = record.rfq;

    // Generate quotation number
    const companyDetails = await getCompanyDetails();
    const count = await db.quotation.count();
    const quoteNumber = `${companyDetails.quotationPrefix}-${String(count + 1).padStart(5, "0")}`;

    const subtotal = input.total;
    const tax = 0;
    const total = input.total;

    const quotation = await db.quotation.create({
      data: {
        quoteNumber,
        clientReferenceQuoteNumber: rfq.rfqNumber,
        customerName: `${rfq.propertyManager.firstName} ${rfq.propertyManager.lastName}`,
        customerEmail: rfq.propertyManager.email,
        customerPhone: rfq.propertyManager.phone || "",
        address: rfq.buildingAddress,
        items: [
          {
            description: `Quotation for RFQ ${rfq.rfqNumber}: ${rfq.title}`,
            quantity: 1,
            unitPrice: total,
            total: total,
            unitOfMeasure: "Sum",
          },
        ],
        subtotal,
        tax,
        total,
        notes:
          input.notes ||
          `External contractor quotation submitted via email link for RFQ: ${rfq.title}`,
        status: "SENT_TO_CUSTOMER",
        pictures: [],
        measurements: null,
        companyMaterialCost: 0,
        companyLabourCost: 0,
        estimatedProfit: 0,
      },
    });

    // Move RFQ into received workflow
    await db.propertyManagerRFQ.update({
      where: { id: rfq.id },
      data: {
        status: "RECEIVED",
      },
    });

    await db.notification.create({
      data: {
        recipientId: rfq.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER",
        message: `A quotation (${quotation.quoteNumber}) was submitted for RFQ ${rfq.rfqNumber} by ${record.email}.`,
        type: "RFQ_QUOTED" as any,
        relatedEntityId: quotation.id,
        relatedEntityType: "QUOTATION",
      },
    });

    await db.externalSubmissionToken.update({
      where: { id: record.id },
      data: { usedAt: new Date() },
    });

    // Attachments: store URLs in quotation.pictures (schema expects string[])
    if (input.attachments?.length) {
      await db.quotation.update({
        where: { id: quotation.id },
        data: { pictures: input.attachments },
      });
    }

    return { quotationId: quotation.id, quoteNumber: quotation.quoteNumber };
  });
