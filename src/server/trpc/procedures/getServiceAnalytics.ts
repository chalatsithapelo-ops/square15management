import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getServiceAnalytics = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(10),
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

    // Fetch orders within date range
    const orders = await db.order.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        invoice: true,
      },
    });

    // Aggregate by service type
    const serviceStats = new Map<string, { 
      orderCount: number; 
      revenue: number; 
      completedCount: number;
    }>();

    orders.forEach((order) => {
      const serviceType = order.serviceType || "Unknown";
      const existing = serviceStats.get(serviceType) || { 
        orderCount: 0, 
        revenue: 0,
        completedCount: 0,
      };

      const revenue = order.invoice && order.invoice.status === "PAID" 
        ? order.invoice.total 
        : 0;

      serviceStats.set(serviceType, {
        orderCount: existing.orderCount + 1,
        revenue: existing.revenue + revenue,
        completedCount: existing.completedCount + (order.status === "COMPLETED" ? 1 : 0),
      });
    });

    // Convert to array and sort by order count (popularity)
    const data = Array.from(serviceStats.entries())
      .map(([serviceType, stats]) => ({
        serviceType,
        orderCount: stats.orderCount,
        revenue: stats.revenue,
        completedCount: stats.completedCount,
        averageRevenue: stats.orderCount > 0 ? stats.revenue / stats.orderCount : 0,
      }))
      .sort((a, b) => b.orderCount - a.orderCount)
      .slice(0, input.limit);

    return data;
  });
