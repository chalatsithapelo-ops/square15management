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

export const sendCampaign = baseProcedure
  .input(
    z.object({
      token: z.string(),
      campaignId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Fetch the campaign
      const campaign = await db.campaign.findUnique({
        where: { id: input.campaignId },
      });

      if (!campaign) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Campaign not found",
        });
      }

      // Check if campaign is already sent
      if (campaign.status === "SENT") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Campaign has already been sent",
        });
      }

      // Update campaign status to SENDING
      await db.campaign.update({
        where: { id: input.campaignId },
        data: { status: "SENDING" },
      });

      // Build where clause based on target criteria
      const targetCriteria = campaign.targetCriteria as any;
      const whereClause: any = {};

      if (targetCriteria?.statuses && targetCriteria.statuses.length > 0) {
        whereClause.status = { in: targetCriteria.statuses };
      }

      if (targetCriteria?.serviceTypes && targetCriteria.serviceTypes.length > 0) {
        whereClause.serviceType = { in: targetCriteria.serviceTypes };
      }

      if (targetCriteria?.estimatedValueMin !== undefined || targetCriteria?.estimatedValueMax !== undefined) {
        whereClause.estimatedValue = {};
        if (targetCriteria.estimatedValueMin !== undefined) {
          whereClause.estimatedValue.gte = targetCriteria.estimatedValueMin;
        }
        if (targetCriteria.estimatedValueMax !== undefined) {
          whereClause.estimatedValue.lte = targetCriteria.estimatedValueMax;
        }
      }

      // Fetch target leads
      const leads = await db.lead.findMany({
        where: whereClause,
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

      let filteredLeads = leads;

      // Apply customer-based filtering if specified
      if (targetCriteria?.targetCustomerIds && targetCriteria.targetCustomerIds.length > 0) {
        // Fetch the targeted customers to get their emails
        const targetedCustomers = await db.user.findMany({
          where: {
            id: { in: targetCriteria.targetCustomerIds },
            role: "CUSTOMER",
          },
          select: {
            id: true,
            email: true,
          },
        });

        const targetedEmails = new Set(targetedCustomers.map(c => c.email));

        // Filter leads to only include those matching targeted customer emails
        filteredLeads = filteredLeads.filter(lead => 
          targetedEmails.has(lead.customerEmail)
        );

        // Apply exclusions if specified
        if (targetCriteria?.excludedCustomerIds && targetCriteria.excludedCustomerIds.length > 0) {
          const excludedCustomers = await db.user.findMany({
            where: {
              id: { in: targetCriteria.excludedCustomerIds },
              role: "CUSTOMER",
            },
            select: {
              email: true,
            },
          });

          const excludedEmails = new Set(excludedCustomers.map(c => c.email));

          // Remove excluded customers from the filtered list
          filteredLeads = filteredLeads.filter(lead => 
            !excludedEmails.has(lead.customerEmail)
          );
        }
      }

      if (filteredLeads.length === 0) {
        await db.campaign.update({
          where: { id: input.campaignId },
          data: { 
            status: "FAILED",
            totalRecipients: 0,
            totalSent: 0,
            totalFailed: 0,
          },
        });

        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "No leads match the target criteria",
        });
      }

      // Get company details for branding
      const companyDetails = await getCompanyDetails();

      const results = {
        successful: [] as Array<{ email: string; name: string }>,
        failed: [] as Array<{ email: string; name: string; error: string }>,
      };

      // Send personalized email to each lead
      for (const lead of filteredLeads) {
        try {
          // Replace personalization tokens in subject and body
          const personalizedSubject = replacePersonalizationTokens(campaign.subject, lead);
          const personalizedBody = replacePersonalizationTokens(campaign.htmlBody, lead);

          // Wrap the campaign HTML body with company branding
          const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                .footer {
                  background-color: #f9fafb;
                  text-align: center;
                  padding: 20px;
                  color: #666;
                  font-size: 12px;
                  border-top: 1px solid #e5e7eb;
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
                  ${personalizedBody}
                  
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
              message: `Campaign "${campaign.name}" sent to ${lead.customerName} (${lead.customerEmail})`,
              type: "SYSTEM_ALERT",
              relatedEntityId: lead.id,
              relatedEntityType: "LEAD",
            },
          });
        } catch (error) {
          console.error(`Failed to send campaign email to ${lead.customerEmail}:`, error);
          results.failed.push({
            email: lead.customerEmail,
            name: lead.customerName,
            error: error instanceof Error ? error.message : "Unknown error",
          });
        }
      }

      // Update campaign with results
      await db.campaign.update({
        where: { id: input.campaignId },
        data: {
          status: results.failed.length === filteredLeads.length ? "FAILED" : "SENT",
          sentAt: new Date(),
          totalRecipients: filteredLeads.length,
          totalSent: results.successful.length,
          totalFailed: results.failed.length,
        },
      });

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
      console.error("Failed to send campaign:", error);
      
      // Update campaign status to FAILED
      await db.campaign.update({
        where: { id: input.campaignId },
        data: { status: "FAILED" },
      }).catch(console.error);
      
      if (error instanceof TRPCError) {
        throw error;
      }
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send campaign: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send campaign due to an unknown error",
      });
    }
  });
