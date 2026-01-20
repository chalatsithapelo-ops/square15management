import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { LiabilityCategory } from "@prisma/client";

export const createLiability = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      category: z.nativeEnum(LiabilityCategory),
      amount: z.number().positive(),
      dueDate: z.string().optional(),
      creditor: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_LIABILITIES);

    const liability = await db.liability.create({
      data: {
        createdById: user.id,
        name: input.name,
        description: input.description || null,
        category: input.category,
        amount: input.amount,
        dueDate: input.dueDate ? new Date(input.dueDate) : null,
        creditor: input.creditor || null,
        referenceNumber: input.referenceNumber || null,
        notes: input.notes || null,
      },
    });

    return liability;
  });
