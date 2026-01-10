import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const getSalesPerformance = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate the user and get their role
    const user = await authenticateUser(input.token);

    const startDate = input.startDate ? new Date(input.startDate) : new Date(new Date().setMonth(new Date().getMonth() - 3));
    const endDate = input.endDate ? new Date(input.endDate) : new Date();

    // Build the where clause based on user role
    const whereClause: any = {
      createdAt: {
        gte: startDate,
        lte: endDate,
      },
    };

    // If user is not an admin, only show leads they created
    if (!isAdmin(user)) {
      whereClause.createdById = user.id;
    }
    // If user is an admin, no additional filtering needed (they see all leads)

    // Get all leads in the period with role-based filtering
    const allLeads = await db.lead.findMany({
      where: whereClause,
      include: {
        quotations: {
          select: {
            id: true,
            total: true,
            status: true,
            createdAt: true,
          },
        },
        orders: {
          select: {
            id: true,
            totalCost: true,
            status: true,
            createdAt: true,
          },
        },
      },
    });

    // Calculate conversion rates
    const totalLeads = allLeads.length;
    const contactedLeads = allLeads.filter(l => 
      ["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
    ).length;
    const qualifiedLeads = allLeads.filter(l => 
      ["QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
    ).length;
    const proposalSentLeads = allLeads.filter(l => 
      ["PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(l.status)
    ).length;
    const wonLeads = allLeads.filter(l => l.status === "WON").length;
    const lostLeads = allLeads.filter(l => l.status === "LOST").length;

    // Conversion rates
    const leadToContactedRate = totalLeads > 0 ? (contactedLeads / totalLeads) * 100 : 0;
    const contactedToQualifiedRate = contactedLeads > 0 ? (qualifiedLeads / contactedLeads) * 100 : 0;
    const qualifiedToProposalRate = qualifiedLeads > 0 ? (proposalSentLeads / qualifiedLeads) * 100 : 0;
    const proposalToWonRate = proposalSentLeads > 0 ? (wonLeads / proposalSentLeads) * 100 : 0;
    const overallWinRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;

    // Calculate average deal value from won leads
    const wonLeadsWithValue = allLeads.filter(l => l.status === "WON" && l.estimatedValue);
    const totalWonValue = wonLeadsWithValue.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
    const averageDealValue = wonLeadsWithValue.length > 0 ? totalWonValue / wonLeadsWithValue.length : 0;

    // Calculate pipeline value (all active leads with estimated value)
    const activeLeads = allLeads.filter(l => 
      !["WON", "LOST"].includes(l.status) && l.estimatedValue
    );
    const pipelineValue = activeLeads.reduce((sum, l) => sum + (l.estimatedValue || 0), 0);

    // Calculate average sales cycle (time from lead creation to won)
    const wonLeadsWithDates = allLeads.filter(l => l.status === "WON");
    let averageSalesCycleDays = 0;
    if (wonLeadsWithDates.length > 0) {
      const totalDays = wonLeadsWithDates.reduce((sum, lead) => {
        const createdDate = new Date(lead.createdAt);
        const updatedDate = new Date(lead.updatedAt);
        const diffTime = updatedDate.getTime() - createdDate.getTime();
        const diffDays = diffTime / (1000 * 60 * 60 * 24);
        return sum + diffDays;
      }, 0);
      averageSalesCycleDays = totalDays / wonLeadsWithDates.length;
    }

    // Get leads by status for funnel visualization
    const leadsByStatus = {
      NEW: allLeads.filter(l => l.status === "NEW").length,
      CONTACTED: allLeads.filter(l => l.status === "CONTACTED").length,
      QUALIFIED: allLeads.filter(l => l.status === "QUALIFIED").length,
      PROPOSAL_SENT: allLeads.filter(l => l.status === "PROPOSAL_SENT").length,
      NEGOTIATION: allLeads.filter(l => l.status === "NEGOTIATION").length,
      WON: wonLeads,
      LOST: lostLeads,
    };

    // Calculate monthly trends
    const monthlyData: Record<string, any> = {};
    allLeads.forEach(lead => {
      const monthKey = new Date(lead.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = {
          month: monthKey,
          totalLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          revenue: 0,
        };
      }
      monthlyData[monthKey].totalLeads++;
      if (lead.status === "WON") {
        monthlyData[monthKey].wonLeads++;
        monthlyData[monthKey].revenue += lead.estimatedValue || 0;
      }
      if (lead.status === "LOST") {
        monthlyData[monthKey].lostLeads++;
      }
    });

    const monthlyTrends = Object.values(monthlyData).sort((a: any, b: any) => 
      a.month.localeCompare(b.month)
    );

    // Calculate conversion rate trends (monthly)
    const conversionTrends: Record<string, any> = {};
    allLeads.forEach(lead => {
      const monthKey = new Date(lead.createdAt).toISOString().slice(0, 7); // YYYY-MM
      if (!conversionTrends[monthKey]) {
        conversionTrends[monthKey] = {
          month: monthKey,
          totalLeads: 0,
          wonLeads: 0,
          lostLeads: 0,
          conversionRate: 0,
        };
      }
      conversionTrends[monthKey].totalLeads++;
      if (lead.status === "WON") {
        conversionTrends[monthKey].wonLeads++;
      }
      if (lead.status === "LOST") {
        conversionTrends[monthKey].lostLeads++;
      }
    });

    // Calculate conversion rate for each month
    Object.values(conversionTrends).forEach((trend: any) => {
      trend.conversionRate = trend.totalLeads > 0 
        ? (trend.wonLeads / trend.totalLeads) * 100 
        : 0;
    });

    const conversionRateTrends = Object.values(conversionTrends)
      .map((trend: any) => ({
        ...trend,
        conversionRate: Math.round(trend.conversionRate * 10) / 10,
      }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

    // Calculate pipeline value trends (monthly snapshot)
    // For each month, calculate the pipeline value at the end of that month
    const pipelineTrends: Record<string, any> = {};
    const monthKeys = new Set(allLeads.map(l => new Date(l.createdAt).toISOString().slice(0, 7)));
    
    monthKeys.forEach(monthKey => {
      const endOfMonth = new Date(monthKey + '-01');
      endOfMonth.setMonth(endOfMonth.getMonth() + 1);
      
      // Get all leads that existed at the end of this month and were still active
      const activeLeadsAtMonth = allLeads.filter(lead => {
        const createdDate = new Date(lead.createdAt);
        const updatedDate = new Date(lead.updatedAt);
        
        // Lead was created before or during this month
        const wasCreated = createdDate <= endOfMonth;
        
        // Lead is still active (not won/lost), or was won/lost after this month
        const isStillActive = !["WON", "LOST"].includes(lead.status) || updatedDate > endOfMonth;
        
        return wasCreated && isStillActive && lead.estimatedValue;
      });
      
      pipelineTrends[monthKey] = {
        month: monthKey,
        pipelineValue: activeLeadsAtMonth.reduce((sum, l) => sum + (l.estimatedValue || 0), 0),
        activeLeads: activeLeadsAtMonth.length,
      };
    });

    const pipelineValueTrends = Object.values(pipelineTrends)
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

    // Calculate win rate trends (monthly)
    const winRateTrends = Object.values(conversionTrends)
      .map((trend: any) => ({
        month: trend.month,
        winRate: trend.totalLeads > 0 ? (trend.wonLeads / trend.totalLeads) * 100 : 0,
        wonLeads: trend.wonLeads,
        totalLeads: trend.totalLeads,
      }))
      .map((trend: any) => ({
        ...trend,
        winRate: Math.round(trend.winRate * 10) / 10,
      }))
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

    // Get top performing service types
    const serviceTypePerformance: Record<string, any> = {};
    allLeads.forEach(lead => {
      if (!serviceTypePerformance[lead.serviceType]) {
        serviceTypePerformance[lead.serviceType] = {
          serviceType: lead.serviceType,
          totalLeads: 0,
          wonLeads: 0,
          totalValue: 0,
          winRate: 0,
        };
      }
      serviceTypePerformance[lead.serviceType].totalLeads++;
      if (lead.status === "WON") {
        serviceTypePerformance[lead.serviceType].wonLeads++;
        serviceTypePerformance[lead.serviceType].totalValue += lead.estimatedValue || 0;
      }
    });

    const topServiceTypes = Object.values(serviceTypePerformance)
      .map((st: any) => ({
        ...st,
        winRate: st.totalLeads > 0 ? (st.wonLeads / st.totalLeads) * 100 : 0,
      }))
      .sort((a: any, b: any) => b.totalValue - a.totalValue)
      .slice(0, 5);

    return {
      summary: {
        totalLeads,
        contactedLeads,
        qualifiedLeads,
        proposalSentLeads,
        wonLeads,
        lostLeads,
        activeLeads: activeLeads.length,
        averageDealValue,
        pipelineValue,
        averageSalesCycleDays: Math.round(averageSalesCycleDays),
      },
      conversionRates: {
        leadToContactedRate: Math.round(leadToContactedRate * 10) / 10,
        contactedToQualifiedRate: Math.round(contactedToQualifiedRate * 10) / 10,
        qualifiedToProposalRate: Math.round(qualifiedToProposalRate * 10) / 10,
        proposalToWonRate: Math.round(proposalToWonRate * 10) / 10,
        overallWinRate: Math.round(overallWinRate * 10) / 10,
      },
      leadsByStatus,
      monthlyTrends,
      topServiceTypes,
      conversionRateTrends,
      pipelineValueTrends,
      winRateTrends,
    };
  });
