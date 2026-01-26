import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateText } from "ai";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { minioClient, minioBaseUrl } from "~/server/minio";

export const generateFinancialReport = baseProcedure
  .input(
    z.object({
      token: z.string(),
      reportType: z.enum([
        "MONTHLY_PL",
        "QUARTERLY_PL",
        "MONTHLY_BALANCE_SHEET",
        "QUARTERLY_BALANCE_SHEET",
        "ANNUAL_PL",
        "ANNUAL_BALANCE_SHEET",
        "MONTHLY_BUSINESS_INSIGHTS",
        "MONTHLY_CFS",
        "QUARTERLY_CFS",
        "ANNUAL_CFS",
      ]),
      year: z.number().int().min(2020).max(2100),
      month: z.number().int().min(1).max(12).optional(),
      quarter: z.number().int().min(1).max(4).optional(),
      // New filter parameters
      projectType: z.string().optional(),
      clientEmail: z.string().optional(),
      artisanId: z.number().optional(),
      customStartDate: z.string().optional(), // ISO date string
      customEndDate: z.string().optional(), // ISO date string
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Verify authentication
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user || (user.role !== "SENIOR_ADMIN" && user.role !== "ADMIN")) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can generate financial reports",
        });
      }

      // Determine date range and report period
      let startDate: Date;
      let endDate: Date;
      let reportPeriod: string;

      // Check for custom date range first
      if (input.customStartDate && input.customEndDate) {
        startDate = new Date(input.customStartDate);
        endDate = new Date(input.customEndDate);
        reportPeriod = `${input.customStartDate}_to_${input.customEndDate}`;
      } else if (input.reportType.includes("MONTHLY") || input.reportType === "MONTHLY_BUSINESS_INSIGHTS" || input.reportType === "MONTHLY_CFS") {
        if (!input.month) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Month is required for monthly reports",
          });
        }
        startDate = new Date(input.year, input.month - 1, 1);
        endDate = new Date(input.year, input.month, 0, 23, 59, 59);
        reportPeriod = `${input.year}-${String(input.month).padStart(2, "0")}`;
      } else if (input.reportType.includes("QUARTERLY")) {
        if (!input.quarter) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Quarter is required for quarterly reports",
          });
        }
        const startMonth = (input.quarter - 1) * 3;
        startDate = new Date(input.year, startMonth, 1);
        endDate = new Date(input.year, startMonth + 3, 0, 23, 59, 59);
        reportPeriod = `${input.year}-Q${input.quarter}`;
      } else {
        // Annual
        startDate = new Date(input.year, 0, 1);
        endDate = new Date(input.year, 11, 31, 23, 59, 59);
        reportPeriod = `${input.year}`;
      }

      // Add filter suffix to report period if filters are applied
      const filterSuffix = [];
      if (input.projectType) filterSuffix.push(`type_${input.projectType}`);
      if (input.clientEmail) filterSuffix.push(`client_${input.clientEmail.split('@')[0]}`);
      if (input.artisanId) filterSuffix.push(`artisan_${input.artisanId}`);
      if (filterSuffix.length > 0) {
        reportPeriod += `_${filterSuffix.join('_')}`;
      }

      // Check if report already exists
      const existingReport = await db.financialReport.findFirst({
        where: {
          reportType: input.reportType,
          reportPeriod,
        },
      });

      if (existingReport && existingReport.status === "GENERATING") {
        return { reportId: existingReport.id, status: "GENERATING" };
      }

      // Create or update report record
      const report = existingReport
        ? await db.financialReport.update({
            where: { id: existingReport.id },
            data: {
              status: "GENERATING",
              errorMessage: null,
              updatedAt: new Date(),
            },
          })
        : await db.financialReport.create({
            data: {
              reportType: input.reportType,
              reportPeriod,
              startDate,
              endDate,
              status: "GENERATING",
            },
          });

      // Start background generation (don't await)
      generateReportInBackground(
        report.id,
        startDate,
        endDate,
        input.reportType,
        input.projectType,
        input.clientEmail,
        input.artisanId
      ).catch(
        (error) => {
          console.error("Error generating financial report:", error);
          db.financialReport
            .update({
              where: { id: report.id },
              data: {
                status: "FAILED",
                errorMessage: error.message || "Unknown error occurred",
              },
            })
            .catch(console.error);
        }
      );

      return { reportId: report.id, status: "GENERATING" };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });

async function generateReportInBackground(
  reportId: number,
  startDate: Date,
  endDate: Date,
  reportType: string,
  projectType?: string,
  clientEmail?: string,
  artisanId?: number
) {
  try {
    // Build filter conditions
    const orderWhere: any = {
      createdAt: { gte: startDate, lte: endDate },
    };
    const invoiceWhere: any = {
      createdAt: { gte: startDate, lte: endDate },
    };
    const quotationWhere: any = {
      createdAt: { gte: startDate, lte: endDate },
    };
    const paymentRequestWhere: any = {
      createdAt: { gte: startDate, lte: endDate },
    };

    // Apply filters
    if (clientEmail) {
      orderWhere.customerEmail = clientEmail;
      invoiceWhere.customerEmail = clientEmail;
      quotationWhere.customerEmail = clientEmail;
    }

    if (artisanId) {
      orderWhere.assignedToId = artisanId;
      quotationWhere.assignedToId = artisanId;
      paymentRequestWhere.artisanId = artisanId;
    }

    // For project type filter, we need to get project IDs first
    let projectIds: number[] | undefined;
    if (projectType) {
      const projects = await db.project.findMany({
        where: {
          projectType,
          createdAt: { gte: startDate, lte: endDate },
        },
        select: { id: true },
      });
      projectIds = projects.map((p) => p.id);
      
      // Apply project filter to invoices and quotations
      if (projectIds.length > 0) {
        invoiceWhere.projectId = { in: projectIds };
        quotationWhere.projectId = { in: projectIds };
      } else {
        // No projects of this type in the period, return empty results
        invoiceWhere.id = -1;
        quotationWhere.id = -1;
      }
    }

    // Fetch financial data for the period with filters
    const orders = await db.order.findMany({
      where: orderWhere,
      include: {
        materials: true,
        expenseSlips: true,
      },
    });

    const invoices = await db.invoice.findMany({
      where: invoiceWhere,
    });

    const paymentRequests = await db.paymentRequest.findMany({
      where: paymentRequestWhere,
    });

    const quotations = await db.quotation.findMany({
      where: quotationWhere,
      include: {
        expenseSlips: true,
      },
    });

    const assets = await db.asset.findMany();

    const liabilities = await db.liability.findMany({
      where: {
        createdAt: { gte: startDate, lte: endDate },
      },
    });

    const allLiabilities = await db.liability.findMany({
      where: { isPaid: false },
    });

    // --- Additional Data Fetching for Monthly Business Insights Report ---
    let projectsInPeriod: any[] = [];
    let allMilestones: any[] = [];
    
    if (reportType === "MONTHLY_BUSINESS_INSIGHTS") {
      const projectWhere: any = {
        createdAt: { gte: startDate, lte: endDate },
      };
      
      if (projectType) {
        projectWhere.projectType = projectType;
      }
      if (clientEmail) {
        projectWhere.customerEmail = clientEmail;
      }
      if (artisanId) {
        projectWhere.assignedToId = artisanId;
      }
      
      projectsInPeriod = await db.project.findMany({
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
              paymentRequests: true,
              weeklyUpdates: true,
              risks: true,
              changeOrders: true,
            },
          },
          invoices: true,
          quotations: true,
          changeOrders: true,
        },
      });
      
      // Flatten all milestones from all projects
      allMilestones = projectsInPeriod.flatMap(p => p.milestones || []);
    }
    // -------------------------------------------------------------------

    // Calculate metrics
    const paidInvoices = invoices
      .filter((i) => i.status === "PAID")
      .reduce((sum, i) => sum + i.total, 0);

    // Revenue comes only from paid invoices (what clients actually pay)
    // Order totalCost represents internal company costs, not revenue
    const totalRevenue = paidInvoices;

    // Calculate quotation expenses (from approved quotations)
    const quotationMaterialCosts = quotations
      .filter((q) => q.status === "APPROVED")
      .reduce((sum, q) => sum + (q.companyMaterialCost || 0), 0);

    const quotationLabourCosts = quotations
      .filter((q) => q.status === "APPROVED")
      .reduce((sum, q) => sum + (q.companyLabourCost || 0), 0);

    // Artisan payments (not including material/labor costs which are tracked separately)
    const artisanPayments = paymentRequests
      .filter((pr) => pr.status === "PAID")
      .reduce((sum, pr) => sum + pr.calculatedAmount, 0);

    // Material and labor costs
    const orderMaterialCosts = orders.reduce((sum, o) => sum + o.materialCost, 0);
    const orderLabourCosts = orders.reduce((sum, o) => sum + o.labourCost, 0);
    
    const totalMaterialCosts = orderMaterialCosts + quotationMaterialCosts;
    const totalLabourCosts = orderLabourCosts + quotationLabourCosts;

    // Total expenses = artisan payments + material costs + labor costs
    const totalExpenses = artisanPayments + totalMaterialCosts + totalLabourCosts;

    const totalAssets = assets.reduce((sum, a) => sum + a.currentValue, 0);

    const currentLiabilities = allLiabilities
      .filter((l) => !l.isPaid)
      .reduce((sum, l) => sum + l.amount, 0);

    const accountsPayable = allLiabilities
      .filter((l) => l.category === "ACCOUNTS_PAYABLE" && !l.isPaid)
      .reduce((sum, l) => sum + l.amount, 0);

    const loans = allLiabilities
      .filter((l) => l.category === "LOAN" && !l.isPaid)
      .reduce((sum, l) => sum + l.amount, 0);

    const creditLines = allLiabilities
      .filter((l) => l.category === "CREDIT_LINE" && !l.isPaid)
      .reduce((sum, l) => sum + l.amount, 0);

    // Include pending payment requests as current liabilities
    const pendingPayments = paymentRequests
      .filter((pr) => pr.status === "APPROVED" || pr.status === "PENDING")
      .reduce((sum, pr) => sum + pr.calculatedAmount, 0);

    const totalLiabilities = currentLiabilities + pendingPayments;

    // Net profit = total revenue - total expenses
    const netProfit = totalRevenue - totalExpenses;
    const equity = totalAssets - totalLiabilities;

    // --- Calculate Monthly Business Insights Metrics ---
    let businessInsights: any = null;
    
    if (reportType === "MONTHLY_BUSINESS_INSIGHTS") {
      // Project metrics
      const totalProjectsCreated = projectsInPeriod.length;
      const projectsByStatus = {
        PLANNING: projectsInPeriod.filter(p => p.status === "PLANNING").length,
        IN_PROGRESS: projectsInPeriod.filter(p => p.status === "IN_PROGRESS").length,
        ON_HOLD: projectsInPeriod.filter(p => p.status === "ON_HOLD").length,
        COMPLETED: projectsInPeriod.filter(p => p.status === "COMPLETED").length,
        CANCELLED: projectsInPeriod.filter(p => p.status === "CANCELLED").length,
      };
      
      const totalProjectsBudget = projectsInPeriod.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
      const totalProjectsActualCost = projectsInPeriod.reduce((sum, p) => sum + (p.actualCost || 0), 0);
      const projectBudgetVariance = totalProjectsBudget - totalProjectsActualCost;
      const projectBudgetUtilization = totalProjectsBudget > 0 
        ? (totalProjectsActualCost / totalProjectsBudget) * 100 
        : 0;
      
      // Milestone metrics
      const totalMilestones = allMilestones.length;
      const milestonesByStatus = {
        PLANNING: allMilestones.filter(m => m.status === "PLANNING" || m.status === "NOT_STARTED").length,
        IN_PROGRESS: allMilestones.filter(m => m.status === "IN_PROGRESS").length,
        ON_HOLD: allMilestones.filter(m => m.status === "ON_HOLD").length,
        COMPLETED: allMilestones.filter(m => m.status === "COMPLETED").length,
        CANCELLED: allMilestones.filter(m => m.status === "CANCELLED").length,
      };
      
      const milestoneCompletionRate = totalMilestones > 0
        ? (milestonesByStatus.COMPLETED / totalMilestones) * 100
        : 0;
      
      const averageMilestoneProgress = totalMilestones > 0
        ? allMilestones.reduce((sum, m) => sum + m.progressPercentage, 0) / totalMilestones
        : 0;
      
      // Milestone financial metrics
      const totalMilestoneBudget = allMilestones.reduce((sum, m) => sum + m.budgetAllocated, 0);
      const totalMilestoneActualCost = allMilestones.reduce((sum, m) => sum + m.actualCost, 0);
      const totalMilestoneLabourCost = allMilestones.reduce((sum, m) => sum + m.labourCost, 0);
      const totalMilestoneMaterialCost = allMilestones.reduce((sum, m) => sum + m.materialCost, 0);
      const totalMilestoneExpectedProfit = allMilestones.reduce((sum, m) => sum + m.expectedProfit, 0);
      
      // Milestone delays
      const now = new Date();
      const delayedMilestones = allMilestones.filter(m => {
        if (!m.endDate || m.status === "COMPLETED" || m.status === "CANCELLED") return false;
        return new Date(m.endDate) < now;
      });
      
      // Weekly updates
      const allWeeklyUpdates = allMilestones.flatMap(m => m.weeklyUpdates || []);
      const milestonesWithUpdates = new Set(
        allWeeklyUpdates.map(wu => wu.milestoneId)
      ).size;
      
      // Payment requests from milestones
      const allMilestonePaymentRequests = allMilestones.flatMap(m => m.paymentRequests || []);
      const milestonePaymentSummary = {
        total: allMilestonePaymentRequests.length,
        pending: allMilestonePaymentRequests.filter(pr => pr.status === "PENDING").length,
        approved: allMilestonePaymentRequests.filter(pr => pr.status === "APPROVED").length,
        paid: allMilestonePaymentRequests.filter(pr => pr.status === "PAID").length,
        totalAmount: allMilestonePaymentRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0),
      };
      
      // Risks
      const allRisks = allMilestones.flatMap(m => m.risks || []);
      const riskSummary = {
        total: allRisks.length,
        open: allRisks.filter(r => r.status === "OPEN").length,
        critical: allRisks.filter(r => 
          (r.probability === "HIGH" || r.impact === "HIGH") && r.status === "OPEN"
        ).length,
      };
      
      // Change orders
      const allChangeOrders = [
        ...projectsInPeriod.flatMap(p => p.changeOrders || []),
        ...allMilestones.flatMap(m => m.changeOrders || []),
      ];
      const changeOrderSummary = {
        total: allChangeOrders.length,
        pending: allChangeOrders.filter(co => co.status === "PENDING").length,
        approved: allChangeOrders.filter(co => co.status === "APPROVED").length,
        totalCostImpact: allChangeOrders
          .filter(co => co.status === "APPROVED" || co.status === "IMPLEMENTED")
          .reduce((sum, co) => sum + co.costImpact, 0),
      };
      
      // Project invoices and quotations
      const projectInvoices = projectsInPeriod.flatMap(p => p.invoices || []);
      const projectQuotations = projectsInPeriod.flatMap(p => p.quotations || []);
      
      const projectInvoiceSummary = {
        total: projectInvoices.length,
        paid: projectInvoices.filter(i => i.status === "PAID").length,
        totalAmount: projectInvoices.reduce((sum, i) => sum + i.total, 0),
        totalPaid: projectInvoices.filter(i => i.status === "PAID").reduce((sum, i) => sum + i.total, 0),
      };
      
      const projectQuotationSummary = {
        total: projectQuotations.length,
        approved: projectQuotations.filter(q => q.status === "APPROVED").length,
      };
      
      businessInsights = {
        // Project metrics
        totalProjectsCreated,
        projectsByStatus,
        totalProjectsBudget,
        totalProjectsActualCost,
        projectBudgetVariance,
        projectBudgetUtilization,
        
        // Milestone metrics
        totalMilestones,
        milestonesByStatus,
        milestoneCompletionRate,
        averageMilestoneProgress,
        delayedMilestonesCount: delayedMilestones.length,
        milestonesWithUpdates,
        
        // Milestone financial metrics
        totalMilestoneBudget,
        totalMilestoneActualCost,
        totalMilestoneLabourCost,
        totalMilestoneMaterialCost,
        totalMilestoneExpectedProfit,
        
        // Other metrics
        milestonePaymentSummary,
        riskSummary,
        changeOrderSummary,
        projectInvoiceSummary,
        projectQuotationSummary,
      };
    }
    // ----------------------------------------------------

    // --- Calculate Cash Flow Statement Data ---
    let cashFlowData: any = null;
    
    if (reportType.includes("CFS")) {
      // OPERATING ACTIVITIES
      // Cash inflows from customers (paid invoices)
      const cashFromCustomers = invoices
        .filter((i) => i.status === "PAID" && i.paidDate)
        .reduce((sum, i) => sum + i.total, 0);
      
      // Cash outflows for expenses
      const cashPaidToSuppliers = totalMaterialCosts; // Materials purchased
      const cashPaidForLabour = totalLabourCosts; // Labour costs
      const cashPaidToArtisans = artisanPayments; // Artisan payments
      
      const totalOperatingOutflows = cashPaidToSuppliers + cashPaidForLabour + cashPaidToArtisans;
      const netCashFromOperating = cashFromCustomers - totalOperatingOutflows;
      
      // INVESTING ACTIVITIES
      // Cash outflows for asset purchases (assets created in this period)
      const assetPurchases = assets
        .filter(a => {
          const purchaseDate = new Date(a.purchaseDate);
          return purchaseDate >= startDate && purchaseDate <= endDate;
        })
        .reduce((sum, a) => sum + a.purchasePrice, 0);
      
      // For simplicity, we'll assume no asset sales in this period
      // In a real system, you'd track asset disposals
      const assetSales = 0;
      
      const netCashFromInvesting = assetSales - assetPurchases;
      
      // FINANCING ACTIVITIES
      // Cash inflows from new loans/liabilities
      const newLiabilities = liabilities
        .filter(l => {
          const createdDate = new Date(l.createdAt);
          return createdDate >= startDate && createdDate <= endDate;
        })
        .reduce((sum, l) => sum + l.amount, 0);
      
      // Cash outflows for loan/liability payments
      const liabilityPayments = liabilities
        .filter(l => l.isPaid && l.paidDate)
        .filter(l => {
          const paidDate = new Date(l.paidDate!);
          return paidDate >= startDate && paidDate <= endDate;
        })
        .reduce((sum, l) => sum + l.amount, 0);
      
      const netCashFromFinancing = newLiabilities - liabilityPayments;
      
      // NET CHANGE IN CASH
      const netCashChange = netCashFromOperating + netCashFromInvesting + netCashFromFinancing;
      
      // For cash balance, we'd need to track it over time
      // For now, we'll use a simplified approach
      const beginningCash = 0; // This should be tracked in the system
      const endingCash = beginningCash + netCashChange;
      
      cashFlowData = {
        // Operating Activities
        cashFromCustomers,
        cashPaidToSuppliers,
        cashPaidForLabour,
        cashPaidToArtisans,
        totalOperatingOutflows,
        netCashFromOperating,
        
        // Investing Activities
        assetPurchases,
        assetSales,
        netCashFromInvesting,
        
        // Financing Activities
        newLiabilities,
        liabilityPayments,
        netCashFromFinancing,
        
        // Summary
        netCashChange,
        beginningCash,
        endingCash,
      };
    }
    // -------------------------------------------

    // Prepare financial summary object (used for both AI and PDF)
    const financialSummary = {
      period: reportType.includes("MONTHLY")
        ? "monthly"
        : reportType.includes("QUARTERLY")
        ? "quarterly"
        : "annual",
      totalRevenue,
      paidInvoices,
      totalExpenses,
      artisanPayments,
      materialCosts: totalMaterialCosts,
      labourCosts: totalLabourCosts,
      orderMaterialCosts,
      orderLabourCosts,
      quotationMaterialCosts,
      quotationLabourCosts,
      netProfit,
      profitMargin: totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0,
      totalAssets,
      currentLiabilities,
      accountsPayable,
      loans,
      creditLines,
      pendingPayments,
      totalLiabilities,
      equity,
      orderCount: orders.length,
      completedOrders: orders.filter((o) => o.status === "COMPLETED").length,
      invoiceCount: invoices.length,
      paidInvoiceCount: invoices.filter((i) => i.status === "PAID").length,
      quotationCount: quotations.length,
      approvedQuotationCount: quotations.filter((q) => q.status === "APPROVED").length,
      // Filter information
      projectType,
      clientEmail,
      artisanId,
      ...(businessInsights ? { businessInsights } : {}),
      ...(cashFlowData ? { cashFlowData } : {}),
    };

    // Generate AI insights with fallback
    let aiInsights = "AI insights are temporarily unavailable. Please review the financial metrics above for your analysis.";
    
    try {
      const googleAI = createGoogleGenerativeAI({
        apiKey: env.GOOGLE_GENERATIVE_AI_API_KEY || env.GEMINI_API_KEY,
      });
      const model = googleAI("gemini-1.5-pro");

      const filterDescription = [];
      if (projectType) filterDescription.push(`Project Type: ${projectType}`);
      if (clientEmail) filterDescription.push(`Client: ${clientEmail}`);
      if (artisanId) {
        const artisan = await db.user.findUnique({ where: { id: artisanId } });
        if (artisan) {
          filterDescription.push(`Artisan: ${artisan.firstName} ${artisan.lastName}`);
        }
      }

      const promptBase = `You are a financial analyst for a South African facility management company. Analyze the following ${financialSummary.period} financial data and provide insights in 3-4 paragraphs:

${filterDescription.length > 0 ? `\nFILTERS APPLIED:\n${filterDescription.join('\n')}\n` : ''}
Financial Summary:
- Total Revenue: R${financialSummary.totalRevenue.toLocaleString()} (from Paid Invoices)
- Total Expenses: R${financialSummary.totalExpenses.toLocaleString()}
  - Artisan Payments: R${financialSummary.artisanPayments.toLocaleString()}
  - Material Costs: R${financialSummary.materialCosts.toLocaleString()} (Orders: R${financialSummary.orderMaterialCosts.toLocaleString()} + Quotations: R${financialSummary.quotationMaterialCosts.toLocaleString()})
  - Labour Costs: R${financialSummary.labourCosts.toLocaleString()} (Orders: R${financialSummary.orderLabourCosts.toLocaleString()} + Quotations: R${financialSummary.quotationLabourCosts.toLocaleString()})
- Net Profit: R${financialSummary.netProfit.toLocaleString()}
- Profit Margin: ${financialSummary.profitMargin.toFixed(2)}%
- Total Assets: R${financialSummary.totalAssets.toLocaleString()}
- Total Liabilities: R${financialSummary.totalLiabilities.toLocaleString()}
  - Current Liabilities: R${financialSummary.currentLiabilities.toLocaleString()}
  - Accounts Payable: R${financialSummary.accountsPayable.toLocaleString()}
  - Loans: R${financialSummary.loans.toLocaleString()}
  - Credit Lines: R${financialSummary.creditLines.toLocaleString()}
  - Pending Artisan Payments: R${financialSummary.pendingPayments.toLocaleString()}
- Equity: R${financialSummary.equity.toLocaleString()}
- Orders: ${financialSummary.completedOrders} completed out of ${financialSummary.orderCount} total
- Invoices: ${financialSummary.paidInvoiceCount} paid out of ${financialSummary.invoiceCount} total
- Quotations: ${financialSummary.approvedQuotationCount} approved out of ${financialSummary.quotationCount} total`;

      let businessInsightsSection = '';
      if (businessInsights) {
        businessInsightsSection = `

Project & Milestone Summary:
- Projects Created: ${businessInsights.totalProjectsCreated}
  - In Progress: ${businessInsights.projectsByStatus.IN_PROGRESS}
  - Completed: ${businessInsights.projectsByStatus.COMPLETED}
  - On Hold: ${businessInsights.projectsByStatus.ON_HOLD}
- Project Budget: R${businessInsights.totalProjectsBudget.toLocaleString()}
- Project Actual Cost: R${businessInsights.totalProjectsActualCost.toLocaleString()}
- Project Budget Utilization: ${businessInsights.projectBudgetUtilization.toFixed(1)}%
- Milestones: ${businessInsights.totalMilestones} total
  - Completed: ${businessInsights.milestonesByStatus.COMPLETED} (${businessInsights.milestoneCompletionRate.toFixed(1)}%)
  - In Progress: ${businessInsights.milestonesByStatus.IN_PROGRESS}
  - Delayed: ${businessInsights.delayedMilestonesCount}
- Average Milestone Progress: ${businessInsights.averageMilestoneProgress.toFixed(1)}%
- Milestone Budget: R${businessInsights.totalMilestoneBudget.toLocaleString()}
- Milestone Actual Cost: R${businessInsights.totalMilestoneActualCost.toLocaleString()}
- Open Risks: ${businessInsights.riskSummary.open} (${businessInsights.riskSummary.critical} critical)
- Change Orders: ${businessInsights.changeOrderSummary.total} (${businessInsights.changeOrderSummary.pending} pending)
- Milestone Payments: ${businessInsights.milestonePaymentSummary.paid}/${businessInsights.milestonePaymentSummary.total} paid`;
      }

      let cashFlowSection = '';
      if (cashFlowData) {
        cashFlowSection = `

Cash Flow Analysis:
Operating Activities:
- Cash from Customers: R${cashFlowData.cashFromCustomers.toLocaleString()}
- Cash Paid to Suppliers: R${cashFlowData.cashPaidToSuppliers.toLocaleString()}
- Cash Paid for Labour: R${cashFlowData.cashPaidForLabour.toLocaleString()}
- Cash Paid to Artisans: R${cashFlowData.cashPaidToArtisans.toLocaleString()}
- Net Cash from Operating: R${cashFlowData.netCashFromOperating.toLocaleString()}

Investing Activities:
- Asset Purchases: R${cashFlowData.assetPurchases.toLocaleString()}
- Asset Sales: R${cashFlowData.assetSales.toLocaleString()}
- Net Cash from Investing: R${cashFlowData.netCashFromInvesting.toLocaleString()}

Financing Activities:
- New Loans/Liabilities: R${cashFlowData.newLiabilities.toLocaleString()}
- Loan Payments: R${cashFlowData.liabilityPayments.toLocaleString()}
- Net Cash from Financing: R${cashFlowData.netCashFromFinancing.toLocaleString()}

Net Cash Change: R${cashFlowData.netCashChange.toLocaleString()}`;
      }

      const prompt = promptBase + businessInsightsSection + cashFlowSection + `

Provide:
1. Overall financial health assessment${filterDescription.length > 0 ? ' for the filtered scope' : ''}${businessInsights ? ' including project and milestone performance' : ''}${cashFlowData ? ' and cash flow position' : ''}
2. Key trends and patterns${businessInsights ? ' across projects, milestones, and finances' : ''}${cashFlowData ? ' including cash flow trends' : ''}
3. Areas of concern or opportunity${businessInsights ? ' (budget overruns, delays, risks)' : ''}${cashFlowData ? ' (cash flow issues, liquidity concerns)' : ''}
4. Recommendations for SARS compliance and business improvement${cashFlowData ? ' including cash management strategies' : ''}

Format as clear, professional paragraphs suitable for a formal financial report.`;

      const { text } = await generateText({
        model,
        prompt,
      });
      
      aiInsights = text;
    } catch (aiError: any) {
      console.error("Error generating AI insights:", aiError);
      
      // Check for payment/billing related errors
      const errorMessage = aiError.message || aiError.toString();
      if (errorMessage.includes("Payment Required") || 
          errorMessage.includes("402") || 
          errorMessage.includes("insufficient credits") ||
          errorMessage.includes("billing")) {
        console.warn("Google Gemini API key has insufficient credits or billing issues. Report will be generated without AI insights.");
        aiInsights = "AI insights are currently unavailable due to API service limitations. The financial report has been generated successfully with all metrics calculated. Please review the financial data above or contact support to enable AI-powered insights.";
      } else {
        // For other errors, log but continue with fallback message
        console.warn("Failed to generate AI insights, continuing without them:", errorMessage);
        aiInsights = `AI insights could not be generated at this time (${errorMessage.substring(0, 100)}). Please review the financial metrics above for your analysis.`;
      }
    }

    // Generate PDF
    const pdfBuffer = await generateFinancialReportPdf(
      reportType,
      startDate,
      endDate,
      financialSummary,
      aiInsights,
      orders,
      invoices,
      paymentRequests,
      assets,
      projectsInPeriod
    );

    // Generate CSV
    const csvBuffer = await generateFinancialReportCsv(
      reportType,
      startDate,
      endDate,
      financialSummary,
      aiInsights,
      projectsInPeriod
    );

    // Upload PDF to MinIO
    const pdfFileName = `financial-reports/${reportType.toLowerCase()}-${
      startDate.getTime()
    }-${endDate.getTime()}.pdf`;
    await minioClient.putObject(
      "documents",
      pdfFileName,
      pdfBuffer,
      pdfBuffer.length,
      { "Content-Type": "application/pdf" }
    );

    const pdfUrl = `${minioBaseUrl}/documents/${pdfFileName}`;

    // Upload CSV to MinIO
    const csvFileName = `financial-reports/${reportType.toLowerCase()}-${
      startDate.getTime()
    }-${endDate.getTime()}.csv`;
    await minioClient.putObject(
      "documents",
      csvFileName,
      csvBuffer,
      csvBuffer.length,
      { "Content-Type": "text/csv" }
    );

    const csvUrl = `${minioBaseUrl}/documents/${csvFileName}`;

    // Update report record
    await db.financialReport.update({
      where: { id: reportId },
      data: {
        status: "COMPLETED",
        pdfUrl,
        csvUrl,
        aiInsights,
        totalRevenue,
        totalExpenses,
        netProfit,
        totalAssets,
        totalLiabilities,
        equity,
      },
    });
  } catch (error) {
    console.error("Error in background report generation:", error);
    throw error;
  }
}

async function generateFinancialReportCsv(
  reportType: string,
  startDate: Date,
  endDate: Date,
  financialSummary: any,
  aiInsights: string,
  projectsInPeriod: any[] = []
): Promise<Buffer> {
  const companyDetails = await getCompanyDetails();
  
  const rows: string[][] = [];
  
  // Header section
  rows.push([companyDetails.companyName]);
  rows.push([companyDetails.companyAddressLine1]);
  rows.push([companyDetails.companyAddressLine2]);
  rows.push([`VAT: ${companyDetails.companyVatNumber}`]);
  rows.push([]);
  
  // Report title
  const reportTitle = reportType === "MONTHLY_BUSINESS_INSIGHTS"
    ? "MONTHLY BUSINESS INSIGHTS REPORT"
    : reportType.includes("CFS")
    ? "CASH FLOW STATEMENT"
    : reportType.includes("PL")
    ? "PROFIT & LOSS STATEMENT"
    : "BALANCE SHEET";
  rows.push([reportTitle]);
  rows.push([`Period: ${startDate.toLocaleDateString("en-ZA")} - ${endDate.toLocaleDateString("en-ZA")}`]);
  rows.push([]);
  
  // Add filter information if present
  if (financialSummary.projectType || financialSummary.clientEmail || financialSummary.artisanId) {
    rows.push(["FILTERS APPLIED"]);
    if (financialSummary.projectType) {
      rows.push(["Project Type", financialSummary.projectType]);
    }
    if (financialSummary.clientEmail) {
      rows.push(["Client Email", financialSummary.clientEmail]);
    }
    if (financialSummary.artisanId) {
      rows.push(["Artisan ID", financialSummary.artisanId.toString()]);
    }
    rows.push([]);
  }
  
  if (reportType === "MONTHLY_BUSINESS_INSIGHTS") {
    // Business Insights Report - comprehensive view
    const bi = financialSummary.businessInsights;
    
    rows.push(["EXECUTIVE SUMMARY"]);
    rows.push([]);
    rows.push(["FINANCIAL PERFORMANCE"]);
    rows.push(["Total Revenue", `R ${financialSummary.totalRevenue.toLocaleString()}`]);
    rows.push(["Total Expenses", `R ${financialSummary.totalExpenses.toLocaleString()}`]);
    rows.push(["Net Profit", `R ${financialSummary.netProfit.toLocaleString()}`]);
    rows.push(["Profit Margin", `${financialSummary.profitMargin.toFixed(2)}%`]);
    rows.push([]);
    
    if (bi) {
      rows.push(["PROJECT PERFORMANCE"]);
      rows.push(["Total Projects Created", bi.totalProjectsCreated.toString()]);
      rows.push(["Projects In Progress", bi.projectsByStatus.IN_PROGRESS.toString()]);
      rows.push(["Projects Completed", bi.projectsByStatus.COMPLETED.toString()]);
      rows.push(["Projects On Hold", bi.projectsByStatus.ON_HOLD.toString()]);
      rows.push(["Total Project Budget", `R ${bi.totalProjectsBudget.toLocaleString()}`]);
      rows.push(["Total Project Actual Cost", `R ${bi.totalProjectsActualCost.toLocaleString()}`]);
      rows.push(["Project Budget Variance", `R ${bi.projectBudgetVariance.toLocaleString()}`]);
      rows.push(["Project Budget Utilization", `${bi.projectBudgetUtilization.toFixed(1)}%`]);
      rows.push([]);
      
      rows.push(["MILESTONE PERFORMANCE"]);
      rows.push(["Total Milestones", bi.totalMilestones.toString()]);
      rows.push(["Milestones Completed", bi.milestonesByStatus.COMPLETED.toString()]);
      rows.push(["Milestones In Progress", bi.milestonesByStatus.IN_PROGRESS.toString()]);
      rows.push(["Milestones On Hold", bi.milestonesByStatus.ON_HOLD.toString()]);
      rows.push(["Delayed Milestones", bi.delayedMilestonesCount.toString()]);
      rows.push(["Milestone Completion Rate", `${bi.milestoneCompletionRate.toFixed(1)}%`]);
      rows.push(["Average Milestone Progress", `${bi.averageMilestoneProgress.toFixed(1)}%`]);
      rows.push(["Milestones with Updates", bi.milestonesWithUpdates.toString()]);
      rows.push([]);
      
      rows.push(["MILESTONE FINANCIAL METRICS"]);
      rows.push(["Total Milestone Budget", `R ${bi.totalMilestoneBudget.toLocaleString()}`]);
      rows.push(["Total Milestone Actual Cost", `R ${bi.totalMilestoneActualCost.toLocaleString()}`]);
      rows.push(["Total Labour Cost", `R ${bi.totalMilestoneLabourCost.toLocaleString()}`]);
      rows.push(["Total Material Cost", `R ${bi.totalMilestoneMaterialCost.toLocaleString()}`]);
      rows.push(["Total Expected Profit", `R ${bi.totalMilestoneExpectedProfit.toLocaleString()}`]);
      rows.push([]);
      
      rows.push(["RISK & CHANGE MANAGEMENT"]);
      rows.push(["Total Risks", bi.riskSummary.total.toString()]);
      rows.push(["Open Risks", bi.riskSummary.open.toString()]);
      rows.push(["Critical Risks", bi.riskSummary.critical.toString()]);
      rows.push(["Total Change Orders", bi.changeOrderSummary.total.toString()]);
      rows.push(["Pending Change Orders", bi.changeOrderSummary.pending.toString()]);
      rows.push(["Change Order Cost Impact", `R ${bi.changeOrderSummary.totalCostImpact.toLocaleString()}`]);
      rows.push([]);
      
      rows.push(["PAYMENT & INVOICING"]);
      rows.push(["Milestone Payment Requests", bi.milestonePaymentSummary.total.toString()]);
      rows.push(["Payments Paid", bi.milestonePaymentSummary.paid.toString()]);
      rows.push(["Payments Pending", bi.milestonePaymentSummary.pending.toString()]);
      rows.push(["Total Payment Amount", `R ${bi.milestonePaymentSummary.totalAmount.toLocaleString()}`]);
      rows.push(["Project Invoices", bi.projectInvoiceSummary.total.toString()]);
      rows.push(["Invoices Paid", bi.projectInvoiceSummary.paid.toString()]);
      rows.push(["Total Invoiced", `R ${bi.projectInvoiceSummary.totalAmount.toLocaleString()}`]);
      rows.push([]);
    }
    
    rows.push(["OPERATIONAL METRICS"]);
    rows.push(["Total Orders", financialSummary.orderCount.toString()]);
    rows.push(["Completed Orders", financialSummary.completedOrders.toString()]);
    rows.push(["Total Invoices", financialSummary.invoiceCount.toString()]);
    rows.push(["Paid Invoices", financialSummary.paidInvoiceCount.toString()]);
    rows.push([]);
    
    rows.push(["BALANCE SHEET SNAPSHOT"]);
    rows.push(["Total Assets", `R ${financialSummary.totalAssets.toLocaleString()}`]);
    rows.push(["Total Liabilities", `R ${financialSummary.totalLiabilities.toLocaleString()}`]);
    rows.push(["Equity", `R ${financialSummary.equity.toLocaleString()}`]);
    rows.push([]);
  } else if (reportType.includes("CFS")) {
    // Cash Flow Statement
    const cfs = financialSummary.cashFlowData;
    
    rows.push(["CASH FLOWS FROM OPERATING ACTIVITIES"]);
    rows.push(["Cash Received from Customers", `R ${cfs.cashFromCustomers.toLocaleString()}`]);
    rows.push([]);
    rows.push(["Cash Paid for:"]);
    rows.push(["  Suppliers (Materials)", `R ${cfs.cashPaidToSuppliers.toLocaleString()}`]);
    rows.push(["  Labour Costs", `R ${cfs.cashPaidForLabour.toLocaleString()}`]);
    rows.push(["  Artisan Payments", `R ${cfs.cashPaidToArtisans.toLocaleString()}`]);
    rows.push(["Total Operating Outflows", `R ${cfs.totalOperatingOutflows.toLocaleString()}`]);
    rows.push([]);
    rows.push(["Net Cash from Operating Activities", `R ${cfs.netCashFromOperating.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["CASH FLOWS FROM INVESTING ACTIVITIES"]);
    rows.push(["Asset Purchases", `(R ${cfs.assetPurchases.toLocaleString()})`]);
    rows.push(["Asset Sales", `R ${cfs.assetSales.toLocaleString()}`]);
    rows.push(["Net Cash from Investing Activities", `R ${cfs.netCashFromInvesting.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["CASH FLOWS FROM FINANCING ACTIVITIES"]);
    rows.push(["New Loans/Liabilities", `R ${cfs.newLiabilities.toLocaleString()}`]);
    rows.push(["Loan/Liability Payments", `(R ${cfs.liabilityPayments.toLocaleString()})`]);
    rows.push(["Net Cash from Financing Activities", `R ${cfs.netCashFromFinancing.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["NET INCREASE/(DECREASE) IN CASH", `R ${cfs.netCashChange.toLocaleString()}`]);
    rows.push(["Cash at Beginning of Period", `R ${cfs.beginningCash.toLocaleString()}`]);
    rows.push(["Cash at End of Period", `R ${cfs.endingCash.toLocaleString()}`]);
  } else if (reportType.includes("PL")) {
    // P&L Statement
    rows.push(["REVENUE"]);
    rows.push(["Paid Invoices", `R ${financialSummary.paidInvoices.toLocaleString()}`]);
    rows.push(["Total Revenue", `R ${financialSummary.totalRevenue.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["EXPENSES"]);
    rows.push(["Material Costs", `R ${financialSummary.materialCosts.toLocaleString()}`]);
    rows.push(["  - From Orders", `R ${financialSummary.orderMaterialCosts.toLocaleString()}`]);
    rows.push(["  - From Quotations", `R ${financialSummary.quotationMaterialCosts.toLocaleString()}`]);
    rows.push(["Labour Costs", `R ${financialSummary.labourCosts.toLocaleString()}`]);
    rows.push(["  - From Orders", `R ${financialSummary.orderLabourCosts.toLocaleString()}`]);
    rows.push(["  - From Quotations", `R ${financialSummary.quotationLabourCosts.toLocaleString()}`]);
    rows.push(["Artisan Payments", `R ${financialSummary.artisanPayments.toLocaleString()}`]);
    rows.push(["Total Expenses", `R ${financialSummary.totalExpenses.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["NET PROFIT", `R ${financialSummary.netProfit.toLocaleString()}`]);
    rows.push(["Profit Margin", `${financialSummary.profitMargin.toFixed(2)}%`]);
    rows.push([]);
    
    rows.push(["OPERATIONAL METRICS"]);
    rows.push(["Total Orders", financialSummary.orderCount.toString()]);
    rows.push(["Completed Orders", financialSummary.completedOrders.toString()]);
    rows.push(["Total Invoices", financialSummary.invoiceCount.toString()]);
    rows.push(["Paid Invoices", financialSummary.paidInvoiceCount.toString()]);
    rows.push(["Total Quotations", financialSummary.quotationCount.toString()]);
    rows.push(["Approved Quotations", financialSummary.approvedQuotationCount.toString()]);
  } else {
    // Balance Sheet
    rows.push(["ASSETS"]);
    rows.push(["Current Assets", `R ${financialSummary.totalAssets.toLocaleString()}`]);
    rows.push(["Total Assets", `R ${financialSummary.totalAssets.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["LIABILITIES"]);
    rows.push(["Accounts Payable", `R ${financialSummary.accountsPayable.toLocaleString()}`]);
    rows.push(["Loans", `R ${financialSummary.loans.toLocaleString()}`]);
    rows.push(["Credit Lines", `R ${financialSummary.creditLines.toLocaleString()}`]);
    rows.push(["Pending Artisan Payments", `R ${financialSummary.pendingPayments.toLocaleString()}`]);
    rows.push(["Total Liabilities", `R ${financialSummary.totalLiabilities.toLocaleString()}`]);
    rows.push([]);
    
    rows.push(["EQUITY", `R ${financialSummary.equity.toLocaleString()}`]);
  }
  
  rows.push([]);
  rows.push(["FINANCIAL ANALYSIS"]);
  rows.push([]);
  
  // Split AI insights into multiple rows for better readability
  const insightLines = aiInsights.split('\n');
  insightLines.forEach(line => {
    if (line.trim()) {
      rows.push([line.trim()]);
    }
  });
  
  rows.push([]);
  rows.push([`Generated on ${new Date().toLocaleDateString("en-ZA")} for SARS submission`]);
  
  // Convert to CSV format
  const csvContent = rows
    .map(row => 
      row.map(cell => {
        // Escape quotes and wrap in quotes if contains comma, quote, or newline
        const cellStr = String(cell);
        if (cellStr.includes(',') || cellStr.includes('"') || cellStr.includes('\n')) {
          return `"${cellStr.replace(/"/g, '""')}"`;
        }
        return cellStr;
      }).join(',')
    )
    .join('\n');
  
  return Buffer.from(csvContent, 'utf-8');
}

async function generateFinancialReportPdf(
  reportType: string,
  startDate: Date,
  endDate: Date,
  financialSummary: any,
  aiInsights: string,
  orders: any[],
  invoices: any[],
  paymentRequests: any[],
  assets: any[],
  projectsInPeriod: any[] = []
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise<Buffer>(async (resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });

    doc.on("error", reject);

    // Add company logo
    const logoBuffer = await getCompanyLogo();
    if (logoBuffer) {
      try {
        doc.image(logoBuffer, 50, 45, { width: 100 });
      } catch (error) {
        console.error("Error adding logo to PDF:", error);
      }
    }

    const companyDetails = await getCompanyDetails();

    // Company details
    doc
      .fontSize(10)
      .text(companyDetails.companyName, 400, 50, { align: "right" })
      .text(companyDetails.companyAddressLine1, 400, 65, { align: "right" })
      .text(companyDetails.companyAddressLine2, 400, 80, { align: "right" })
      .text(`VAT: ${companyDetails.companyVatNumber}`, 400, 95, { align: "right" });

    // Report title
    const reportTitle = reportType === "MONTHLY_BUSINESS_INSIGHTS"
      ? "MONTHLY BUSINESS INSIGHTS REPORT"
      : reportType.includes("CFS")
      ? "CASH FLOW STATEMENT"
      : reportType.includes("PL")
      ? "PROFIT & LOSS STATEMENT"
      : "BALANCE SHEET";
    doc.fontSize(20).fillColor("#1a1a1a").text(reportTitle, 50, 150);

    // Report period
    doc
      .fontSize(12)
      .fillColor("#666666")
      .text(
        `Period: ${startDate.toLocaleDateString("en-ZA")} - ${endDate.toLocaleDateString(
          "en-ZA"
        )}`,
        50,
        180
      );

    let yPos = 220;

    if (reportType === "MONTHLY_BUSINESS_INSIGHTS") {
      // Monthly Business Insights Report - comprehensive view
      const bi = financialSummary.businessInsights;
      
      // Executive Summary Section
      doc.fontSize(16).fillColor("#1a1a1a").text("EXECUTIVE SUMMARY", 50, yPos);
      yPos += 30;
      
      // Financial Performance
      doc.fontSize(14).fillColor("#1a1a1a").text("Financial Performance", 50, yPos);
      yPos += 25;
      
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Total Revenue", 70, yPos)
        .text(`R${financialSummary.totalRevenue.toLocaleString()}`, 400, yPos, { align: "right" });
      yPos += 20;
      doc
        .text("Total Expenses", 70, yPos)
        .text(`R${financialSummary.totalExpenses.toLocaleString()}`, 400, yPos, { align: "right" });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Net Profit", 70, yPos)
        .text(`R${financialSummary.netProfit.toLocaleString()}`, 400, yPos, { align: "right" });
      yPos += 20;
      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(`Profit Margin: ${financialSummary.profitMargin.toFixed(2)}%`, 70, yPos);
      
      yPos += 35;
      
      if (bi) {
        // Project Performance Section
        doc.fontSize(14).fillColor("#1a1a1a").text("Project Performance", 50, yPos);
        yPos += 25;
        
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text(`Total Projects: ${bi.totalProjectsCreated}`, 70, yPos)
          .text(`In Progress: ${bi.projectsByStatus.IN_PROGRESS}`, 250, yPos)
          .text(`Completed: ${bi.projectsByStatus.COMPLETED}`, 400, yPos);
        yPos += 20;
        doc
          .text("Project Budget", 70, yPos)
          .text(`R${bi.totalProjectsBudget.toLocaleString()}`, 400, yPos, { align: "right" });
        yPos += 20;
        doc
          .text("Actual Cost", 70, yPos)
          .text(`R${bi.totalProjectsActualCost.toLocaleString()}`, 400, yPos, { align: "right" });
        yPos += 20;
        doc
          .text("Budget Utilization", 70, yPos)
          .text(`${bi.projectBudgetUtilization.toFixed(1)}%`, 400, yPos, { align: "right" });
        
        yPos += 35;
        
        // Check if we need a new page
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        
        // Milestone Performance Section
        doc.fontSize(14).fillColor("#1a1a1a").text("Milestone Performance", 50, yPos);
        yPos += 25;
        
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text(`Total Milestones: ${bi.totalMilestones}`, 70, yPos)
          .text(`Completed: ${bi.milestonesByStatus.COMPLETED}`, 250, yPos)
          .text(`In Progress: ${bi.milestonesByStatus.IN_PROGRESS}`, 400, yPos);
        yPos += 20;
        doc
          .text(`Completion Rate: ${bi.milestoneCompletionRate.toFixed(1)}%`, 70, yPos)
          .text(`Avg Progress: ${bi.averageMilestoneProgress.toFixed(1)}%`, 250, yPos);
        if (bi.delayedMilestonesCount > 0) {
          doc.fillColor("#dc2626").text(`Delayed: ${bi.delayedMilestonesCount}`, 400, yPos);
        }
        yPos += 25;
        
        doc
          .fillColor("#333333")
          .text("Milestone Budget", 70, yPos)
          .text(`R${bi.totalMilestoneBudget.toLocaleString()}`, 400, yPos, { align: "right" });
        yPos += 20;
        doc
          .text("Actual Cost", 70, yPos)
          .text(`R${bi.totalMilestoneActualCost.toLocaleString()}`, 400, yPos, { align: "right" });
        yPos += 20;
        doc
          .text("Expected Profit", 70, yPos)
          .text(`R${bi.totalMilestoneExpectedProfit.toLocaleString()}`, 400, yPos, { align: "right" });
        
        yPos += 35;
        
        // Risk & Change Management
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }
        
        doc.fontSize(14).fillColor("#1a1a1a").text("Risk & Change Management", 50, yPos);
        yPos += 25;
        
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text(`Total Risks: ${bi.riskSummary.total}`, 70, yPos)
          .text(`Open: ${bi.riskSummary.open}`, 250, yPos);
        if (bi.riskSummary.critical > 0) {
          doc.fillColor("#dc2626").text(`Critical: ${bi.riskSummary.critical}`, 400, yPos);
        }
        yPos += 20;
        doc
          .fillColor("#333333")
          .text(`Change Orders: ${bi.changeOrderSummary.total}`, 70, yPos)
          .text(`Pending: ${bi.changeOrderSummary.pending}`, 250, yPos);
        yPos += 20;
        if (bi.changeOrderSummary.totalCostImpact !== 0) {
          const impactColor = bi.changeOrderSummary.totalCostImpact > 0 ? "#dc2626" : "#16a34a";
          doc
            .fillColor("#333333")
            .text("Cost Impact", 70, yPos)
            .fillColor(impactColor)
            .text(`R${bi.changeOrderSummary.totalCostImpact.toLocaleString()}`, 400, yPos, { align: "right" });
        }
        
        yPos += 35;
      }
      
      // Operational Metrics
      if (yPos > 650) {
        doc.addPage();
        yPos = 50;
      }
      
      doc.fontSize(14).fillColor("#1a1a1a").text("Operational Metrics", 50, yPos);
      yPos += 25;
      
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text(`Orders: ${financialSummary.completedOrders}/${financialSummary.orderCount} completed`, 70, yPos)
        .text(`Invoices: ${financialSummary.paidInvoiceCount}/${financialSummary.invoiceCount} paid`, 300, yPos);
      yPos += 20;
      doc
        .text(`Quotations: ${financialSummary.approvedQuotationCount}/${financialSummary.quotationCount} approved`, 70, yPos);
      
      yPos += 35;
      
      // Balance Sheet Snapshot
      doc.fontSize(14).fillColor("#1a1a1a").text("Balance Sheet Snapshot", 50, yPos);
      yPos += 25;
      
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Total Assets", 70, yPos)
        .text(`R${financialSummary.totalAssets.toLocaleString()}`, 400, yPos, { align: "right" });
      yPos += 20;
      doc
        .text("Total Liabilities", 70, yPos)
        .text(`R${financialSummary.totalLiabilities.toLocaleString()}`, 400, yPos, { align: "right" });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Equity", 70, yPos)
        .text(`R${financialSummary.equity.toLocaleString()}`, 400, yPos, { align: "right" });
    } else if (reportType.includes("CFS")) {
      // Cash Flow Statement
      const cfs = financialSummary.cashFlowData;
      
      doc.fontSize(14).fillColor("#1a1a1a").text("CASH FLOWS FROM OPERATING ACTIVITIES", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Cash Received from Customers", 70, yPos)
        .text(`R${cfs.cashFromCustomers.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 25;
      doc.text("Cash Paid for:", 70, yPos);
      yPos += 20;
      doc
        .text("  Suppliers (Materials)", 90, yPos)
        .text(`(R${cfs.cashPaidToSuppliers.toLocaleString()})`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("  Labour Costs", 90, yPos)
        .text(`(R${cfs.cashPaidForLabour.toLocaleString()})`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("  Artisan Payments", 90, yPos)
        .text(`(R${cfs.cashPaidToArtisans.toLocaleString()})`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Net Cash from Operating Activities", 70, yPos)
        .text(`R${cfs.netCashFromOperating.toLocaleString()}`, 400, yPos, {
          align: "right",
        });

      yPos += 40;
      doc.fontSize(14).text("CASH FLOWS FROM INVESTING ACTIVITIES", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Asset Purchases", 70, yPos)
        .text(`(R${cfs.assetPurchases.toLocaleString()})`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Asset Sales", 70, yPos)
        .text(`R${cfs.assetSales.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Net Cash from Investing Activities", 70, yPos)
        .text(`R${cfs.netCashFromInvesting.toLocaleString()}`, 400, yPos, {
          align: "right",
        });

      yPos += 40;
      doc.fontSize(14).text("CASH FLOWS FROM FINANCING ACTIVITIES", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("New Loans/Liabilities", 70, yPos)
        .text(`R${cfs.newLiabilities.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Loan/Liability Payments", 70, yPos)
        .text(`(R${cfs.liabilityPayments.toLocaleString()})`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Net Cash from Financing Activities", 70, yPos)
        .text(`R${cfs.netCashFromFinancing.toLocaleString()}`, 400, yPos, {
          align: "right",
        });

      yPos += 40;
      doc
        .rect(50, yPos - 5, 495, 30)
        .fill(env.BRAND_PRIMARY_COLOR);
      doc
        .fontSize(14)
        .fillColor("#ffffff")
        .text("NET CHANGE IN CASH", 70, yPos + 5)
        .text(`R${cfs.netCashChange.toLocaleString()}`, 400, yPos + 5, {
          align: "right",
        });
      yPos += 40;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Cash at Beginning of Period", 70, yPos)
        .text(`R${cfs.beginningCash.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Cash at End of Period", 70, yPos)
        .text(`R${cfs.endingCash.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
    } else if (reportType.includes("PL")) {
      // P&L Statement
      doc.fontSize(14).fillColor("#1a1a1a").text("REVENUE", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Paid Invoices", 70, yPos)
        .text(`R${financialSummary.paidInvoices.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Total Revenue", 70, yPos)
        .text(
          `R${financialSummary.totalRevenue.toLocaleString()}`,
          400,
          yPos,
          { align: "right" }
        );

      yPos += 40;
      doc.fontSize(14).text("EXPENSES", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Material Costs", 70, yPos)
        .text(`R${financialSummary.materialCosts.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Labour Costs", 70, yPos)
        .text(`R${financialSummary.labourCosts.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Artisan Payments", 70, yPos)
        .text(`R${financialSummary.artisanPayments.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Total Expenses", 70, yPos)
        .text(
          `R${financialSummary.totalExpenses.toLocaleString()}`,
          400,
          yPos,
          { align: "right" }
        );

      yPos += 40;
      doc
        .rect(50, yPos - 5, 495, 30)
        .fill(env.BRAND_PRIMARY_COLOR);
      doc
        .fontSize(14)
        .fillColor("#ffffff")
        .text("NET PROFIT", 70, yPos + 5)
        .text(`R${financialSummary.netProfit.toLocaleString()}`, 400, yPos + 5, {
          align: "right",
        });
      yPos += 40;
      doc
        .fontSize(10)
        .fillColor("#666666")
        .text(
          `Profit Margin: ${financialSummary.profitMargin.toFixed(2)}%`,
          70,
          yPos
        );
    } else {
      // Balance Sheet
      doc.fontSize(14).fillColor("#1a1a1a").text("ASSETS", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Current Assets", 70, yPos)
        .text(`R${financialSummary.totalAssets.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Total Assets", 70, yPos)
        .text(`R${financialSummary.totalAssets.toLocaleString()}`, 400, yPos, {
          align: "right",
        });

      yPos += 40;
      doc.fontSize(14).text("LIABILITIES", 50, yPos);
      yPos += 25;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Accounts Payable", 70, yPos)
        .text(`R${financialSummary.accountsPayable.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Loans", 70, yPos)
        .text(`R${financialSummary.loans.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Credit Lines", 70, yPos)
        .text(`R${financialSummary.creditLines.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .text("Pending Artisan Payments", 70, yPos)
        .text(`R${financialSummary.pendingPayments.toLocaleString()}`, 400, yPos, {
          align: "right",
        });
      yPos += 20;
      doc
        .fontSize(11)
        .fillColor("#1a1a1a")
        .text("Total Liabilities", 70, yPos)
        .text(`R${financialSummary.totalLiabilities.toLocaleString()}`, 400, yPos, {
          align: "right",
        });

      yPos += 40;
      doc
        .rect(50, yPos - 5, 495, 30)
        .fill(env.BRAND_PRIMARY_COLOR);
      doc
        .fontSize(14)
        .fillColor("#ffffff")
        .text("EQUITY", 70, yPos + 5)
        .text(`R${financialSummary.equity.toLocaleString()}`, 400, yPos + 5, {
          align: "right",
        });
    }

    // Add new page for AI insights
    doc.addPage();
    yPos = 50;

    doc.fontSize(16).fillColor("#1a1a1a").text("FINANCIAL ANALYSIS", 50, yPos);
    yPos += 30;

    doc.fontSize(10).fillColor("#333333").text(aiInsights, 50, yPos, {
      width: 495,
      align: "justify",
    });

    // Footer
    doc
      .fontSize(8)
      .fillColor("#999999")
      .text(
        `Generated on ${new Date().toLocaleDateString("en-ZA")} for SARS submission`,
        50,
        750,
        { align: "center", width: 495 }
      );

    doc.end();
  });
}
