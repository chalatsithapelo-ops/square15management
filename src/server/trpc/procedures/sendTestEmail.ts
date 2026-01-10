import { z } from "zod";
import { TRPCError } from "@trpc/server";
import nodemailer from "nodemailer";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";

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

      // Create transporter
      const transporter = nodemailer.createTransport({
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        secure: env.SMTP_SECURE,
        auth: {
          user: env.SMTP_USER,
          pass: env.SMTP_PASSWORD,
        },
      });

      // Verify SMTP connection
      await transporter.verify();

      // Prepare email content
      const subject = input.subject || "Test Email from Square 15 Facility Solutions";
      const body = input.body || `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: ${env.BRAND_PRIMARY_COLOR};">Email Delivery Test</h2>
          <p>This is a test email to verify email delivery configuration.</p>
          
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #374151;">Configuration Details:</h3>
            <ul style="color: #6b7280;">
              <li><strong>SMTP Host:</strong> ${env.SMTP_HOST}</li>
              <li><strong>SMTP Port:</strong> ${env.SMTP_PORT}</li>
              <li><strong>From Address:</strong> ${env.SMTP_USER}</li>
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

      // Send the email
      const info = await transporter.sendMail({
        from: {
          name: companyDetails.companyName,
          address: env.SMTP_USER,
        },
        to: input.recipientEmail,
        subject: subject,
        html: body,
      });

      // Return success with detailed information
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
        accepted: info.accepted,
        rejected: info.rejected,
        envelope: {
          from: info.envelope.from,
          to: info.envelope.to,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to send test email:", error);
      
      // Return detailed error information
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
