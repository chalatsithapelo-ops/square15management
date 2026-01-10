import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";

export const createMaintenanceRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
      title: z.string().min(3),
      description: z.string().min(10),
      photos: z.array(z.string()).optional(),
      urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
      category: z.string().min(2),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    try {
      // Verify customer exists and get property manager info
      const customer = await db.propertyManagerCustomer.findUnique({
        where: { id: input.customerId },
        include: {
          propertyManager: true,
        },
      });

      if (!customer) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Customer not found.",
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
          customerId: input.customerId,
          propertyManagerId: customer.propertyManagerId,
          title: input.title,
          description: input.description,
          buildingName: customer.buildingName || undefined,
          unitNumber: customer.unitNumber || undefined,
          address: customer.address,
          urgency: input.urgency,
          category: input.category,
          photos: input.photos || [],
          status: "SUBMITTED",
        },
        include: {
          customer: true,
        },
      });

      // Notify property manager
      await createNotification({
        recipientId: customer.propertyManagerId,
        recipientRole: "PROPERTY_MANAGER",
        message: `New ${input.urgency.toLowerCase()} maintenance request from ${customer.firstName} ${customer.lastName}: ${input.title}`,
        type: "MAINTENANCE_REQUEST_SUBMITTED",
        relatedEntityId: maintenanceRequest.id,
        relatedEntityType: "MAINTENANCE_REQUEST",
      });

      return maintenanceRequest;
    } catch (error) {
      console.error("Error creating maintenance request:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create maintenance request.",
      });
    }
  });
