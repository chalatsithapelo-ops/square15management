import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const updateBuildingBudget = baseProcedure
  .input(
    z.object({
      token: z.string(),
      budgetId: z.number(),
      preventativeMaintenance: z.number().min(0).optional(),
      reactiveMaintenance: z.number().min(0).optional(),
      correctiveMaintenance: z.number().min(0).optional(),
      capitalExpenditures: z.number().min(0).optional(),
      utilities: z.number().min(0).optional(),
      insurance: z.number().min(0).optional(),
      propertyTax: z.number().min(0).optional(),
      other: z.number().min(0).optional(),
      status: z.enum(["DRAFT", "APPROVED", "ACTIVE", "CLOSED"]).optional(),
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
        message: "Only property managers can update building budgets",
      });
    }

    // Verify the budget exists and belongs to the property manager
    const existingBudget = await db.buildingBudget.findUnique({
      where: { id: input.budgetId },
    });

    if (!existingBudget) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Budget not found",
      });
    }

    if (existingBudget.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only update your own budgets",
      });
    }

    // Prepare update data
    const updateData: any = {};

    if (input.preventativeMaintenance !== undefined) {
      updateData.preventativeMaintenance = input.preventativeMaintenance;
    }
    if (input.reactiveMaintenance !== undefined) {
      updateData.reactiveMaintenance = input.reactiveMaintenance;
    }
    if (input.correctiveMaintenance !== undefined) {
      updateData.correctiveMaintenance = input.correctiveMaintenance;
    }
    if (input.capitalExpenditures !== undefined) {
      updateData.capitalExpenditures = input.capitalExpenditures;
    }
    if (input.utilities !== undefined) {
      updateData.utilities = input.utilities;
    }
    if (input.insurance !== undefined) {
      updateData.insurance = input.insurance;
    }
    if (input.propertyTax !== undefined) {
      updateData.propertyTax = input.propertyTax;
    }
    if (input.other !== undefined) {
      updateData.other = input.other;
    }
    if (input.status !== undefined) {
      updateData.status = input.status;
    }
    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    // Recalculate total budget if any category changed
    if (
      input.preventativeMaintenance !== undefined ||
      input.reactiveMaintenance !== undefined ||
      input.correctiveMaintenance !== undefined ||
      input.capitalExpenditures !== undefined ||
      input.utilities !== undefined ||
      input.insurance !== undefined ||
      input.propertyTax !== undefined ||
      input.other !== undefined
    ) {
      const totalBudget =
        (input.preventativeMaintenance ?? existingBudget.preventativeMaintenance) +
        (input.reactiveMaintenance ?? existingBudget.reactiveMaintenance) +
        (input.correctiveMaintenance ?? existingBudget.correctiveMaintenance) +
        (input.capitalExpenditures ?? existingBudget.capitalExpenditures) +
        (input.utilities ?? existingBudget.utilities) +
        (input.insurance ?? existingBudget.insurance) +
        (input.propertyTax ?? existingBudget.propertyTax) +
        (input.other ?? existingBudget.other);

      updateData.totalBudget = totalBudget;
      updateData.totalRemaining = totalBudget - existingBudget.totalSpent;
    }

    // Update the budget
    const budget = await db.buildingBudget.update({
      where: { id: input.budgetId },
      data: updateData,
      include: {
        building: true,
        expenses: {
          orderBy: {
            expenseDate: "desc",
          },
        },
      },
    });

    return budget;
  });
