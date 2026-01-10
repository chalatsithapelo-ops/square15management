import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const updateAlternativeRevenue = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      description: z.string().min(1).optional(),
      amount: z.number().positive().optional(),
      source: z.string().optional(),
      referenceNumber: z.string().optional(),
      notes: z.string().optional(),
      documentUrl: z.string().optional(),
      category: z.enum([
        "CONSULTING",
        "RENTAL_INCOME",
        "INTEREST",
        "INVESTMENTS",
        "GRANTS",
        "DONATIONS",
        "OTHER",
      ]).optional(),
      isRecurring: z.boolean().optional(),
      recurringPeriod: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Verify revenue exists
    const existingRevenue = await db.alternativeRevenue.findUnique({
      where: { id: input.id },
    });

    if (!existingRevenue) {
      throw new Error("Alternative revenue not found");
    }

    // Only allow senior users to edit or the creator before approval
    const isSeniorUser =
      user.role === "SENIOR_ADMIN" || user.role === "SENIOR_CONTRACTOR_MANAGER";
    const isCreator = existingRevenue.createdById === user.id;
    const isApproved = existingRevenue.isApproved;

    if (!isSeniorUser && (isApproved || !isCreator)) {
      throw new Error("You do not have permission to edit this revenue entry");
    }

    // Update the revenue
    const updatedRevenue = await db.alternativeRevenue.update({
      where: { id: input.id },
      data: {
        description: input.description,
        amount: input.amount,
        source: input.source,
        referenceNumber: input.referenceNumber,
        notes: input.notes,
        documentUrl: input.documentUrl,
        category: input.category,
        isRecurring: input.isRecurring,
        recurringPeriod: input.recurringPeriod,
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approvedBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updatedRevenue;
  });
