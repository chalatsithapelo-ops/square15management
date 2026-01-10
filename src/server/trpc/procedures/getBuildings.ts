import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getBuildings = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number().optional(),
      status: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userIsAdmin = isAdmin(user);

    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers and Admins can view buildings.",
      });
    }

    const where: any = {};

    // Property managers can only see their own buildings
    if (!userIsAdmin) {
      where.propertyManagerId = user.id;
    } else if (input.propertyManagerId) {
      // Admins can filter by property manager
      where.propertyManagerId = input.propertyManagerId;
    }

    if (input.status) {
      where.status = input.status;
    }

    const buildings = await db.building.findMany({
      where,
      include: {
        propertyManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        budgets: {
          where: {
            status: "ACTIVE",
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 1,
        },
        maintenanceSchedules: {
          where: {
            status: "ACTIVE",
          },
          orderBy: {
            nextDueDate: "asc",
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return buildings;
  });
