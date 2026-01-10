import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getUserEmailStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    // Get user's email configuration (excluding password)
    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: {
        userEmailSmtpHost: true,
        userEmailSmtpPort: true,
        userEmailSmtpSecure: true,
        userEmailSmtpUser: true,
        userEmailConfiguredAt: true,
        userEmailLastTestedAt: true,
      },
    });

    const isConfigured = !!(
      userData?.userEmailSmtpHost &&
      userData?.userEmailSmtpUser
    );

    return {
      isConfigured,
      smtpHost: userData?.userEmailSmtpHost || null,
      smtpPort: userData?.userEmailSmtpPort || null,
      smtpSecure: userData?.userEmailSmtpSecure || null,
      smtpUser: userData?.userEmailSmtpUser || null,
      configuredAt: userData?.userEmailConfiguredAt?.toISOString() || null,
      lastTestedAt: userData?.userEmailLastTestedAt?.toISOString() || null,
    };
  });
