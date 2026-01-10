import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantMaintenanceRequests = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
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

    const maintenanceRequests = await db.propertyManagerMaintenanceRequest.findMany({
      where: {
        customerId: input.customerId,
        status: input.status,
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phoneNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return maintenanceRequests;
  });
