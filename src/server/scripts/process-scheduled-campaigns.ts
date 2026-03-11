import { db } from "~/server/db";
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
    .replace(
      /\{\{estimatedValue\}\}/g,
      lead.estimatedValue ? `R${lead.estimatedValue.toLocaleString()}` : "N/A"
    );
}

async function processScheduledCampaigns() {
  console.log("[campaign-scheduler] Checking for scheduled campaigns...");

  try {
    const now = new Date();

    // Find campaigns that are SCHEDULED and their scheduledFor time has passed
    const readyCampaigns = await db.campaign.findMany({
      where: {
        status: "SCHEDULED",
        scheduledFor: {
          lte: now,
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    console.log(`[campaign-scheduler] Found ${readyCampaigns.length} campaigns ready to send`);

    for (const campaign of readyCampaigns) {
      console.log(`[campaign-scheduler] Processing campaign: "${campaign.name}" (ID: ${campaign.id})`);

      try {
        // Update status to SENDING
        await db.campaign.update({
          where: { id: campaign.id },
          data: { status: "SENDING" },
        });

        // Build where clause from target criteria
        const targetCriteria = campaign.targetCriteria as any;
        const whereClause: any = {};

        if (targetCriteria?.statuses && targetCriteria.statuses.length > 0) {
          whereClause.status = { in: targetCriteria.statuses };
        }

        if (targetCriteria?.serviceTypes && targetCriteria.serviceTypes.length > 0) {
          whereClause.serviceType = { in: targetCriteria.serviceTypes };
        }

        if (
          targetCriteria?.estimatedValueMin !== undefined ||
          targetCriteria?.estimatedValueMax !== undefined
        ) {
          whereClause.estimatedValue = {};
          if (targetCriteria.estimatedValueMin !== undefined) {
            whereClause.estimatedValue.gte = targetCriteria.estimatedValueMin;
          }
          if (targetCriteria.estimatedValueMax !== undefined) {
            whereClause.estimatedValue.lte = targetCriteria.estimatedValueMax;
          }
        }

        // Fetch matching leads
        const leads = await db.lead.findMany({ where: whereClause });

        if (leads.length === 0) {
          await db.campaign.update({
            where: { id: campaign.id },
            data: {
              status: "FAILED",
              totalRecipients: 0,
              totalSent: 0,
              totalFailed: 0,
            },
          });
          console.log(`[campaign-scheduler] No leads match criteria for campaign "${campaign.name}"`);
          continue;
        }

        const companyDetails = await getCompanyDetails();
        let totalSent = 0;
        let totalFailed = 0;

        for (const lead of leads) {
          try {
            const personalizedSubject = replacePersonalizationTokens(campaign.subject, lead);
            const personalizedBody = replacePersonalizationTokens(campaign.htmlBody, lead);

            const html = `
              <!DOCTYPE html>
              <html>
              <head>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
              </head>
              <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
                <div style="max-width: 600px; margin: 0 auto;">
                  <div style="background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR || "#1e40af"} 0%, ${env.BRAND_ACCENT_COLOR || "#3b82f6"} 100%); color: white; padding: 30px 20px; text-align: center;">
                    <h1 style="margin: 0; font-size: 24px;">${companyDetails.companyName}</h1>
                  </div>
                  <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
                    ${personalizedBody}
                    <p style="margin-top: 30px;">
                      Best regards,<br>
                      <strong>${campaign.createdBy.firstName} ${campaign.createdBy.lastName}</strong><br>
                      ${companyDetails.companyName}
                    </p>
                  </div>
                  <div style="background: #f9fafb; text-align: center; padding: 20px; color: #666; font-size: 12px;">
                    <p><strong>${companyDetails.companyName}</strong></p>
                    <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
                    <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
                  </div>
                </div>
              </body>
              </html>
            `;

            await sendEmail({
              to: lead.customerEmail,
              subject: personalizedSubject,
              html,
              userId: campaign.createdBy.id,
            });

            totalSent++;
            console.log(`[campaign-scheduler] ✓ Sent to ${lead.customerEmail}`);
          } catch (sendError) {
            totalFailed++;
            console.error(
              `[campaign-scheduler] ✗ Failed to send to ${lead.customerEmail}:`,
              sendError
            );
          }
        }

        // Update campaign with results
        await db.campaign.update({
          where: { id: campaign.id },
          data: {
            status: totalFailed === leads.length ? "FAILED" : "SENT",
            sentAt: new Date(),
            totalRecipients: leads.length,
            totalSent,
            totalFailed,
          },
        });

        // Notify campaign creator
        await db.notification.create({
          data: {
            recipientId: campaign.createdBy.id,
            recipientRole: "ADMIN",
            message: `📧 Campaign "${campaign.name}" sent: ${totalSent}/${leads.length} emails delivered`,
            type: "SYSTEM_ALERT",
          },
        });

        console.log(
          `[campaign-scheduler] ✓ Campaign "${campaign.name}" completed: ${totalSent} sent, ${totalFailed} failed`
        );
      } catch (campaignError) {
        console.error(
          `[campaign-scheduler] ✗ Error processing campaign "${campaign.name}":`,
          campaignError
        );

        await db.campaign
          .update({
            where: { id: campaign.id },
            data: { status: "FAILED" },
          })
          .catch(console.error);
      }
    }

    console.log("[campaign-scheduler] ✓ Campaign scheduler run completed");
  } catch (error) {
    console.error("[campaign-scheduler] Fatal error:", error);
    throw error;
  }
}

// Run the scheduler
processScheduledCampaigns()
  .then(() => {
    console.log("process-scheduled-campaigns.ts complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
