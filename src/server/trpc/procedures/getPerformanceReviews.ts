import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getPerformanceReviews = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number().optional(),
      status: z.enum(["DRAFT", "PENDING_EMPLOYEE_ACKNOWLEDGMENT", "COMPLETED", "ARCHIVED"]).optional(),
      reviewerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    // Build where clause
    const where: any = {};
    if (input.employeeId) {
      where.employeeId = input.employeeId;
    }
    if (input.status) {
      where.status = input.status;
    }
    if (input.reviewerId) {
      where.reviewerId = input.reviewerId;
    }

    // Fetch reviews
    const reviews = await db.performanceReview.findMany({
      where,
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
      orderBy: {
        reviewDate: "desc",
      },
    });

    return reviews;
  });
