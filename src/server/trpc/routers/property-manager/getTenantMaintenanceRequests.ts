import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantMaintenanceRequests = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
      status: z
        .enum([
          // Current workflow
          "DRAFT",
          "SUBMITTED",
          "RECEIVED",
          "APPROVED",
          "REJECTED",
          "CONVERTED",
          // Legacy values (keep for backward compatibility)
          "PENDING",
          "IN_PROGRESS",
          "COMPLETED",
          "CANCELLED",
        ])
        .optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;

    // Verify tenant belongs to this PM
    const tenant = await db.propertyManagerCustomer.findFirst({
      where: {
        id: input.customerId,
        propertyManagerId: userId,
      },
    });

    if (!tenant) {
      return [];
    }

    const maintenanceRequests = await db.maintenanceRequest.findMany({
      where: {
        customerId: input.customerId,
        propertyManagerId: userId,
        status: input.status,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            buildingName: true,
            unitNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return maintenanceRequests;
  });
