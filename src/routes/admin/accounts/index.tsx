import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  DollarSign, TrendingUp, TrendingDown, FileText,
  Sparkles, Download, AlertCircle, BarChart3, PieChart,
  Brain, Target, AlertTriangle, Lightbulb, TrendingUpIcon, Shield,
  RotateCcw, Clock, Trash2, X, CheckCircle2, Check, Loader2
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import toast from "react-hot-toast";

import PLStatement from "~/components/accounts/PLStatement";
import BalanceSheet from "~/components/accounts/BalanceSheet";
import CashFlowStatement from "~/components/accounts/CashFlowStatement";
import ExpenseAnalytics from "~/components/accounts/ExpenseAnalytics";
import BudgetTracker from "~/components/accounts/BudgetTracker";
import ExpenseUpload from "~/components/accounts/ExpenseUpload";
import { CustomizableDashboard } from "~/components/admin/CustomizableDashboard";
import { FinancialReportsSection } from "~/components/FinancialReportsSection";
import { ComprehensiveFinancialDashboard } from "~/components/admin/ComprehensiveFinancialDashboard";
import { AccessDenied } from "~/components/AccessDenied";
import SARSComplianceDashboard from "~/components/accounts/SARSComplianceDashboard";

export const Route = createFileRoute("/admin/accounts/")({
  component: AccountsPage,
});

function AccountsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const isSeniorAdmin = user?.role === "SENIOR_ADMIN";

  const [selectedPeriod, setSelectedPeriod] = useState("current_month");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()).toISOString().split('T')[0],
    end: endOfMonth(new Date()).toISOString().split('T')[0]
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [expandedCard, setExpandedCard] = useState<'revenue' | 'expenses' | 'receivables' | null>(null);
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const [restoreCategories, setRestoreCategories] = useState<string[]>([
    "ASSETS", "LIABILITIES", "OPERATIONAL_EXPENSES", "ALTERNATIVE_REVENUES",
    "PAYMENT_REQUESTS", "PAYSLIPS",
  ]);
  const queryClient = useQueryClient();

  // Check user permissions
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    })
  );

  const invoicesQuery = useQuery(
    trpc.getInvoices.queryOptions({
      token: token!,
    })
  );

  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
    })
  );

  const quotationsQuery = useQuery(
    trpc.getQuotations.queryOptions({
      token: token!,
    })
  );

  const projectsQuery = useQuery(
    trpc.getProjects.queryOptions({
      token: token!,
    })
  );

  const assetsQuery = useQuery(
    trpc.getAssets.queryOptions({
      token: token!,
    })
  );;

  const liabilitiesQuery = useQuery(
    trpc.getLiabilities.queryOptions({
      token: token!,
    })
  );

  const payslipsQuery = useQuery(
    trpc.getPayslips.queryOptions({
      token: token!,
    })
  );

  const operationalExpensesQuery = useQuery(
    trpc.getOperationalExpenses.queryOptions({
      token: token!,
      isApproved: true, // Only include approved expenses
    })
  );

  // Fetch pending expenses for approval
  const pendingExpensesQuery = useQuery(
    trpc.getOperationalExpenses.queryOptions({
      token: token!,
      isApproved: false,
    })
  );

  const approveExpenseMutation = useMutation(
    trpc.approveOperationalExpense.mutationOptions({
      onSuccess: () => {
        toast.success("Expense approved!");
        queryClient.invalidateQueries({ queryKey: ["getOperationalExpenses"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to approve expense");
      },
    })
  );

  const pendingExpenses = pendingExpensesQuery.data || [];

  const alternativeRevenuesQuery = useQuery(
    trpc.getAlternativeRevenues.queryOptions({
      token: token!,
      isApproved: true, // Only include approved revenues
    })
  );

  const orders = ordersQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const paymentRequests = paymentRequestsQuery.data || [];
  const quotations = quotationsQuery.data || [];
  const projects = projectsQuery.data || [];
  const assets = assetsQuery.data || [];
  const liabilities = liabilitiesQuery.data || [];
  const payslips = payslipsQuery.data || [];
  const operationalExpenses = operationalExpensesQuery.data || [];
  const alternativeRevenues = alternativeRevenuesQuery.data || [];

  useEffect(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case "current_month":
        setDateRange({
          start: startOfMonth(now).toISOString().split('T')[0],
          end: endOfMonth(now).toISOString().split('T')[0]
        });
        break;
      case "last_month":
        const lastMonth = subMonths(now, 1);
        setDateRange({
          start: startOfMonth(lastMonth).toISOString().split('T')[0],
          end: endOfMonth(lastMonth).toISOString().split('T')[0]
        });
        break;
      case "current_quarter":
        // SA FY quarters: Q1=Mar-May, Q2=Jun-Aug, Q3=Sep-Nov, Q4=Dec-Feb
        const fyMonth = (now.getMonth() - 2 + 12) % 12; // 0=Mar, 1=Apr, ..., 11=Feb
        const qStartFyMonth = Math.floor(fyMonth / 3) * 3; // 0, 3, 6, 9
        const qStartCalMonth = (qStartFyMonth + 2) % 12; // 2=Mar, 5=Jun, 8=Sep, 11=Dec
        const qStartYear = qStartCalMonth > now.getMonth() ? now.getFullYear() - 1 : now.getFullYear();
        const qEndCalMonth = (qStartCalMonth + 2) % 12; // last month of quarter
        const qEndYear = qEndCalMonth < qStartCalMonth ? qStartYear + 1 : qStartYear;
        const qStart = new Date(qStartYear, qStartCalMonth, 1);
        const qEnd = endOfMonth(new Date(qEndYear, qEndCalMonth, 1));
        setDateRange({
          start: qStart.toISOString().split('T')[0],
          end: qEnd.toISOString().split('T')[0]
        });
        break;
      case "ytd":
        setDateRange({
          start: `${now.getFullYear()}-01-01`,
          end: now.toISOString().split('T')[0]
        });
        break;
    }
  }, [selectedPeriod]);

  const filteredInvoices = invoices.filter(inv => {
    // For PAID invoices, use paidDate (revenue recognition date)
    const invDate = new Date(inv.status === 'PAID' && inv.paidDate ? inv.paidDate : inv.createdAt);
    return invDate >= new Date(dateRange.start) && invDate <= new Date(dateRange.end);
  });

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= new Date(dateRange.start) && orderDate <= new Date(dateRange.end);
  });

  const filteredPaymentRequests = paymentRequests.filter(pr => {
    // For PAID payment requests, use paidDate (expense recognition date)
    const prDate = new Date(pr.status === 'PAID' && pr.paidDate ? pr.paidDate : pr.createdAt);
    return prDate >= new Date(dateRange.start) && prDate <= new Date(dateRange.end);
  });

  const filteredQuotations = quotations.filter(q => {
    const qDate = new Date(q.createdAt);
    return qDate >= new Date(dateRange.start) && qDate <= new Date(dateRange.end);
  });

  // Filter operational expenses by date range
  const filteredOperationalExpenses = operationalExpenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= new Date(dateRange.start) && expDate <= new Date(dateRange.end);
  });

  // Filter alternative revenues by date range
  const filteredAlternativeRevenues = alternativeRevenues.filter(rev => {
    const revDate = new Date(rev.date);
    return revDate >= new Date(dateRange.start) && revDate <= new Date(dateRange.end);
  });

  // Calculate alternative revenue total
  const alternativeRevenueTotal = filteredAlternativeRevenues.reduce(
    (sum, rev) => sum + rev.amount,
    0
  );

  // Group alternative revenues by category
  const alternativeRevenuesByCategory = filteredAlternativeRevenues.reduce((acc, rev) => {
    const category = rev.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += rev.amount;
    return acc;
  }, {} as Record<string, number>);

  const invoiceRevenue = filteredInvoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const totalRevenue = invoiceRevenue + alternativeRevenueTotal;

  // Receivables: unpaid invoices (Approved, Sent, Overdue)
  const receivableInvoices = filteredInvoices.filter(inv => ['APPROVED', 'SENT', 'OVERDUE'].includes(inv.status));
  const totalReceivables = receivableInvoices.reduce((sum, inv) => sum + (inv.total || 0), 0);
  const receivablesSent = filteredInvoices.filter(inv => inv.status === 'SENT').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const receivablesOverdue = filteredInvoices.filter(inv => inv.status === 'OVERDUE').reduce((sum, inv) => sum + (inv.total || 0), 0);
  const receivablesApproved = filteredInvoices.filter(inv => inv.status === 'APPROVED').reduce((sum, inv) => sum + (inv.total || 0), 0);

  const orderMaterialCosts = filteredOrders.reduce((sum, o) => sum + (o.materialCost || 0), 0);
  const orderLabourCosts = filteredOrders.reduce((sum, o) => sum + (o.labourCost || 0), 0);

  // Only use actual order costs for expenses (not quotation estimates)
  const materialCosts = orderMaterialCosts;
  const labourCosts = orderLabourCosts;

  const artisanPayments = filteredPaymentRequests
    .filter((pr) => pr.status === "PAID")
    .reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);

  // Calculate operational expense total and breakdown by category
  const operationalExpenseTotal = filteredOperationalExpenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  // Group operational expenses by category
  const operationalExpensesByCategory = filteredOperationalExpenses.reduce((acc, exp) => {
    const category = exp.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const totalExpenses = artisanPayments + materialCosts + labourCosts + operationalExpenseTotal;
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : "0.0";

  // Expense breakdown by category (using payment requests and order/quotation costs)
  const expensesByCategory = {
    artisan_payments: artisanPayments,
    materials: materialCosts,
    labour: labourCosts,
    operational_expenses: operationalExpenseTotal,
    operationalBreakdown: operationalExpensesByCategory, // Add detailed breakdown
  };

  const generateReportMutation = useMutation(
    trpc.generateFinancialReport.mutationOptions({
      onSuccess: () => {
        toast.success("SARS report generation started! Check the Financial Reports section below.");
        setGeneratingReport(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate report");
        setGeneratingReport(false);
      },
    })
  );

  const captureSnapshotMutation = useMutation(
    trpc.captureMetricSnapshot.mutationOptions({
      onSuccess: () => {
        toast.success("Metric snapshot captured successfully!");
        // Invalidate metric snapshots query to refresh dashboard data
      },
      onError: (error) => {
        toast.error(error.message || "Failed to capture metric snapshot");
      },
    })
  );

  const handleGenerateSARSReport = async () => {
    setGeneratingReport(true);
    
    // Determine report type and parameters based on selected period
    const now = new Date();
    let reportType: any = "MONTHLY_PL";
    let year = now.getFullYear();
    let month: number | undefined = now.getMonth() + 1;
    let quarter: number | undefined = undefined;

    if (selectedPeriod === "current_month" || selectedPeriod === "last_month") {
      reportType = "MONTHLY_PL";
      const periodDate = selectedPeriod === "last_month" ? subMonths(now, 1) : now;
      year = periodDate.getFullYear();
      month = periodDate.getMonth() + 1;
    } else if (selectedPeriod === "current_quarter") {
      reportType = "QUARTERLY_PL";
      // SA FY quarter: Q1=Mar-May, Q2=Jun-Aug, Q3=Sep-Nov, Q4=Dec-Feb
      const fyMonthForReport = (now.getMonth() - 2 + 12) % 12;
      quarter = Math.floor(fyMonthForReport / 3) + 1;
      const fyStartYear = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
      year = fyStartYear;
      month = undefined;
    } else if (selectedPeriod === "ytd") {
      reportType = "ANNUAL_PL";
      year = now.getFullYear();
      month = undefined;
    }

    generateReportMutation.mutate({
      token: token!,
      reportType,
      year,
      month,
      quarter,
    });
  };

  const handleCaptureSnapshot = async () => {
    captureSnapshotMutation.mutate({
      token: token!,
      metricType: "DAILY",
    });
  };

  const handleExportToExcel = () => {
    const csvData = [
      ['Financial Summary', '', '', ''],
      ['Period', `${dateRange.start} to ${dateRange.end}`, '', ''],
      ['', '', '', ''],
      ['REVENUE', '', '', ''],
      ['Total Revenue', `R ${totalRevenue.toLocaleString()}`, '', ''],
      ['', '', '', ''],
      ['EXPENSES BY CATEGORY', '', '', ''],
      ['Artisan Payments', `R ${artisanPayments.toLocaleString()}`, '', ''],
      ['Material Costs', `R ${materialCosts.toLocaleString()}`, '', ''],
      ['Labour Costs', `R ${labourCosts.toLocaleString()}`, '', ''],
      ['Total Expenses', `R ${totalExpenses.toLocaleString()}`, '', ''],
      ['', '', '', ''],
      ['NET PROFIT', `R ${netProfit.toLocaleString()}`, '', ''],
      ['Profit Margin', `${profitMargin}%`, '', ''],
    ];

    const csv = csvData.map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Financial_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  const RESTORE_PERIODS = [
    { value: "1_WEEK", label: "1 Week Ago", description: "Remove all data created in the last 7 days" },
    { value: "2_WEEKS", label: "2 Weeks Ago", description: "Remove all data created in the last 14 days" },
    { value: "1_MONTH", label: "1 Month Ago", description: "Remove all data created in the last month" },
    { value: "2_MONTHS", label: "2 Months Ago", description: "Remove all data created in the last 2 months" },
    { value: "3_MONTHS", label: "3 Months Ago", description: "Remove all data created in the last 3 months" },
    { value: "6_MONTHS", label: "6 Months Ago", description: "Remove all data created in the last 6 months" },
    { value: "1_YEAR", label: "1 Year Ago", description: "Remove all data created in the last year" },
    { value: "ALL_TIME", label: "All Time", description: "Remove ALL data — full system reset" },
  ];

  const restoreDataMutation = useMutation(
    trpc.restoreData.mutationOptions({
      onSuccess: (data) => {
        setRestoreResult(data);
        setRestoreConfirm(null);
        toast.success(data.message);
        // Invalidate all queries to refresh data
        queryClient.invalidateQueries();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to restore data");
        setRestoreConfirm(null);
      },
    })
  );

  const handleRestore = (period: string) => {
    restoreDataMutation.mutate({
      token: token!,
      period: period as any,
      categories: restoreCategories as any,
    });
  };

  // Permission checks - must be after all hooks
  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasViewAccounts = userPermissions.includes("VIEW_ACCOUNTS");

  // Show loading state while checking permissions
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasViewAccounts) {
    return <AccessDenied message="You do not have permission to access Management Accounts." />;
  }

  return (
    <div className="p-4 md:p-8 min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">Management Accounts</h1>
              <div className="p-1.5 rounded-lg bg-gradient-to-r from-amber-400 to-orange-500">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
            </div>
            <p className="text-slate-500">AI-powered financial reporting and analysis</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={handleExportToExcel}
              className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export to Excel
            </button>
            <button
              onClick={handleGenerateSARSReport}
              disabled={generatingReport}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {generatingReport ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4" />
                  Generate SARS Report
                </>
              )}
            </button>
            <button
              onClick={handleCaptureSnapshot}
              disabled={captureSnapshotMutation.isPending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {captureSnapshotMutation.isPending ? (
                <>
                  <Sparkles className="w-4 h-4 animate-spin" />
                  Capturing...
                </>
              ) : (
                <>
                  <BarChart3 className="w-4 h-4" />
                  Capture Metric Snapshot
                </>
              )}
            </button>
            {isSeniorAdmin && (
              <button
                onClick={() => { setShowRestoreModal(true); setRestoreResult(null); setRestoreConfirm(null); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-gradient-to-r from-orange-500 to-red-500 hover:from-orange-600 hover:to-red-600 transition-colors"
              >
                <RotateCcw className="w-4 h-4" />
                Restore
              </button>
            )}
          </div>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <label className="text-sm font-semibold min-w-fit">Reporting Period:</label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="w-full md:w-64 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="current_quarter">Current Quarter</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
            {selectedPeriod === "custom" && (
              <>
                <input
                  type="date"
                  value={dateRange.start}
                  onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                  className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-slate-500">to</span>
                <input
                  type="date"
                  value={dateRange.end}
                  onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                  className="w-full md:w-auto px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </>
            )}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
          {/* Revenue Card - Clickable */}
          <div
            className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6 cursor-pointer ring-2 ring-transparent hover:ring-green-200"
            onClick={() => setExpandedCard(expandedCard === 'revenue' ? null : 'revenue')}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-green-500 bg-opacity-10">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-green-50 text-green-700">
                Revenue
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Revenue</p>
            {invoicesQuery.isLoading ? (
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            ) : (
              <h3 className="text-3xl font-bold text-green-600">
                R {totalRevenue.toLocaleString()}
              </h3>
            )}
            <p className="text-xs text-slate-400 mt-2">{expandedCard === 'revenue' ? '▲ Hide breakdown' : '▼ Click for breakdown'}</p>
          </div>

          {/* Expenses Card - Clickable */}
          <div
            className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6 cursor-pointer ring-2 ring-transparent hover:ring-red-200"
            onClick={() => setExpandedCard(expandedCard === 'expenses' ? null : 'expenses')}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-red-500 bg-opacity-10">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
                Expenses
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Total Expenses</p>
            {ordersQuery.isLoading || paymentRequestsQuery.isLoading ? (
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            ) : (
              <h3 className="text-3xl font-bold text-red-600">
                R {totalExpenses.toLocaleString()}
              </h3>
            )}
            <p className="text-xs text-slate-400 mt-2">{expandedCard === 'expenses' ? '▲ Hide breakdown' : '▼ Click for breakdown'}</p>
          </div>

          {/* Receivables Card - Clickable */}
          <div
            className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6 cursor-pointer ring-2 ring-transparent hover:ring-cyan-200"
            onClick={() => setExpandedCard(expandedCard === 'receivables' ? null : 'receivables')}
          >
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-cyan-500 bg-opacity-10">
                <Clock className="w-6 h-6 text-cyan-600" />
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-cyan-50 text-cyan-700">
                Receivables
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Outstanding Receivables</p>
            {invoicesQuery.isLoading ? (
              <div className="h-8 w-32 bg-gray-200 rounded animate-pulse" />
            ) : (
              <h3 className="text-3xl font-bold text-cyan-600">
                R {totalReceivables.toLocaleString()}
              </h3>
            )}
            <p className="text-xs text-slate-400 mt-2">{expandedCard === 'receivables' ? '▲ Hide breakdown' : '▼ Click for breakdown'}</p>
          </div>

          {/* Net Profit/Loss */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6">
            <div className="flex justify-between items-start mb-4">
              <div className={`p-3 rounded-xl ${netProfit >= 0 ? 'bg-blue-500' : 'bg-orange-500'} bg-opacity-10`}>
                <DollarSign className={`w-6 h-6 ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`} />
              </div>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${netProfit >= 0 ? 'bg-blue-50 text-blue-700' : 'bg-orange-50 text-orange-700'}`}>
                {netProfit >= 0 ? 'Profit' : 'Loss'}
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Net Profit/Loss</p>
            <h3 className={`text-3xl font-bold ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              R {netProfit.toLocaleString()}
            </h3>
          </div>

          {/* Profit Margin */}
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6">
            <div className="flex justify-between items-start mb-4">
              <div className="p-3 rounded-xl bg-purple-500 bg-opacity-10">
                <BarChart3 className="w-6 h-6 text-purple-600" />
              </div>
              <span className="px-2 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                Margin
              </span>
            </div>
            <p className="text-sm text-slate-500 mb-1">Profit Margin</p>
            <h3 className="text-3xl font-bold text-purple-600">
              {profitMargin}%
            </h3>
          </div>
        </div>

        {/* Revenue Breakdown Panel */}
        {expandedCard === 'revenue' && (
          <div className="bg-white rounded-xl shadow-lg border border-green-200 p-6 animate-in slide-in-from-top-2">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-green-600" />
              Revenue Breakdown
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Paid Invoices</span>
                  <span className="text-sm font-bold text-green-700">R {invoiceRevenue.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Alternative Revenue</span>
                  <span className="text-sm font-bold text-green-700">R {alternativeRevenueTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Alternative Revenue by Category</p>
                {Object.keys(alternativeRevenuesByCategory).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No alternative revenue this period</p>
                ) : (
                  Object.entries(alternativeRevenuesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs font-medium text-gray-600">{cat.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold text-gray-800">R {(amt as number).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-green-100 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">Total Revenue</span>
              <span className="text-lg font-bold text-green-600">R {totalRevenue.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Expenses Breakdown Panel */}
        {expandedCard === 'expenses' && (
          <div className="bg-white rounded-xl shadow-lg border border-red-200 p-6 animate-in slide-in-from-top-2">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <TrendingDown className="w-5 h-5 text-red-600" />
              Expenses Breakdown
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Major Categories</p>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Materials</span>
                    <p className="text-xs text-gray-400">From {filteredOrders.filter(o => (o.materialCost || 0) > 0).length} orders</p>
                  </div>
                  <span className="text-sm font-bold text-red-700">R {materialCosts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Labour</span>
                    <p className="text-xs text-gray-400">From {filteredOrders.filter(o => (o.labourCost || 0) > 0).length} orders</p>
                  </div>
                  <span className="text-sm font-bold text-red-700">R {labourCosts.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Artisan Payments (Paid)</span>
                  <span className="text-sm font-bold text-red-700">R {artisanPayments.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <span className="text-sm font-medium text-gray-700">Operational Expenses</span>
                  <span className="text-sm font-bold text-red-700">R {operationalExpenseTotal.toLocaleString()}</span>
                </div>
              </div>
              <div className="space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Operational Expenses by Category</p>
                {Object.keys(operationalExpensesByCategory).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No operational expenses this period</p>
                ) : (
                  Object.entries(operationalExpensesByCategory).map(([cat, amt]) => (
                    <div key={cat} className="flex justify-between items-center p-2 bg-gray-50 rounded-lg">
                      <span className="text-xs font-medium text-gray-600">{cat.replace(/_/g, ' ')}</span>
                      <span className="text-xs font-bold text-gray-800">R {(amt as number).toLocaleString()}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-red-100 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">Total Expenses</span>
              <span className="text-lg font-bold text-red-600">R {totalExpenses.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Receivables Breakdown Panel */}
        {expandedCard === 'receivables' && (
          <div className="bg-white rounded-xl shadow-lg border border-cyan-200 p-6 animate-in slide-in-from-top-2">
            <h4 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-600" />
              Outstanding Receivables Breakdown
            </h4>
            {totalReceivables === 0 ? (
              <p className="text-sm text-gray-400 italic">No outstanding receivables this period</p>
            ) : (
            <>
              {/* Status Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="flex justify-between items-center p-3 bg-yellow-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Approved (Not Yet Sent)</span>
                    <p className="text-xs text-gray-400">{receivableInvoices.filter(i => i.status === 'APPROVED').length} invoices</p>
                  </div>
                  <span className="text-sm font-bold text-yellow-700">R {receivablesApproved.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-blue-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Sent (Awaiting Payment)</span>
                    <p className="text-xs text-gray-400">{receivableInvoices.filter(i => i.status === 'SENT').length} invoices</p>
                  </div>
                  <span className="text-sm font-bold text-blue-700">R {receivablesSent.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium text-gray-700">Overdue (Collect Urgently)</span>
                    <p className="text-xs text-gray-400">{receivableInvoices.filter(i => i.status === 'OVERDUE').length} invoices</p>
                  </div>
                  <span className="text-sm font-bold text-red-700">R {receivablesOverdue.toLocaleString()}</span>
                </div>
              </div>

              {/* Aging Analysis */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Aging Analysis</p>
                {(() => {
                  const now = new Date();
                  const aging = receivableInvoices.reduce((acc, inv) => {
                    const days = Math.floor((now.getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                    const bucket = days <= 30 ? 'current' : days <= 60 ? 'days30_60' : days <= 90 ? 'days60_90' : 'over90';
                    acc[bucket].total += (inv.total || 0);
                    acc[bucket].count += 1;
                    return acc;
                  }, { current: { total: 0, count: 0 }, days30_60: { total: 0, count: 0 }, days60_90: { total: 0, count: 0 }, over90: { total: 0, count: 0 } } as Record<string, { total: number; count: number }>);
                  const buckets = [
                    { key: 'current', label: 'Current (0-30 days)', color: 'green' },
                    { key: 'days30_60', label: '30-60 days', color: 'yellow' },
                    { key: 'days60_90', label: '60-90 days', color: 'orange' },
                    { key: 'over90', label: '90+ days', color: 'red' },
                  ];
                  return (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {buckets.map(b => (
                        <div key={b.key} className={`p-3 rounded-lg bg-${b.color}-50 border border-${b.color}-100`}>
                          <p className={`text-xs font-medium text-${b.color}-700`}>{b.label}</p>
                          <p className={`text-lg font-bold text-${b.color}-800 mt-1`}>R {aging[b.key].total.toLocaleString()}</p>
                          <p className="text-xs text-gray-400">{aging[b.key].count} invoice{aging[b.key].count !== 1 ? 's' : ''}</p>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>

              {/* Per-Customer Breakdown */}
              <div className="mb-6">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">By Customer</p>
                <div className="space-y-2">
                  {(() => {
                    const byCustomer = receivableInvoices.reduce((acc, inv) => {
                      const name = inv.customerName || 'Unknown';
                      if (!acc[name]) acc[name] = { total: 0, count: 0 };
                      acc[name].total += (inv.total || 0);
                      acc[name].count += 1;
                      return acc;
                    }, {} as Record<string, { total: number; count: number }>);
                    return Object.entries(byCustomer)
                      .sort(([, a], [, b]) => b.total - a.total)
                      .map(([name, data]) => (
                        <div key={name} className="flex justify-between items-center p-3 bg-cyan-50 rounded-lg">
                          <div>
                            <span className="text-sm font-medium text-gray-700">{name}</span>
                            <p className="text-xs text-gray-400">{data.count} invoice{data.count !== 1 ? 's' : ''}</p>
                          </div>
                          <span className="text-sm font-bold text-cyan-700">R {data.total.toLocaleString()}</span>
                        </div>
                      ));
                  })()}
                </div>
              </div>

              {/* Individual Invoice List */}
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Invoice Details</p>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Invoice #</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Customer</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Status</th>
                        <th className="text-left py-2 px-3 text-xs font-semibold text-gray-500">Days Outstanding</th>
                        <th className="text-right py-2 px-3 text-xs font-semibold text-gray-500">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {receivableInvoices
                        .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
                        .map(inv => {
                          const daysOut = Math.floor((new Date().getTime() - new Date(inv.createdAt).getTime()) / (1000 * 60 * 60 * 24));
                          const statusColors: Record<string, string> = { APPROVED: 'bg-yellow-100 text-yellow-800', SENT: 'bg-blue-100 text-blue-800', OVERDUE: 'bg-red-100 text-red-800' };
                          return (
                            <tr key={inv.id} className="border-b border-gray-100 hover:bg-gray-50">
                              <td className="py-2 px-3 font-medium text-gray-800">{inv.invoiceNumber}</td>
                              <td className="py-2 px-3 text-gray-600">{inv.customerName || 'N/A'}</td>
                              <td className="py-2 px-3">
                                <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[inv.status] || 'bg-gray-100 text-gray-600'}`}>
                                  {inv.status}
                                </span>
                              </td>
                              <td className={`py-2 px-3 font-medium ${daysOut > 90 ? 'text-red-600' : daysOut > 60 ? 'text-orange-600' : daysOut > 30 ? 'text-yellow-600' : 'text-green-600'}`}>
                                {daysOut} days
                              </td>
                              <td className="py-2 px-3 text-right font-bold text-gray-800">R {(inv.total || 0).toLocaleString()}</td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
            )}
            <div className="mt-4 pt-3 border-t border-cyan-100 flex justify-between items-center">
              <span className="text-sm font-bold text-gray-900">Total Outstanding</span>
              <span className="text-lg font-bold text-cyan-600">R {totalReceivables.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Pending Expense Approvals */}
        {isSeniorAdmin && pendingExpenses.length > 0 && (
          <div className="bg-yellow-50 border border-yellow-300 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="w-5 h-5 text-yellow-600" />
                </div>
                <div>
                  <h4 className="font-bold text-yellow-900">
                    {pendingExpenses.length} Expense{pendingExpenses.length !== 1 ? 's' : ''} Pending Approval
                  </h4>
                  <p className="text-sm text-yellow-700">
                    Total: R {pendingExpenses.reduce((s, e) => s + e.amount, 0).toLocaleString()} — approve to include in financial totals
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {pendingExpenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between p-3 bg-white rounded-lg border border-yellow-200">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-gray-900 truncate">{exp.description}</span>
                      <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">
                        {exp.category.replace(/_/g, ' ')}
                      </span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      R {exp.amount.toLocaleString()} · {new Date(exp.date).toLocaleDateString()} · By {exp.createdBy?.firstName} {exp.createdBy?.lastName}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 ml-3">
                    <button
                      onClick={() => approveExpenseMutation.mutate({ token: token!, id: exp.id, isApproved: true })}
                      disabled={approveExpenseMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors"
                    >
                      {approveExpenseMutation.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                      Approve
                    </button>
                    <button
                      onClick={() => approveExpenseMutation.mutate({ token: token!, id: exp.id, isApproved: false })}
                      disabled={approveExpenseMutation.isPending}
                      className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 text-xs font-medium rounded-lg hover:bg-red-200 disabled:opacity-50 transition-colors"
                    >
                      <X className="w-3 h-3" />
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Alert for low profit margin */}
        {parseFloat(profitMargin) < 15 && totalRevenue > 0 && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-4">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0" />
              <div>
                <p className="font-semibold text-orange-900">Low Profit Margin Alert</p>
                <p className="text-sm text-orange-600">
                  Your profit margin is {profitMargin}%. Consider reviewing expenses or adjusting pricing.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content Tabs */}
        <div className="space-y-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="border-b border-gray-200 relative">
              <div className="flex overflow-x-auto touch-pan-x pb-px" style={{ scrollbarWidth: 'thin', scrollbarColor: '#cbd5e1 transparent' }}>
                {[
                  { id: 'ai-insights', label: 'AI Insights', icon: Sparkles },
                  { id: 'profit-dashboard', label: 'Profit Dashboard', icon: TrendingUp },
                  { id: 'dashboard', label: 'Analytics Dashboard', icon: PieChart },
                  { id: 'reports', label: 'Financial Reports', icon: FileText },
                  { id: 'overview', label: 'Overview', icon: BarChart3 },
                  { id: 'pl', label: 'P&L Statement', icon: FileText },
                  { id: 'balance', label: 'Balance Sheet', icon: BarChart3 },
                  { id: 'cashflow', label: 'Cash Flow', icon: DollarSign },
                  { id: 'budget', label: 'Budget Tracker', icon: DollarSign },
                  { id: 'expenses', label: 'Expense Upload', icon: TrendingDown },
                  { id: 'sars', label: 'SARS Compliance', icon: Shield },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-blue-500 text-blue-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <tab.icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-6">
              {activeTab === 'ai-insights' && (
                <div className="space-y-6">
                  {/* AI Insights Header */}
                  <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-8 border border-purple-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                          <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">AI Financial Insights</h2>
                          <p className="text-sm text-gray-600 mt-1">
                            AI-powered analysis of your financial performance and recommendations
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={async () => {
                          setGeneratingInsights(true);
                          try {
                            const result = await trpc.generateAccountsInsights.mutate({
                              token: token!,
                              financialData: {
                                period: selectedPeriod,
                                revenue: {
                                  total: totalRevenue,
                                  breakdown: {},
                                },
                                expenses: {
                                  total: totalExpenses,
                                  artisanPayments: artisanPayments,
                                  materialCosts: materialCosts,
                                  labourCosts: 0,
                                },
                                profitability: {
                                  netProfit: parseFloat(netProfit),
                                  profitMargin: parseFloat(profitMargin),
                                },
                                cashFlow: {},
                                assets: { total: totalAssets },
                                liabilities: { total: totalLiabilities },
                              },
                            });
                            setAiInsights(result.insights);
                            toast.success("AI insights generated successfully!");
                          } catch (error: any) {
                            toast.error(error.message || "Failed to generate insights");
                          } finally {
                            setGeneratingInsights(false);
                          }
                        }}
                        disabled={generatingInsights}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {generatingInsights ? (
                          <>
                            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                            <span>Analyzing...</span>
                          </>
                        ) : (
                          <>
                            <Sparkles className="w-5 h-5" />
                            <span>{aiInsights ? 'Regenerate' : 'Generate'} Insights</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>

                  {/* AI Insights Content */}
                  {aiInsights && (
                    <div className="space-y-6">
                      {/* Parse and Display AI Insights */}
                      {aiInsights.rawText.split('\n\n').map((section: string, index: number) => {
                        const lines = section.trim().split('\n');
                        if (lines.length === 0) return null;

                        const [headerLine = '', ...contentLines] = lines;
                        const header = headerLine.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');

                        let icon = Brain;
                        let iconColor = "from-blue-500 to-blue-600";

                        if (header.toLowerCase().includes('assessment') || header.toLowerCase().includes('health')) {
                          icon = TrendingUpIcon;
                          iconColor = "from-green-500 to-emerald-600";
                        } else if (header.toLowerCase().includes('strength')) {
                          icon = Target;
                          iconColor = "from-blue-500 to-indigo-600";
                        } else if (header.toLowerCase().includes('concern') || header.toLowerCase().includes('issue')) {
                          icon = AlertTriangle;
                          iconColor = "from-orange-500 to-red-600";
                        } else if (header.toLowerCase().includes('recommendation') || header.toLowerCase().includes('optimization') || header.toLowerCase().includes('strategies')) {
                          icon = Lightbulb;
                          iconColor = "from-purple-500 to-pink-600";
                        } else if (header.toLowerCase().includes('score')) {
                          icon = BarChart3;
                          iconColor = "from-indigo-500 to-purple-600";
                        }

                        const IconComponent = icon;

                        return (
                          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                            <div className="flex items-start gap-4">
                              <div className={`p-3 bg-gradient-to-br ${iconColor} rounded-xl shadow-md flex-shrink-0`}>
                                <IconComponent className="w-6 h-6 text-white" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <h3 className="text-lg font-semibold text-gray-900 mb-3">{header}</h3>
                                <div className="prose prose-sm max-w-none text-gray-700 space-y-2">
                                  {contentLines.map((line, i) => {
                                    const trimmedLine = line.trim();
                                    if (!trimmedLine) return null;

                                    if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('• ')) {
                                      return (
                                        <div key={i} className="flex items-start gap-2 ml-2">
                                          <span className="text-blue-500 mt-1.5">•</span>
                                          <span className="flex-1">{trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\*\*|\*\*$/g, '')}</span>
                                        </div>
                                      );
                                    } else if (trimmedLine.match(/^\d+\./)) {
                                      return (
                                        <div key={i} className="flex items-start gap-2 ml-2">
                                          <span className="font-semibold text-blue-600">{trimmedLine.match(/^\d+\./)![0]}</span>
                                          <span className="flex-1">{trimmedLine.replace(/^\d+\.\s*/, '').replace(/^\*\*|\*\*$/g, '')}</span>
                                        </div>
                                      );
                                    } else {
                                      return <p key={i} className="leading-relaxed">{trimmedLine.replace(/^\*\*|\*\*$/g, '')}</p>;
                                    }
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}

                      {/* Generated At Footer */}
                      <div className="text-center text-sm text-gray-500">
                        Generated {new Date(aiInsights.generatedAt).toLocaleString()} • Powered by Claude AI
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!aiInsights && !generatingInsights && (
                    <div className="text-center py-16">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full mb-4">
                        <Brain className="w-8 h-8 text-purple-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Insights Yet</h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Click "Generate Insights" to get AI-powered analysis of your financial performance with actionable recommendations.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'profit-dashboard' && (
                <ComprehensiveFinancialDashboard dateRange={dateRange} />
              )}

              {activeTab === 'dashboard' && (
                <CustomizableDashboard
                  invoices={invoices}
                  orders={filteredOrders}
                  quotations={filteredQuotations}
                  paymentRequests={filteredPaymentRequests}
                  projects={projects}
                  dateRange={dateRange}
                  operationalExpenses={filteredOperationalExpenses}
                  alternativeRevenues={filteredAlternativeRevenues}
                />
              )}

              {activeTab === 'reports' && (
                <FinancialReportsSection />
              )}

              {activeTab === 'overview' && (
                <ExpenseAnalytics 
                  expenses={filteredPaymentRequests}
                  orders={filteredOrders}
                  quotations={filteredQuotations}
                  expensesByCategory={expensesByCategory}
                  totalExpenses={totalExpenses}
                  materialCosts={materialCosts}
                  labourCosts={labourCosts}
                  artisanPayments={artisanPayments}
                  operationalExpenses={filteredOperationalExpenses}
                  operationalExpensesTotal={operationalExpenseTotal}
                />
              )}

              {activeTab === 'pl' && (
                <PLStatement 
                  revenue={totalRevenue}
                  invoiceRevenue={invoiceRevenue}
                  alternativeRevenueTotal={alternativeRevenueTotal}
                  revenueBreakdown={alternativeRevenuesByCategory}
                  materialCosts={materialCosts}
                  labourCosts={labourCosts}
                  artisanPayments={artisanPayments}
                  expensesByCategory={expensesByCategory}
                  netProfit={netProfit}
                  dateRange={dateRange}
                />
              )}

              {activeTab === 'balance' && (
                <BalanceSheet 
                  assets={assets}
                  liabilities={liabilities}
                  paymentRequests={paymentRequests}
                  dateRange={dateRange}
                />
              )}

              {activeTab === 'cashflow' && (
                <CashFlowStatement 
                  invoices={filteredInvoices}
                  orders={filteredOrders}
                  quotations={filteredQuotations}
                  paymentRequests={filteredPaymentRequests}
                  assets={assets}
                  liabilities={liabilities}
                  dateRange={dateRange}
                  operationalExpenses={filteredOperationalExpenses}
                  alternativeRevenues={filteredAlternativeRevenues}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTracker 
                  projects={projects}
                  orders={orders}
                  quotations={quotations}
                />
              )}

              {activeTab === 'expenses' && (
                <ExpenseUpload />
              )}

              {activeTab === 'sars' && (
                <SARSComplianceDashboard
                  invoices={filteredInvoices}
                  orders={filteredOrders}
                  paymentRequests={filteredPaymentRequests}
                  payslips={payslips}
                  operationalExpenses={filteredOperationalExpenses}
                  alternativeRevenues={filteredAlternativeRevenues}
                  assets={assets}
                  liabilities={liabilities}
                  dateRange={{
                    start: new Date(dateRange.start),
                    end: new Date(dateRange.end),
                  }}
                  totalRevenue={totalRevenue}
                  totalExpenses={totalExpenses}
                  netProfit={netProfit}
                  materialCosts={materialCosts}
                  labourCosts={labourCosts}
                  artisanPayments={artisanPayments}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Restore Data Modal */}
      {showRestoreModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-6 rounded-t-2xl">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-xl">
                    <RotateCcw className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Restore Data</h2>
                    <p className="text-sm text-white/80">Roll back to a previous state</p>
                  </div>
                </div>
                <button
                  onClick={() => { setShowRestoreModal(false); setRestoreConfirm(null); setRestoreResult(null); }}
                  className="p-2 hover:bg-white/20 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Result Display */}
              {restoreResult && (
                <div className="bg-green-50 border border-green-200 rounded-xl p-4 mb-4">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    <h3 className="font-semibold text-green-900">Restoration Complete</h3>
                  </div>
                  <p className="text-sm text-green-700 mb-3">{restoreResult.message}</p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {restoreResult.details.orders > 0 && (
                      <div className="bg-white rounded px-2 py-1">Orders: <span className="font-semibold">{restoreResult.details.orders}</span></div>
                    )}
                    {restoreResult.details.invoices > 0 && (
                      <div className="bg-white rounded px-2 py-1">Invoices: <span className="font-semibold">{restoreResult.details.invoices}</span></div>
                    )}
                    {restoreResult.details.quotations > 0 && (
                      <div className="bg-white rounded px-2 py-1">Quotations: <span className="font-semibold">{restoreResult.details.quotations}</span></div>
                    )}
                    {restoreResult.details.paymentRequests > 0 && (
                      <div className="bg-white rounded px-2 py-1">Payment Requests: <span className="font-semibold">{restoreResult.details.paymentRequests}</span></div>
                    )}
                    {restoreResult.details.payslips > 0 && (
                      <div className="bg-white rounded px-2 py-1">Payslips: <span className="font-semibold">{restoreResult.details.payslips}</span></div>
                    )}
                    {restoreResult.details.assets > 0 && (
                      <div className="bg-white rounded px-2 py-1">Assets: <span className="font-semibold">{restoreResult.details.assets}</span></div>
                    )}
                    {restoreResult.details.liabilities > 0 && (
                      <div className="bg-white rounded px-2 py-1">Liabilities: <span className="font-semibold">{restoreResult.details.liabilities}</span></div>
                    )}
                    {restoreResult.details.operationalExpenses > 0 && (
                      <div className="bg-white rounded px-2 py-1">Op. Expenses: <span className="font-semibold">{restoreResult.details.operationalExpenses}</span></div>
                    )}
                    {restoreResult.details.alternativeRevenues > 0 && (
                      <div className="bg-white rounded px-2 py-1">Alt. Revenue: <span className="font-semibold">{restoreResult.details.alternativeRevenues}</span></div>
                    )}
                  </div>
                </div>
              )}

              {/* Warning Banner */}
              {!restoreResult && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-semibold text-amber-900 text-sm">Warning: This action is irreversible</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Only the selected data categories will be deleted for the chosen time period. Unselected categories will be preserved.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Category Selection */}
              {!restoreConfirm && !restoreResult && (
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-gray-700">Select data to restore (delete):</h3>
                  <div className="grid grid-cols-1 gap-2">
                    {[
                      { value: "ORDERS", label: "Jobs / Orders", description: "Work orders, materials, expense slips, job activities, reviews" },
                      { value: "INVOICES", label: "Invoices", description: "Invoices and line items" },
                      { value: "QUOTATIONS", label: "Quotations", description: "Quotations and line items" },
                      { value: "PAYMENT_REQUESTS", label: "Payment Requests", description: "Artisan payment requests" },
                      { value: "PAYSLIPS", label: "Payslips", description: "Employee payslips" },
                      { value: "ASSETS", label: "Assets", description: "Company assets" },
                      { value: "LIABILITIES", label: "Liabilities", description: "Company liabilities" },
                      { value: "OPERATIONAL_EXPENSES", label: "Operational Expenses", description: "Fuel, office supplies, etc." },
                      { value: "ALTERNATIVE_REVENUES", label: "Alternative Revenues", description: "Non-invoice revenue sources" },
                    ].map((cat) => (
                      <label
                        key={cat.value}
                        className={`flex items-center gap-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          restoreCategories.includes(cat.value)
                            ? "border-orange-300 bg-orange-50"
                            : "border-gray-200 bg-white hover:border-gray-300"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={restoreCategories.includes(cat.value)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setRestoreCategories(prev => [...prev, cat.value]);
                            } else {
                              setRestoreCategories(prev => prev.filter(c => c !== cat.value));
                            }
                          }}
                          className="w-4 h-4 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{cat.label}</p>
                          <p className="text-xs text-gray-500">{cat.description}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setRestoreCategories([
                        "ORDERS", "INVOICES", "QUOTATIONS", "PAYMENT_REQUESTS",
                        "PAYSLIPS", "ASSETS", "LIABILITIES", "OPERATIONAL_EXPENSES", "ALTERNATIVE_REVENUES",
                      ])}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Select All
                    </button>
                    <span className="text-xs text-gray-400">|</span>
                    <button
                      onClick={() => setRestoreCategories([])}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              )}

              {/* Confirmation step */}
              {restoreConfirm && !restoreResult && (
                <div className="bg-red-50 border-2 border-red-300 rounded-xl p-5">
                  <div className="text-center space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 bg-red-100 rounded-full">
                      <Trash2 className="w-6 h-6 text-red-600" />
                    </div>
                    <h3 className="font-bold text-red-900 text-lg">Confirm Restoration</h3>
                    <p className="text-sm text-red-700">
                      You are about to delete data from{" "}
                      <span className="font-bold">
                        {RESTORE_PERIODS.find(p => p.value === restoreConfirm)?.label}
                      </span>{" "}
                      for: <span className="font-bold">{restoreCategories.length} categor{restoreCategories.length === 1 ? 'y' : 'ies'}</span>.
                    </p>
                    <div className="flex flex-wrap gap-1 justify-center">
                      {restoreCategories.map(cat => (
                        <span key={cat} className="px-2 py-0.5 bg-red-100 text-red-800 text-xs rounded-full">
                          {cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()).toLowerCase().replace(/\b\w/g, l => l.toUpperCase())}
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-3 justify-center pt-2">
                      <button
                        onClick={() => setRestoreConfirm(null)}
                        className="px-5 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={() => handleRestore(restoreConfirm)}
                        disabled={restoreDataMutation.isPending}
                        className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                      >
                        {restoreDataMutation.isPending ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                            Restoring...
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-4 h-4" />
                            Yes, Delete Data
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Period Selection */}
              {!restoreConfirm && !restoreResult && (
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Choose restoration point:</h3>
                  {restoreCategories.length === 0 && (
                    <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded-lg">Please select at least one data category above.</p>
                  )}
                  {RESTORE_PERIODS.map((period) => (
                    <button
                      key={period.value}
                      onClick={() => setRestoreConfirm(period.value)}
                      disabled={restoreCategories.length === 0}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        restoreCategories.length === 0
                          ? "border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed"
                          : period.value === "ALL_TIME"
                            ? "border-red-200 hover:border-red-400 hover:bg-red-50"
                            : "border-gray-200 hover:border-orange-300 hover:bg-orange-50"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-lg ${
                            period.value === "ALL_TIME"
                              ? "bg-red-100"
                              : "bg-orange-100"
                          }`}>
                            <Clock className={`w-4 h-4 ${
                              period.value === "ALL_TIME"
                                ? "text-red-600"
                                : "text-orange-600"
                            }`} />
                          </div>
                          <div>
                            <p className={`font-semibold text-sm ${
                              period.value === "ALL_TIME" ? "text-red-900" : "text-gray-900"
                            }`}>
                              {period.label}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">{period.description}</p>
                          </div>
                        </div>
                        <RotateCcw className={`w-4 h-4 ${
                          period.value === "ALL_TIME" ? "text-red-400" : "text-gray-400"
                        }`} />
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Close after result */}
              {restoreResult && (
                <div className="flex justify-end pt-2">
                  <button
                    onClick={() => { setShowRestoreModal(false); setRestoreResult(null); }}
                    className="px-5 py-2 rounded-lg text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                  >
                    Done
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
