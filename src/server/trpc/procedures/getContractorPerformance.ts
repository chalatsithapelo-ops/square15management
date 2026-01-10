import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getContractorPerformance = baseProcedure
  .input(
    z.object({
      token: z.string(),
      contractorId: z.number(),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can view contractor performance",
      });
    }

    try {
      // Verify contractor belongs to this property manager
      const contractor = await db.contractor.findFirst({
        where: {
          id: input.contractorId,
          propertyManagerId: user.id,
        },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      const where: any = { contractorId: input.contractorId };
      if (input.periodStart && input.periodEnd) {
        where.periodStart = { gte: input.periodStart };
        where.periodEnd = { lte: input.periodEnd };
      }

      const performanceMetrics = await db.contractorPerformance.findMany({
        where,
        orderBy: { periodStart: "desc" },
        take: 12, // Last 12 periods
      });

      // Get active KPIs
      const kpis = await db.contractorKPI.findMany({
        where: {
          contractorId: input.contractorId,
          status: "ACTIVE",
        },
      });

      return {
        success: true,
        contractor: {
          id: contractor.id,
          name: `${contractor.firstName} ${contractor.lastName}`,
          companyName: contractor.companyName,
          totalJobsCompleted: contractor.totalJobsCompleted,
          averageRating: contractor.averageRating,
          totalSpent: contractor.totalSpent,
        },
        performanceMetrics: performanceMetrics.map((pm) => ({
          id: pm.id,
          period: `${pm.periodStart.toLocaleDateString()} - ${pm.periodEnd.toLocaleDateString()}`,
          periodStart: pm.periodStart,
          periodEnd: pm.periodEnd,
          jobsCompleted: pm.jobsCompleted,
          jobsOnTime: pm.jobsOnTime,
          onTimePercentage: pm.onTimePercentage,
          completionRate: pm.completionRate,
          qualityScore: pm.qualityScore,
          customerSatisfaction: pm.customerSatisfaction,
          overallRating: pm.overallRating,
          totalRevenueGenerated: pm.totalRevenueGenerated,
          averageJobValue: pm.averageJobValue,
          profitMargin: pm.profitMargin,
        })),
        kpis: kpis.map((kpi) => ({
          id: kpi.id,
          kpiName: kpi.kpiName,
          targetValue: kpi.targetValue,
          actualValue: kpi.actualValue,
          achievementRate: kpi.achievementRate,
          unit: kpi.unit,
          frequency: kpi.frequency,
        })),
      };
    } catch (error) {
      console.error("Error fetching contractor performance:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch performance data",
      });
    }
  });
