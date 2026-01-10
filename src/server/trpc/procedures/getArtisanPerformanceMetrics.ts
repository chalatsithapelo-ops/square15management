import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getArtisanPerformanceMetrics = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (user.role !== "ARTISAN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only artisans can access performance metrics",
        });
      }

      // Fetch all completed orders for the artisan
      const completedOrders = await db.order.findMany({
        where: {
          assignedToId: user.id,
          status: "COMPLETED",
        },
        include: {
          jobActivities: true,
        },
      });

      // Fetch invoices for additional revenue
      const invoices = await db.invoice.findMany({
        where: {
          order: {
            assignedToId: user.id,
          },
        },
      });

      // Fetch approved quotations for cost calculations
      const approvedQuotations = await db.quotation.findMany({
        where: {
          assignedToId: user.id,
          status: "APPROVED",
        },
      });

      // Fetch all payment requests for the artisan
      const paymentRequests = await db.paymentRequest.findMany({
        where: {
          artisanId: user.id,
        },
      });

      // Calculate metrics
      const totalCompletedJobs = completedOrders.length;

      const paidPaymentRequests = paymentRequests.filter((pr) => pr.status === "PAID");
      const totalEarnings = paidPaymentRequests.reduce(
        (sum, pr) => sum + pr.calculatedAmount,
        0
      );

      const pendingPaymentRequests = paymentRequests.filter(
        (pr) => pr.status === "PENDING" || pr.status === "APPROVED"
      );
      const pendingEarnings = pendingPaymentRequests.reduce(
        (sum, pr) => sum + pr.calculatedAmount,
        0
      );

      // Calculate total hours and days worked
      const totalHoursWorked = paymentRequests.reduce(
        (sum, pr) => sum + (pr.hoursWorked || 0),
        0
      );
      const totalDaysWorked = paymentRequests.reduce(
        (sum, pr) => sum + (pr.daysWorked || 0),
        0
      );

      // Calculate average job duration from job activities
      const allJobActivities = completedOrders.flatMap((order) => order.jobActivities);
      const totalDurationMinutes = allJobActivities.reduce(
        (sum, activity) => sum + (activity.durationMinutes || 0),
        0
      );
      const averageJobDurationMinutes =
        allJobActivities.length > 0 ? totalDurationMinutes / allJobActivities.length : 0;

      // Calculate labor vs material costs (including approved quotations)
      const orderLaborCost = completedOrders.reduce(
        (sum, order) => sum + order.labourCost,
        0
      );
      const quotationLaborCost = approvedQuotations.reduce(
        (sum, quotation) => sum + (quotation.companyLabourCost || 0),
        0
      );
      const totalLaborCost = orderLaborCost + quotationLaborCost;
      
      const orderMaterialCost = completedOrders.reduce(
        (sum, order) => sum + order.materialCost,
        0
      );
      const quotationMaterialCost = approvedQuotations.reduce(
        (sum, quotation) => sum + (quotation.companyMaterialCost || 0),
        0
      );
      const totalMaterialCost = orderMaterialCost + quotationMaterialCost;

      // Calculate total revenue from completed orders AND paid invoices
      const orderRevenue = completedOrders.reduce(
        (sum, order) => sum + order.totalCost,
        0
      );
      
      const invoiceRevenue = invoices
        .filter((i) => i.status === "PAID")
        .reduce((sum, i) => sum + i.total, 0);
      
      const totalRevenue = orderRevenue + invoiceRevenue;

      // Calculate average earnings per job
      const averageEarningsPerJob =
        totalCompletedJobs > 0 ? totalEarnings / totalCompletedJobs : 0;

      // Calculate average rating from customer reviews
      const reviews = await db.review.findMany({
        where: {
          artisanId: user.id,
        },
      });

      const avgRating =
        reviews.length > 0
          ? reviews.reduce((sum, review) => sum + review.rating, 0) / reviews.length
          : 0;

      const avgServiceQuality =
        reviews.filter((r) => r.serviceQuality !== null).length > 0
          ? reviews
              .filter((r) => r.serviceQuality !== null)
              .reduce((sum, r) => sum + (r.serviceQuality || 0), 0) /
            reviews.filter((r) => r.serviceQuality !== null).length
          : 0;

      const avgProfessionalism =
        reviews.filter((r) => r.professionalism !== null).length > 0
          ? reviews
              .filter((r) => r.professionalism !== null)
              .reduce((sum, r) => sum + (r.professionalism || 0), 0) /
            reviews.filter((r) => r.professionalism !== null).length
          : 0;

      const avgTimeliness =
        reviews.filter((r) => r.timeliness !== null).length > 0
          ? reviews
              .filter((r) => r.timeliness !== null)
              .reduce((sum, r) => sum + (r.timeliness || 0), 0) /
            reviews.filter((r) => r.timeliness !== null).length
          : 0;

      // Fetch all milestones assigned to the artisan for on-time completion rate
      const artisanMilestones = await db.milestone.findMany({
        where: {
          assignedToId: user.id,
        },
      });

      const completedMilestones = artisanMilestones.filter((m) => m.status === "COMPLETED");
      const totalCompletedMilestones = completedMilestones.length;

      const onTimeMilestones = completedMilestones.filter((m) => {
        // Check if both dates exist and actual completion was on or before the planned end date
        return m.actualEndDate && m.endDate && m.actualEndDate.getTime() <= m.endDate.getTime();
      }).length;

      const onTimeCompletionRate =
        totalCompletedMilestones > 0
          ? (onTimeMilestones / totalCompletedMilestones) * 100
          : 0;

      // Calculate monthly earnings for the last 6 months
      const sixMonthsAgo = new Date();
      sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

      const monthlyEarnings: { month: string; earnings: number }[] = [];
      for (let i = 5; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStart = new Date(date.getFullYear(), date.getMonth(), 1);
        const monthEnd = new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59);

        const monthPayments = paidPaymentRequests.filter((pr) => {
          const paidDate = pr.paidDate;
          return paidDate && paidDate >= monthStart && paidDate <= monthEnd;
        });

        const monthEarnings = monthPayments.reduce(
          (sum, pr) => sum + pr.calculatedAmount,
          0
        );

        monthlyEarnings.push({
          month: date.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
          earnings: monthEarnings,
        });
      }

      // Calculate this month's earnings
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisMonthPayments = paidPaymentRequests.filter((pr) => {
        const paidDate = pr.paidDate;
        return paidDate && paidDate >= thisMonthStart;
      });
      const thisMonthEarnings = thisMonthPayments.reduce(
        (sum, pr) => sum + pr.calculatedAmount,
        0
      );

      return {
        totalCompletedJobs,
        totalEarnings,
        pendingEarnings,
        totalHoursWorked,
        totalDaysWorked,
        averageJobDurationMinutes,
        averageEarningsPerJob,
        totalLaborCost,
        totalMaterialCost,
        overallRevenue: totalRevenue,
        onTimeCompletionRate: parseFloat(onTimeCompletionRate.toFixed(1)),
        monthlyEarnings,
        thisMonthEarnings,
        avgRating: Math.round(avgRating * 10) / 10,
        avgServiceQuality: Math.round(avgServiceQuality * 10) / 10,
        avgProfessionalism: Math.round(avgProfessionalism * 10) / 10,
        avgTimeliness: Math.round(avgTimeliness * 10) / 10,
        totalReviews: reviews.length,
      };
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
