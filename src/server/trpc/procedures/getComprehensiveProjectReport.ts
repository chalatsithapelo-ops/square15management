import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { assertCanAccessProject } from "~/server/utils/project-access";

export const getComprehensiveProjectReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Restrict comprehensive report access to admins and property managers only.
    // Property managers must also have access to the specific project.
    if (isAdmin(user)) {
      // allow
    } else if (user.role === "PROPERTY_MANAGER") {
      await assertCanAccessProject(user, input.projectId);
    } else {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have access to this report",
      });
    }

    // Fetch the project with all related data
    const project = await db.project.findUnique({
      where: { id: input.projectId },
      include: {
        assignedTo: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            hourlyRate: true,
            dailyRate: true,
          },
        },
        milestones: {
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
            supplierQuotations: {
              orderBy: {
                createdAt: "desc",
              },
            },
            materials: true,
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
                    email: true,
                  },
                },
              },
            },
            dependenciesFrom: {
              include: {
                toMilestone: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
            dependenciesTo: {
              include: {
                fromMilestone: {
                  select: {
                    id: true,
                    name: true,
                    status: true,
                  },
                },
              },
            },
            risks: {
              orderBy: {
                createdAt: "desc",
              },
            },
            qualityCheckpoints: {
              orderBy: {
                createdAt: "asc",
              },
            },
            changeOrders: {
              orderBy: {
                createdAt: "desc",
              },
            },
            expenseSlips: true,
          },
          orderBy: {
            sequenceOrder: "asc",
          },
        },
        changeOrders: {
          orderBy: {
            createdAt: "desc",
          },
        },
        invoices: {
          orderBy: {
            createdAt: "desc",
          },
        },
        quotations: {
          orderBy: {
            createdAt: "desc",
          },
        },
        reviews: {
          include: {
            customer: {
              select: {
                firstName: true,
                lastName: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
    });

    if (!project) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Project not found",
      });
    }

    // Aggregate financial metrics
    const milestones = project.milestones || [];
    
    const financialSummary = {
      totalBudgetAllocated: milestones.reduce((sum, m) => sum + m.budgetAllocated, 0),
      totalActualCost: milestones.reduce((sum, m) => sum + m.actualCost, 0),
      totalLabourCost: milestones.reduce((sum, m) => sum + m.labourCost, 0),
      totalMaterialCost: milestones.reduce((sum, m) => sum + m.materialCost, 0),
      totalExpectedProfit: milestones.reduce((sum, m) => sum + m.expectedProfit, 0),
      totalDieselCost: milestones.reduce((sum, m) => sum + m.dieselCost, 0),
      totalRentCost: milestones.reduce((sum, m) => sum + m.rentCost, 0),
      totalAdminCost: milestones.reduce((sum, m) => sum + m.adminCost, 0),
      totalOtherOperationalCost: milestones.reduce((sum, m) => sum + m.otherOperationalCost, 0),
    };

    const totalOperationalCost = 
      financialSummary.totalDieselCost + 
      financialSummary.totalRentCost + 
      financialSummary.totalAdminCost + 
      financialSummary.totalOtherOperationalCost;

    const budgetVariance = financialSummary.totalBudgetAllocated - financialSummary.totalActualCost;
    const budgetUtilization = financialSummary.totalBudgetAllocated > 0 
      ? (financialSummary.totalActualCost / financialSummary.totalBudgetAllocated) * 100 
      : 0;

    const actualProfit = financialSummary.totalBudgetAllocated - financialSummary.totalActualCost;
    const profitMargin = financialSummary.totalBudgetAllocated > 0 
      ? (actualProfit / financialSummary.totalBudgetAllocated) * 100 
      : 0;

    // Aggregate timeline metrics
    const milestonesWithDates = milestones.filter(m => m.startDate && m.endDate);
    const earliestStart = milestonesWithDates.length > 0
      ? new Date(Math.min(...milestonesWithDates.map(m => new Date(m.startDate!).getTime())))
      : null;
    const latestEnd = milestonesWithDates.length > 0
      ? new Date(Math.max(...milestonesWithDates.map(m => new Date(m.endDate!).getTime())))
      : null;

    const totalDurationDays = earliestStart && latestEnd
      ? Math.ceil((latestEnd.getTime() - earliestStart.getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    // Calculate delays
    const now = new Date();
    const delayedMilestones = milestones.filter(m => {
      if (!m.endDate || m.status === "COMPLETED" || m.status === "CANCELLED") return false;
      return new Date(m.endDate) < now;
    });

    const totalDelayDays = delayedMilestones.reduce((sum, m) => {
      if (!m.endDate) return sum;
      const delay = Math.ceil((now.getTime() - new Date(m.endDate).getTime()) / (1000 * 60 * 60 * 24));
      return sum + Math.max(0, delay);
    }, 0);

    // Progress metrics
    const overallProgress = milestones.length > 0
      ? milestones.reduce((sum, m) => sum + m.progressPercentage, 0) / milestones.length
      : 0;

    const milestonesByStatus = {
      PLANNING: milestones.filter(m => m.status === "PLANNING" || m.status === "NOT_STARTED").length,
      IN_PROGRESS: milestones.filter(m => m.status === "IN_PROGRESS").length,
      ON_HOLD: milestones.filter(m => m.status === "ON_HOLD").length,
      COMPLETED: milestones.filter(m => m.status === "COMPLETED").length,
      CANCELLED: milestones.filter(m => m.status === "CANCELLED").length,
    };

    const completionRate = milestones.length > 0
      ? (milestonesByStatus.COMPLETED / milestones.length) * 100
      : 0;

    // Payment request summary
    const allPaymentRequests = milestones.flatMap(m => m.paymentRequests || []);
    
    const paymentSummary = {
      total: allPaymentRequests.length,
      pending: allPaymentRequests.filter(pr => pr.status === "PENDING").length,
      approved: allPaymentRequests.filter(pr => pr.status === "APPROVED").length,
      rejected: allPaymentRequests.filter(pr => pr.status === "REJECTED").length,
      paid: allPaymentRequests.filter(pr => pr.status === "PAID").length,
      totalPendingAmount: allPaymentRequests
        .filter(pr => pr.status === "PENDING" || pr.status === "APPROVED")
        .reduce((sum, pr) => sum + pr.calculatedAmount, 0),
      totalPaidAmount: allPaymentRequests
        .filter(pr => pr.status === "PAID")
        .reduce((sum, pr) => sum + pr.calculatedAmount, 0),
      totalAmount: allPaymentRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0),
    };

    // Risk analysis
    const allRisks = milestones.flatMap(m => m.risks || []);
    
    const riskSummary = {
      total: allRisks.length,
      open: allRisks.filter(r => r.status === "OPEN").length,
      mitigated: allRisks.filter(r => r.status === "MITIGATED").length,
      closed: allRisks.filter(r => r.status === "CLOSED").length,
      highProbability: allRisks.filter(r => r.probability === "HIGH" && r.status === "OPEN").length,
      highImpact: allRisks.filter(r => r.impact === "HIGH" && r.status === "OPEN").length,
      critical: allRisks.filter(r => 
        (r.probability === "HIGH" || r.impact === "HIGH") && r.status === "OPEN"
      ).length,
      byCategory: {
        TECHNICAL: allRisks.filter(r => r.riskCategory === "TECHNICAL").length,
        FINANCIAL: allRisks.filter(r => r.riskCategory === "FINANCIAL").length,
        SCHEDULE: allRisks.filter(r => r.riskCategory === "SCHEDULE").length,
        RESOURCE: allRisks.filter(r => r.riskCategory === "RESOURCE").length,
        EXTERNAL: allRisks.filter(r => r.riskCategory === "EXTERNAL").length,
      },
    };

    // Change order summary
    const allChangeOrders = [
      ...project.changeOrders,
      ...milestones.flatMap(m => m.changeOrders || []),
    ];

    const changeOrderSummary = {
      total: allChangeOrders.length,
      pending: allChangeOrders.filter(co => co.status === "PENDING").length,
      approved: allChangeOrders.filter(co => co.status === "APPROVED").length,
      rejected: allChangeOrders.filter(co => co.status === "REJECTED").length,
      implemented: allChangeOrders.filter(co => co.status === "IMPLEMENTED").length,
      totalCostImpact: allChangeOrders
        .filter(co => co.status === "APPROVED" || co.status === "IMPLEMENTED")
        .reduce((sum, co) => sum + co.costImpact, 0),
      totalTimeImpact: allChangeOrders
        .filter(co => co.status === "APPROVED" || co.status === "IMPLEMENTED")
        .reduce((sum, co) => sum + co.timeImpact, 0),
    };

    // Resource allocation summary
    const uniqueArtisans = new Set(
      milestones
        .filter(m => m.assignedToId)
        .map(m => m.assignedToId)
    );

    const resourceSummary = {
      totalArtisansAssigned: uniqueArtisans.size,
      milestonesWithAssignment: milestones.filter(m => m.assignedToId).length,
      milestonesWithoutAssignment: milestones.filter(m => !m.assignedToId).length,
    };

    // Quality metrics
    const allQualityCheckpoints = milestones.flatMap(m => m.qualityCheckpoints || []);
    
    const qualitySummary = {
      total: allQualityCheckpoints.length,
      pending: allQualityCheckpoints.filter(qc => qc.status === "PENDING").length,
      passed: allQualityCheckpoints.filter(qc => qc.status === "PASSED").length,
      failed: allQualityCheckpoints.filter(qc => qc.status === "FAILED").length,
      waived: allQualityCheckpoints.filter(qc => qc.status === "WAIVED").length,
      passRate: allQualityCheckpoints.length > 0
        ? (allQualityCheckpoints.filter(qc => qc.status === "PASSED").length / allQualityCheckpoints.length) * 100
        : 0,
    };

    // Invoice summary
    const invoiceSummary = {
      total: project.invoices.length,
      draft: project.invoices.filter(inv => inv.status === "DRAFT").length,
      sent: project.invoices.filter(inv => inv.status === "SENT").length,
      paid: project.invoices.filter(inv => inv.status === "PAID").length,
      overdue: project.invoices.filter(inv => inv.status === "OVERDUE").length,
      totalAmount: project.invoices.reduce((sum, inv) => sum + inv.total, 0),
      totalPaid: project.invoices
        .filter(inv => inv.status === "PAID")
        .reduce((sum, inv) => sum + inv.total, 0),
      totalOutstanding: project.invoices
        .filter(inv => inv.status === "SENT" || inv.status === "OVERDUE")
        .reduce((sum, inv) => sum + inv.total, 0),
    };

    // Weekly update summary
    const allWeeklyUpdates = milestones.flatMap(m => m.weeklyUpdates || []);
    
    const weeklyUpdateSummary = {
      total: allWeeklyUpdates.length,
      totalExpenditureReported: allWeeklyUpdates.reduce((sum, wu) => sum + wu.totalExpenditure, 0),
      averageWeeklyExpenditure: allWeeklyUpdates.length > 0
        ? allWeeklyUpdates.reduce((sum, wu) => sum + wu.totalExpenditure, 0) / allWeeklyUpdates.length
        : 0,
      lastUpdateDate: allWeeklyUpdates.length > 0
        ? new Date(Math.max(...allWeeklyUpdates.map(wu => new Date(wu.createdAt).getTime())))
        : null,
    };

    // Project health score (0-100)
    let healthScore = 100;
    
    // Deduct points for budget overruns
    if (budgetUtilization > 100) {
      healthScore -= Math.min(20, (budgetUtilization - 100));
    }
    
    // Deduct points for delays
    if (delayedMilestones.length > 0) {
      healthScore -= Math.min(20, delayedMilestones.length * 5);
    }
    
    // Deduct points for open critical risks
    healthScore -= Math.min(20, riskSummary.critical * 5);
    
    // Deduct points for failed quality checkpoints
    if (qualitySummary.total > 0) {
      const failureRate = (qualitySummary.failed / qualitySummary.total) * 100;
      healthScore -= Math.min(20, failureRate);
    }
    
    // Deduct points for pending change orders
    healthScore -= Math.min(10, changeOrderSummary.pending * 2);
    
    healthScore = Math.max(0, Math.min(100, healthScore));

    // Return comprehensive report
    return {
      project: {
        id: project.id,
        projectNumber: project.projectNumber,
        name: project.name,
        description: project.description,
        customerName: project.customerName,
        customerEmail: project.customerEmail,
        customerPhone: project.customerPhone,
        address: project.address,
        projectType: project.projectType,
        status: project.status,
        startDate: project.startDate,
        endDate: project.endDate,
        estimatedBudget: project.estimatedBudget,
        actualCost: project.actualCost,
        assignedTo: project.assignedTo,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
      },
      financialSummary: {
        ...financialSummary,
        totalOperationalCost,
        budgetVariance,
        budgetUtilization,
        actualProfit,
        profitMargin,
      },
      timelineSummary: {
        earliestStart,
        latestEnd,
        totalDurationDays,
        delayedMilestonesCount: delayedMilestones.length,
        totalDelayDays,
      },
      progressSummary: {
        overallProgress,
        completionRate,
        totalMilestones: milestones.length,
        milestonesByStatus,
      },
      paymentSummary,
      riskSummary,
      changeOrderSummary,
      resourceSummary,
      qualitySummary,
      invoiceSummary,
      weeklyUpdateSummary,
      healthScore,
      milestones: milestones.map(m => ({
        id: m.id,
        name: m.name,
        description: m.description,
        sequenceOrder: m.sequenceOrder,
        status: m.status,
        budgetAllocated: m.budgetAllocated,
        actualCost: m.actualCost,
        progressPercentage: m.progressPercentage,
        startDate: m.startDate,
        endDate: m.endDate,
        actualStartDate: m.actualStartDate,
        actualEndDate: m.actualEndDate,
        assignedTo: m.assignedTo,
        labourCost: m.labourCost,
        materialCost: m.materialCost,
        expectedProfit: m.expectedProfit,
        dieselCost: m.dieselCost,
        rentCost: m.rentCost,
        adminCost: m.adminCost,
        otherOperationalCost: m.otherOperationalCost,
        paymentRequestsCount: m.paymentRequests.length,
        risksCount: m.risks.filter(r => r.status === "OPEN").length,
        weeklyUpdatesCount: m.weeklyUpdates.length,
        qualityCheckpointsCount: m.qualityCheckpoints.length,
        dependenciesCount: m.dependenciesFrom.length + m.dependenciesTo.length,
      })),
      recentActivity: {
        recentWeeklyUpdates: allWeeklyUpdates.slice(0, 5),
        recentPaymentRequests: allPaymentRequests.slice(0, 5),
        recentChangeOrders: allChangeOrders.slice(0, 5),
        openRisks: allRisks.filter(r => r.status === "OPEN").slice(0, 10),
      },
      reviews: project.reviews,
    };
  });
