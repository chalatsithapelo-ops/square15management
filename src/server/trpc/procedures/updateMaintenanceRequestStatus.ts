import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";
import { sendMaintenanceRequestStatusEmail } from "~/server/utils/email";

export const updateMaintenanceRequestStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      requestId: z.number(),
      status: z.enum(["REVIEWED", "APPROVED", "IN_PROGRESS", "COMPLETED", "REJECTED"]),
      responseNotes: z.string().optional(),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can update maintenance request status.",
      });
    }

    try {
      // Verify request exists and belongs to this PM
      const request = await db.maintenanceRequest.findUnique({
        where: { id: input.requestId },
        include: {
          customer: true,
        },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance request not found.",
        });
      }

      if (request.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own maintenance requests.",
        });
      }

      const now = new Date();
      const updateData: any = {
        status: input.status,
        responseNotes: input.responseNotes,
      };

      if (input.status === "REVIEWED") {
        updateData.reviewedDate = now;
      } else if (input.status === "APPROVED") {
        updateData.approvedDate = now;
      } else if (input.status === "COMPLETED") {
        updateData.completedDate = now;
      } else if (input.status === "REJECTED") {
        updateData.rejectionReason = input.rejectionReason;
      }

      const updatedRequest = await db.maintenanceRequest.update({
        where: { id: input.requestId },
        data: updateData,
        include: {
          customer: true,
        },
      });

      // Notify customer if they have a user account
      if (request.customer.userId) {
        let notificationType: any = "MAINTENANCE_REQUEST_SUBMITTED";
        let message = "";

        switch (input.status) {
          case "APPROVED":
            notificationType = "MAINTENANCE_REQUEST_APPROVED";
            message = `Your maintenance request "${request.title}" has been approved.`;
            break;
          case "COMPLETED":
            notificationType = "MAINTENANCE_REQUEST_COMPLETED";
            message = `Your maintenance request "${request.title}" has been completed.`;
            break;
          case "REJECTED":
            message = `Your maintenance request "${request.title}" has been rejected${input.rejectionReason ? `: ${input.rejectionReason}` : "."}`;
            break;
          default:
            message = `Your maintenance request "${request.title}" status has been updated to ${input.status}.`;
        }

        await createNotification({
          recipientId: request.customer.userId,
          recipientRole: "CUSTOMER",
          message,
          type: notificationType,
          relatedEntityId: request.id,
          relatedEntityType: "MAINTENANCE_REQUEST",
        });
      }

      // Email notification to customer (best-effort)
      try {
        await sendMaintenanceRequestStatusEmail({
          customerEmail: updatedRequest.customer.email,
          customerName: `${updatedRequest.customer.firstName} ${updatedRequest.customer.lastName}`,
          requestNumber: updatedRequest.requestNumber,
          requestTitle: updatedRequest.title,
          newStatus: updatedRequest.status,
          responseNotes: input.responseNotes,
          rejectionReason: input.rejectionReason,
          userId: user.id,
        });
      } catch (emailError) {
        console.error("Failed to send maintenance status email:", emailError);
      }

      return updatedRequest;
    } catch (error) {
      console.error("Error updating maintenance request status:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update maintenance request status.",
      });
    }
  });
