import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const deleteMilestoneRisk = baseProcedure
  .input(
    z.object({
      token: z.string(),
      riskId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Check if risk exists
      const existingRisk = await db.milestoneRisk.findUnique({
        where: { id: input.riskId },
      });

      if (!existingRisk) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Risk not found",
        });
      }

      await db.milestoneRisk.delete({
        where: { id: input.riskId },
      });

      return { success: true };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
