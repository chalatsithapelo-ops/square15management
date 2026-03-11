import { db } from "~/server/db";
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';

/**
 * Auto Campaign Suggestions Script
 * 
 * Runs monthly (1st of each month) to:
 * 1. Analyze current lead data, service types, and trends
 * 2. Use AI to generate 2-3 smart campaign suggestions
 * 3. Create them as DRAFT campaigns for the owner to review
 * 
 * The AI acts as a "living marketing assistant" that proactively 
 * creates campaign ideas based on real business data.
 */

const model = google('gemini-2.0-flash');

async function suggestCampaigns() {
  console.log("[campaign-suggest] Starting monthly campaign suggestion generation...");

  try {
    // Gather business intelligence data
    const now = new Date();
    const currentMonth = now.toLocaleString('en-ZA', { month: 'long' });
    const currentYear = now.getFullYear();

    // Get lead statistics by service type
    const leadsByServiceType = await db.lead.groupBy({
      by: ['serviceType'],
      _count: { id: true },
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 3, 1), // Last 3 months
        },
      },
      orderBy: { _count: { id: 'desc' } },
    });

    // Get lead statistics by status
    const leadsByStatus = await db.lead.groupBy({
      by: ['status'],
      _count: { id: true },
    });

    // Get total leads count
    const totalLeads = await db.lead.count();

    // Count recently completed orders
    const recentCompletedOrders = await db.order.count({
      where: {
        status: 'COMPLETED',
        updatedAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 1, 1),
        },
      },
    });

    // Get top customers (leads that became WON)
    const wonLeads = await db.lead.count({
      where: { status: 'WON' },
    });

    // Get inactive/lost leads for re-engagement
    const inactiveLeads = await db.lead.count({
      where: {
        status: { in: ['NEW', 'CONTACTED'] },
        updatedAt: {
          lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000), // 30+ days inactive
        },
      },
    });

    // Get recently sent campaigns to avoid duplication
    const recentCampaigns = await db.campaign.findMany({
      where: {
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth() - 2, 1), // Last 2 months
        },
      },
      select: { name: true, subject: true, description: true },
    });

    // Find the first admin user to attribute campaigns to
    const adminUser = await db.user.findFirst({
      where: { role: { in: ['ADMIN', 'CONTRACTOR'] } },
      select: { id: true },
    });

    if (!adminUser) {
      console.log("[campaign-suggest] No admin user found. Skipping campaign generation.");
      return;
    }

    // Build intelligence summary for AI
    const topServices = leadsByServiceType.slice(0, 5).map(s => `${s.serviceType}: ${s._count.id} leads`).join(', ');
    const statusSummary = leadsByStatus.map(s => `${s.status}: ${s._count.id}`).join(', ');
    const recentCampaignNames = recentCampaigns.map(c => c.name).join(', ');

    // Determine South African season
    const month = now.getMonth(); // 0-11
    let season = 'autumn';
    if (month >= 9 && month <= 11) season = 'spring'; // Oct-Dec
    if (month >= 0 && month <= 2) season = 'summer'; // Jan-Mar
    if (month >= 3 && month <= 5) season = 'autumn'; // Apr-Jun
    if (month >= 6 && month <= 8) season = 'winter'; // Jul-Sep

    const prompt = `You are the AI marketing assistant for Square 15 Property Maintenance (www.square15.co.za), a South African property maintenance company.

Based on the following business data, generate exactly 3 campaign suggestions for ${currentMonth} ${currentYear}.

BUSINESS DATA:
- Total leads: ${totalLeads}
- Lead pipeline: ${statusSummary}
- Top services (last 3 months): ${topServices}
- Won customers: ${wonLeads}
- Recent completed orders: ${recentCompletedOrders}
- Inactive leads (30+ days): ${inactiveLeads}
- Current season: ${season} (South Africa)
- Recent campaigns already created: ${recentCampaignNames || 'None'}

REQUIREMENTS:
1. Each campaign should be different (one service promo, one seasonal, one re-engagement or special)
2. Avoid duplicating recent campaigns
3. Consider the current South African season and any relevant holidays
4. Make the HTML designs professional, modern, and visually striking
5. Use personalization tokens: {{customerName}}, {{serviceType}}
6. Include calls-to-action linking to https://www.square15.co.za
7. Maximum 600px width, inline CSS only
8. Use company name "Square 15 Property Maintenance"
9. Include a professional footer
10. Use emoji icons for visual appeal

Respond ONLY with a JSON array of exactly 3 campaigns (no markdown, no code blocks):
[
  {
    "name": "Campaign Name",
    "description": "Brief description",
    "subject": "Email subject line",
    "htmlBody": "<div>...full professional HTML email...</div>",
    "targetServiceTypes": ["Plumbing", "Electrical"],
    "targetStatuses": ["NEW", "CONTACTED", "QUALIFIED"]
  }
]`;

    console.log("[campaign-suggest] Sending data to AI for campaign generation...");

    const result = await generateText({
      model,
      prompt,
      maxTokens: 8000,
      temperature: 0.8,
    });

    // Parse AI response
    let campaigns: Array<{
      name: string;
      description: string;
      subject: string;
      htmlBody: string;
      targetServiceTypes?: string[];
      targetStatuses?: string[];
    }>;

    try {
      let cleanText = result.text.trim();
      if (cleanText.startsWith('```json')) cleanText = cleanText.slice(7);
      else if (cleanText.startsWith('```')) cleanText = cleanText.slice(3);
      if (cleanText.endsWith('```')) cleanText = cleanText.slice(0, -3);
      cleanText = cleanText.trim();
      campaigns = JSON.parse(cleanText);
    } catch (parseError) {
      console.error("[campaign-suggest] Failed to parse AI response:", result.text.substring(0, 500));
      console.error("[campaign-suggest] Parse error:", parseError);
      return;
    }

    if (!Array.isArray(campaigns) || campaigns.length === 0) {
      console.error("[campaign-suggest] AI returned no campaigns");
      return;
    }

    // Create draft campaigns in the database
    let created = 0;
    for (const campaign of campaigns) {
      try {
        const targetCriteria: any = {};
        if (campaign.targetServiceTypes?.length) {
          targetCriteria.serviceTypes = campaign.targetServiceTypes;
        }
        if (campaign.targetStatuses?.length) {
          targetCriteria.statuses = campaign.targetStatuses;
        }

        await db.campaign.create({
          data: {
            name: `[AI Suggested] ${campaign.name}`,
            description: campaign.description || '',
            subject: campaign.subject,
            htmlBody: campaign.htmlBody,
            targetCriteria,
            status: 'DRAFT',
            createdById: adminUser.id,
            notes: `Auto-generated by AI Marketing Assistant on ${now.toISOString().split('T')[0]}. Review and approve before sending.`,
          },
        });
        created++;
        console.log(`[campaign-suggest] ✓ Created draft campaign: ${campaign.name}`);
      } catch (error) {
        console.error(`[campaign-suggest] ✗ Failed to create campaign "${campaign.name}":`, error);
      }
    }

    console.log(`[campaign-suggest] ✅ Created ${created} AI-suggested campaign drafts for review.`);
    console.log("[campaign-suggest] Owner should review and approve campaigns in the CRM > Campaigns section.");

  } catch (error) {
    console.error("[campaign-suggest] Fatal error:", error);
  }
}

// Run the script
suggestCampaigns()
  .then(() => {
    console.log("[campaign-suggest] Script completed.");
    process.exit(0);
  })
  .catch((error) => {
    console.error("[campaign-suggest] Script failed:", error);
    process.exit(1);
  });
