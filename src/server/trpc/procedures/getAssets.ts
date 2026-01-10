import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getAssets = baseProcedure
  .input(
    z.object({
      token: z.string(),
      category: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Contractors see only their company assets (when owner field is added)
    // For now, all users with VIEW_ASSETS permission see all assets
    // TODO: Add ownerId field to Asset model for proper data isolation
    if (user.role !== "CONTRACTOR") {
      requirePermission(user, PERMISSIONS.VIEW_ASSETS);
    }

    const assets = await db.asset.findMany({
      where: input.category ? { category: input.category } : undefined,
      orderBy: {
        createdAt: "desc",
      },
    });

    return assets;
  });
