import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { notifyAdmins } from "~/server/utils/notifications";

const updateStatusSchema = z.object({
  token: z.string(),
  rfqId: z.number(),
  action: z.enum(["APPROVE", "REJECT", "START_REVIEW", "CONVERT_TO_ORDER"]),
  newStatus: z.enum(["UNDER_REVIEW", "QUOTED", "APPROVED", "REJECTED", "CONVERTED_TO_ORDER"]).optional(),
  rejectionReason: z.string().optional(),
});

export const updatePropertyManagerRFQStatus = baseProcedure
  .input(updateStatusSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can update RFQ status.",
      });
    }

    try {
      // Verify RFQ exists and belongs to this PM
      const rfq = await db.propertyManagerRFQ.findUnique({
        where: { id: input.rfqId },
        include: {
          adminQuote: true,
        },
      });

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found.",
        });
      }

      if (rfq.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own RFQs.",
        });
      }

      const now = new Date();
      let newStatus = rfq.status;
      let updateData: any = {};

      // Handle different actions
      if (input.action === "START_REVIEW") {
        // Move from RECEIVED to UNDER_REVIEW
        if (rfq.status !== "RECEIVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only start review for received RFQs.",
          });
        }
        newStatus = "UNDER_REVIEW";
      } else if (input.action === "APPROVE") {
        // Approve a quoted RFQ
        if (rfq.status !== "QUOTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "RFQ must be in QUOTED status to approve.",
          });
        }
        if (!rfq.adminQuote) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No quote available for this RFQ.",
          });
        }
        newStatus = "APPROVED";
        updateData.approvedDate = now;
        
        // Update quote status
        await db.propertyManagerQuote.update({
          where: { id: rfq.adminQuote.id },
          data: {
            status: "APPROVED",
            approvedByPMDate: now,
          },
        });
      } else if (input.action === "REJECT") {
        // Reject a quoted RFQ
        if (rfq.status !== "QUOTED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "RFQ must be in QUOTED status to reject.",
          });
        }
        if (!rfq.adminQuote) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "No quote available for this RFQ.",
          });
        }
        newStatus = "REJECTED";
        updateData.rejectedDate = now;
        updateData.rejectionReason = input.rejectionReason;
        
        // Update quote status
        await db.propertyManagerQuote.update({
          where: { id: rfq.adminQuote.id },
          data: {
            status: "REJECTED",
            rejectedByPMDate: now,
            pmRejectionReason: input.rejectionReason,
          },
        });
      } else if (input.action === "CONVERT_TO_ORDER") {
        // Convert approved RFQ to order
        if (rfq.status !== "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "RFQ must be approved to convert to order.",
          });
        }
        newStatus = "CONVERTED_TO_ORDER";
      } else if (input.newStatus) {
        // Direct status change
        newStatus = input.newStatus;
      }

      // Update RFQ
      const updatedRFQ = await db.propertyManagerRFQ.update({
        where: { id: input.rfqId },
        data: {
          status: newStatus,
          ...updateData,
        },
        include: {
          adminQuote: true,
        },
      });

      // Notify admins for important status changes
      if (input.action === "APPROVE" || input.action === "REJECT") {
        const notificationType = input.action === "APPROVE" ? "RFQ_APPROVED" : "RFQ_REJECTED";
        const message = input.action === "APPROVE"
          ? `RFQ ${rfq.rfqNumber} has been approved by ${user.firstName} ${user.lastName}`
          : `RFQ ${rfq.rfqNumber} has been rejected by ${user.firstName} ${user.lastName}${input.rejectionReason ? `: ${input.rejectionReason}` : ""}`;

        await notifyAdmins({
          message,
          type: notificationType as any,
          relatedEntityId: rfq.id,
          relatedEntityType: "PROPERTY_MANAGER_RFQ",
        });
      }

      return updatedRFQ;
    } catch (error) {
      console.error("Error updating RFQ status:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update RFQ status.",
      });
    }
  });
