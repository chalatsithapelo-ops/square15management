import { createFileRoute, Link, redirect, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  Building2,
  FileText,
  Receipt,
  Users,
  DollarSign,
  TrendingUp,
  AlertCircle,
  Package,
  Clock,
  CheckCircle2,
  XCircle,
  Plus,
  Calendar,
  Wrench,
  MessageSquare,
  Home,
  PieChart,
  Loader2,
  BarChart3,
  Briefcase,
  Bot,
  Settings,
  Download,
  Search,
  FolderKanban,
} from "lucide-react";
import { useState, useMemo, Fragment } from "react";
import { MetricCard } from "~/components/MetricCard";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { AIAgentChatWidget } from "~/components/AIAgentChatWidget";
import { RFQsTab } from "~/components/property-manager/RFQsTab";
import { CreateBuildingModal } from "~/components/property-manager/CreateBuildingModal";
import { CreateMaintenanceRequestModal } from "~/components/property-manager/CreateMaintenanceRequestModal";
import { BuildingBudgetTracker } from "~/components/property-manager/BuildingBudgetTracker";
import { PaymentReviewPage } from "~/components/property-manager/PaymentReviewPage";
import { ContractorManagement } from "~/components/property-manager/ContractorManagement";
import { ComprehensivePMFinancialReporting } from "~/components/property-manager/ComprehensivePMFinancialReporting";
import { CreateOrderModal } from "~/components/property-manager/CreateOrderModal";
import { EditOrderModal } from "~/components/property-manager/EditOrderModal";
import { CreateInvoiceModal } from "~/components/property-manager/CreateInvoiceModal";
import { RateWorkModal } from "~/components/property-manager/RateWorkModal";
import toast from "react-hot-toast";

export const Route = createFileRoute("/property-manager/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || user.role !== "PROPERTY_MANAGER") {
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: PropertyManagerDashboard,
});

function PropertyManagerDashboard() {
  const { user, token } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const [activeTab, setActiveTab] = useState<
    | "overview"
    | "rfqs"
    | "orders"
    | "invoices"
    | "projects"
    | "maintenance"
    | "buildings"
    | "budgets"
    | "contractors"
    | "financial"
    | "payments"
  >("overview");
  const [showCreateOrderModal, setShowCreateOrderModal] = useState(false);
  const [showCreateInvoiceModal, setShowCreateInvoiceModal] = useState(false);
  const [showRateWorkModal, setShowRateWorkModal] = useState(false);
  const [orderToRate, setOrderToRate] = useState<any>(null);

  // Real queries
  const rfqsQuery = useQuery({
    ...trpc.getPropertyManagerRFQs.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  const ordersQuery = useQuery({
    ...trpc.getPropertyManagerOrders.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Fetch PM-specific invoices (from PropertyManagerInvoice table)
  const pmInvoicesQuery = useQuery({
    ...trpc.getPropertyManagerInvoices.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Fetch regular invoices where PM's email is used as customer
  const regularInvoicesQuery = useQuery({
    ...trpc.getInvoices.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  const maintenanceRequestsQuery = useQuery({
    ...trpc.getMaintenanceRequests.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Real data
  const rfqs = (rfqsQuery.data as any[]) || [];
  const orders = (ordersQuery.data as any[]) || [];
  const pmInvoices = (pmInvoicesQuery.data as any[]) || [];
  const regularInvoices = (regularInvoicesQuery.data as any[]) || [];
  
  // Combine PM invoices and regular invoices addressed to PM
  const invoices = useMemo(() => {
    // PM invoices are already in the correct format
    const pmInvsWithType = pmInvoices.map((inv: any) => ({
      ...inv,
      isPropertyManagerInvoice: true,
    }));
    
    // Regular invoices need to be normalized
    const regularInvsWithType = regularInvoices.map((inv: any) => ({
      ...inv,
      isRegularInvoice: true,
    }));
    
    return [...pmInvsWithType, ...regularInvsWithType];
  }, [pmInvoices, regularInvoices]);
  
  const maintenanceRequests = (maintenanceRequestsQuery.data as any[]) || [];
  const buildings: any[] = []; // TODO: Implement buildings query
  const budgets: any[] = []; // TODO: Implement budgets query

  // Calculate metrics
  const pendingRFQs = useMemo(() => rfqs.filter((r: any) => ["DRAFT", "SUBMITTED", "UNDER_REVIEW"].includes(r.status)), [rfqs]);
  const activeOrders = useMemo(() => orders.filter((o: any) => ["SUBMITTED", "ACCEPTED", "IN_PROGRESS"].includes(o.status)), [orders]);
  const pendingInvoices = useMemo(() => invoices.filter((i: any) => i.status === "SENT_TO_PM"), [invoices]);
  const overdueInvoices = useMemo(() => invoices.filter((i: any) => i.status === "OVERDUE"), [invoices]);
  const pendingMaintenance = useMemo(() => maintenanceRequests.filter((m: any) => ["SUBMITTED", "REVIEWED"].includes(m.status)), [maintenanceRequests]);
  const urgentMaintenance = useMemo(() => maintenanceRequests.filter((m: any) => m.urgency === "URGENT" && m.status !== "COMPLETED"), [maintenanceRequests]);

  // Calculate budget metrics
  const totalBudget = useMemo(() => budgets.reduce((sum: number, b: any) => sum + b.totalBudget, 0), [budgets]);
  const totalSpent = useMemo(() => budgets.reduce((sum: number, b: any) => sum + b.totalSpent, 0), [budgets]);
  const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

  const tabs = useMemo(() => [
    { id: "overview" as const, label: "Overview", icon: Home },
    { id: "rfqs" as const, label: "RFQs", count: rfqs.length, icon: FileText },
    { id: "orders" as const, label: "Orders", count: orders.length, icon: Package },
    { id: "invoices" as const, label: "Invoices", count: invoices.length, icon: Receipt },
    { id: "projects" as const, label: "Projects", icon: FolderKanban },
    { id: "maintenance" as const, label: "Maintenance", count: maintenanceRequests.length, icon: Wrench },
    { id: "buildings" as const, label: "Buildings", count: buildings.length, icon: Building2 },
    { id: "budgets" as const, label: "Budgets", count: budgets.length, icon: PieChart },
    { id: "contractors" as const, label: "Contractors", icon: Briefcase },
    { id: "financial" as const, label: "Financial Reports", icon: BarChart3 },
    { id: "payments" as const, label: "Payments", icon: DollarSign },
  ], [rfqs.length, orders.length, invoices.length, maintenanceRequests.length, buildings.length, budgets.length]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-blue-50/30">
      {/* Modern Header with Gradient */}
      <header className="bg-gradient-to-r from-teal-600 via-teal-500 to-cyan-500 text-white shadow-2xl relative z-50">
        {/* Decorative Background Pattern */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 left-0 w-96 h-96 bg-white rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-white rounded-full blur-3xl translate-x-1/2 translate-y-1/2" />
        </div>
        
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="bg-white/20 p-3 rounded-2xl shadow-lg backdrop-blur-md border border-white/30">
                <Building2 className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-3xl sm:text-4xl font-bold tracking-tight">Property Manager Portal</h1>
                <p className="text-teal-50 mt-2 text-base sm:text-lg font-medium flex items-center gap-2">
                  <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  Welcome, {user?.firstName}!
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <Link
                to="/property-manager/tenants"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 rounded-lg transition-colors shadow-sm"
              >
                <Users className="h-4 w-4" />
                <span>Tenant Management</span>
              </Link>
              <Link
                to="/property-manager/ai-agent"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-cyan-600 hover:from-cyan-600 hover:to-cyan-700 rounded-lg transition-colors shadow-sm"
              >
                <Bot className="h-4 w-4" />
                <span>AI Agent</span>
              </Link>
              <Link
                to="/property-manager/settings"
                className="flex items-center space-x-2 px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Settings"
              >
                <Settings className="h-5 w-5" />
              </Link>
              <NotificationDropdown />
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10" style={{ isolation: "isolate" }}>
        {/* Key Metrics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <MetricCard
            name="Active Orders"
            value={activeOrders.length}
            icon={Package}
            color="blue"
            gradient={true}
          />
          <MetricCard
            name="Pending Invoices"
            value={pendingInvoices.length}
            icon={Receipt}
            color="orange"
            gradient={true}
            subtitle={overdueInvoices.length > 0 ? `${overdueInvoices.length} overdue` : undefined}
          />
          <MetricCard
            name="Maintenance Requests"
            value={pendingMaintenance.length}
            icon={Wrench}
            color="purple"
            gradient={true}
            subtitle={urgentMaintenance.length > 0 ? `${urgentMaintenance.length} urgent` : undefined}
          />
          <MetricCard
            name="Budget Utilization"
            value={`${budgetUtilization.toFixed(0)}%`}
            icon={DollarSign}
            color={budgetUtilization > 90 ? "red" : budgetUtilization > 75 ? "orange" : "green"}
            gradient={true}
            subtitle={`R${totalSpent.toLocaleString()} of R${totalBudget.toLocaleString()}`}
          />
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="p-2">
            <nav className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <Fragment key={tab.id}>
                    <button
                      onClick={() => {
                        setActiveTab(tab.id);
                      }}
                      className={`flex-shrink-0 flex items-center gap-2 py-3 px-5 rounded-xl font-medium text-sm transition-all transform ${
                        isActive
                          ? "bg-gradient-to-r from-teal-600 to-cyan-500 text-white shadow-md scale-105"
                          : "text-gray-600 hover:bg-gray-50 hover:text-teal-600"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                      {tab.count !== undefined && tab.count > 0 && (
                        <span
                          className={`py-0.5 px-2 rounded-full text-xs font-semibold ${
                            isActive
                              ? "bg-white/20 text-white"
                              : "bg-teal-100 text-teal-700"
                          }`}
                        >
                          {tab.count}
                        </span>
                      )}
                    </button>

                    {tab.id === "invoices" && (
                      <Link
                        to="/property-manager/statements"
                        className="flex-shrink-0 flex items-center gap-2 py-3 px-5 rounded-xl font-medium text-sm transition-all transform text-gray-600 hover:bg-gray-50 hover:text-teal-600"
                      >
                        <FileText className="h-4 w-4" />
                        <span>Statements</span>
                      </Link>
                    )}
                  </Fragment>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "overview" && <OverviewTab />}
            {activeTab === "rfqs" && <RFQsTab />}
            {activeTab === "orders" && <OrdersTab onCreateClick={() => setShowCreateOrderModal(true)} onRateClick={(order) => {
              setOrderToRate(order);
              setShowRateWorkModal(true);
            }} />}
            {activeTab === "invoices" && <InvoicesTab onCreateClick={() => setShowCreateInvoiceModal(true)} />}
            {activeTab === "projects" && <ProjectsTab />}
            {activeTab === "maintenance" && <MaintenanceTab />}
            {activeTab === "buildings" && <BuildingsTab />}
            {activeTab === "budgets" && <BudgetsTab />}
            {activeTab === "contractors" && <ContractorManagement />}
            {activeTab === "financial" && <ComprehensivePMFinancialReporting />}
            {activeTab === "payments" && <PaymentReviewPage token={token!} />}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateOrderModal isOpen={showCreateOrderModal} onClose={() => setShowCreateOrderModal(false)} />
      <CreateInvoiceModal isOpen={showCreateInvoiceModal} onClose={() => setShowCreateInvoiceModal(false)} />
      {orderToRate && (
        <RateWorkModal 
          isOpen={showRateWorkModal} 
          onClose={() => {
            setShowRateWorkModal(false);
            setOrderToRate(null);
          }} 
          order={orderToRate} 
        />
      )}

      <AIAgentChatWidget />
    </div>
  );
}

function OverviewTab() {
  return (
    <div className="space-y-6">
      <div className="text-center py-12">
        <Building2 className="mx-auto h-16 w-16 text-teal-600 mb-4" />
        <h3 className="text-xl font-semibold text-gray-900 mb-2">
          Welcome to Your Property Manager Portal
        </h3>
        <p className="text-gray-600 max-w-2xl mx-auto mb-6">
          Manage your properties, tenants, budgets, and maintenance requests all in one place. 
          Request quotes from admin, issue orders, approve invoices, and track your expenses.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl mx-auto mt-8">
          <div className="bg-gradient-to-br from-teal-50 to-teal-100 rounded-lg p-6 text-left border border-teal-200">
            <FileText className="h-8 w-8 text-teal-600 mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Request Quotations</h4>
            <p className="text-sm text-gray-700">
              Submit RFQs to admin with detailed scope of work and receive competitive quotes for your projects.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-6 text-left border border-blue-200">
            <Package className="h-8 w-8 text-blue-600 mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Issue Orders</h4>
            <p className="text-sm text-gray-700">
              Create and track work orders with real-time status updates from start to completion.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-6 text-left border border-orange-200">
            <Receipt className="h-8 w-8 text-orange-600 mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Approve Invoices</h4>
            <p className="text-sm text-gray-700">
              Review and approve invoices from admin, mark them as paid, and track payment history.
            </p>
          </div>
          
          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-6 text-left border border-purple-200">
            <PieChart className="h-8 w-8 text-purple-600 mb-3" />
            <h4 className="font-semibold text-gray-900 mb-2">Budget & Finance</h4>
            <p className="text-sm text-gray-700">
              Create detailed budgets, track expenses, and schedule preventative maintenance for your properties.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProjectsTab() {
  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-3 mb-2">
          <FolderKanban className="h-6 w-6 text-teal-600" />
          <h3 className="text-lg font-semibold text-gray-900">Projects</h3>
        </div>
        <p className="text-gray-600 mb-4">
          Manage your projects, milestones, and progress tracking.
        </p>
        <Link
          to="/property-manager/projects"
          className="inline-flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          <FolderKanban className="h-4 w-4" />
          <span>Open Projects</span>
        </Link>
      </div>
    </div>
  );
}

function OrdersTab({ onCreateClick, onRateClick }: { onCreateClick: () => void; onRateClick: (order: any) => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [showEditModal, setShowEditModal] = useState(false);
  const [downloadingOrderId, setDownloadingOrderId] = useState<number | null>(null);
  const [downloadingSummaryId, setDownloadingSummaryId] = useState<number | null>(null);
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const ordersQuery = useQuery({
    ...trpc.getPropertyManagerOrders.queryOptions({
      token: token!,
      status: statusFilter === "ALL" || statusFilter === "INVOICED" ? undefined : statusFilter,
    }),
    enabled: !!token,
    retry: 1,
    staleTime: 10000,
  });

  const allOrders = (ordersQuery.data as any[]) || [];
  
  // Filter for INVOICED tab - show orders with invoices in SENT_TO_PM or later status
  const orders = useMemo(() => {
    let filtered = allOrders;
    
    if (statusFilter === "INVOICED") {
      filtered = allOrders.filter((order: any) => 
        order.invoices && order.invoices.length > 0 && 
        order.invoices.some((inv: any) => 
          ['SENT_TO_PM', 'PM_APPROVED', 'PM_REJECTED', 'PAID', 'OVERDUE'].includes(inv.status)
        )
      );
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((order: any) => 
        order.orderNumber?.toLowerCase().includes(query) ||
        order.contractorEmail?.toLowerCase().includes(query) ||
        order.contractorName?.toLowerCase().includes(query) ||
        order.description?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [allOrders, statusFilter, searchQuery]);

  console.log("OrdersTab - Query State:", {
    isLoading: ordersQuery.isLoading,
    isFetching: ordersQuery.isFetching,
    isError: ordersQuery.isError,
    error: ordersQuery.error,
    dataLength: orders.length,
    statusFilter,
  });

  const downloadPdfMutation = useMutation(
    trpc.generatePropertyManagerOrderPdf.mutationOptions({
      onSuccess: (data) => {
        if (data.pdfBase64) {
          // Convert base64 to blob
          const byteCharacters = atob(data.pdfBase64);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          
          // Create a temporary link element to trigger download
          const link = document.createElement('a');
          link.href = url;
          link.download = data.filename || 'order.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the URL object
          window.URL.revokeObjectURL(url);
        }
        toast.success("PDF downloaded successfully!");
        setDownloadingOrderId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF.");
        setDownloadingOrderId(null);
      },
    })
  );

  const handleDownloadPdf = (orderId: number) => {
    if (!token) return;
    setDownloadingOrderId(orderId);
    downloadPdfMutation.mutate({
      orderId,
    });
  };

  const downloadOrderSummaryMutation = useMutation(
    trpc.generateOrderPdf.mutationOptions()
  );

  const handleDownloadOrderSummary = async (orderId: number) => {
    if (!token) return;
    setDownloadingSummaryId(orderId);
    try {
      const data = await downloadOrderSummaryMutation.mutateAsync({
        token,
        orderId,
        isPMOrder: true, // PM orders always use PropertyManagerOrder table
      });
      
      if (data.pdf) {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'order-summary.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      toast.success("Order summary downloaded successfully!", { duration: 5000 });
    } catch (error: any) {
      console.error("Order summary download error:", error);
      toast.error(error.message || "Failed to download order summary.", { duration: 10000 });
    } finally {
      setDownloadingSummaryId(null);
    }
  };

  const downloadInvoiceMutation = useMutation(
    trpc.generatePropertyManagerInvoicePdf.mutationOptions()
  );

  const handleDownloadInvoice = async (invoiceId: number) => {
    if (!token) return;
    setDownloadingInvoiceId(invoiceId);
    try {
      const data = await downloadInvoiceMutation.mutateAsync({
        token,
        invoiceId,
      });
      
      if (data.pdf) {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        
        const link = document.createElement('a');
        link.href = url;
        link.download = 'invoice.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
      }
      toast.success("Invoice downloaded successfully!", { duration: 5000 });
    } catch (error: any) {
      console.error("Invoice download error:", error);
      toast.error(error.message || "Failed to download invoice.", { duration: 10000 });
    } finally {
      setDownloadingInvoiceId(null);
    }
  };

  const statusOptions = ["ALL", "DRAFT", "SUBMITTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "INVOICED"] as const;

  const statusCounts = useMemo(() => {
    const counts = {
      DRAFT: 0,
      SUBMITTED: 0,
      ACCEPTED: 0,
      IN_PROGRESS: 0,
      COMPLETED: 0,
      INVOICED: 0,
    };
    orders.forEach((order: any) => {
      if (order.status === "DRAFT") counts.DRAFT += 1;
      if (order.status === "SUBMITTED") counts.SUBMITTED += 1;
      if (order.status === "ACCEPTED") counts.ACCEPTED += 1;
      if (order.status === "IN_PROGRESS") counts.IN_PROGRESS += 1;
      if (order.status === "COMPLETED") counts.COMPLETED += 1;
      // Count INVOICED orders - those with invoices in SENT_TO_PM status or later
      if (order.invoices && order.invoices.length > 0) {
        const hasInvoicedStatus = order.invoices.some((inv: any) => 
          ['SENT_TO_PM', 'PM_APPROVED', 'PM_REJECTED', 'PAID', 'OVERDUE'].includes(inv.status)
        );
        if (hasInvoicedStatus) {
          counts.INVOICED += 1;
        }
      }
    });
    return counts;
  }, [orders]);

  const handleEditOrder = (order: any) => {
    setSelectedOrder(order);
    setShowEditModal(true);
  };

  if (ordersQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading orders...</p>
      </div>
    );
  }

  if (ordersQuery.isError) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <AlertCircle className="h-12 w-12 text-red-500 mb-4" />
        <p className="text-red-600 font-medium mb-2">Failed to load orders</p>
        <p className="text-sm text-gray-600">{ordersQuery.error?.message || "Unknown error"}</p>
        <button
          onClick={() => ordersQuery.refetch()}
          className="mt-4 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={onCreateClick}
          className="px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Order
        </button>
      </div>
      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by order number, contractor name, email or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status}{" "}
              {status !== "ALL" ? `(${statusCounts[status] ?? 0})` : ""}
            </button>
          ))}
        </div>
      </div>
      {/* Orders List */}
      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Orders Found</h3>
          <p className="text-sm text-gray-600">
            You don't have any work orders yet.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order: any) => (
            <div
              key={order.id}
              className="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex items-center gap-2">
                  <h4 className="text-md font-semibold text-gray-900">{order.orderNumber} - {order.title}</h4>
                  {/* Invoice indicator badge */}
                  {order.invoices && order.invoices.length > 0 && order.invoices.some((inv: any) => 
                    ['SENT_TO_PM', 'PM_APPROVED', 'PM_REJECTED', 'PAID', 'OVERDUE'].includes(inv.status)
                  ) && (
                    <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700 flex items-center gap-1">
                      <Receipt className="h-3 w-3" />
                      Invoiced
                    </span>
                  )}
                </div>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    order.status === "COMPLETED"
                      ? "bg-green-100 text-green-700"
                      : order.status === "IN_PROGRESS"
                      ? "bg-blue-100 text-blue-700"
                      : order.status === "ACCEPTED"
                      ? "bg-purple-100 text-purple-700"
                      : order.status === "DRAFT"
                      ? "bg-gray-100 text-gray-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {order.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
                <p><strong>Building:</strong> {order.buildingName || "N/A"}</p>
                <p><strong>Address:</strong> {order.buildingAddress}</p>
                <p><strong>Amount:</strong> R{order.totalAmount.toLocaleString()}</p>
                <p><strong>Progress:</strong> {order.progressPercentage}%</p>
              </div>

              <p className="mt-2 text-sm text-gray-600 line-clamp-2">{order.description}</p>

              {order.progressUpdates && order.progressUpdates.length > 0 && (
                <div className="mt-3 text-xs text-gray-500">
                  Latest update: {order.progressUpdates[0].message}
                </div>
              )}

              {/* Action Buttons */}
              <div className="mt-3 flex justify-end space-x-2">
                {/* Download PDF button - available for all statuses except DRAFT */}
                {order.status !== "DRAFT" && (
                  <button
                    onClick={() => handleDownloadPdf(order.id)}
                    disabled={downloadingOrderId === order.id}
                    className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                  >
                    {downloadingOrderId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download PDF
                  </button>
                )}
                {/* Allow editing in DRAFT or SUBMITTED status */}
                {(order.status === "DRAFT" || order.status === "SUBMITTED") && (
                  <button
                    onClick={() => handleEditOrder(order)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Edit & Resubmit
                  </button>
                )}
                
                {order.status === "COMPLETED" && (
                  <button
                    onClick={() => handleDownloadOrderSummary(order.id)}
                    disabled={downloadingSummaryId === order.id}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {downloadingSummaryId === order.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Order Summary
                  </button>
                )}
                
                {order.status === "COMPLETED" && !order.ratedAt && (
                  <button
                    onClick={() => onRateClick(order)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors"
                  >
                    Rate Work
                  </button>
                )}
                
                {/* Show invoice download for orders with invoices */}
                {order.invoices && order.invoices.length > 0 && order.invoices.some((inv: any) => 
                  ['SENT_TO_PM', 'PM_APPROVED', 'PM_REJECTED', 'PAID', 'OVERDUE'].includes(inv.status)
                ) && (
                  <button
                    onClick={() => {
                      const invoice = order.invoices.find((inv: any) => 
                        ['SENT_TO_PM', 'PM_APPROVED', 'PM_REJECTED', 'PAID', 'OVERDUE'].includes(inv.status)
                      );
                      if (invoice) {
                        handleDownloadInvoice(invoice.id);
                      }
                    }}
                    disabled={downloadingInvoiceId === order.invoices[0]?.id}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {downloadingInvoiceId === order.invoices[0]?.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4" />
                    )}
                    Download Invoice
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
      {showEditModal && (
        <EditOrderModal
          isOpen={showEditModal}
          onClose={() => {
            setShowEditModal(false);
            setSelectedOrder(null);
          }}
          order={selectedOrder}
        />
      )}
    </div>
  )
}

function InvoicesTab({ onCreateClick }: { onCreateClick: () => void }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("SENT_TO_PM");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingInvoiceId, setDownloadingInvoiceId] = useState<number | null>(null);

  const pmInvoicesQuery = useQuery({
    ...trpc.getPropertyManagerInvoices.queryOptions({
      token: token!,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // For regular invoices, map PM statuses to regular invoice statuses
  const getRegularInvoiceStatus = (pmStatus: string) => {
    // PM-specific statuses don't apply to regular invoices
    // Regular invoices are just filtered by customer email (PM email)
    // So we don't filter by status for PM-specific statuses
    const pmSpecificStatuses = ["SENT_TO_PM", "PM_APPROVED", "PM_REJECTED"];
    if (pmSpecificStatuses.includes(pmStatus)) {
      return undefined; // Don't filter regular invoices by PM-specific statuses
    }
    return pmStatus === "ALL" ? undefined : pmStatus;
  };

  const regularInvoicesQuery = useQuery({
    ...trpc.getInvoices.queryOptions({
      token: token!,
      status: getRegularInvoiceStatus(statusFilter) as any,
    }),
    enabled: !!token,
    retry: 1,
    staleTime: 10000,
  });

  // Combine PM invoices and regular invoices
  const pmInvoices = (pmInvoicesQuery.data as any[]) || [];
  const regularInvoices = (regularInvoicesQuery.data as any[]) || [];
  const invoices = useMemo(() => {
    const pmInvsWithType = pmInvoices.map((inv: any) => ({
      ...inv,
      isPropertyManagerInvoice: true,
    }));
    
    const regularInvsWithType = regularInvoices.map((inv: any) => ({
      ...inv,
      isRegularInvoice: true,
    }));
    
    let combined = [...pmInvsWithType, ...regularInvsWithType];
    
    // Apply client-side filtering for status if needed
    if (statusFilter !== "ALL") {
      combined = combined.filter((inv: any) => {
        // Map PM-specific statuses to include equivalent regular invoice statuses
        if (statusFilter === "SENT_TO_PM") {
          // Show PM invoices with SENT_TO_PM or ADMIN_APPROVED status OR regular invoices with SENT status (but not approved ones)
          return (inv.isPropertyManagerInvoice && (inv.status === "SENT_TO_PM" || inv.status === "ADMIN_APPROVED")) ||
                 (inv.isRegularInvoice && inv.status === "SENT" && !inv.pmApproved);
        }
        if (statusFilter === "PM_APPROVED") {
          // Show PM invoices with PM_APPROVED status OR regular invoices with pmApproved=true (and not yet paid)
          return (inv.isPropertyManagerInvoice && inv.status === "PM_APPROVED") ||
                 (inv.isRegularInvoice && inv.pmApproved === true && inv.status !== "PAID");
        }
        if (statusFilter === "PM_REJECTED") {
          // Show PM invoices with PM_REJECTED status OR regular invoices with REJECTED status
          return (inv.isPropertyManagerInvoice && inv.status === "PM_REJECTED") ||
                 (inv.isRegularInvoice && inv.status === "REJECTED");
        }
        // For other statuses (PAID, OVERDUE, etc.), show both types with matching status
        return inv.status === statusFilter;
      });
    }
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter((inv: any) => 
        inv.invoiceNumber?.toLowerCase().includes(query) ||
        inv.customerEmail?.toLowerCase().includes(query) ||
        inv.customerName?.toLowerCase().includes(query)
      );
    }
    
    return combined;
  }, [pmInvoices, regularInvoices, statusFilter, searchQuery]);

  const invoiceStatusCounts = useMemo(() => {
    const pmInvsWithType = pmInvoices.map((inv: any) => ({
      ...inv,
      isPropertyManagerInvoice: true,
    }));
    
    const regularInvsWithType = regularInvoices.map((inv: any) => ({
      ...inv,
      isRegularInvoice: true,
    }));
    
    const allInvoices = [...pmInvsWithType, ...regularInvsWithType];
    
    const counts = {
      ALL: allInvoices.length,
      SENT_TO_PM: 0,
      PM_APPROVED: 0,
      PAID: 0,
      OVERDUE: 0,
    };
    
    allInvoices.forEach((inv: any) => {
      // SENT_TO_PM count
      if ((inv.isPropertyManagerInvoice && (inv.status === "SENT_TO_PM" || inv.status === "ADMIN_APPROVED")) ||
          (inv.isRegularInvoice && inv.status === "SENT" && !inv.pmApproved)) {
        counts.SENT_TO_PM += 1;
      }
      
      // PM_APPROVED count
      if ((inv.isPropertyManagerInvoice && inv.status === "PM_APPROVED") ||
          (inv.isRegularInvoice && inv.pmApproved === true && inv.status !== "PAID")) {
        counts.PM_APPROVED += 1;
      }
      
      // PAID count
      if (inv.status === "PAID") {
        counts.PAID += 1;
      }
      
      // OVERDUE count
      if (inv.status === "OVERDUE") {
        counts.OVERDUE += 1;
      }
    });
    
    return counts;
  }, [pmInvoices, regularInvoices]);

  const downloadPdfMutation = useMutation(
    trpc.generatePropertyManagerInvoicePdf.mutationOptions({
      onSuccess: (data) => {
        if (data.pdf) {
          // Convert base64 to blob
          const byteCharacters = atob(data.pdf);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          
          // Create a temporary link element to trigger download
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the URL object
          window.URL.revokeObjectURL(url);
        }
        toast.success("PDF downloaded successfully!");
        setDownloadingInvoiceId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF.");
        setDownloadingInvoiceId(null);
      },
    })
  );

  const downloadRegularInvoicePdfMutation = useMutation(
    trpc.generateInvoicePdf.mutationOptions({
      onSuccess: (data) => {
        if (data.pdf) {
          // Convert base64 to blob
          const byteCharacters = atob(data.pdf);
          const byteNumbers = new Array(byteCharacters.length);
          for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'application/pdf' });
          const url = window.URL.createObjectURL(blob);
          
          // Create a temporary link element to trigger download
          const link = document.createElement('a');
          link.href = url;
          link.download = `invoice.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the URL object
          window.URL.revokeObjectURL(url);
        }
        toast.success("PDF downloaded successfully!");
        setDownloadingInvoiceId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF.");
        setDownloadingInvoiceId(null);
      },
    })
  );

  const handleDownloadPdf = (invoiceId: number, isRegularInvoice: boolean) => {
    if (!token) return;
    setDownloadingInvoiceId(invoiceId);
    if (isRegularInvoice) {
      downloadRegularInvoicePdfMutation.mutate({
        token,
        invoiceId,
      });
    } else {
      downloadPdfMutation.mutate({
        token,
        invoiceId,
      });
    }
  };

  const approveInvoiceMutation = useMutation(
    trpc.updatePropertyManagerInvoiceStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice approved successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerInvoices.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to approve invoice.");
      },
    })
  );

  const rejectInvoiceMutation = useMutation(
    trpc.updatePropertyManagerInvoiceStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice rejected.");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerInvoices.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to reject invoice.");
      },
    })
  );

  const markPaidMutation = useMutation(
    trpc.updatePropertyManagerInvoiceStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice marked as paid!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerInvoices.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to mark invoice as paid.");
      },
    })
  );

  // Mutation for regular invoice status updates
  const updateRegularInvoiceMutation = useMutation(
    trpc.updateInvoiceStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice updated successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getInvoices.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update invoice.");
      },
    })
  );

  const handleApprove = (invoiceId: number, isRegularInvoice: boolean) => {
    if (!token) return;
    if (confirm("Are you sure you want to approve this invoice?")) {
      if (isRegularInvoice) {
        // For regular invoices, mark as PM approved (don't change status to PAID yet)
        updateRegularInvoiceMutation.mutate({
          token,
          invoiceId,
          pmApproved: true,
        });
      } else {
        // For PropertyManagerInvoices, use the PM-specific action
        approveInvoiceMutation.mutate({
          token,
          invoiceId,
          action: "APPROVE",
        });
      }
    }
  };

  const handleReject = (invoiceId: number, isRegularInvoice: boolean) => {
    if (!token) return;
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      if (isRegularInvoice) {
        // For regular invoices, move to REJECTED status
        updateRegularInvoiceMutation.mutate({
          token,
          invoiceId,
          status: "REJECTED",
        });
      } else {
        // For PropertyManagerInvoices, use the PM-specific action
        rejectInvoiceMutation.mutate({
          token,
          invoiceId,
          action: "REJECT",
          rejectionReason: reason,
        });
      }
    }
  };

  const handleMarkPaid = (invoiceId: number, isRegularInvoice: boolean) => {
    if (!token) return;
    if (confirm("Are you sure you want to mark this invoice as paid?")) {
      if (isRegularInvoice) {
        // For regular invoices, update status to PAID
        updateRegularInvoiceMutation.mutate({
          token,
          invoiceId,
          status: "PAID",
        });
      } else {
        // For PropertyManagerInvoices, use the PM-specific action
        markPaidMutation.mutate({
          token,
          invoiceId,
          action: "MARK_PAID",
        });
      }
    }
  };

  const statusOptions = ["ALL", "SENT_TO_PM", "PM_APPROVED", "PAID", "OVERDUE"] as const;

  if (pmInvoicesQuery.isLoading || regularInvoicesQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading invoices...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Create Button */}
      <div className="flex justify-end">
        <button
          onClick={onCreateClick}
          className="px-4 py-2 text-white bg-teal-600 hover:bg-teal-700 rounded-lg font-medium flex items-center gap-2 transition-colors"
        >
          <Plus className="w-5 h-5" />
          Create Invoice
        </button>
      </div>
      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by invoice number, customer name or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status.replace(/_/g, " ")} ({invoiceStatusCounts[status as keyof typeof invoiceStatusCounts] || 0})
            </button>
          ))}
        </div>
      </div>
      {/* Invoices List */}
      {invoices.length === 0 ? (
        <div className="text-center py-16">
          <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Invoices Found</h3>
          <p className="text-sm text-gray-600">
            You don't have any invoices in this status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice: any) => (
            <div
              key={invoice.id}
              className="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <h4 className="text-md font-semibold text-gray-900">{invoice.invoiceNumber}</h4>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                    invoice.status === "PAID"
                      ? "bg-green-100 text-green-700"
                      : invoice.status === "PM_APPROVED"
                      ? "bg-blue-100 text-blue-700"
                      : invoice.status === "OVERDUE"
                      ? "bg-red-100 text-red-700"
                      : "bg-orange-100 text-orange-700"
                  }`}
                >
                  {invoice.status.replace(/_/g, " ")}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700 mb-3">
                {invoice.order && (
                  <>
                    <p><strong>Order:</strong> {invoice.order.orderNumber}</p>
                    <p><strong>Building:</strong> {invoice.order.buildingName || "N/A"}</p>
                  </>
                )}
                <p><strong>Total:</strong> R{invoice.total.toLocaleString()}</p>
                {invoice.dueDate && (
                  <p><strong>Due:</strong> {new Date(invoice.dueDate).toLocaleDateString()}</p>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 mt-4">
                {/* Download PDF button */}
                <button
                  onClick={() => handleDownloadPdf(invoice.id, invoice.isRegularInvoice || false)}
                  disabled={downloadingInvoiceId === invoice.id}
                  className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                >
                  {downloadingInvoiceId === invoice.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  Download PDF
                </button>
                {/* Show approve/reject only for invoices that haven't been approved yet */}
                {((invoice.status === "SENT_TO_PM" || invoice.status === "ADMIN_APPROVED") || 
                  (invoice.isRegularInvoice && (invoice.status === "SENT" || invoice.status === "PENDING_APPROVAL") && !invoice.pmApproved)) && (
                  <>
                    <button
                      onClick={() => handleApprove(invoice.id, invoice.isRegularInvoice || false)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleReject(invoice.id, invoice.isRegularInvoice || false)}
                      className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                    >
                      Reject
                    </button>
                  </>
                )}
                {(invoice.status === "PM_APPROVED" || (invoice.isRegularInvoice && invoice.pmApproved && invoice.status !== "PAID")) && (
                  <button
                    onClick={() => handleMarkPaid(invoice.id, invoice.isRegularInvoice || false)}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Mark as Paid
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MaintenanceTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("SUBMITTED");
  const [showCreateModal, setShowCreateModal] = useState(false);
  // For demo purposes, using a mock customer ID - in real app, this would come from a customer selection
  const mockCustomerId = 1;

  const maintenanceRequestsQuery = useQuery({
    ...trpc.getMaintenanceRequests.queryOptions({
      token: token!,
      status: statusFilter === "ALL" ? undefined : statusFilter,
    }),
    enabled: !!token,
    retry: 1,
    staleTime: 10000,
  });

  const requests = (maintenanceRequestsQuery.data as any[]) || [];

  const updateStatusMutation = useMutation(
    trpc.updateMaintenanceRequestStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Request status updated!");
        queryClient.invalidateQueries({
          queryKey: trpc.getMaintenanceRequests.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update status.");
      },
    })
  );

  const handleStatusUpdate = (requestId: number, status: string) => {
    if (!token) return;
    
    let responseNotes = "";
    let rejectionReason = "";
    
    if (status === "REJECTED") {
      rejectionReason = prompt("Please provide a reason for rejection:") || "";
      if (!rejectionReason) return;
    } else if (status === "APPROVED") {
      responseNotes = prompt("Add any notes for the tenant (optional):") || "";
    }

    updateStatusMutation.mutate({
      token,
      requestId,
      status: status as any,
      responseNotes: responseNotes || undefined,
      rejectionReason: rejectionReason || undefined,
    });
  };

  const statusOptions = ["ALL", "SUBMITTED", "REVIEWED", "APPROVED", "IN_PROGRESS", "COMPLETED"];

  if (maintenanceRequestsQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading maintenance requests...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateMaintenanceRequestModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        customerId={mockCustomerId}
      />
      {/* Filter Buttons and Create Button */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap gap-2">
          {statusOptions.map((status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                statusFilter === status
                  ? "bg-teal-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              {status.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors shadow-md"
        >
          <Plus className="h-5 w-5 mr-2" />
          Create Request
        </button>
      </div>
      {/* Requests List */}
      {requests.length === 0 ? (
        <div className="text-center py-16">
          <Wrench className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Maintenance Requests Found</h3>
          <p className="text-sm text-gray-600">
            No maintenance requests in this status.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((request: any) => (
            <div
              key={request.id}
              className="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              <div className="flex justify-between items-start mb-3">
                <div>
                  <h4 className="text-md font-semibold text-gray-900">{request.requestNumber} - {request.title}</h4>
                  <p className="text-sm text-gray-600">
                    {request.customer.firstName} {request.customer.lastName} - {request.customer.unitNumber || "N/A"}
                  </p>
                </div>
                <div className="flex items-center space-x-2">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      request.status === "COMPLETED"
                        ? "bg-green-100 text-green-700"
                        : request.status === "APPROVED"
                        ? "bg-blue-100 text-blue-700"
                        : request.status === "REJECTED"
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {request.status}
                  </span>
                  <span
                    className={`h-2.5 w-2.5 rounded-full ${
                      request.urgency === "URGENT"
                        ? "bg-red-500"
                        : request.urgency === "HIGH"
                        ? "bg-orange-500"
                        : "bg-blue-500"
                    }`}
                    title={request.urgency}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700 mb-2">
                <p><strong>Category:</strong> {request.category}</p>
                <p><strong>Urgency:</strong> {request.urgency}</p>
                <p><strong>Building:</strong> {request.buildingName || "N/A"}</p>
                <p><strong>Address:</strong> {request.address}</p>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2">{request.description}</p>

              {/* Photos */}
              {request.photos && request.photos.length > 0 && (
                <div className="mt-3 flex gap-2 overflow-x-auto">
                  {request.photos.slice(0, 3).map((photo: string, idx: number) => (
                    <img
                      key={idx}
                      src={photo}
                      alt={`Issue photo ${idx + 1}`}
                      className="h-20 w-20 object-cover rounded border"
                    />
                  ))}
                  {request.photos.length > 3 && (
                    <div className="h-20 w-20 flex items-center justify-center bg-gray-200 rounded border text-sm text-gray-600">
                      +{request.photos.length - 3}
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons */}
              {request.status === "SUBMITTED" && (
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => handleStatusUpdate(request.id, "APPROVED")}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleStatusUpdate(request.id, "REJECTED")}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                  >
                    Reject
                  </button>
                </div>
              )}
              {request.status === "APPROVED" && (
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => handleStatusUpdate(request.id, "IN_PROGRESS")}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                  >
                    Mark In Progress
                  </button>
                </div>
              )}
              {request.status === "IN_PROGRESS" && (
                <div className="flex justify-end space-x-2 mt-4">
                  <button
                    onClick={() => handleStatusUpdate(request.id, "COMPLETED")}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
                  >
                    Mark Completed
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BuildingsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const buildingsQuery = useQuery({
    ...trpc.getBuildings.queryOptions({
      token: token!,
    }),
    enabled: !!token,
    retry: 1,
    staleTime: 30000,
  });

  const buildings = (buildingsQuery.data as any[]) || [];

  if (buildingsQuery.isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading buildings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateBuildingModal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)} />
      {/* Header with Add Button */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Your Buildings</h3>
        <button
          onClick={() => setShowCreateModal(true)}
          className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md"
        >
          <Plus className="h-5 w-5 mr-2" />
          Add Building
        </button>
      </div>
      {/* Buildings List */}
      {buildings.length === 0 ? (
        <div className="text-center py-16">
          <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Buildings Yet</h3>
          <p className="text-sm text-gray-600 mb-6">
            Start by adding your first building to manage your portfolio.
          </p>
          <button
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Your First Building
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {buildings.map((building: any) => (
            <div
              key={building.id}
              className="bg-white p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Building Photo */}
              {building.photos && building.photos.length > 0 ? (
                <img
                  src={building.photos[0]}
                  alt={building.name}
                  className="w-full h-40 object-cover rounded-lg mb-3"
                />
              ) : (
                <div className="w-full h-40 bg-gray-100 rounded-lg mb-3 flex items-center justify-center">
                  <Building2 className="h-12 w-12 text-gray-400" />
                </div>
              )}

              <h4 className="text-md font-semibold text-gray-900 mb-2">{building.name}</h4>
              <p className="text-sm text-gray-600 mb-3">{building.address}</p>

              <div className="space-y-1 text-sm text-gray-700">
                <p>
                  <strong>Type:</strong> {building.buildingType.replace(/_/g, " ")}
                </p>
                {building.numberOfUnits && (
                  <p>
                    <strong>Units:</strong> {building.numberOfUnits}
                  </p>
                )}
                {building.estimatedValue && (
                  <p>
                    <strong>Value:</strong> R{building.estimatedValue.toLocaleString()}
                  </p>
                )}
                <p>
                  <span
                    className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${
                      building.status === "ACTIVE"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {building.status}
                  </span>
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function BudgetsTab() {
  return <BuildingBudgetTracker />;
}
