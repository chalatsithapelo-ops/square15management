import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import * as z from "zod";
import { createNotification } from "~/server/utils/notifications";

const getReceivedMaintenanceRequestsSchema = z.object({
  token: z.string(),
  propertyManagerId: z.number(),
  status: z.enum(["RECEIVED", "APPROVED", "REJECTED", "CONVERTED"]).optional(),
});

export const getReceivedMaintenanceRequests = baseProcedure
  .input(getReceivedMaintenanceRequestsSchema)
  .query(async ({ input }) => {
    try {
      const where: any = {
        propertyManagerId: input.propertyManagerId,
        recipientType: "PM",
      };

      if (input.status) {
        where.status = input.status;
      }

      const requests = await db.maintenanceRequest.findMany({
        where,
        include: {
          customer: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return requests;
    } catch (error) {
      console.error("Error fetching maintenance requests:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch maintenance requests.",
      });
    }
  });

const approveMaintenanceRequestSchema = z.object({
  token: z.string(),
  requestId: z.number(),
  approvalNotes: z.string().optional(),
  approvedBy: z.number(),
});

export const approveMaintenanceRequest = baseProcedure
  .input(approveMaintenanceRequestSchema)
  .mutation(async ({ input }) => {
    try {
      const request = await db.maintenanceRequest.findUnique({
        where: { id: input.requestId },
        include: { customer: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance request not found.",
        });
      }

      if (request.status !== "RECEIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only approve requests that are in RECEIVED status.",
        });
      }

      // Update request
      const updatedRequest = await db.maintenanceRequest.update({
        where: { id: input.requestId },
        data: {
          status: "APPROVED",
          approvedBy: input.approvedBy,
          approvalNotes: input.approvalNotes || undefined,
          approvedDate: new Date(),
        },
        include: { customer: true },
      });

      // Notify customer
      await createNotification({
        recipientId: request.customer.userId,
        recipientRole: "CUSTOMER",
        message: `Your maintenance request "${request.title}" has been approved.`,
        type: "MAINTENANCE_REQUEST_APPROVED",
        relatedEntityId: request.id,
        relatedEntityType: "MAINTENANCE_REQUEST",
      });

      return updatedRequest;
    } catch (error) {
      console.error("Error approving maintenance request:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to approve maintenance request.",
      });
    }
  });

const rejectMaintenanceRequestSchema = z.object({
  token: z.string(),
  requestId: z.number(),
  rejectionReason: z.string(),
});

export const rejectMaintenanceRequest = baseProcedure
  .input(rejectMaintenanceRequestSchema)
  .mutation(async ({ input }) => {
    try {
      const request = await db.maintenanceRequest.findUnique({
        where: { id: input.requestId },
        include: { customer: true },
      });

      if (!request) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance request not found.",
        });
      }

      if (request.status !== "RECEIVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only reject requests that are in RECEIVED status.",
        });
      }

      // Update request
      const updatedRequest = await db.maintenanceRequest.update({
        where: { id: input.requestId },
        data: {
          status: "REJECTED",
          rejectionReason: input.rejectionReason,
          rejectedDate: new Date(),
        },
        include: { customer: true },
      });

      // Notify customer
      await createNotification({
        recipientId: request.customer.userId,
        recipientRole: "CUSTOMER",
        message: `Your maintenance request "${request.title}" has been rejected: ${input.rejectionReason}`,
        type: "MAINTENANCE_REQUEST_REJECTED",
        relatedEntityId: request.id,
        relatedEntityType: "MAINTENANCE_REQUEST",
      });

      return updatedRequest;
    } catch (error) {
      console.error("Error rejecting maintenance request:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to reject maintenance request.",
      });
    }
  });
