import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { isRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const getAssets = baseProcedure
  .input(
    z.object({
      token: z.string(),
      category: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Demo accounts should not see production data
    if (isRestrictedDemoAccount(user)) {
      return [];
    }

    // Data isolation:
    // - Contractors only see assets they created
    // - Other roles keep existing permission-based access
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_ASSETS);
    }

    const where: any = {};
    if (user.role === "CONTRACTOR") where.createdById = user.id;
    if (input.category) where.category = input.category;

    const assets = await db.asset.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return assets;
  });
