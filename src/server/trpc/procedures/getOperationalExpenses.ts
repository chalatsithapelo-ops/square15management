import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { applyDemoIsolation } from "~/server/utils/demoAccounts";

export const getOperationalExpenses = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      isApproved: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Build where clause
    const where: any = {};

    if (input.startDate && input.endDate) {
      where.date = {
        gte: new Date(input.startDate),
        lte: new Date(input.endDate),
      };
    }

    if (input.category) {
      where.category = input.category;
    }

    if (input.isApproved !== undefined) {
      where.isApproved = input.isApproved;
    }

    // Data isolation:
    // - Contractors only see their own operational expenses
    // - Admins see ALL operational expenses (company-wide view)
    if (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") {
      where.createdById = user.id;
    }
    // Admins (SENIOR_ADMIN, JUNIOR_ADMIN, TECHNICAL_MANAGER, etc.) see all expenses

    // Demo data isolation
    await applyDemoIsolation(where, user, db);

    const expenses = await db.operationalExpense.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
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
      orderBy: {
        date: "desc",
      },
    });

    return expenses;
  });
