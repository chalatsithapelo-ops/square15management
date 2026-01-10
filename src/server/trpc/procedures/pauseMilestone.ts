import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const pauseMilestone = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get the milestone
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Check if user is assigned to this milestone
      if (milestone.assignedToId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this milestone",
        });
      }

      // Check if milestone is in progress
      if (milestone.status !== "IN_PROGRESS") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Milestone must be in progress to pause",
        });
      }

      // Update milestone to paused status
      const updatedMilestone = await db.milestone.update({
        where: { id: input.milestoneId },
        data: {
          status: "ON_HOLD",
          notes: milestone.notes 
            ? `${milestone.notes}\n\nPaused at ${new Date().toISOString()}`
            : `Paused at ${new Date().toISOString()}`,
        },
      });

      return updatedMilestone;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
