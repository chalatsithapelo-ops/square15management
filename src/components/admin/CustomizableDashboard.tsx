import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Settings, Eye, EyeOff, Loader2 } from "lucide-react";
import { ExpenseBreakdownChart } from "~/components/charts/ExpenseBreakdownChart";
import { RevenueTrendChart } from "~/components/charts/RevenueTrendChart";
import { ProfitMarginChart } from "~/components/charts/ProfitMarginChart";
import { RevenueByClientChart } from "~/components/charts/RevenueByClientChart";
import { RevenueByArtisanChart } from "~/components/charts/RevenueByArtisanChart";
import { RevenueByProjectTypeChart } from "~/components/charts/RevenueByProjectTypeChart";
import { RevenueComparisonChart } from "~/components/charts/RevenueComparisonChart";
import { PopularServicesChart } from "~/components/charts/PopularServicesChart";
import { CustomerTrendsChart } from "~/components/charts/CustomerTrendsChart";

interface CustomizableDashboardProps {
  invoices: any[];
  orders: any[];
  quotations: any[];
  paymentRequests: any[];
  projects: any[];
  dateRange: { start: string; end: string };
  operationalExpenses?: any[];
  alternativeRevenues?: any[];
}

export function CustomizableDashboard({
  invoices,
  orders,
  quotations,
  paymentRequests,
  projects,
  dateRange,
  operationalExpenses = [],
  alternativeRevenues = [],
}: CustomizableDashboardProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [editMode, setEditMode] = useState(false);
  const [revenuePeriod, setRevenuePeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [customerPeriod, setCustomerPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");
  const [visibleWidgets, setVisibleWidgets] = useState<Record<string, boolean>>({
    revenue_trend: true,
    expense_breakdown: true,
    profit_margin: true,
    revenue_by_client: true,
    revenue_by_artisan: true,
    revenue_by_project_type: true,
    revenue_comparison: true,
    popular_services: true,
    customer_trends: true,
  });

  const dashboardConfigQuery = useQuery(
    trpc.getDashboardConfig.queryOptions({
      token: token!,
    })
  );

  // Fetch revenue analytics for different periods
  const revenueAnalyticsDailyQuery = useQuery(
    trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "DAILY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  const revenueAnalyticsWeeklyQuery = useQuery(
    trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "WEEKLY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  const revenueAnalyticsMonthlyQuery = useQuery(
    trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "MONTHLY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  // Fetch service analytics
  const serviceAnalyticsQuery = useQuery(
    trpc.getServiceAnalytics.queryOptions({
      token: token!,
      startDate: dateRange.start,
      endDate: dateRange.end,
      limit: 10,
    })
  );

  // Fetch customer analytics for different periods
  const customerAnalyticsDailyQuery = useQuery(
    trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "DAILY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  const customerAnalyticsWeeklyQuery = useQuery(
    trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "WEEKLY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  const customerAnalyticsMonthlyQuery = useQuery(
    trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "MONTHLY",
      startDate: dateRange.start,
      endDate: dateRange.end,
    })
  );

  // Prepare chart data
  const chartData = useMemo(() => {
    // Revenue trend data (group by month)
    const revenueByMonth = new Map<string, { revenue: number; date: Date }>();
    
    // Add invoice revenue
    invoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        const date = new Date(inv.paidDate || inv.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = revenueByMonth.get(monthKey) || { revenue: 0, date };
        revenueByMonth.set(monthKey, {
          revenue: existing.revenue + inv.total,
          date,
        });
      });

    // Add alternative revenues
    alternativeRevenues
      .filter((rev) => rev.status === "APPROVED")
      .forEach((rev) => {
        const date = new Date(rev.date || rev.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = revenueByMonth.get(monthKey) || { revenue: 0, date };
        revenueByMonth.set(monthKey, {
          revenue: existing.revenue + rev.amount,
          date,
        });
      });

    const revenueTrendData = Array.from(revenueByMonth.entries())
      .map(([period, data]) => ({
        period,
        revenue: data.revenue,
        date: data.date,
      }))
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Profit margin data (group by month)
    const profitByMonth = new Map<string, { revenue: number; expenses: number; date: Date }>();
    
    // Add invoice revenue
    invoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        const date = new Date(inv.paidDate || inv.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = profitByMonth.get(monthKey) || { revenue: 0, expenses: 0, date };
        profitByMonth.set(monthKey, {
          ...existing,
          revenue: existing.revenue + inv.total,
          date,
        });
      });

    // Add alternative revenues
    alternativeRevenues
      .filter((rev) => rev.status === "APPROVED")
      .forEach((rev) => {
        const date = new Date(rev.date || rev.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = profitByMonth.get(monthKey) || { revenue: 0, expenses: 0, date };
        profitByMonth.set(monthKey, {
          ...existing,
          revenue: existing.revenue + rev.amount,
          date,
        });
      });

    // Add order expenses
    orders.forEach((order) => {
      const date = new Date(order.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      const existing = profitByMonth.get(monthKey) || { revenue: 0, expenses: 0, date };
      profitByMonth.set(monthKey, {
        ...existing,
        expenses: existing.expenses + (order.materialCost || 0) + (order.labourCost || 0),
        date,
      });
    });

    // Add operational expenses
    operationalExpenses
      .filter((exp) => exp.status === "APPROVED")
      .forEach((exp) => {
        const date = new Date(exp.date || exp.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
        const existing = profitByMonth.get(monthKey) || { revenue: 0, expenses: 0, date };
        profitByMonth.set(monthKey, {
          ...existing,
          expenses: existing.expenses + exp.amount,
          date,
        });
      });

    const profitMarginData = Array.from(profitByMonth.entries())
      .map(([period, data]) => {
        const netProfit = data.revenue - data.expenses;
        const profitMargin = data.revenue > 0 ? (netProfit / data.revenue) * 100 : 0;
        return {
          period,
          profitMargin,
          netProfit,
          revenue: data.revenue,
          date: data.date,
        };
      })
      .sort((a, b) => a.date.getTime() - b.date.getTime());

    // Revenue by client
    const revenueByClient = new Map<string, { revenue: number; invoiceCount: number }>();
    invoices
      .filter((inv) => inv.status === "PAID")
      .forEach((inv) => {
        const clientName = inv.customerName || "Unknown";
        const existing = revenueByClient.get(clientName) || { revenue: 0, invoiceCount: 0 };
        revenueByClient.set(clientName, {
          revenue: existing.revenue + inv.total,
          invoiceCount: existing.invoiceCount + 1,
        });
      });

    const revenueByClientData = Array.from(revenueByClient.entries()).map(
      ([clientName, data]) => ({
        clientName,
        ...data,
      })
    );

    // Revenue by artisan
    const revenueByArtisan = new Map<string, { revenue: number; orderCount: number }>();
    orders
      .filter((order) => order.assignedTo && order.status === "COMPLETED")
      .forEach((order) => {
        const artisanName = `${order.assignedTo.firstName} ${order.assignedTo.lastName}`;
        const existing = revenueByArtisan.get(artisanName) || { revenue: 0, orderCount: 0 };
        // Use the invoice total if available, otherwise use order totalCost
        const invoice = invoices.find((inv) => inv.orderId === order.id && inv.status === "PAID");
        const revenue = invoice ? invoice.total : order.totalCost;
        revenueByArtisan.set(artisanName, {
          revenue: existing.revenue + revenue,
          orderCount: existing.orderCount + 1,
        });
      });

    const revenueByArtisanData = Array.from(revenueByArtisan.entries()).map(
      ([artisanName, data]) => ({
        artisanName,
        ...data,
      })
    );

    // Revenue by project type
    const revenueByProjectType = new Map<string, { revenue: number; projectCount: number }>();
    
    // Get revenue from invoices linked to projects
    invoices
      .filter((inv) => inv.projectId && inv.status === "PAID")
      .forEach((inv) => {
        const project = projects.find((p) => p.id === inv.projectId);
        if (project) {
          const projectType = project.projectType || "Unknown";
          const existing = revenueByProjectType.get(projectType) || {
            revenue: 0,
            projectCount: 0,
          };
          revenueByProjectType.set(projectType, {
            revenue: existing.revenue + inv.total,
            projectCount: existing.projectCount,
          });
        }
      });

    // Count projects
    projects.forEach((project) => {
      const projectType = project.projectType || "Unknown";
      const existing = revenueByProjectType.get(projectType) || {
        revenue: 0,
        projectCount: 0,
      };
      revenueByProjectType.set(projectType, {
        ...existing,
        projectCount: existing.projectCount + 1,
      });
    });

    const revenueByProjectTypeData = Array.from(revenueByProjectType.entries()).map(
      ([projectType, data]) => ({
        projectType,
        ...data,
      })
    );

    // Expense breakdown
    const orderMaterialCosts = orders.reduce((sum, o) => sum + (o.materialCost || 0), 0);
    const orderLabourCosts = orders.reduce((sum, o) => sum + (o.labourCost || 0), 0);
    
    const quotationMaterialCosts = quotations
      .filter((q) => q.status === "APPROVED")
      .reduce((sum, q) => sum + (q.companyMaterialCost || 0), 0);
    
    const quotationLabourCosts = quotations
      .filter((q) => q.status === "APPROVED")
      .reduce((sum, q) => sum + (q.companyLabourCost || 0), 0);

    const materialCosts = orderMaterialCosts + quotationMaterialCosts;
    const labourCosts = orderLabourCosts + quotationLabourCosts;

    const artisanPayments = paymentRequests
      .filter((pr) => pr.status === "PAID")
      .reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);

    return {
      revenueTrendData,
      profitMarginData,
      revenueByClientData,
      revenueByArtisanData,
      revenueByProjectTypeData,
      expenseData: {
        labourCosts,
        materialCosts,
        artisanPayments,
      },
    };
  }, [invoices, orders, quotations, paymentRequests, projects]);

  const toggleWidget = (widgetId: string) => {
    setVisibleWidgets((prev) => ({
      ...prev,
      [widgetId]: !prev[widgetId],
    }));
  };

  if (dashboardConfigQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Dashboard Controls */}
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h2>
        <button
          onClick={() => setEditMode(!editMode)}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          <Settings className="h-4 w-4" />
          {editMode ? "Done Editing" : "Customize"}
        </button>
      </div>

      {editMode && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-blue-900 mb-3">Show/Hide Widgets</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(visibleWidgets).map(([widgetId, isVisible]) => (
              <button
                key={widgetId}
                onClick={() => toggleWidget(widgetId)}
                className={`flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
                  isVisible
                    ? "bg-blue-100 text-blue-900 border-2 border-blue-300"
                    : "bg-white text-gray-700 border-2 border-gray-200"
                }`}
              >
                {isVisible ? (
                  <Eye className="h-4 w-4" />
                ) : (
                  <EyeOff className="h-4 w-4" />
                )}
                <span className="capitalize">
                  {widgetId.replace(/_/g, " ")}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Dashboard Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {visibleWidgets.revenue_trend && (
          <div className="lg:col-span-2">
            <RevenueTrendChart data={chartData.revenueTrendData} />
          </div>
        )}

        {visibleWidgets.expense_breakdown && (
          <ExpenseBreakdownChart
            labourCosts={chartData.expenseData.labourCosts}
            materialCosts={chartData.expenseData.materialCosts}
            artisanPayments={chartData.expenseData.artisanPayments}
          />
        )}

        {visibleWidgets.profit_margin && (
          <ProfitMarginChart data={chartData.profitMarginData} />
        )}

        {visibleWidgets.revenue_by_client && (
          <RevenueByClientChart data={chartData.revenueByClientData} />
        )}

        {visibleWidgets.revenue_by_artisan && (
          <RevenueByArtisanChart data={chartData.revenueByArtisanData} />
        )}

        {visibleWidgets.revenue_by_project_type && (
          <RevenueByProjectTypeChart data={chartData.revenueByProjectTypeData} />
        )}

        {visibleWidgets.revenue_comparison && (
          <div className="lg:col-span-2">
            <RevenueComparisonChart
              dailyData={revenueAnalyticsDailyQuery.data || []}
              weeklyData={revenueAnalyticsWeeklyQuery.data || []}
              monthlyData={revenueAnalyticsMonthlyQuery.data || []}
              isLoading={revenueAnalyticsDailyQuery.isLoading || revenueAnalyticsWeeklyQuery.isLoading || revenueAnalyticsMonthlyQuery.isLoading}
              onPeriodChange={setRevenuePeriod}
            />
          </div>
        )}

        {visibleWidgets.popular_services && (
          <PopularServicesChart
            data={serviceAnalyticsQuery.data || []}
            isLoading={serviceAnalyticsQuery.isLoading}
          />
        )}

        {visibleWidgets.customer_trends && (
          <div className="lg:col-span-2">
            <CustomerTrendsChart
              dailyData={customerAnalyticsDailyQuery.data || []}
              weeklyData={customerAnalyticsWeeklyQuery.data || []}
              monthlyData={customerAnalyticsMonthlyQuery.data || []}
              isLoading={customerAnalyticsDailyQuery.isLoading || customerAnalyticsWeeklyQuery.isLoading || customerAnalyticsMonthlyQuery.isLoading}
              onPeriodChange={setCustomerPeriod}
            />
          </div>
        )}
      </div>
    </div>
  );
}
