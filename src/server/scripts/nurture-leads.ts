import { db } from "~/server/db";
import { sendLeadNurtureEmail } from "~/server/utils/email";

/**
 * Auto Lead Nurture Script
 * 
 * Sends nurture emails to leads based on their age and status:
 * - WELCOME: New leads created in the last 24h that haven't been contacted
 * - FOLLOW_UP: Leads that have been CONTACTED but idle for 3+ days
 * - RE_ENGAGEMENT: Leads that have been NEW/CONTACTED for 14+ days without progress
 */
async function nurturLeads() {
  console.log("[lead-nurture] Starting lead nurture check...");

  try {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // 1. WELCOME emails: New leads created 2-24 hours ago 
    const newLeads = await db.lead.findMany({
      where: {
        status: "NEW",
        createdAt: {
          gte: oneDayAgo,
          lte: new Date(now.getTime() - 2 * 60 * 60 * 1000), // at least 2 hours old
        },
        // Only website/social media leads get auto-welcome (others are manually contacted)
        source: { in: ["WEBSITE", "SOCIAL_MEDIA"] },
      },
    });

    console.log(`[lead-nurture] Found ${newLeads.length} new leads for welcome emails`);

    for (const lead of newLeads) {
      try {
        await sendLeadNurtureEmail({
          recipientEmail: lead.customerEmail,
          recipientName: lead.customerName,
          serviceType: lead.serviceType,
          leadId: lead.id,
          nurtureType: "WELCOME",
        });
        console.log(`[lead-nurture] ✓ Welcome email sent to ${lead.customerEmail} (Lead #${lead.id})`);
      } catch (error) {
        console.error(`[lead-nurture] ✗ Failed welcome email to ${lead.customerEmail}:`, error);
      }
    }

    // 2. FOLLOW_UP emails: Contacted leads idle for 3+ days
    const contactedLeads = await db.lead.findMany({
      where: {
        status: "CONTACTED",
        updatedAt: {
          lte: threeDaysAgo,
        },
      },
    });

    console.log(`[lead-nurture] Found ${contactedLeads.length} contacted leads idle 3+ days`);

    for (const lead of contactedLeads) {
      try {
        await sendLeadNurtureEmail({
          recipientEmail: lead.customerEmail,
          recipientName: lead.customerName,
          serviceType: lead.serviceType,
          leadId: lead.id,
          nurtureType: "FOLLOW_UP",
        });
        console.log(`[lead-nurture] ✓ Follow-up email sent to ${lead.customerEmail} (Lead #${lead.id})`);
      } catch (error) {
        console.error(`[lead-nurture] ✗ Failed follow-up email to ${lead.customerEmail}:`, error);
      }
    }

    // 3. RE_ENGAGEMENT emails: Leads stuck in NEW/CONTACTED for 14+ days
    const staleLeads = await db.lead.findMany({
      where: {
        status: { in: ["NEW", "CONTACTED"] },
        updatedAt: {
          lte: fourteenDaysAgo,
        },
      },
    });

    console.log(`[lead-nurture] Found ${staleLeads.length} stale leads for re-engagement`);

    for (const lead of staleLeads) {
      try {
        await sendLeadNurtureEmail({
          recipientEmail: lead.customerEmail,
          recipientName: lead.customerName,
          serviceType: lead.serviceType,
          leadId: lead.id,
          nurtureType: "RE_ENGAGEMENT",
        });
        console.log(`[lead-nurture] ✓ Re-engagement email sent to ${lead.customerEmail} (Lead #${lead.id})`);
      } catch (error) {
        console.error(`[lead-nurture] ✗ Failed re-engagement email to ${lead.customerEmail}:`, error);
      }
    }

    const totalSent = newLeads.length + contactedLeads.length + staleLeads.length;
    console.log(`[lead-nurture] ✓ Lead nurture check completed. Total processed: ${totalSent}`);
  } catch (error) {
    console.error("[lead-nurture] Fatal error:", error);
    throw error;
  }
}

// Run the nurture check
nurturLeads()
  .then(() => {
    console.log("nurture-leads.ts complete");
    process.exit(0);
  })
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
