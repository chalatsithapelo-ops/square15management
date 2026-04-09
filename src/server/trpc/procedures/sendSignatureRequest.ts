import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import crypto from "crypto";

export const sendSignatureRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(),
      recipientEmail: z.string().email(),
      recipientName: z.string().min(1),
      method: z.enum(["email", "whatsapp"]),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (!["SENIOR_ADMIN", "JUNIOR_ADMIN", "PROPERTY_MANAGER"].includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins and property managers can send signature requests",
      });
    }

    // Generate a unique token for this signature request
    const signatureToken = crypto.randomBytes(32).toString("hex");

    let order: any;
    if (input.isPMOrder) {
      order = await db.propertyManagerOrder.findUnique({
        where: { id: input.orderId },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only request signature for completed orders",
        });
      }
      await db.propertyManagerOrder.update({
        where: { id: input.orderId },
        data: {
          signatureRequestToken: signatureToken,
          signatureRequestSentAt: new Date(),
        },
      });
    } else {
      order = await db.order.findUnique({
        where: { id: input.orderId },
      });
      if (!order) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Order not found" });
      }
      if (order.status !== "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only request signature for completed orders",
        });
      }
      await db.order.update({
        where: { id: input.orderId },
        data: {
          signatureRequestToken: signatureToken,
          signatureRequestSentAt: new Date(),
        },
      });
    }

    const signingUrl = `${env.BASE_URL}/external/sign-jobcard/${signatureToken}`;
    const companyDetails = await getCompanyDetails();
    const orderNumber = order.orderNumber;

    if (input.method === "email") {
      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background-color: ${env.BRAND_PRIMARY_COLOR}; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 24px;">${companyDetails.companyName}</h1>
          </div>
          <div style="background-color: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
            <h2 style="color: #1f2937; margin-top: 0;">Job Card Signature Request</h2>
            <p style="color: #4b5563;">Dear ${input.recipientName},</p>
            <p style="color: #4b5563;">
              A job has been completed for order <strong>${orderNumber}</strong> and requires your signature 
              to confirm the work has been done to your satisfaction.
            </p>
            <p style="color: #4b5563;">Please click the button below to review and sign the job card electronically:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${signingUrl}" 
                 style="background-color: ${env.BRAND_PRIMARY_COLOR}; color: white; padding: 14px 32px; 
                        text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px; display: inline-block;">
                Sign Job Card
              </a>
            </div>
            <p style="color: #6b7280; font-size: 13px;">
              If the button doesn't work, copy and paste this link into your browser:<br/>
              <a href="${signingUrl}" style="color: ${env.BRAND_ACCENT_COLOR}; word-break: break-all;">${signingUrl}</a>
            </p>
            <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 20px 0;" />
            <p style="color: #9ca3af; font-size: 12px; margin-bottom: 0;">
              This is an automated message from ${companyDetails.companyName}. 
              If you did not expect this email, please disregard it.
            </p>
          </div>
        </div>
      `;

      await sendEmail({
        to: input.recipientEmail,
        subject: `Job Card Signature Required - Order ${orderNumber}`,
        html,
      });

      return {
        success: true,
        method: "email",
        message: `Signature request sent to ${input.recipientEmail}`,
      };
    } else {
      // WhatsApp - generate a wa.me link for the admin to share
      const message = encodeURIComponent(
        `Hi ${input.recipientName},\n\n` +
        `A job has been completed for order ${orderNumber} by ${companyDetails.companyName} ` +
        `and requires your signature.\n\n` +
        `Please sign the job card here:\n${signingUrl}\n\n` +
        `Thank you.`
      );

      // Clean up phone number for WhatsApp (remove spaces, dashes, leading 0, add country code)
      let phone = input.recipientEmail.replace(/[\s\-()]/g, "");
      if (phone.startsWith("0")) {
        phone = "27" + phone.substring(1); // South Africa default
      }
      if (!phone.startsWith("+") && !phone.startsWith("27")) {
        phone = "27" + phone;
      }
      phone = phone.replace("+", "");

      const whatsappUrl = `https://wa.me/${phone}?text=${message}`;

      return {
        success: true,
        method: "whatsapp",
        whatsappUrl,
        signingUrl,
        message: `WhatsApp link generated. Open it to send the signature request.`,
      };
    }
  });
