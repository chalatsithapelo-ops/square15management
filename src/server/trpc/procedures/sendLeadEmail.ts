import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

export const sendLeadEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email("Invalid email address"),
      recipientName: z.string().min(1, "Recipient name is required"),
      subject: z.string().min(1, "Subject is required"),
      body: z.string().min(1, "Email body is required"),
      leadId: z.number().optional(),
      ccEmails: z.array(z.string().email()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Get company details for branding
      const companyDetails = await getCompanyDetails();

      // Optionally fetch lead details if leadId is provided
      let lead = null;
      if (input.leadId) {
        lead = await db.lead.findUnique({
          where: { id: input.leadId },
          include: {
            createdBy: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });
      }

      // Construct professional HTML email
      const html = `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              margin: 0;
              padding: 0;
            }
            .container {
              max-width: 600px;
              margin: 0 auto;
              padding: 0;
            }
            .header {
              background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 24px;
              font-weight: bold;
            }
            .content {
              background-color: #ffffff;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .greeting {
              font-size: 16px;
              margin-bottom: 20px;
              color: #1a1a1a;
            }
            .body-content {
              white-space: pre-wrap;
              word-wrap: break-word;
              color: #374151;
              line-height: 1.8;
            }
            .footer {
              background-color: #f9fafb;
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
              border-radius: 0 0 8px 8px;
            }
            .footer-divider {
              border-top: 2px solid #e5e7eb;
              margin: 15px 0;
            }
            .contact-info {
              margin-top: 10px;
            }
            .contact-info p {
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>${companyDetails.companyName}</h1>
            </div>
            
            <div class="content">
              <p class="greeting">Dear ${input.recipientName},</p>
              
              <div class="body-content">${input.body.replace(/\n/g, '<br>')}</div>
              
              <p style="margin-top: 30px;">
                Best regards,<br>
                <strong>${user.firstName} ${user.lastName}</strong><br>
                ${companyDetails.companyName}
              </p>
            </div>
            
            <div class="footer">
              <div class="footer-divider"></div>
              <p><strong>${companyDetails.companyName}</strong></p>
              <div class="contact-info">
                <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
                <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
                <p>VAT: ${companyDetails.companyVatNumber}</p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `;

      // Prepare recipients list
      const recipients = [input.recipientEmail];
      if (input.ccEmails && input.ccEmails.length > 0) {
        recipients.push(...input.ccEmails);
      }

      // Send the email using user's personal email if configured
      await sendEmail({
        to: recipients,
        subject: input.subject,
        html,
        userId: user.id,
      });

      // Create a notification record for tracking
      await db.notification.create({
        data: {
          recipientId: user.id,
          recipientRole: user.role,
          message: `Email sent to ${input.recipientName} (${input.recipientEmail}): "${input.subject}"`,
          type: "SYSTEM_ALERT",
          relatedEntityId: lead?.id,
          relatedEntityType: lead ? "LEAD" : undefined,
        },
      });

      // Return success with details
      return {
        success: true,
        sentTo: input.recipientEmail,
        ccSent: input.ccEmails || [],
        sentBy: `${user.firstName} ${user.lastName}`,
        sentAt: new Date().toISOString(),
        subject: input.subject,
      };
    } catch (error) {
      console.error("Failed to send lead email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send email: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send email due to an unknown error",
      });
    }
  });
