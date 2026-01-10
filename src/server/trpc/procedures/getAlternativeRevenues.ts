import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getAlternativeRevenues = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      category: z.string().optional(),
      isApproved: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Build where clause
    const where: any = {};

    if (input.startDate && input.endDate) {
      where.date = {
        gte: new Date(input.startDate),
        lte: new Date(input.endDate),
      };
    }

    if (input.category) {
      where.category = input.category;
    }

    if (input.isApproved !== undefined) {
      where.isApproved = input.isApproved;
    }

    // Filter at database level based on user role
    // Admin users only see revenues created by Admin users
    // Contractor users only see revenues created by Contractor users
    where.createdBy = {
      role: {
        contains: user.role.includes("ADMIN") ? "ADMIN" : "CONTRACTOR",
      },
    };

    const revenues = await db.alternativeRevenue.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: {
        date: "desc",
      },
    });

    return revenues;
  });
