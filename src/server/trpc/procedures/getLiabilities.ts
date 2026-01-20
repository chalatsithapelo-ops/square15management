import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getLiabilities = baseProcedure
  .input(
    z.object({
      token: z.string(),
      isPaid: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Data isolation:
    // - Contractors only see liabilities they created
    // - Other roles keep existing permission-based access
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_LIABILITIES);
    }

    const where: any = {};
    if (user.role === "CONTRACTOR") where.createdById = user.id;
    if (input.isPaid !== undefined) where.isPaid = input.isPaid;

    const liabilities = await db.liability.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return liabilities;
  });
