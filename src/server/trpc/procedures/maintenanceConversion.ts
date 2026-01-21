import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import * as z from "zod";
import { createNotification } from "~/server/utils/notifications";

const convertMaintenanceToRFQSchema = z.object({
  token: z.string(),
  requestId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  propertyManagerId: z.number(),
});

export const convertMaintenanceToRFQ = baseProcedure
  .input(convertMaintenanceToRFQSchema)
  .mutation(async ({ input }) => {
    try {
      const maintenanceRequest = await db.maintenanceRequest.findUnique({
        where: { id: input.requestId },
        include: { customer: true },
      });

      if (!maintenanceRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance request not found.",
        });
      }

      if (maintenanceRequest.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only convert approved requests to RFQ.",
        });
      }

      // Generate RFQ number
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();

      const lastRFQ = await db.propertyManagerRFQ.findFirst({
        where: {
          propertyManagerId: input.propertyManagerId,
          createdAt: {
            gte: new Date(year, today.getMonth(), 1),
            lt: new Date(year, today.getMonth() + 1, 1),
          },
        },
        orderBy: { id: "desc" },
      });

      const sequence = (lastRFQ?.id || 0) % 10000 + 1;
      const rfqNumber = `RFQ-${year}${month}-${String(sequence).padStart(4, "0")}`;

      // Create RFQ
      const rfq = await db.propertyManagerRFQ.create({
        data: {
          propertyManagerId: input.propertyManagerId,
          rfqNumber,
          title: input.title || maintenanceRequest.title,
          description: input.description || maintenanceRequest.description,
          scopeOfWork: input.description || maintenanceRequest.description,
          buildingName: maintenanceRequest.buildingName,
          buildingAddress: maintenanceRequest.address,
          urgency: maintenanceRequest.urgency,
          estimatedBudget: 0,
          status: "DRAFT",
        },
      });

      // Update maintenance request
      await db.maintenanceRequest.update({
        where: { id: input.requestId },
        data: {
          status: "CONVERTED",
          conversionType: "RFQ",
          convertedToRFQId: rfq.id,
          convertedDate: new Date(),
        },
      });

      // Notify customer
      await createNotification({
        recipientId: maintenanceRequest.customer.userId,
        recipientRole: "CUSTOMER",
        message: `Your maintenance request has been converted to RFQ ${rfqNumber}.`,
        type: "MAINTENANCE_CONVERTED_TO_RFQ",
        relatedEntityId: rfq.id,
        relatedEntityType: "RFQ",
      });

      return rfq;
    } catch (error) {
      console.error("Error converting to RFQ:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to convert maintenance request to RFQ.",
      });
    }
  });

const convertMaintenanceToOrderSchema = z.object({
  token: z.string(),
  requestId: z.number(),
  contractorId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  propertyManagerId: z.number(),
});

export const convertMaintenanceToOrder = baseProcedure
  .input(convertMaintenanceToOrderSchema)
  .mutation(async ({ input }) => {
    try {
      const maintenanceRequest = await db.maintenanceRequest.findUnique({
        where: { id: input.requestId },
        include: { customer: true },
      });

      if (!maintenanceRequest) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Maintenance request not found.",
        });
      }

      if (maintenanceRequest.status !== "APPROVED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only convert approved requests to Order.",
        });
      }

      // Verify contractor exists
      const contractor = await db.contractor.findUnique({
        where: { id: input.contractorId },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found.",
        });
      }

      // Generate Order number
      const today = new Date();
      const month = String(today.getMonth() + 1).padStart(2, "0");
      const year = today.getFullYear();

      const lastOrder = await db.propertyManagerOrder.findFirst({
        where: {
          propertyManagerId: input.propertyManagerId,
          createdAt: {
            gte: new Date(year, today.getMonth(), 1),
            lt: new Date(year, today.getMonth() + 1, 1),
          },
        },
        orderBy: { id: "desc" },
      });

      const sequence = (lastOrder?.id || 0) % 10000 + 1;
      const orderNumber = `ORD-${year}${month}-${String(sequence).padStart(4, "0")}`;

      // Create Order
      const order = await db.propertyManagerOrder.create({
        data: {
          propertyManagerId: input.propertyManagerId,
          orderNumber,
          title: input.title || maintenanceRequest.title,
          description: input.description || maintenanceRequest.description,
          scopeOfWork: input.description || maintenanceRequest.description,
          buildingName: maintenanceRequest.buildingName,
          buildingAddress: maintenanceRequest.address,
          totalAmount: 0,
          status: "DRAFT",
        },
      });

      // Update maintenance request
      await db.maintenanceRequest.update({
        where: { id: input.requestId },
        data: {
          status: "CONVERTED",
          conversionType: "ORDER",
          convertedToOrderId: order.id,
          convertedDate: new Date(),
        },
      });

      // Notify customer
      await createNotification({
        recipientId: maintenanceRequest.customer.userId,
        recipientRole: "CUSTOMER",
        message: `Your maintenance request has been converted to Order ${orderNumber} assigned to ${contractor.companyName}.`,
        type: "MAINTENANCE_CONVERTED_TO_ORDER",
        relatedEntityId: order.id,
        relatedEntityType: "ORDER",
      });

      // Notify contractor
      try {
        const contractorPortalUser = contractor.portalAccessEnabled
          ? await db.user.findFirst({
              where: {
                email: contractor.email,
                role: { in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"] },
              },
              select: { id: true },
            })
          : null;

        if (contractorPortalUser?.id) {
          await createNotification({
            recipientId: contractorPortalUser.id,
            recipientRole: "CONTRACTOR",
            message: `You have been assigned a new order ${orderNumber}: ${maintenanceRequest.title}`,
            type: "NEW_ORDER_ASSIGNED",
            relatedEntityId: order.id,
            relatedEntityType: "ORDER",
          });
        }
      } catch (notifyError) {
        console.error("Failed to notify contractor about new order:", notifyError);
      }

      return order;
    } catch (error) {
      console.error("Error converting to Order:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to convert maintenance request to Order.",
      });
    }
  });
