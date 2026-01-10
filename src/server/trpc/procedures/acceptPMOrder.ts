import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const acceptPMOrderSchema = z.object({
  token: z.string(),
  orderId: z.number(),
  assignedToId: z.number().optional(), // Optional artisan to assign
  startDate: z.string().optional(),
  notes: z.string().optional(),
});

export const acceptPMOrder = baseProcedure
  .input(acceptPMOrderSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Check if user is any contractor role
    const isContractorRole = user.role === "CONTRACTOR" || 
                            user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                            user.role === "CONTRACTOR_JUNIOR_MANAGER";

    if (!isContractorRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only contractors can accept orders.",
      });
    }

    try {
      // Fetch the order with all needed fields
      const order = await db.propertyManagerOrder.findUnique({
        where: { id: input.orderId },
        select: {
          id: true,
          contractorId: true,
          propertyManagerId: true,
          status: true,
          notes: true,
          propertyManager: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found.",
        });
      }

      // Verify this contractor has access to this order
      // Orders are assigned by linking to contractor via selectedContractorIds or contractorId
      const hasAccess = order.contractorId === user.id;
      
      if (!hasAccess) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this order.",
        });
      }

      // Update order status to IN_PROGRESS and set dates
      const updatedOrder = await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: {
          status: "IN_PROGRESS",
          acceptedDate: new Date(),
          startDate: input.startDate ? new Date(input.startDate) : new Date(),
          notes: input.notes || order.notes,
        },
      });

      return updatedOrder;
    } catch (error) {
      console.error("Error accepting PM order:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to accept order.",
      });
    }
  });
