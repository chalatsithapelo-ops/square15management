import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const createAsset = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.string().min(1),
      serialNumber: z.string().optional(),
      purchaseDate: z.string(),
      purchasePrice: z.number(),
      currentValue: z.number(),
      condition: z.string().min(1),
      location: z.string().optional(),
      notes: z.string().optional(),
      images: z.array(z.string()).default([]),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_ASSETS);

    const asset = await db.asset.create({
      data: {
        createdById: user.id,
        name: input.name,
        description: input.description || null,
        category: input.category,
        serialNumber: input.serialNumber || null,
        purchaseDate: new Date(input.purchaseDate),
        purchasePrice: input.purchasePrice,
        currentValue: input.currentValue,
        condition: input.condition,
        location: input.location || null,
        notes: input.notes || null,
        images: input.images,
      },
    });

    return asset;
  });
