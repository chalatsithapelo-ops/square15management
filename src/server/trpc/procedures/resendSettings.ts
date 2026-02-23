import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const updateResendSettings = baseProcedure
  .input(
    z.object({
      token: z.string(),
      resendApiKey: z.string().optional(),
      resendFromEmail: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only admin users can update email API settings");
    }

    const updates: Promise<any>[] = [];

    if (input.resendApiKey !== undefined) {
      updates.push(
        db.systemSettings.upsert({
          where: { key: "resend_api_key" },
          create: { key: "resend_api_key", value: input.resendApiKey },
          update: { value: input.resendApiKey },
        })
      );
    }

    if (input.resendFromEmail !== undefined) {
      updates.push(
        db.systemSettings.upsert({
          where: { key: "resend_from_email" },
          create: { key: "resend_from_email", value: input.resendFromEmail },
          update: { value: input.resendFromEmail },
        })
      );
    }

    await Promise.all(updates);

    return { success: true };
  });

export const getResendSettings = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only admin users can view email API settings");
    }

    const rows = await db.systemSettings.findMany({
      where: {
        key: { in: ["resend_api_key", "resend_from_email"] },
      },
    });

    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    return {
      resendApiKey: map.resend_api_key || "",
      resendFromEmail: map.resend_from_email || "",
      isConfigured: !!map.resend_api_key,
    };
  });

export const testResendConnection = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const allowedRoles = ["ADMIN", "SENIOR_ADMIN"];
    if (!allowedRoles.includes(user.role)) {
      throw new Error("Only admin users can test email configuration");
    }

    // Get settings from DB
    const rows = await db.systemSettings.findMany({
      where: {
        key: { in: ["resend_api_key", "resend_from_email"] },
      },
    });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    const apiKey = map.resend_api_key;
    const fromEmail = map.resend_from_email;

    if (!apiKey) {
      throw new Error("Resend API key not configured. Please save your API key first.");
    }
    if (!fromEmail) {
      throw new Error("From email address not configured. Please save your from email first.");
    }

    try {
      const { Resend } = await import("resend");
      const resend = new Resend(apiKey);

      const result = await resend.emails.send({
        from: fromEmail,
        to: [input.recipientEmail],
        subject: "Test Email - Resend Configuration",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2D5016;">Resend Email Test Successful!</h2>
            <p>Your Resend email API is configured and working correctly.</p>
            <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
              <p style="margin: 4px 0; color: #6b7280;"><strong>From:</strong> ${fromEmail}</p>
              <p style="margin: 4px 0; color: #6b7280;"><strong>To:</strong> ${input.recipientEmail}</p>
              <p style="margin: 4px 0; color: #6b7280;"><strong>Provider:</strong> Resend (HTTP API)</p>
              <p style="margin: 4px 0; color: #6b7280;"><strong>Time:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="color: #6b7280; font-size: 13px;">
              This confirms emails can be sent from your application without SMTP port restrictions.
            </p>
          </div>
        `,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

      return {
        success: true,
        messageId: result.data?.id || "sent",
        message: `Test email sent successfully to ${input.recipientEmail}`,
      };
    } catch (error: any) {
      const msg = error?.message || "Unknown error";
      if (msg.includes("validation_error") || msg.includes("not verified")) {
        throw new Error(
          `Domain not verified: Your domain needs to be verified in Resend before you can send from ${fromEmail}. ` +
          `Go to resend.com/domains to add and verify your domain by adding the required DNS records.`
        );
      }
      if (msg.includes("api_key")) {
        throw new Error("Invalid API key. Please check your Resend API key and try again.");
      }
      throw new Error(`Failed to send test email: ${msg}`);
    }
  });
