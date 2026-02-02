import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  DollarSign, TrendingUp, TrendingDown, FileText,
  Sparkles, Download, AlertCircle, BarChart3, PieChart,
  Brain, Target, AlertTriangle, Lightbulb, TrendingUpIcon
} from "lucide-react";
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

export const Route = createFileRoute("/admin/accounts/")({
  component: AccountsPage,
});

function AccountsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [selectedPeriod, setSelectedPeriod] = useState("current_month");
  const [activeTab, setActiveTab] = useState("overview");
  const [dateRange, setDateRange] = useState({
    start: startOfMonth(new Date()).toISOString().split('T')[0],
    end: endOfMonth(new Date()).toISOString().split('T')[0]
  });
  const [generatingReport, setGeneratingReport] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

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

  const operationalExpensesQuery = useQuery(
    trpc.getOperationalExpenses.queryOptions({
      token: token!,
      isApproved: true, // Only include approved expenses
    })
  );

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
        setDateRange({
          start: startOfQuarter(now).toISOString().split('T')[0],
          end: endOfQuarter(now).toISOString().split('T')[0]
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
    const invDate = new Date(inv.createdAt);
    return invDate >= new Date(dateRange.start) && invDate <= new Date(dateRange.end);
  });

  const filteredOrders = orders.filter(order => {
    const orderDate = new Date(order.createdAt);
    return orderDate >= new Date(dateRange.start) && orderDate <= new Date(dateRange.end);
  });

  const filteredPaymentRequests = paymentRequests.filter(pr => {
    const prDate = new Date(pr.createdAt);
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

  const orderMaterialCosts = filteredOrders.reduce((sum, o) => sum + (o.materialCost || 0), 0);
  const orderLabourCosts = filteredOrders.reduce((sum, o) => sum + (o.labourCost || 0), 0);
  
  const quotationMaterialCosts = filteredQuotations
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => sum + (q.companyMaterialCost || 0), 0);
  
  const quotationLabourCosts = filteredQuotations
    .filter((q) => q.status === "APPROVED")
    .reduce((sum, q) => sum + (q.companyLabourCost || 0), 0);

  const materialCosts = orderMaterialCosts + quotationMaterialCosts;
  const labourCosts = orderLabourCosts + quotationLabourCosts;

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
      year = now.getFullYear();
      quarter = Math.ceil((now.getMonth() + 1) / 3);
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
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6">
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
          </div>

          <div className="bg-white rounded-xl shadow-lg hover:shadow-xl transition-all border-none p-6">
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
          </div>

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
            <div className="border-b border-gray-200">
              <div className="flex overflow-x-auto scrollbar-none touch-pan-x">
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
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
