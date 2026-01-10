import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import * as z from "zod";

const updatePropertyManagerRFQSchema = z.object({
  token: z.string(),
  rfqId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  scopeOfWork: z.string().optional(),
  buildingName: z.string().optional(),
  buildingAddress: z.string().optional(),
  urgency: z.string().optional(),
  estimatedBudget: z.number().nullable().optional(),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  selectedContractorIds: z.array(z.number()).optional(),
});

export const updatePropertyManagerRFQ = baseProcedure
  .input(updatePropertyManagerRFQSchema)
  .mutation(async ({ input }) => {
    try {
      const rfq = await db.propertyManagerRFQ.findUnique({
        where: { id: input.rfqId },
      });

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found.",
        });
      }

      // Allow editing RFQs in any status (Property Manager can edit submitted RFQs)
      // No status restriction - PM can edit at any time

      const updateData: any = {};
      
      if (input.title) updateData.title = input.title;
      if (input.description) updateData.description = input.description;
      if (input.scopeOfWork) updateData.scopeOfWork = input.scopeOfWork;
      if (input.buildingName !== undefined) updateData.buildingName = input.buildingName;
      if (input.buildingAddress) updateData.buildingAddress = input.buildingAddress;
      if (input.urgency) updateData.urgency = input.urgency;
      if (input.estimatedBudget !== undefined) updateData.estimatedBudget = input.estimatedBudget;
      if (input.attachments !== undefined) updateData.attachments = input.attachments;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.selectedContractorIds !== undefined) updateData.selectedContractorIds = input.selectedContractorIds;
      
      // If status is being changed to SUBMITTED, set the submittedDate
      if (input.status === "SUBMITTED") {
        updateData.status = "SUBMITTED";
        updateData.submittedDate = new Date();
      }

      const updatedRFQ = await db.propertyManagerRFQ.update({
        where: { id: input.rfqId },
        data: updateData,
      });

      return updatedRFQ;
    } catch (error) {
      console.error("Error updating RFQ:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update RFQ.",
      });
    }
  });
