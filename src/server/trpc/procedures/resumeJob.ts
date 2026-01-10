import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const resumeJob = baseProcedure
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
        message: "Only artisans can resume jobs",
      });
    }

    // Fetch the order
    const order = await db.order.findUnique({
      where: { id: input.orderId },
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
        message: "You can only resume jobs assigned to you",
      });
    }

    // Verify the order is in progress
    if (order.status !== "IN_PROGRESS") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only jobs in progress can be resumed",
      });
    }

    // Verify the order is currently paused
    if (!order.isPaused) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Job is not paused",
      });
    }

    const now = new Date();

    // Create a new job activity to track the resumed work
    await db.jobActivity.create({
      data: {
        orderId: input.orderId,
        artisanId: user.id,
        startTime: now,
        description: "Resumed work",
      },
    });

    // Update the order to mark it as no longer paused
    const updatedOrder = await db.order.update({
      where: { id: input.orderId },
      data: {
        isPaused: false,
        pausedAt: null,
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
