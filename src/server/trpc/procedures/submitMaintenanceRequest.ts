import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import * as z from "zod";
import { createNotification } from "~/server/utils/notifications";

const submitMaintenanceRequestSchema = z.object({
  token: z.string(),
  title: z.string().min(5),
  description: z.string().min(20),
  category: z.string(),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  recipientType: z.enum(["PM", "CONTRACTOR"]).default("PM"),
  contractorId: z.number().optional(),
  buildingName: z.string().optional(),
  customerId: z.number(),
  photos: z.array(z.string()).optional().default([]),
});

export const submitMaintenanceRequest = baseProcedure
  .input(submitMaintenanceRequestSchema)
  .mutation(async ({ input }) => {
    try {
      // Verify customer exists - look up by userId
      const customer = await db.propertyManagerCustomer.findFirst({
        where: { userId: input.customerId },
        include: { propertyManager: true },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found. Please ensure you are registered as a tenant.",
        });
      }

      // Generate unique request number
      const now = new Date();
      const year = now.getFullYear();
      const month = String(now.getMonth() + 1).padStart(2, "0");
      const lastRequest = await db.maintenanceRequest.findFirst({
        where: {
          requestNumber: {
            startsWith: `MR-${year}${month}-`,
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      let sequence = 1;
      if (lastRequest) {
        const lastSequence = parseInt(lastRequest.requestNumber.split("-")[2]);
        sequence = lastSequence + 1;
      }
      const requestNumber = `MR-${year}${month}-${String(sequence).padStart(4, "0")}`;

      // Create maintenance request
      const maintenanceRequest = await db.maintenanceRequest.create({
        data: {
          requestNumber,
          customerId: customer.id,
          propertyManagerId: customer.propertyManagerId,
          title: input.title,
          description: input.description,
          buildingName: input.buildingName || undefined,
          address: customer.address,
          urgency: input.urgency,
          category: input.category,
          recipientType: input.recipientType,
          recipientId: input.contractorId || undefined,
          photos: input.photos || [],
          status: "SUBMITTED",
          submittedDate: new Date(),
          receivedDate: new Date(),
        },
        include: {
          customer: true,
        },
      });

      // Send notification based on recipient type
      if (input.recipientType === "PM") {
        // Notify property manager
        await createNotification({
          recipientId: customer.propertyManagerId,
          recipientRole: "PROPERTY_MANAGER",
          message: `New ${input.urgency.toLowerCase()} maintenance request from ${customer.firstName} ${customer.lastName}: ${input.title}`,
          type: "MAINTENANCE_REQUEST_SUBMITTED",
          relatedEntityId: maintenanceRequest.id,
          relatedEntityType: "MAINTENANCE_REQUEST",
        });
      } else if (input.recipientType === "CONTRACTOR" && input.contractorId) {
        // Notify contractor
        const contractor = await db.contractor.findUnique({
          where: { id: input.contractorId },
          include: { user: true },
        });

        if (contractor?.user?.id) {
          await createNotification({
            recipientId: contractor.user.id,
            recipientRole: "CONTRACTOR",
            message: `New maintenance request from ${customer.firstName} ${customer.lastName}: ${input.title}`,
            type: "MAINTENANCE_REQUEST_SUBMITTED",
            relatedEntityId: maintenanceRequest.id,
            relatedEntityType: "MAINTENANCE_REQUEST",
          });
        }
      }

      // Notify customer
      await createNotification({
        recipientId: customer.userId,
        recipientRole: "CUSTOMER",
        message: `Your maintenance request "${input.title}" has been submitted successfully.`,
        type: "MAINTENANCE_REQUEST_SUBMITTED",
        relatedEntityId: maintenanceRequest.id,
        relatedEntityType: "MAINTENANCE_REQUEST",
      });

      return maintenanceRequest;
    } catch (error) {
      console.error("Error submitting maintenance request:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to submit maintenance request.",
      });
    }
  });
