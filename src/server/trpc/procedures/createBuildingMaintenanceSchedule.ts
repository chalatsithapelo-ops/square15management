import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createBuildingMaintenanceSchedule = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number(),
      title: z.string(),
      description: z.string(),
      maintenanceType: z.enum(["PREVENTATIVE", "REACTIVE", "CORRECTIVE"]),
      category: z.string(),
      frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "ANNUALLY", "ONE_TIME"]),
      startDate: z.string().datetime(),
      endDate: z.string().datetime().optional(),
      nextDueDate: z.string().datetime(),
      estimatedCost: z.number().min(0).optional(),
      budgetAllocated: z.number().min(0).optional(),
      notifyDaysBefore: z.number().min(0).default(7),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    // Verify user is a property manager
    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can create maintenance schedules",
      });
    }

    // Verify the building exists and belongs to the property manager
    const building = await db.building.findUnique({
      where: { id: input.buildingId },
    });

    if (!building) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Building not found",
      });
    }

    if (building.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only create maintenance schedules for your own buildings",
      });
    }

    // Create the maintenance schedule
    const schedule = await db.buildingMaintenanceSchedule.create({
      data: {
        buildingId: input.buildingId,
        propertyManagerId: user.id,
        title: input.title,
        description: input.description,
        maintenanceType: input.maintenanceType,
        category: input.category,
        frequency: input.frequency,
        startDate: new Date(input.startDate),
        endDate: input.endDate ? new Date(input.endDate) : null,
        nextDueDate: new Date(input.nextDueDate),
        estimatedCost: input.estimatedCost,
        budgetAllocated: input.budgetAllocated,
        notifyDaysBefore: input.notifyDaysBefore,
        status: "ACTIVE",
        notes: input.notes,
      },
      include: {
        building: true,
      },
    });

    return schedule;
  });
