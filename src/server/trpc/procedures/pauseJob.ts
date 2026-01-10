import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const pauseJob = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    // Verify user is an artisan
    if (user.role !== "ARTISAN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only artisans can pause jobs",
      });
    }

    // Fetch the order
    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: {
        jobActivities: {
          orderBy: {
            startTime: "desc",
          },
        },
      },
    });

    if (!order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }

    // Verify the order is assigned to this artisan
    if (order.assignedToId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only pause jobs assigned to you",
      });
    }

    // Verify the order is in progress
    if (order.status !== "IN_PROGRESS") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only jobs in progress can be paused",
      });
    }

    // Verify the order is not already paused
    if (order.isPaused) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Job is already paused",
      });
    }

    const now = new Date();

    // Find the most recent job activity with no end time
    const activeJobActivity = order.jobActivities.find(
      (activity) => activity.endTime === null
    );

    // Close the active job activity if it exists
    if (activeJobActivity) {
      const durationMinutes = Math.floor(
        (now.getTime() - activeJobActivity.startTime.getTime()) / (1000 * 60)
      );

      await db.jobActivity.update({
        where: { id: activeJobActivity.id },
        data: {
          endTime: now,
          durationMinutes,
        },
      });
    }

    // Update the order to mark it as paused
    const updatedOrder = await db.order.update({
      where: { id: input.orderId },
      data: {
        isPaused: true,
        pausedAt: now,
      },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        materials: true,
        jobActivities: true,
        expenseSlips: true,
      },
    });

    return updatedOrder;
  });
