import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

/**
 * Replace personalization tokens in text with actual lead data
 */
function replacePersonalizationTokens(text: string, lead: any): string {
  return text
    .replace(/\{\{customerName\}\}/g, lead.customerName || "")
    .replace(/\{\{customerEmail\}\}/g, lead.customerEmail || "")
    .replace(/\{\{customerPhone\}\}/g, lead.customerPhone || "")
    .replace(/\{\{address\}\}/g, lead.address || "N/A")
    .replace(/\{\{serviceType\}\}/g, lead.serviceType || "")
    .replace(/\{\{description\}\}/g, lead.description || "")
    .replace(/\{\{estimatedValue\}\}/g, 
      lead.estimatedValue ? `R${lead.estimatedValue.toLocaleString()}` : "N/A"
    );
}

export const sendBulkLeadEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      leadIds: z.array(z.number()).min(1, "At least one lead must be selected"),
      subject: z.string().min(1, "Subject is required"),
      body: z.string().min(1, "Email body is required"),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Fetch all leads
      const leads = await db.lead.findMany({
        where: {
          id: {
            in: input.leadIds,
          },
        },
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

      if (leads.length === 0) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "No leads found with the provided IDs",
        });
      }

      // Get company details for branding
      const companyDetails = await getCompanyDetails();

      const results = {
        successful: [] as Array<{ email: string; name: string }>,
        failed: [] as Array<{ email: string; name: string; error: string }>,
      };

      // Send personalized email to each lead
      for (const lead of leads) {
        try {
          // Replace personalization tokens in subject and body
          const personalizedSubject = replacePersonalizationTokens(input.subject, lead);
          const personalizedBody = replacePersonalizationTokens(input.body, lead);

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
                  <p class="greeting">Dear ${lead.customerName},</p>
                  
                  <div class="body-content">${personalizedBody.replace(/\n/g, '<br>')}</div>
                  
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

          // Send the email using user's personal email if configured
          await sendEmail({
            to: lead.customerEmail,
            subject: personalizedSubject,
            html,
            userId: user.id,
          });

          // Track success
          results.successful.push({
            email: lead.customerEmail,
            name: lead.customerName,
          });

          // Create a notification record for tracking
          await db.notification.create({
            data: {
              recipientId: user.id,
              recipientRole: user.role,
              message: `Bulk email sent to ${lead.customerName} (${lead.customerEmail}): "${personalizedSubject}"`,
              type: "SYSTEM_ALERT",
              relatedEntityId: lead.id,
              relatedEntityType: "LEAD",
            },
          });
        } catch (error) {
          console.error(`Failed to send email to ${lead.customerEmail}:`, error);
          results.failed.push({
            email: lead.customerEmail,
            name: lead.customerName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Return summary
      return {
        success: true,
        totalSent: results.successful.length,
        totalFailed: results.failed.length,
        successful: results.successful,
        failed: results.failed,
        sentBy: `${user.firstName} ${user.lastName}`,
        sentAt: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Failed to send bulk lead emails:", error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send bulk emails: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send bulk emails due to an unknown error",
      });
    }
  });
