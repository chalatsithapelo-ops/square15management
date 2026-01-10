import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getProfitAnalytics = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      projectId: z.number().optional(),
      status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);

      // Allow both admin and contractor roles to view profit analytics
      const isAdmin = user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN";
      const isContractor = user.role.includes("CONTRACTOR");

      if (!isAdmin && !isContractor) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators and contractors can view profit analytics",
        });
      }

      // Build where clause for filtering
      const projectWhere: any = {};
      if (input.projectId) {
        projectWhere.id = input.projectId;
      }
      if (input.status) {
        projectWhere.status = input.status;
      }
      if (input.startDate || input.endDate) {
        projectWhere.createdAt = {};
        if (input.startDate) {
          projectWhere.createdAt.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          projectWhere.createdAt.lte = new Date(input.endDate);
        }
      }

      // Fetch projects with all related financial data
      const projects = await db.project.findMany({
        where: projectWhere,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          milestones: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
              supplierQuotations: true,
              weeklyUpdates: {
                orderBy: {
                  weekStartDate: "desc",
                },
              },
              paymentRequests: {
                include: {
                  artisan: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              expenseSlips: true,
              materials: true,
              risks: {
                where: {
                  status: "OPEN",
                },
              },
            },
            orderBy: {
              sequenceOrder: "asc",
            },
          },
          quotations: {
            where: {
              status: "APPROVED",
            },
          },
          invoices: {
            where: {
              status: "PAID",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Fetch operational expenses for the date range
      const operationalExpensesWhere: any = {
        isApproved: true, // Only include approved expenses
        createdBy: {
          role: {
            contains: isAdmin ? "ADMIN" : "CONTRACTOR", // Filter by user role
          },
        },
      };
      if (input.startDate || input.endDate) {
        operationalExpensesWhere.date = {};
        if (input.startDate) {
          operationalExpensesWhere.date.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          operationalExpensesWhere.date.lte = new Date(input.endDate);
        }
      }

      const operationalExpenses = await db.operationalExpense.findMany({
        where: operationalExpensesWhere,
      });

      const totalOperationalExpenses = operationalExpenses.reduce(
        (sum, expense) => sum + expense.amount,
        0
      );

      // Fetch alternative revenues for the date range
      const alternativeRevenuesWhere: any = {
        isApproved: true, // Only include approved revenues
        createdBy: {
          role: {
            contains: isAdmin ? "ADMIN" : "CONTRACTOR", // Filter by user role
          },
        },
      };
      if (input.startDate || input.endDate) {
        alternativeRevenuesWhere.date = {};
        if (input.startDate) {
          alternativeRevenuesWhere.date.gte = new Date(input.startDate);
        }
        if (input.endDate) {
          alternativeRevenuesWhere.date.lte = new Date(input.endDate);
        }
      }

      const alternativeRevenues = await db.alternativeRevenue.findMany({
        where: alternativeRevenuesWhere,
      });

      const totalAlternativeRevenue = alternativeRevenues.reduce(
        (sum, revenue) => sum + revenue.amount,
        0
      );

      // Calculate overall metrics
      let totalExpectedProfit = 0;
      let totalActualProfit = 0;
      let totalRevenue = 0;
      let totalCosts = 0;
      let totalBudget = 0;
      let totalActualCost = 0;

      // Calculate project-level metrics
      const projectMetrics = projects.map((project) => {
        const projectBudget = project.estimatedBudget || 0;
        const projectActualCost = project.actualCost || 0;

        // Calculate revenue from invoices
        const projectRevenue = project.invoices.reduce((sum, inv) => sum + inv.total, 0);

        // Calculate expected profit (revenue - budget)
        const projectExpectedProfit = projectRevenue - projectBudget;

        // Calculate actual profit (revenue - actual cost)
        const projectActualProfit = projectRevenue - projectActualCost;

        // Calculate variance
        const profitVariance = projectActualProfit - projectExpectedProfit;
        const profitVariancePercentage = projectExpectedProfit !== 0 
          ? (profitVariance / Math.abs(projectExpectedProfit)) * 100 
          : 0;

        // Budget utilization
        const budgetUtilization = projectBudget > 0 
          ? (projectActualCost / projectBudget) * 100 
          : 0;

        // Aggregate milestone metrics
        const milestoneMetrics = project.milestones.map((milestone) => {
          const milestoneBudget = milestone.budgetAllocated || 0;
          // Actual cost includes labour, materials, and all operational costs
          const milestoneActualCost = milestone.actualCost || 0;
          const milestoneExpectedProfit = milestone.expectedProfit || 0;

          // Calculate actual profit for milestone
          // Actual profit = (portion of project revenue) - actual cost
          // We'll use budget allocation as a proxy for revenue portion
          const revenueShare = projectBudget > 0 
            ? (milestoneBudget / projectBudget) * projectRevenue 
            : 0;
          const milestoneActualProfit = revenueShare - milestoneActualCost;

          const milestoneVariance = milestoneActualProfit - milestoneExpectedProfit;
          const milestoneVariancePercentage = milestoneExpectedProfit !== 0 
            ? (milestoneVariance / Math.abs(milestoneExpectedProfit)) * 100 
            : 0;

          const milestoneBudgetUtilization = milestoneBudget > 0 
            ? (milestoneActualCost / milestoneBudget) * 100 
            : 0;

          return {
            id: milestone.id,
            name: milestone.name,
            status: milestone.status,
            sequenceOrder: milestone.sequenceOrder,
            budgetAllocated: milestoneBudget,
            actualCost: milestoneActualCost,
            expectedProfit: milestoneExpectedProfit,
            actualProfit: milestoneActualProfit,
            variance: milestoneVariance,
            variancePercentage: milestoneVariancePercentage,
            budgetUtilization: milestoneBudgetUtilization,
            progressPercentage: milestone.progressPercentage,
            assignedTo: milestone.assignedTo,
            startDate: milestone.startDate,
            endDate: milestone.endDate,
            actualStartDate: milestone.actualStartDate,
            actualEndDate: milestone.actualEndDate,
            riskCount: milestone.risks.length,
          };
        });

        // Update totals
        totalBudget += projectBudget;
        totalActualCost += projectActualCost;
        totalRevenue += projectRevenue;
        totalExpectedProfit += projectExpectedProfit;
        totalActualProfit += projectActualProfit;

        return {
          id: project.id,
          projectNumber: project.projectNumber,
          name: project.name,
          status: project.status,
          customerName: project.customerName,
          projectType: project.projectType,
          estimatedBudget: projectBudget,
          actualCost: projectActualCost,
          revenue: projectRevenue,
          expectedProfit: projectExpectedProfit,
          actualProfit: projectActualProfit,
          variance: profitVariance,
          variancePercentage: profitVariancePercentage,
          budgetUtilization,
          assignedTo: project.assignedTo,
          startDate: project.startDate,
          endDate: project.endDate,
          milestones: milestoneMetrics,
          milestoneCount: project.milestones.length,
          completedMilestones: project.milestones.filter((m) => m.status === "COMPLETED").length,
        };
      });

      // Include operational expenses and alternative revenues in totals
      const totalRevenueWithAlternative = totalRevenue + totalAlternativeRevenue;
      const totalCostsWithOperational = totalActualCost + totalOperationalExpenses;
      
      // Recalculate profits including operational expenses and alternative revenues
      const totalActualProfitAdjusted = totalRevenueWithAlternative - totalCostsWithOperational;
      const totalExpectedProfitAdjusted = totalRevenueWithAlternative - totalBudget - totalOperationalExpenses;

      // Calculate overall variance
      const overallVariance = totalActualProfitAdjusted - totalExpectedProfitAdjusted;
      const overallVariancePercentage = totalExpectedProfitAdjusted !== 0 
        ? (overallVariance / Math.abs(totalExpectedProfitAdjusted)) * 100 
        : 0;

      // Calculate profit margin
      const profitMargin = totalRevenueWithAlternative > 0 ? (totalActualProfitAdjusted / totalRevenueWithAlternative) * 100 : 0;
      const expectedProfitMargin = totalRevenueWithAlternative > 0 ? (totalExpectedProfitAdjusted / totalRevenueWithAlternative) * 100 : 0;

      // Calculate budget performance
      const overallBudgetUtilization = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;

      // Count projects by performance
      const profitableProjects = projectMetrics.filter((p) => p.actualProfit > 0).length;
      const unprofitableProjects = projectMetrics.filter((p) => p.actualProfit < 0).length;
      const overBudgetProjects = projectMetrics.filter((p) => p.budgetUtilization > 100).length;
      const onTrackProjects = projectMetrics.filter((p) => 
        p.budgetUtilization <= 100 && p.actualProfit >= p.expectedProfit
      ).length;

      return {
        summary: {
          totalProjects: projects.length,
          totalRevenue: totalRevenueWithAlternative,
          invoiceRevenue: totalRevenue,
          alternativeRevenue: totalAlternativeRevenue,
          totalBudget,
          totalActualCost: totalCostsWithOperational,
          projectCosts: totalActualCost,
          operationalExpenses: totalOperationalExpenses,
          totalExpectedProfit: totalExpectedProfitAdjusted,
          totalActualProfit: totalActualProfitAdjusted,
          variance: overallVariance,
          variancePercentage: overallVariancePercentage,
          profitMargin,
          expectedProfitMargin,
          budgetUtilization: overallBudgetUtilization,
          profitableProjects,
          unprofitableProjects,
          overBudgetProjects,
          onTrackProjects,
        },
        projects: projectMetrics,
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
