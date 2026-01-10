import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getPMFinancialReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      reportType: z.enum(["INCOME_STATEMENT", "BALANCE_SHEET", "CASH_FLOW"]).default("INCOME_STATEMENT"),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can view financial reports",
      });
    }

    try {
      const where: any = { propertyManagerId: user.id };
      if (input.periodStart && input.periodEnd) {
        where.periodStart = { gte: input.periodStart };
        where.periodEnd = { lte: input.periodEnd };
      }

      const metrics = await db.propertyManagerFinancialMetrics.findMany({
        where,
        orderBy: { periodStart: "desc" },
        take: 24, // Last 24 periods
      });

      if (input.reportType === "INCOME_STATEMENT") {
        return {
          success: true,
          reportType: "INCOME_STATEMENT",
          propertyManager: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
          },
          incomeStatements: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            revenue: {
              totalRentalIncome: m.totalRentalIncome,
              maintenanceFees: m.maintenanceFees,
              otherIncome: m.otherIncome,
              totalIncome: m.totalIncome,
            },
            expenses: {
              maintenanceExpenses: m.maintenanceExpenses,
              utilities: m.utilities,
              propertyTax: m.propertyTax,
              insurance: m.insurance,
              staffSalaries: m.staffSalaries,
              contractorPayments: m.contractorPayments,
              administrativeExpenses: m.administrativeExpenses,
              otherExpenses: m.otherExpenses,
              totalExpenses: m.totalExpenses,
            },
            profitAndLoss: {
              operatingProfit: m.operatingProfit,
              profitMargin: m.profitMargin,
            },
          })),
        };
      } else if (input.reportType === "BALANCE_SHEET") {
        return {
          success: true,
          reportType: "BALANCE_SHEET",
          propertyManager: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
          },
          balanceSheets: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            assets: {
              totalPropertyValue: m.totalPropertyValue,
              totalDeposits: m.totalDeposits,
              totalAssets: m.totalAssets,
            },
            liabilities: {
              totalMortgages: m.totalMortgages,
              totalLoans: m.totalLoans,
              totalLiabilities: m.totalLiabilities,
            },
            equity: {
              totalEquity: m.totalEquity,
            },
            ratios: {
              debtToEquityRatio: m.overallDebtToEquityRatio,
              returnOnAssets: m.overallReturnOnAssets,
            },
            properties: {
              numberOfProperties: m.numberOfProperties,
              averageOccupancyRate: m.overallOccupancyRate,
            },
          })),
        };
      } else {
        return {
          success: true,
          reportType: "CASH_FLOW",
          propertyManager: {
            id: user.id,
            name: `${user.firstName} ${user.lastName}`,
          },
          summary: metrics.length > 0 ? {
            latestPeriod: {
              period: `${metrics[0].periodStart.toLocaleDateString()} - ${metrics[0].periodEnd.toLocaleDateString()}`,
              operatingCashFlow: metrics[0].operatingCashFlow,
              netCashFlow: metrics[0].netCashFlow,
            },
            totals: {
              totalOperatingCashFlow: metrics.reduce((sum, m) => sum + m.operatingCashFlow, 0),
              totalNetCashFlow: metrics.reduce((sum, m) => sum + m.netCashFlow, 0),
            },
          } : null,
          cashFlowStatements: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            operatingCashFlow: m.operatingCashFlow,
            netCashFlow: m.netCashFlow,
          })),
        };
      }
    } catch (error) {
      console.error("Error fetching PM financial report:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch financial report",
      });
    }
  });
