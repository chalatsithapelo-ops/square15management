import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

/**
 * Get the staff member's profile and their PM's info.
 * Used when a STAFF user logs in to their self-service portal.
 */
export const getStaffProfile = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const staffMember = await db.staffMember.findFirst({
      where: { userId: user.id },
      include: {
        propertyManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            pmCompanyName: true,
          },
        },
        building: {
          select: { id: true, name: true, address: true },
        },
      },
    });

    if (!staffMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Staff profile not found. Please contact your Property Manager.",
      });
    }

    return {
      ...staffMember,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
    };
  });
