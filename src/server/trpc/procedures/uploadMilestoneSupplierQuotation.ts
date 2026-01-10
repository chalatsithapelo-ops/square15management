import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const uploadMilestoneSupplierQuotation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      url: z.string(),
      supplierName: z.string().optional(),
      amount: z.number().optional(),
      description: z.string().optional(),
      category: z.string().default("MATERIALS"),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Verify milestone exists
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Create quotation record
      const createdQuotation = await db.milestoneSupplierQuotation.create({
        data: {
          milestoneId: input.milestoneId,
          url: input.url,
          supplierName: input.supplierName || null,
          amount: input.amount || null,
          description: input.description || null,
          category: input.category,
        },
      });

      return {
        success: true,
        quotation: createdQuotation,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
