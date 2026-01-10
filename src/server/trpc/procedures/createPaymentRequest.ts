import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createPaymentRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      artisanId: z.number(),
      orderIds: z.array(z.number()),
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      calculatedAmount: z.number(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Generate unique request number
      const count = await db.paymentRequest.count();
      const requestNumber = `PAY-${String(count + 1).padStart(5, "0")}`;

      const paymentRequest = await db.paymentRequest.create({
        data: {
          requestNumber,
          artisanId: input.artisanId,
          orderIds: input.orderIds,
          hoursWorked: input.hoursWorked || null,
          daysWorked: input.daysWorked || null,
          hourlyRate: input.hourlyRate || null,
          dailyRate: input.dailyRate || null,
          calculatedAmount: input.calculatedAmount,
          notes: input.notes || null,
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
        },
      });

      return paymentRequest;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
