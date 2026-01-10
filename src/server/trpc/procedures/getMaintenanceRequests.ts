import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getMaintenanceRequests = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
      propertyManagerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userIsAdmin = isAdmin(user);

    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers and Admins can view maintenance requests.",
      });
    }

    const where: any = {};

    // Property managers can only see requests from their properties
    if (!userIsAdmin) {
      where.propertyManagerId = user.id;
    } else if (input.propertyManagerId) {
      // Admins can filter by property manager
      where.propertyManagerId = input.propertyManagerId;
    }

    if (input.status) {
      where.status = input.status;
    }

    const requests = await db.maintenanceRequest.findMany({
      where,
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

    return requests;
  });
