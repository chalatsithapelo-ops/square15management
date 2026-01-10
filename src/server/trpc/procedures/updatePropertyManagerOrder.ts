import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import * as z from "zod";

const updatePropertyManagerOrderSchema = z.object({
  token: z.string(),
  orderId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  scopeOfWork: z.string().optional(),
  buildingName: z.string().optional(),
  buildingAddress: z.string().optional(),
  totalAmount: z.number().optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  assignedToId: z.number().nullable().optional(),
});

export const updatePropertyManagerOrder = baseProcedure
  .input(updatePropertyManagerOrderSchema)
  .mutation(async ({ input }) => {
    try {
      const order = await db.propertyManagerOrder.findUnique({
        where: { id: input.orderId },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found.",
        });
      }

      // Allow editing Orders in any status (Property Manager can edit submitted Orders)
      // No status restriction - PM can edit at any time

      const updateData: any = {};
      
      if (input.title) updateData.title = input.title;
      if (input.description) updateData.description = input.description;
      if (input.scopeOfWork) updateData.scopeOfWork = input.scopeOfWork;
      if (input.buildingName !== undefined) updateData.buildingName = input.buildingName;
      if (input.buildingAddress) updateData.buildingAddress = input.buildingAddress;
      if (input.totalAmount !== undefined) updateData.totalAmount = input.totalAmount;
      if (input.notes !== undefined) updateData.notes = input.notes;
      
      if (input.assignedToId !== undefined) {
        updateData.assignedToId = input.assignedToId;
        // Auto-update status to ASSIGNED when an artisan is assigned (if currently in SUBMITTED or ACCEPTED status)
        if (input.assignedToId !== null && (order.status === 'DRAFT' || order.status === 'SUBMITTED' || order.status === 'ACCEPTED')) {
          updateData.status = 'ASSIGNED';
        }
      }
      
      // If status is being changed to SUBMITTED, set the submittedDate
      if (input.status === "SUBMITTED") {
        updateData.status = "SUBMITTED";
        updateData.submittedDate = new Date();
      }

      const updatedOrder = await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: updateData,
      });

      return updatedOrder;
    } catch (error) {
      console.error("Error updating Order:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update Order.",
      });
    }
  });
