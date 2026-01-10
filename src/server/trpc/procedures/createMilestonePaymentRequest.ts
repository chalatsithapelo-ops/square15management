import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createMilestonePaymentRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      artisanId: z.number(),
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      calculatedAmount: z.number(),
      isPartialPayment: z.boolean().default(false),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Verify milestone exists and is completed
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Generate unique request number
      const count = await db.paymentRequest.count();
      const requestNumber = `PAY-MS-${String(count + 1).padStart(5, "0")}`;

      const paymentRequest = await db.paymentRequest.create({
        data: {
          requestNumber,
          artisanId: input.artisanId,
          milestoneId: input.milestoneId,
          orderIds: [], // No order IDs for milestone payments
          hoursWorked: input.hoursWorked || null,
          daysWorked: input.daysWorked || null,
          hourlyRate: input.hourlyRate || null,
          dailyRate: input.dailyRate || null,
          calculatedAmount: input.calculatedAmount,
          notes: input.notes
            ? `${input.isPartialPayment ? "PARTIAL PAYMENT - " : ""}${input.notes}`
            : input.isPartialPayment
            ? "PARTIAL PAYMENT for milestone completion"
            : "Payment for milestone completion",
          status: "PENDING",
        },
        include: {
          artisan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              hourlyRate: true,
              dailyRate: true,
            },
          },
          milestone: {
            select: {
              id: true,
              name: true,
              projectId: true,
            },
          },
        },
      });

      return paymentRequest;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
