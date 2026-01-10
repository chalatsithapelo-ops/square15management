import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const updateAsset = baseProcedure
  .input(
    z.object({
      token: z.string(),
      assetId: z.number(),
      currentValue: z.number().optional(),
      condition: z.string().optional(),
      location: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_ASSETS);

    const updateData: any = {};
    if (input.currentValue !== undefined) updateData.currentValue = input.currentValue;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.notes !== undefined) updateData.notes = input.notes;

    const asset = await db.asset.update({
      where: { id: input.assetId },
      data: updateData,
    });

    return asset;
  });
