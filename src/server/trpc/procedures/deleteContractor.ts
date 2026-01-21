import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin as isAdminUser } from "~/server/utils/auth";

export const deleteContractor = baseProcedure
  .input(
    z.object({
      token: z.string(),
      contractorId: z.number().int().positive(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isPropertyManager = user.role === "PROPERTY_MANAGER";
    const isAdmin = isAdminUser(user);

    if (!isPropertyManager && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins or Property Managers can delete contractors",
      });
    }

    try {
      const contractor = await db.contractor.findUnique({
        where: { id: input.contractorId },
        select: { id: true, email: true, propertyManagerId: true },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      if (isPropertyManager && contractor.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only delete contractors assigned to your account",
        });
      }

      await db.$transaction(async (tx) => {
        await tx.contractor.delete({
          where: { id: input.contractorId },
        });

        // Best-effort cleanup of the contractor's user account (portal login)
        await tx.user.deleteMany({
          where: {
            email: contractor.email,
            role: { in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"] },
          },
        });
      });

      return {
        success: true,
        message: "Contractor deleted successfully",
      };
    } catch (error) {
      console.error("Error deleting contractor:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete contractor",
      });
    }
  });
