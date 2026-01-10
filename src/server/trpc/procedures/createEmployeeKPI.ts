import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const createEmployeeKPI = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      kpiName: z.string(),
      description: z.string().optional(),
      targetValue: z.number(),
      unit: z.string(),
      frequency: z.enum(["DAILY", "WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]),
      periodStart: z.string(),
      periodEnd: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    const kpi = await db.employeeKPI.create({
      data: {
        employeeId: input.employeeId,
        kpiName: input.kpiName,
        description: input.description,
        targetValue: input.targetValue,
        unit: input.unit,
        frequency: input.frequency,
        periodStart: new Date(input.periodStart),
        periodEnd: new Date(input.periodEnd),
        notes: input.notes,
      },
    });

    return kpi;
  });
