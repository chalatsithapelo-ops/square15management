import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createChangeOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      milestoneId: z.number().optional(),
      title: z.string().min(1),
      description: z.string().min(1),
      reason: z.string().min(1),
      costImpact: z.number().default(0),
      timeImpact: z.number().default(0), // Days
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Generate unique change order number
      const count = await db.changeOrder.count();
      const changeOrderNumber = `CO-${String(count + 1).padStart(5, "0")}`;

      const changeOrder = await db.changeOrder.create({
        data: {
          changeOrderNumber,
          projectId: input.projectId,
          milestoneId: input.milestoneId || null,
          title: input.title,
          description: input.description,
          reason: input.reason,
          costImpact: input.costImpact,
          timeImpact: input.timeImpact,
          requestedById: parsed.userId,
          notes: input.notes || null,
          status: "PENDING",
        },
      });

      return changeOrder;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
