import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  BarChart,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { Bar } from "recharts/es6/cartesian/Bar";
import {
  Download,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Building2,
  Users,
  Home,
  AlertCircle,
  CheckCircle,
  Calendar,
  Filter,
  BarChart3,
  PieChart as PieChartIcon,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
  Lightbulb,
  Target,
  TrendingUpDown,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths, startOfYear } from "date-fns";
import toast from "react-hot-toast";

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
  trendLabel?: string;
  color?: "blue" | "green" | "red" | "purple" | "orange" | "teal";
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  trendLabel,
  color = "blue",
}: MetricCardProps) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
    orange: "bg-orange-50 text-orange-600",
    teal: "bg-teal-50 text-teal-600",
  };

  const trendColor = trend && trend > 0 ? "text-green-600" : "text-red-600";
  const TrendIcon = trend && trend > 0 ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="bg-white rounded-xl shadow-sm hover:shadow-md transition-all p-6 border border-gray-100">
      <div className="flex items-start justify-between mb-4">
        <div className={`p-3 rounded-xl ${colorClasses[color]}`}>
          <Icon className="w-6 h-6" />
        </div>
        {trend !== undefined && (
          <div className={`flex items-center gap-1 ${trendColor} text-sm font-medium`}>
            <TrendIcon className="w-4 h-4" />
            <span>{Math.abs(trend).toFixed(1)}%</span>
          </div>
        )}
      </div>
      <h3 className="text-sm font-medium text-gray-600 mb-1">{title}</h3>
      <p className="text-3xl font-bold text-gray-900">{value}</p>
      {subtitle && <p className="text-sm text-gray-500 mt-1">{subtitle}</p>}
      {trendLabel && <p className="text-xs text-gray-400 mt-1">{trendLabel}</p>}
    </div>
  );
}

export function ComprehensivePMFinancialReporting() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const [selectedPeriod, setSelectedPeriod] = useState<
    "current_month" | "last_month" | "quarter" | "ytd" | "custom"
  >("current_month");
  const [selectedBuilding, setSelectedBuilding] = useState<number | null>(null);
  const [customStart, setCustomStart] = useState<Date>(startOfMonth(new Date()));
  const [customEnd, setCustomEnd] = useState<Date>(endOfMonth(new Date()));
  const [activeView, setActiveView] = useState<"overview" | "buildings" | "performance" | "insights">("overview");
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [showInsights, setShowInsights] = useState(false);

  // Calculate period dates
  const { periodStart, periodEnd } = useMemo(() => {
    const now = new Date();
    switch (selectedPeriod) {
      case "current_month":
        return {
          periodStart: startOfMonth(now),
          periodEnd: endOfMonth(now),
        };
      case "last_month":
        const lastMonth = subMonths(now, 1);
        return {
          periodStart: startOfMonth(lastMonth),
          periodEnd: endOfMonth(lastMonth),
        };
      case "quarter":
        const quarterStart = new Date(
          now.getFullYear(),
          Math.floor(now.getMonth() / 3) * 3,
          1
        );
        const quarterEnd = new Date(
          now.getFullYear(),
          Math.floor(now.getMonth() / 3) * 3 + 3,
          0
        );
        return {
          periodStart: quarterStart,
          periodEnd: quarterEnd,
        };
      case "ytd":
        return {
          periodStart: startOfYear(now),
          periodEnd: now,
        };
      case "custom":
        return {
          periodStart: customStart,
          periodEnd: customEnd,
        };
    }
  }, [selectedPeriod, customStart, customEnd]);

  // Fetch financial dashboard data
  const financialsQuery = useQuery(
    trpc.getPMDashboardFinancials.queryOptions({
      token: token!,
      periodStart,
      periodEnd,
      buildingId: selectedBuilding || undefined,
    })
  );

  // Fetch buildings for filter
  const buildingsQuery = useQuery(
    trpc.getBuildings.queryOptions({
      token: token!,
    })
  );

  const buildings = (buildingsQuery.data as any[]) || [];
  const data = financialsQuery.data;

  // AI Insights Mutation
  const generateInsightsMutation = useMutation(
    trpc.generateFinancialInsights.mutationOptions({
      onSuccess: (result) => {
        setAiInsights(result.insights.rawText);
        setShowInsights(true);
        setActiveView("insights");
        toast.success("AI insights generated successfully!");
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to generate AI insights");
      },
    })
  );

  const handleGenerateInsights = () => {
    if (!data) {
      toast.error("No financial data available");
      return;
    }
    
    generateInsightsMutation.mutate({
      token: token!,
      financialData: data,
    });
  };

  // Chart colors
  const CHART_COLORS = {
    primary: "#3b82f6",
    success: "#10b981",
    danger: "#ef4444",
    warning: "#f59e0b",
    purple: "#8b5cf6",
    teal: "#14b8a6",
  };

  const formatCurrency = (value: number) => {
    return `R ${value.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  if (financialsQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-blue-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-medium">Loading financial data...</p>
          <p className="text-sm text-gray-500 mt-2">
            Aggregating revenue, expenses, and performance metrics
          </p>
        </div>
      </div>
    );
  }

  if (financialsQuery.isError) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-red-600 mx-auto mb-4" />
          <p className="text-gray-900 font-medium mb-2">Failed to load financial data</p>
          <p className="text-sm text-gray-600">
            {(financialsQuery.error as any)?.message || "An error occurred"}
          </p>
          <button
            onClick={() => financialsQuery.refetch()}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  const portfolio = data?.portfolio;
  const buildingData = data?.buildings || [];

  // Prepare chart data
  const revenueExpenseData = [
    {
      name: "Revenue",
      value: portfolio?.revenue.total || 0,
      fill: CHART_COLORS.success,
    },
    {
      name: "Expenses",
      value: portfolio?.expenses.total || 0,
      fill: CHART_COLORS.danger,
    },
  ];

  const buildingPerformanceData = buildingData.map((building) => ({
    name: building.buildingName,
    revenue: building.revenue.totalRevenue,
    expenses: building.expenses.totalExpenses,
    netIncome: building.profitability.netOperatingIncome,
    occupancy: building.occupancy.occupancyRate,
  }));

  const expenseBreakdownData = [
    {
      name: "Budget Expenses",
      value: portfolio?.expenses.budgetExpenses || 0,
      fill: CHART_COLORS.primary,
    },
    {
      name: "Contractor Payments",
      value: portfolio?.expenses.contractorPayments || 0,
      fill: CHART_COLORS.purple,
    },
    {
      name: "Order Costs",
      value: portfolio?.expenses.orderCosts || 0,
      fill: CHART_COLORS.warning,
    },
  ];

  const handleExport = () => {
    const csvData = [
      ["Property Management Financial Report"],
      ["Period", `${format(periodStart, "dd MMM yyyy")} - ${format(periodEnd, "dd MMM yyyy")}`],
      [""],
      ["PORTFOLIO SUMMARY"],
      ["Total Properties", portfolio?.numberOfProperties || 0],
      ["Total Units", portfolio?.totalUnits || 0],
      ["Occupied Units", portfolio?.occupiedUnits || 0],
      ["Occupancy Rate", formatPercentage(portfolio?.occupancyRate || 0)],
      [""],
      ["REVENUE"],
      ["Rental Income", formatCurrency(portfolio?.revenue.rentalIncome || 0)],
      ["Other Income", formatCurrency(portfolio?.revenue.otherIncome || 0)],
      ["Total Revenue", formatCurrency(portfolio?.revenue.total || 0)],
      [""],
      ["EXPENSES"],
      ["Budget Expenses", formatCurrency(portfolio?.expenses.budgetExpenses || 0)],
      ["Contractor Payments", formatCurrency(portfolio?.expenses.contractorPayments || 0)],
      ["Order Costs", formatCurrency(portfolio?.expenses.orderCosts || 0)],
      ["Total Expenses", formatCurrency(portfolio?.expenses.total || 0)],
      [""],
      ["PROFITABILITY"],
      [
        "Net Operating Income",
        formatCurrency(portfolio?.profitability.netOperatingIncome || 0),
      ],
      ["Profit Margin", formatPercentage(portfolio?.profitability.profitMargin || 0)],
      [""],
      ["PER-UNIT METRICS"],
      ["Revenue per Unit", formatCurrency(portfolio?.performance.revenuePerUnit || 0)],
      ["Expense per Unit", formatCurrency(portfolio?.performance.expensePerUnit || 0)],
      [
        "Net Income per Unit",
        formatCurrency(portfolio?.performance.netIncomePerUnit || 0),
      ],
    ];

    const csv = csvData.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `Financial_Report_${format(new Date(), "yyyy-MM-dd")}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    toast.success("Report exported successfully");
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Financial Reports & Analytics
            </h1>
            <p className="text-gray-600">
              Comprehensive property management financial performance dashboard
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={handleGenerateInsights}
              disabled={generateInsightsMutation.isPending || !data}
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {generateInsightsMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  AI Insights
                </>
              )}
            </button>
            <button
              onClick={handleExport}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Calendar className="w-4 h-4 inline mr-2" />
              Period
            </label>
            <select
              value={selectedPeriod}
              onChange={(e) => setSelectedPeriod(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="current_month">Current Month</option>
              <option value="last_month">Last Month</option>
              <option value="quarter">Current Quarter</option>
              <option value="ytd">Year to Date</option>
              <option value="custom">Custom Range</option>
            </select>
          </div>

          {selectedPeriod === "custom" && (
            <>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date
                </label>
                <input
                  type="date"
                  value={format(customStart, "yyyy-MM-dd")}
                  onChange={(e) => setCustomStart(new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex-1 min-w-[200px]">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date
                </label>
                <input
                  type="date"
                  value={format(customEnd, "yyyy-MM-dd")}
                  onChange={(e) => setCustomEnd(new Date(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </>
          )}

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Filter className="w-4 h-4 inline mr-2" />
              Building Filter
            </label>
            <select
              value={selectedBuilding || ""}
              onChange={(e) =>
                setSelectedBuilding(e.target.value ? Number(e.target.value) : null)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Buildings</option>
              {buildings.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Tabs */}
        <div className="flex gap-2 mt-6 border-b border-gray-200">
          {[
            { id: "overview", label: "Portfolio Overview", icon: BarChart3 },
            { id: "buildings", label: "Building Analysis", icon: Building2 },
            { id: "performance", label: "Performance Metrics", icon: TrendingUp },
            { id: "insights", label: "AI Insights", icon: Sparkles },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveView(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${
                activeView === tab.id
                  ? "border-blue-500 text-blue-600 font-medium"
                  : "border-transparent text-gray-600 hover:text-gray-900"
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Portfolio Overview */}
      {activeView === "overview" && (
        <>
          {/* Key Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Total Revenue"
              value={formatCurrency(portfolio?.revenue.total || 0)}
              subtitle={`${portfolio?.numberOfProperties || 0} properties`}
              icon={DollarSign}
              trend={portfolio?.revenue.trend}
              trendLabel="vs last period"
              color="green"
            />
            <MetricCard
              title="Total Expenses"
              value={formatCurrency(portfolio?.expenses.total || 0)}
              subtitle="Budget, contractors & orders"
              icon={TrendingDown}
              color="red"
            />
            <MetricCard
              title="Net Operating Income"
              value={formatCurrency(portfolio?.profitability.netOperatingIncome || 0)}
              subtitle={`${formatPercentage(portfolio?.profitability.profitMargin || 0)} margin`}
              icon={TrendingUp}
              color={
                (portfolio?.profitability.netOperatingIncome || 0) > 0 ? "green" : "red"
              }
            />
            <MetricCard
              title="Occupancy Rate"
              value={formatPercentage(portfolio?.occupancyRate || 0)}
              subtitle={`${portfolio?.occupiedUnits}/${portfolio?.totalUnits} units occupied`}
              icon={Home}
              color="blue"
            />
          </div>

          {/* Revenue vs Expenses Chart */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue vs Expenses</h2>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={revenueExpenseData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) =>
                        percent ? `${name}: ${(percent * 100).toFixed(0)}%` : name
                      }
                      outerRadius={100}
                      dataKey="value"
                    >
                      {revenueExpenseData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={revenueExpenseData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `R ${(value / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(value: any) => formatCurrency(value)} />
                    <Bar dataKey="value" fill={CHART_COLORS.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Expense Breakdown */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Expense Breakdown</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={expenseBreakdownData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis tickFormatter={(value) => `R ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Bar dataKey="value">
                  {expenseBreakdownData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Additional Metrics */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-purple-50">
                  <Users className="w-6 h-6 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Budget Performance</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Budget</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.budgets.total || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Spent</span>
                  <span className="font-semibold text-red-600">
                    {formatCurrency(portfolio?.budgets.spent || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Remaining</span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(portfolio?.budgets.remaining || 0)}
                  </span>
                </div>
                <div className="mt-4">
                  <div className="flex justify-between text-sm mb-2">
                    <span className="text-gray-600">Utilization</span>
                    <span className="font-semibold">
                      {formatPercentage(portfolio?.budgets.utilization || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (portfolio?.budgets.utilization || 0) > 90
                          ? "bg-red-600"
                          : (portfolio?.budgets.utilization || 0) > 75
                          ? "bg-orange-500"
                          : "bg-green-600"
                      }`}
                      style={{
                        width: `${Math.min(portfolio?.budgets.utilization || 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-orange-50">
                  <AlertCircle className="w-6 h-6 text-orange-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Contractor Activity</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Payments</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.contractors.totalPayments || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Payment Count</span>
                  <span className="font-semibold text-gray-900">
                    {portfolio?.contractors.paymentCount || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Average Payment</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.contractors.averagePayment || 0)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-teal-50">
                  <CheckCircle className="w-6 h-6 text-teal-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">Maintenance</h3>
              </div>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Requests</span>
                  <span className="font-semibold text-gray-900">
                    {portfolio?.maintenance.totalRequests || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Total Cost</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.maintenance.totalCost || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Avg Cost/Request</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.maintenance.avgCostPerRequest || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Building Analysis */}
      {activeView === "buildings" && (
        <>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">
              Building Performance Comparison
            </h2>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={buildingPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis tickFormatter={(value) => `R ${(value / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(value: any) => formatCurrency(value)} />
                <Legend />
                <Bar dataKey="revenue" fill={CHART_COLORS.success} name="Revenue" />
                <Bar dataKey="expenses" fill={CHART_COLORS.danger} name="Expenses" />
                <Bar dataKey="netIncome" fill={CHART_COLORS.primary} name="Net Income" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Building Details Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">Building Financial Details</h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                      Building
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Revenue
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Expenses
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Net Income
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Margin
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">
                      Occupancy
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {buildingData.map((building) => (
                    <tr key={building.buildingId} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="font-medium text-gray-900">
                            {building.buildingName}
                          </div>
                          <div className="text-sm text-gray-500">
                            {building.buildingAddress}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-green-600">
                        {formatCurrency(building.revenue.totalRevenue)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium text-red-600">
                        {formatCurrency(building.expenses.totalExpenses)}
                      </td>
                      <td
                        className={`px-6 py-4 text-right text-sm font-medium ${
                          building.profitability.netOperatingIncome >= 0
                            ? "text-green-600"
                            : "text-red-600"
                        }`}
                      >
                        {formatCurrency(building.profitability.netOperatingIncome)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        {formatPercentage(building.profitability.profitMargin)}
                      </td>
                      <td className="px-6 py-4 text-right text-sm text-gray-900">
                        {formatPercentage(building.occupancy.occupancyRate)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* Performance Metrics */}
      {activeView === "performance" && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <MetricCard
              title="Revenue per Unit"
              value={formatCurrency(portfolio?.performance.revenuePerUnit || 0)}
              subtitle="Average across portfolio"
              icon={DollarSign}
              color="green"
            />
            <MetricCard
              title="Expense per Unit"
              value={formatCurrency(portfolio?.performance.expensePerUnit || 0)}
              subtitle="Average across portfolio"
              icon={TrendingDown}
              color="red"
            />
            <MetricCard
              title="Net Income per Unit"
              value={formatCurrency(portfolio?.performance.netIncomePerUnit || 0)}
              subtitle="Average profitability"
              icon={TrendingUp}
              color="blue"
            />
            <MetricCard
              title="Rent Collection Rate"
              value={formatPercentage(portfolio?.performance.rentCollectionRate || 0)}
              subtitle="Payment efficiency"
              icon={CheckCircle}
              color="teal"
            />
          </div>

          {/* Occupancy Analysis */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Occupancy Analysis</h2>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={buildingPerformanceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis tickFormatter={(value) => `${value}%`} />
                <Tooltip formatter={(value: any) => formatPercentage(value)} />
                <Bar dataKey="occupancy" fill={CHART_COLORS.teal} name="Occupancy Rate %" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Key Performance Indicators */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Financial Health Indicators
              </h3>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Profit Margin</span>
                    <span
                      className={`font-semibold ${
                        (portfolio?.profitability.profitMargin || 0) >= 15
                          ? "text-green-600"
                          : (portfolio?.profitability.profitMargin || 0) >= 5
                          ? "text-orange-500"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercentage(portfolio?.profitability.profitMargin || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (portfolio?.profitability.profitMargin || 0) >= 15
                          ? "bg-green-600"
                          : (portfolio?.profitability.profitMargin || 0) >= 5
                          ? "bg-orange-500"
                          : "bg-red-600"
                      }`}
                      style={{
                        width: `${Math.min(
                          Math.max(portfolio?.profitability.profitMargin || 0, 0),
                          100
                        )}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(portfolio?.profitability.profitMargin || 0) >= 15
                      ? "Excellent"
                      : (portfolio?.profitability.profitMargin || 0) >= 5
                      ? "Fair"
                      : "Needs Improvement"}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Occupancy Rate</span>
                    <span
                      className={`font-semibold ${
                        (portfolio?.occupancyRate || 0) >= 90
                          ? "text-green-600"
                          : (portfolio?.occupancyRate || 0) >= 75
                          ? "text-orange-500"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercentage(portfolio?.occupancyRate || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (portfolio?.occupancyRate || 0) >= 90
                          ? "bg-green-600"
                          : (portfolio?.occupancyRate || 0) >= 75
                          ? "bg-orange-500"
                          : "bg-red-600"
                      }`}
                      style={{
                        width: `${Math.min(portfolio?.occupancyRate || 0, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(portfolio?.occupancyRate || 0) >= 90
                      ? "Excellent"
                      : (portfolio?.occupancyRate || 0) >= 75
                      ? "Good"
                      : "Below Target"}
                  </p>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm text-gray-600">Budget Utilization</span>
                    <span
                      className={`font-semibold ${
                        (portfolio?.budgets.utilization || 0) <= 90
                          ? "text-green-600"
                          : (portfolio?.budgets.utilization || 0) <= 100
                          ? "text-orange-500"
                          : "text-red-600"
                      }`}
                    >
                      {formatPercentage(portfolio?.budgets.utilization || 0)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className={`h-2 rounded-full ${
                        (portfolio?.budgets.utilization || 0) <= 90
                          ? "bg-green-600"
                          : (portfolio?.budgets.utilization || 0) <= 100
                          ? "bg-orange-500"
                          : "bg-red-600"
                      }`}
                      style={{
                        width: `${Math.min(portfolio?.budgets.utilization || 0, 100)}%`,
                      }}
                    />
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    {(portfolio?.budgets.utilization || 0) <= 90
                      ? "Within Budget"
                      : (portfolio?.budgets.utilization || 0) <= 100
                      ? "Near Limit"
                      : "Over Budget"}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Portfolio Statistics
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total Properties</span>
                  <span className="font-semibold text-gray-900">
                    {portfolio?.numberOfProperties || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Total Units</span>
                  <span className="font-semibold text-gray-900">
                    {portfolio?.totalUnits || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Occupied Units</span>
                  <span className="font-semibold text-green-600">
                    {portfolio?.occupiedUnits || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Vacant Units</span>
                  <span className="font-semibold text-red-600">
                    {portfolio?.vacantUnits || 0}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-gray-100">
                  <span className="text-sm text-gray-600">Avg Revenue/Unit</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.performance.revenuePerUnit || 0)}
                  </span>
                </div>
                <div className="flex justify-between items-center py-2">
                  <span className="text-sm text-gray-600">Avg Expense/Unit</span>
                  <span className="font-semibold text-gray-900">
                    {formatCurrency(portfolio?.performance.expensePerUnit || 0)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* AI Insights View */}
      {activeView === "insights" && (
        <>
          {!aiInsights ? (
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 rounded-xl shadow-sm border border-purple-200 p-12 text-center">
              <div className="max-w-2xl mx-auto">
                <div className="p-4 rounded-full bg-gradient-to-r from-purple-600 to-indigo-600 w-20 h-20 mx-auto mb-6 flex items-center justify-center">
                  <Sparkles className="w-10 h-10 text-white" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900 mb-4">
                  AI-Powered Financial Insights
                </h2>
                <p className="text-gray-600 mb-8">
                  Get intelligent analysis of your portfolio's financial performance with
                  actionable recommendations powered by advanced AI. Our system analyzes
                  revenue, expenses, occupancy, and profitability to provide personalized
                  guidance.
                </p>
                <button
                  onClick={handleGenerateInsights}
                  disabled={generateInsightsMutation.isPending || !data}
                  className="px-8 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-lg font-medium inline-flex items-center gap-3"
                >
                  {generateInsightsMutation.isPending ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Analyzing Your Portfolio...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-6 h-6" />
                      Generate AI Insights
                    </>
                  )}
                </button>
                <p className="text-sm text-gray-500 mt-4">
                  Analysis typically takes 5-10 seconds
                </p>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {/* AI Insights Header */}
              <div className="bg-gradient-to-r from-purple-600 to-indigo-600 rounded-xl shadow-lg p-6 text-white">
                <div className="flex items-center gap-3 mb-2">
                  <Sparkles className="w-6 h-6" />
                  <h2 className="text-2xl font-bold">AI Financial Insights</h2>
                </div>
                <p className="text-purple-100">
                  Powered by Claude AI • Generated on{" "}
                  {format(new Date(), "MMMM dd, yyyy 'at' HH:mm")}
                </p>
              </div>

              {/* Insights Content */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
                <div className="prose prose-lg max-w-none">
                  {aiInsights.split("\n\n").map((section, index) => {
                    // Check if section is a header (starts with number or ***)
                    if (section.match(/^\d+\.\s\*\*/)) {
                      const parts = section.split("\n");
                      const header = parts[0];
                      const content = parts.slice(1);
                      return (
                        <div key={index} className="mb-8">
                          <h3 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                            {header?.includes("Assessment") && (
                              <TrendingUpDown className="w-5 h-5 text-purple-600" />
                            )}
                            {header?.includes("Strengths") && (
                              <CheckCircle className="w-5 h-5 text-green-600" />
                            )}
                            {header?.includes("Concern") && (
                              <AlertCircle className="w-5 h-5 text-orange-600" />
                            )}
                            {header?.includes("Recommendations") && (
                              <Target className="w-5 h-5 text-blue-600" />
                            )}
                            {header?.includes("Building") && (
                              <Building2 className="w-5 h-5 text-teal-600" />
                            )}
                            {header?.includes("Score") && (
                              <Lightbulb className="w-5 h-5 text-yellow-600" />
                            )}
                            {header?.replace(/^\d+\.\s\*\*/, "").replace(/\*\*$/, "") || ""}
                          </h3>
                          <div className="text-gray-700 whitespace-pre-wrap">
                            {content.join("\n")}
                          </div>
                        </div>
                      );
                    }
                    return (
                      <p key={index} className="text-gray-700 whitespace-pre-wrap mb-4">
                        {section}
                      </p>
                    );
                  })}
                </div>
              </div>

              {/* Regenerate Button */}
              <div className="flex justify-center">
                <button
                  onClick={handleGenerateInsights}
                  disabled={generateInsightsMutation.isPending}
                  className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  {generateInsightsMutation.isPending ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Regenerate Insights
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
