import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const createBudgetExpense = baseProcedure
  .input(
    z.object({
      token: z.string(),
      budgetId: z.number(),
      description: z.string(),
      category: z.enum([
        "preventativeMaintenance",
        "reactiveMaintenance",
        "correctiveMaintenance",
        "capitalExpenditures",
        "utilities",
        "insurance",
        "propertyTax",
        "other",
      ]),
      amount: z.number().min(0),
      expenseDate: z.string().datetime(),
      referenceType: z.string().optional(),
      referenceId: z.number().optional(),
      receiptUrl: z.string().optional(),
      invoiceUrl: z.string().optional(),
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
        message: "Only property managers can add budget expenses",
      });
    }

    // Verify the budget exists and belongs to the property manager
    const budget = await db.buildingBudget.findUnique({
      where: { id: input.budgetId },
    });

    if (!budget) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Budget not found",
      });
    }

    if (budget.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only add expenses to your own budgets",
      });
    }

    // Create the expense and update budget totals in a transaction
    const result = await db.$transaction(async (tx) => {
      // Create the expense
      const expense = await tx.budgetExpense.create({
        data: {
          budgetId: input.budgetId,
          description: input.description,
          category: input.category,
          amount: input.amount,
          expenseDate: new Date(input.expenseDate),
          referenceType: input.referenceType,
          referenceId: input.referenceId,
          receiptUrl: input.receiptUrl,
          invoiceUrl: input.invoiceUrl,
          notes: input.notes,
        },
      });

      // Update budget totals
      const newTotalSpent = budget.totalSpent + input.amount;
      const newTotalRemaining = budget.totalBudget - newTotalSpent;

      await tx.buildingBudget.update({
        where: { id: input.budgetId },
        data: {
          totalSpent: newTotalSpent,
          totalRemaining: newTotalRemaining,
        },
      });

      return expense;
    });

    return result;
  });
