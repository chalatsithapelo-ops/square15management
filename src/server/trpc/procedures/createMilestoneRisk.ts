import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createMilestoneRisk = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      riskDescription: z.string().min(1),
      riskCategory: z.enum(["TECHNICAL", "FINANCIAL", "SCHEDULE", "RESOURCE", "EXTERNAL"]),
      probability: z.enum(["LOW", "MEDIUM", "HIGH"]),
      impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
      mitigationStrategy: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const risk = await db.milestoneRisk.create({
        data: {
          milestoneId: input.milestoneId,
          riskDescription: input.riskDescription,
          riskCategory: input.riskCategory,
          probability: input.probability,
          impact: input.impact,
          mitigationStrategy: input.mitigationStrategy || null,
          identifiedById: parsed.userId,
          status: "OPEN",
        },
      });

      return risk;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
