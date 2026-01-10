import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { startOfWeek, startOfMonth, format } from "date-fns";

export const getCustomerAnalytics = baseProcedure
  .input(
    z.object({
      token: z.string(),
      periodType: z.enum(["DAILY", "WEEKLY", "MONTHLY"]).optional().default("MONTHLY"),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.VIEW_DASHBOARD_ANALYTICS);

    // Set default date range (last 12 months if not specified)
    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    const startDate = input.startDate 
      ? new Date(input.startDate) 
      : new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Fetch all customers
    const customers = await db.user.findMany({
      where: {
        role: "CUSTOMER",
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Fetch orders to calculate active customers
    const orders = await db.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        customerEmail: true,
        createdAt: true,
      },
    });

    // Aggregate new customers by period
    const customersByPeriod = new Map<string, { 
      newCustomers: number; 
      activeCustomers: Set<string>;
      date: Date;
    }>();

    // Track new customer registrations
    customers.forEach((customer) => {
      const date = new Date(customer.createdAt);
      let periodKey: string;
      let periodDate: Date;

      switch (input.periodType) {
        case "DAILY":
          periodKey = format(date, "yyyy-MM-dd");
          periodDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          break;
        case "WEEKLY":
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          periodKey = format(weekStart, "yyyy-MM-dd");
          periodDate = weekStart;
          break;
        case "MONTHLY":
          periodKey = format(date, "yyyy-MM");
          periodDate = startOfMonth(date);
          break;
      }

      const existing = customersByPeriod.get(periodKey) || { 
        newCustomers: 0, 
        activeCustomers: new Set<string>(),
        date: periodDate,
      };
      
      customersByPeriod.set(periodKey, {
        newCustomers: existing.newCustomers + 1,
        activeCustomers: existing.activeCustomers,
        date: periodDate,
      });
    });

    // Track active customers (customers who placed orders)
    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      let periodKey: string;
      let periodDate: Date;

      switch (input.periodType) {
        case "DAILY":
          periodKey = format(date, "yyyy-MM-dd");
          periodDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
          break;
        case "WEEKLY":
          const weekStart = startOfWeek(date, { weekStartsOn: 1 });
          periodKey = format(weekStart, "yyyy-MM-dd");
          periodDate = weekStart;
          break;
        case "MONTHLY":
          periodKey = format(date, "yyyy-MM");
          periodDate = startOfMonth(date);
          break;
      }

      const existing = customersByPeriod.get(periodKey) || { 
        newCustomers: 0, 
        activeCustomers: new Set<string>(),
        date: periodDate,
      };
      
      existing.activeCustomers.add(order.customerEmail);
      
      customersByPeriod.set(periodKey, existing);
    });

    // Convert to array and calculate cumulative totals
    let cumulativeCustomers = 0;
    const data = Array.from(customersByPeriod.entries())
      .map(([period, stats]) => {
        cumulativeCustomers += stats.newCustomers;
        return {
          period,
          newCustomers: stats.newCustomers,
          activeCustomers: stats.activeCustomers.size,
          totalCustomers: cumulativeCustomers,
          date: stats.date,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    return data;
  });
