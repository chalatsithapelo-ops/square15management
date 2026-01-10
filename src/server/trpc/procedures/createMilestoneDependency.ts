import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createMilestoneDependency = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fromMilestoneId: z.number(),
      toMilestoneId: z.number(),
      dependencyType: z.enum(["FINISH_TO_START", "START_TO_START", "FINISH_TO_FINISH", "START_TO_FINISH"]).default("FINISH_TO_START"),
      lagDays: z.number().default(0),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Prevent self-dependency
      if (input.fromMilestoneId === input.toMilestoneId) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "A milestone cannot depend on itself",
        });
      }

      const dependency = await db.milestoneDependency.create({
        data: {
          fromMilestoneId: input.fromMilestoneId,
          toMilestoneId: input.toMilestoneId,
          dependencyType: input.dependencyType,
          lagDays: input.lagDays,
        },
        include: {
          fromMilestone: {
            select: {
              id: true,
              name: true,
            },
          },
          toMilestone: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      });

      return dependency;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
