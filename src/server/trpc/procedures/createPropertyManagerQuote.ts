import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { createNotification } from "~/server/utils/notifications";

const quoteInputSchema = z.object({
  token: z.string(),
  rfqId: z.number(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
      unitOfMeasure: z.string().default("Sum"),
    })
  ),
  subtotal: z.number(),
  tax: z.number().default(0),
  total: z.number(),
  companyMaterialCost: z.number().default(0),
  companyLabourCost: z.number().default(0),
  estimatedProfit: z.number().default(0),
  estimatedStartDate: z.string().optional(),
  estimatedCompletionDate: z.string().optional(),
  estimatedDuration: z.string().optional(),
  validUntil: z.string().optional(),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional(),
  termsAndConditions: z.string().optional(),
});

export const createPropertyManagerQuote = baseProcedure
  .input(quoteInputSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Verify RFQ exists and is in valid state
      const rfq = await db.propertyManagerRFQ.findUnique({
        where: { id: input.rfqId },
        include: {
          propertyManager: true,
          adminQuote: true,
        },
      });

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found.",
        });
      }

      if (rfq.adminQuote) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A quote has already been created for this RFQ.",
        });
      }

      if (!["SUBMITTED", "UNDER_REVIEW"].includes(rfq.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "RFQ is not in a valid state for quoting.",
        });
      }

      // Generate quote number
      const companyDetails = await getCompanyDetails();
      const count = await db.propertyManagerQuote.count();
      const quoteNumber = `${companyDetails.quotationPrefix}-PM-${String(count + 1).padStart(5, "0")}`;

      // Create the quote
      const quote = await db.propertyManagerQuote.create({
        data: {
          quoteNumber,
          rfqId: input.rfqId,
          items: input.items,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          companyMaterialCost: input.companyMaterialCost,
          companyLabourCost: input.companyLabourCost,
          estimatedProfit: input.estimatedProfit,
          estimatedStartDate: input.estimatedStartDate ? new Date(input.estimatedStartDate) : null,
          estimatedCompletionDate: input.estimatedCompletionDate ? new Date(input.estimatedCompletionDate) : null,
          estimatedDuration: input.estimatedDuration || null,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          attachments: input.attachments || [],
          notes: input.notes || null,
          termsAndConditions: input.termsAndConditions || null,
          status: "SENT",
          sentDate: new Date(),
        },
      });

      // Update RFQ status
      await db.propertyManagerRFQ.update({
        where: { id: input.rfqId },
        data: {
          status: "QUOTED",
          quotedDate: new Date(),
        },
      });

      // Notify property manager
      await createNotification({
        recipientId: rfq.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER" as any,
        message: `Quote ${quote.quoteNumber} has been sent for your RFQ ${rfq.rfqNumber}`,
        type: "RFQ_QUOTED",
        relatedEntityId: quote.id,
        relatedEntityType: "PROPERTY_MANAGER_QUOTE",
      });

      return quote;
    } catch (error) {
      console.error("Error creating Property Manager Quote:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create quote.",
      });
    }
  });
