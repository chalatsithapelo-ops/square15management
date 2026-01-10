import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createBuildingBudget = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number(),
      fiscalYear: z.number(),
      quarter: z.number().min(1).max(4).optional(),
      startDate: z.string().datetime(),
      endDate: z.string().datetime(),
      preventativeMaintenance: z.number().min(0).default(0),
      reactiveMaintenance: z.number().min(0).default(0),
      correctiveMaintenance: z.number().min(0).default(0),
      capitalExpenditures: z.number().min(0).default(0),
      utilities: z.number().min(0).default(0),
      insurance: z.number().min(0).default(0),
      propertyTax: z.number().min(0).default(0),
      other: z.number().min(0).default(0),
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
        message: "Only property managers can create building budgets",
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
        message: "You can only create budgets for your own buildings",
      });
    }

    // Calculate total budget
    const totalBudget =
      input.preventativeMaintenance +
      input.reactiveMaintenance +
      input.correctiveMaintenance +
      input.capitalExpenditures +
      input.utilities +
      input.insurance +
      input.propertyTax +
      input.other;

    // Create the budget
    const budget = await db.buildingBudget.create({
      data: {
        buildingId: input.buildingId,
        propertyManagerId: user.id,
        fiscalYear: input.fiscalYear,
        quarter: input.quarter,
        startDate: new Date(input.startDate),
        endDate: new Date(input.endDate),
        preventativeMaintenance: input.preventativeMaintenance,
        reactiveMaintenance: input.reactiveMaintenance,
        correctiveMaintenance: input.correctiveMaintenance,
        capitalExpenditures: input.capitalExpenditures,
        utilities: input.utilities,
        insurance: input.insurance,
        propertyTax: input.propertyTax,
        other: input.other,
        totalBudget,
        totalSpent: 0,
        totalRemaining: totalBudget,
        status: "DRAFT",
        notes: input.notes,
      },
      include: {
        building: true,
      },
    });

    return budget;
  });
