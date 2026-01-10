import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getEmployeePerformanceHistory = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      months: z.number().default(6).optional(), // Number of months to look back
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const monthsBack = input.months || 6;
    const startDate = new Date();
    startDate.setMonth(startDate.getMonth() - monthsBack);

    // Fetch the employee
    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        createdAt: true,
      },
    });

    if (!employee) {
      throw new Error("Employee not found");
    }

    // Fetch historical KPIs
    const kpis = await db.employeeKPI.findMany({
      where: {
        employeeId: input.employeeId,
        periodStart: {
          gte: startDate,
        },
      },
      orderBy: {
        periodStart: "asc",
      },
    });

    // Fetch all leads created by this employee
    const leads = await db.lead.findMany({
      where: {
        createdById: input.employeeId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Fetch completed orders assigned to this employee (if artisan)
    const completedOrders = await db.order.findMany({
      where: {
        assignedToId: input.employeeId,
        status: "COMPLETED",
        endTime: {
          gte: startDate,
        },
      },
      orderBy: {
        endTime: "asc",
      },
    });

    // Fetch reviews for this employee (if artisan)
    const reviews = await db.review.findMany({
      where: {
        artisanId: input.employeeId,
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Aggregate leads by month
    const leadsByMonth = new Map<string, any>();
    leads.forEach((lead) => {
      const monthKey = lead.createdAt.toISOString().substring(0, 7); // YYYY-MM
      if (!leadsByMonth.has(monthKey)) {
        leadsByMonth.set(monthKey, {
          period: monthKey,
          total: 0,
          won: 0,
          lost: 0,
          contacted: 0,
          totalValue: 0,
          wonValue: 0,
        });
      }
      const monthData = leadsByMonth.get(monthKey)!;
      monthData.total++;
      if (lead.status === "WON") {
        monthData.won++;
        monthData.wonValue += lead.estimatedValue || 0;
      }
      if (lead.status === "LOST") {
        monthData.lost++;
      }
      if (["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(lead.status)) {
        monthData.contacted++;
      }
      monthData.totalValue += lead.estimatedValue || 0;
    });

    // Calculate monthly metrics
    const monthlyMetrics = Array.from(leadsByMonth.values()).map((month) => ({
      period: month.period,
      date: new Date(month.period + "-01"),
      totalLeads: month.total,
      wonLeads: month.won,
      lostLeads: month.lost,
      conversionRate: month.total > 0 ? (month.won / month.total) * 100 : 0,
      contactRate: month.total > 0 ? (month.contacted / month.total) * 100 : 0,
      totalValue: month.totalValue,
      wonValue: month.wonValue,
      avgDealValue: month.won > 0 ? month.wonValue / month.won : 0,
    }));

    // Aggregate orders by month
    const ordersByMonth = new Map<string, any>();
    completedOrders.forEach((order) => {
      if (!order.endTime) return;
      const monthKey = order.endTime.toISOString().substring(0, 7);
      if (!ordersByMonth.has(monthKey)) {
        ordersByMonth.set(monthKey, {
          period: monthKey,
          count: 0,
          totalRevenue: 0,
        });
      }
      const monthData = ordersByMonth.get(monthKey)!;
      monthData.count++;
      monthData.totalRevenue += order.totalCost || 0;
    });

    const monthlyOrders = Array.from(ordersByMonth.values()).map((month) => ({
      period: month.period,
      date: new Date(month.period + "-01"),
      completedOrders: month.count,
      totalRevenue: month.totalRevenue,
    }));

    // Aggregate reviews by month
    const reviewsByMonth = new Map<string, any>();
    reviews.forEach((review) => {
      const monthKey = review.createdAt.toISOString().substring(0, 7);
      if (!reviewsByMonth.has(monthKey)) {
        reviewsByMonth.set(monthKey, {
          period: monthKey,
          count: 0,
          totalRating: 0,
        });
      }
      const monthData = reviewsByMonth.get(monthKey)!;
      monthData.count++;
      monthData.totalRating += review.rating;
    });

    const monthlyReviews = Array.from(reviewsByMonth.values()).map((month) => ({
      period: month.period,
      date: new Date(month.period + "-01"),
      reviewCount: month.count,
      avgRating: month.count > 0 ? month.totalRating / month.count : 0,
    }));

    // Calculate overall summary statistics
    const totalLeads = leads.length;
    const wonLeads = leads.filter((l) => l.status === "WON").length;
    const overallConversionRate = totalLeads > 0 ? (wonLeads / totalLeads) * 100 : 0;
    const totalWonValue = leads
      .filter((l) => l.status === "WON")
      .reduce((sum, l) => sum + (l.estimatedValue || 0), 0);
    const avgDealValue = wonLeads > 0 ? totalWonValue / wonLeads : 0;
    const totalOrdersCompleted = completedOrders.length;
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (o.totalCost || 0), 0);
    const avgRating = reviews.length > 0 
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length 
      : 0;

    // Calculate response time more accurately
    // Response time = time from lead creation to first contact (status change from NEW)
    let totalResponseTimeHours = 0;
    let responseTimeCount = 0;

    leads.forEach((lead) => {
      // Only count leads that were contacted (moved past NEW status)
      if (["CONTACTED", "QUALIFIED", "PROPOSAL_SENT", "NEGOTIATION", "WON"].includes(lead.status)) {
        const createdTime = new Date(lead.createdAt).getTime();
        const updatedTime = new Date(lead.updatedAt).getTime();
        
        // Only count if there's a meaningful time difference (more than 1 minute)
        const diffHours = (updatedTime - createdTime) / (1000 * 60 * 60);
        if (diffHours > 0.017) { // More than 1 minute
          totalResponseTimeHours += diffHours;
          responseTimeCount++;
        }
      }
    });

    const avgResponseTimeHours = responseTimeCount > 0 ? totalResponseTimeHours / responseTimeCount : 0;

    // Add response time to summary
    const summary = {
      totalLeads,
      wonLeads,
      conversionRate: Math.round(overallConversionRate * 10) / 10,
      totalWonValue: Math.round(totalWonValue),
      avgDealValue: Math.round(avgDealValue),
      totalOrdersCompleted,
      totalRevenue: Math.round(totalRevenue),
      avgRating: Math.round(avgRating * 10) / 10,
      reviewCount: reviews.length,
      avgResponseTimeHours: Math.round(avgResponseTimeHours * 10) / 10,
    };

    return {
      employee,
      summary,
      monthlyMetrics: monthlyMetrics.sort((a, b) => a.date.getTime() - b.date.getTime()),
      monthlyOrders: monthlyOrders.sort((a, b) => a.date.getTime() - b.date.getTime()),
      monthlyReviews: monthlyReviews.sort((a, b) => a.date.getTime() - b.date.getTime()),
      kpis,
    };
  });
