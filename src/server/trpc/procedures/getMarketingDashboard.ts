import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getMarketingDashboard = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // ── Lead Metrics ──
    const [totalLeads, newLeads30d, prevPeriodLeads, wonLeads, lostLeads, activeLeads] = await Promise.all([
      db.lead.count(),
      db.lead.count({ where: { createdAt: { gte: thirtyDaysAgo } } }),
      db.lead.count({ where: { createdAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      db.lead.count({ where: { status: "WON" } }),
      db.lead.count({ where: { status: "LOST" } }),
      db.lead.count({ where: { status: { notIn: ["WON", "LOST"] } } }),
    ]);

    // ── Pipeline Value ──
    const [pipelineValue, wonValue] = await Promise.all([
      db.lead.aggregate({
        where: { status: { notIn: ["WON", "LOST"] } },
        _sum: { estimatedValue: true },
      }),
      db.lead.aggregate({
        where: { status: "WON" },
        _sum: { estimatedValue: true },
      }),
    ]);

    // ── Lead Status Breakdown ──
    const leadsByStatus = await db.lead.groupBy({
      by: ["status"],
      _count: true,
      orderBy: { _count: { status: "desc" } },
    });

    // ── Lead Source Breakdown ──
    // @ts-ignore - source field added to schema, TS server may need restart after prisma generate
    const leadsBySource: Array<{ source: string; _count: number }> = await db.lead.groupBy({
      by: ["source"] as any,
      _count: true,
      orderBy: { _count: { source: "desc" } } as any,
    });

    // ── Source conversion rates  ──
    // @ts-ignore - source field exists in generated client
    const allLeadsRaw = await db.lead.findMany({}) as unknown as any[];
    const sourceStats: Record<string, { total: number; won: number; value: number }> = {};
    for (const lead of allLeadsRaw) {
      const src = lead.source || "OTHER";
      if (!sourceStats[src]) sourceStats[src] = { total: 0, won: 0, value: 0 };
      sourceStats[src].total++;
      if (lead.status === "WON") {
        sourceStats[src].won++;
        sourceStats[src].value += lead.estimatedValue || 0;
      }
    }

    // ── Campaign Metrics ──
    const [totalCampaigns, sentCampaigns, draftCampaigns, scheduledCampaigns] = await Promise.all([
      db.campaign.count(),
      db.campaign.count({ where: { status: "SENT" } }),
      db.campaign.count({ where: { status: "DRAFT" } }),
      db.campaign.count({ where: { status: "SCHEDULED" } }),
    ]);

    const emailStats = await db.campaign.aggregate({
      _sum: { totalSent: true, totalFailed: true, totalRecipients: true },
    });

    const recentCampaigns = await db.campaign.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        name: true,
        status: true,
        totalSent: true,
        totalRecipients: true,
        totalFailed: true,
        sentAt: true,
        createdAt: true,
        scheduledFor: true,
      },
    });

    // ── Reviews / Reputation ──
    const reviewStats = await db.review.aggregate({
      _avg: { rating: true },
      _count: true,
    });

    const recentReviews = await db.review.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      include: {
        customer: { select: { firstName: true, lastName: true } },
      },
    });

    // ── Follow-ups ──
    const overdueFU = await db.lead.count({
      where: { nextFollowUpDate: { lt: now }, status: { notIn: ["WON", "LOST"] } },
    });
    const upcomingFU = await db.lead.count({
      where: {
        nextFollowUpDate: { gte: now, lte: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
        status: { notIn: ["WON", "LOST"] },
      },
    });

    // ── Top Services ──
    const serviceBreakdown = await db.lead.groupBy({
      by: ["serviceType"],
      _count: true,
      orderBy: { _count: { serviceType: "desc" } },
      take: 10,
    });

    const convRate = wonLeads + lostLeads > 0 ? ((wonLeads / (wonLeads + lostLeads)) * 100) : 0;
    const leadGrowth = prevPeriodLeads > 0 ? (((newLeads30d - prevPeriodLeads) / prevPeriodLeads) * 100) : null;

    return {
      leads: {
        total: totalLeads,
        new30d: newLeads30d,
        won: wonLeads,
        lost: lostLeads,
        active: activeLeads,
        conversionRate: Math.round(convRate * 10) / 10,
        leadGrowth: leadGrowth !== null ? Math.round(leadGrowth * 10) / 10 : null,
        pipelineValue: pipelineValue._sum.estimatedValue || 0,
        wonValue: wonValue._sum.estimatedValue || 0,
      },
      leadsByStatus: leadsByStatus.map((s) => ({ status: s.status, count: s._count })),
      leadsBySource: leadsBySource.map((s) => ({ source: s.source, count: s._count })),
      sourceStats: Object.entries(sourceStats).map(([source, data]) => ({
        source,
        total: data.total,
        won: data.won,
        value: data.value,
        conversionRate: data.total > 0 ? Math.round(((data.won / data.total) * 100) * 10) / 10 : 0,
      })),
      campaigns: {
        total: totalCampaigns,
        sent: sentCampaigns,
        draft: draftCampaigns,
        scheduled: scheduledCampaigns,
        totalEmailsSent: emailStats._sum.totalSent || 0,
        totalEmailsFailed: emailStats._sum.totalFailed || 0,
        deliveryRate:
          (emailStats._sum.totalSent || 0) + (emailStats._sum.totalFailed || 0) > 0
            ? Math.round(
                (((emailStats._sum.totalSent || 0) /
                  ((emailStats._sum.totalSent || 0) + (emailStats._sum.totalFailed || 0))) *
                  100) *
                  10
              ) / 10
            : 0,
      },
      recentCampaigns,
      reviews: {
        avgRating: reviewStats._avg.rating ? Math.round(reviewStats._avg.rating * 10) / 10 : null,
        totalCount: reviewStats._count,
      },
      recentReviews: recentReviews.map((r) => ({
        rating: r.rating,
        comment: r.comment,
        customerName: `${r.customer.firstName} ${r.customer.lastName}`,
        createdAt: r.createdAt,
      })),
      followUps: {
        overdue: overdueFU,
        upcoming7d: upcomingFU,
      },
      topServices: serviceBreakdown.map((s) => ({ service: s.serviceType, count: s._count })),
    };
  });
