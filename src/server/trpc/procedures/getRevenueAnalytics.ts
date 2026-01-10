import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { startOfWeek, startOfMonth, format } from "date-fns";

export const getRevenueAnalytics = baseProcedure
  .input(
    z.object({
      token: z.string(),
      periodType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.VIEW_DASHBOARD_ANALYTICS);

    // Set default date range (last 90 days if not specified)
    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    const startDate = input.startDate 
      ? new Date(input.startDate) 
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    // Fetch paid invoices within date range
    const invoices = await db.invoice.findMany({
      where: {
        status: "PAID",
        paidDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        paidDate: "asc",
      },
    });

    // Aggregate revenue by period
    const revenueByPeriod = new Map<string, { revenue: number; count: number; date: Date }>();

    invoices.forEach((invoice) => {
      const date = new Date(invoice.paidDate || invoice.createdAt);
      let periodKey: string;
      let periodDate: Date;

      switch (input.periodType) {
        case "DAILY":
          periodKey = format(date, "yyyy-MM-dd");
          periodDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          break;
        case "WEEKLY":
          const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Monday
          periodKey = format(weekStart, "yyyy-MM-dd");
          periodDate = weekStart;
          break;
        case "MONTHLY":
          periodKey = format(date, "yyyy-MM");
          periodDate = startOfMonth(date);
          break;
      }

      const existing = revenueByPeriod.get(periodKey) || { revenue: 0, count: 0, date: periodDate };
      revenueByPeriod.set(periodKey, {
        revenue: existing.revenue + invoice.total,
        count: existing.count + 1,
        date: periodDate,
      });
    });

    // Convert to array and sort by date
    const data = Array.from(revenueByPeriod.entries())
      .map(([period, stats]) => ({
        period,
        revenue: stats.revenue,
        invoiceCount: stats.count,
        date: stats.date,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return data;
  });
