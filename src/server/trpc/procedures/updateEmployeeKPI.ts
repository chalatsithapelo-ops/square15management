import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const updateEmployeeKPI = baseProcedure
  .input(
    z.object({
      token: z.string(),
      kpiId: z.number(),
      actualValue: z.number().optional(),
      status: z.enum(["ACTIVE", "INACTIVE", "ARCHIVED"]).optional(),
      notes: z.string().optional(),
      markAsReviewed: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const kpi = await db.employeeKPI.findUnique({
      where: { id: input.kpiId },
    });

    if (!kpi) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "KPI not found",
      });
    }

    // Calculate achievement rate if actualValue is provided
    let achievementRate = kpi.achievementRate;
    if (input.actualValue !== undefined) {
      achievementRate = kpi.targetValue > 0 
        ? (input.actualValue / kpi.targetValue) * 100 
        : 0;
    }

    const updatedKPI = await db.employeeKPI.update({
      where: { id: input.kpiId },
      data: {
        actualValue: input.actualValue,
        achievementRate,
        status: input.status,
        notes: input.notes,
        reviewedById: input.markAsReviewed ? user.id : undefined,
        reviewedAt: input.markAsReviewed ? new Date() : undefined,
      },
    });

    return updatedKPI;
  });
