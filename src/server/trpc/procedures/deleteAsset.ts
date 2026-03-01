import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deleteAsset = baseProcedure
  .input(
    z.object({
      token: z.string(),
      assetId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete assets");
    requirePermission(user, PERMISSIONS.MANAGE_ASSETS);

    // Contractors can only delete their own assets
    if (user.role === "CONTRACTOR") {
      const asset = await db.asset.findFirst({
        where: { id: input.assetId, createdById: user.id },
        select: { id: true },
      });
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found or you don't have permission to delete it.",
        });
      }
    } else {
      const asset = await db.asset.findUnique({
        where: { id: input.assetId },
        select: { id: true },
      });
      if (!asset) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Asset not found.",
        });
      }
    }

    await db.asset.delete({
      where: { id: input.assetId },
    });

    return { success: true, message: "Asset deleted successfully." };
  });
