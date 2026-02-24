import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { isRestrictedDemoAccount } from "~/server/utils/demoAccounts";

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

    // Demo accounts should not see production data
    if (isRestrictedDemoAccount(user)) {
      return [];
    }

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

    // Data isolation:
    // - Contractors only see their own alternative revenues
    // - Admins keep existing role-based filtering
    if (user.role === "CONTRACTOR") {
      where.createdById = user.id;
    } else {
      where.createdBy = {
        role: {
          contains: user.role.includes("ADMIN") ? "ADMIN" : "CONTRACTOR",
        },
      };
    }

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
