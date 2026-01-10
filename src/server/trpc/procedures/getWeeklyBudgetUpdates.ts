import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getWeeklyBudgetUpdates = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const updates = await db.weeklyBudgetUpdate.findMany({
        where: {
          milestoneId: input.milestoneId,
        },
        orderBy: {
          weekStartDate: "asc",
        },
      });

      return updates;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
