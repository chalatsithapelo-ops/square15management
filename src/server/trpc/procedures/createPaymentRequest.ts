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

      // Cross-check: if this artisan is on the crew of the referenced orders,
      // prefer the OrderCrew rate snapshot (captured at join time) as the
      // authoritative rate. If the submitted rate differs, note it.
      let hourlyRate = input.hourlyRate;
      let dailyRate = input.dailyRate;
      let rateMismatchNote = "";
      if (input.orderIds && input.orderIds.length > 0) {
        const crewSnapshots = await db.orderCrew.findMany({
          where: {
            userId: input.artisanId,
            orderId: { in: input.orderIds },
          },
          select: { orderId: true, role: true, hourlyRate: true, dailyRate: true },
        });
        if (crewSnapshots.length > 0) {
          // Use the first non-null snapshot for a rate slot the caller didn't supply
          const snapHourly = crewSnapshots.find((c) => c.hourlyRate != null)?.hourlyRate ?? null;
          const snapDaily = crewSnapshots.find((c) => c.dailyRate != null)?.dailyRate ?? null;
          if (hourlyRate == null && snapHourly != null) hourlyRate = snapHourly;
          if (dailyRate == null && snapDaily != null) dailyRate = snapDaily;
          // Flag mismatches so admins can audit later
          if (input.hourlyRate != null && snapHourly != null && Math.abs(input.hourlyRate - snapHourly) > 0.01) {
            rateMismatchNote += ` [Hourly rate mismatch: submitted R${input.hourlyRate}/hr vs crew snapshot R${snapHourly}/hr]`;
          }
          if (input.dailyRate != null && snapDaily != null && Math.abs(input.dailyRate - snapDaily) > 0.01) {
            rateMismatchNote += ` [Daily rate mismatch: submitted R${input.dailyRate}/day vs crew snapshot R${snapDaily}/day]`;
          }
        }
      }

      const paymentRequest = await db.paymentRequest.create({
        data: {
          requestNumber,
          artisanId: input.artisanId,
          orderIds: input.orderIds,
          hoursWorked: input.hoursWorked || null,
          daysWorked: input.daysWorked || null,
          hourlyRate: hourlyRate || null,
          dailyRate: dailyRate || null,
          calculatedAmount: input.calculatedAmount,
          notes: (input.notes || "") + rateMismatchNote || null,
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
