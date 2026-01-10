import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";

const updatePropertyManagerOrderStatusSchema = z.object({
  token: z.string(),
  orderId: z.number(),
  status: z.enum(["DRAFT", "SUBMITTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]),
  progressPercentage: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
});

export const updatePropertyManagerOrderStatus = baseProcedure
  .input(updatePropertyManagerOrderStatusSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      const order = await db.propertyManagerOrder.findUnique({
        where: { id: input.orderId },
        include: {
          propertyManager: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found.",
        });
      }

      // Build update data
      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.progressPercentage !== undefined) {
        updateData.progressPercentage = input.progressPercentage;
      }

      if (input.notes) {
        updateData.notes = input.notes;
      }

      // Set date fields based on status
      if (input.status === "SUBMITTED" && !order.submittedDate) {
        updateData.submittedDate = new Date();
      } else if (input.status === "ACCEPTED" && !order.acceptedDate) {
        updateData.acceptedDate = new Date();
      } else if (input.status === "IN_PROGRESS" && !order.startDate) {
        updateData.startDate = new Date();
      } else if (input.status === "COMPLETED" && !order.completedDate) {
        updateData.completedDate = new Date();
        updateData.progressPercentage = 100;
      }

      // Update the order
      const updatedOrder = await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: updateData,
      });

      // Update linked maintenance request status if exists
      const linkedMaintenanceRequest = await db.maintenanceRequest.findFirst({
        where: { convertedToOrderId: input.orderId },
      });

      if (linkedMaintenanceRequest) {
        let maintenanceStatus = linkedMaintenanceRequest.status;
        const maintenanceUpdateData: any = {};

        if (input.status === "IN_PROGRESS") {
          maintenanceStatus = "IN_PROGRESS";
          maintenanceUpdateData.status = maintenanceStatus;
        } else if (input.status === "COMPLETED") {
          maintenanceStatus = "COMPLETED";
          maintenanceUpdateData.status = maintenanceStatus;
          maintenanceUpdateData.completedDate = new Date();
        }

        if (Object.keys(maintenanceUpdateData).length > 0) {
          await db.maintenanceRequest.update({
            where: { id: linkedMaintenanceRequest.id },
            data: maintenanceUpdateData,
          });

          // Notify customer about maintenance request status change
          if (linkedMaintenanceRequest.customerId) {
            const customer = await db.propertyManagerCustomer.findUnique({
              where: { id: linkedMaintenanceRequest.customerId },
            });

            if (customer) {
              await createNotification({
                recipientId: customer.userId,
                recipientRole: "CUSTOMER",
                message: `Your maintenance request "${linkedMaintenanceRequest.title}" is now ${maintenanceStatus.toLowerCase().replace('_', ' ')}.`,
                type: "MAINTENANCE_STATUS_UPDATE",
                relatedEntityId: linkedMaintenanceRequest.id,
                relatedEntityType: "MAINTENANCE_REQUEST",
              });
            }
          }
        }
      }

      // Notify property manager of status change
      await createNotification({
        recipientId: order.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER",
        message: `Order ${order.orderNumber} status updated to ${input.status}.`,
        type: "ORDER_STATUS_UPDATE",
        relatedEntityId: order.id,
        relatedEntityType: "ORDER",
      });

      return updatedOrder;
    } catch (error) {
      console.error("Error updating order status:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update order status.",
      });
    }
  });
