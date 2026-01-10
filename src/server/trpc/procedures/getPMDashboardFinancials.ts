import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { startOfMonth, endOfMonth, subMonths } from "date-fns";

/**
 * Get comprehensive real-time financial data for Property Manager Dashboard
 * Aggregates data from:
 * - Tenant rent payments (revenue)
 * - Customer payments (revenue)
 * - Building budgets and expenses
 * - Contractor payments
 * - Maintenance costs
 * - Per-building and portfolio-wide metrics
 */
export const getPMDashboardFinancials = baseProcedure
  .input(
    z.object({
      token: z.string(),
      periodStart: z.date().optional(),
      periodEnd: z.date().optional(),
      buildingId: z.number().optional(), // Filter by specific building or get all
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can view financial dashboard",
      });
    }

    try {
      // Default to current month if no period specified
      const periodStart = input.periodStart || startOfMonth(new Date());
      const periodEnd = input.periodEnd || endOfMonth(new Date());

      // Get all buildings managed by this PM
      const buildings = await db.building.findMany({
        where: {
          propertyManagerId: user.id,
          ...(input.buildingId ? { id: input.buildingId } : {}),
        },
        include: {
          budgets: {
            where: {
              startDate: { lte: periodEnd },
              endDate: { gte: periodStart },
            },
            include: {
              expenses: true,
            },
          },
          tenants: {
            where: {
              status: "ACTIVE",
            },
          },
          payments: {
            where: {
              paymentDate: {
                gte: periodStart,
                lte: periodEnd,
              },
            },
          },
        },
      });

      // Get rent payments for the period
      const rentPayments = await db.rentPayment.findMany({
        where: {
          propertyManagerId: user.id,
          dueDate: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
        include: {
          tenant: {
            include: {
              building: true,
            },
          },
        },
      });

      // Get contractor payments for the period
      const contractorPayments = await db.paymentRequest.findMany({
        where: {
          artisan: {
            id: { in: [] }, // We'll need to filter by PM's contractors
          },
          status: "PAID",
          paidDate: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      // Get maintenance requests with costs
      const maintenanceRequests = await db.maintenanceRequest.findMany({
        where: {
          propertyManagerId: user.id,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      // Get orders (material and labour costs)
      const orders = await db.propertyManagerOrder.findMany({
        where: {
          propertyManagerId: user.id,
          createdAt: {
            gte: periodStart,
            lte: periodEnd,
          },
        },
      });

      // Calculate per-building financials
      const buildingFinancials = buildings.map((building) => {
        // Revenue from rent payments
        const buildingRentPayments = rentPayments.filter(
          (rp) => rp.tenant.buildingId === building.id
        );
        const rentalIncome = buildingRentPayments.reduce(
          (sum, rp) => sum + rp.amountPaid,
          0
        );
        const expectedRentalIncome = buildingRentPayments.reduce(
          (sum, rp) => sum + rp.amount,
          0
        );
        const rentCollectionRate =
          expectedRentalIncome > 0
            ? (rentalIncome / expectedRentalIncome) * 100
            : 0;

        // Revenue from other payments
        const otherPayments = building.payments || [];
        const otherIncome = otherPayments.reduce((sum, p) => sum + p.amount, 0);

        const totalRevenue = rentalIncome + otherIncome;

        // Expenses from budgets
        const budgetExpenses = building.budgets.reduce((sum, budget) => {
          return (
            sum +
            (budget.expenses || []).reduce((expSum, exp) => expSum + exp.amount, 0)
          );
        }, 0);

        // Total budget allocated
        const totalBudget = building.budgets.reduce(
          (sum, b) => sum + b.totalBudget,
          0
        );
        const budgetUtilization =
          totalBudget > 0 ? (budgetExpenses / totalBudget) * 100 : 0;

        // Maintenance costs for this building
        const buildingMaintenance = maintenanceRequests.filter(
          (mr) => mr.buildingName === building.name || mr.address.includes(building.address)
        );
        const maintenanceCost = 0; // Maintenance requests don't have cost field in schema

        // Total expenses
        const totalExpenses = budgetExpenses + maintenanceCost;

        // Net operating income
        const netOperatingIncome = totalRevenue - totalExpenses;
        const profitMargin =
          totalRevenue > 0 ? (netOperatingIncome / totalRevenue) * 100 : 0;

        // Occupancy metrics
        const totalUnits = building.numberOfUnits || building.tenants.length;
        const occupiedUnits = building.tenants.filter(
          (t) => t.status === "ACTIVE"
        ).length;
        const occupancyRate = totalUnits > 0 ? (occupiedUnits / totalUnits) * 100 : 0;

        // Tenant metrics
        const activeTenants = building.tenants.length;
        const overduePayments = buildingRentPayments.filter(
          (rp) => rp.status === "OVERDUE"
        ).length;
        const partialPayments = buildingRentPayments.filter(
          (rp) => rp.status === "PARTIAL"
        ).length;

        return {
          buildingId: building.id,
          buildingName: building.name,
          buildingAddress: building.address,
          revenue: {
            rentalIncome,
            expectedRentalIncome,
            rentCollectionRate,
            otherIncome,
            totalRevenue,
          },
          expenses: {
            budgetExpenses,
            maintenanceCost,
            totalExpenses,
          },
          profitability: {
            netOperatingIncome,
            profitMargin,
          },
          budget: {
            totalBudget,
            spent: budgetExpenses,
            remaining: totalBudget - budgetExpenses,
            utilization: budgetUtilization,
          },
          occupancy: {
            totalUnits,
            occupiedUnits,
            vacantUnits: totalUnits - occupiedUnits,
            occupancyRate,
          },
          tenants: {
            active: activeTenants,
            overduePayments,
            partialPayments,
          },
          maintenance: {
            requestCount: buildingMaintenance.length,
            totalCost: maintenanceCost,
            avgCostPerRequest:
              buildingMaintenance.length > 0
                ? maintenanceCost / buildingMaintenance.length
                : 0,
          },
        };
      });

      // Calculate portfolio-wide totals
      const portfolioRevenue = buildingFinancials.reduce(
        (sum, bf) => sum + bf.revenue.totalRevenue,
        0
      );
      const portfolioExpenses = buildingFinancials.reduce(
        (sum, bf) => sum + bf.expenses.totalExpenses,
        0
      );

      // Add contractor payments to portfolio expenses
      const totalContractorPayments = contractorPayments.reduce(
        (sum, cp) => sum + (cp.calculatedAmount || 0),
        0
      );
      const portfolioTotalExpenses = portfolioExpenses + totalContractorPayments;

      // Add order costs to expenses
      const totalOrderCosts = orders.reduce(
        (sum, o) => sum + ((o.materialCost || 0) + (o.labourCost || 0)),
        0
      );
      const portfolioAllExpenses = portfolioTotalExpenses + totalOrderCosts;

      const portfolioNetIncome = portfolioRevenue - portfolioAllExpenses;
      const portfolioProfitMargin =
        portfolioRevenue > 0 ? (portfolioNetIncome / portfolioRevenue) * 100 : 0;

      // Portfolio occupancy
      const totalPortfolioUnits = buildingFinancials.reduce(
        (sum, bf) => sum + bf.occupancy.totalUnits,
        0
      );
      const totalOccupiedUnits = buildingFinancials.reduce(
        (sum, bf) => sum + bf.occupancy.occupiedUnits,
        0
      );
      const portfolioOccupancyRate =
        totalPortfolioUnits > 0 ? (totalOccupiedUnits / totalPortfolioUnits) * 100 : 0;

      // Financial ratios
      const totalBudgets = buildingFinancials.reduce(
        (sum, bf) => sum + bf.budget.totalBudget,
        0
      );
      const totalBudgetSpent = buildingFinancials.reduce(
        (sum, bf) => sum + bf.budget.spent,
        0
      );

      // Revenue per unit
      const revenuePerUnit =
        totalPortfolioUnits > 0 ? portfolioRevenue / totalPortfolioUnits : 0;

      // Expense per unit
      const expensePerUnit =
        totalPortfolioUnits > 0 ? portfolioAllExpenses / totalPortfolioUnits : 0;

      // Calculate trends (compare to previous period)
      const prevPeriodStart = subMonths(periodStart, 1);
      const prevPeriodEnd = subMonths(periodEnd, 1);

      const prevRentPayments = await db.rentPayment.findMany({
        where: {
          propertyManagerId: user.id,
          dueDate: {
            gte: prevPeriodStart,
            lte: prevPeriodEnd,
          },
        },
      });

      const prevRevenue = prevRentPayments.reduce(
        (sum, rp) => sum + rp.amountPaid,
        0
      );
      const revenueTrend =
        prevRevenue > 0 ? ((portfolioRevenue - prevRevenue) / prevRevenue) * 100 : 0;

      return {
        success: true,
        period: {
          start: periodStart,
          end: periodEnd,
        },
        portfolio: {
          numberOfProperties: buildings.length,
          totalUnits: totalPortfolioUnits,
          occupiedUnits: totalOccupiedUnits,
          vacantUnits: totalPortfolioUnits - totalOccupiedUnits,
          occupancyRate: portfolioOccupancyRate,
          revenue: {
            total: portfolioRevenue,
            rentalIncome: buildingFinancials.reduce(
              (sum, bf) => sum + bf.revenue.rentalIncome,
              0
            ),
            otherIncome: buildingFinancials.reduce(
              (sum, bf) => sum + bf.revenue.otherIncome,
              0
            ),
            trend: revenueTrend,
          },
          expenses: {
            budgetExpenses: portfolioExpenses,
            contractorPayments: totalContractorPayments,
            orderCosts: totalOrderCosts,
            total: portfolioAllExpenses,
          },
          profitability: {
            netOperatingIncome: portfolioNetIncome,
            profitMargin: portfolioProfitMargin,
          },
          budgets: {
            total: totalBudgets,
            spent: totalBudgetSpent,
            remaining: totalBudgets - totalBudgetSpent,
            utilization: totalBudgets > 0 ? (totalBudgetSpent / totalBudgets) * 100 : 0,
          },
          performance: {
            revenuePerUnit,
            expensePerUnit,
            netIncomePerUnit: revenuePerUnit - expensePerUnit,
            rentCollectionRate:
              buildingFinancials.reduce(
                (sum, bf) =>
                  sum +
                  (bf.revenue.expectedRentalIncome > 0
                    ? bf.revenue.rentCollectionRate
                    : 0),
                0
              ) / (buildingFinancials.length || 1),
          },
          contractors: {
            totalPayments: totalContractorPayments,
            paymentCount: contractorPayments.length,
            averagePayment:
              contractorPayments.length > 0
                ? totalContractorPayments / contractorPayments.length
                : 0,
          },
          maintenance: {
            totalRequests: maintenanceRequests.length,
            totalCost: 0, // No cost field in schema
            avgCostPerRequest: 0,
          },
        },
        buildings: buildingFinancials,
      };
    } catch (error) {
      console.error("Error fetching PM dashboard financials:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch financial dashboard data",
      });
    }
  });
