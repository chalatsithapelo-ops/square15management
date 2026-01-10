import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const updateOperationalExpense = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      description: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      vendor: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      documentUrl: z.string().optional(),
      category: z.enum([
        "PETROL",
        "OFFICE_SUPPLIES",
        "RENT",
        "UTILITIES",
        "INSURANCE",
        "SALARIES",
        "MARKETING",
        "MAINTENANCE",
        "TRAVEL",
        "PROFESSIONAL_FEES",
        "TELECOMMUNICATIONS",
        "SOFTWARE_SUBSCRIPTIONS",
        "OTHER",
      ]).optional(),
      isRecurring: z.boolean().optional(),
      recurringPeriod: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Verify expense exists
    const existingExpense = await db.operationalExpense.findUnique({
      where: { id: input.id },
    });

    if (!existingExpense) {
      throw new Error("Operational expense not found");
    }

    // Only allow senior users to edit or the creator before approval
    const isSeniorUser =
      user.role === "SENIOR_ADMIN" || user.role === "SENIOR_CONTRACTOR_MANAGER";
    const isCreator = existingExpense.createdById === user.id;
    const isApproved = existingExpense.isApproved;

    if (!isSeniorUser && (isApproved || !isCreator)) {
      throw new Error("You do not have permission to edit this expense");
    }

    // Update the expense
    const updatedExpense = await db.operationalExpense.update({
      where: { id: input.id },
      data: {
        description: input.description,
        amount: input.amount,
        vendor: input.vendor,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        documentUrl: input.documentUrl,
        category: input.category,
        isRecurring: input.isRecurring,
        recurringPeriod: input.recurringPeriod,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedExpense;
  });
