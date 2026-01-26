import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import {
  Package,
  FileText,
  Receipt,
  FolderKanban,
  Clock,
  CheckCircle2,
  AlertCircle,
  DollarSign,
  Calendar,
  MapPin,
  XCircle,
  MessageSquare,
  Download,
  Loader2,
  Star,
  Wrench,
  Home,
  User,
  BarChart3,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { ReviewModal } from "~/components/customer/ReviewModal";
import { SupportChatWidget } from "~/components/SupportChatWidget";
import { FileAttachment } from "~/components/FileAttachment";
import { MetricCard } from "~/components/MetricCard";
import { NotificationDropdown } from "~/components/NotificationDropdown";
import { PaymentModal } from "~/components/customer/PaymentModal";

export const Route = createFileRoute("/customer/dashboard/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user, token, clearAuth } = useAuthStore.getState();
    if (!user || user.role !== "CUSTOMER" || !token) {
      if (!token) {
        clearAuth();
      }
      throw redirect({
        to: "/",
        search: {
          redirect: location.href,
        },
      });
    }
  },
  component: CustomerDashboard,
});

function CustomerDashboard() {
  const { user, token } = useAuthStore();
  const trpc = useTRPC();
  const hasHandledAuthErrorRef = useRef(false);
  const [activeTab, setActiveTab] = useState<"orders" | "quotations" | "invoices" | "projects" | "messages" | "statements">("orders");
  const [showMetrics, setShowMetrics] = useState(false);
  const [generatingQuotePdfId, setGeneratingQuotePdfId] = useState<number | null>(null);
  const [generatingInvoicePdfId, setGeneratingInvoicePdfId] = useState<number | null>(null);
  const [generatingStatementPdfId, setGeneratingStatementPdfId] = useState<number | null>(null);
  const [generatingOrderPdfId, setGeneratingOrderPdfId] = useState<number | null>(null);
  const [generatingWeeklyReportPdfId, setGeneratingWeeklyReportPdfId] = useState<number | null>(null);
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [reviewData, setReviewData] = useState<{
    artisanId: number;
    artisanName: string;
    orderId?: number;
    orderNumber?: string;
    projectId?: number;
    projectName?: string;
  } | null>(null);

  const handleOpenReviewModal = (data: {
    artisanId: number;
    artisanName: string;
    orderId?: number;
    orderNumber?: string;
    projectId?: number;
    projectName?: string;
  }) => {
    setReviewData(data);
    setReviewModalOpen(true);
  };

  const handleCloseReviewModal = () => {
    setReviewModalOpen(false);
    setReviewData(null);
  };

  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  const quotationsQuery = useQuery(
    trpc.getQuotations.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  const invoicesQuery = useQuery(
    trpc.getInvoices.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  const projectsQuery = useQuery(
    trpc.getProjects.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  const messagesQuery = useQuery(
    trpc.getConversations.queryOptions({
      token: token!,
    }, {
      refetchInterval: 10000, // Poll every 10 seconds for messages
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  // Fetch customer profile to get expected rent amount
  const customerProfileQuery = useQuery(
    trpc.getCurrentUser.queryOptions({
      token: token!,
    }, {
      enabled: !!token,
    })
  );

  const customerProfile = customerProfileQuery.data?.customerProfile;
  const expectedRentAmount = customerProfile?.monthlyRent;

  const statementsQuery = useQuery(
    trpc.getStatements.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
      enabled: !!token,
    })
  );

  useEffect(() => {
    if (hasHandledAuthErrorRef.current) return;

    const errors = [
      ordersQuery.error,
      quotationsQuery.error,
      invoicesQuery.error,
      projectsQuery.error,
      messagesQuery.error,
      statementsQuery.error,
      customerProfileQuery.error,
    ].filter(Boolean) as Array<{ message?: string }>;

    const authError = errors.find((e) => {
      const message = (e?.message || "").toLowerCase();
      return (
        message.includes("invalid or expired token") ||
        message.includes("authentication required") ||
        message.includes("unauthorized")
      );
    });

    if (!authError) return;

    hasHandledAuthErrorRef.current = true;
    toast.error("Your session has expired. Please log in again.");
    useAuthStore.getState().clearAuth();
    window.location.href = "/";
  }, [
    ordersQuery.error,
    quotationsQuery.error,
    invoicesQuery.error,
    projectsQuery.error,
    messagesQuery.error,
    statementsQuery.error,
    customerProfileQuery.error,
  ]);

  const orders = ordersQuery.data || [];
  const quotations = quotationsQuery.data || [];
  const invoices = invoicesQuery.data || [];
  const projects = projectsQuery.data || [];
  const conversations = messagesQuery.data || [];
  const statements = statementsQuery.data || [];

  // Memoize derived data to ensure proper recalculation
  const activeOrders = useMemo(() => 
    orders.filter((o) => ["PENDING", "ASSIGNED", "IN_PROGRESS"].includes(o.status)),
    [orders]
  );
  
  const completedOrders = useMemo(() => 
    orders.filter((o) => o.status === "COMPLETED"),
    [orders]
  );
  
  const pendingQuotations = useMemo(() => 
    quotations.filter((q) => ["DRAFT", "SUBMITTED"].includes(q.status)),
    [quotations]
  );
  
  const unpaidInvoices = useMemo(() => 
    invoices.filter((i) => ["SENT", "OVERDUE"].includes(i.status)),
    [invoices]
  );
  
  const unpaidStatements = useMemo(() => 
    statements.filter((s) => ["sent", "viewed", "overdue"].includes(s.status) && (s.total_amount_due ?? 0) > 0),
    [statements]
  );
  
  const unreadConversations = useMemo(() => 
    conversations.filter((c) => c.unreadCount > 0),
    [conversations]
  );

  const tabs = useMemo(() => [
    { id: "orders" as const, label: "Orders", count: orders.length },
    { id: "quotations" as const, label: "Quotations", count: quotations.length },
    { id: "invoices" as const, label: "Invoices", count: invoices.length },
    { id: "statements" as const, label: "Statements", count: statements.length },
    { id: "projects" as const, label: "Projects", count: projects.length },
    { id: "messages" as const, label: "Messages", count: conversations.length },
  ], [orders.length, quotations.length, invoices.length, statements.length, projects.length, conversations.length]);

  const generateQuotationPdfMutation = useMutation(
    trpc.generateQuotationPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const quotation = quotations.find(q => q.id === variables.quotationId);
        link.download = `quotation-${quotation?.quoteNumber || variables.quotationId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Quotation PDF downloaded successfully!");
        setGeneratingQuotePdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate quotation PDF");
        setGeneratingQuotePdfId(null);
      },
    })
  );

  const generateInvoicePdfMutation = useMutation(
    trpc.generateInvoicePdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const invoice = invoices.find(i => i.id === variables.invoiceId);
        link.download = `invoice-${invoice?.invoiceNumber || variables.invoiceId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Invoice PDF downloaded successfully!");
        setGeneratingInvoicePdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate invoice PDF");
        setGeneratingInvoicePdfId(null);
      },
    })
  );

  const generateStatementPdfMutation = useMutation(
    trpc.generateStatementPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const statement = statements.find(s => s.id === variables.statementId);
        link.download = `statement-${statement?.statement_number || variables.statementId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Statement PDF downloaded successfully!");
        setGeneratingStatementPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate statement PDF");
        setGeneratingStatementPdfId(null);
      },
    })
  );

  const generateOrderPdfMutation = useMutation(
    trpc.generateOrderPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const order = orders.find(o => o.id === variables.orderId);
        link.download = `order-${order?.orderNumber || variables.orderId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Order summary PDF downloaded successfully!");
        setGeneratingOrderPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate order PDF");
        setGeneratingOrderPdfId(null);
      },
    })
  );

  const generateWeeklyReportPdfMutation = useMutation(
    trpc.generateWeeklyUpdatePdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `weekly-report-${variables.updateId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Weekly report downloaded successfully!");
        setGeneratingWeeklyReportPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate weekly report PDF");
        setGeneratingWeeklyReportPdfId(null);
      },
    })
  );

  const handleExportQuotationPdf = (quotationId: number) => {
    setGeneratingQuotePdfId(quotationId);
    generateQuotationPdfMutation.mutate({
      token: token!,
      quotationId,
    });
  };

  const handleExportInvoicePdf = (invoiceId: number) => {
    setGeneratingInvoicePdfId(invoiceId);
    generateInvoicePdfMutation.mutate({
      token: token!,
      invoiceId,
    });
  };

  const handleExportStatementPdf = (statementId: number) => {
    setGeneratingStatementPdfId(statementId);
    generateStatementPdfMutation.mutate({
      token: token!,
      statementId,
    });
  };

  const handleExportOrderPdf = (orderId: number) => {
    setGeneratingOrderPdfId(orderId);
    generateOrderPdfMutation.mutate({
      token: token!,
      orderId,
    });
  };

  const handleExportWeeklyReportPdf = (updateId: number) => {
    setGeneratingWeeklyReportPdfId(updateId);
    generateWeeklyReportPdfMutation.mutate({
      token: token!,
      updateId,
      forCustomer: true, // Explicitly set to true for customer downloads
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50">
      {/* Header with Gradient */}
      <header className="bg-gradient-to-r from-purple-600 via-pink-600 to-indigo-600 shadow-lg sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-white/10 backdrop-blur-sm rounded-xl">
                <Home className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">Customer Portal</h1>
                <p className="text-sm text-purple-100">Welcome, {user?.firstName}!</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                className="relative inline-flex items-center justify-center p-2 rounded-lg text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200"
                title="Toggle Metrics"
              >
                <BarChart3 className="h-6 w-6" />
              </button>
              <NotificationDropdown />
              <button
                onClick={() => setPaymentModalOpen(true)}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 flex items-center gap-2 transition-all duration-200"
              >
                <DollarSign className="h-4 w-4" />
                <span>Payments</span>
              </button>
              <Link
                to="/customer/maintenance"
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 flex items-center gap-2 transition-all duration-200"
              >
                <Wrench className="h-4 w-4" />
                <span>Maintenance</span>
              </Link>
              <Link
                to="/customer/feedback"
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 flex items-center gap-2 transition-all duration-200"
              >
                <MessageSquare className="h-4 w-4" />
                <span>Complaints &amp; Compliments</span>
              </Link>
              <Link
                to="/"
                onClick={() => useAuthStore.getState().clearAuth()}
                className="px-4 py-2 text-sm font-medium text-white bg-white/10 backdrop-blur-sm border border-white/20 rounded-lg hover:bg-white/20 transition-all duration-200"
              >
                Logout
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8" style={{ position: 'relative', zIndex: 1 }}>
        {/* Metrics */}
        {showMetrics && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-5 mb-8">
          <MetricCard
            name="Active Orders"
            value={activeOrders.length}
            icon={Package}
            color="blue"
            gradient={true}
          />
          <MetricCard
            name="Pending Quotations"
            value={pendingQuotations.length}
            icon={FileText}
            color="purple"
            gradient={true}
          />
          <MetricCard
            name="Unpaid Statements"
            value={unpaidStatements.length}
            icon={Receipt}
            color="orange"
            gradient={true}
          />
          <MetricCard
            name="Unread Messages"
            value={unreadConversations.length}
            icon={MessageSquare}
            color="green"
            gradient={true}
          />
          <Link
            to="/customer/maintenance"
            className="block bg-gradient-to-br from-teal-500 to-teal-600 rounded-xl shadow-lg hover:shadow-xl transition-all p-6 text-white"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-teal-100">Maintenance</p>
                <p className="mt-2 text-3xl font-bold">Requests</p>
              </div>
              <div className="p-3 bg-teal-100 rounded-lg">
                <Wrench className="h-8 w-8" />
              </div>
            </div>
            <p className="mt-4 text-sm">Submit & track requests →</p>
          </Link>
        </div>
        )}

        {/* Modern Pill-style Tabs */}
        <div className="bg-white rounded-xl shadow-lg border border-gray-100 mb-8 overflow-hidden">
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 px-6 py-4 border-b border-gray-100">
            <nav className="flex gap-2 overflow-x-auto">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`py-2.5 px-5 rounded-lg font-medium text-sm whitespace-nowrap transition-all duration-200 ${
                    activeTab === tab.id
                      ? "bg-gradient-to-r from-purple-600 to-pink-600 text-white shadow-lg shadow-purple-500/50"
                      : "bg-white text-gray-600 hover:bg-gray-50 hover:text-purple-600"
                  }`}
                >
                  {tab.label}
                  {tab.count > 0 && (
                    <span
                      className={`ml-2 py-0.5 px-2 rounded-full text-xs font-semibold ${
                        activeTab === tab.id
                          ? "bg-white/20 text-white"
                          : "bg-purple-100 text-purple-700"
                      }`}
                    >
                      {tab.count}
                    </span>
                  )}
                </button>
              ))}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === "orders" && (
              <OrdersTab
                activeOrders={activeOrders}
                completedOrders={completedOrders}
                onOpenReviewModal={handleOpenReviewModal}
                onExportPdf={handleExportOrderPdf}
                generatingPdfId={generatingOrderPdfId}
                isGenerating={generateOrderPdfMutation.isPending}
              />
            )}
            {activeTab === "quotations" && (
              <QuotationsTab 
                quotations={quotations}
                onExportPdf={handleExportQuotationPdf}
                generatingPdfId={generatingQuotePdfId}
                isGenerating={generateQuotationPdfMutation.isPending}
              />
            )}
            {activeTab === "invoices" && (
              <InvoicesTab 
                invoices={invoices}
                onExportPdf={handleExportInvoicePdf}
                generatingPdfId={generatingInvoicePdfId}
                isGenerating={generateInvoicePdfMutation.isPending}
                token={token || ""}
              />
            )}
            {activeTab === "statements" && (
              <StatementsTab 
                statements={statements}
                onExportPdf={handleExportStatementPdf}
                generatingPdfId={generatingStatementPdfId}
                isGenerating={generateStatementPdfMutation.isPending}
              />
            )}
            {activeTab === "projects" && (
              <ProjectsTab 
                projects={projects}
                onOpenReviewModal={handleOpenReviewModal}
                onExportWeeklyReportPdf={handleExportWeeklyReportPdf}
                generatingWeeklyReportPdfId={generatingWeeklyReportPdfId}
                isGeneratingWeeklyReport={generateWeeklyReportPdfMutation.isPending}
                token={token || ""}
              />
            )}
            {activeTab === "messages" && (
              <MessagesTab conversations={conversations} userId={user?.id} />
            )}
          </div>
        </div>
      </main>

      {/* Review Modal */}
      {reviewData && (
        <ReviewModal
          isOpen={reviewModalOpen}
          onClose={handleCloseReviewModal}
          artisanId={reviewData.artisanId}
          artisanName={reviewData.artisanName}
          orderId={reviewData.orderId}
          orderNumber={reviewData.orderNumber}
          projectId={reviewData.projectId}
          projectName={reviewData.projectName}
        />
      )}

      {/* Payment Modal */}
      <PaymentModal
        isOpen={paymentModalOpen}
        onClose={() => setPaymentModalOpen(false)}
        expectedRentAmount={expectedRentAmount}
      />

      {/* Support Chat Widget */}
      <SupportChatWidget />
    </div>
  );
}

function OrdersTab({
  activeOrders,
  completedOrders,
  onOpenReviewModal,
  onExportPdf,
  generatingPdfId,
  isGenerating,
}: {
  activeOrders: any[];
  completedOrders: any[];
  onOpenReviewModal: (data: {
    artisanId: number;
    artisanName: string;
    orderId?: number;
    orderNumber?: string;
  }) => void;
  onExportPdf: (orderId: number) => void;
  generatingPdfId: number | null;
  isGenerating: boolean;
}) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      PENDING: {
        label: "Pending",
        className: "bg-yellow-100 text-yellow-800",
        icon: Clock,
      },
      ASSIGNED: {
        label: "Assigned",
        className: "bg-blue-100 text-blue-800",
        icon: Clock,
      },
      IN_PROGRESS: {
        label: "In Progress",
        className: "bg-indigo-100 text-indigo-800",
        icon: Clock,
      },
      COMPLETED: {
        label: "Completed",
        className: "bg-green-100 text-green-800",
        icon: CheckCircle2,
      },
      CANCELLED: {
        label: "Cancelled",
        className: "bg-red-100 text-red-800",
        icon: XCircle,
      },
    };

    const badge = badges[status] || badges.PENDING;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  if (activeOrders.length === 0 && completedOrders.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No orders yet</h3>
        <p className="text-sm text-gray-600">Your service requests will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Active Orders</h3>
          <div className="space-y-4">
            {activeOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-50 rounded-lg border border-gray-200 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{order.orderNumber}</h4>
                    <p className="text-sm text-gray-600 mt-1">{order.serviceType}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                    {order.address}
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                    Created: {new Date(order.createdAt).toLocaleDateString()}
                  </div>
                  {order.assignedTo && (
                    <div className="flex items-center text-sm text-gray-600">
                      <CheckCircle2 className="h-4 w-4 mr-2 text-gray-400" />
                      Assigned to: {order.assignedTo.firstName} {order.assignedTo.lastName}
                    </div>
                  )}
                </div>

                <div className="bg-white rounded-md p-3 border border-gray-200">
                  <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
                  <p className="text-sm text-gray-600">{order.description}</p>
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => onExportPdf(order.id)}
                    disabled={isGenerating && generatingPdfId === order.id}
                    className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isGenerating && generatingPdfId === order.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Order Summary
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Completed Orders */}
      {completedOrders.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Completed Orders</h3>
          <div className="space-y-4">
            {completedOrders.map((order) => (
              <div
                key={order.id}
                className="bg-gray-50 rounded-lg border border-gray-200 p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="text-base font-semibold text-gray-900">{order.orderNumber}</h4>
                    <p className="text-sm text-gray-600 mt-1">{order.serviceType}</p>
                  </div>
                  {getStatusBadge(order.status)}
                </div>

                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Completed: {order.endTime ? new Date(order.endTime).toLocaleDateString() : "N/A"}
                  </div>
                  {order.assignedTo && (
                    <button
                      onClick={() =>
                        onOpenReviewModal({
                          artisanId: order.assignedTo.id,
                          artisanName: `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
                          orderId: order.id,
                          orderNumber: order.orderNumber,
                        })
                      }
                      className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Star className="h-4 w-4 mr-1" />
                      Leave Review
                    </button>
                  )}
                </div>

                <div className="mt-4">
                  <button
                    onClick={() => onExportPdf(order.id)}
                    disabled={isGenerating && generatingPdfId === order.id}
                    className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {isGenerating && generatingPdfId === order.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Generating PDF...
                      </>
                    ) : (
                      <>
                        <Download className="h-4 w-4 mr-2" />
                        Download Order Summary
                      </>
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuotationsTab({ 
  quotations,
  onExportPdf,
  generatingPdfId,
  isGenerating,
}: { 
  quotations: any[];
  onExportPdf: (quotationId: number) => void;
  generatingPdfId: number | null;
  isGenerating: boolean;
}) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800" },
      PENDING_ARTISAN_REVIEW: { label: "Being Reviewed", className: "bg-yellow-100 text-yellow-800" },
      IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      PENDING_JUNIOR_MANAGER_REVIEW: { label: "Under Review", className: "bg-orange-100 text-orange-800" },
      PENDING_SENIOR_MANAGER_REVIEW: { label: "Under Review", className: "bg-orange-100 text-orange-800" },
      APPROVED: { label: "Approved", className: "bg-green-100 text-green-800" },
      REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800" },
      SUBMITTED: { label: "Submitted", className: "bg-blue-100 text-blue-800" }, // Deprecated
    };

    const badge = badges[status] || badges.DRAFT;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  if (quotations.length === 0) {
    return (
      <div className="text-center py-12">
        <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No quotations yet</h3>
        <p className="text-sm text-gray-600">Your quotations will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {quotations.map((quote) => {
        const items = Array.isArray(quote.items) ? quote.items : [];
        
        return (
          <div
            key={quote.id}
            className="bg-gray-50 rounded-lg border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{quote.quoteNumber}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Created: {new Date(quote.createdAt).toLocaleDateString()}
                </p>
                {quote.validUntil && (
                  <p className="text-sm text-gray-600">
                    Valid until: {new Date(quote.validUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
              {getStatusBadge(quote.status)}
            </div>

            <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Items</h5>
              <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-900">{item.description}</span>
                      <span className="text-gray-500 ml-2">
                        (Qty: {item.quantity} @ R{item.unitPrice})
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">
                      R{item.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">R{quote.subtotal.toLocaleString()}</span>
                </div>
                {quote.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">R{quote.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-gray-900">R{quote.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {quote.notes && (
              <div className="bg-white rounded-md p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                <p className="text-sm text-gray-600">{quote.notes}</p>
              </div>
            )}

            {quote.status === "APPROVED" && (
              <div className="mt-4">
                <button
                  onClick={() => onExportPdf(quote.id)}
                  disabled={isGenerating && generatingPdfId === quote.id}
                  className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating && generatingPdfId === quote.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Quotation PDF
                    </>
                  )}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function InvoicesTab({ 
  invoices,
  onExportPdf,
  generatingPdfId,
  isGenerating,
  token,
}: { 
  invoices: any[];
  onExportPdf: (invoiceId: number) => void;
  generatingPdfId: number | null;
  isGenerating: boolean;
  token: string;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const setMyInvoiceDisputeStatusMutation = useMutation(
    trpc.setMyInvoiceDisputeStatus.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(res?.message || "Updated dispute status");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to update dispute status");
      },
    })
  );

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      DRAFT: { label: "Draft", className: "bg-gray-100 text-gray-800", icon: FileText },
      PENDING_REVIEW: { label: "Pending Review", className: "bg-yellow-100 text-yellow-800", icon: Clock },
      PENDING_APPROVAL: { label: "Pending Approval", className: "bg-orange-100 text-orange-800", icon: Clock },
      SENT: { label: "Sent", className: "bg-blue-100 text-blue-800", icon: Clock },
      PAID: { label: "Paid", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
      OVERDUE: { label: "Overdue", className: "bg-red-100 text-red-800", icon: AlertCircle },
      DISPUTED: { label: "Disputed", className: "bg-rose-100 text-rose-800", icon: AlertCircle },
      CANCELLED: { label: "Cancelled", className: "bg-gray-100 text-gray-800", icon: XCircle },
      REJECTED: { label: "Rejected", className: "bg-red-100 text-red-800", icon: XCircle },
    };

    const badge = badges[status] || badges.DRAFT;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  if (invoices.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices yet</h3>
        <p className="text-sm text-gray-600">Your invoices will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {invoices.map((invoice) => {
        const items = Array.isArray(invoice.items) ? invoice.items : [];
        const effectiveStatus = (invoice as any).isDisputed ? "DISPUTED" : invoice.status;
        
        return (
          <div
            key={invoice.id}
            className="bg-gray-50 rounded-lg border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">{invoice.invoiceNumber}</h4>
                <p className="text-sm text-gray-600 mt-1">
                  Created: {new Date(invoice.createdAt).toLocaleDateString()}
                </p>
                {invoice.dueDate && (
                  <p className="text-sm text-gray-600">
                    Due: {new Date(invoice.dueDate).toLocaleDateString()}
                  </p>
                )}
                {invoice.paidDate && (
                  <p className="text-sm text-green-600">
                    Paid: {new Date(invoice.paidDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              {getStatusBadge(effectiveStatus)}
            </div>

            {invoice.order && (
              <div className="mb-4 text-sm text-gray-600">
                Related to order: <span className="font-medium">{invoice.order.orderNumber}</span>
              </div>
            )}

            {invoice.project && (
              <div className="mb-4 text-sm text-gray-600">
                Related to project: <span className="font-medium">{invoice.project.name}</span>
              </div>
            )}

            <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Items</h5>
              <div className="space-y-2">
                {items.map((item: any, idx: number) => (
                  <div key={idx} className="flex justify-between text-sm">
                    <div>
                      <span className="text-gray-900">{item.description}</span>
                      <span className="text-gray-500 ml-2">
                        (Qty: {item.quantity} @ R{item.unitPrice})
                      </span>
                    </div>
                    <span className="font-medium text-gray-900">
                      R{item.total.toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-200 mt-3 pt-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="text-gray-900">R{invoice.subtotal.toLocaleString()}</span>
                </div>
                {invoice.tax > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Tax:</span>
                    <span className="text-gray-900">R{invoice.tax.toLocaleString()}</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-semibold">
                  <span className="text-gray-900">Total:</span>
                  <span className="text-gray-900">R{invoice.total.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {invoice.notes && (
              <div className="bg-white rounded-md p-3 border border-gray-200">
                <p className="text-sm font-medium text-gray-700 mb-1">Notes:</p>
                <p className="text-sm text-gray-600">{invoice.notes}</p>
              </div>
            )}

            {invoice.rejectionReason && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</p>
                <p className="text-sm text-red-700">{invoice.rejectionReason}</p>
              </div>
            )}

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {['SENT', 'OVERDUE', 'PAID'].includes(invoice.status) && (
                <button
                  onClick={() => onExportPdf(invoice.id)}
                  disabled={isGenerating && generatingPdfId === invoice.id}
                  className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating && generatingPdfId === invoice.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Invoice PDF
                    </>
                  )}
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!token) {
                    toast.error("Authentication required");
                    return;
                  }
                  setMyInvoiceDisputeStatusMutation.mutate({
                    token,
                    invoiceId: invoice.id,
                    isDisputed: effectiveStatus !== "DISPUTED",
                  });
                }}
                disabled={!token || setMyInvoiceDisputeStatusMutation.isPending}
                className={
                  effectiveStatus === "DISPUTED"
                    ? "w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors disabled:opacity-50"
                    : "w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg transition-colors disabled:opacity-50"
                }
              >
                <AlertCircle className="h-4 w-4 mr-2" />
                {effectiveStatus === "DISPUTED" ? "Resolve Dispute" : "Dispute Invoice"}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function StatementsTab({ 
  statements,
  onExportPdf,
  generatingPdfId,
  isGenerating,
}: { 
  statements: any[];
  onExportPdf: (statementId: number) => void;
  generatingPdfId: number | null;
  isGenerating: boolean;
}) {
  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string; icon: any }> = {
      generated: { label: "Generated", className: "bg-gray-100 text-gray-800", icon: FileText },
      sent: { label: "Sent", className: "bg-blue-100 text-blue-800", icon: CheckCircle2 },
      viewed: { label: "Viewed", className: "bg-indigo-100 text-indigo-800", icon: CheckCircle2 },
      paid: { label: "Paid", className: "bg-green-100 text-green-800", icon: CheckCircle2 },
      overdue: { label: "Overdue", className: "bg-red-100 text-red-800", icon: AlertCircle },
    };

    const badge = badges[status] || badges.generated;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        <Icon className="h-3 w-3 mr-1" />
        {badge.label}
      </span>
    );
  };

  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const toNumber = (value: unknown) => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : 0;
    }
    return 0;
  };

  if (statements.length === 0) {
    return (
      <div className="text-center py-12">
        <Receipt className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No statements yet</h3>
        <p className="text-sm text-gray-600">Your billing statements will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {statements.map((statement) => {
        const canDownload = ["sent", "paid", "viewed"].includes(statement.status) && statement.pdfUrl;
        const invoiceDetails = Array.isArray(statement.invoice_details) ? statement.invoice_details : [];
        
        return (
          <div
            key={statement.id}
            className="bg-gray-50 rounded-lg border border-gray-200 p-5"
          >
            <div className="flex items-start justify-between mb-4">
              <div>
                <h4 className="text-base font-semibold text-gray-900">
                  Statement #{statement.statement_number}
                </h4>
                <p className="text-sm text-gray-600 mt-1">
                  Date: {new Date(statement.statement_date).toLocaleDateString()}
                </p>
                <p className="text-sm text-gray-600">
                  Period: {new Date(statement.period_start).toLocaleDateString()} - {new Date(statement.period_end).toLocaleDateString()}
                </p>
                {statement.sent_date && (
                  <p className="text-sm text-gray-600">
                    Sent: {new Date(statement.sent_date).toLocaleDateString()}
                  </p>
                )}
              </div>
              {getStatusBadge(statement.status)}
            </div>

            <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
              <h5 className="text-sm font-semibold text-gray-900 mb-3">Account Summary</h5>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Previous Balance:</span>
                  <span className="text-gray-900">{formatCurrency(statement.previous_balance ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Payments Received:</span>
                  <span className="text-green-600">{formatCurrency(statement.payments_received ?? 0)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">New Charges:</span>
                  <span className="text-gray-900">{formatCurrency(statement.subtotal ?? 0)}</span>
                </div>
                {(statement.total_interest ?? 0) > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Interest Charges:</span>
                    <span className="text-red-600">{formatCurrency(statement.total_interest ?? 0)}</span>
                  </div>
                )}
                <div className="border-t border-gray-200 pt-2 mt-2">
                  <div className="flex justify-between text-base font-semibold">
                    <span className="text-gray-900">Total Amount Due:</span>
                    <span className="text-gray-900">{formatCurrency(statement.total_amount_due ?? 0)}</span>
                  </div>
                </div>
              </div>
            </div>

            {invoiceDetails.length > 0 && (
              <div className="bg-white rounded-md p-4 border border-gray-200 mb-4">
                <h5 className="text-sm font-semibold text-gray-900 mb-3">
                  Invoices ({invoiceDetails.length})
                </h5>
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {invoiceDetails.map((inv: any, idx: number) => (
                    (() => {
                      const daysOverdue = toNumber(inv?.days_overdue ?? inv?.age_days);
                      const totalDue = toNumber(inv?.total_due ?? inv?.amount ?? inv?.total);
                      return (
                    <div key={idx} className="flex justify-between text-sm py-1 border-b border-gray-100 last:border-0">
                      <div>
                        <span className="font-medium text-gray-900">{inv.invoice_number}</span>
                        {daysOverdue > 0 && (
                          <span className="ml-2 text-xs text-red-600">
                            ({daysOverdue} days overdue)
                          </span>
                        )}
                      </div>
                      <span className="text-gray-900">{formatCurrency(totalDue)}</span>
                    </div>
                      );
                    })()
                  ))}
                </div>
              </div>
            )}

            {statement.notes && (
              <div className="bg-blue-50 rounded-md p-3 border border-blue-200 mb-4">
                <p className="text-sm font-medium text-blue-900 mb-1">Notes:</p>
                <p className="text-sm text-blue-800">{statement.notes}</p>
              </div>
            )}

            {(statement.total_interest ?? 0) > 0 && (
              <div className="bg-red-50 rounded-md p-3 border border-red-200 mb-4">
                <div className="flex items-start">
                  <AlertCircle className="h-4 w-4 text-red-600 mr-2 mt-0.5 flex-shrink-0" />
                  <p className="text-sm text-red-800">
                    Interest charges of {formatCurrency(statement.total_interest ?? 0)} have been applied to overdue invoices. 
                    Please settle outstanding balances to avoid further charges.
                  </p>
                </div>
              </div>
            )}

            {canDownload && (
              <div className="mt-4">
                <button
                  onClick={() => onExportPdf(statement.id)}
                  disabled={isGenerating && generatingPdfId === statement.id}
                  className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isGenerating && generatingPdfId === statement.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Generating PDF...
                    </>
                  ) : (
                    <>
                      <Download className="h-4 w-4 mr-2" />
                      Download Statement PDF
                    </>
                  )}
                </button>
              </div>
            )}

            {!canDownload && (
              <div className="mt-4 text-center text-sm text-gray-500">
                PDF not yet available for this statement
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function ProjectsTab({ 
  projects,
  onOpenReviewModal,
  onExportWeeklyReportPdf,
  generatingWeeklyReportPdfId,
  isGeneratingWeeklyReport,
  token,
}: { 
  projects: any[];
  onOpenReviewModal: (data: {
    artisanId: number;
    artisanName: string;
    projectId?: number;
    projectName?: string;
  }) => void;
  onExportWeeklyReportPdf: (updateId: number) => void;
  generatingWeeklyReportPdfId: number | null;
  isGeneratingWeeklyReport: boolean;
  token: string;
}) {
  const trpc = useTRPC();
  const [expandedProjectId, setExpandedProjectId] = useState<number | null>(null);

  // Query to get milestones for a specific project when expanded
  const milestonesQuery = useQuery(
    trpc.getMilestonesByProject.queryOptions({
      token,
      projectId: expandedProjectId || 0,
    }, {
      enabled: expandedProjectId !== null,
    })
  );

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { label: string; className: string }> = {
      PLANNING: { label: "Planning", className: "bg-yellow-100 text-yellow-800" },
      IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
      ON_HOLD: { label: "On Hold", className: "bg-orange-100 text-orange-800" },
      COMPLETED: { label: "Completed", className: "bg-green-100 text-green-800" },
      CANCELLED: { label: "Cancelled", className: "bg-red-100 text-red-800" },
    };

    const badge = badges[status] || badges.PLANNING;

    return (
      <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${badge.className}`}>
        {badge.label}
      </span>
    );
  };

  if (projects.length === 0) {
    return (
      <div className="text-center py-12">
        <FolderKanban className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No projects yet</h3>
        <p className="text-sm text-gray-600">Your projects will appear here</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {projects.map((project) => (
        <div
          key={project.id}
          className="bg-gray-50 rounded-lg border border-gray-200 p-5"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h4 className="text-base font-semibold text-gray-900">{project.name}</h4>
              <p className="text-sm text-gray-600 mt-1">{project.projectNumber}</p>
              <p className="text-sm text-gray-600">{project.projectType}</p>
            </div>
            {getStatusBadge(project.status)}
          </div>

          <div className="space-y-2 mb-4">
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-2 text-gray-400" />
              {project.address}
            </div>
            {project.startDate && (
              <div className="flex items-center text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                Start: {new Date(project.startDate).toLocaleDateString()}
                {project.endDate && ` - End: ${new Date(project.endDate).toLocaleDateString()}`}
              </div>
            )}
            {project.assignedTo && (
              <div className="flex items-center text-sm text-gray-600">
                <CheckCircle2 className="h-4 w-4 mr-2 text-gray-400" />
                Assigned to: {project.assignedTo.firstName} {project.assignedTo.lastName}
              </div>
            )}
          </div>

          <div className="bg-white rounded-md p-3 border border-gray-200 mb-3">
            <p className="text-sm font-medium text-gray-700 mb-1">Description:</p>
            <p className="text-sm text-gray-600">{project.description}</p>
          </div>

          <div className="flex items-center justify-between text-sm">
            {project.estimatedBudget && (
              <div className="text-gray-600">
                Estimated Budget: <span className="font-semibold text-gray-900">R{project.estimatedBudget.toLocaleString()}</span>
              </div>
            )}
            {project.actualCost > 0 && (
              <div className="text-gray-600">
                Actual Cost: <span className="font-semibold text-gray-900">R{project.actualCost.toLocaleString()}</span>
              </div>
            )}
          </div>

          {expandedProjectId === project.id && milestonesQuery.data && (
            <WeeklyReportsSection
              milestones={milestonesQuery.data}
              token={token}
              onExportWeeklyReportPdf={onExportWeeklyReportPdf}
              generatingWeeklyReportPdfId={generatingWeeklyReportPdfId}
              isGeneratingWeeklyReport={isGeneratingWeeklyReport}
            />
          )}

          <div className="mt-4 pt-4 border-t border-gray-200 flex justify-between items-center">
            {project.status === "COMPLETED" && project.assignedTo && (
              <button
                onClick={() =>
                  onOpenReviewModal({
                    artisanId: project.assignedTo.id,
                    artisanName: `${project.assignedTo.firstName} ${project.assignedTo.lastName}`,
                    projectId: project.id,
                    projectName: project.name,
                  })
                }
                className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
              >
                <Star className="h-4 w-4 mr-2" />
                Leave Review for {project.assignedTo.firstName}
              </button>
            )}
            <button
              onClick={() => setExpandedProjectId(expandedProjectId === project.id ? null : project.id)}
              className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors ml-auto"
            >
              {expandedProjectId === project.id ? "Hide" : "View"} Weekly Reports
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// Separate component to handle weekly reports for milestones
function WeeklyReportsSection({
  milestones,
  token,
  onExportWeeklyReportPdf,
  generatingWeeklyReportPdfId,
  isGeneratingWeeklyReport,
}: {
  milestones: any[];
  token: string;
  onExportWeeklyReportPdf: (updateId: number) => void;
  generatingWeeklyReportPdfId: number | null;
  isGeneratingWeeklyReport: boolean;
}) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-200">
      <h5 className="text-sm font-semibold text-gray-900 mb-3">Weekly Progress Reports</h5>
      {milestones.map((milestone) => (
        <MilestoneWeeklyReports
          key={milestone.id}
          milestone={milestone}
          token={token}
          onExportWeeklyReportPdf={onExportWeeklyReportPdf}
          generatingWeeklyReportPdfId={generatingWeeklyReportPdfId}
          isGeneratingWeeklyReport={isGeneratingWeeklyReport}
        />
      ))}
    </div>
  );
}

// Separate component for each milestone's weekly reports
function MilestoneWeeklyReports({
  milestone,
  token,
  onExportWeeklyReportPdf,
  generatingWeeklyReportPdfId,
  isGeneratingWeeklyReport,
}: {
  milestone: any;
  token: string;
  onExportWeeklyReportPdf: (updateId: number) => void;
  generatingWeeklyReportPdfId: number | null;
  isGeneratingWeeklyReport: boolean;
}) {
  const trpc = useTRPC();
  
  const weeklyUpdatesQuery = useQuery(
    trpc.getWeeklyBudgetUpdates.queryOptions({
      token,
      milestoneId: milestone.id,
    })
  );
  
  const updates = weeklyUpdatesQuery.data || [];
  
  if (updates.length === 0) return null;
  
  return (
    <div className="mb-4">
      <h6 className="text-xs font-medium text-gray-700 mb-2">{milestone.name}</h6>
      <div className="space-y-2">
        {updates.map((update) => (
          <div key={update.id} className="flex items-center justify-between bg-white rounded-md p-3 border border-gray-200">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">
                Week of {new Date(update.weekStartDate).toLocaleDateString()}
              </p>
              <p className="text-xs text-gray-600">
                Progress: {update.progressPercentage}%
              </p>
            </div>
            <button
              onClick={() => onExportWeeklyReportPdf(update.id)}
              disabled={isGeneratingWeeklyReport && generatingWeeklyReportPdfId === update.id}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
            >
              {isGeneratingWeeklyReport && generatingWeeklyReportPdfId === update.id ? (
                <>
                  <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Download className="h-3 w-3 mr-1" />
                  Download Report
                </>
              )}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessagesTab({ conversations, userId }: { conversations: any[]; userId?: number }) {
  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const messageDate = new Date(date);
    const diffMs = now.getTime() - messageDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return messageDate.toLocaleDateString();
  };

  if (conversations.length === 0) {
    return (
      <div className="text-center py-12">
        <MessageSquare className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations yet</h3>
        <p className="text-sm text-gray-600">
          Your messages with artisans and administrators will appear here
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {conversations.map((conversation) => {
        const otherParticipants = conversation.participants.filter(
          (p: any) => p.id !== userId
        );
        const lastMessage = conversation.lastMessage;

        return (
          <Link
            key={conversation.id}
            to="/messages/$conversationId"
            params={{ conversationId: conversation.id.toString() }}
            className="block bg-gray-50 rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-base font-semibold text-gray-900">
                    {otherParticipants.length > 0
                      ? otherParticipants
                          .map((p: any) => `${p.firstName} ${p.lastName}`)
                          .join(", ")
                      : "Conversation"}
                  </h4>
                  {conversation.unreadCount > 0 && (
                    <span className="ml-2 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white bg-blue-600 rounded-full">
                      {conversation.unreadCount}
                    </span>
                  )}
                </div>
                <div className="flex items-center text-xs text-gray-500 mb-2">
                  {otherParticipants.map((p: any, idx: number) => (
                    <span
                      key={p.id}
                      className="inline-flex items-center px-2 py-0.5 rounded bg-gray-100 text-gray-700 mr-2"
                    >
                      {p.role}
                    </span>
                  ))}
                </div>
                {lastMessage ? (
                  <div className="flex items-start justify-between">
                    <p className="text-sm text-gray-600 truncate flex-1">
                      <span className="font-medium">
                        {lastMessage.sender.id === userId
                          ? "You"
                          : lastMessage.sender.firstName}
                        :
                      </span>{" "}
                      {lastMessage.content}
                    </p>
                    <div className="flex items-center text-xs text-gray-500 ml-4">
                      <Clock className="h-3 w-3 mr-1" />
                      {formatTimestamp(lastMessage.createdAt)}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No messages yet</p>
                )}
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
