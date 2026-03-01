import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deleteLiability = baseProcedure
  .input(
    z.object({
      token: z.string(),
      liabilityId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete liabilities");
    requirePermission(user, PERMISSIONS.MANAGE_LIABILITIES);

    // Contractors can only delete their own liabilities
    if (user.role === "CONTRACTOR") {
      const liability = await db.liability.findFirst({
        where: { id: input.liabilityId, createdById: user.id },
        select: { id: true },
      });
      if (!liability) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Liability not found or you don't have permission to delete it.",
        });
      }
    } else {
      const liability = await db.liability.findUnique({
        where: { id: input.liabilityId },
        select: { id: true },
      });
      if (!liability) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Liability not found.",
        });
      }
    }

    await db.liability.delete({
      where: { id: input.liabilityId },
    });

    return { success: true, message: "Liability deleted successfully." };
  });
