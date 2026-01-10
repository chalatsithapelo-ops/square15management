import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createPMFinancialMetricsSchema = z.object({
  token: z.string(),
  periodStart: z.date(),
  periodEnd: z.date(),
  periodType: z.enum(["MONTHLY", "QUARTERLY", "ANNUAL"]).default("MONTHLY"),
  // Income
  totalRentalIncome: z.number().default(0),
  maintenanceFees: z.number().default(0),
  otherIncome: z.number().default(0),
  // Expenses
  maintenanceExpenses: z.number().default(0),
  utilities: z.number().default(0),
  propertyTax: z.number().default(0),
  insurance: z.number().default(0),
  staffSalaries: z.number().default(0),
  contractorPayments: z.number().default(0),
  administrativeExpenses: z.number().default(0),
  otherExpenses: z.number().default(0),
  // Assets
  totalPropertyValue: z.number().default(0),
  totalDeposits: z.number().default(0),
  // Liabilities
  totalMortgages: z.number().default(0),
  totalLoans: z.number().default(0),
  totalLiabilities: z.number().default(0),
  // Metrics
  numberOfProperties: z.number().default(0),
  overallOccupancyRate: z.number().default(0),
  notes: z.string().optional(),
});

export const createPMFinancialMetrics = baseProcedure
  .input(createPMFinancialMetricsSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can create financial metrics",
      });
    }

    try {
      // Calculate totals
      const totalIncome =
        input.totalRentalIncome + input.maintenanceFees + input.otherIncome;

      const totalExpenses =
        input.maintenanceExpenses +
        input.utilities +
        input.propertyTax +
        input.insurance +
        input.staffSalaries +
        input.contractorPayments +
        input.administrativeExpenses +
        input.otherExpenses;

      const operatingProfit = totalIncome - totalExpenses;
      const profitMargin =
        totalIncome > 0 ? (operatingProfit / totalIncome) * 100 : 0;

      const totalAssets = input.totalPropertyValue + input.totalDeposits;
      const totalLiabilities =
        input.totalMortgages + input.totalLoans + input.totalLiabilities;

      const totalEquity = totalAssets - totalLiabilities;

      const metrics = await db.propertyManagerFinancialMetrics.create({
        data: {
          propertyManagerId: user.id,
          periodStart: input.periodStart,
          periodEnd: input.periodEnd,
          periodType: input.periodType,
          totalRentalIncome: input.totalRentalIncome,
          maintenanceFees: input.maintenanceFees,
          otherIncome: input.otherIncome,
          totalIncome,
          maintenanceExpenses: input.maintenanceExpenses,
          utilities: input.utilities,
          propertyTax: input.propertyTax,
          insurance: input.insurance,
          staffSalaries: input.staffSalaries,
          contractorPayments: input.contractorPayments,
          administrativeExpenses: input.administrativeExpenses,
          otherExpenses: input.otherExpenses,
          totalExpenses,
          operatingProfit,
          profitMargin,
          totalPropertyValue: input.totalPropertyValue,
          totalDeposits: input.totalDeposits,
          totalAssets,
          totalMortgages: input.totalMortgages,
          totalLoans: input.totalLoans,
          totalLiabilities,
          totalEquity,
          numberOfProperties: input.numberOfProperties,
          overallOccupancyRate: input.overallOccupancyRate,
          overallDebtToEquityRatio:
            totalEquity > 0 ? totalLiabilities / totalEquity : 0,
          overallReturnOnAssets:
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
        message: "Property Manager financial metrics created successfully",
      };
    } catch (error) {
      console.error("Error creating PM financial metrics:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create financial metrics",
      });
    }
  });
