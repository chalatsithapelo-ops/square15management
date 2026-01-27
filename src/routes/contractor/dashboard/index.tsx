import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  LayoutDashboard,
  Briefcase,
  FileText,
  Receipt,
  DollarSign,
  TrendingUp,
  TrendingDown,
  Star,
  Clock,
  CheckCircle,
  AlertCircle,
  Package,
  Calendar,
  Award,
  Target,
  Settings,
  LogOut,
  Users,
  ClipboardList,
  MessageSquare,
  FolderKanban,
  CreditCard,
  UserCircle2,
  Bot,
  Wallet,
  Building2,
  Percent,
} from "lucide-react";
import { AIAgentChatWidget } from "~/components/AIAgentChatWidget";
import { SupportChatWidget } from "~/components/SupportChatWidget";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { useState } from "react";
import { MetricCard } from "~/components/MetricCard";
import { isContractorRole } from "~/utils/roles";

export const Route = createFileRoute("/contractor/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || !isContractorRole(user.role)) {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: ContractorDashboard,
});

function ContractorDashboard() {
  const { user, token, clearAuth } = useAuthStore();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<
    "overview" | "ai-agent" | "jobs" | "performance" | "documents" | "kpis"
  >("overview");

  const subscriptionQuery = useQuery({
    ...trpc.getUserSubscription.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 60_000,
    retry: 1,
  });

  const subscriptionPackage = (subscriptionQuery.data as any)?.package;
  const hasSubscriptionInfo = subscriptionQuery.isSuccess && !!subscriptionPackage;
  const hasFeature = (featureKey: string) => {
    // IMPORTANT: If subscription info is temporarily unavailable (network/server hiccup),
    // do not hide the entire portal. Keep tools visible to avoid the "all tools are gone" regression.
    if (!hasSubscriptionInfo) return true;
    return subscriptionPackage?.[featureKey] === true;
  };

  const canUseCRM = hasFeature("hasCRM");
  const canUseOperations = hasFeature("hasOperations");
  const canUseProjects = hasFeature("hasProjectManagement");
  const canUseQuotations = hasFeature("hasQuotations");
  const canUseInvoices = hasFeature("hasInvoices");
  const canUseStatements = hasFeature("hasStatements");
  const canUsePayments = hasFeature("hasPayments");
  const canUseAssetsBundle = hasFeature("hasAssets");
  const canUseHR = hasFeature("hasHR");
  const canUseMessages = hasFeature("hasMessages");
  const canUseAIAgent = hasFeature("hasAIAgent");

  // Fetch contractor data
  const contractorQuery = useQuery({
    ...trpc.getContractors.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    select: (data: any) => {
      // Find contractor by user email
      return data?.contractors?.find((c: any) => c.email === user?.email);
    },
  });

  const contractor = contractorQuery.data;

  // Fetch contractor performance
  const performanceQuery = useQuery({
    ...trpc.getContractorPerformance.queryOptions({
      token: token!,
      contractorId: contractor?.id || 0,
    }),
    enabled: !!contractor?.id,
  });

  const performance = performanceQuery.data?.performanceMetrics?.[0];

  // Fetch contractor documents
  const documentsQuery = useQuery({
    ...trpc.getContractorDocuments.queryOptions({
      token: token!,
      contractorId: contractor?.id || 0,
    }),
    enabled: !!contractor?.id,
  });

  const documents = documentsQuery.data?.documents || [];

  // Fetch additional data for new features
  const leadsQuery = useQuery(
    trpc.getLeads.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const projectsQuery = useQuery(
    trpc.getProjects.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const quotationsQuery = useQuery(
    trpc.getQuotations.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const invoicesQuery = useQuery(
    trpc.getInvoices.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const assetsQuery = useQuery(
    trpc.getAssets.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const liabilitiesQuery = useQuery(
    trpc.getLiabilities.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const conversationsQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    }, {
      refetchInterval: 10000,
      refetchOnWindowFocus: true,
    })
  );

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  const operationalExpensesQuery = useQuery({
    ...trpc.getOperationalExpenses.queryOptions({
      token: token!,
    }),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

  const alternativeRevenuesQuery = useQuery({
    ...trpc.getAlternativeRevenues.queryOptions({
      token: token!,
    }),
    refetchInterval: 30000,
    refetchOnWindowFocus: true,
    enabled: !!token,
  });

  // Extract data
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

  // Calculate metrics
  const newLeads = leads.filter((l) => l.status === "NEW").length;
  const activeOrders = orders.filter(
    (o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED"
  ).length;
  const completedOrders = orders.filter((o) => o.status === "COMPLETED").length;
  const activeProjects = projects.filter(
    (p) => p.status === "IN_PROGRESS" || p.status === "PLANNING"
  ).length;
  const pendingQuotations = quotations.filter((q: any) => q.status === "PENDING_ARTISAN_REVIEW" || q.status === "IN_PROGRESS").length;
  const unpaidInvoices = invoices.filter(
    (i) => i.status === "SENT" || i.status === "OVERDUE"
  ).length;
  const overdueInvoices = invoices.filter((i) => i.status === "OVERDUE").length;
  const paidInvoices = invoices.filter((i) => i.status === "PAID").length;
  const totalAssetValue = assets.reduce((sum, a) => sum + (a.currentValue ?? 0), 0);
  const pendingPaymentRequests = paymentRequests.filter((pr) => pr.status === "PENDING").length;
  const unpaidLiabilitiesAmount = liabilities
    .filter((l) => !l.isPaid)
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);
  
  // Financial metrics similar to admin dashboard
  const invoiceRevenue = invoices
    .filter((i) => i.status === "PAID")
    .reduce((sum, i) => sum + (i.total ?? 0), 0);
  
  const alternativeRevenueTotal = alternativeRevenues
    .filter((r) => r.isApproved === true)
    .reduce((sum, r) => sum + (r.amount ?? 0), 0);
  
  const totalRevenue = invoiceRevenue + alternativeRevenueTotal;
  
  // Calculate total expenses from paid payment requests, liabilities, and operational expenses
  const paymentRequestExpenses = paymentRequests
    .filter((pr) => pr.status === "APPROVED" || pr.status === "PAID")
    .reduce((sum, pr) => sum + (pr.calculatedAmount ?? 0), 0);
  
  const liabilityExpenses = liabilities
    .filter((l) => l.isPaid)
    .reduce((sum, l) => sum + (l.amount ?? 0), 0);
  
  const operationalExpenseTotal = operationalExpenses
    .filter((e) => e.isApproved === true)
    .reduce((sum, e) => sum + (e.amount ?? 0), 0);
  
  const totalExpenses = paymentRequestExpenses + liabilityExpenses + operationalExpenseTotal;
  
  // Calculate net profit (revenue - expenses)
  const netProfit = totalRevenue - totalExpenses;
  
  // Calculate profit margin percentage
  const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;
  
  // Work in progress orders
  const workInProgress = orders.filter(
    (o) => o.status === "IN_PROGRESS" || o.status === "ASSIGNED"
  ).length;

  const handleLogout = () => {
    clearAuth();
    window.location.href = "/";
  };

  // Dashboard cards matching admin portal
  const dashboardCards = [
    {
      title: "CRM",
      description: "Manage sales leads and customer relationships",
      icon: Users,
      color: "from-blue-500 to-blue-600",
      stats: `${newLeads} new leads`,
      href: "/contractor/crm",
      enabled: canUseCRM,
    },
    {
      title: "Operations",
      description: "Track and manage work orders",
      icon: ClipboardList,
      color: "from-green-500 to-green-600",
      stats: `${activeOrders} active jobs`,
      href: "/contractor/operations",
      enabled: canUseOperations,
    },
    {
      title: "Messages",
      description: "Communicate with customers and artisans",
      icon: MessageSquare,
      color: "from-green-500 to-green-600",
      stats: `${unreadConversations.length} unread`,
      href: "/messages",
      enabled: canUseMessages,
    },
    {
      title: "Projects",
      description: "Oversee development projects",
      icon: FolderKanban,
      color: "from-purple-500 to-purple-600",
      stats: `${activeProjects} active projects`,
      href: "/contractor/projects",
      enabled: canUseProjects,
    },
    {
      title: "Quotations",
      description: "Create and manage quotes",
      icon: FileText,
      color: "from-orange-500 to-orange-600",
      stats: `${pendingQuotations} pending quotes`,
      href: "/contractor/quotations",
      enabled: canUseQuotations,
    },
    {
      title: "Invoices",
      description: "Track payments and billing",
      icon: Receipt,
      color: "from-red-500 to-red-600",
      stats: `${unpaidInvoices} unpaid invoices`,
      href: "/contractor/invoices",
      enabled: canUseInvoices,
    },
    {
      title: "Statements",
      description: "Customer billing statements with age analysis",
      icon: FileText,
      color: "from-purple-500 to-purple-600",
      stats: "Automated statement generation",
      href: "/contractor/statements",
      enabled: canUseStatements,
    },
    {
      title: "Management Accounts",
      description: "Financial reports and analytics",
      icon: DollarSign,
      color: "from-teal-500 to-teal-600",
      stats: `R${(totalRevenue ?? 0).toLocaleString()} revenue`,
      href: "/contractor/accounts",
      enabled: canUseAssetsBundle,
    },
    {
      title: "Assets",
      description: "Manage company assets",
      icon: Package,
      color: "from-indigo-500 to-indigo-600",
      stats: `R${(totalAssetValue ?? 0).toLocaleString()} total value`,
      href: "/contractor/assets",
      enabled: canUseAssetsBundle,
    },
    {
      title: "Liabilities",
      description: "Manage organizational debt and payables",
      icon: AlertCircle,
      color: "from-red-500 to-red-600",
      stats: `R${(unpaidLiabilitiesAmount ?? 0).toLocaleString()} unpaid`,
      href: "/contractor/liabilities",
      enabled: canUseAssetsBundle,
    },
    {
      title: "Payment Requests",
      description: "Review artisan payment requests",
      icon: CreditCard,
      color: "from-pink-500 to-pink-600",
      stats: `${pendingPaymentRequests} pending requests`,
      href: "/contractor/payment-requests",
      enabled: canUsePayments,
    },
    {
      title: "HR Tool",
      description: "Employee management, KPIs, and leave tracking",
      icon: UserCircle2,
      color: "from-purple-500 to-purple-600",
      stats: `${employees.length} total employees`,
      href: "/contractor/hr",
      enabled: canUseHR,
    },
    {
      title: "AI Agent",
      description: "Your intelligent business assistant",
      icon: Bot,
      color: "from-cyan-500 to-cyan-600",
      stats: "Use chat widget below",
      action: () => setActiveTab("ai-agent"),
      enabled: canUseAIAgent,
    },
    {
      title: "Settings",
      description: "Manage company branding and settings",
      icon: Settings,
      color: "from-gray-500 to-gray-600",
      stats: "Contractor access",
      href: "/contractor/settings",
    },
  ].filter((c: any) => c.enabled !== false);

  const navItems = [
    { id: "overview", label: "Overview", icon: LayoutDashboard, isTab: true, enabled: true },
    { id: "crm", label: "CRM", icon: Users, href: "/contractor/crm", enabled: canUseCRM },
    { id: "operations", label: "Operations", icon: ClipboardList, href: "/contractor/operations", enabled: canUseOperations },
    { id: "projects", label: "Projects", icon: FolderKanban, href: "/contractor/projects", enabled: canUseProjects },
    { id: "quotations", label: "Quotations", icon: FileText, href: "/contractor/quotations", enabled: canUseQuotations },
    { id: "invoices", label: "Invoices", icon: Receipt, href: "/contractor/invoices", enabled: canUseInvoices },
    { id: "messages", label: "Messages", icon: MessageSquare, href: "/messages", enabled: canUseMessages },
    { id: "hr", label: "HR", icon: UserCircle2, href: "/contractor/hr", enabled: canUseHR },
    { id: "statements", label: "Statements", icon: FileText, href: "/contractor/statements", enabled: canUseStatements },
    { id: "accounts", label: "Accounts", icon: DollarSign, href: "/contractor/accounts", enabled: canUseAssetsBundle },
    { id: "payment-requests", label: "Payments", icon: CreditCard, href: "/contractor/payment-requests", enabled: canUsePayments },
    { id: "assets", label: "Assets", icon: Package, href: "/contractor/assets", enabled: canUseAssetsBundle },
    { id: "liabilities", label: "Liabilities", icon: AlertCircle, href: "/contractor/liabilities", enabled: canUseAssetsBundle },
    { id: "ai-agent", label: "AI Agent", icon: Bot, isTab: true, enabled: canUseAIAgent },
    { id: "settings", label: "Settings", icon: Settings, href: "/contractor/settings", enabled: true },
  ].filter((t: any) => t.enabled !== false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-blue-50/30 to-amber-50/30">
      {/* Modern Header with Gradient */}
      <div className="bg-gradient-to-r from-amber-600 via-amber-500 to-orange-500 text-white shadow-2xl relative z-50">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-2xl shadow-lg backdrop-blur-md border border-white/30">
                <LayoutDashboard className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Contractor Portal</h1>
                <p className="text-amber-50 mt-2 text-base sm:text-lg font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Welcome back, {contractor?.companyName || user?.firstName}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3 sm:space-x-4">
              <NotificationDropdown />
              <button
                onClick={handleLogout}
                className="px-4 sm:px-5 py-2.5 bg-white/15 hover:bg-white/25 rounded-xl flex items-center gap-2 font-semibold transition-all backdrop-blur-md border border-white/20 text-sm"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Modern Navigation Tabs with Pills Design */}
      <div className="bg-white/80 backdrop-blur-md shadow-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <nav className="flex space-x-2 sm:space-x-3 overflow-x-auto py-3">
            {navItems.map((tab: any) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const className = `flex items-center gap-2 px-4 sm:px-5 py-2.5 rounded-xl font-semibold text-xs sm:text-sm transition-all whitespace-nowrap ${
                isActive
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg shadow-amber-500/50 scale-105"
                  : "text-gray-600 hover:text-gray-900 hover:bg-gray-100"
              }`;

              if (tab.href) {
                return (
                  <Link
                    key={tab.id}
                    to={tab.href}
                    className={className}
                  >
                    <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </Link>
                );
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={className}
                >
                  <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {(!hasSubscriptionInfo || subscriptionQuery.isError) && (
          <div className="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Subscription features are temporarily unavailable. Tools are shown in full while we reconnect.
          </div>
        )}
        {activeTab === "overview" && (
          <OverviewTab
            contractor={contractor}
            performance={performance}
            dashboardCards={dashboardCards}
            newLeads={newLeads}
            activeOrders={activeOrders}
            completedOrders={completedOrders}
            totalRevenue={totalRevenue}
            netProfit={netProfit}
            profitMargin={profitMargin}
            totalExpenses={totalExpenses}
            overdueInvoices={overdueInvoices}
            paidInvoices={paidInvoices}
            workInProgress={workInProgress}
            pendingPaymentRequests={pendingPaymentRequests}
          />
        )}
        {activeTab === "ai-agent" && (
          <div className="text-center py-16">
            <div className="bg-gradient-to-br from-cyan-500 to-blue-600 w-24 h-24 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-2xl">
              <Bot className="w-14 h-14 text-white" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-3">AI Business Assistant</h2>
            <p className="text-gray-600 mb-8 text-lg max-w-2xl mx-auto">Your intelligent business assistant with 27 powerful tools to streamline operations</p>
            <div className="max-w-4xl mx-auto bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 rounded-2xl p-8 border-2 border-cyan-200 shadow-xl">
              <h3 className="font-bold text-gray-900 mb-6 text-xl">🚀 Available AI Tools</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm text-gray-700">
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <Users className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Lead Management</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-green-500 to-green-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <ClipboardList className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Order Tracking</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <Receipt className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Invoice Processing</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <FolderKanban className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Project Analytics</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-yellow-500 to-orange-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <Target className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Customer Insights</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-teal-500 to-teal-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <DollarSign className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Financial Reports</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-pink-500 to-pink-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Performance Metrics</p>
                </div>
                <div className="bg-white rounded-xl p-4 shadow-sm border border-cyan-100">
                  <div className="w-10 h-10 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-lg flex items-center justify-center mb-2 mx-auto">
                    <Briefcase className="w-5 h-5 text-white" />
                  </div>
                  <p className="font-semibold">Automated Workflows</p>
                </div>
              </div>
              <div className="mt-8 bg-white/60 backdrop-blur-sm rounded-xl p-5 border border-cyan-200">
                <p className="text-sm text-gray-700 font-medium flex items-center justify-center gap-2">
                  <MessageSquare className="w-5 h-5 text-cyan-600" />
                  Click the chat widget in the bottom right corner to start using AI Agent
                </p>
              </div>
            </div>
          </div>
        )}
        {activeTab === "jobs" && <JobsTab contractor={contractor} />}
        {activeTab === "performance" && (
          <PerformanceTab contractor={contractor} performance={performance} />
        )}
        {activeTab === "kpis" && (
          <KPIsTab contractorId={contractor?.id} />
        )}
        {activeTab === "documents" && (
          <DocumentsTab documents={documents} contractor={contractor} />
        )}
      </div>

      <AIAgentChatWidget />
      <SupportChatWidget />
    </div>
  );
}

function OverviewTab({
  contractor,
  performance,
  dashboardCards,
  newLeads,
  activeOrders,
  completedOrders,
  totalRevenue,
  netProfit,
  profitMargin,
  totalExpenses,
  overdueInvoices,
  paidInvoices,
  workInProgress,
  pendingPaymentRequests,
}: {
  contractor: any;
  performance: any;
  dashboardCards: any[];
  newLeads: number;
  activeOrders: number;
  completedOrders: number;
  totalRevenue: number;
  netProfit: number;
  profitMargin: number;
  totalExpenses: number;
  overdueInvoices: number;
  paidInvoices: number;
  workInProgress: number;
  pendingPaymentRequests: number;
}) {
  return (
    <div className="space-y-8">
      {/* Financial Metrics Grid - Similar to Admin Dashboard */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">Company Overview</h2>
        
        {/* Key Financial Metrics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-6 mb-6">
          <MetricCard
            name="New Leads"
            value={newLeads}
            icon={TrendingUp}
            color="blue"
            gradient={true}
          />
          <MetricCard
            name="Active Jobs"
            value={activeOrders}
            icon={Clock}
            color="orange"
            gradient={true}
          />
          <MetricCard
            name="Total Revenue"
            value={`R${(totalRevenue ?? 0).toLocaleString()}`}
            icon={DollarSign}
            color="purple"
            gradient={true}
          />
          <MetricCard
            name="Company Profit"
            value={`R${(netProfit ?? 0).toLocaleString()}`}
            icon={Wallet}
            color="indigo"
            gradient={true}
          />
          <MetricCard
            name="Profit Margin"
            value={`${(profitMargin ?? 0).toFixed(1)}%`}
            icon={Percent}
            color="green"
            gradient={true}
          />
          <MetricCard
            name="Expenses"
            value={`R${(totalExpenses ?? 0).toLocaleString()}`}
            icon={TrendingDown}
            color="red"
            gradient={true}
          />
        </div>

        {/* Secondary Metrics */}
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
          />
          <MetricCard
            name="Work in Progress"
            value={workInProgress}
            icon={Clock}
            color="blue"
          />
          <MetricCard
            name="Payment Requests"
            value={pendingPaymentRequests}
            icon={Wallet}
            color="amber"
          />
        </div>
      </div>

      {/* Business Tools Dashboard with Enhanced Cards */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Business Tools</h2>
            <p className="text-gray-600 mt-1">Access all your contractor management tools</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {dashboardCards.map((card, index) => {
            const Icon = card.icon;
            const cardContent = (
              <div className="group relative bg-white rounded-2xl shadow-lg hover:shadow-2xl transition-all hover:-translate-y-2 overflow-hidden border border-gray-100">
                <div className={`bg-gradient-to-br ${card.color} p-6 text-white relative overflow-hidden`}>
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                  <div className="relative">
                    <div className="flex items-center justify-between mb-3">
                      <Icon className="w-10 h-10 text-white" />
                      <div className="bg-white/20 rounded-full p-2">
                        <div className="w-2 h-2 bg-white rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <h3 className="font-bold text-xl mb-2">{card.title}</h3>
                    <p className="text-sm text-white/90 line-clamp-2">{card.description}</p>
                  </div>
                </div>
                <div className="p-5 bg-gradient-to-br from-gray-50 to-white">
                  <div className="flex items-center gap-2">
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-gray-900">{card.stats}</p>
                    </div>
                    <div className="text-gray-400 group-hover:text-amber-500 transition-colors">
                      →
                    </div>
                  </div>
                </div>
              </div>
            );

            if (card.href) {
              return (
                <Link
                  key={index}
                  to={card.href}
                  className="block"
                >
                  {cardContent}
                </Link>
              );
            }

            return (
              <button
                key={index}
                onClick={card.action}
                className="text-left w-full"
              >
                {cardContent}
              </button>
            );
          })}
        </div>
      </div>

      {/* Company Information with Modern Design */}
      <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="bg-gradient-to-br from-amber-500 to-orange-500 p-3 rounded-xl">
            <Building2 className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Company Information</h2>
            <p className="text-gray-600">Your business profile details</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100/50 rounded-xl p-5 border border-blue-200">
            <p className="text-sm text-blue-700 font-semibold mb-2">Company Name</p>
            <p className="text-lg font-bold text-gray-900">
              {contractor?.companyName || "N/A"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-green-50 to-green-100/50 rounded-xl p-5 border border-green-200">
            <p className="text-sm text-green-700 font-semibold mb-2">Service Type</p>
            <p className="text-lg font-bold text-gray-900">
              {contractor?.serviceType || "N/A"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-purple-50 to-purple-100/50 rounded-xl p-5 border border-purple-200">
            <p className="text-sm text-purple-700 font-semibold mb-2">Email</p>
            <p className="text-lg font-bold text-gray-900 truncate">
              {contractor?.email || "N/A"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-orange-50 to-orange-100/50 rounded-xl p-5 border border-orange-200">
            <p className="text-sm text-orange-700 font-semibold mb-2">Phone</p>
            <p className="text-lg font-bold text-gray-900">
              {contractor?.phone || "N/A"}
            </p>
          </div>
          <div className="bg-gradient-to-br from-teal-50 to-teal-100/50 rounded-xl p-5 border border-teal-200">
            <p className="text-sm text-teal-700 font-semibold mb-2">Status</p>
            <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${
              contractor?.status === "ACTIVE"
                ? "bg-green-500 text-white"
                : "bg-gray-500 text-white"
            }`}>
              <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
              {contractor?.status || "N/A"}
            </span>
          </div>
          <div className="bg-gradient-to-br from-indigo-50 to-indigo-100/50 rounded-xl p-5 border border-indigo-200">
            <p className="text-sm text-indigo-700 font-semibold mb-2">Member Since</p>
            <p className="text-lg font-bold text-gray-900">
              {contractor?.createdAt
                ? new Date(contractor.createdAt).toLocaleDateString()
                : "N/A"}
            </p>
          </div>
        </div>
      </div>

      {/* Performance Overview with Modern Cards */}
      {performance && (
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-gradient-to-br from-green-500 to-emerald-500 p-3 rounded-xl">
              <TrendingUp className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Performance Overview</h2>
              <p className="text-gray-600">Your recent performance metrics</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-blue-100 font-semibold">Quality Score</p>
                <Target className="w-6 h-6 text-blue-200" />
              </div>
              <p className="text-5xl font-bold">{performance.qualityScore || 0}<span className="text-2xl">%</span></p>
              <div className="mt-3 bg-white/20 rounded-full h-2">
                <div className="bg-white h-2 rounded-full" style={{width: `${performance.qualityScore || 0}%`}}></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-green-100 font-semibold">On-Time Percentage</p>
                <Clock className="w-6 h-6 text-green-200" />
              </div>
              <p className="text-5xl font-bold">{performance.onTimePercentage || 0}<span className="text-2xl">%</span></p>
              <div className="mt-3 bg-white/20 rounded-full h-2">
                <div className="bg-white h-2 rounded-full" style={{width: `${performance.onTimePercentage || 0}%`}}></div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-purple-500 to-pink-600 rounded-2xl p-6 text-white shadow-lg">
              <div className="flex items-center justify-between mb-3">
                <p className="text-sm text-purple-100 font-semibold">Overall Rating</p>
                <Award className="w-6 h-6 text-purple-200" />
              </div>
              <p className="text-5xl font-bold">{performance.overallRating || "N/A"}</p>
              <p className="text-sm text-purple-100 mt-2">Performance Classification</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function JobsTab({ contractor }: { contractor: any }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">My Jobs</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <Briefcase className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No jobs assigned yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Jobs will appear here when assigned by Property Managers
          </p>
        </div>
      </div>
    </div>
  );
}

function InvoicesTab({ contractor }: { contractor: any }) {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-gray-900">Invoices</h2>
      </div>

      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="text-center py-12">
          <Receipt className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 text-lg font-medium">No invoices yet</p>
          <p className="text-sm text-gray-400 mt-2">
            Your invoices and payment records will appear here
          </p>
        </div>
      </div>
    </div>
  );
}

function PerformanceTab({
  contractor,
  performance,
}: {
  contractor: any;
  performance: any;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Performance Metrics</h2>

      {/* Main Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <CheckCircle className="w-8 h-8 text-green-600" />
            <p className="text-sm text-gray-600">Jobs Completed</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {contractor?.totalJobsCompleted || 0}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Star className="w-8 h-8 text-yellow-600" />
            <p className="text-sm text-gray-600">Average Rating</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {(contractor?.averageRating || 0).toFixed(1)} / 5.0
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <TrendingUp className="w-8 h-8 text-blue-600" />
            <p className="text-sm text-gray-600">Quality Score</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {performance?.qualityScore || 0}%
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-2">
            <Clock className="w-8 h-8 text-purple-600" />
            <p className="text-sm text-gray-600">On-Time Rate</p>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            {performance?.onTimePercentage || 0}%
          </p>
        </div>
      </div>

      {/* Performance Details */}
      {performance && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Detailed Metrics
          </h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Jobs Quality Average</span>
              <span className="font-semibold text-gray-900">
                {(performance.jobsQuality || 0).toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Total Revenue Generated</span>
              <span className="font-semibold text-gray-900">
                R {(performance.totalRevenueGenerated || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-700">Performance Classification</span>
              <span
                className={`px-3 py-1 rounded-full text-sm font-semibold ${
                  performance.overallRating === "EXCELLENT"
                    ? "bg-green-100 text-green-800"
                    : performance.overallRating === "GOOD"
                    ? "bg-blue-100 text-blue-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {performance.overallRating || "N/A"}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KPIsTab({ contractorId }: { contractorId?: number }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const performanceQuery = useQuery({
    ...trpc.getContractorPerformance.queryOptions({
      token: token!,
      contractorId: contractorId || 0,
    }),
    enabled: !!contractorId,
  });

  const kpis = performanceQuery.data?.kpis || [];

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Key Performance Indicators</h2>

      {kpis.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {kpis.map((kpi: any) => {
            const achievementRate = kpi.achievementRate || 0;
            const color =
              achievementRate >= 100
                ? "green"
                : achievementRate >= 75
                ? "yellow"
                : "red";

            return (
              <div
                key={kpi.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
              >
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900">{kpi.kpiName}</h3>
                    <p className="text-sm text-gray-600 mt-1">{kpi.description}</p>
                  </div>
                  <Award className={`w-6 h-6 text-${color}-600`} />
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Target</span>
                    <span className="font-semibold text-gray-900">
                      {kpi.targetValue} {kpi.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Actual</span>
                    <span className="font-semibold text-gray-900">
                      {kpi.actualValue?.toFixed(2) || 0} {kpi.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Achievement</span>
                    <span className={`font-semibold text-${color}-600`}>
                      {achievementRate.toFixed(1)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full bg-gray-200 rounded-full h-3">
                    <div
                      className={`bg-${color}-600 h-3 rounded-full transition-all`}
                      style={{ width: `${Math.min(achievementRate, 100)}%` }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
                    <span>Frequency: {kpi.frequency}</span>
                    <span>Status: {kpi.status}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <Target className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No KPIs set yet</p>
            <p className="text-sm text-gray-400 mt-2">
              Your Property Manager will set KPIs to track your performance
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

function DocumentsTab({
  documents,
  contractor,
}: {
  documents: any[];
  contractor: any;
}) {
  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Documents</h2>

      {documents.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {documents.map((doc: any) => (
            <div
              key={doc.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6"
            >
              <div className="flex items-start justify-between mb-3">
                <FileText className="w-8 h-8 text-blue-600" />
                <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                  {doc.documentType}
                </span>
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{doc.title}</h3>
              <p className="text-sm text-gray-600 mb-4">{doc.description}</p>
              {doc.expiryDate && (
                <div className="flex items-center gap-2 text-sm text-gray-500 mb-3">
                  <Calendar className="w-4 h-4" />
                  <span>Expires: {new Date(doc.expiryDate).toLocaleDateString()}</span>
                </div>
              )}
              <a
                href={doc.fileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:text-blue-800 font-medium"
              >
                View Document →
              </a>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200">
          <div className="text-center py-12">
            <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <p className="text-gray-500 text-lg font-medium">No documents uploaded</p>
            <p className="text-sm text-gray-400 mt-2">
              Your documents (licenses, insurance, etc.) will appear here
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
