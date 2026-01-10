import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const createPerformanceReview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      reviewPeriodStart: z.string(),
      reviewPeriodEnd: z.string(),
      reviewDate: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    // Verify employee exists
    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    // Create the performance review
    const review = await db.performanceReview.create({
      data: {
        employeeId: input.employeeId,
        reviewerId: user.id,
        reviewPeriodStart: new Date(input.reviewPeriodStart),
        reviewPeriodEnd: new Date(input.reviewPeriodEnd),
        reviewDate: input.reviewDate ? new Date(input.reviewDate) : new Date(),
        status: "DRAFT",
        notes: input.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        reviewer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      success: true,
      review,
    };
  });
