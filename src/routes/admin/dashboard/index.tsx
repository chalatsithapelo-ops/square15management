import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  FolderKanban,
  FileText,
  Receipt,
  DollarSign,
  Package,
  CreditCard,
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  MessageSquare,
  Settings,
  TrendingDown,
  Percent,
  Wallet,
  UserCircle2,
  Loader2,
  Bot,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  ChevronDown,
} from "lucide-react";
import { SupportChatWidget } from "~/components/SupportChatWidget";
import { AIAgentChatWidget } from "~/components/AIAgentChatWidget";
import { RevenueComparisonChart } from "~/components/charts/RevenueComparisonChart";
import { PopularServicesChart } from "~/components/charts/PopularServicesChart";
import { CustomerTrendsChart } from "~/components/charts/CustomerTrendsChart";
import { BudgetUtilizationTrendChart } from "~/components/charts/BudgetUtilizationTrendChart";
import { CompletionRateTrendChart } from "~/components/charts/CompletionRateTrendChart";
import { ProjectHealthTrendChart } from "~/components/charts/ProjectHealthTrendChart";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { useState, useMemo } from "react";
import { ROLES } from "~/utils/roles";
import type { Permission } from "~/server/utils/permissions";

type DashboardPeriod = "current_month" | "current_quarter" | "financial_year" | "all_time";

export const Route = createFileRoute("/admin/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || (user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN")) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: AdminDashboard,
});

function AdminDashboard() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const [showAnalytics, setShowAnalytics] = useState(true);
  const [period, setPeriod] = useState<DashboardPeriod>("current_month");

  // ── Period filtering ──────────────────────────────────────────────────
  const periodStart = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "current_month":
        return new Date(now.getFullYear(), now.getMonth(), 1);
      case "current_quarter": {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        return new Date(now.getFullYear(), qMonth, 1);
      }
      case "financial_year":
        // South Africa financial year starts 1 March
        return now.getMonth() >= 2
          ? new Date(now.getFullYear(), 2, 1)
          : new Date(now.getFullYear() - 1, 2, 1);
      case "all_time":
        return new Date(2000, 0, 1);
    }
  }, [period]);

  const periodLabel = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "current_month":
        return now.toLocaleDateString("en-ZA", { month: "long", year: "numeric" });
      case "current_quarter": {
        const q = Math.floor(now.getMonth() / 3) + 1;
        return `Q${q} ${now.getFullYear()}`;
      }
      case "financial_year": {
        const fyStart = now.getMonth() >= 2 ? now.getFullYear() : now.getFullYear() - 1;
        return `FY ${fyStart}/${fyStart + 1}`;
      }
      case "all_time":
        return "All Time";
    }
  }, [period]);

  const isInPeriod = (date: string | Date | null | undefined) => {
    if (!date) return false;
    return new Date(date) >= periodStart;
  };

  // ── Query defaults ────────────────────────────────────────────────────
  const dashboardQueryDefaults = {
    enabled: !!token,
    refetchOnWindowFocus: false,
    refetchInterval: false as const,
    staleTime: 30000,
    retry: 1,
  };

  // ── tRPC Queries ──────────────────────────────────────────────────────
  const userPermissionsQuery = useQuery({
    ...trpc.getUserPermissions.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasPermission = (permission: Permission) => userPermissions.includes(permission);

  const leadsQuery = useQuery({
    ...trpc.getLeads.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const ordersQuery = useQuery({
    ...trpc.getOrders.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const projectsQuery = useQuery({
    ...trpc.getProjects.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const quotationsQuery = useQuery({
    ...trpc.getQuotations.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const invoicesQuery = useQuery({
    ...trpc.getInvoices.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const assetsQuery = useQuery({
    ...trpc.getAssets.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const paymentRequestsQuery = useQuery({
    ...trpc.getPaymentRequests.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const liabilitiesQuery = useQuery({
    ...trpc.getLiabilities.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const conversationsQuery = useQuery({
    ...trpc.getConversations.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const employeesQuery = useQuery({
    ...trpc.getEmployees.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const operationalExpensesQuery = useQuery({
    ...trpc.getOperationalExpenses.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const alternativeRevenuesQuery = useQuery({
    ...trpc.getAlternativeRevenues.queryOptions({ token: token! }),
    ...dashboardQueryDefaults,
  });
  const metricSnapshotsQuery = useQuery({
    ...trpc.getMetricSnapshots.queryOptions({ token: token!, metricType: "DAILY", limit: 30 }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  // Analytics queries (90 days)
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const analyticsStartDate = ninetyDaysAgo.toISOString().split("T")[0];
  const analyticsEndDate = new Date().toISOString().split("T")[0];

  const revenueAnalyticsDailyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({ token: token!, periodType: "DAILY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const revenueAnalyticsWeeklyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({ token: token!, periodType: "WEEKLY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const revenueAnalyticsMonthlyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({ token: token!, periodType: "MONTHLY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const serviceAnalyticsQuery = useQuery({
    ...trpc.getServiceAnalytics.queryOptions({ token: token!, startDate: analyticsStartDate, endDate: analyticsEndDate, limit: 8 }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const customerAnalyticsDailyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({ token: token!, periodType: "DAILY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const customerAnalyticsWeeklyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({ token: token!, periodType: "WEEKLY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });
  const customerAnalyticsMonthlyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({ token: token!, periodType: "MONTHLY", startDate: analyticsStartDate, endDate: analyticsEndDate }),
    ...dashboardQueryDefaults, enabled: !!token && showAnalytics,
  });

  // ── Raw data ──────────────────────────────────────────────────────────
  const leads = leadsQuery.data || [];
  const orders = ordersQuery.data || [];
  const projects = projectsQuery.data || [];
  const quotations = quotationsQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const assets = assetsQuery.data || [];
  const paymentRequests = paymentRequestsQuery.data || [];
  const liabilities = liabilitiesQuery.data || [];
  const conversations = conversationsQuery.data || [];
  const employees = employeesQuery.data || [];
  const operationalExpenses = operationalExpensesQuery.data || [];
  const alternativeRevenues = alternativeRevenuesQuery.data || [];
  const unreadConversations = conversations.filter((c) => c.unreadCount > 0);
  const metricSnapshots = metricSnapshotsQuery.data || [];

  const isLoadingCriticalData =
    leadsQuery.isLoading || ordersQuery.isLoading || projectsQuery.isLoading || invoicesQuery.isLoading;

  // ── Period-filtered data for financial calculations ────────────────
  const filteredOrders = useMemo(
    () => orders.filter((o) => isInPeriod(o.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [orders, periodStart]
  );
  const filteredQuotations = useMemo(
    () => quotations.filter((q: any) => isInPeriod(q.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [quotations, periodStart]
  );
  const filteredInvoices = useMemo(
    () => invoices.filter((i) => isInPeriod(i.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [invoices, periodStart]
  );
  const filteredPaymentRequests = useMemo(
    () => paymentRequests.filter((pr) => isInPeriod(pr.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [paymentRequests, periodStart]
  );
  const filteredOperationalExpenses = useMemo(
    () => operationalExpenses.filter((e: any) => isInPeriod(e.date || e.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [operationalExpenses, periodStart]
  );
  const filteredAlternativeRevenues = useMemo(
    () => alternativeRevenues.filter((r: any) => isInPeriod(r.date || r.createdAt)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [alternativeRevenues, periodStart]
  );

  // ── Operational metrics (always from ALL data — status based) ─────
  const newLeads = leadsQuery.data ? leads.filter((l) => l.status === "NEW").length : 0;
  const activeOrders = ordersQuery.data
    ? orders.filter((o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED").length
    : 0;
  const completedOrders = ordersQuery.data ? orders.filter((o) => o.status === "COMPLETED").length : 0;
  const activeProjects = projectsQuery.data
    ? projects.filter((p) => p.status === "IN_PROGRESS" || p.status === "PLANNING").length
    : 0;
  const pendingQuotations = quotationsQuery.data
    ? quotations.filter((q: any) =>
        ["PENDING_ARTISAN_REVIEW", "PENDING_JUNIOR_MANAGER_REVIEW", "PENDING_SENIOR_MANAGER_REVIEW", "SENT_TO_CUSTOMER", "SUBMITTED"].includes(q.status)
      ).length
    : 0;
  const unpaidInvoices = invoicesQuery.data
    ? invoices.filter((i) => i.status === "SENT" || i.status === "OVERDUE").length
    : 0;
  const overdueInvoices = invoicesQuery.data ? invoices.filter((i) => i.status === "OVERDUE").length : 0;
  const paidInvoicesCount = invoicesQuery.data ? invoices.filter((i) => i.status === "PAID").length : 0;
  const totalAssetValue = assetsQuery.data ? assets.reduce((sum, a) => sum + (a.currentValue ?? 0), 0) : 0;
  const pendingPaymentRequests = paymentRequestsQuery.data
    ? paymentRequests.filter((pr) => pr.status === "PENDING").length
    : 0;
  const outstandingPaymentRequests = paymentRequestsQuery.data
    ? paymentRequests.filter((pr) => pr.status === "PENDING" || pr.status === "APPROVED").length
    : 0;
  const unpaidLiabilitiesAmount = liabilitiesQuery.data
    ? liabilities.filter((l) => !l.isPaid).reduce((sum, l) => sum + (l.amount ?? 0), 0)
    : 0;
  const workInProgress = activeOrders + activeProjects;

  // ── Financial calculations (PERIOD-FILTERED) ──────────────────────
  // Revenue
  const invoiceRevenue = invoicesQuery.data
    ? filteredInvoices.filter((i) => i.status === "PAID").reduce((sum, i) => sum + (i.total ?? 0), 0)
    : 0;
  const alternativeRevenueTotal = alternativeRevenuesQuery.data
    ? filteredAlternativeRevenues.filter((r: any) => r.isApproved === true).reduce((sum, r: any) => sum + (r.amount ?? 0), 0)
    : 0;
  const totalRevenue = invoiceRevenue + alternativeRevenueTotal;

  // Expenses
  const orderMaterialCosts = ordersQuery.data
    ? filteredOrders.reduce((sum, o) => sum + (o.materialCost ?? 0), 0) : 0;
  const orderLabourCosts = ordersQuery.data
    ? filteredOrders.reduce((sum, o) => sum + (o.labourCost ?? 0), 0) : 0;
  const quotationMaterialCosts = quotationsQuery.data
    ? filteredQuotations.filter((q: any) => q.status === "APPROVED").reduce((sum, q: any) => sum + (q.companyMaterialCost ?? 0), 0) : 0;
  const quotationLabourCosts = quotationsQuery.data
    ? filteredQuotations.filter((q: any) => q.status === "APPROVED").reduce((sum, q: any) => sum + (q.companyLabourCost ?? 0), 0) : 0;
  const materialCosts = orderMaterialCosts + quotationMaterialCosts;
  const labourCosts = orderLabourCosts + quotationLabourCosts;
  const artisanPayments = paymentRequestsQuery.data
    ? filteredPaymentRequests.filter((pr) => pr.status === "PAID").reduce((sum, pr) => sum + (pr.calculatedAmount ?? 0), 0) : 0;
  const operationalExpenseTotal = operationalExpensesQuery.data
    ? filteredOperationalExpenses.filter((e: any) => e.isApproved === true).reduce((sum, e: any) => sum + (e.amount ?? 0), 0) : 0;
  const totalExpenses = artisanPayments + materialCosts + labourCosts + operationalExpenseTotal;

  // Profit
  const netProfit = totalRevenue - totalExpenses;
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

  // ── Trend calculation from snapshots ──────────────────────────────
  const calculateMetricChange = (
    currentValue: number,
    metricKey: "totalRevenue" | "completedOrders" | "paidInvoices" | "totalExpenses" | "materialCosts" | "labourCosts" | "artisanPayments" | "netProfit" | "profitMargin" | "activeOrders" | "newLeads" | "totalAssets" | "totalLiabilities"
  ) => {
    if (metricSnapshots.length < 2) return { change: "+0.0%", trend: "neutral" as const };
    const sorted = [...metricSnapshots].sort((a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime());
    const prev = sorted.find((s) => (s[metricKey] as number) !== currentValue);
    if (!prev) return { change: "+0.0%", trend: "neutral" as const };
    const prevVal = prev[metricKey] as number;
    if (prevVal === 0) return { change: currentValue > 0 ? "+100%" : "+0.0%", trend: currentValue > 0 ? ("up" as const) : ("neutral" as const) };
    const pct = ((currentValue - prevVal) / prevVal) * 100;
    return { change: `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`, trend: pct > 0 ? ("up" as const) : pct < 0 ? ("down" as const) : ("neutral" as const) };
  };

  const revenueChange = calculateMetricChange(totalRevenue, "totalRevenue");
  const expensesChange = calculateMetricChange(totalExpenses, "totalExpenses");
  const netProfitChange = calculateMetricChange(netProfit, "netProfit");
  const profitMarginChange = calculateMetricChange(profitMargin, "profitMargin");

  // ── Chart data ────────────────────────────────────────────────────
  const budgetUtilizationData = metricSnapshots
    .map((s) => ({
      period: new Date(s.snapshotDate).toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
      budgetUtilizationPercentage: s.budgetUtilizationPercentage || 0,
      totalProjectBudget: s.totalProjectBudget || 0,
      totalProjectActualCost: s.totalProjectActualCost || 0,
      projectsOverBudget: s.projectsOverBudget || 0,
      date: new Date(s.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completionRateData = metricSnapshots
    .map((s) => ({
      period: new Date(s.snapshotDate).toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
      milestoneCompletionRate: s.milestoneCompletionRate || 0,
      totalMilestones: s.totalMilestones || 0,
      completedMilestones: s.completedMilestones || 0,
      inProgressMilestones: s.inProgressMilestones || 0,
      delayedMilestones: s.delayedMilestones || 0,
      date: new Date(s.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const projectHealthData = metricSnapshots
    .map((s) => ({
      period: new Date(s.snapshotDate).toLocaleDateString("en-ZA", { month: "short", day: "numeric" }),
      averageProjectHealthScore: s.averageProjectHealthScore || 100,
      totalProjects: s.totalProjects || 0,
      activeProjects: s.activeProjects || 0,
      projectsAtRisk: s.projectsAtRisk || 0,
      date: new Date(s.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  // ── Quick Access modules ──────────────────────────────────────────
  const allModules = [
    { title: "CRM", description: "Sales leads & relationships", icon: Users, href: "/admin/crm", accent: "bg-blue-500", stats: `${newLeads} new leads`, group: "business" },
    { title: "Quotations", description: "Create & manage quotes", icon: FileText, href: "/admin/quotations", accent: "bg-amber-500", stats: `${pendingQuotations} pending`, group: "business" },
    { title: "Operations", description: "Track work orders", icon: ClipboardList, href: "/admin/operations", accent: "bg-emerald-500", stats: `${activeOrders} active jobs`, group: "operations" },
    { title: "Projects", description: "Development projects", icon: FolderKanban, href: "/admin/projects", accent: "bg-violet-500", stats: `${activeProjects} active`, group: "operations" },
    { title: "Messages", description: "Communications", icon: MessageSquare, href: "/messages", accent: "bg-teal-500", stats: `${unreadConversations.length} unread`, group: "operations" },
    { title: "Invoices", description: "Billing & payments", icon: Receipt, href: "/admin/invoices", accent: "bg-rose-500", stats: `${unpaidInvoices} unpaid`, group: "finance" },
    { title: "Statements", description: "Customer billing statements", icon: FileText, href: "/admin/statements", accent: "bg-purple-500", stats: "Age analysis", group: "finance" },
    { title: "Accounts", description: "Financial reports", icon: DollarSign, href: "/admin/accounts", accent: "bg-emerald-600", stats: `R${(totalRevenue ?? 0).toLocaleString()}`, group: "finance", permission: "VIEW_ACCOUNTS" as Permission },
    { title: "Payment Requests", description: "Artisan payments", icon: CreditCard, href: "/admin/payment-requests", accent: "bg-pink-500", stats: `${pendingPaymentRequests} pending`, group: "finance", permission: "VIEW_PAYMENT_REQUESTS" as Permission },
    { title: "Assets", description: "Company assets", icon: Package, href: "/admin/assets", accent: "bg-indigo-500", stats: `R${(totalAssetValue ?? 0).toLocaleString()}`, group: "finance", permission: "VIEW_ASSETS" as Permission },
    { title: "Liabilities", description: "Debt & payables", icon: AlertTriangle, href: "/admin/liabilities", accent: "bg-red-500", stats: `R${(unpaidLiabilitiesAmount ?? 0).toLocaleString()}`, group: "finance", permission: "VIEW_LIABILITIES" as Permission },
    { title: "HR Tool", description: "Employees, KPIs & leave", icon: UserCircle2, href: "/admin/hr", accent: "bg-violet-600", stats: `${employees.length} employees`, group: "people", permission: "VIEW_ALL_EMPLOYEES" as Permission },
    { title: "AI Agent", description: "Business assistant", icon: Bot, href: "/admin/ai-agent", accent: "bg-cyan-500", stats: "27 tools", group: "people" },
    { title: "Contractors", description: "Contractor management", icon: Users, href: "/admin/contractor-management", accent: "bg-blue-600", stats: "Admin", group: "admin", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Properties", description: "Property managers", icon: FolderKanban, href: "/admin/property-management", accent: "bg-emerald-600", stats: "Admin", group: "admin", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Subscriptions", description: "Plans & packages", icon: Package, href: "/admin/subscriptions", accent: "bg-amber-600", stats: "Admin", group: "admin", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Registrations", description: "Account requests", icon: ClipboardList, href: "/admin/registrations", accent: "bg-yellow-600", stats: "Admin", group: "admin", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Settings", description: "Branding & config", icon: Settings, href: "/admin/settings", accent: "bg-slate-500", stats: user?.role === "SENIOR_ADMIN" ? "Admin" : "View only", group: "admin", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
  ];

  const isDemoJuniorAdmin = user?.role === "JUNIOR_ADMIN" && user?.email === "junior@propmanagement.com";

  const filteredModules = allModules.filter((mod) => {
    if (mod.permission && !hasPermission(mod.permission)) return false;
    if ((mod.title === "Subscriptions" || mod.title === "Registrations") && isDemoJuniorAdmin) return false;
    return true;
  });

  const modulesByGroup = {
    business: filteredModules.filter((m) => m.group === "business"),
    operations: filteredModules.filter((m) => m.group === "operations"),
    finance: filteredModules.filter((m) => m.group === "finance"),
    people: filteredModules.filter((m) => m.group === "people"),
    admin: filteredModules.filter((m) => m.group === "admin"),
  };

  const groupLabels: Record<string, string> = {
    business: "Business Development",
    operations: "Operations",
    finance: "Financial Management",
    people: "People & AI",
    admin: "Administration",
  };

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      {/* ═══ HEADER ═══════════════════════════════════════════════════ */}
      <header
        className="bg-slate-900 border-b border-slate-700"
        style={{ position: "sticky", top: 0, zIndex: 9999 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-500 rounded-lg flex items-center justify-center">
                <BarChart3 className="h-4 w-4 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-white leading-tight">Executive Dashboard</h1>
                <p className="text-xs text-slate-400">Welcome, {user?.firstName}</p>
              </div>
            </div>

            {/* Center: Period selector */}
            <div className="hidden md:flex items-center bg-slate-800 rounded-lg p-0.5">
              {(
                [
                  { key: "current_month", label: "This Month" },
                  { key: "current_quarter", label: "Quarter" },
                  { key: "financial_year", label: "FY" },
                  { key: "all_time", label: "All Time" },
                ] as { key: DashboardPeriod; label: string }[]
              ).map((opt) => (
                <button
                  key={opt.key}
                  onClick={() => setPeriod(opt.key)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
                    period === opt.key
                      ? "bg-emerald-500 text-white shadow-sm"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-800 px-3 py-1.5 rounded-lg">
                <Calendar className="h-3.5 w-3.5" />
                <span>{periodLabel}</span>
              </div>
              <NotificationDropdown />
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="px-3 py-1.5 text-xs font-medium text-slate-300 bg-slate-800 rounded-lg hover:bg-slate-700 transition-colors"
              >
                Logout
              </Link>
            </div>
          </div>

          {/* Mobile period selector */}
          <div className="md:hidden pb-3 flex gap-1 overflow-x-auto">
            {(
              [
                { key: "current_month", label: "This Month" },
                { key: "current_quarter", label: "Quarter" },
                { key: "financial_year", label: "FY" },
                { key: "all_time", label: "All" },
              ] as { key: DashboardPeriod; label: string }[]
            ).map((opt) => (
              <button
                key={opt.key}
                onClick={() => setPeriod(opt.key)}
                className={`px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap transition-all ${
                  period === opt.key
                    ? "bg-emerald-500 text-white"
                    : "text-slate-400 bg-slate-800"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* ═══ LOADING STATE ══════════════════════════════════════════ */}
        {isLoadingCriticalData ? (
          <div className="flex flex-col items-center justify-center py-24">
            <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-3" />
            <p className="text-sm text-slate-500">Loading dashboard data…</p>
          </div>
        ) : (
          <>
            {/* ═══ FINANCIAL KPIs (Senior Admin only) ════════════════ */}
            {user?.role === ROLES.SENIOR_ADMIN && (
              <section>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* Revenue */}
                  <FinancialKPICard
                    label="Total Revenue"
                    value={totalRevenue}
                    change={revenueChange}
                    accent="emerald"
                    icon={<TrendingUp className="h-5 w-5" />}
                  />
                  {/* Expenses */}
                  <FinancialKPICard
                    label="Total Expenses"
                    value={totalExpenses}
                    change={expensesChange}
                    accent="slate"
                    icon={<TrendingDown className="h-5 w-5" />}
                    invertTrend
                  />
                  {/* Net Profit */}
                  <FinancialKPICard
                    label="Net Profit"
                    value={netProfit}
                    change={netProfitChange}
                    accent="blue"
                    icon={<Wallet className="h-5 w-5" />}
                  />
                  {/* Profit Margin */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Profit Margin</span>
                      <div className="w-8 h-8 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                        <Percent className="h-5 w-5" />
                      </div>
                    </div>
                    <p className={`text-3xl font-bold tracking-tight ${profitMargin >= 0 ? "text-slate-900" : "text-red-600"}`}>
                      {profitMargin.toFixed(1)}%
                    </p>
                    <TrendBadge change={profitMarginChange} />
                  </div>
                </div>

                {/* Revenue & Expense Breakdown */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
                  {/* Revenue Breakdown */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      Revenue Sources
                    </h3>
                    <div className="space-y-3">
                      <BreakdownRow label="Invoice Revenue" value={invoiceRevenue} total={totalRevenue} color="bg-emerald-500" />
                      <BreakdownRow label="Alternative Revenue" value={alternativeRevenueTotal} total={totalRevenue} color="bg-teal-400" />
                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">Total Revenue</span>
                        <span className="text-sm font-bold text-emerald-600">R{totalRevenue.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Expense Breakdown */}
                  <div className="bg-white rounded-xl border border-slate-200 p-5">
                    <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-slate-500" />
                      Expense Breakdown
                    </h3>
                    <div className="space-y-3">
                      <BreakdownRow label="Material Costs" value={materialCosts} total={totalExpenses} color="bg-slate-500" />
                      <BreakdownRow label="Labour Costs" value={labourCosts} total={totalExpenses} color="bg-slate-400" />
                      <BreakdownRow label="Artisan Payments" value={artisanPayments} total={totalExpenses} color="bg-blue-400" />
                      <BreakdownRow label="Operational Expenses" value={operationalExpenseTotal} total={totalExpenses} color="bg-amber-400" />
                      <div className="pt-3 border-t border-slate-100 flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-700">Total Expenses</span>
                        <span className="text-sm font-bold text-slate-600">R{totalExpenses.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* ═══ OPERATIONAL OVERVIEW ═══════════════════════════════ */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Operational Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                <OperationalCard label="New Leads" value={newLeads} icon={<TrendingUp className="h-4 w-4" />} color="text-blue-600" bg="bg-blue-50" />
                <OperationalCard label="Active Jobs" value={activeOrders} icon={<Clock className="h-4 w-4" />} color="text-amber-600" bg="bg-amber-50" />
                <OperationalCard label="Completed" value={completedOrders} icon={<CheckCircle className="h-4 w-4" />} color="text-emerald-600" bg="bg-emerald-50" />
                <OperationalCard label="Work in Progress" value={workInProgress} icon={<ClipboardList className="h-4 w-4" />} color="text-violet-600" bg="bg-violet-50" />
                <OperationalCard label="Pending Quotes" value={pendingQuotations} icon={<FileText className="h-4 w-4" />} color="text-orange-600" bg="bg-orange-50" />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 mt-3">
                <OperationalCard label="Overdue Invoices" value={overdueInvoices} icon={<AlertCircle className="h-4 w-4" />} color="text-red-600" bg="bg-red-50" alert={overdueInvoices > 0} />
                <OperationalCard label="Paid Invoices" value={paidInvoicesCount} icon={<CheckCircle className="h-4 w-4" />} color="text-emerald-600" bg="bg-emerald-50" />
                <OperationalCard label="Outstanding Payments" value={outstandingPaymentRequests} icon={<Wallet className="h-4 w-4" />} color="text-amber-600" bg="bg-amber-50" />
                <OperationalCard label="Active Projects" value={activeProjects} icon={<FolderKanban className="h-4 w-4" />} color="text-violet-600" bg="bg-violet-50" />
              </div>
            </section>

            {/* ═══ QUICK ACCESS MODULES ═══════════════════════════════ */}
            <section>
              <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">
                Quick Access
              </h2>
              <div className="space-y-5">
                {Object.entries(modulesByGroup).map(([group, modules]) => {
                  if (modules.length === 0) return null;
                  return (
                    <div key={group}>
                      <h3 className="text-xs font-medium text-slate-400 uppercase tracking-wider mb-2 pl-1">
                        {groupLabels[group]}
                      </h3>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                        {modules.map((mod) => (
                          <Link
                            key={mod.title}
                            to={mod.href}
                            className="group relative bg-white rounded-xl border border-slate-200 p-4 hover:border-slate-300 hover:shadow-md transition-all duration-200 flex items-start gap-3"
                          >
                            <div className={`w-10 h-10 ${mod.accent} rounded-lg flex items-center justify-center text-white flex-shrink-0`}>
                              <mod.icon className="h-5 w-5" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <h4 className="text-sm font-semibold text-slate-800 group-hover:text-emerald-600 transition-colors">
                                {mod.title}
                              </h4>
                              <p className="text-xs text-slate-500 mt-0.5">{mod.description}</p>
                              <p className="text-xs font-medium text-slate-400 mt-1.5">{mod.stats}</p>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-slate-300 group-hover:text-emerald-500 transition-colors flex-shrink-0 mt-0.5" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* ═══ ANALYTICS ══════════════════════════════════════════ */}
            {hasPermission("VIEW_DASHBOARD_ANALYTICS") && (
              <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                <button
                  onClick={() => setShowAnalytics(!showAnalytics)}
                  className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-slate-500" />
                    <h2 className="text-sm font-semibold text-slate-700">Analytics & Trends</h2>
                  </div>
                  <ChevronDown
                    className={`h-4 w-4 text-slate-400 transition-transform ${showAnalytics ? "rotate-180" : ""}`}
                  />
                </button>
                {showAnalytics && (
                  <div className="px-5 pb-5 space-y-6 border-t border-slate-100 pt-4">
                    <RevenueComparisonChart
                      dailyData={revenueAnalyticsDailyQuery.data || []}
                      weeklyData={revenueAnalyticsWeeklyQuery.data || []}
                      monthlyData={revenueAnalyticsMonthlyQuery.data || []}
                      isLoading={
                        revenueAnalyticsDailyQuery.isLoading ||
                        revenueAnalyticsWeeklyQuery.isLoading ||
                        revenueAnalyticsMonthlyQuery.isLoading
                      }
                    />
                    <PopularServicesChart
                      data={serviceAnalyticsQuery.data || []}
                      isLoading={serviceAnalyticsQuery.isLoading}
                    />
                    <CustomerTrendsChart
                      dailyData={customerAnalyticsDailyQuery.data || []}
                      weeklyData={customerAnalyticsWeeklyQuery.data || []}
                      monthlyData={customerAnalyticsMonthlyQuery.data || []}
                      isLoading={
                        customerAnalyticsDailyQuery.isLoading ||
                        customerAnalyticsWeeklyQuery.isLoading ||
                        customerAnalyticsMonthlyQuery.isLoading
                      }
                    />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      <BudgetUtilizationTrendChart
                        data={budgetUtilizationData}
                        isLoading={metricSnapshotsQuery.isLoading}
                      />
                      <CompletionRateTrendChart
                        data={completionRateData}
                        isLoading={metricSnapshotsQuery.isLoading}
                      />
                    </div>
                    <ProjectHealthTrendChart
                      data={projectHealthData}
                      isLoading={metricSnapshotsQuery.isLoading}
                    />
                  </div>
                )}
              </section>
            )}

            {/* ═══ RECENT ORDERS ═══════════════════════════════════════ */}
            <section className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100">
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Clock className="h-4 w-4 text-slate-400" />
                  Recent Orders
                </h2>
              </div>
              <div className="divide-y divide-slate-100">
                {orders.slice(0, 5).map((order) => (
                  <div
                    key={order.id}
                    className="px-5 py-3.5 hover:bg-slate-50 transition-colors flex items-center justify-between gap-4"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-800 truncate">{order.orderNumber}</p>
                      <p className="text-xs text-slate-500 truncate">{order.customerName}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wider ${
                          order.status === "COMPLETED"
                            ? "bg-emerald-50 text-emerald-700"
                            : order.status === "IN_PROGRESS"
                            ? "bg-blue-50 text-blue-700"
                            : order.status === "ASSIGNED"
                            ? "bg-amber-50 text-amber-700"
                            : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {order.status.replace("_", " ")}
                      </span>
                      <div className="text-right">
                        <p className="text-xs text-slate-400">Cost</p>
                        <p className="text-sm font-semibold text-slate-700">
                          R{(order.totalCost ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="px-5 py-12 text-center">
                    <AlertCircle className="mx-auto h-10 w-10 text-slate-300" />
                    <p className="mt-2 text-sm text-slate-500">No orders yet</p>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* Chat Widgets */}
      <SupportChatWidget />
      <AIAgentChatWidget />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════
   SUB-COMPONENTS
   ═══════════════════════════════════════════════════════════════════════ */

function FinancialKPICard({
  label,
  value,
  change,
  accent,
  icon,
  invertTrend = false,
}: {
  label: string;
  value: number;
  change: { change: string; trend: "up" | "down" | "neutral" };
  accent: "emerald" | "slate" | "blue" | "indigo";
  icon: React.ReactNode;
  invertTrend?: boolean;
}) {
  const accentMap = {
    emerald: { bg: "bg-emerald-50", text: "text-emerald-600" },
    slate: { bg: "bg-slate-100", text: "text-slate-600" },
    blue: { bg: "bg-blue-50", text: "text-blue-600" },
    indigo: { bg: "bg-indigo-50", text: "text-indigo-600" },
  };
  const scheme = accentMap[accent];

  return (
    <div className="bg-white rounded-xl border border-slate-200 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{label}</span>
        <div className={`w-8 h-8 ${scheme.bg} rounded-lg flex items-center justify-center ${scheme.text}`}>
          {icon}
        </div>
      </div>
      <p className={`text-3xl font-bold tracking-tight ${value >= 0 ? "text-slate-900" : "text-red-600"}`}>
        R{Math.abs(value).toLocaleString()}
      </p>
      <TrendBadge change={change} invert={invertTrend} />
    </div>
  );
}

function TrendBadge({
  change,
  invert = false,
}: {
  change: { change: string; trend: "up" | "down" | "neutral" };
  invert?: boolean;
}) {
  const effectiveTrend = invert
    ? change.trend === "up" ? "down" : change.trend === "down" ? "up" : "neutral"
    : change.trend;

  const colors =
    effectiveTrend === "up"
      ? "text-emerald-600 bg-emerald-50"
      : effectiveTrend === "down"
      ? "text-red-600 bg-red-50"
      : "text-slate-500 bg-slate-50";

  const Icon = change.trend === "up" ? ArrowUpRight : change.trend === "down" ? ArrowDownRight : Minus;

  return (
    <div className={`inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${colors}`}>
      <Icon className="h-3 w-3" />
      <span>{change.change}</span>
    </div>
  );
}

function BreakdownRow({
  label,
  value,
  total,
  color,
}: {
  label: string;
  value: number;
  total: number;
  color: string;
}) {
  const pct = total > 0 ? (value / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs text-slate-600">{label}</span>
        <span className="text-xs font-semibold text-slate-700">R{value.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${color} rounded-full transition-all duration-500`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function OperationalCard({
  label,
  value,
  icon,
  color,
  bg,
  alert = false,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  color: string;
  bg: string;
  alert?: boolean;
}) {
  return (
    <div className={`bg-white rounded-xl border ${alert ? "border-red-200" : "border-slate-200"} p-4 hover:shadow-sm transition-shadow`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-7 h-7 ${bg} rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-slate-500 truncate">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-slate-800"}`}>{value}</p>
    </div>
  );
}
