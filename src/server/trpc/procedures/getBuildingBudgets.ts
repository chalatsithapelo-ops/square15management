import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getBuildingBudgets = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number().optional(),
      fiscalYear: z.number().optional(),
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
        message: "Only property managers can view building budgets",
      });
    }

    // Build where clause
    const where: any = {
      propertyManagerId: user.id,
    };

    if (input.buildingId) {
      where.buildingId = input.buildingId;
    }

    if (input.fiscalYear) {
      where.fiscalYear = input.fiscalYear;
    }

    if (input.status) {
      where.status = input.status;
    }

    // Fetch budgets with building details and expense counts
    const budgets = await db.buildingBudget.findMany({
      where,
      include: {
        building: true,
        expenses: {
          orderBy: {
            expenseDate: "desc",
          },
        },
      },
      orderBy: [
        { fiscalYear: "desc" },
        { startDate: "desc" },
      ],
    });

    return budgets;
  });
