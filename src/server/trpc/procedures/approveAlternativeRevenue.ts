import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const approveAlternativeRevenue = baseProcedure
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
      throw new Error("You do not have permission to approve or reject revenue entries");
    }

    const revenue = await db.alternativeRevenue.update({
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
        recipientId: revenue.createdBy.id,
        recipientRole: "USER",
        message: `Your alternative revenue "${revenue.description}" has been ${input.isApproved ? "approved" : "rejected"} by ${user.firstName} ${user.lastName}`,
        type: "SYSTEM_ALERT",
        relatedEntityId: revenue.id,
        relatedEntityType: "ALTERNATIVE_REVENUE",
      },
    });

    return revenue;
  });
