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
      images: z.array(z.string()).optional(),
      name: z.string().optional(),
      description: z.string().optional(),
      category: z.string().optional(),
      serialNumber: z.string().optional(),
      purchasePrice: z.number().optional(),
      usefulLifeYears: z.number().optional(),
      residualValue: z.number().optional(),
      depreciationMethod: z.string().optional(),
      sarsWearAndTearRate: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_ASSETS);

    if (user.role === "CONTRACTOR") {
      const asset = await db.asset.findFirst({
        where: { id: input.assetId, createdById: user.id },
        select: { id: true },
      });
      if (!asset) {
        throw new Error("Asset not found");
      }
    }

    const updateData: any = {};
    if (input.currentValue !== undefined) updateData.currentValue = input.currentValue;
    if (input.condition !== undefined) updateData.condition = input.condition;
    if (input.location !== undefined) updateData.location = input.location;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.images !== undefined) updateData.images = input.images;
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.serialNumber !== undefined) updateData.serialNumber = input.serialNumber;
    if (input.purchasePrice !== undefined) updateData.purchasePrice = input.purchasePrice;
    if (input.usefulLifeYears !== undefined) updateData.usefulLifeYears = input.usefulLifeYears;
    if (input.residualValue !== undefined) updateData.residualValue = input.residualValue;
    if (input.depreciationMethod !== undefined) updateData.depreciationMethod = input.depreciationMethod;
    if (input.sarsWearAndTearRate !== undefined) updateData.sarsWearAndTearRate = input.sarsWearAndTearRate;

    const asset = await db.asset.update({
      where: { id: input.assetId },
      data: updateData,
    });

    return asset;
  });
