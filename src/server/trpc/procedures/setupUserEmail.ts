import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { testUserEmailConfig } from "~/server/utils/email-user";

export const setupUserEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      smtpHost: z.string().min(1, "SMTP host is required"),
      smtpPort: z.number().int().positive("SMTP port must be a positive integer"),
      smtpSecure: z.boolean(),
      smtpUser: z.string().email("Valid email address is required"),
      smtpPassword: z.string().min(1, "SMTP password is required").optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user (any authenticated user can set up their email)
    const user = await authenticateUser(input.token);

    try {
      let smtpPassword = input.smtpPassword;

      if (!smtpPassword) {
        const existing = await db.user.findUnique({
          where: { id: user.id },
          select: { userEmailSmtpPassword: true },
        });

        if (!existing?.userEmailSmtpPassword) {
          throw new TRPCError({
            code: "PRECONDITION_FAILED",
            message: "SMTP password is required to configure your email account",
          });
        }

        smtpPassword = existing.userEmailSmtpPassword;
      }

      // Test the email configuration before saving
      await testUserEmailConfig({
        host: input.smtpHost,
        port: input.smtpPort,
        secure: input.smtpSecure,
        user: input.smtpUser,
        password: smtpPassword,
      });

      // Save the configuration to the database
      const now = new Date();
      const updateData: Record<string, unknown> = {
        userEmailSmtpHost: input.smtpHost,
        userEmailSmtpPort: input.smtpPort,
        userEmailSmtpSecure: input.smtpSecure,
        userEmailSmtpUser: input.smtpUser,
        userEmailConfiguredAt: now,
        userEmailLastTestedAt: now,
      };

      if (input.smtpPassword) {
        updateData.userEmailSmtpPassword = input.smtpPassword;
      }

      await db.user.update({
        where: { id: user.id },
        data: updateData,
      });

      return {
        success: true,
        message: "Email account configured successfully",
        smtpUser: input.smtpUser,
        smtpHost: input.smtpHost,
        configuredAt: now.toISOString(),
      };
    } catch (error) {
      console.error("Failed to set up user email:", error);
      
      if (error instanceof TRPCError) throw error;
      
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      
      // Provide user-friendly error messages for common SMTP issues
      let friendlyMessage = `Failed to configure email account: ${errorMessage}`;
      if (errorMessage.includes("Connection timeout") || errorMessage.includes("ETIMEDOUT")) {
        friendlyMessage = `Cannot connect to SMTP server "${input.smtpHost}:${input.smtpPort}". The server may be unreachable, or outbound SMTP ports may be blocked by your hosting provider. Try port 465 with SSL, or contact your hosting provider to allow outbound SMTP traffic.`;
      } else if (errorMessage.includes("ECONNREFUSED")) {
        friendlyMessage = `Connection refused by SMTP server "${input.smtpHost}:${input.smtpPort}". Please verify the server address and port are correct.`;
      } else if (errorMessage.includes("Invalid login") || errorMessage.includes("authentication")) {
        friendlyMessage = `Authentication failed. Please check your SMTP username and password. If using Gmail, you may need to use an App Password.`;
      }

      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: friendlyMessage,
      });
    }
  });
