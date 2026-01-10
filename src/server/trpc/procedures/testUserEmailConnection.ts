import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmailAsUser, getUserSmtpConfig } from "~/server/utils/email-user";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

export const testUserEmailConnection = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email(),
      subject: z.string().optional(),
      body: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    try {
      // Check if user has email configured
      const config = await getUserSmtpConfig(user.id);
      
      if (!config) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "You have not configured your email account yet",
        });
      }

      // Get company details for the email
      const companyDetails = await getCompanyDetails();

      const escapeHtml = (value: string) =>
        value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");

      const subject = (input.subject || "").trim() || "Test Email from Your Personal Account";
      const customBody = (input.body || "").trim();

      // Prepare test email content
      const body = customBody
        ? `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${env.BRAND_PRIMARY_COLOR};">Test Email</h2>
          <div style="white-space: pre-wrap; color: #374151; background-color: #f9fafb; padding: 16px; border-radius: 8px; border: 1px solid #e5e7eb;">
            ${escapeHtml(customBody).replace(/\n/g, "<br/>")}
          </div>
          <p style="color: #9ca3af; font-size: 12px; margin-top: 20px;">Sent at ${new Date().toLocaleString()}</p>
        </div>
      `
        : `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${env.BRAND_PRIMARY_COLOR};">Email Configuration Test</h2>
          <p>This is a test email to verify your personal email configuration.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Your Configuration:</h3>
            <ul style="color: #6b7280;">
              <li><strong>SMTP Host:</strong> ${config.host}</li>
              <li><strong>SMTP Port:</strong> ${config.port}</li>
              <li><strong>From Address:</strong> ${config.user}</li>
              <li><strong>Your Name:</strong> ${user.firstName} ${user.lastName}</li>
            </ul>
          </div>
          
          <p style="color: #6b7280;">
            If you received this email, your personal email account is configured correctly and you can now send emails through the app using your own email address.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Sent at ${new Date().toLocaleString()}
            </p>
          </div>
          
          <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #e5e7eb; text-align: center;">
            <p><strong>${companyDetails.companyName}</strong></p>
            <p style="font-size: 12px; color: #6b7280;">${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          </div>
        </div>
      `;

      // Send the test email
      await sendEmailAsUser(user.id, {
        to: input.recipientEmail,
        subject,
        html: body,
      });

      return {
        success: true,
        message: "Test email sent successfully",
        sentTo: input.recipientEmail,
        sentFrom: config.user,
        sentBy: `${user.firstName} ${user.lastName}`,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to send test email:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test email: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test email due to an unknown error",
      });
    }
  });
