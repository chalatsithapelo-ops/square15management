import { createFileRoute } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  DollarSign, TrendingUp, TrendingDown, FileText,
  Sparkles, Download, AlertCircle, BarChart3, PieChart,
  Brain, Target, AlertTriangle, Lightbulb, TrendingUpIcon, ArrowLeft, Shield,
  RotateCcw, Clock, Trash2, X, CheckCircle2
} from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfQuarter, endOfQuarter, subMonths } from "date-fns";
import toast from "react-hot-toast";
import { Link } from "@tanstack/react-router";

import PLStatement from "~/components/accounts/PLStatement";
import BalanceSheet from "~/components/accounts/BalanceSheet";
import CashFlowStatement from "~/components/accounts/CashFlowStatement";
import ExpenseAnalytics from "~/components/accounts/ExpenseAnalytics";
import BudgetTracker from "~/components/accounts/BudgetTracker";
import ExpenseUpload from "~/components/accounts/ExpenseUpload";
import { CustomizableDashboard } from "~/components/admin/CustomizableDashboard";
import { FinancialReportsSection } from "~/components/FinancialReportsSection";
import { ComprehensiveFinancialDashboard } from "~/components/admin/ComprehensiveFinancialDashboard";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import SARSComplianceDashboard from "~/components/accounts/SARSComplianceDashboard";

export const Route = createFileRoute("/contractor/accounts/")({
  component: ContractorAccountsPageGuarded,
});

function ContractorAccountsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasAssets" returnPath="/contractor/dashboard">
      <ContractorAccountsPage />
    </RequireSubscriptionFeature>
  );
}

function ContractorAccountsPage() {
  const { token, user } = useAuthStore();
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
  const [showRestoreModal, setShowRestoreModal] = useState(false);
  const [restoreConfirm, setRestoreConfirm] = useState<string | null>(null);
  const [restoreResult, setRestoreResult] = useState<any>(null);
  const queryClient = useQueryClient();
  const isManager = user?.role === "CONTRACTOR_SENIOR_MANAGER";

  // Fetch contractor's own orders (not admin orders)
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
  );

  const liabilitiesQuery = useQuery(
    trpc.getLiabilities.queryOptions({
      token: token!,
    })
  );

  const operationalExpensesQuery = useQuery(
    trpc.getOperationalExpenses.queryOptions({
      token: token!,
      isApproved: true,
    })
  );

  const alternativeRevenuesQuery = useQuery(
    trpc.getAlternativeRevenues.queryOptions({
      token: token!,
      isApproved: true,
    })
  );

  const payslipsQuery = useQuery(trpc.getPayslips.queryOptions({ token: token! }));

  const orders = ordersQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const paymentRequests = paymentRequestsQuery.data || [];
  const quotations = quotationsQuery.data || [];
  const projects = projectsQuery.data || [];
  const assets = assetsQuery.data || [];
  const liabilities = liabilitiesQuery.data || [];
  const operationalExpenses = operationalExpensesQuery.data || [];
  const alternativeRevenues = alternativeRevenuesQuery.data || [];
  const payslips = payslipsQuery.data || [];

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

  const filteredQuotations = quotations.filter(quot => {
    const quotDate = new Date(quot.createdAt);
    return quotDate >= new Date(dateRange.start) && quotDate <= new Date(dateRange.end);
  });

  const filteredPaymentRequests = paymentRequests.filter(pr => {
    const prDate = new Date(pr.createdAt);
    return prDate >= new Date(dateRange.start) && prDate <= new Date(dateRange.end);
  });

  const filteredOperationalExpenses = operationalExpenses.filter(exp => {
    const expDate = new Date(exp.date);
    return expDate >= new Date(dateRange.start) && expDate <= new Date(dateRange.end);
  });

  const filteredAlternativeRevenues = alternativeRevenues.filter(rev => {
    const revDate = new Date(rev.date);
    return revDate >= new Date(dateRange.start) && revDate <= new Date(dateRange.end);
  });

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

  // Calculate financial metrics
  const invoiceRevenue = filteredInvoices
    .filter(inv => inv.status === 'PAID')
    .reduce((sum, inv) => sum + (inv.total || 0), 0);

  const totalRevenue = invoiceRevenue + alternativeRevenueTotal;

  const operationalExpenseTotal = filteredOperationalExpenses.reduce(
    (sum, exp) => sum + exp.amount,
    0
  );

  // Group operational expenses by category for detailed breakdown
  const operationalExpensesByCategory = filteredOperationalExpenses.reduce((acc, exp) => {
    const category = exp.category;
    if (!acc[category]) {
      acc[category] = 0;
    }
    acc[category] += exp.amount;
    return acc;
  }, {} as Record<string, number>);

  const artisanPayments = filteredPaymentRequests
    .filter(pr => pr.status === 'APPROVED' || pr.status === 'PAID')
    .reduce((sum, pr) => sum + (pr.amount || 0), 0);

  const totalExpenses = artisanPayments + operationalExpenseTotal;

  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : '0.0';

  // Expense breakdown by category
  const expensesByCategory = {
    artisan_payments: artisanPayments,
    materials: 0, // Contractors don't track materials separately
    labour: 0, // Contractors don't track labour separately
    operational_expenses: operationalExpenseTotal,
    operationalBreakdown: operationalExpensesByCategory,
  };

  // Ensure all values are valid numbers for display
  const safeRevenue = Number(totalRevenue) || 0;
  const safeExpenses = Number(totalExpenses) || 0;
  const safeProfit = Number(netProfit) || 0;

  const generateAIInsights = async () => {
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
            artisanPayments: filteredPaymentRequests.filter(pr => pr.type === 'ARTISAN_PAYMENT').reduce((sum, pr) => sum + (pr.amount || 0), 0),
            materialCosts: filteredPaymentRequests.filter(pr => pr.type === 'MATERIAL_COST').reduce((sum, pr) => sum + (pr.amount || 0), 0),
            labourCosts: filteredPaymentRequests.filter(pr => pr.type === 'LABOUR_COST').reduce((sum, pr) => sum + (pr.amount || 0), 0),
          },
          profitability: {
            netProfit,
            profitMargin: parseFloat(profitMargin),
          },
          cashFlow: {
            operatingCashFlow: totalRevenue - totalExpenses,
          },
          assets: {
            total: assets.reduce((sum, a) => sum + (a.value || 0), 0),
          },
          liabilities: {
            total: liabilities.reduce((sum, l) => sum + (l.amount || 0), 0),
          },
        },
      });
      setAiInsights(result.insights);
      toast.success("AI insights generated successfully!");
    } catch (error: any) {
      toast.error(error.message || "Failed to generate insights");
    } finally {
      setGeneratingInsights(false);
    }
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
    });
  };

  // Show loading state while data is being fetched
  const isLoading = ordersQuery.isLoading || invoicesQuery.isLoading || 
                    paymentRequestsQuery.isLoading || quotationsQuery.isLoading ||
                    projectsQuery.isLoading || assetsQuery.isLoading || 
                    liabilitiesQuery.isLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading financial data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-amber-500 to-orange-600 p-2 rounded-xl shadow-md">
                <DollarSign className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Management Accounts</h1>
                <p className="text-sm text-gray-600">Financial overview and reporting</p>
              </div>
            </div>
            {isManager && (
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
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Period Selector */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Financial Period</h2>
              <p className="text-sm text-gray-600">
                {format(new Date(dateRange.start), 'MMM dd, yyyy')} - {format(new Date(dateRange.end), 'MMM dd, yyyy')}
              </p>
            </div>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            >
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="current_quarter">Current Quarter</option>
              <option value="ytd">Year to Date</option>
            </select>
          </div>
        </div>

        {/* Financial Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">R{safeRevenue.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-green-100 rounded-lg">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Expenses</p>
                <p className="text-2xl font-bold text-gray-900">R{safeExpenses.toLocaleString()}</p>
              </div>
              <div className="p-3 bg-red-100 rounded-lg">
                <TrendingDown className="w-6 h-6 text-red-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Net Profit</p>
                <p className={`text-2xl font-bold ${safeProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  R{safeProfit.toLocaleString()}
                </p>
                <p className="text-xs text-gray-500 mt-1">{profitMargin}% margin</p>
              </div>
              <div className={`p-3 rounded-lg ${netProfit >= 0 ? 'bg-green-100' : 'bg-red-100'}`}>
                <DollarSign className={`w-6 h-6 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`} />
              </div>
            </div>
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
                  { id: 'sars', label: 'SARS Compliance', icon: Shield },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      activeTab === tab.id
                        ? 'border-amber-500 text-amber-600'
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
                  <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-yellow-50 rounded-2xl p-8 border border-amber-200">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="p-3 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl shadow-lg">
                          <Brain className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h2 className="text-2xl font-bold text-gray-900">AI Financial Insights</h2>
                          <p className="text-sm text-gray-600 mt-1">
                            AI-powered analysis of your financial performance and strategic recommendations
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={generateAIInsights}
                        disabled={generatingInsights}
                        className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-600 text-white rounded-xl hover:from-amber-600 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
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
                        } else if (header.toLowerCase().includes('concern') || header.toLowerCase().includes('critical') || header.toLowerCase().includes('risk')) {
                          icon = AlertTriangle;
                          iconColor = "from-orange-500 to-red-600";
                        } else if (header.toLowerCase().includes('recommendation') || header.toLowerCase().includes('optimization') || header.toLowerCase().includes('revenue') || header.toLowerCase().includes('cash')) {
                          icon = Lightbulb;
                          iconColor = "from-purple-500 to-pink-600";
                        } else if (header.toLowerCase().includes('score') || header.toLowerCase().includes('performance')) {
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
                                          <span className="text-amber-500 mt-1.5">•</span>
                                          <span className="flex-1">{trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\*\*|\*\*$/g, '')}</span>
                                        </div>
                                      );
                                    } else if (trimmedLine.match(/^\d+\./)) {
                                      return (
                                        <div key={i} className="flex items-start gap-2 ml-2">
                                          <span className="font-semibold text-amber-600">{trimmedLine.match(/^\d+\./)![0]}</span>
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
                        Generated {aiInsights?.generatedAt ? new Date(aiInsights.generatedAt).toLocaleString() : 'recently'} • Powered by Claude AI
                      </div>
                    </div>
                  )}

                  {/* Empty State */}
                  {!aiInsights && !generatingInsights && (
                    <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                      <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-amber-100 to-orange-100 rounded-full mb-4">
                        <Brain className="w-8 h-8 text-amber-600" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 mb-2">No Insights Yet</h3>
                      <p className="text-gray-600 mb-6 max-w-md mx-auto">
                        Click "Generate Insights" to get AI-powered financial analysis with strategic recommendations for your business.
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
                  expensesByCategory={{
                    artisan_payments: artisanPayments,
                    materials: 0,
                    labour: 0,
                  }}
                  totalExpenses={artisanPayments}
                  materialCosts={0}
                  labourCosts={0}
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
                  materialCosts={0}
                  labourCosts={0}
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
                  paymentRequests={filteredPaymentRequests}
                  dateRange={dateRange}
                />
              )}

              {activeTab === 'cashflow' && (
                <CashFlowStatement
                  invoices={filteredInvoices}
                  orders={filteredOrders}
                  quotations={filteredQuotations}
                  paymentRequests={filteredPaymentRequests}
                  assets={[]}
                  liabilities={[]}
                  dateRange={dateRange}
                  operationalExpenses={filteredOperationalExpenses}
                  alternativeRevenues={filteredAlternativeRevenues}
                />
              )}

              {activeTab === 'budget' && (
                <BudgetTracker orders={orders} projects={projects} />
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
                  materialCosts={0}
                  labourCosts={0}
                  artisanPayments={artisanPayments}
                />
              )}
            </div>
          </div>
        </div>
      </main>

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
                        Selecting a time period will permanently delete all financial data (orders, invoices, quotations, payments, assets, liabilities, expenses, and revenues) created after the chosen date. This cannot be undone.
                      </p>
                    </div>
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
                      You are about to delete all data from{" "}
                      <span className="font-bold">
                        {RESTORE_PERIODS.find(p => p.value === restoreConfirm)?.label}
                      </span>.
                      This will permanently remove the corresponding records.
                    </p>
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
                  {RESTORE_PERIODS.map((period) => (
                    <button
                      key={period.value}
                      onClick={() => setRestoreConfirm(period.value)}
                      className={`w-full text-left p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                        period.value === "ALL_TIME"
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
