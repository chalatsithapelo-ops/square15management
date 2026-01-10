import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const captureMetricSnapshot = baseProcedure
  .input(
    z.object({
      token: z.string(),
      metricType: z.enum(["DAILY", "MONTHLY"]),
      snapshotDate: z.string().optional(), // Defaults to today if not provided
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can capture metric snapshots",
        });
      }

      const snapshotDate = input.snapshotDate ? new Date(input.snapshotDate) : new Date();
      
      // Calculate date range based on metric type
      let startDate: Date;
      let endDate: Date;
      
      if (input.metricType === "DAILY") {
        startDate = new Date(snapshotDate);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(snapshotDate);
        endDate.setHours(23, 59, 59, 999);
      } else {
        // MONTHLY
        startDate = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth(), 1);
        endDate = new Date(snapshotDate.getFullYear(), snapshotDate.getMonth() + 1, 0, 23, 59, 59);
      }

      // Fetch all necessary data
      const orders = await db.order.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const invoices = await db.invoice.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const paymentRequests = await db.paymentRequest.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const quotations = await db.quotation.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const leads = await db.lead.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
      });

      const projects = await db.project.findMany({
        where: {
          createdAt: { gte: startDate, lte: endDate },
        },
        include: {
          milestones: {
            include: {
              risks: true,
            },
          },
        },
      });

      // Also get all active projects for current status
      const allProjects = await db.project.findMany({
        include: {
          milestones: {
            include: {
              risks: true,
            },
          },
        },
      });

      const assets = await db.asset.findMany();
      const liabilities = await db.liability.findMany({
        where: { isPaid: false },
      });

      // Calculate metrics
      const paidInvoices = invoices.filter((i) => i.status === "PAID");
      const paidInvoiceRevenue = paidInvoices.reduce((sum, i) => sum + i.total, 0);

      // Revenue comes only from paid invoices (what clients actually pay)
      // Order totalCost represents internal company costs, not revenue
      const totalRevenue = paidInvoiceRevenue;

      const artisanPayments = paymentRequests
        .filter((pr) => pr.status === "PAID")
        .reduce((sum, pr) => sum + pr.calculatedAmount, 0);

      const orderMaterialCosts = orders.reduce((sum, o) => sum + o.materialCost, 0);
      const orderLabourCosts = orders.reduce((sum, o) => sum + o.labourCost, 0);
      
      const quotationMaterialCosts = quotations
        .filter((q) => q.status === "APPROVED")
        .reduce((sum, q) => sum + (q.companyMaterialCost || 0), 0);
      
      const quotationLabourCosts = quotations
        .filter((q) => q.status === "APPROVED")
        .reduce((sum, q) => sum + (q.companyLabourCost || 0), 0);

      const materialCosts = orderMaterialCosts + quotationMaterialCosts;
      const labourCosts = orderLabourCosts + quotationLabourCosts;
      const totalExpenses = artisanPayments + materialCosts + labourCosts;

      const netProfit = totalRevenue - totalExpenses;
      const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

      const activeOrders = orders.filter(
        (o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED"
      ).length;

      const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;

      const newLeads = leads.filter((l) => l.status === "NEW").length;

      const totalAssets = assets.reduce((sum, a) => sum + a.currentValue, 0);
      const totalLiabilities = liabilities.reduce((sum, l) => sum + l.amount, 0);

      // Calculate budget utilization metrics
      const totalProjectBudget = allProjects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
      const totalProjectActualCost = allProjects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
      const budgetUtilizationPercentage = totalProjectBudget > 0 
        ? (totalProjectActualCost / totalProjectBudget) * 100 
        : 0;
      const projectsOverBudget = allProjects.filter((p) => {
        if (!p.estimatedBudget || p.estimatedBudget === 0) return false;
        return p.actualCost > p.estimatedBudget * 1.1; // 10% over budget threshold
      }).length;

      // Calculate milestone completion metrics
      const allMilestones = allProjects.flatMap((p) => p.milestones || []);
      const totalMilestones = allMilestones.length;
      const completedMilestones = allMilestones.filter((m) => m.status === "COMPLETED").length;
      const inProgressMilestones = allMilestones.filter((m) => m.status === "IN_PROGRESS").length;
      const milestoneCompletionRate = totalMilestones > 0 
        ? (completedMilestones / totalMilestones) * 100 
        : 0;
      const delayedMilestones = allMilestones.filter((m) => {
        if (!m.endDate || m.status === "COMPLETED") return false;
        return new Date(m.endDate) < new Date();
      }).length;

      // Calculate project health metrics
      const totalProjects = allProjects.length;
      const activeProjects = allProjects.filter((p) => 
        p.status === "IN_PROGRESS" || p.status === "PLANNING"
      ).length;
      
      // Calculate projects at risk (high risk milestones or over budget)
      const projectsAtRisk = allProjects.filter((p) => {
        const hasHighRisks = p.milestones.some((m) => 
          m.risks.some((r) => r.probability === "HIGH" || r.impact === "HIGH")
        );
        const isOverBudget = p.estimatedBudget && p.estimatedBudget > 0 
          ? p.actualCost > p.estimatedBudget * 0.9 
          : false;
        return hasHighRisks || isOverBudget;
      }).length;
      
      // Calculate average project health score (0-100)
      // Health = (budget health * 0.4) + (schedule health * 0.3) + (risk health * 0.3)
      const projectHealthScores = allProjects.map((p) => {
        // Budget health (100 if under budget, decreases as over budget)
        const budgetHealth = p.estimatedBudget && p.estimatedBudget > 0
          ? Math.max(0, 100 - ((p.actualCost / p.estimatedBudget - 1) * 100))
          : 100;
        
        // Schedule health (based on milestone delays)
        const projectMilestones = p.milestones || [];
        const delayedCount = projectMilestones.filter((m) => {
          if (!m.endDate || m.status === "COMPLETED") return false;
          return new Date(m.endDate) < new Date();
        }).length;
        const scheduleHealth = projectMilestones.length > 0
          ? Math.max(0, 100 - (delayedCount / projectMilestones.length) * 100)
          : 100;
        
        // Risk health (based on high risks)
        const allRisks = projectMilestones.flatMap((m) => m.risks || []);
        const highRisks = allRisks.filter((r) => r.probability === "HIGH" || r.impact === "HIGH").length;
        const riskHealth = allRisks.length > 0
          ? Math.max(0, 100 - (highRisks / allRisks.length) * 100)
          : 100;
        
        return (budgetHealth * 0.4) + (scheduleHealth * 0.3) + (riskHealth * 0.3);
      });
      
      const averageProjectHealthScore = projectHealthScores.length > 0
        ? projectHealthScores.reduce((sum, score) => sum + score, 0) / projectHealthScores.length
        : 100;

      // Check if snapshot already exists for this date and type
      const existingSnapshot = await db.metricSnapshot.findFirst({
        where: {
          snapshotDate: {
            gte: startDate,
            lte: endDate,
          },
          metricType: input.metricType,
        },
      });

      if (existingSnapshot) {
        // Update existing snapshot
        const snapshot = await db.metricSnapshot.update({
          where: { id: existingSnapshot.id },
          data: {
            totalRevenue,
            completedOrders,
            paidInvoices: paidInvoices.length,
            totalExpenses,
            materialCosts,
            labourCosts,
            artisanPayments,
            netProfit,
            profitMargin,
            activeOrders,
            newLeads,
            totalAssets,
            totalLiabilities,
            totalProjectBudget,
            totalProjectActualCost,
            budgetUtilizationPercentage,
            projectsOverBudget,
            totalMilestones,
            completedMilestones,
            inProgressMilestones,
            milestoneCompletionRate,
            delayedMilestones,
            totalProjects,
            activeProjects,
            projectsAtRisk,
            averageProjectHealthScore,
          },
        });

        return snapshot;
      } else {
        // Create new snapshot
        const snapshot = await db.metricSnapshot.create({
          data: {
            snapshotDate,
            metricType: input.metricType,
            totalRevenue,
            completedOrders,
            paidInvoices: paidInvoices.length,
            totalExpenses,
            materialCosts,
            labourCosts,
            artisanPayments,
            netProfit,
            profitMargin,
            activeOrders,
            newLeads,
            totalAssets,
            totalLiabilities,
            totalProjectBudget,
            totalProjectActualCost,
            budgetUtilizationPercentage,
            projectsOverBudget,
            totalMilestones,
            completedMilestones,
            inProgressMilestones,
            milestoneCompletionRate,
            delayedMilestones,
            totalProjects,
            activeProjects,
            projectsAtRisk,
            averageProjectHealthScore,
          },
        });

        return snapshot;
      }
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
