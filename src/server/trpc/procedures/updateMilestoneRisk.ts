import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateMilestoneRisk = baseProcedure
  .input(
    z.object({
      token: z.string(),
      riskId: z.number(),
      riskDescription: z.string().min(1).optional(),
      riskCategory: z.enum(["TECHNICAL", "FINANCIAL", "SCHEDULE", "RESOURCE", "EXTERNAL"]).optional(),
      probability: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      impact: z.enum(["LOW", "MEDIUM", "HIGH"]).optional(),
      mitigationStrategy: z.string().optional(),
      status: z.enum(["OPEN", "MITIGATED", "CLOSED"]).optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

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

      // Build update data
      const updateData: any = {};
      
      if (input.riskDescription !== undefined) {
        updateData.riskDescription = input.riskDescription;
      }
      if (input.riskCategory !== undefined) {
        updateData.riskCategory = input.riskCategory;
      }
      if (input.probability !== undefined) {
        updateData.probability = input.probability;
      }
      if (input.impact !== undefined) {
        updateData.impact = input.impact;
      }
      if (input.mitigationStrategy !== undefined) {
        updateData.mitigationStrategy = input.mitigationStrategy || null;
      }
      if (input.status !== undefined) {
        updateData.status = input.status;
      }

      const updatedRisk = await db.milestoneRisk.update({
        where: { id: input.riskId },
        data: updateData,
      });

      return updatedRisk;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
