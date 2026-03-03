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

// All admin-side roles that should access the dashboard
const ADMIN_DASHBOARD_ROLES = new Set([
  ROLES.ADMIN,
  ROLES.SENIOR_ADMIN,
  ROLES.JUNIOR_ADMIN,
  ROLES.MANAGER,
  ROLES.TECHNICAL_MANAGER,
  ROLES.ACCOUNTANT,
  ROLES.SUPERVISOR,
  ROLES.SALES_AGENT,
]);

export const Route = createFileRoute("/admin/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || !ADMIN_DASHBOARD_ROLES.has(user.role as any)) {
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
  const [showFinancials, setShowFinancials] = useState(true);
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
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : (totalExpenses > 0 ? -100 : 0);

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

  // ── Quick Access cards (flat, original style) ────────────────────
  const dashboardCards = [
    { title: "CRM", description: "Manage sales leads and customer relationships", icon: Users, href: "/admin/crm", color: "from-blue-500 to-blue-600", stats: `${newLeads} new leads` },
    { title: "Operations", description: "Track and manage work orders", icon: ClipboardList, href: "/admin/operations", color: "from-green-500 to-green-600", stats: `${activeOrders} active jobs` },
    { title: "Messages", description: "Communicate with customers and artisans", icon: MessageSquare, href: "/messages", color: "from-teal-500 to-teal-600", stats: `${unreadConversations.length} unread` },
    { title: "Projects", description: "Oversee development projects", icon: FolderKanban, href: "/admin/projects", color: "from-purple-500 to-purple-600", stats: `${activeProjects} active projects` },
    { title: "Quotations", description: "Create and manage quotes", icon: FileText, href: "/admin/quotations", color: "from-orange-500 to-orange-600", stats: `${pendingQuotations} pending quotes` },
    { title: "Invoices", description: "Track payments and billing", icon: Receipt, href: "/admin/invoices", color: "from-red-500 to-red-600", stats: `${unpaidInvoices} unpaid invoices` },
    { title: "Statements", description: "Customer billing statements with age analysis", icon: FileText, href: "/admin/statements", color: "from-purple-500 to-purple-600", stats: "Automated statement generation" },
    { title: "Management Accounts", description: "Financial reports and analytics", icon: DollarSign, href: "/admin/accounts", color: "from-teal-500 to-teal-600", stats: `R${(totalRevenue ?? 0).toLocaleString()} revenue`, permission: "VIEW_ACCOUNTS" as Permission },
    { title: "Assets", description: "Manage company assets", icon: Package, href: "/admin/assets", color: "from-indigo-500 to-indigo-600", stats: `R${(totalAssetValue ?? 0).toLocaleString()} total value`, permission: "VIEW_ASSETS" as Permission },
    { title: "Liabilities", description: "Manage organizational debt and payables", icon: AlertTriangle, href: "/admin/liabilities", color: "from-red-500 to-red-600", stats: `R${(unpaidLiabilitiesAmount ?? 0).toLocaleString()} unpaid`, permission: "VIEW_LIABILITIES" as Permission },
    { title: "Payment Requests", description: "Review artisan payment requests", icon: CreditCard, href: "/admin/payment-requests", color: "from-pink-500 to-pink-600", stats: `${pendingPaymentRequests} pending requests`, permission: "VIEW_PAYMENT_REQUESTS" as Permission },
    { title: "HR Tool", description: "Employee management, KPIs, and leave tracking", icon: UserCircle2, href: "/admin/hr", color: "from-violet-500 to-violet-600", stats: `${employees.length} total employees`, permission: "VIEW_ALL_EMPLOYEES" as Permission },
    { title: "AI Agent", description: "Your intelligent business assistant", icon: Bot, href: "/admin/ai-agent", color: "from-cyan-500 to-cyan-600", stats: "27 tools available" },
    { title: "Contractor Management", description: "Onboard and manage contractors", icon: Users, href: "/admin/contractor-management", color: "from-blue-500 to-blue-600", stats: "Admin tool", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Property Management", description: "Onboard and manage property managers", icon: FolderKanban, href: "/admin/property-management", color: "from-emerald-500 to-emerald-600", stats: "Admin tool", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Subscriptions", description: "Manage user subscriptions and packages", icon: Package, href: "/admin/subscriptions", color: "from-yellow-500 to-yellow-600", stats: "Admin tool", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Registrations", description: "Review and approve new account requests", icon: ClipboardList, href: "/admin/registrations", color: "from-yellow-500 to-yellow-600", stats: "Admin tool", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
    { title: "Settings", description: "Manage company branding and settings", icon: Settings, href: "/admin/settings", color: "from-gray-500 to-gray-600", stats: user?.role === "SENIOR_ADMIN" ? "Admin access" : "View only", permission: "MANAGE_SYSTEM_SETTINGS" as Permission },
  ];

  const isDemoJuniorAdmin = user?.role === "JUNIOR_ADMIN" && user?.email === "junior@propmanagement.com";

  const filteredDashboardCards = dashboardCards.filter((card) => {
    if (card.permission && !hasPermission(card.permission)) return false;
    if ((card.title === "Subscriptions" || card.title === "Registrations") && isDemoJuniorAdmin) return false;
    return true;
  });

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* ═══ HEADER ═══════════════════════════════════════════════════ */}
      <header
        className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 shadow-lg"
        style={{ position: "sticky", top: 0, zIndex: 9999 }}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Left: Title */}
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl">
                <LayoutDashboard className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white leading-tight">Admin Dashboard</h1>
                <p className="text-sm text-indigo-100">Welcome back, {user?.firstName}!</p>
              </div>
            </div>

            {/* Center: Period selector */}
            <div className="hidden md:flex items-center bg-white/10 backdrop-blur-sm rounded-lg p-0.5">
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
                      ? "bg-white text-indigo-700 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="hidden sm:flex items-center gap-1.5 text-xs text-indigo-100 bg-white/10 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                <Calendar className="h-3.5 w-3.5" />
                <span>{periodLabel}</span>
              </div>
              <NotificationDropdown />
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="flex-1 sm:flex-initial px-4 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 text-center transition-all duration-200"
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
                    ? "bg-white text-indigo-700"
                    : "text-white/70 bg-white/10"
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
            {/* ═══ FINANCIAL KPIs (Senior Admin only) — Collapsible ═ */}
            {user?.role === ROLES.SENIOR_ADMIN && (
              <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <button
                  onClick={() => setShowFinancials(!showFinancials)}
                  className="flex items-center justify-between w-full px-6 py-4 text-left hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-indigo-500" />
                    <h2 className="text-base font-semibold text-gray-900">Financial Overview</h2>
                    <span className="text-xs text-gray-400 ml-2">({periodLabel})</span>
                  </div>
                  <ChevronDown
                    className={`h-5 w-5 text-gray-400 transition-transform ${showFinancials ? "rotate-180" : ""}`}
                  />
                </button>
                {showFinancials && (
                  <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
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
                        accent="orange"
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
                      <div className={`bg-gradient-to-br ${netProfit < 0 ? "from-red-600 to-rose-700" : "from-indigo-500 to-purple-600"} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-xs font-medium uppercase tracking-wider text-white/80">Profit Margin</span>
                          <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
                            <Percent className="h-5 w-5" />
                          </div>
                        </div>
                        <p className="text-3xl font-bold tracking-tight">
                          {profitMargin.toFixed(1)}%
                        </p>
                        <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20">
                          {profitMarginChange.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : profitMarginChange.trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                          <span>{profitMarginChange.change}</span>
                        </div>
                      </div>
                    </div>

                    {/* Revenue & Expense Breakdown */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {/* Revenue Breakdown */}
                      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                          Revenue Sources
                        </h3>
                        <div className="space-y-3">
                          <BreakdownRow label="Invoice Revenue" value={invoiceRevenue} total={totalRevenue} color="bg-emerald-500" />
                          <BreakdownRow label="Alternative Revenue" value={alternativeRevenueTotal} total={totalRevenue} color="bg-teal-400" />
                          <div className="pt-3 border-t border-emerald-200/50 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700">Total Revenue</span>
                            <span className="text-sm font-bold text-emerald-600">R{totalRevenue.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>

                      {/* Expense Breakdown */}
                      <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-xl border border-orange-100 p-5">
                        <h3 className="text-sm font-semibold text-gray-800 mb-4 flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full bg-orange-500" />
                          Expense Breakdown
                        </h3>
                        <div className="space-y-3">
                          <BreakdownRow label="Material Costs" value={materialCosts} total={totalExpenses} color="bg-orange-500" />
                          <BreakdownRow label="Labour Costs" value={labourCosts} total={totalExpenses} color="bg-amber-400" />
                          <BreakdownRow label="Artisan Payments" value={artisanPayments} total={totalExpenses} color="bg-blue-400" />
                          <BreakdownRow label="Operational Expenses" value={operationalExpenseTotal} total={totalExpenses} color="bg-purple-400" />
                          <div className="pt-3 border-t border-orange-200/50 flex justify-between items-center">
                            <span className="text-sm font-semibold text-gray-700">Total Expenses</span>
                            <span className="text-sm font-bold text-orange-600">R{totalExpenses.toLocaleString()}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* ═══ OPERATIONAL METRICS ════════════════════════════════ */}
            <div className="mb-2">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <OperationalCard label="New Leads" value={newLeads} icon={<TrendingUp className="h-4 w-4" />} color="text-blue-600" bg="bg-blue-50" />
                <OperationalCard label="Active Jobs" value={activeOrders} icon={<Clock className="h-4 w-4" />} color="text-orange-600" bg="bg-orange-50" />
                <OperationalCard label="Completed" value={completedOrders} icon={<CheckCircle className="h-4 w-4" />} color="text-green-600" bg="bg-green-50" />
                <OperationalCard label="Work in Progress" value={workInProgress} icon={<ClipboardList className="h-4 w-4" />} color="text-purple-600" bg="bg-purple-50" />
                <OperationalCard label="Pending Quotes" value={pendingQuotations} icon={<FileText className="h-4 w-4" />} color="text-amber-600" bg="bg-amber-50" />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mt-4">
                <OperationalCard label="Overdue Invoices" value={overdueInvoices} icon={<AlertCircle className="h-4 w-4" />} color="text-red-600" bg="bg-red-50" alert={overdueInvoices > 0} />
                <OperationalCard label="Paid Invoices" value={paidInvoicesCount} icon={<CheckCircle className="h-4 w-4" />} color="text-green-600" bg="bg-green-50" />
                <OperationalCard label="Outstanding Payments" value={outstandingPaymentRequests} icon={<Wallet className="h-4 w-4" />} color="text-amber-600" bg="bg-amber-50" />
                <OperationalCard label="Active Projects" value={activeProjects} icon={<FolderKanban className="h-4 w-4" />} color="text-violet-600" bg="bg-violet-50" />
              </div>
            </div>

            {/* ═══ QUICK ACCESS — FLAT GRID ═══════════════════════════ */}
            <div className="mb-8">
              <h2 className="text-base sm:text-lg font-semibold text-gray-900 mb-4">Quick Access</h2>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {filteredDashboardCards.map((card) => (
                  <Link
                    key={card.title}
                    to={card.href}
                    className="group relative bg-white p-6 rounded-xl shadow-sm border border-gray-200 hover:shadow-lg transition-all duration-200 hover:-translate-y-1"
                  >
                    <div>
                      <span
                        className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${card.color} text-white shadow-md`}
                      >
                        <card.icon className="h-6 w-6" aria-hidden="true" />
                      </span>
                    </div>
                    <div className="mt-4">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
                        {card.title}
                      </h3>
                      <p className="mt-2 text-xs sm:text-sm text-gray-600">{card.description}</p>
                      <p className="mt-3 text-xs font-medium text-gray-500">{card.stats}</p>
                    </div>
                    <span
                      className="absolute top-6 right-6 text-gray-300 group-hover:text-blue-500 transition-colors"
                      aria-hidden="true"
                    >
                      <svg className="h-6 w-6" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M20 4h1a1 1 0 00-1-1v1zm-1 12a1 1 0 102 0h-2zM8 3a1 1 0 000 2V3zM3.293 19.293a1 1 0 101.414 1.414l-1.414-1.414zM19 4v12h2V4h-2zm1-1H8v2h12V3zm-.707.293l-16 16 1.414 1.414 16-16-1.414-1.414z" />
                      </svg>
                    </span>
                  </Link>
                ))}
              </div>
            </div>

            {/* ═══ ANALYTICS ══════════════════════════════════════════ */}
            {hasPermission("VIEW_DASHBOARD_ANALYTICS") && (
              <div className="mb-8 bg-white shadow-sm rounded-xl border border-gray-200">
                <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                  <button
                    onClick={() => setShowAnalytics(!showAnalytics)}
                    className="flex items-center justify-between w-full text-left"
                  >
                    <h2 className="text-base sm:text-lg font-semibold text-gray-900">Analytics Overview</h2>
                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        showAnalytics ? "rotate-180" : ""
                      }`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 9l-7 7-7-7"
                      />
                    </svg>
                  </button>
                </div>
                {showAnalytics && (
                  <div className="p-4 sm:p-6 space-y-6">
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
              </div>
            )}

            {/* ═══ RECENT ORDERS ═══════════════════════════════════════ */}
            <div className="bg-white shadow-sm rounded-xl border border-gray-200">
              <div className="px-4 sm:px-6 py-4 sm:py-5 border-b border-gray-200">
                <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Orders</h2>
              </div>
              <div className="divide-y divide-gray-200">
                {orders.slice(0, 5).map((order) => (
                  <div key={order.id} className="px-4 sm:px-6 py-3 sm:py-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{order.orderNumber}</p>
                        <p className="text-xs sm:text-sm text-gray-600 truncate">{order.customerName}</p>
                      </div>
                      <div className="flex items-center justify-between sm:justify-end space-x-3 sm:space-x-4">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                            order.status === "COMPLETED"
                              ? "bg-green-100 text-green-800"
                              : order.status === "IN_PROGRESS"
                              ? "bg-blue-100 text-blue-800"
                              : order.status === "ASSIGNED"
                              ? "bg-yellow-100 text-yellow-800"
                              : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {order.status.replace("_", " ")}
                        </span>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Internal Cost</p>
                          <p className="text-sm font-medium text-gray-900">
                            R{(order.totalCost ?? 0).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="px-6 py-8 text-center">
                    <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
                    <p className="mt-2 text-sm text-gray-600">No orders yet</p>
                  </div>
                )}
              </div>
            </div>
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
  accent: "emerald" | "orange" | "blue" | "indigo";
  icon: React.ReactNode;
  invertTrend?: boolean;
}) {
  const accentMap = {
    emerald: { gradient: "from-emerald-500 to-green-600" },
    orange: { gradient: "from-orange-500 to-red-500" },
    blue: { gradient: "from-blue-500 to-indigo-600" },
    indigo: { gradient: "from-indigo-500 to-purple-600" },
    loss: { gradient: "from-red-600 to-rose-700" },
  };
  // Use loss gradient when value is negative (e.g. net profit is a loss)
  const isLoss = value < 0;
  const scheme = isLoss ? accentMap.loss : accentMap[accent];

  return (
    <div className={`bg-gradient-to-br ${scheme.gradient} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium uppercase tracking-wider text-white/80">{label}</span>
        <div className="w-8 h-8 bg-white/20 backdrop-blur-sm rounded-lg flex items-center justify-center">
          {icon}
        </div>
      </div>
      <p className="text-3xl font-bold tracking-tight">
        {value < 0 ? "-" : ""}R{Math.abs(value).toLocaleString()}
      </p>
      <div className="inline-flex items-center gap-1 mt-2 px-2 py-0.5 rounded-full text-xs font-medium bg-white/20">
        {change.trend === "up" ? <ArrowUpRight className="h-3 w-3" /> : change.trend === "down" ? <ArrowDownRight className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
        <span>{change.change}</span>
      </div>
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
    <div className={`bg-white rounded-xl shadow-sm border ${alert ? "border-red-200" : "border-gray-200"} p-4 hover:shadow-md transition-all duration-200`}>
      <div className="flex items-center gap-2 mb-2">
        <div className={`w-8 h-8 ${bg} rounded-lg flex items-center justify-center ${color}`}>
          {icon}
        </div>
        <span className="text-xs font-medium text-gray-500 truncate">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${alert ? "text-red-600" : "text-gray-900"}`}>{value}</p>
    </div>
  );
}
