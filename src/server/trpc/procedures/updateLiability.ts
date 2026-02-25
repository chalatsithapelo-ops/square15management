import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { LiabilityCategory } from "@prisma/client";

export const updateLiability = baseProcedure
  .input(
    z.object({
      token: z.string(),
      liabilityId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().optional(),
      category: z.nativeEnum(LiabilityCategory).optional(),
      amount: z.number().positive().optional(),
      dueDate: z.string().optional(),
      isPaid: z.boolean().optional(),
      paidDate: z.string().optional(),
      creditor: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      images: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_LIABILITIES);

    if (user.role === "CONTRACTOR") {
      const liability = await db.liability.findFirst({
        where: { id: input.liabilityId, createdById: user.id },
        select: { id: true },
      });
      if (!liability) {
        throw new Error("Liability not found");
      }
    }

    const updateData: any = {};
    
    if (input.name !== undefined) updateData.name = input.name;
    if (input.description !== undefined) updateData.description = input.description;
    if (input.category !== undefined) updateData.category = input.category;
    if (input.amount !== undefined) updateData.amount = input.amount;
    if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
    if (input.isPaid !== undefined) updateData.isPaid = input.isPaid;
    if (input.paidDate !== undefined) updateData.paidDate = input.paidDate ? new Date(input.paidDate) : null;
    if (input.creditor !== undefined) updateData.creditor = input.creditor;
    if (input.referenceNumber !== undefined) updateData.referenceNumber = input.referenceNumber;
    if (input.notes !== undefined) updateData.notes = input.notes;
    if (input.images !== undefined) updateData.images = input.images;

    const liability = await db.liability.update({
      where: { id: input.liabilityId },
      data: updateData,
    });

    return liability;
  });
