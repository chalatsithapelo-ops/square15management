import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const disconnectUserEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    try {
      // Remove email configuration
      await db.user.update({
        where: { id: user.id },
        data: {
          userEmailSmtpHost: null,
          userEmailSmtpPort: null,
          userEmailSmtpSecure: null,
          userEmailSmtpUser: null,
          userEmailSmtpPassword: null,
          userEmailConfiguredAt: null,
          userEmailLastTestedAt: null,
        },
      });

      return {
        success: true,
        message: "Email account disconnected successfully",
      };
    } catch (error) {
      console.error("Failed to disconnect user email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to disconnect email account: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to disconnect email account due to an unknown error",
      });
    }
  });
