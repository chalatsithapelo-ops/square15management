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
} from "lucide-react";
import { SupportChatWidget } from "~/components/SupportChatWidget";
import { AIAgentChatWidget } from "~/components/AIAgentChatWidget";
import { RevenueComparisonChart } from "~/components/charts/RevenueComparisonChart";
import { PopularServicesChart } from "~/components/charts/PopularServicesChart";
import { CustomerTrendsChart } from "~/components/charts/CustomerTrendsChart";
import { BudgetUtilizationTrendChart } from "~/components/charts/BudgetUtilizationTrendChart";
import { CompletionRateTrendChart } from "~/components/charts/CompletionRateTrendChart";
import { ProjectHealthTrendChart } from "~/components/charts/ProjectHealthTrendChart";
import { MetricCard } from "~/components/MetricCard";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { useState } from "react";
import { ROLES } from "~/utils/roles";
import type { Permission } from "~/server/utils/permissions";

export const Route = createFileRoute("/admin/dashboard/")({
  beforeLoad: ({ location }) => {
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

  const dashboardQueryDefaults = {
    enabled: !!token,
    refetchOnWindowFocus: false,
    refetchInterval: false as const,
    staleTime: 30000,
    retry: 1,
  };

  const userPermissionsQuery = useQuery({
    ...trpc.getUserPermissions.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const userPermissions = userPermissionsQuery.data?.permissions || [];
  
  const hasPermission = (permission: Permission) => {
    return userPermissions.includes(permission);
  };

  const leadsQuery = useQuery({
    ...trpc.getLeads.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const ordersQuery = useQuery({
    ...trpc.getOrders.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const projectsQuery = useQuery({
    ...trpc.getProjects.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const quotationsQuery = useQuery({
    ...trpc.getQuotations.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const invoicesQuery = useQuery({
    ...trpc.getInvoices.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const assetsQuery = useQuery({
    ...trpc.getAssets.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const paymentRequestsQuery = useQuery({
    ...trpc.getPaymentRequests.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const liabilitiesQuery = useQuery({
    ...trpc.getLiabilities.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const conversationsQuery = useQuery({
    ...trpc.getConversations.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const employeesQuery = useQuery({
    ...trpc.getEmployees.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const operationalExpensesQuery = useQuery({
    ...trpc.getOperationalExpenses.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const alternativeRevenuesQuery = useQuery({
    ...trpc.getAlternativeRevenues.queryOptions({
      token: token!,
    }),
    ...dashboardQueryDefaults,
  });

  const metricSnapshotsQuery = useQuery({
    ...trpc.getMetricSnapshots.queryOptions({
      token: token!,
      metricType: "DAILY",
      limit: 30,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  // Fetch analytics data for the last 90 days
  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const analyticsStartDate = ninetyDaysAgo.toISOString().split('T')[0];
  const analyticsEndDate = new Date().toISOString().split('T')[0];

  const revenueAnalyticsDailyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "DAILY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const revenueAnalyticsWeeklyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "WEEKLY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const revenueAnalyticsMonthlyQuery = useQuery({
    ...trpc.getRevenueAnalytics.queryOptions({
      token: token!,
      periodType: "MONTHLY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const serviceAnalyticsQuery = useQuery({
    ...trpc.getServiceAnalytics.queryOptions({
      token: token!,
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
      limit: 8,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const customerAnalyticsDailyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "DAILY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const customerAnalyticsWeeklyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "WEEKLY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

  const customerAnalyticsMonthlyQuery = useQuery({
    ...trpc.getCustomerAnalytics.queryOptions({
      token: token!,
      periodType: "MONTHLY",
      startDate: analyticsStartDate,
      endDate: analyticsEndDate,
    }),
    ...dashboardQueryDefaults,
    enabled: !!token && showAnalytics,
  });

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

  // Check if critical data is still loading
  const isLoadingCriticalData = 
    leadsQuery.isLoading || 
    ordersQuery.isLoading || 
    projectsQuery.isLoading || 
    invoicesQuery.isLoading;

  // Calculate metrics only when data is available
  const newLeads = leadsQuery.data ? leads.filter((l) => l.status === "NEW").length : 0;
  const activeOrders = ordersQuery.data ? orders.filter(
    (o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED"
  ).length : 0;
  const completedOrders = ordersQuery.data ? orders.filter((o) => o.status === "COMPLETED").length : 0;
  
  // Revenue comes from paid invoices (what clients actually pay) + approved alternative revenues
  // Order totalCost represents internal company costs, not revenue
  const invoiceRevenue = invoicesQuery.data ? invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + (i.total ?? 0), 0) : 0;
  
  const alternativeRevenueTotal = alternativeRevenuesQuery.data ? alternativeRevenues
    .filter((r) => r.isApproved === true)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0) : 0;
  
  const totalRevenue = invoiceRevenue + alternativeRevenueTotal;
  
  // (Debug logging removed to reduce noisy rerenders in production)

  // Calculate metrics for new features
  const activeProjects = projectsQuery.data ? projects.filter(
    (p) => p.status === "IN_PROGRESS" || p.status === "PLANNING"
  ).length : 0;
  const pendingQuotations = quotationsQuery.data
    ? quotations.filter((q: any) =>
        [
          "PENDING_ARTISAN_REVIEW",
          "PENDING_JUNIOR_MANAGER_REVIEW",
          "PENDING_SENIOR_MANAGER_REVIEW",
          "SENT_TO_CUSTOMER",
          "SUBMITTED", // legacy/old data
        ].includes(q.status)
      ).length
    : 0;
  const unpaidInvoices = invoicesQuery.data ? invoices.filter(
    (i) => i.status === "SENT" || i.status === "OVERDUE"
  ).length : 0;
  const totalAssetValue = assetsQuery.data ? assets.reduce((sum, a) => sum + (a.currentValue ?? 0), 0) : 0;
  const pendingPaymentRequests = paymentRequestsQuery.data ? paymentRequests.filter((pr) => pr.status === "PENDING").length : 0;
  const outstandingPaymentRequests = paymentRequestsQuery.data ? paymentRequests.filter(
    (pr) => pr.status === "PENDING" || pr.status === "APPROVED"
  ).length : 0;
  const unpaidLiabilitiesAmount = liabilitiesQuery.data ? liabilities
    .filter((l) => !l.isPaid)
    .reduce((sum, l) => sum + (l.amount ?? 0), 0) : 0;

  // Calculate new business parameters
  const overdueInvoices = invoicesQuery.data ? invoices.filter((i) => i.status === "OVERDUE").length : 0;
  const paidInvoices = invoicesQuery.data ? invoices.filter((i) => i.status === "PAID").length : 0;
  
  // Work in Progress = Active Orders + Active Projects
  const workInProgress = activeOrders + activeProjects;
  
  // Calculate expenses from real-time data (matching Management Accounts logic)
  // Order costs (internal company costs for materials and labour)
  const orderMaterialCosts = ordersQuery.data ? orders.reduce((sum, o) => sum + (o.materialCost ?? 0), 0) : 0;
  const orderLabourCosts = ordersQuery.data ? orders.reduce((sum, o) => sum + (o.labourCost ?? 0), 0) : 0;
  
  // Invoice costs (company's actual material and labour costs)
  const invoiceMaterialCosts = invoicesQuery.data ? invoices.reduce((sum, i) => sum + (i.companyMaterialCost ?? 0), 0) : 0;
  const invoiceLabourCosts = invoicesQuery.data ? invoices.reduce((sum, i) => sum + (i.companyLabourCost ?? 0), 0) : 0;
  
  // Artisan payments (actual paid amounts to artisans)
  const artisanPayments = paymentRequestsQuery.data ? paymentRequests
    .filter((pr) => pr.status === "PAID")
    .reduce((sum, pr) => sum + (pr.calculatedAmount ?? 0), 0) : 0;
  
  // Operational expenses (approved expenses like fuel, office supplies, etc.)
  const operationalExpenseTotal = operationalExpensesQuery.data ? operationalExpenses
    .filter((e) => e.isApproved === true)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0) : 0;
  
  // Total expenses = all material costs + all labour costs + artisan payments + operational expenses
  const totalExpenses = orderMaterialCosts + orderLabourCosts + invoiceMaterialCosts + invoiceLabourCosts + artisanPayments + operationalExpenseTotal;
  
  // Debug logging for expenses
  console.log('[Admin Dashboard] Expense Calculations:', {
    orderMaterialCosts,
    orderLabourCosts,
    invoiceMaterialCosts,
    invoiceLabourCosts,
    artisanPayments,
    operationalExpenseTotal,
    totalExpenses,
  });
  
  // Calculate net profit (revenue - expenses)
  const netProfit = totalRevenue - totalExpenses;
  
  // Calculate profit margin as percentage of revenue
  const profitMargin = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100) : 0;

  // Helper function to calculate change and trend from snapshots
  const calculateMetricChange = (
    currentValue: number, 
    metricKey: "totalRevenue" | "completedOrders" | "paidInvoices" | "totalExpenses" | "materialCosts" | "labourCosts" | "artisanPayments" | "netProfit" | "profitMargin" | "activeOrders" | "newLeads" | "totalAssets" | "totalLiabilities"
  ) => {
    if (metricSnapshots.length < 2) {
      return { change: "+0.0%", trend: "neutral" as const };
    }

    // Get the most recent snapshot (excluding today if it exists)
    const sortedSnapshots = [...metricSnapshots].sort(
      (a, b) => new Date(b.snapshotDate).getTime() - new Date(a.snapshotDate).getTime()
    );

    // Find the previous value
    const previousSnapshot = sortedSnapshots.find((s) => {
      const snapshotValue = s[metricKey] as number;
      return snapshotValue !== currentValue;
    });

    if (!previousSnapshot) {
      return { change: "+0.0%", trend: "neutral" as const };
    }

    const previousValue = previousSnapshot[metricKey] as number;
    
    if (previousValue === 0) {
      return { 
        change: currentValue > 0 ? "+100%" : "+0.0%", 
        trend: currentValue > 0 ? "up" as const : "neutral" as const 
      };
    }

    const percentChange = ((currentValue - previousValue) / previousValue) * 100;
    const changeStr = `${percentChange >= 0 ? "+" : ""}${percentChange.toFixed(1)}%`;
    const trend = percentChange > 0 ? "up" as const : percentChange < 0 ? "down" as const : "neutral" as const;

    return { change: changeStr, trend };
  };

  const newLeadsChange = calculateMetricChange(newLeads, "newLeads");
  const activeOrdersChange = calculateMetricChange(activeOrders, "activeOrders");
  const revenueChange = calculateMetricChange(totalRevenue, "totalRevenue");
  // Overdue invoices not tracked in MetricSnapshot, so show neutral trend
  const overdueInvoicesChange = { change: "+0.0%", trend: "neutral" as const };
  const paidInvoicesChange = calculateMetricChange(paidInvoices, "paidInvoices");
  const workInProgressChange = calculateMetricChange(workInProgress, "activeOrders");
  const profitMarginChange = calculateMetricChange(profitMargin, "profitMargin");
  const expensesChange = calculateMetricChange(totalExpenses, "totalExpenses");
  const netProfitChange = calculateMetricChange(netProfit, "netProfit");

  // Prepare data for new time-series charts
  const budgetUtilizationData = metricSnapshots
    .map((snapshot) => ({
      period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
      budgetUtilizationPercentage: snapshot.budgetUtilizationPercentage || 0,
      totalProjectBudget: snapshot.totalProjectBudget || 0,
      totalProjectActualCost: snapshot.totalProjectActualCost || 0,
      projectsOverBudget: snapshot.projectsOverBudget || 0,
      date: new Date(snapshot.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const completionRateData = metricSnapshots
    .map((snapshot) => ({
      period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
      milestoneCompletionRate: snapshot.milestoneCompletionRate || 0,
      totalMilestones: snapshot.totalMilestones || 0,
      completedMilestones: snapshot.completedMilestones || 0,
      inProgressMilestones: snapshot.inProgressMilestones || 0,
      delayedMilestones: snapshot.delayedMilestones || 0,
      date: new Date(snapshot.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const projectHealthData = metricSnapshots
    .map((snapshot) => ({
      period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
      averageProjectHealthScore: snapshot.averageProjectHealthScore || 100,
      totalProjects: snapshot.totalProjects || 0,
      activeProjects: snapshot.activeProjects || 0,
      projectsAtRisk: snapshot.projectsAtRisk || 0,
      date: new Date(snapshot.snapshotDate),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  const dashboardCards = [
    {
      title: "CRM",
      description: "Manage sales leads and customer relationships",
      icon: Users,
      href: "/admin/crm",
      color: "from-blue-500 to-blue-600",
      stats: `${newLeads} new leads`,
    },
    {
      title: "Operations",
      description: "Track and manage work orders",
      icon: ClipboardList,
      href: "/admin/operations",
      color: "from-green-500 to-green-600",
      stats: `${activeOrders} active jobs`,
    },
    {
      title: "Messages",
      description: "Communicate with customers and artisans",
      icon: MessageSquare,
      href: "/messages",
      color: "from-green-500 to-green-600",
      stats: `${unreadConversations.length} unread`,
    },
    {
      title: "Projects",
      description: "Oversee development projects",
      icon: FolderKanban,
      href: "/admin/projects",
      color: "from-purple-500 to-purple-600",
      stats: `${activeProjects} active projects`,
    },
    {
      title: "Quotations",
      description: "Create and manage quotes",
      icon: FileText,
      href: "/admin/quotations",
      color: "from-orange-500 to-orange-600",
      stats: `${pendingQuotations} pending quotes`,
    },
    {
      title: "Invoices",
      description: "Track payments and billing",
      icon: Receipt,
      href: "/admin/invoices",
      color: "from-red-500 to-red-600",
      stats: `${unpaidInvoices} unpaid invoices`,
    },
    {
      title: "Statements",
      description: "Customer billing statements with age analysis",
      icon: FileText,
      href: "/admin/statements",
      color: "from-purple-500 to-purple-600",
      stats: "Automated statement generation",
    },
    {
      title: "Management Accounts",
      description: "Financial reports and analytics",
      icon: DollarSign,
      href: "/admin/accounts",
      color: "from-teal-500 to-teal-600",
      stats: `R${(totalRevenue ?? 0).toLocaleString()} revenue`,
    },
    {
      title: "Assets",
      description: "Manage company assets",
      icon: Package,
      href: "/admin/assets",
      color: "from-indigo-500 to-indigo-600",
      stats: `R${(totalAssetValue ?? 0).toLocaleString()} total value`,
    },
    {
      title: "Liabilities",
      description: "Manage organizational debt and payables",
      icon: AlertTriangle,
      href: "/admin/liabilities",
      color: "from-red-500 to-red-600",
      stats: `R${(unpaidLiabilitiesAmount ?? 0).toLocaleString()} unpaid`,
    },
    {
      title: "Payment Requests",
      description: "Review artisan payment requests",
      icon: CreditCard,
      href: "/admin/payment-requests",
      color: "from-pink-500 to-pink-600",
      stats: `${pendingPaymentRequests} pending requests`,
    },
    {
      title: "HR Tool",
      description: "Employee management, KPIs, and leave tracking",
      icon: UserCircle2,
      href: "/admin/hr",
      color: "from-purple-500 to-purple-600",
      stats: `${employees.length} total employees`,
    },
    {
      title: "AI Agent",
      description: "Your intelligent business assistant",
      icon: Bot,
      href: "/admin/ai-agent",
      color: "from-cyan-500 to-cyan-600",
      stats: "27 tools available",
    },
    {
      title: "Contractor Management",
      description: "Onboard and manage contractors",
      icon: Users,
      href: "/admin/contractor-management",
      color: "from-blue-500 to-blue-600",
      stats: "Admin tool",
    },
    {
      title: "Property Management",
      description: "Onboard and manage property managers",
      icon: FolderKanban,
      href: "/admin/property-management",
      color: "from-emerald-500 to-emerald-600",
      stats: "Admin tool",
    },
    {
      title: "Subscriptions",
      description: "Manage user subscriptions and packages",
      icon: Package,
      href: "/admin/subscriptions",
      color: "from-yellow-500 to-yellow-600",
      stats: "Admin tool",
    },
    {
      title: "Registrations",
      description: "Review and approve new account requests",
      icon: ClipboardList,
      href: "/admin/registrations",
      color: "from-yellow-500 to-yellow-600",
      stats: "Admin tool",
    },
    {
      title: "Settings",
      description: "Manage company branding and settings",
      icon: Settings,
      href: "/admin/settings",
      color: "from-gray-500 to-gray-600",
      stats: user?.role === "SENIOR_ADMIN" ? "Admin access" : "View only",
    },
  ];

  const isDemoJuniorAdmin =
    user?.role === "JUNIOR_ADMIN" && user?.email === "junior@propmanagement.com";

  const filteredDashboardCards = dashboardCards.filter((card) => {
    // Check permissions for each restricted card
    if (card.title === "Management Accounts") {
      return hasPermission("VIEW_ACCOUNTS");
    }
    if (card.title === "Assets") {
      return hasPermission("VIEW_ASSETS");
    }
    if (card.title === "Liabilities") {
      return hasPermission("VIEW_LIABILITIES");
    }
    if (card.title === "Payment Requests") {
      return hasPermission("VIEW_PAYMENT_REQUESTS");
    }
    if (card.title === "HR Tool") {
      return hasPermission("VIEW_ALL_EMPLOYEES");
    }
    if (card.title === "Contractor Management") {
      return hasPermission("MANAGE_SYSTEM_SETTINGS");
    }
    if (card.title === "Property Management") {
      return hasPermission("MANAGE_SYSTEM_SETTINGS");
    }
    if (card.title === "Subscriptions") {
      return hasPermission("MANAGE_SYSTEM_SETTINGS") && !isDemoJuniorAdmin;
    }
    if (card.title === "Registrations") {
      return hasPermission("MANAGE_SYSTEM_SETTINGS") && !isDemoJuniorAdmin;
    }
    if (card.title === "Settings") {
      return hasPermission("MANAGE_SYSTEM_SETTINGS");
    }
    // All other cards are visible
    return true;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50 to-indigo-50">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 shadow-lg" style={{ position: 'sticky', top: 0, zIndex: 9999 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl">
                <LayoutDashboard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
                <p className="text-sm text-indigo-100">Welcome back, {user?.firstName}!</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Metrics Overview */}
        <div className="mb-8">
            {isLoadingCriticalData ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
              </div>
            ) : (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-6">
                {/* Key Metrics */}
                <MetricCard
                  name="New Leads"
                  value={newLeads}
                  icon={TrendingUp}
                  color="blue"
                  gradient={true}
                  trend={{
                    value: newLeadsChange.change,
                    direction: newLeadsChange.trend,
                  }}
                />
                <MetricCard
                  name="Active Jobs"
                  value={activeOrders}
                  icon={Clock}
                  color="orange"
                  gradient={true}
                  trend={{
                    value: activeOrdersChange.change,
                    direction: activeOrdersChange.trend,
                  }}
                />
                {/* Only Senior Admin can see financial metrics */}
                {user?.role === ROLES.SENIOR_ADMIN && (
                  <>
                    <MetricCard
                      name="Total Revenue"
                      value={`R${(totalRevenue ?? 0).toLocaleString()}`}
                      icon={DollarSign}
                      color="purple"
                      gradient={true}
                      trend={{
                        value: revenueChange.change,
                        direction: revenueChange.trend,
                      }}
                    />
                    <MetricCard
                      name="Company Profit"
                      value={`R${(netProfit ?? 0).toLocaleString()}`}
                      icon={Wallet}
                      color="indigo"
                      gradient={true}
                      trend={{
                        value: netProfitChange.change,
                        direction: netProfitChange.trend,
                      }}
                    />
                    <MetricCard
                      name="Profit Margin"
                      value={`${(profitMargin ?? 0).toFixed(1)}%`}
                      icon={Percent}
                      color="green"
                      gradient={true}
                      trend={{
                        value: profitMarginChange.change,
                        direction: profitMarginChange.trend,
                      }}
                    />
                    <MetricCard
                      name="Expenses"
                      value={`R${(totalExpenses ?? 0).toLocaleString()}`}
                      icon={TrendingDown}
                      color="red"
                      gradient={true}
                      trend={{
                        value: expensesChange.change,
                        direction: expensesChange.trend,
                      }}
                    />
                  </>
                )}
              </div>

              {/* Secondary Metrics with Standard Style */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <MetricCard
                  name="Completed Jobs"
                  value={completedOrders}
                  icon={CheckCircle}
                  color="green"
                />
                <MetricCard
                  name="Overdue Invoices"
                  value={overdueInvoices}
                  icon={AlertCircle}
                  color="red"
                />
                <MetricCard
                  name="Paid Invoices"
                  value={paidInvoices}
                  icon={CheckCircle}
                  color="green"
                  trend={{
                    value: paidInvoicesChange.change,
                    direction: paidInvoicesChange.trend,
                  }}
                />
                <MetricCard
                  name="Work in Progress"
                  value={workInProgress}
                  icon={Clock}
                  color="blue"
                  trend={{
                    value: workInProgressChange.change,
                    direction: workInProgressChange.trend,
                  }}
                />
                <MetricCard
                  name="Outstanding Payments"
                  value={outstandingPaymentRequests}
                  icon={Wallet}
                  color="amber"
                />
              </div>
            </>
          )}
        </div>

        {/* Dashboard Cards */}
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

        {/* Analytics Overview */}
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
              <div className="p-4 sm:p-6">
                <div className="grid grid-cols-1 gap-6">
                  <div className="lg:col-span-1">
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
                  </div>
                  <PopularServicesChart
                    data={serviceAnalyticsQuery.data || []}
                    isLoading={serviceAnalyticsQuery.isLoading}
                  />
                  <div className="lg:col-span-1">
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
                  </div>
                  <div className="lg:col-span-1">
                    <BudgetUtilizationTrendChart
                      data={budgetUtilizationData}
                      isLoading={metricSnapshotsQuery.isLoading}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <CompletionRateTrendChart
                      data={completionRateData}
                      isLoading={metricSnapshotsQuery.isLoading}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <ProjectHealthTrendChart
                      data={projectHealthData}
                      isLoading={metricSnapshotsQuery.isLoading}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Recent Activity */}
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
      </main>
      
      {/* Support Chat Widget */}
      <SupportChatWidget />
      
      {/* AI Agent Chat Widget */}
      <AIAgentChatWidget />
    </div>
  );
}
