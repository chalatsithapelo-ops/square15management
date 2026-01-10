import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createPropertyFinancialMetricsSchema = z.object({
  token: z.string(),
  buildingId: z.number(),
  periodStart: z.date(),
  periodEnd: z.date(),
  periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).default("MONTHLY"),
  // Income
  rentalIncome: z.number().default(0),
  maintenanceFees: z.number().default(0),
  depositInterest: z.number().default(0),
  otherIncome: z.number().default(0),
  // Expenses
  maintenanceExpenses: z.number().default(0),
  utilities: z.number().default(0),
  propertyTax: z.number().default(0),
  insurance: z.number().default(0),
  staffSalaries: z.number().default(0),
  marketingExpenses: z.number().default(0),
  administrativeExpenses: z.number().default(0),
  contractorPayments: z.number().default(0),
  otherExpenses: z.number().default(0),
  // Assets
  buildingValue: z.number().default(0),
  improvements: z.number().default(0),
  deposits: z.number().default(0),
  otherAssets: z.number().default(0),
  // Liabilities
  mortgage: z.number().default(0),
  loans: z.number().default(0),
  accountsPayable: z.number().default(0),
  otherLiabilities: z.number().default(0),
  // Cash Flow
  operatingCashFlow: z.number().default(0),
  investingCashFlow: z.number().default(0),
  financingCashFlow: z.number().default(0),
  // Metrics
  occupancyRate: z.number().default(0),
  notes: z.string().optional(),
});

export const createPropertyFinancialMetrics = baseProcedure
  .input(createPropertyFinancialMetricsSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can create financial metrics",
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

      // Calculate totals
      const totalIncome =
        input.rentalIncome +
        input.maintenanceFees +
        input.depositInterest +
        input.otherIncome;

      const totalExpenses =
        input.maintenanceExpenses +
        input.utilities +
        input.propertyTax +
        input.insurance +
        input.staffSalaries +
        input.marketingExpenses +
        input.administrativeExpenses +
        input.contractorPayments +
        input.otherExpenses;

      const operatingProfit = totalIncome - totalExpenses;
      const profitMargin = totalIncome > 0 ? (operatingProfit / totalIncome) * 100 : 0;

      const totalAssets =
        input.buildingValue +
        input.improvements +
        input.deposits +
        input.otherAssets;

      const totalLiabilities =
        input.mortgage +
        input.loans +
        input.accountsPayable +
        input.otherLiabilities;

      const equity = totalAssets - totalLiabilities;
      const netCashFlow =
        input.operatingCashFlow +
        input.investingCashFlow +
        input.financingCashFlow;

      const metrics = await db.propertyFinancialMetrics.create({
        data: {
          buildingId: input.buildingId,
          propertyManagerId: user.id,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          periodType: input.periodType,
          rentalIncome: input.rentalIncome,
          maintenanceFees: input.maintenanceFees,
          depositInterest: input.depositInterest,
          otherIncome: input.otherIncome,
          totalIncome,
          maintenanceExpenses: input.maintenanceExpenses,
          utilities: input.utilities,
          propertyTax: input.propertyTax,
          insurance: input.insurance,
          staffSalaries: input.staffSalaries,
          marketingExpenses: input.marketingExpenses,
          administrativeExpenses: input.administrativeExpenses,
          contractorPayments: input.contractorPayments,
          otherExpenses: input.otherExpenses,
          totalExpenses,
          operatingProfit,
          profitMargin,
          buildingValue: input.buildingValue,
          improvements: input.improvements,
          deposits: input.deposits,
          otherAssets: input.otherAssets,
          totalAssets,
          mortgage: input.mortgage,
          loans: input.loans,
          accountsPayable: input.accountsPayable,
          otherLiabilities: input.otherLiabilities,
          totalLiabilities,
          equity,
          operatingCashFlow: input.operatingCashFlow,
          investingCashFlow: input.investingCashFlow,
          financingCashFlow: input.financingCashFlow,
          netCashFlow,
          occupancyRate: input.occupancyRate,
          debtToEquityRatio:
            equity > 0 ? totalLiabilities / equity : 0,
          returnOnAssets:
            totalAssets > 0 ? (operatingProfit / totalAssets) * 100 : 0,
          notes: input.notes,
        },
      });

      return {
        success: true,
        metrics: {
          id: metrics.id,
          periodStart: metrics.periodStart,
          periodEnd: metrics.periodEnd,
          totalIncome: metrics.totalIncome,
          totalExpenses: metrics.totalExpenses,
          operatingProfit: metrics.operatingProfit,
          profitMargin: metrics.profitMargin,
        },
        message: "Financial metrics created successfully",
      };
    } catch (error) {
      console.error("Error creating financial metrics:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create financial metrics",
      });
    }
  });
