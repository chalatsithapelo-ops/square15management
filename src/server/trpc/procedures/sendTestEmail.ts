import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";
import { sendEmail } from "~/server/utils/email";

export const sendTestEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email(),
      subject: z.string().optional(),
      body: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Get company details for the email
      const companyDetails = await getCompanyDetails();
      const fromEmail = env.RESEND_FROM_EMAIL || env.SMTP_USER;
      const emailProvider = env.RESEND_API_KEY ? "Resend (HTTP API)" : "SMTP";

      // Prepare email content
      const subject = input.subject || "Test Email from Square 15 Facility Solutions";
      const body = input.body || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${env.BRAND_PRIMARY_COLOR};">Email Delivery Test</h2>
          <p>This is a test email to verify email delivery configuration.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Configuration Details:</h3>
            <ul style="color: #6b7280;">
              <li><strong>Provider:</strong> ${emailProvider}</li>
              <li><strong>From Address:</strong> ${fromEmail}</li>
              <li><strong>Company:</strong> ${companyDetails.companyName}</li>
            </ul>
          </div>
          
          <p style="color: #6b7280;">
            If you received this email, your email delivery system is working correctly.
          </p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb;">
            <p style="color: #9ca3af; font-size: 12px; margin: 0;">
              Sent by ${user.firstName} ${user.lastName} (${user.email}) at ${new Date().toLocaleString()}
            </p>
          </div>
        </div>
      `;

      // Send the email using the core sendEmail function (Resend or SMTP)
      await sendEmail({
        to: input.recipientEmail,
        subject,
        html: body,
      });

      return {
        success: true,
        messageId: "sent",
        response: `Email sent successfully via ${emailProvider}`,
        accepted: [input.recipientEmail],
        rejected: [] as string[],
        envelope: {
          from: fromEmail,
          to: [input.recipientEmail],
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to send test email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test email: ${error.message}`,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test email due to an unknown error",
      });
    }
  });
