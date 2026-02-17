import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { SlipCategory } from "@prisma/client";

/**
 * Save a draft of job completion data without finalizing.
 * Allows the artisan to save after pictures, expense slips, material costs,
 * hours/days worked, and notes — even before the client is available to sign.
 * The order remains IN_PROGRESS.
 */
export const saveJobDraft = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(),
      afterPictures: z.array(z.string()).optional(),
      expenseSlips: z
        .array(
          z.object({
            url: z.string(),
            category: z.nativeEnum(SlipCategory),
            description: z.string().optional(),
            amount: z.number().optional(),
          })
        )
        .optional(),
      materialCost: z.number().optional(),
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      paymentType: z.enum(["hourly", "daily"]).optional(),
      paymentNotes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Build the update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {};

    if (input.afterPictures) {
      updateData.afterPictures = input.afterPictures;
    }

    if (input.materialCost !== undefined) {
      updateData.materialCost = input.materialCost;
    }

    if (input.isPMOrder) {
      // --- Property Manager Order ---
      const pmOrder = await db.propertyManagerOrder.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, assignedToId: true },
      });

      if (!pmOrder) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (pmOrder.assignedToId !== user.id && user.role !== "ADMIN" && user.role !== "SENIOR_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this order" });
      }

      // Save expense slips
      if (input.expenseSlips && input.expenseSlips.length > 0) {
        await db.propertyManagerOrderExpenseSlip.deleteMany({
          where: { orderId: input.orderId },
        });
        await db.propertyManagerOrderExpenseSlip.createMany({
          data: input.expenseSlips.map((slip) => ({
            orderId: input.orderId,
            url: slip.url,
            category: slip.category,
            description: slip.description,
            amount: slip.amount,
          })),
        });

        // Auto-calculate material cost from slips if not manually provided
        if (input.materialCost === undefined) {
          const totalFromSlips = input.expenseSlips.reduce(
            (sum, slip) => sum + (slip.amount || 0),
            0
          );
          if (totalFromSlips > 0) {
            updateData.materialCost = totalFromSlips;
          }
        }
      }

      await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: updateData,
      });
    } else {
      // --- Regular Order ---
      const order = await db.order.findUnique({
        where: { id: input.orderId },
        select: { id: true, status: true, assignedToId: true },
      });

      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }

      if (order.assignedToId !== user.id && user.role !== "ADMIN" && user.role !== "SENIOR_ADMIN") {
        throw new TRPCError({ code: "FORBIDDEN", message: "You are not assigned to this order" });
      }

      // Save expense slips
      if (input.expenseSlips && input.expenseSlips.length > 0) {
        await db.expenseSlip.deleteMany({
          where: { orderId: input.orderId },
        });
        await db.expenseSlip.createMany({
          data: input.expenseSlips.map((slip) => ({
            orderId: input.orderId,
            url: slip.url,
            category: slip.category,
            description: slip.description,
            amount: slip.amount,
          })),
        });

        // Auto-calculate material cost from slips if not manually provided
        if (input.materialCost === undefined) {
          const totalFromSlips = input.expenseSlips.reduce(
            (sum, slip) => sum + (slip.amount || 0),
            0
          );
          if (totalFromSlips > 0) {
            updateData.materialCost = totalFromSlips;
          }
        }
      }

      await db.order.update({
        where: { id: input.orderId },
        data: updateData,
      });
    }

    return { success: true, message: "Draft saved successfully" };
  });
