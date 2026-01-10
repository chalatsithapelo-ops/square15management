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
    
    // Contractors see only their company liabilities (when owner field is added)
    // For now, all users with VIEW_LIABILITIES permission see all liabilities
    // TODO: Add ownerId field to Liability model for proper data isolation
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_LIABILITIES);
    }

    const liabilities = await db.liability.findMany({
      where: input.isPaid !== undefined ? { isPaid: input.isPaid } : undefined,
      orderBy: {
        createdAt: "desc",
      },
    });

    return liabilities;
  });
