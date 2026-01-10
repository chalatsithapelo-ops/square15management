import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const approveOperationalExpense = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      isApproved: z.boolean(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Check approval permissions
    // Admin portal: Only SENIOR_ADMIN can approve
    // Contractor portal: Any CONTRACTOR role can approve
    const canApprove = user.role === "SENIOR_ADMIN" || user.role.includes("CONTRACTOR");
    
    if (!canApprove) {
      throw new Error("You do not have permission to approve or reject expenses");
    }

    const expense = await db.operationalExpense.update({
      where: { id: input.id },
      data: {
        isApproved: input.isApproved,
        approvedById: user.id,
        approvedAt: new Date(),
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Notify the creator
    await db.notification.create({
      data: {
        recipientId: expense.createdBy.id,
        recipientRole: "USER",
        message: `Your operational expense "${expense.description}" has been ${input.isApproved ? "approved" : "rejected"} by ${user.firstName} ${user.lastName}`,
        type: "SYSTEM_ALERT",
        relatedEntityId: expense.id,
        relatedEntityType: "OPERATIONAL_EXPENSE",
      },
    });

    return expense;
  });
