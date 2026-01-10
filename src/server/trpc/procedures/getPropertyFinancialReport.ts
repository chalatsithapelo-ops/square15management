import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getPropertyFinancialReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number(),
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
      // Verify building belongs to this property manager
      const building = await db.building.findFirst({
        where: {
          id: input.buildingId,
          propertyManagerId: user.id,
        },
      });

      if (!building) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Building not found",
        });
      }

      const where: any = { buildingId: input.buildingId };
      if (input.periodStart && input.periodEnd) {
        where.periodStart = { gte: input.periodStart };
        where.periodEnd = { lte: input.periodEnd };
      }

      const metrics = await db.propertyFinancialMetrics.findMany({
        where,
        orderBy: { periodStart: "desc" },
        take: 24, // Last 24 periods
      });

      if (input.reportType === "INCOME_STATEMENT") {
        return {
          success: true,
          reportType: "INCOME_STATEMENT",
          building: {
            id: building.id,
            name: building.name,
            address: building.address,
          },
          incomeStatements: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            revenue: {
              rentalIncome: m.rentalIncome,
              maintenanceFees: m.maintenanceFees,
              depositInterest: m.depositInterest,
              otherIncome: m.otherIncome,
              totalIncome: m.totalIncome,
            },
            expenses: {
              maintenanceExpenses: m.maintenanceExpenses,
              utilities: m.utilities,
              propertyTax: m.propertyTax,
              insurance: m.insurance,
              staffSalaries: m.staffSalaries,
              marketingExpenses: m.marketingExpenses,
              administrativeExpenses: m.administrativeExpenses,
              contractorPayments: m.contractorPayments,
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
          building: {
            id: building.id,
            name: building.name,
            address: building.address,
          },
          balanceSheets: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            assets: {
              buildingValue: m.buildingValue,
              improvements: m.improvements,
              deposits: m.deposits,
              otherAssets: m.otherAssets,
              totalAssets: m.totalAssets,
            },
            liabilities: {
              mortgage: m.mortgage,
              loans: m.loans,
              accountsPayable: m.accountsPayable,
              otherLiabilities: m.otherLiabilities,
              totalLiabilities: m.totalLiabilities,
            },
            equity: {
              totalEquity: m.equity,
            },
            ratios: {
              debtToEquityRatio: m.debtToEquityRatio,
              returnOnAssets: m.returnOnAssets,
            },
          })),
        };
      } else {
        return {
          success: true,
          reportType: "CASH_FLOW",
          building: {
            id: building.id,
            name: building.name,
            address: building.address,
          },
          cashFlowStatements: metrics.map((m) => ({
            period: `${m.periodStart.toLocaleDateString()} - ${m.periodEnd.toLocaleDateString()}`,
            periodStart: m.periodStart,
            periodEnd: m.periodEnd,
            operatingActivities: m.operatingCashFlow,
            investingActivities: m.investingCashFlow,
            financingActivities: m.financingCashFlow,
            netCashFlow: m.netCashFlow,
          })),
        };
      }
    } catch (error) {
      console.error("Error fetching financial report:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch financial report",
      });
    }
  });
