import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getBuildingMaintenanceSchedules = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number().optional(),
      status: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    // Verify user is a property manager
    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view maintenance schedules",
      });
    }

    // Build where clause
    const where: any = {
      propertyManagerId: user.id,
    };

    if (input.buildingId) {
      where.buildingId = input.buildingId;
    }

    if (input.status) {
      where.status = input.status;
    }

    // Fetch maintenance schedules with building details
    const schedules = await db.buildingMaintenanceSchedule.findMany({
      where,
      include: {
        building: true,
      },
      orderBy: [
        { nextDueDate: "asc" },
      ],
    });

    return schedules;
  });
