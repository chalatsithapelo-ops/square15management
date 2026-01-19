import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccountAccessDenied } from "~/server/utils/demoAccounts";

export const getAdmins = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Demo accounts must not be able to load users
    assertNotRestrictedDemoAccountAccessDenied(user);

    // This endpoint is used to show support/admin recipients; require authentication but not admin role.
    const admins = await db.user.findMany({
      where: {
        role: {
          in: ["JUNIOR_ADMIN", "SENIOR_ADMIN"],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
      },
      orderBy: {
        firstName: "asc",
      },
    });

    return admins;
  });
