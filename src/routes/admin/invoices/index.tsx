import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useEffect, useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { ClientSelector } from "~/components/ClientSelector";
import { LineItemTemplatePicker } from "~/components/LineItemTemplatePicker";
import {
  PortfolioScopeToggle,
  useInitialPortfolioScope,
  type PortfolioScope,
} from "~/components/PortfolioScopeToggle";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  Receipt,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  User,
  Trash2,
  Download,
  Loader2,
  ChevronDown,
  ChevronUp,
  Sparkles,
  FileText,
  FileSpreadsheet,
  FileMinus,
  Upload,
  AlertTriangle,
  Paperclip,
  ExternalLink,
  X,
  History,
  PenLine,
  Wallet,
  Send,
  ClipboardCheck,
} from "lucide-react";
import { ReportModal } from "~/components/ReportModal";
import { AlternativeRevenueForm } from "~/components/AlternativeRevenueForm";
import { computeInvoiceTotals } from "~/utils/money";
import { JobCardSignatureModal } from "~/components/JobCardSignatureModal";

export const Route = createFileRoute("/admin/invoices/")({
  validateSearch: z.object({
    invoiceId: z.coerce.number().optional(),
  }),
  component: InvoicesPage,
});

const invoiceSchema = z.object({
  customerName: z.string().min(1, "Building name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  invoiceDate: z.string().optional(),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.string().min(1).optional()
  ),
  clientReferenceNumber: z.string().optional(),
  projectDescription: z.string().optional(),
  customerVatNumber: z.string().optional(),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const invoiceStatuses = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING_REVIEW", label: "Pending Review (Jr Admin)", color: "bg-yellow-100 text-yellow-800" },
  { value: "PENDING_APPROVAL", label: "Pending Approval (Sr Admin)", color: "bg-orange-100 text-orange-800" },
  { value: "APPROVED", label: "Approved", color: "bg-emerald-100 text-emerald-800" },
  { value: "SENT_ITEMS", label: "Sent Items", color: "bg-blue-100 text-blue-800", combined: ["SENT", "OVERDUE"] },
  { value: "PAID", label: "Paid", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-gray-100 text-gray-800" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
];

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

function getAvailableStatusTransitions(currentStatus: string, userRole: string) {
  // Admin-tier roles can move invoices to ANY stage from ANY stage — same
  // model as quotations. Backend (updateInvoiceStatus) already permits this.
  const isAdminTier =
    userRole === "SENIOR_ADMIN" ||
    userRole === "JUNIOR_ADMIN" ||
    userRole === "ADMIN" ||
    userRole === "TECHNICAL_MANAGER" ||
    userRole === "MANAGER";

  if (isAdminTier) {
    const allStatuses = [
      "DRAFT",
      "PENDING_REVIEW",
      "PENDING_APPROVAL",
      "APPROVED",
      "SENT",
      "PAID",
      "OVERDUE",
      "CANCELLED",
      "REJECTED",
    ];
    return allStatuses.filter((s) => s !== currentStatus);
  }

  const transitions: Record<string, string[]> = {
    DRAFT: ["PENDING_REVIEW", "CANCELLED"],
    PENDING_REVIEW: ["PENDING_APPROVAL", "REJECTED", "CANCELLED"],
    PENDING_APPROVAL: [],
    APPROVED: ["SENT", "PAID", "CANCELLED"],
    SENT: ["PAID", "OVERDUE", "CANCELLED"],
    OVERDUE: ["PAID", "CANCELLED"],
    PAID: [],
    CANCELLED: [],
    REJECTED: ["DRAFT"],
  };

  return transitions[currentStatus] || [];
}

function InvoicesPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { invoiceId } = Route.useSearch();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // Self-initiated (artisan-created) filter for the Pending Review view.
  const [selfInitiatedFilter, setSelfInitiatedFilter] = useState<boolean>(false);
  // PR-QF — "Send Quote First" confirmation modal + in-flight guard.
  // When an admin picks quote-first on a Ready-for-Invoicing card, we open
  // this confirmation panel so they can review the source order + optionally
  // set a deposit % and validity window before we mint the DRAFT quotation.
  const [quoteFirstOrder, setQuoteFirstOrder] = useState<any | null>(null);
  const [quoteFirstDepositPct, setQuoteFirstDepositPct] = useState<string>("");
  const [quoteFirstValidDays, setQuoteFirstValidDays] = useState<string>("30");
  const [quoteFirstNotes, setQuoteFirstNotes] = useState<string>("");
  // Post-completion in-person signature capture — invoice-side entry point.
  const [signJobCardInvoiceId, setSignJobCardInvoiceId] = useState<number | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" },
  ]);
  const [companyMaterialCost, setCompanyMaterialCost] = useState<string>("");
  const [companyLabourCost, setCompanyLabourCost] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<string>("");
  // Deposit REQUESTED from the client on the invoice document itself.
  const [depositRequestedPercent, setDepositRequestedPercent] = useState<string>("");
  const [depositDueDate, setDepositDueDate] = useState<string>("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionInvoiceId, setRejectionInvoiceId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [showRemittanceModal, setShowRemittanceModal] = useState(false);
  const [remittanceInvoice, setRemittanceInvoice] = useState<any | null>(null);
  const [remittanceFile, setRemittanceFile] = useState<File | null>(null);
  const [uploadingRemittance, setUploadingRemittance] = useState(false);

  // Deposit-payment capture (partial payment received from client).
  const [showDepositModal, setShowDepositModal] = useState(false);
  const [depositInvoice, setDepositInvoice] = useState<any | null>(null);
  const [depositAmountInput, setDepositAmountInput] = useState<string>("");
  const [depositPaidDateInput, setDepositPaidDateInput] = useState<string>("");
  const [depositReferenceInput, setDepositReferenceInput] = useState<string>("");
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const initialScope = useInitialPortfolioScope();
  const [scope, setScope] = useState<PortfolioScope>(initialScope);
  const [generatingDescriptionIndex, setGeneratingDescriptionIndex] = useState<number | null>(null);
  const [referencedOrder, setReferencedOrder] = useState<any | null>(null);
  const [downloadingOrderPdf, setDownloadingOrderPdf] = useState(false);
  const [downloadingJobCardInvoiceId, setDownloadingJobCardInvoiceId] = useState<number | null>(null);
  const [downloadingMergedInvoiceId, setDownloadingMergedInvoiceId] = useState<number | null>(null);
  const [deleteConfirmInvoiceId, setDeleteConfirmInvoiceId] = useState<number | null>(null);
  const [clientSelectorResetKey, setClientSelectorResetKey] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [selectedClientBuildingId, setSelectedClientBuildingId] = useState<number | undefined>(undefined);
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [selectedCreditInvoice, setSelectedCreditInvoice] = useState<any | null>(null);
  const [creditReason, setCreditReason] = useState("");
  const [creditAmount, setCreditAmount] = useState("");
  const [creditNotesText, setCreditNotesText] = useState("");
  const [creditDisputeReason, setCreditDisputeReason] = useState("");
  const [generatingCreditPdfId, setGeneratingCreditPdfId] = useState<number | null>(null);
  const [completedJobsCollapsed, setCompletedJobsCollapsed] = useState(false);
  const [completedJobsSearch, setCompletedJobsSearch] = useState("");
  const [showAllCompletedOrders, setShowAllCompletedOrders] = useState(false);

  // Manual (retroactive) job card generation for invoices without an order
  type ManualJobCardWorkSession = { startAt: string; endAt: string };
  const [showManualJobCardModal, setShowManualJobCardModal] = useState(false);
  const [manualJobCardInvoice, setManualJobCardInvoice] = useState<any | null>(null);
  const [manualJobCardCompletionDate, setManualJobCardCompletionDate] = useState<string>("");
  const [manualJobCardStartDate, setManualJobCardStartDate] = useState<string>("");
  const [manualJobCardSessions, setManualJobCardSessions] = useState<ManualJobCardWorkSession[]>([
    { startAt: "", endAt: "" },
  ]);
  const [manualJobCardClientRep, setManualJobCardClientRep] = useState<string>("");
  const [manualJobCardNotes, setManualJobCardNotes] = useState<string>("");
  const [pendingManualJobCardOrderNumber, setPendingManualJobCardOrderNumber] = useState<string>("");

  // Change history (audit trail)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyInvoice, setHistoryInvoice] = useState<any>(null);
  const historyQuery = useQuery(
    trpc.getEntityAuditLog.queryOptions(
      {
        token: token!,
        entityType: "Invoice",
        entityId: historyInvoice?.id ?? 0,
        limit: 200,
      },
      { enabled: !!token && !!historyInvoice?.id && showHistoryModal }
    )
  );

  const isAdmin = user?.role === "JUNIOR_ADMIN" || user?.role === "SENIOR_ADMIN";

  const unitOfMeasureOptions = [
    { value: "m2", label: "m2" },
    { value: "Lm", label: "Lm" },
    { value: "Sum", label: "Sum" },
    { value: "m3", label: "m3" },
    { value: "Hr", label: "Hr" },
  ];

  const invoicesQuery = useQuery(
    trpc.getInvoices.queryOptions({
      token: token!,
      scope,
    })
  );

  const creditNotesQuery = useQuery(
    trpc.getCreditNotes.queryOptions({
      token: token!,
    })
  );

  const completedOrdersQuery = useQuery({
    ...trpc.getOrders.queryOptions({
      token: token!,
      status: "COMPLETED" as any,
      // FIX: Ready-for-Invoicing must span the whole company, not just the
      // current admin's portfolio. Without this, self-initiated jobs done
      // by artisans outside an admin's "MINE" view silently vanish from
      // this list and never get invoiced.
      scope: "ALL",
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Query for completed PM orders without invoices
  const completedPMOrdersQuery = useQuery({
    ...trpc.getPropertyManagerOrders.queryOptions({
      token: token!,
      status: "COMPLETED" as any,
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Also pull SELF_INITIATED orders that have been marked done (endTime set)
  // but the artisan-side completion transition didn't fully move them to
  // COMPLETED (legacy data, edge cases where the completion mutation errored
  // mid-flight, etc.). These MUST still surface as ready-for-invoicing.
  const selfInitiatedDoneQuery = useQuery({
    ...trpc.getOrders.queryOptions({
      token: token!,
      status: "SELF_INITIATED" as any,
      scope: "ALL",
    }),
    enabled: !!token,
    staleTime: 30000,
  });

  // Combine completed orders and filter those without invoices
  const completedOrdersWithoutInvoice = useMemo(() => {
    const orders = completedOrdersQuery.data || [];
    const pmOrders = completedPMOrdersQuery.data || [];
    const selfInitiatedDone = selfInitiatedDoneQuery.data || [];

    // "Actionable" invoice states — the admin still has to decide something
    // (approve, edit, or replace with a quote first). Once the invoice is
    // APPROVED / SENT / PAID / OVERDUE / CANCELLED / REJECTED, the order
    // drops off the Ready-for-Invoicing panel.
    const openInvoiceStatuses = new Set(["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL"]);
    const isActionableInvoice = (inv: any) =>
      !!inv && openInvoiceStatuses.has(String(inv.status).toUpperCase());

    // Include: (a) COMPLETED orders that have no invoice yet, AND
    //          (b) COMPLETED orders whose auto-created draft invoice is
    //              still awaiting admin action (DRAFT / PENDING_REVIEW /
    //              PENDING_APPROVAL) AND has no linked quotation — so the
    //              admin can pick "Send Quote First" or review the draft.
    const ordersWithoutInvoice = orders.filter(
      (order: any) =>
        (!order.invoice && !order.invoiceId) ||
        (isActionableInvoice(order.invoice) && !order.quotationId && !order.quotation?.id),
    );
    // Self-initiated jobs where the artisan finished work (endTime set) but
    // status is still SELF_INITIATED — treat them as ready-for-invoicing too.
    const selfInitiatedDoneNoInvoice = selfInitiatedDone.filter(
      (o: any) =>
        o.endTime &&
        ((!o.invoice && !o.invoiceId) ||
          (isActionableInvoice(o.invoice) && !o.quotationId && !o.quotation?.id)),
    );
    // De-duplicate against the COMPLETED list.
    const completedIds = new Set(ordersWithoutInvoice.map((o: any) => o.id));
    const mergedRegularOrders = [
      ...ordersWithoutInvoice,
      ...selfInitiatedDoneNoInvoice.filter((o: any) => !completedIds.has(o.id)),
    ];

    // PM orders have an 'invoices' array (PropertyManagerInvoice[]) instead of invoice/invoiceId
    const pmOrdersWithoutInvoice = pmOrders.filter((order: any) => 
      !order.invoices || order.invoices.length === 0
    );
    
    // Normalize PM orders to match order structure
    const normalizedPMOrders = pmOrdersWithoutInvoice.map((pmOrder: any) => ({
      ...pmOrder,
      isPropertyManagerOrder: true,
      customerName: pmOrder.propertyManager ? `${pmOrder.propertyManager.firstName} ${pmOrder.propertyManager.lastName}` : 'Property Manager',
      serviceType: 'PM Order',
    }));
    
    return [...mergedRegularOrders, ...normalizedPMOrders];
  }, [completedOrdersQuery.data, completedPMOrdersQuery.data, selfInitiatedDoneQuery.data]);

  // Count of completed orders that ALREADY have finalised invoices — useful
  // audit hint for admin. "Finalised" = SENT / PAID / OVERDUE / APPROVED /
  // CANCELLED / REJECTED. Draft/pending invoices with no quote are surfaced
  // in the main list instead so admin can still act on them.
  const completedOrdersWithInvoiceCount = useMemo(() => {
    const orders = completedOrdersQuery.data || [];
    const pmOrders = completedPMOrdersQuery.data || [];
    const finalisedStatuses = new Set(["APPROVED", "SENT", "PAID", "OVERDUE", "CANCELLED", "REJECTED"]);
    const isFinalised = (inv: any) => inv && finalisedStatuses.has(String(inv.status).toUpperCase());
    const withOrderInvoice = orders.filter((o: any) => {
      if (!o.invoice && !o.invoiceId) return false;
      // Draft/pending invoices that have a linked quote are also considered
      // "invoiced" for the purposes of this counter — the admin's next step
      // is on the quote, not this panel.
      if (isFinalised(o.invoice)) return true;
      return !!(o.quotationId || o.quotation?.id);
    }).length;
    const withPmInvoice = pmOrders.filter((o: any) => o.invoices && o.invoices.length > 0).length;
    return withOrderInvoice + withPmInvoice;
  }, [completedOrdersQuery.data, completedPMOrdersQuery.data]);

  // Apply local search to the Completed Jobs panel.
  const visibleCompletedJobs = useMemo(() => {
    const term = completedJobsSearch.trim().toLowerCase();
    if (!term) return completedOrdersWithoutInvoice;
    return completedOrdersWithoutInvoice.filter((o: any) => {
      const haystack = [
        o.orderNumber,
        o.customerName,
        o.customerEmail,
        o.description,
        o.title,
        o.serviceType,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [completedOrdersWithoutInvoice, completedJobsSearch]);

  // Completed orders that already have an invoice — surfaced in the auditor toggle.
  const completedOrdersWithInvoice = useMemo(() => {
    const orders = completedOrdersQuery.data || [];
    const pmOrders = completedPMOrdersQuery.data || [];
    const ordersInvoiced = orders.filter((o: any) => o.invoice || o.invoiceId);
    const pmInvoiced = (pmOrders.filter((o: any) => o.invoices && o.invoices.length > 0) as any[]).map((pmOrder: any) => ({
      ...pmOrder,
      isPropertyManagerOrder: true,
      customerName: pmOrder.propertyManager ? `${pmOrder.propertyManager.firstName} ${pmOrder.propertyManager.lastName}` : 'Property Manager',
      serviceType: 'PM Order',
    }));
    return [...ordersInvoiced, ...pmInvoiced];
  }, [completedOrdersQuery.data, completedPMOrdersQuery.data]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema) as any,
  });

  const createInvoiceMutation = useMutation(
    trpc.createInvoice.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPropertyManagerOrders.queryKey() });
        reset();
        setClientSelectorResetKey((k) => k + 1);
        setSelectedClientId(undefined);
        setSelectedClientBuildingId(undefined);
        setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
        setCompanyMaterialCost("");
        setCompanyLabourCost("");
        setDiscountPercent("");
        setDepositRequestedPercent("");
        setDepositDueDate("");
        setReferencedOrder(null);
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create invoice");
      },
    })
  );

  // PR-QF — "Send Quote First" mutation. Creates a DRAFT Quotation linked
  // to the source Order (Order.quotationId), appends a
  // "QUOTE_SENT_AWAITING_CLIENT_PO" invoicing blocker, and writes audit-log
  // entries on both entities. On success we invalidate order/quote queries
  // and redirect the admin to /admin/quotations with the new quote
  // highlighted so they can review, edit and send it to the client.
  const quoteFirstMutation = useMutation(
    trpc.createQuotationFromOrder.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(
          `Draft quote ${res.quoteNumber} created — edit & send to the client. ` +
            `The order stays here until the client's PO is captured.`,
          { duration: 6000 }
        );
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setQuoteFirstOrder(null);
        setQuoteFirstDepositPct("");
        setQuoteFirstValidDays("30");
        setQuoteFirstNotes("");
        // Take admin straight to the new quote so they can review + send.
        navigate({
          to: "/admin/quotations",
          search: { highlight: res.quoteNumber },
        } as any);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create quote from order");
      },
    })
  );

  const updateInvoiceDetailsMutation = useMutation(
    trpc.updateInvoiceDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        reset();
        setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
        setCompanyMaterialCost("");
        setCompanyLabourCost("");
        setDiscountPercent("");
        setDepositRequestedPercent("");
        setDepositDueDate("");
        setShowAddForm(false);
        setEditingInvoice(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update invoice");
      },
    })
  );

  const updateInvoiceStatusMutation = useMutation(
    trpc.updateInvoiceStatus.mutationOptions({
      onSuccess: (_data, vars) => {
        toast.success("Invoice status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        // Nudge admin to attach proof-of-payment when marking PAID.
        if (vars?.status === "PAID") {
          const inv = invoices.find((i) => i.id === vars.invoiceId);
          if (!inv?.remittanceUrl) {
            toast("Reminder: attach a remittance for this paid invoice.", {
              icon: "⚠️",
              duration: 5000,
            });
          }
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update invoice status");
      },
    })
  );

  const getPresignedUploadUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions({}),
  );

  const attachRemittanceMutation = useMutation(
    trpc.adminAttachInvoiceRemittance.mutationOptions({
      onSuccess: () => {
        toast.success("Remittance attached");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        setShowRemittanceModal(false);
        setRemittanceInvoice(null);
        setRemittanceFile(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to attach remittance");
      },
    }),
  );

  const clearRemittanceMutation = useMutation(
    trpc.adminClearInvoiceRemittance.mutationOptions({
      onSuccess: () => {
        toast.success("Remittance removed");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to remove remittance");
      },
    }),
  );

  const recordDepositMutation = useMutation(
    trpc.recordInvoiceDeposit.mutationOptions({
      onSuccess: (data: any) => {
        const nowPaid = data?.status === "PAID";
        toast.success(
          nowPaid
            ? "Deposit recorded — invoice is now fully paid."
            : "Deposit recorded.",
        );
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        setShowDepositModal(false);
        setDepositInvoice(null);
        setDepositAmountInput("");
        setDepositPaidDateInput("");
        setDepositReferenceInput("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to record deposit");
      },
    }),
  );

  const clearDepositMutation = useMutation(
    trpc.clearInvoiceDeposit.mutationOptions({
      onSuccess: () => {
        toast.success("Deposit cleared");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to clear deposit");
      },
    }),
  );

  const openDepositModal = (invoice: any) => {
    const total = Number(invoice.total) || 0;
    const priorDeposit = Number(invoice.depositAmount) || 0;
    const balanceOwing = Math.max(0, total - priorDeposit);
    setDepositInvoice(invoice);
    // Default to the balance owing so a one-click "settle in full" works too.
    setDepositAmountInput(balanceOwing > 0 ? balanceOwing.toFixed(2) : "");
    setDepositPaidDateInput(new Date().toISOString().slice(0, 10));
    setDepositReferenceInput(invoice.depositReference || "");
    setShowDepositModal(true);
  };

  const handleSubmitDeposit = () => {
    if (!depositInvoice || !token) return;
    const amt = parseFloat(depositAmountInput);
    if (!isFinite(amt) || amt <= 0) {
      toast.error("Enter a valid deposit amount greater than 0");
      return;
    }
    recordDepositMutation.mutate({
      token,
      invoiceId: depositInvoice.id,
      amount: amt,
      paidDate: depositPaidDateInput || undefined,
      reference: depositReferenceInput.trim() || undefined,
      mode: "ADD",
    });
  };

  const handleUploadRemittance = async () => {
    if (!remittanceInvoice || !remittanceFile || !token) return;
    setUploadingRemittance(true);
    try {
      const { presignedUrl, fileUrl } = await getPresignedUploadUrlMutation.mutateAsync({
        token,
        fileName: remittanceFile.name,
        fileType: remittanceFile.type || "application/octet-stream",
        isPublic: false,
      });
      const put = await fetch(presignedUrl, {
        method: "PUT",
        body: remittanceFile,
        headers: { "Content-Type": remittanceFile.type || "application/octet-stream" },
      });
      if (!put.ok) throw new Error(`Upload failed (${put.status})`);
      await attachRemittanceMutation.mutateAsync({
        token,
        invoiceId: remittanceInvoice.id,
        remittanceUrl: fileUrl,
        remittanceFileName: remittanceFile.name,
      });
    } catch (e: any) {
      toast.error(e?.message || "Upload failed");
    } finally {
      setUploadingRemittance(false);
    }
  };

  const deleteInvoiceMutation = useMutation(
    trpc.deleteInvoice.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        setDeleteConfirmInvoiceId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete invoice");
        setDeleteConfirmInvoiceId(null);
      },
    })
  );

  const generateInvoicePdfMutation = useMutation(
    trpc.generateInvoicePdf.mutationOptions({
      onSuccess: (data, variables) => {
        // Convert base64 to blob and download
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
        toast.success("PDF downloaded successfully!");
        setGeneratingPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF");
        setGeneratingPdfId(null);
      },
    })
  );

  const createCreditNoteMutation = useMutation(
    trpc.createCreditNote.mutationOptions({
      onSuccess: () => {
        toast.success("Credit note created");
        queryClient.invalidateQueries({ queryKey: trpc.getCreditNotes.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
        setShowCreditNoteModal(false);
        setSelectedCreditInvoice(null);
        setCreditReason("");
        setCreditAmount("");
        setCreditNotesText("");
        setCreditDisputeReason("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create credit note");
      },
    })
  );

  const generateCreditNotePdfMutation = useMutation(
    trpc.generateCreditNotePdf.mutationOptions({
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
        const notes: any[] = ((creditNotesQuery as any).data ?? []) as any[];
        const note = notes.find((n: any) => n.id === variables.creditNoteId);
        link.download = `credit-note-${note?.creditNoteNumber || variables.creditNoteId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        setGeneratingCreditPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate credit note PDF");
        setGeneratingCreditPdfId(null);
      },
    })
  );

  const generateInvoicePdfRawMutation = useMutation(trpc.generateInvoicePdf.mutationOptions());
  const generateOrderPdfRawMutation = useMutation(trpc.generateOrderPdf.mutationOptions());
  const generateJobCardPdfRawMutation = useMutation(trpc.generateJobCardPdf.mutationOptions());

  const manualJobCardPdfMutation = useMutation(
    trpc.generateJobCardPdf.mutationOptions({
      onSuccess: (data: any) => {
        try {
          downloadPdfBytes(
            base64ToUint8Array(data.pdf),
            `job-card-${pendingManualJobCardOrderNumber || "download"}.pdf`
          );
          toast.success("Job card PDF downloaded");
        } catch (e) {
          toast.error("Failed to download job card PDF");
        }
        setPendingManualJobCardOrderNumber("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate job card PDF");
        setPendingManualJobCardOrderNumber("");
      },
    })
  );

  const generateJobCardForInvoiceMutation = useMutation(
    trpc.generateJobCardForInvoice.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message || `Job card ${data.order.orderNumber} created`);
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        setShowManualJobCardModal(false);
        setManualJobCardInvoice(null);
        setManualJobCardCompletionDate("");
        setManualJobCardStartDate("");
        setManualJobCardSessions([{ startAt: "", endAt: "" }]);
        setManualJobCardClientRep("");
        setManualJobCardNotes("");
        setPendingManualJobCardOrderNumber(data.order.orderNumber);
        manualJobCardPdfMutation.mutate({
          token: token!,
          orderId: data.order.id,
          isPMOrder: false,
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate job card");
      },
    })
  );

  const generateDescriptionMutation = useMutation(
    trpc.generateInvoiceDescription.mutationOptions({
      onSuccess: (data, variables) => {
        // Find the index from the variables if we stored it
        if (generatingDescriptionIndex !== null) {
          updateLineItem(generatingDescriptionIndex, "description", data.fullDescription);
          toast.success("Description generated successfully!");
        }
        setGeneratingDescriptionIndex(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate description");
        setGeneratingDescriptionIndex(null);
      },
    })
  );

  const generateOrderPdfMutation = useMutation(
    trpc.generateOrderPdf.mutationOptions({
      onSuccess: (data) => {
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
        link.download = `order-${referencedOrder?.orderNumber || 'summary'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Order summary PDF downloaded!");
        setDownloadingOrderPdf(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate order PDF");
        setDownloadingOrderPdf(false);
      },
    })
  );

  const base64ToUint8Array = (base64: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Uint8Array(byteNumbers);
  };

  const downloadPdfBytes = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes as BlobPart], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const generatePMOrderPdfMutation = useMutation(
    trpc.generatePropertyManagerOrderPdf.mutationOptions({
      onSuccess: (data) => {
        const byteCharacters = atob(data.pdfBase64);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = data.filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("PM order PDF downloaded!");
        setDownloadingOrderPdf(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PM order PDF");
        setDownloadingOrderPdf(false);
      },
    })
  );

  const generateOriginalOrderPdfMutation = useMutation(
    trpc.generateOrderPdf.mutationOptions({
      onSuccess: (data) => {
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
        link.download = `order-${referencedOrder?.orderNumber || 'original'}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Original order PDF downloaded!");
        setDownloadingOrderPdf(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate original order PDF");
        setDownloadingOrderPdf(false);
      },
    })
  );

  const toggleInvoiceExpansion = (invoiceId: number) => {
    const newExpanded = new Set(expandedInvoices);
    if (newExpanded.has(invoiceId)) {
      newExpanded.delete(invoiceId);
    } else {
      newExpanded.add(invoiceId);
    }
    setExpandedInvoices(newExpanded);
  };

  const handleDownloadOrderPdf = (pdfType: 'summary' | 'originalOrder') => {
    if (!referencedOrder) return;
    
    setDownloadingOrderPdf(true);
    
    if (pdfType === 'originalOrder') {
      // Download ORIGINAL order (what was initially requested)
      if (referencedOrder.isPropertyManagerOrder) {
        // Download PM's original work order with instructions
        generatePMOrderPdfMutation.mutate({
          orderId: referencedOrder.id,
        });
      } else {
        // For regular orders, original order is the same as summary
        generateOrderPdfMutation.mutate({
          token: token!,
          orderId: referencedOrder.id,
          isPMOrder: false,
        });
      }
    } else {
      // Download SUMMARY (what was completed)
      // For both PM orders and regular orders, use generateOrderPdf with the order ID
      generateOrderPdfMutation.mutate({
        token: token!,
        orderId: referencedOrder.id,
        isPMOrder: referencedOrder.isPropertyManagerOrder || false,
      });
    }
  };

  const handleStatusChange = (invoiceId: number, newStatus: string) => {
    if (newStatus === "REJECTED") {
      setRejectionInvoiceId(invoiceId);
      setShowRejectionModal(true);
    } else {
      updateInvoiceStatusMutation.mutate({
        token: token!,
        invoiceId,
        status: newStatus as any,
      });
    }
  };

  const handleRejectInvoice = () => {
    if (!rejectionInvoiceId || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    updateInvoiceStatusMutation.mutate({
      token: token!,
      invoiceId: rejectionInvoiceId,
      status: "REJECTED",
      rejectionReason: rejectionReason.trim(),
    });

    setShowRejectionModal(false);
    setRejectionInvoiceId(null);
    setRejectionReason("");
  };

  const handleEditInvoice = (invoice: any) => {
    setEditingInvoice(invoice.id);
    setShowAddForm(true);
    
    // Populate form fields
    reset({
      customerName: invoice.customerName,
      customerEmail: invoice.customerEmail,
      customerPhone: invoice.customerPhone,
      address: invoice.address,
      invoiceDate: invoice.createdAt ? new Date(invoice.createdAt).toISOString().split('T')[0] : "",
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : "",
      notes: invoice.notes || "",
      invoiceNumber: invoice.invoiceNumber,
      clientReferenceNumber: invoice.clientReferenceNumber || "",
      projectDescription: invoice.projectDescription || "",
      customerVatNumber: invoice.customerVatNumber || "",
    });
    
    // Populate line items
    if (invoice.items && Array.isArray(invoice.items)) {
      setLineItems(invoice.items);
    }
    
    // Populate cost fields
    setCompanyMaterialCost(invoice.companyMaterialCost?.toString() || "");
    setCompanyLabourCost(invoice.companyLabourCost?.toString() || "");
    setDiscountPercent(
      invoice.discountPercent && invoice.discountPercent > 0
        ? String(invoice.discountPercent)
        : "",
    );
    setDepositRequestedPercent(
      (invoice as any).depositRequestedPercent && (invoice as any).depositRequestedPercent > 0
        ? String((invoice as any).depositRequestedPercent)
        : "",
    );
    setDepositDueDate(
      (invoice as any).depositDueDate
        ? new Date((invoice as any).depositDueDate).toISOString().slice(0, 10)
        : "",
    );
  };

  useEffect(() => {
    if (!invoiceId) return;
    const invoices = invoicesQuery.data || [];
    const invoice = invoices.find((i: any) => i.id === invoiceId);
    if (!invoice) return;

    setStatusFilter(null);
    setSearchTerm("");
    setExpandedInvoices((prev) => {
      const next = new Set(prev);
      next.add(invoiceId);
      return next;
    });

    handleEditInvoice(invoice);

    // Scroll the invoice into view once it exists in the DOM
    setTimeout(() => {
      document.getElementById(`invoice-${invoiceId}`)?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 0);
    // Only run when invoices change / invoiceId changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoiceId, invoicesQuery.data]);

  const handleExportPdf = (invoiceId: number) => {
    setGeneratingPdfId(invoiceId);
    generateInvoicePdfMutation.mutate({
      token: token!,
      invoiceId,
    });
  };

  const openCreditNoteModal = (invoice: any) => {
    setSelectedCreditInvoice(invoice);
    setCreditReason(`Credit adjustment for invoice ${invoice.invoiceNumber}`);
    setCreditAmount((invoice.total || 0).toFixed(2));
    setCreditNotesText("");
    setCreditDisputeReason("");
    setShowCreditNoteModal(true);
  };

  const handleCreateCreditNote = () => {
    if (!selectedCreditInvoice) return;
    const amount = Number(creditAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("Enter a valid credit amount");
      return;
    }

    createCreditNoteMutation.mutate({
      token: token!,
      invoiceId: selectedCreditInvoice.id,
      reason: creditReason.trim() || `Credit note for ${selectedCreditInvoice.invoiceNumber}`,
      disputeReason: creditDisputeReason.trim() || undefined,
      notes: creditNotesText.trim() || undefined,
      markInvoiceDisputed: Boolean(creditDisputeReason.trim()),
      items: [
        {
          description: creditReason.trim() || `Credit for invoice ${selectedCreditInvoice.invoiceNumber}`,
          quantity: 1,
          unitPrice: amount,
          total: amount,
          unitOfMeasure: "Sum",
        },
      ],
    });
  };

  const handleDownloadCreditNotePdf = (creditNoteId: number) => {
    setGeneratingCreditPdfId(creditNoteId);
    generateCreditNotePdfMutation.mutate({
      token: token!,
      creditNoteId,
    });
  };

  const handleDownloadJobCardForInvoice = async (invoice: any) => {
    if (!invoice?.order?.id) {
      toast.error("This invoice is not linked to an order");
      return;
    }

    setDownloadingJobCardInvoiceId(invoice.id);
    try {
      const jobCardData = await generateJobCardPdfRawMutation.mutateAsync({
        token: token!,
        orderId: invoice.order.id,
        isPMOrder: false,
      });

      downloadPdfBytes(base64ToUint8Array(jobCardData.pdf), `job-card-${invoice.order.orderNumber || invoice.order.id}.pdf`);
      toast.success("Job card downloaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download job card");
    } finally {
      setDownloadingJobCardInvoiceId(null);
    }
  };

  const handleDownloadOrderSummaryForInvoice = async (invoice: any) => {
    if (!invoice?.order?.id) {
      toast.error("This invoice is not linked to an order");
      return;
    }

    setDownloadingOrderPdf(true);
    try {
      const orderPdf = await generateOrderPdfRawMutation.mutateAsync({
        token: token!,
        orderId: invoice.order.id,
        isPMOrder: false,
      });

      downloadPdfBytes(
        base64ToUint8Array(orderPdf.pdf),
        `order-${invoice.order.orderNumber || invoice.order.id}.pdf`
      );
      toast.success("Order summary downloaded!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download order summary");
    } finally {
      setDownloadingOrderPdf(false);
    }
  };

  const handleDownloadMergedPdfForInvoice = async (invoice: any) => {
    if (!invoice?.order?.id) {
      toast.error("This invoice is not linked to an order");
      return;
    }

    const orderDocs: string[] = Array.isArray(invoice?.order?.documents) ? invoice.order.documents : [];
    if (orderDocs.length === 0) {
      toast.error("No order document uploaded for this job.");
      return;
    }

    setDownloadingMergedInvoiceId(invoice.id);
    const toastId = toast.loading("Preparing combined PDF...");
    try {
      const [{ PDFArray, PDFDocument, PDFRawStream, decodePDFRawStream }] = await Promise.all([import("pdf-lib")]);

      const [invoicePdf, jobCardPdf] = await Promise.all([
        generateInvoicePdfRawMutation.mutateAsync({ token: token!, invoiceId: invoice.id }),
        generateJobCardPdfRawMutation.mutateAsync({ token: token!, orderId: invoice.order.id, isPMOrder: false }),
      ]);

      const merged = await PDFDocument.create();

      const isProbablyBlankPage = (page: any): boolean => {
        try {
          const contents = page.node?.Contents?.();
          if (!contents) return true;
          const ctx = page.node?.context;
          const lengthOfStream = (stream: any): number => {
            if (!stream) return 0;
            try {
              if (stream instanceof PDFRawStream) return (decodePDFRawStream(stream) as any).length;
            } catch {
              // ignore
            }
            const raw = (stream as any).contents;
            return raw && typeof raw.length === "number" ? raw.length : 0;
          };
          if (contents instanceof PDFArray) {
            let total = 0;
            for (let i = 0; i < contents.size(); i++) {
              const item = contents.get(i);
              const stream = ctx?.lookup ? ctx.lookup(item) : item;
              total += lengthOfStream(stream);
            }
            return total < 20;
          }
          const stream = ctx?.lookup ? ctx.lookup(contents) : contents;
          return lengthOfStream(stream) < 20;
        } catch {
          return false;
        }
      };

      const appendPdfBytes = async (pdfBytes: Uint8Array) => {
        const src = await PDFDocument.load(pdfBytes);
        const pages = src.getPages();
        const keepIndices = pages
          .map((p: any, idx: number) => ({ idx, keep: !isProbablyBlankPage(p) }))
          .filter((p: any) => p.keep)
          .map((p: any) => p.idx);
        const indices = keepIndices.length > 0 ? keepIndices : src.getPageIndices();
        const copied = await merged.copyPages(src, indices);
        copied.forEach((p) => merged.addPage(p));
      };

      const isPdfBytes = (bytes: Uint8Array): boolean =>
        bytes.length >= 5 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46 && bytes[4] === 0x2d;

      const appendOrderDocumentUrl = async (url: string) => {
        const absoluteUrl = url.startsWith("http") ? url : new URL(url, window.location.origin).toString();
        const resp = await fetch(absoluteUrl, { credentials: "include" });
        if (!resp.ok) throw new Error(`Failed to fetch order document (${resp.status})`);
        const contentType = (resp.headers.get("content-type") || "").toLowerCase();
        const bytes = new Uint8Array(await resp.arrayBuffer());

        if (contentType.includes("application/pdf") || isPdfBytes(bytes)) {
          await appendPdfBytes(bytes);
          return;
        }

        const isImage = contentType.startsWith("image/") || /\.(png|jpg|jpeg|webp)(\?|#|$)/i.test(absoluteUrl);
        if (!isImage) throw new Error(`Unsupported order document type: ${contentType || "unknown"}`);

        let embedBytes = bytes;
        let embedAs: "png" | "jpg" = contentType.includes("png") ? "png" : "jpg";

        if (contentType.includes("webp") || /\.webp(\?|#|$)/i.test(absoluteUrl)) {
          const blob = new Blob([bytes], { type: contentType || "image/webp" });
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Failed to create canvas context for image conversion");
          ctx.drawImage(bitmap, 0, 0);
          const pngBlob: Blob = await new Promise((resolve, reject) => {
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Image conversion failed"))), "image/png");
          });
          embedBytes = new Uint8Array(await pngBlob.arrayBuffer());
          embedAs = "png";
        }

        const img = embedAs === "png" ? await merged.embedPng(embedBytes) : await merged.embedJpg(embedBytes);
        const pageWidth = 595.28;
        const pageHeight = 841.89;
        const margin = 36;
        const maxWidth = pageWidth - margin * 2;
        const maxHeight = pageHeight - margin * 2;
        const scale = Math.min(maxWidth / img.width, maxHeight / img.height);
        const drawWidth = img.width * scale;
        const drawHeight = img.height * scale;
        const x = (pageWidth - drawWidth) / 2;
        const y = (pageHeight - drawHeight) / 2;
        const page = merged.addPage([pageWidth, pageHeight]);
        page.drawImage(img, { x, y, width: drawWidth, height: drawHeight });
      };

      // Required order: Invoice (top) -> Uploaded Order document(s) -> Job Card
      await appendPdfBytes(base64ToUint8Array(invoicePdf.pdf));
      for (const docUrl of orderDocs) {
        await appendOrderDocumentUrl(docUrl);
      }
      await appendPdfBytes(base64ToUint8Array(jobCardPdf.pdf));

      const bytes = await merged.save();
      downloadPdfBytes(bytes, `invoice-order-jobcard-${invoice.invoiceNumber || invoice.id}.pdf`);
      toast.success("Combined PDF downloaded!", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate combined PDF", { id: toastId });
    } finally {
      setDownloadingMergedInvoiceId(null);
    }
  };

  const handleGenerateDescription = (index: number) => {
    const item = lineItems[index];
    if (!item) return;
    if (!item.description || item.description.trim().length < 3) {
      toast.error("Please enter at least a brief description (3+ characters) to generate AI content");
      return;
    }
    
    setGeneratingDescriptionIndex(index);
    
    const generatePromise = generateDescriptionMutation.mutateAsync({
      token: token!,
      briefDescription: item.description,
      quantity: item.quantity,
      context: {},
    });

    toast.promise(
      generatePromise,
      {
        loading: "Generating professional description with AI...",
        success: "Description generated!",
        error: "Failed to generate description",
      }
    );
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...lineItems];
    newItems[index] = { ...newItems[index], [field]: value } as LineItem;
    
    if (field === "quantity" || field === "unitPrice") {
      newItems[index]!.total = newItems[index]!.quantity * newItems[index]!.unitPrice;
    }
    
    setLineItems(newItems);
  };

  const calculateSubtotal = () => computeInvoiceTotals(lineItems).subtotal;

  const clampedDiscountPct = () => {
    const raw = parseFloat(discountPercent);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(100, raw);
  };

  const calculateDiscountAmount = () =>
    computeInvoiceTotals(lineItems, clampedDiscountPct()).discountAmount;

  const calculateNetSubtotal = () =>
    computeInvoiceTotals(lineItems, clampedDiscountPct()).netSubtotal;

  const calculateTax = () => computeInvoiceTotals(lineItems, clampedDiscountPct()).tax;

  const calculateTotal = () => computeInvoiceTotals(lineItems, clampedDiscountPct()).total;

  const calculateEstimatedProfit = () => {
    const subtotal = calculateNetSubtotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    return subtotal - materialCost - labourCost;
  };

  // Deposit REQUESTED from the client (percent-based). Amount is derived from
  // the canonical total so the form and PDF always match.
  const clampedDepositPct = () => {
    const raw = parseFloat(depositRequestedPercent);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(100, raw);
  };
  const calculateDepositRequestedAmount = () => {
    const pct = clampedDepositPct();
    if (pct <= 0) return 0;
    const total = calculateTotal();
    return Math.round(((total * pct) / 100 + Number.EPSILON) * 100) / 100;
  };
  const calculateBalanceOnCompletion = () =>
    Math.max(0, calculateTotal() - calculateDepositRequestedAmount());

  const onSubmit = (data: InvoiceForm) => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();
    const discountPct = clampedDiscountPct();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    const estimatedProfit = calculateNetSubtotal() - materialCost - labourCost;

    if (editingInvoice) {
      updateInvoiceDetailsMutation.mutate({
        token: token!,
        invoiceId: editingInvoice,
        ...data,
        invoiceNumber: data.invoiceNumber,
        items: lineItems,
        subtotal,
        tax,
        total,
        discountPercent: discountPct,
        depositRequestedPercent: clampedDepositPct(),
        depositDueDate: depositDueDate || undefined,
        companyMaterialCost: materialCost,
        companyLabourCost: labourCost,
        estimatedProfit,
      });
    } else {
      createInvoiceMutation.mutate({
        token: token!,
        ...data,
        items: lineItems,
        subtotal,
        tax,
        total,
        discountPercent: discountPct,
        depositRequestedPercent: clampedDepositPct(),
        depositDueDate: depositDueDate || undefined,
        companyMaterialCost: materialCost,
        companyLabourCost: labourCost,
        estimatedProfit,
        // Link to the source order
        orderId: referencedOrder && !referencedOrder.isPropertyManagerOrder ? referencedOrder.id : undefined,
        // Include PM order info if this is from a PM order
        isPMOrder: referencedOrder?.isPropertyManagerOrder || false,
        pmOrderId: referencedOrder?.isPropertyManagerOrder ? referencedOrder.id : undefined,
        clientId: selectedClientId,
        clientBuildingId: selectedClientBuildingId,
      });
    }
  };

  const handleCreateInvoiceFromOrder = (order: any) => {
    // Pre-populate the form with order data
    reset({
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone || '',
      address: order.address || '',
      invoiceNumber: '',
      dueDate: '',
    });

    // Pre-populate line items from order materials and job activities
    const items: any[] = [];

    // PR-QF — Prefer the linked quote's line items when the job was quoted
    // first. This keeps the invoice matched to what the client actually
    // signed off on (and to the PO they'll issue against the quote). If
    // getOrders hasn't hydrated the quote's items yet we still fall back to
    // rebuilding from the order below.
    const linkedQuoteItems =
      order.quotation && Array.isArray(order.quotation.items)
        ? order.quotation.items
        : null;
    if (linkedQuoteItems && linkedQuoteItems.length > 0) {
      linkedQuoteItems.forEach((li: any) => {
        const qty = Number(li.quantity) || 1;
        const unitPrice = Number(li.unitPrice) || 0;
        items.push({
          description: li.description || "Quoted item",
          quantity: qty,
          unitPrice,
          total:
            typeof li.total === "number"
              ? li.total
              : qty * unitPrice,
          unitOfMeasure: li.unitOfMeasure || li.unit || "Sum",
        });
      });
    }

    // Add materials as line items (fallback when there's no linked quote).
    if (items.length === 0 && order.materials && order.materials.length > 0) {
      order.materials.forEach((material: any) => {
        items.push({
          description: material.description || material.itemName || 'Material',
          quantity: material.quantity || 1,
          unitPrice: material.unitPrice || 0,
          total: (material.quantity || 1) * (material.unitPrice || 0),
          unitOfMeasure: material.unit || 'Sum',
        });
      });
    }

    // Add job activities as line items (fallback when there's no linked quote).
    if (items.length === 0 && order.jobActivities && order.jobActivities.length > 0) {
      order.jobActivities.forEach((activity: any) => {
        items.push({
          description: activity.description || 'Labour',
          quantity: activity.hoursWorked || 1,
          unitPrice: activity.rate || 0,
          total: (activity.hoursWorked || 1) * (activity.rate || 0),
          unitOfMeasure: 'Hr',
        });
      });
    }

    // If no items from materials/activities, check for PM order costs
    if (items.length === 0 && order.isPropertyManagerOrder) {
      if (order.materialCost && order.materialCost > 0) {
        items.push({
          description: 'Materials',
          quantity: 1,
          unitPrice: order.materialCost,
          total: order.materialCost,
          unitOfMeasure: 'Sum',
        });
      }
      if (order.labourCost && order.labourCost > 0) {
        items.push({
          description: 'Labour',
          quantity: 1,
          unitPrice: order.labourCost,
          total: order.labourCost,
          unitOfMeasure: 'Sum',
        });
      }
    }

    // Set line items or default
    if (items.length > 0) {
      setLineItems(items);
    } else {
      setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
    }

    // Pre-populate company costs
    const materialCost = order.materialCost || order.totalMaterialBudget || 0;
    const labourCost = order.labourCost || order.totalLabourCostBudget || 0;
    
    setCompanyMaterialCost(materialCost > 0 ? materialCost.toString() : "");
    setCompanyLabourCost(labourCost > 0 ? labourCost.toString() : "");
    
    // Store the referenced order
    setReferencedOrder(order);
    setEditingInvoice(null);

    // Open the form
    setShowAddForm(true);

    // Scroll to the form
    setTimeout(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }, 100);
  };

  const invoices = invoicesQuery.data || [];
  
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    invoiceStatuses.forEach(status => {
      if (status.combined) {
        counts[status.value] = invoices.filter((i) => status.combined!.includes(i.status)).length;
      } else {
        counts[status.value] = invoices.filter((i) => i.status === status.value).length;
      }
    });
    return counts;
  }, [invoices]);
  
  const filteredInvoices = useMemo(() => {
    let filtered = invoices;
    
    // Apply status filter first
    if (statusFilter) {
      if (statusFilter === "SENT_ITEMS") {
        filtered = filtered.filter(invoice => invoice.status === "SENT" || invoice.status === "OVERDUE");
      } else {
        filtered = filtered.filter(invoice => invoice.status === statusFilter);
      }
    }

    // Self-initiated filter (invoices whose linked order was started by an
    // artisan without a pre-existing admin order).
    if (selfInitiatedFilter) {
      filtered = filtered.filter((invoice: any) => !!invoice.order?.selfInitiated);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(invoice =>
        invoice.customerName.toLowerCase().includes(query) ||
        invoice.customerEmail.toLowerCase().includes(query) ||
        invoice.invoiceNumber.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [invoices, statusFilter, searchTerm, selfInitiatedFilter]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-brand-danger-600 to-brand-danger-700 p-2 rounded-xl shadow-md">
                <Receipt className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
                <p className="text-sm text-gray-600">
                  {invoices.length} total invoices • Review workflow: Draft → Jr Admin Review → Sr Admin Approval → Sent
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-danger-600 to-brand-danger-700 hover:from-brand-danger-700 hover:to-brand-danger-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-danger-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Invoice
            </button>
            <button
              onClick={() => setShowReportModal(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 shadow-md transition-all"
            >
              <FileSpreadsheet className="h-5 w-5 mr-2" />
              Generate Report
            </button>
          </div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">Scope:</span>
            <PortfolioScopeToggle scope={scope} onChange={setScope} />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by invoice number, building name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-danger-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !statusFilter
                  ? "bg-brand-danger-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ALL ({invoices.length})
            </button>
            {invoiceStatuses.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(statusFilter === status.value ? null : status.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status.value
                    ? "bg-brand-danger-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status.label.toUpperCase()} ({statusCounts[status.value] || 0})
              </button>
            ))}
            {/* Self-initiated (artisan-started) toggle */}
            <button
              onClick={() => setSelfInitiatedFilter((v) => !v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all inline-flex items-center gap-1 ${
                selfInitiatedFilter
                  ? "bg-indigo-600 text-white shadow-md"
                  : "bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200"
              }`}
              title="Show only invoices whose linked order was started by an artisan without an admin-created order"
            >
              <Sparkles className="h-3.5 w-3.5" />
              SELF-INITIATED ({invoices.filter((i: any) => !!i.order?.selfInitiated).length})
            </button>
          </div>
        </div>

        {/* Completed Jobs Without Invoices */}
        {(completedOrdersWithoutInvoice.length > 0 || completedOrdersWithInvoiceCount > 0) && !statusFilter && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-sm border-2 border-purple-200 p-6 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Completed Jobs - Ready for Invoicing</h3>
                  <p className="text-sm text-gray-600">
                    <span className="font-semibold text-purple-700">{completedOrdersWithoutInvoice.length}</span>
                    {' '}waiting for invoice creation
                    {completedOrdersWithInvoiceCount > 0 && (
                      <>
                        {' • '}
                        <span className="text-gray-500">{completedOrdersWithInvoiceCount} already invoiced</span>
                      </>
                    )}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {completedOrdersWithInvoiceCount > 0 && (
                  <button
                    type="button"
                    onClick={() => setShowAllCompletedOrders((v) => !v)}
                    className="px-3 py-1.5 text-xs font-medium rounded-lg border border-purple-300 bg-white text-purple-700 hover:bg-purple-100 transition-colors"
                  >
                    {showAllCompletedOrders ? 'Hide invoiced jobs' : `Audit invoiced jobs (${completedOrdersWithInvoiceCount})`}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setCompletedJobsCollapsed((v) => !v)}
                  className="p-1.5 rounded-lg hover:bg-purple-100 text-purple-700"
                  title={completedJobsCollapsed ? 'Expand' : 'Collapse'}
                >
                  {completedJobsCollapsed ? <ChevronDown className="h-5 w-5" /> : <ChevronUp className="h-5 w-5" />}
                </button>
              </div>
            </div>
            {!completedJobsCollapsed && (
              <>
                {completedOrdersWithoutInvoice.length > 3 && (
                  <div className="relative mb-3">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="text"
                      value={completedJobsSearch}
                      onChange={(e) => setCompletedJobsSearch(e.target.value)}
                      placeholder="Filter completed jobs by order #, customer, description..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-purple-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-purple-400"
                    />
                  </div>
                )}
                <div className="space-y-3">
                  {visibleCompletedJobs.length === 0 && completedOrdersWithoutInvoice.length > 0 && (
                    <p className="text-sm text-gray-500 italic">No jobs match your filter.</p>
                  )}
                  {visibleCompletedJobs.length === 0 && completedOrdersWithoutInvoice.length === 0 && !showAllCompletedOrders && (
                    <p className="text-sm text-gray-600">All completed jobs have invoices. Toggle "Audit invoiced jobs" to review them.</p>
                  )}
                  {visibleCompletedJobs.map((order: any) => {
                    // PR-QF — surface quote-first signal on the card.
                    // A job that was self-initiated by an artisan (or that
                    // has no client PO number captured yet) should be quoted
                    // BEFORE we invoice, so the client can issue us a PO
                    // against the quote. Once a draft quote exists on the
                    // order (Order.quotationId), we show a "Quoted / awaiting
                    // client PO" pill instead of the recommendation.
                    const hasLinkedQuote =
                      !!order.quotationId || !!order.quotation?.id;
                    const linkedQuoteNumber =
                      order.quotation?.quoteNumber || null;
                    const linkedQuoteStatus =
                      order.quotation?.status || null;
                    // Existing DRAFT/PENDING_REVIEW invoice on the order —
                    // typically auto-generated when an artisan completes a
                    // self-initiated job. Admin still owes a decision.
                    const existingDraftInvoice =
                      order.invoice &&
                      ["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL"].includes(
                        String(order.invoice.status).toUpperCase(),
                      )
                        ? order.invoice
                        : null;
                    const needsClientPo =
                      !order.isPropertyManagerOrder &&
                      !String(order.clientOrderNumber ?? "").trim() &&
                      order.orderNumberStatus !== "HAS_NUMBER";
                    const recommendQuoteFirst =
                      !hasLinkedQuote && needsClientPo;
                    return (
                    <div key={`${order.isPropertyManagerOrder ? 'pm' : 'order'}-${order.id}`} className="bg-white rounded-lg border border-purple-200 p-4 hover:shadow-md transition-shadow">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-2 flex-wrap">
                            <h4 className="font-semibold text-gray-900">{order.orderNumber}</h4>
                            <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Completed
                            </span>
                            {order.isPropertyManagerOrder && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                PM Order
                              </span>
                            )}
                            {order.assignedTo && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                Artisan: {order.assignedTo.firstName} {order.assignedTo.lastName}
                              </span>
                            )}
                            {/* Client PO captured on the job card by the
                                artisan (or auto-carried from the original
                                admin order). Present = quote-first is not
                                needed. */}
                            {String(order.clientOrderNumber ?? "").trim() && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"
                                title="Client PO number captured on the job card."
                              >
                                <ClipboardCheck className="h-3 w-3" />
                                Client PO: {order.clientOrderNumber}
                              </span>
                            )}
                            {/* Existing draft invoice — auto-created by
                                artisan on self-initiated job completion. */}
                            {existingDraftInvoice && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 inline-flex items-center gap-1"
                                title={`Draft invoice already exists for this job. Review, edit or replace with a quote-first flow.`}
                              >
                                <Receipt className="h-3 w-3" />
                                Draft {existingDraftInvoice.invoiceNumber} · {String(existingDraftInvoice.status).toLowerCase().replace(/_/g, " ")}
                              </span>
                            )}
                            {/* PR-QF — quote-first status pills */}
                            {hasLinkedQuote && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 inline-flex items-center gap-1"
                                title={`Draft quote linked to this job. Invoice will pull line items from this quote once the client's PO is captured.`}
                              >
                                <ClipboardCheck className="h-3 w-3" />
                                Quoted{linkedQuoteNumber ? `: ${linkedQuoteNumber}` : ""}
                                {linkedQuoteStatus ? ` · ${linkedQuoteStatus.toLowerCase()}` : ""}
                              </span>
                            )}
                            {recommendQuoteFirst && (
                              <span
                                className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800 inline-flex items-center gap-1"
                                title="This job has no client PO. Send a quote first so the client can raise a PO against it — then invoice against that PO."
                              >
                                <AlertTriangle className="h-3 w-3" />
                                No client PO — quote first
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm text-gray-600">
                            <div className="flex items-center space-x-1">
                              <User className="h-4 w-4 text-gray-400" />
                              <span>{order.customerName}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Mail className="h-4 w-4 text-gray-400" />
                              <span>{order.customerEmail}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <p className="text-sm text-gray-700 mt-2">{order.description || order.title}</p>
                        </div>
                        <div className="ml-4 flex flex-col items-end gap-2">
                          {/* PR-QF — Send Quote First. Only offered for
                              non-PM orders that don't already have a linked
                              quote AND don't already have a client PO on
                              file. If the artisan has captured the client's
                              PO on the job card, we skip quote-first and go
                              straight to invoicing. */}
                          {!order.isPropertyManagerOrder && !hasLinkedQuote && needsClientPo && (
                            <button
                              onClick={() => {
                                setQuoteFirstOrder(order);
                                setQuoteFirstDepositPct("");
                                setQuoteFirstValidDays("30");
                                setQuoteFirstNotes("");
                              }}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors text-white bg-amber-600 hover:bg-amber-700"
                              title={
                                existingDraftInvoice
                                  ? `Cancel the existing draft ${existingDraftInvoice.invoiceNumber} and create a quote so the client can raise a PO first.`
                                  : "Create a draft quote from this job so the client can raise a PO against it before you invoice."
                              }
                            >
                              <Send className="h-4 w-4 mr-1" />
                              Send Quote First
                            </button>
                          )}
                          {/* Existing draft invoice — link straight to it. */}
                          {existingDraftInvoice ? (
                            <a
                              href={`/admin/invoices?invoiceId=${existingDraftInvoice.id}`}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                              title="Open the existing draft invoice to review, edit and approve."
                            >
                              <Receipt className="h-4 w-4 mr-1" />
                              Review Draft {existingDraftInvoice.invoiceNumber}
                            </a>
                          ) : (
                            <button
                              onClick={() => handleCreateInvoiceFromOrder(order)}
                              className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                              title={
                                hasLinkedQuote
                                  ? "Invoice against this job. Line items will be pulled from the linked quote."
                                  : "Create an invoice from this job."
                              }
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create Invoice
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                  })}
                </div>
                {showAllCompletedOrders && completedOrdersWithInvoice.length > 0 && (
                  <div className="mt-6 pt-4 border-t border-purple-200">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3">
                      Completed jobs already invoiced ({completedOrdersWithInvoice.length})
                    </h4>
                    <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
                      {completedOrdersWithInvoice.map((order: any) => {
                        const inv = order.invoice || (order.invoices && order.invoices[0]) || null;
                        return (
                          <div key={`done-${order.isPropertyManagerOrder ? 'pm' : 'order'}-${order.id}`} className="bg-white/60 rounded-lg border border-purple-100 p-3 text-sm flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-semibold text-gray-900">{order.orderNumber}</span>
                                {order.isPropertyManagerOrder && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-blue-100 text-blue-800">PM</span>
                                )}
                                {inv?.invoiceNumber && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-emerald-100 text-emerald-800">
                                    Invoice {inv.invoiceNumber}
                                  </span>
                                )}
                                {inv?.status && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-700">
                                    {inv.status}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-gray-600 truncate">
                                {order.customerName} • {new Date(order.createdAt).toLocaleDateString()}
                                {order.assignedTo && ` • ${order.assignedTo.firstName} ${order.assignedTo.lastName}`}
                              </div>
                            </div>
                            {inv?.id && (
                              <a
                                href={`/admin/invoices?invoiceId=${inv.id}`}
                                className="text-xs font-medium text-purple-700 hover:text-purple-900 whitespace-nowrap"
                              >
                                View invoice →
                              </a>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {/* Client Selector */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <ClientSelector
                  token={token!}
                  resetKey={clientSelectorResetKey}
                  onSelect={(client) => {
                    setValue("customerName", client.name, { shouldValidate: true });
                    setValue("customerEmail", client.email, { shouldValidate: true });
                    setValue("customerPhone", client.phone, { shouldValidate: true });
                    setValue("address", client.address, { shouldValidate: true });
                    if (client.vatNumber) setValue("customerVatNumber", client.vatNumber);
                    setSelectedClientId(client.clientId);
                    setSelectedClientBuildingId(client.clientBuildingId);
                  }}
                />
                <p className="mt-1.5 text-xs text-blue-600">Select a saved client to auto-fill the fields below, or type manually.</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Building Name *
                  </label>
                  <input
                    type="text"
                    {...register("customerName")}
                    placeholder="e.g. Calton Centre"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Shown as the site/building on the PDF.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invoice Number
                  </label>
                  <input
                    type="text"
                    {...register("invoiceNumber")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    placeholder="Leave empty to auto-generate"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {editingInvoice 
                      ? "You can edit this number if needed. It must be unique."
                      : "Optional: Enter a custom number or leave empty to auto-generate."
                    }
                  </p>
                  {errors.invoiceNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.invoiceNumber.message}</p>
                  )}
                  {referencedOrder && (
                    <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-xs font-medium text-blue-900">
                        Reference Order: <span className="font-bold">{referencedOrder.orderNumber}</span>
                      </p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    {...register("customerEmail")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                  {errors.customerEmail && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerEmail.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                  <input
                    type="text"
                    {...register("customerPhone")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                  {errors.customerPhone && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerPhone.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Address *</label>
                  <input
                    type="text"
                    {...register("address")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Client Reference / Order Number</label>
                  <input
                    type="text"
                    {...register("clientReferenceNumber")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    placeholder="e.g. PO-12345 or client reference"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Enter the client's order number or reference for this invoice.
                  </p>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                  <textarea
                    {...register("projectDescription")}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    placeholder="Brief description of the project/scope of work (appears on PDF above line items)"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Appears above the line items table on the PDF.
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Customer VAT Number</label>
                  <input
                    type="text"
                    {...register("customerVatNumber")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    placeholder="e.g. 4123456789"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Customer's VAT registration number (appears on PDF).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Date</label>
                  <input
                    type="date"
                    {...register("invoiceDate")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                  <input
                    type="date"
                    {...register("dueDate")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-brand-danger-100 text-brand-danger-800 px-2 py-1 rounded text-xs font-medium mr-2">
                    Admin Only
                  </span>
                  Internal Cost Tracking
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Material Cost (R)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={companyMaterialCost}
                      onChange={(e) => setCompanyMaterialCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Company Labour Cost (R)
                    </label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={companyLabourCost}
                      onChange={(e) => setCompanyLabourCost(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                />
              </div>

              {referencedOrder && (
                <div className="border-t pt-4 mt-4">
                  <div className="bg-gradient-to-br from-blue-50 to-purple-50 border-2 border-blue-200 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-gray-900 mb-4 flex items-center">
                      <Receipt className="h-4 w-4 mr-2 text-blue-600" />
                      Order Documentation - For Reference
                    </h3>
                    
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm mb-4">
                        <div>
                          <span className="font-medium text-gray-600">Order Number:</span>
                          <p className="text-gray-900 font-semibold">{referencedOrder.orderNumber}</p>
                        </div>
                        <div>
                          <span className="font-medium text-gray-600">Service Type:</span>
                          <p className="text-gray-900">{referencedOrder.serviceType}</p>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="bg-white rounded-lg p-4 border border-blue-300">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            📄 Order Summary PDF
                          </p>
                          <p className="text-xs text-gray-600 mb-3">
                            Complete summary of work completed - materials breakdown, labor hours, and expense documentation.
                          </p>
                          
                          <button
                            type="button"
                            onClick={() => handleDownloadOrderPdf('summary')}
                            disabled={downloadingOrderPdf}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloadingOrderPdf ? (
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

                        <div className="bg-white rounded-lg p-4 border border-green-300">
                          <p className="text-xs font-semibold text-gray-700 mb-1">
                            📋 {referencedOrder.isPropertyManagerOrder ? 'Property Manager Order' : 'Original Order'}
                          </p>
                          <p className="text-xs text-gray-600 mb-3">
                            {referencedOrder.isPropertyManagerOrder 
                              ? 'Property Manager\'s original work order with instructions and requirements.'
                              : 'Original contractor order document with job specifications.'}
                          </p>
                          
                          <button
                            type="button"
                            onClick={() => handleDownloadOrderPdf('originalOrder')}
                            disabled={downloadingOrderPdf}
                            className="w-full inline-flex items-center justify-center px-4 py-2.5 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {downloadingOrderPdf ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Generating PDF...
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 mr-2" />
                                Download {referencedOrder.isPropertyManagerOrder ? 'PM Order' : 'Original Order'}
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">Line Items</h3>
                  <div className="flex items-center gap-2">
                    <LineItemTemplatePicker
                      token={token!}
                      onInsert={(item) => setLineItems((prev) => [...prev, item])}
                      canManage={true}
                    />
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-brand-danger-600 hover:text-brand-danger-700 font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-4">
                        <div className="flex space-x-2">
                          <input
                            type="text"
                            value={item.description}
                            onChange={(e) => updateLineItem(index, "description", e.target.value)}
                            placeholder="Brief description (AI can expand this)"
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                          />
                          <button
                            type="button"
                            onClick={() => handleGenerateDescription(index)}
                            disabled={generatingDescriptionIndex === index || !item.description || item.description.trim().length < 3}
                            className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center whitespace-nowrap"
                            title="AI-powered description generation - enter a brief description first"
                          >
                            {generatingDescriptionIndex === index ? (
                              <>
                                <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                                AI...
                              </>
                            ) : (
                              <>
                                <Sparkles className="h-4 w-4 mr-1" />
                                AI
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                      <div className="col-span-1">
                        <select
                          value={item.unitOfMeasure}
                          onChange={(e) => updateLineItem(index, "unitOfMeasure", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                        >
                          {unitOfMeasureOptions.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateLineItem(index, "quantity", parseFloat(e.target.value) || 0)}
                          placeholder="Qty"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="text"
                          value={`R${(item.total || 0).toFixed(2)}`}
                          disabled
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50"
                        />
                      </div>
                      <div className="col-span-1">
                        {lineItems.length > 1 && (
                          <button
                            type="button"
                            onClick={() => removeLineItem(index)}
                            className="p-2 text-brand-danger-600 hover:text-brand-danger-700"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-1">
                  <label htmlFor="invoice-discount-percent" className="text-sm font-medium text-gray-700">
                    Discount (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="invoice-discount-percent"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(e.target.value)}
                      placeholder="0"
                      className="w-24 px-3 py-1.5 border border-gray-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-brand-secondary-500 focus:border-transparent"
                    />
                    <span className="text-sm text-gray-600">%</span>
                  </div>
                </div>
                {/* Deposit Required (requested from client, shown on the invoice PDF) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-1 bg-indigo-50/60 -mx-4 px-4 pt-3">
                  <div>
                    <label htmlFor="invoice-deposit-percent" className="text-sm font-semibold text-indigo-900 flex items-center gap-1">
                      <Wallet className="h-4 w-4" />
                      Deposit Required (%)
                    </label>
                    <p className="text-[11px] text-indigo-700/80 mt-0.5">
                      Displayed on the invoice PDF as up-front payment before work begins.
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap justify-end">
                    <div className="flex gap-1">
                      {[25, 50, 75, 100].map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => setDepositRequestedPercent(String(v))}
                          className="px-2 py-1 text-xs font-medium bg-white border border-indigo-200 text-indigo-700 rounded hover:bg-indigo-100"
                        >
                          {v}%
                        </button>
                      ))}
                    </div>
                    <input
                      id="invoice-deposit-percent"
                      type="number"
                      min={0}
                      max={100}
                      step="0.01"
                      value={depositRequestedPercent}
                      onChange={(e) => setDepositRequestedPercent(e.target.value)}
                      placeholder="0"
                      className="w-20 px-3 py-1.5 border border-indigo-300 rounded-lg text-right text-sm focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                    <span className="text-sm text-indigo-700">%</span>
                    <input
                      type="date"
                      value={depositDueDate}
                      onChange={(e) => setDepositDueDate(e.target.value)}
                      title="Deposit due date (optional)"
                      className="px-2 py-1.5 border border-indigo-300 rounded-lg text-xs focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    />
                  </div>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">R{calculateSubtotal().toFixed(2)}</span>
                </div>
                {clampedDiscountPct() > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-red-700">
                      <span>Discount ({clampedDiscountPct().toFixed(2)}%):</span>
                      <span className="font-medium">-R{calculateDiscountAmount().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-gray-600">Subtotal after discount:</span>
                      <span className="font-medium">R{calculateNetSubtotal().toFixed(2)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-medium">R{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
                  <span>R{calculateTotal().toFixed(2)}</span>
                </div>
                {clampedDepositPct() > 0 && (
                  <div className="mt-2 rounded-lg bg-indigo-50 border border-indigo-200 p-3 space-y-1">
                    <div className="flex justify-between text-sm text-indigo-900">
                      <span className="font-semibold">
                        Deposit Required ({clampedDepositPct().toFixed(2)}%):
                      </span>
                      <span className="font-bold">R{calculateDepositRequestedAmount().toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-indigo-800">
                      <span>Balance on Completion:</span>
                      <span className="font-medium">R{calculateBalanceOnCompletion().toFixed(2)}</span>
                    </div>
                    {depositDueDate && (
                      <div className="text-[11px] text-indigo-700/80 pt-1 border-t border-indigo-200">
                        Deposit due by {new Date(depositDueDate).toLocaleDateString("en-ZA")}
                      </div>
                    )}
                  </div>
                )}
                
                <div className="border-t pt-2 mt-2">
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Company Material Cost:</span>
                    <span>R{(parseFloat(companyMaterialCost) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-sm text-gray-600">
                    <span>Company Labour Cost:</span>
                    <span>R{(parseFloat(companyLabourCost) || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-base font-semibold mt-2 pt-2 border-t">
                    <span className={calculateEstimatedProfit() >= 0 ? "text-green-700" : "text-red-700"}>
                      Estimated Profit:
                    </span>
                    <span className={calculateEstimatedProfit() >= 0 ? "text-green-700" : "text-red-700"}>
                      R{calculateEstimatedProfit().toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingInvoice(null);
                    reset();
                    setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
                    setCompanyMaterialCost("");
                    setCompanyLabourCost("");
                    setDiscountPercent("");
                    setDepositRequestedPercent("");
                    setDepositDueDate("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createInvoiceMutation.isPending || updateInvoiceDetailsMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-danger-600 hover:bg-brand-danger-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {editingInvoice 
                    ? (updateInvoiceDetailsMutation.isPending ? "Updating..." : "Update Invoice")
                    : (createInvoiceMutation.isPending ? "Creating..." : "Create Invoice")
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredInvoices.map((invoiceRaw) => {
              const invoice = invoiceRaw as any;
              const isExpanded = expandedInvoices.has(invoice.id);
              const items = Array.isArray(invoice.items) ? invoice.items : [];
              const hasOrderReference = !!invoice.order;
              const totalCostToCompany = (invoice.companyMaterialCost || 0) + (invoice.companyLabourCost || 0);
              const allCreditNotes: any[] = ((creditNotesQuery as any).data ?? []) as any[];
              const invoiceCreditNotes = allCreditNotes.filter((cn: any) => cn.invoiceId === invoice.id);
              const totalCredits = invoiceCreditNotes.reduce((sum: number, cn: any) => sum + (Number(cn.total) || 0), 0);
              const netAfterCredits = Math.max(0, Number(invoice.total || 0) - totalCredits);
              
              return (
                <div id={`invoice-${invoice.id}`} key={invoice.id} className="hover:bg-gray-50/50 transition-colors">
                  {/* Compact Header Row */}
                  <div className="px-4 sm:px-6 py-3">
                    <div className="flex items-center justify-between gap-3">
                      {/* Left: Key info */}
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <button
                          onClick={() => toggleInvoiceExpansion(invoice.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                        </button>
                        <h3 className="text-sm font-bold text-gray-900 flex-shrink-0">{invoice.invoiceNumber}</h3>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                            invoice.status === "SENT" 
                              ? "bg-blue-100 text-blue-800"
                              : invoice.status === "OVERDUE"
                              ? "bg-red-100 text-red-800"
                              : invoiceStatuses.find((s) => s.value === invoice.status)?.color
                          }`}
                        >
                          {invoice.status === "SENT" 
                            ? "Sent"
                            : invoice.status === "OVERDUE"
                            ? "Overdue"
                            : invoiceStatuses.find((s) => s.value === invoice.status)?.label
                          }
                        </span>
                        {hasOrderReference && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 flex-shrink-0">
                            From Order
                          </span>
                        )}
                        {invoice.order?.selfInitiated && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800 flex-shrink-0 inline-flex items-center"
                            title={
                              invoice.order?.initiatedBy
                                ? `Self-initiated by ${invoice.order.initiatedBy.firstName ?? ""} ${invoice.order.initiatedBy.lastName ?? ""}`.trim()
                                : "Self-initiated (artisan-started)"
                            }
                          >
                            <Sparkles className="h-3 w-3 mr-1" />Self-initiated
                          </span>
                        )}
                        {invoice.order && !invoice.order.clientOrderNumber && invoice.order.orderNumberStatus === "PENDING_FROM_CLIENT" && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-900 flex-shrink-0 inline-flex items-center"
                            title="Client order/PO number still pending"
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />No PO#
                          </span>
                        )}
                        {invoice.order?.clientOrderNumber && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700 flex-shrink-0"
                            title="Client order / PO number"
                          >
                            PO {invoice.order.clientOrderNumber}
                          </span>
                        )}
                        {invoice.status === "PAID" && !invoice.remittanceUrl && (
                          <span
                            className="px-2 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-900 flex-shrink-0 inline-flex items-center cursor-pointer hover:bg-amber-200"
                            title="No remittance attached — click to upload"
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemittanceInvoice(invoice);
                              setRemittanceFile(null);
                              setShowRemittanceModal(true);
                            }}
                          >
                            <AlertTriangle className="h-3 w-3 mr-1" />No Remittance
                          </span>
                        )}
                        {invoice.remittanceUrl && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 flex-shrink-0 inline-flex items-center" title="Remittance attached">
                            <Paperclip className="h-3 w-3 mr-1" />Remittance
                          </span>
                        )}
                        <span className="text-sm text-gray-500 truncate hidden sm:inline">
                          <User className="h-3.5 w-3.5 inline mr-1" />{invoice.customerName}
                        </span>
                        <span className="text-sm text-gray-500 truncate hidden md:inline">
                          {invoice.customerEmail}
                        </span>
                      </div>

                      {/* Right: Amount + Actions */}
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-sm font-bold text-gray-900">R{(invoice.total || 0).toLocaleString()}</span>
                        {Number(invoice.depositAmount || 0) > 0 && (() => {
                          const paid = Number(invoice.depositAmount) || 0;
                          const total = Number(invoice.total) || 0;
                          const balance = Math.max(0, total - paid);
                          const settled = balance <= 0.005;
                          return (
                            <span
                              className={`text-xs font-semibold px-2 py-0.5 rounded ${
                                settled
                                  ? "bg-green-50 text-green-700"
                                  : "bg-emerald-50 text-emerald-700"
                              }`}
                              title={
                                settled
                                  ? `Deposit R${paid.toFixed(2)} settled the invoice in full`
                                  : `Paid R${paid.toFixed(2)} of R${total.toFixed(2)} — balance R${balance.toFixed(2)}`
                              }
                            >
                              <Wallet className="h-3 w-3 mr-1 inline-block" />
                              {settled
                                ? `Deposit: R${paid.toFixed(2)} (paid in full)`
                                : `Deposit R${paid.toFixed(2)} • Balance R${balance.toFixed(2)}`}
                            </span>
                          );
                        })()}
                        {totalCredits > 0 && (
                          <span className="text-xs font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded">
                            Credits: -R{totalCredits.toFixed(2)}
                          </span>
                        )}
                        {isAdmin && invoice.estimatedProfit !== undefined && (
                          <span className={`text-xs font-semibold ${invoice.estimatedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                            (P: R{invoice.estimatedProfit.toLocaleString()})
                          </span>
                        )}
                        <select
                          value={invoice.status}
                          onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500 hidden sm:block"
                        >
                          <option value={invoice.status}>
                            {invoice.status === "SENT" 
                              ? "Sent"
                              : invoice.status === "OVERDUE"
                              ? "Overdue"
                              : invoiceStatuses.find((s) => s.value === invoice.status)?.label
                            }
                          </option>
                          {getAvailableStatusTransitions(invoice.status, user?.role || "").map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {statusValue === "APPROVED" && invoice.status === "PENDING_APPROVAL" 
                                ? "✓ Approve"
                                : statusValue === "SENT" && invoice.status === "APPROVED"
                                ? "📤 Send to Customer"
                                : statusValue === "SENT"
                                ? "Sent"
                                : statusValue === "OVERDUE"
                                ? "Overdue"
                                : statusValue === "PENDING_APPROVAL"
                                ? "→ Forward to Sr Admin"
                                : statusValue === "REJECTED"
                                ? "✗ Reject"
                                : statusValue === "CANCELLED"
                                ? "Cancel"
                                : statusValue === "PAID"
                                ? "✓ Mark as Paid"
                                : statusValue === "DRAFT"
                                ? "← Back to Draft"
                                : statusValue === "PENDING_REVIEW"
                                ? "Submit for Review"
                                : statusValue.replace("_", " ")
                              }
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleEditInvoice(invoice)}
                          className="px-2 py-1 text-xs font-medium text-brand-danger-700 bg-brand-danger-50 hover:bg-brand-danger-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setHistoryInvoice(invoice);
                              setShowHistoryModal(true);
                            }}
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center"
                            title="View change history for this invoice"
                          >
                            <History className="h-3.5 w-3.5 mr-1" />History
                          </button>
                        )}
                        <button
                          onClick={() => setDeleteConfirmInvoiceId(invoice.id)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete invoice"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>

                    {/* Compact info line (always visible) */}
                    <div className="flex items-center gap-3 mt-1 ml-7 text-xs text-gray-500 flex-wrap">
                      <span className="sm:hidden flex items-center"><User className="h-3 w-3 mr-1" />{invoice.customerName}</span>
                      <span className="flex items-center"><Phone className="h-3 w-3 mr-1" />{invoice.customerPhone}</span>
                      {invoice.dueDate && (
                        <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" />Due {new Date(invoice.dueDate).toLocaleDateString()}</span>
                      )}
                      {isAdmin && totalCostToCompany > 0 && (
                        <span className="text-gray-600">
                          Cost: <span className="font-medium">R{totalCostToCompany.toLocaleString()}</span>
                          {invoice.companyMaterialCost ? ` (Mat: R${invoice.companyMaterialCost.toLocaleString()})` : ''}
                          {invoice.companyLabourCost ? ` (Lab: R${invoice.companyLabourCost.toLocaleString()})` : ''}
                        </span>
                      )}
                      {invoice.order && (
                        <span className="text-purple-600 font-medium">From Order {invoice.order.orderNumber}</span>
                      )}
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="px-4 sm:px-6 pb-4 space-y-3">
                      {/* Action Buttons */}
                      <div className="flex flex-wrap gap-2 py-2 border-t border-gray-100">
                        <button
                          onClick={() => openCreditNoteModal(invoice)}
                          className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors inline-flex items-center"
                        >
                          <FileMinus className="h-3.5 w-3.5 mr-1" />Create Credit Note
                        </button>
                        <button
                          onClick={() => handleExportPdf(invoice.id)}
                          disabled={generateInvoicePdfMutation.isPending && generatingPdfId === invoice.id}
                          className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                        >
                          {generateInvoicePdfMutation.isPending && generatingPdfId === invoice.id ? (
                            <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Generating...</>
                          ) : (
                            <><Download className="h-3.5 w-3.5 mr-1" />Export PDF</>
                          )}
                        </button>

                        <button
                          onClick={() => {
                            setRemittanceInvoice(invoice);
                            setRemittanceFile(null);
                            setShowRemittanceModal(true);
                          }}
                          className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center ${
                            invoice.remittanceUrl
                              ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                              : invoice.status === "PAID"
                              ? "text-amber-800 bg-amber-50 hover:bg-amber-100 ring-1 ring-amber-300"
                              : "text-teal-700 bg-teal-50 hover:bg-teal-100"
                          }`}
                          title={invoice.remittanceUrl ? "Replace remittance" : "Attach proof of payment"}
                        >
                          {invoice.remittanceUrl ? (
                            <><Paperclip className="h-3.5 w-3.5 mr-1" />Remittance Attached</>
                          ) : invoice.status === "PAID" ? (
                            <><AlertTriangle className="h-3.5 w-3.5 mr-1" />Attach Remittance</>
                          ) : (
                            <><Upload className="h-3.5 w-3.5 mr-1" />Attach Remittance</>
                          )}
                        </button>
                        {invoice.status !== "CANCELLED" && invoice.status !== "REJECTED" && (
                          <button
                            onClick={() => openDepositModal(invoice)}
                            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors inline-flex items-center ${
                              Number(invoice.depositAmount || 0) > 0
                                ? "text-emerald-700 bg-emerald-50 hover:bg-emerald-100"
                                : "text-indigo-700 bg-indigo-50 hover:bg-indigo-100"
                            }`}
                            title={
                              Number(invoice.depositAmount || 0) > 0
                                ? `Add another payment (already received R${Number(invoice.depositAmount).toFixed(2)})`
                                : "Record a deposit / partial payment from the client"
                            }
                          >
                            <Wallet className="h-3.5 w-3.5 mr-1" />
                            {Number(invoice.depositAmount || 0) > 0
                              ? "Add Payment"
                              : "Record Deposit"}
                          </button>
                        )}
                        {Number(invoice.depositAmount || 0) > 0 && isAdmin && (
                          <button
                            onClick={() => {
                              if (window.confirm(
                                `Clear R${Number(invoice.depositAmount).toFixed(2)} of recorded deposit(s) on ${invoice.invoiceNumber}?`
                              )) {
                                clearDepositMutation.mutate({ token: token!, invoiceId: invoice.id });
                              }
                            }}
                            disabled={clearDepositMutation.isPending}
                            className="px-2 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg transition-colors inline-flex items-center disabled:opacity-50"
                            title="Clear all recorded deposit payments on this invoice"
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        )}
                        {invoice.remittanceUrl && (
                          <a
                            href={invoice.remittanceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1.5 text-xs font-medium text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-50 rounded-lg transition-colors inline-flex items-center"
                          >
                            <ExternalLink className="h-3.5 w-3.5 mr-1" />View
                          </a>
                        )}

                        {invoice.order && (
                          <>
                            <button
                              onClick={() => handleDownloadOrderSummaryForInvoice(invoice)}
                              disabled={downloadingOrderPdf}
                              className="px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            >
                              {downloadingOrderPdf ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Downloading...</>
                              ) : (
                                <><FileText className="h-3.5 w-3.5 mr-1" />Order Summary</>
                              )}
                            </button>
                            <button
                              onClick={() => handleDownloadJobCardForInvoice(invoice)}
                              disabled={downloadingJobCardInvoiceId === invoice.id}
                              className="px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            >
                              {downloadingJobCardInvoiceId === invoice.id ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Downloading...</>
                              ) : (
                                <><Receipt className="h-3.5 w-3.5 mr-1" />Job Card</>
                              )}
                            </button>
                            {(!invoice.order.clientRepSignDate || !invoice.order.artisanSignatureUrl) && (
                              <button
                                onClick={() => setSignJobCardInvoiceId(invoice.id)}
                                className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center"
                                title={!invoice.order.clientRepSignDate ? "Capture client signature in-person (client & artisan)" : "Capture artisan signature"}
                              >
                                <PenLine className="h-3.5 w-3.5 mr-1" />Sign Job Card
                              </button>
                            )}
                            <button
                              onClick={() => handleDownloadMergedPdfForInvoice(invoice)}
                              disabled={downloadingMergedInvoiceId === invoice.id}
                              className="px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            >
                              {downloadingMergedInvoiceId === invoice.id ? (
                                <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Preparing...</>
                              ) : (
                                <><Sparkles className="h-3.5 w-3.5 mr-1" />Invoice + Order + Job Card</>
                              )}
                            </button>
                          </>
                        )}
                        {!invoice.order && isAdmin && (
                          <button
                            onClick={() => {
                              setManualJobCardInvoice(invoice);
                              setManualJobCardCompletionDate(new Date().toISOString().slice(0, 16));
                              setManualJobCardStartDate(
                                invoice.createdAt
                                  ? new Date(invoice.createdAt).toISOString().slice(0, 16)
                                  : ""
                              );
                              setManualJobCardSessions([{ startAt: "", endAt: "" }]);
                              setManualJobCardClientRep("");
                              setManualJobCardNotes("");
                              setShowManualJobCardModal(true);
                            }}
                            disabled={
                              generateJobCardForInvoiceMutation.isPending ||
                              manualJobCardPdfMutation.isPending
                            }
                            className="px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            title="Manually generate a job card for work already completed off-system"
                          >
                            {generateJobCardForInvoiceMutation.isPending ||
                            manualJobCardPdfMutation.isPending ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Generating...</>
                            ) : (
                              <><FileText className="h-3.5 w-3.5 mr-1" />Manual Job Card</>
                            )}
                          </button>
                        )}
                        {/* Mobile status select */}
                        <select
                          value={invoice.status}
                          onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                          className="px-2 py-1.5 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500 sm:hidden"
                        >
                          <option value={invoice.status}>
                            {invoice.status === "SENT" ? "Sent" : invoice.status === "OVERDUE" ? "Overdue" : invoiceStatuses.find((s) => s.value === invoice.status)?.label}
                          </option>
                          {getAvailableStatusTransitions(invoice.status, user?.role || "").map((statusValue) => (
                            <option key={statusValue} value={statusValue}>
                              {statusValue === "APPROVED" && invoice.status === "PENDING_APPROVAL" 
                                ? "✓ Approve" 
                                : statusValue === "SENT" && invoice.status === "APPROVED"
                                ? "📤 Send to Customer"
                                : statusValue === "PAID" ? "✓ Mark as Paid" : statusValue.replace("_", " ")}
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* Contact Details */}
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                        <div className="flex items-center"><User className="h-3.5 w-3.5 mr-1.5 text-gray-400" />{invoice.customerName}</div>
                        <div className="flex items-center"><Mail className="h-3.5 w-3.5 mr-1.5 text-gray-400" />{invoice.customerEmail}</div>
                        <div className="flex items-center"><Phone className="h-3.5 w-3.5 mr-1.5 text-gray-400" />{invoice.customerPhone}</div>
                        <div className="flex items-center"><DollarSign className="h-3.5 w-3.5 mr-1.5 text-gray-400" />Total: R{(invoice.total || 0).toLocaleString()}</div>
                        {totalCredits > 0 && (
                          <div className="flex items-center"><DollarSign className="h-3.5 w-3.5 mr-1.5 text-gray-400" />Net after credits: R{netAfterCredits.toFixed(2)}</div>
                        )}
                      </div>

                      {invoiceCreditNotes.length > 0 && (
                        <div className="bg-amber-50 rounded-lg border border-amber-200 p-3">
                          <h4 className="text-xs font-semibold text-amber-900 mb-2">Credit Notes ({invoiceCreditNotes.length})</h4>
                          <div className="space-y-2">
                            {invoiceCreditNotes.map((cn: any) => (
                              <div key={cn.id} className="flex items-center justify-between text-xs bg-white border border-amber-100 rounded p-2">
                                <div>
                                  <div className="font-semibold text-gray-900">{cn.creditNoteNumber} • -R{Number(cn.total || 0).toFixed(2)}</div>
                                  <div className="text-gray-600">{cn.reason}</div>
                                </div>
                                <button
                                  onClick={() => handleDownloadCreditNotePdf(cn.id)}
                                  disabled={generatingCreditPdfId === cn.id}
                                  className="px-2 py-1 rounded bg-amber-100 text-amber-800 hover:bg-amber-200 disabled:opacity-50 inline-flex items-center"
                                >
                                  {generatingCreditPdfId === cn.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Cost Breakdown - compact single section */}
                      {isAdmin && (invoice.companyMaterialCost !== undefined || invoice.companyLabourCost !== undefined) && (
                        <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-3 border border-green-100">
                          <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
                            <span className="font-semibold text-gray-900 text-xs uppercase tracking-wide">Cost to Company</span>
                            <span className="text-gray-600 text-xs">Material: <span className="font-medium text-gray-900">R{invoice.companyMaterialCost?.toFixed(2) || "0.00"}</span></span>
                            <span className="text-gray-600 text-xs">Labour: <span className="font-medium text-gray-900">R{invoice.companyLabourCost?.toFixed(2) || "0.00"}</span></span>
                            <span className="text-gray-600 text-xs">Total Cost: <span className="font-bold text-indigo-700">R{totalCostToCompany.toFixed(2)}</span></span>
                            <span className="text-gray-600 text-xs">Client Total: <span className="font-bold text-gray-900">R{(invoice.total || 0).toFixed(2)}</span></span>
                            <span className={`text-xs font-bold ${invoice.estimatedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                              Profit: R{invoice.estimatedProfit?.toLocaleString() || "0"}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Line Items Table */}
                      {items.length > 0 && (
                        <div className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                          <h4 className="text-xs font-semibold text-gray-900 mb-2">Line Items ({items.length})</h4>
                          <div className="overflow-x-auto scrollbar-none touch-pan-x">
                            <table className="min-w-full divide-y divide-gray-200 text-xs">
                              <thead>
                                <tr className="bg-gray-100">
                                  <th className="px-2 py-1.5 text-left font-medium text-gray-700 uppercase tracking-wider">Description</th>
                                  <th className="px-2 py-1.5 text-center font-medium text-gray-700 uppercase tracking-wider">UoM</th>
                                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 uppercase tracking-wider">Qty</th>
                                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 uppercase tracking-wider">Unit Price</th>
                                  <th className="px-2 py-1.5 text-right font-medium text-gray-700 uppercase tracking-wider">Total</th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {items.map((item: any, idx: number) => (
                                  <tr key={idx} className="hover:bg-gray-50">
                                    <td className="px-2 py-1.5 text-gray-900">{item.description}</td>
                                    <td className="px-2 py-1.5 text-gray-600 text-center">{item.unitOfMeasure || 'Sum'}</td>
                                    <td className="px-2 py-1.5 text-gray-900 text-right">{item.quantity}</td>
                                    <td className="px-2 py-1.5 text-gray-900 text-right">R{(item.unitPrice || 0).toFixed(2)}</td>
                                    <td className="px-2 py-1.5 font-semibold text-gray-900 text-right">R{(item.total || 0).toFixed(2)}</td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot className="bg-gray-50">
                                <tr>
                                  <td colSpan={4} className="px-2 py-1.5 font-medium text-gray-700 text-right">Subtotal:</td>
                                  <td className="px-2 py-1.5 font-semibold text-gray-900 text-right">R{(invoice.subtotal || 0).toFixed(2)}</td>
                                </tr>
                                <tr>
                                  <td colSpan={4} className="px-2 py-1.5 font-medium text-gray-700 text-right">VAT (15%):</td>
                                  <td className="px-2 py-1.5 font-semibold text-gray-900 text-right">R{(invoice.tax || 0).toFixed(2)}</td>
                                </tr>
                                <tr className="border-t-2 border-gray-300">
                                  <td colSpan={4} className="px-2 py-1.5 text-sm font-bold text-gray-900 text-right">Total:</td>
                                  <td className="px-2 py-1.5 text-sm font-bold text-brand-danger-600 text-right">R{(invoice.total || 0).toFixed(2)}</td>
                                </tr>
                              </tfoot>
                            </table>
                          </div>
                        </div>
                      )}

                      {invoice.rejectionReason && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2">
                          <p className="text-xs font-medium text-red-900">Rejection: <span className="font-normal text-red-700">{invoice.rejectionReason}</span></p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {filteredInvoices.length === 0 && (
              <div className="p-12 text-center">
                <Receipt className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No invoices found</p>
              </div>
            )}
          </div>
        </div>

        {showRejectionModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Invoice</h3>
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejecting this invoice. This will be visible to the customer.
              </p>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="Enter rejection reason..."
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500 mb-4"
              />
              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => {
                    setShowRejectionModal(false);
                    setRejectionInvoiceId(null);
                    setRejectionReason("");
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleRejectInvoice}
                  disabled={!rejectionReason.trim()}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-danger-600 hover:bg-brand-danger-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  Reject Invoice
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Post-completion in-person Sign Job Card modal */}
        {signJobCardInvoiceId !== null && (() => {
          const target = filteredInvoices.find((inv: any) => inv.id === signJobCardInvoiceId);
          if (!target || !target.order || !token) return null;
          return (
            <JobCardSignatureModal
              token={token}
              currentUserName={user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined}
              order={{
                id: target.order.id,
                orderNumber: target.order.orderNumber,
                serviceType: target.order.serviceType,
                description: (target.order as any).description ?? null,
                signedJobCardUrl: (target.order as any).signedJobCardUrl ?? null,
                clientRepName: (target.order as any).clientRepName ?? null,
                clientRepSignDate: (target.order as any).clientRepSignDate ?? null,
                artisanSignatureUrl: (target.order as any).artisanSignatureUrl ?? null,
                artisanSignedByName: (target.order as any).artisanSignedByName ?? null,
                artisanSignDate: (target.order as any).artisanSignDate ?? null,
                isPMOrder: false,
              }}
              onClose={() => setSignJobCardInvoiceId(null)}
            />
          );
        })()}

        {showDepositModal && depositInvoice && (() => {
          const total = Number(depositInvoice.total) || 0;
          const priorDeposit = Number(depositInvoice.depositAmount) || 0;
          const balanceOwing = Math.max(0, total - priorDeposit);
          const enteredAmt = parseFloat(depositAmountInput);
          const validAmt = isFinite(enteredAmt) && enteredAmt > 0;
          const projectedDeposit = validAmt ? priorDeposit + enteredAmt : priorDeposit;
          const projectedBalance = Math.max(0, total - projectedDeposit);
          const willOverPay = validAmt && projectedDeposit > total + 0.005;
          const willSettleInFull = validAmt && projectedBalance <= 0.005 && !willOverPay;
          return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
              <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto max-h-[95vh] overflow-y-auto">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 inline-flex items-center">
                      <Wallet className="h-5 w-5 mr-2 text-indigo-600" />
                      {priorDeposit > 0 ? "Add Payment" : "Record Deposit"}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">
                      Invoice <span className="font-medium">{depositInvoice.invoiceNumber}</span> — {depositInvoice.customerName}
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setShowDepositModal(false);
                      setDepositInvoice(null);
                    }}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>

                <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Invoice total:</span>
                    <span className="font-semibold text-gray-900">R{total.toFixed(2)}</span>
                  </div>
                  {priorDeposit > 0 && (
                    <div className="flex justify-between">
                      <span className="text-gray-600">Already received:</span>
                      <span className="font-medium text-emerald-700">R{priorDeposit.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between border-t pt-1 mt-1">
                    <span className="text-gray-700 font-medium">Balance owing:</span>
                    <span className="font-bold text-indigo-700">R{balanceOwing.toFixed(2)}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Amount received (R) *
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      value={depositAmountInput}
                      onChange={(e) => setDepositAmountInput(e.target.value)}
                      placeholder="0.00"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      autoFocus
                    />
                    <div className="flex gap-2 mt-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => setDepositAmountInput((total * 0.25).toFixed(2))}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >25%</button>
                      <button
                        type="button"
                        onClick={() => setDepositAmountInput((total * 0.5).toFixed(2))}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >50%</button>
                      <button
                        type="button"
                        onClick={() => setDepositAmountInput((total * 0.75).toFixed(2))}
                        className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded"
                      >75%</button>
                      <button
                        type="button"
                        onClick={() => setDepositAmountInput(balanceOwing.toFixed(2))}
                        className="px-2 py-1 text-xs bg-indigo-100 hover:bg-indigo-200 text-indigo-800 rounded font-medium"
                      >Full balance (R{balanceOwing.toFixed(2)})</button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment date
                    </label>
                    <input
                      type="date"
                      value={depositPaidDateInput}
                      onChange={(e) => setDepositPaidDateInput(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">
                      Payment method / reference (optional)
                    </label>
                    <input
                      type="text"
                      value={depositReferenceInput}
                      onChange={(e) => setDepositReferenceInput(e.target.value)}
                      placeholder="e.g. EFT — FNB Ref DEP001"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {validAmt && !willOverPay && (
                    <div className={`rounded-lg p-3 text-xs ${
                      willSettleInFull
                        ? "bg-green-50 border border-green-200 text-green-800"
                        : "bg-indigo-50 border border-indigo-200 text-indigo-800"
                    }`}>
                      <div className="font-medium mb-1">
                        {willSettleInFull ? "This will settle the invoice in full." : "After this payment:"}
                      </div>
                      <div>Total paid: <span className="font-semibold">R{projectedDeposit.toFixed(2)}</span></div>
                      <div>Balance remaining: <span className="font-semibold">R{projectedBalance.toFixed(2)}</span></div>
                      {willSettleInFull && (
                        <div className="mt-1 italic">
                          Invoice status will be set to <span className="font-semibold">PAID</span>.
                        </div>
                      )}
                    </div>
                  )}

                  {willOverPay && (
                    <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-xs text-rose-800">
                      Amount exceeds the balance owing (R{balanceOwing.toFixed(2)}). Reduce the amount or issue a credit note first.
                    </div>
                  )}
                </div>

                <div className="mt-6 flex justify-end gap-2">
                  <button
                    onClick={() => {
                      setShowDepositModal(false);
                      setDepositInvoice(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmitDeposit}
                    disabled={!validAmt || willOverPay || recordDepositMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
                  >
                    {recordDepositMutation.isPending ? (
                      <><Loader2 className="h-4 w-4 mr-1.5 animate-spin" />Recording...</>
                    ) : (
                      <><Wallet className="h-4 w-4 mr-1.5" />{willSettleInFull ? "Record & Mark Paid" : "Record Payment"}</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {showRemittanceModal && remittanceInvoice && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto max-h-[95vh] overflow-y-auto">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 inline-flex items-center">
                    <Paperclip className="h-5 w-5 mr-2 text-teal-600" />
                    Attach Remittance
                  </h3>
                  <p className="text-xs text-gray-500 mt-1">
                    Invoice <span className="font-medium">{remittanceInvoice.invoiceNumber}</span>
                    {" · "}R{(remittanceInvoice.total || 0).toLocaleString()}
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowRemittanceModal(false);
                    setRemittanceInvoice(null);
                    setRemittanceFile(null);
                  }}
                  className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-gray-600"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {remittanceInvoice.remittanceUrl && (
                <div className="mb-4 p-3 rounded-lg bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
                  Current file:{" "}
                  <a
                    href={remittanceInvoice.remittanceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium underline inline-flex items-center"
                  >
                    {remittanceInvoice.remittanceFileName || "remittance"}
                    <ExternalLink className="h-3 w-3 ml-1" />
                  </a>
                  {remittanceInvoice.remittanceUploadedAt && (
                    <div className="text-emerald-700 mt-0.5">
                      Uploaded {new Date(remittanceInvoice.remittanceUploadedAt).toLocaleString()}
                    </div>
                  )}
                </div>
              )}

              <label className="block text-sm font-medium text-gray-700 mb-2">
                Choose proof-of-payment file
              </label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setRemittanceFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-teal-50 file:text-teal-700 hover:file:bg-teal-100 mb-4"
              />
              {remittanceFile && (
                <p className="text-xs text-gray-500 mb-4">
                  Selected: <span className="font-medium text-gray-700">{remittanceFile.name}</span>
                  {" · "}
                  {(remittanceFile.size / 1024).toFixed(1)} KB
                </p>
              )}

              <div className="flex justify-between items-center">
                {remittanceInvoice.remittanceUrl ? (
                  <button
                    onClick={() => {
                      if (!token) return;
                      if (!confirm("Remove the existing remittance file?")) return;
                      clearRemittanceMutation.mutate({ token, invoiceId: remittanceInvoice.id });
                      setShowRemittanceModal(false);
                      setRemittanceInvoice(null);
                      setRemittanceFile(null);
                    }}
                    className="px-3 py-2 text-xs font-medium text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    Remove current
                  </button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowRemittanceModal(false);
                      setRemittanceInvoice(null);
                      setRemittanceFile(null);
                    }}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUploadRemittance}
                    disabled={!remittanceFile || uploadingRemittance}
                    className="px-4 py-2 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
                  >
                    {uploadingRemittance ? (
                      <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Uploading...</>
                    ) : (
                      <><Upload className="h-4 w-4 mr-2" />Upload & Attach</>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Alternative Revenue */}
      <div className="p-4 md:p-8">
        <AlternativeRevenueForm />
      </div>

      {/* Delete Invoice Confirmation Modal */}
      {showCreditNoteModal && selectedCreditInvoice && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Credit Note</h3>
            <p className="text-sm text-gray-600 mb-4">
              Linked invoice: <span className="font-medium">{selectedCreditInvoice.invoiceNumber}</span>
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reason *</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit Amount (R) *</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Dispute Reference (optional)</label>
                <input
                  type="text"
                  value={creditDisputeReason}
                  onChange={(e) => setCreditDisputeReason(e.target.value)}
                  placeholder="e.g. Disputed line item / incorrect quantity"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
                <textarea
                  value={creditNotesText}
                  onChange={(e) => setCreditNotesText(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-5">
              <button
                onClick={() => {
                  setShowCreditNoteModal(false);
                  setSelectedCreditInvoice(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateCreditNote}
                disabled={createCreditNoteMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50"
              >
                {createCreditNoteMutation.isPending ? "Creating..." : "Create Credit Note"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Invoice Confirmation Modal */}
      {deleteConfirmInvoiceId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Delete Invoice</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this invoice? This will also delete all associated line items. This action cannot be undone.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setDeleteConfirmInvoiceId(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  deleteInvoiceMutation.mutate({
                    token: token!,
                    invoiceId: deleteConfirmInvoiceId,
                  });
                }}
                disabled={deleteInvoiceMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {deleteInvoiceMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Invoices Report"
        filenamePrefix="invoices_report"
        columns={[
          { header: "Invoice #", key: "invoiceNumber" },
          { header: "Quote #", key: "quotation", format: (v: any) => v?.quoteNumber || "\u2014" },
          { header: "Order #", key: "order", format: (v: any) => v?.orderNumber || "\u2014" },
          { header: "Building Name", key: "customerName" },
          { header: "Company", key: "client", format: (v: any) => v?.companyName || v?.name || "\u2014" },
          { header: "Building", key: "clientBuilding", format: (v: any) => v?.name || "\u2014" },
          { header: "Email", key: "customerEmail" },
          { header: "Phone", key: "customerPhone" },
          { header: "Address", key: "address" },
          { header: "Invoice Status", key: "status" },
          { header: "Order Status", key: "order", format: (v: any) => {
            if (!v) return "\u2014";
            const map: Record<string, string> = {
              PENDING: "Order Pending",
              ASSIGNED: "Assigned to Artisan",
              IN_PROGRESS: "Job In Progress",
              COMPLETED: "Job Done",
              CANCELLED: "Cancelled",
            };
            return map[v.status] || v.status;
          } },
          { header: "Paid?", key: "status", format: (v: any, row: any) => {
            if (v === "PAID") return `Yes (${row.paidDate ? new Date(row.paidDate).toLocaleDateString() : ""})`;
            if (v === "CANCELLED") return "N/A";
            return "No";
          } },
          { header: "Days Outstanding", key: "createdAt", format: (_v: any, row: any) => {
            if (row.status === "PAID" || row.status === "CANCELLED") return "\u2014";
            const start = row.createdAt ? new Date(row.createdAt).getTime() : null;
            if (!start) return "\u2014";
            return String(Math.max(0, Math.round((Date.now() - start) / (1000 * 60 * 60 * 24))));
          } },
          { header: "Days Overdue", key: "dueDate", format: (v: any, row: any) => {
            if (!v || row.status === "PAID" || row.status === "CANCELLED") return "\u2014";
            const due = new Date(v).getTime();
            const days = Math.round((Date.now() - due) / (1000 * 60 * 60 * 24));
            return days > 0 ? String(days) : "\u2014";
          } },
          { header: "Total", key: "total", format: (v: any) => `R${(v || 0).toLocaleString()}` },
          { header: "Est. Profit", key: "estimatedProfit", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "Material Cost", key: "companyMaterialCost", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "Labour Cost", key: "companyLabourCost", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "Due Date", key: "dueDate", format: (v: any) => v ? new Date(v).toLocaleDateString() : "\u2014" },
          { header: "Paid Date", key: "paidDate", format: (v: any) => v ? new Date(v).toLocaleDateString() : "\u2014" },
          { header: "Date Created", key: "createdAt", format: (v: any) => v ? new Date(v).toLocaleDateString() : "\u2014" },
          { header: "Notes", key: "notes" },
        ]}
        data={invoices}
        searchAccessors={[
          (r: any) => r.customerName,
          (r: any) => r.customerEmail,
          (r: any) => r.customerPhone,
          (r: any) => r.address,
          (r: any) => r.invoiceNumber,
          (r: any) => r.order?.orderNumber,
          (r: any) => r.quotation?.quoteNumber,
          (r: any) => r.client?.companyName,
          (r: any) => r.client?.name,
          (r: any) => r.clientBuilding?.name,
          (r: any) => r.clientBuilding?.address,
          (r: any) => r.notes,
        ]}
        presets={[
          { label: "Unpaid", description: "All invoices not yet paid", predicate: (r: any) => r.status !== "PAID" && r.status !== "CANCELLED" && r.status !== "DRAFT" },
          { label: "Overdue", description: "Past due date and not paid", predicate: (r: any) => r.dueDate && new Date(r.dueDate).getTime() < Date.now() && r.status !== "PAID" && r.status !== "CANCELLED" },
          { label: "Paid", description: "Invoice marked paid", predicate: (r: any) => r.status === "PAID" },
          { label: "Disputed", description: "Customer disputed the invoice", predicate: (r: any) => r.isDisputed === true },
          { label: "Job Done \u2014 Invoiced", description: "Order completed and invoice raised", predicate: (r: any) => r.order?.status === "COMPLETED" },
          { label: "Invoiced \u2014 Job Not Done", description: "Invoice raised but order is not completed yet (potential issue)", predicate: (r: any) => r.order && r.order.status !== "COMPLETED" && r.order.status !== "CANCELLED" },
        ]}
        filters={[
          {
            label: "Invoice Status",
            key: "status",
            options: [
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING_REVIEW", label: "Pending Review" },
              { value: "PENDING_APPROVAL", label: "Pending Approval" },
              { value: "APPROVED", label: "Approved" },
              { value: "SENT", label: "Sent" },
              { value: "OVERDUE", label: "Overdue" },
              { value: "PAID", label: "Paid" },
              { value: "CANCELLED", label: "Cancelled" },
              { value: "REJECTED", label: "Rejected" },
            ],
          },
          {
            label: "Customer / Contact Name",
            key: "customerName",
            type: "text",
            accessor: (r: any) => r.customerName,
          },
          {
            label: "Company",
            key: "companyName",
            type: "text",
            accessor: (r: any) => r.client?.companyName || r.client?.name || "",
          },
          {
            label: "Building",
            key: "buildingName",
            type: "text",
            accessor: (r: any) => r.clientBuilding?.name || "",
          },
        ]}
      />

      {showManualJobCardModal && manualJobCardInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">Generate Manual Job Card</h3>
            <p className="text-sm text-gray-600 mb-4">
              For invoice <span className="font-semibold">{manualJobCardInvoice.invoiceNumber}</span> — creates a
              completed job order snapshot and downloads the job card PDF. Use this when the job was completed
              off-system and no order was created at the time.
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date &amp; Time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={manualJobCardStartDate}
                  onChange={(e) => setManualJobCardStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  When the crew started on site. Defaults to the invoice date if left blank. Ignored if you
                  add Work Sessions below.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completion Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={manualJobCardCompletionDate}
                  onChange={(e) => setManualJobCardCompletionDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">When the client signed the completed work off.</p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Work Sessions (optional)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setManualJobCardSessions((prev) => [...prev, { startAt: "", endAt: "" }])
                    }
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 inline-flex items-center"
                  >
                    + Add another session
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Add one row per day the crew was on site. Leave blank if unknown — start defaults to the
                  invoice date.
                </p>
                <div className="space-y-2">
                  {manualJobCardSessions.map((session, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2 items-end p-2 border border-gray-200 rounded-lg bg-gray-50"
                    >
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">
                          Start (day {idx + 1})
                        </label>
                        <input
                          type="datetime-local"
                          value={session.startAt}
                          onChange={(e) =>
                            setManualJobCardSessions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, startAt: e.target.value } : s))
                            )
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">End (day {idx + 1})</label>
                        <input
                          type="datetime-local"
                          value={session.endAt}
                          onChange={(e) =>
                            setManualJobCardSessions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, endAt: e.target.value } : s))
                            )
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setManualJobCardSessions((prev) =>
                            prev.length === 1 ? [{ startAt: "", endAt: "" }] : prev.filter((_, i) => i !== idx)
                          )
                        }
                        disabled={manualJobCardSessions.length === 1 && !session.startAt && !session.endAt}
                        className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-40"
                        aria-label="Remove session"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Representative Name (optional)
                </label>
                <input
                  type="text"
                  value={manualJobCardClientRep}
                  onChange={(e) => setManualJobCardClientRep(e.target.value)}
                  placeholder="Person who accepted the completed work on site"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if the client was unavailable to sign.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
                <textarea
                  value={manualJobCardNotes}
                  onChange={(e) => setManualJobCardNotes(e.target.value)}
                  rows={3}
                  placeholder="Any context for the job card record..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                A completed order will be created with a snapshot of this invoice's customer, address, line
                items, and totals, then linked back to the invoice. The order will be flagged in its notes as
                manually generated retroactively.
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowManualJobCardModal(false);
                  setManualJobCardInvoice(null);
                }}
                disabled={generateJobCardForInvoiceMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!manualJobCardCompletionDate) {
                    toast.error("Completion date is required");
                    return;
                  }
                  const validSessions = manualJobCardSessions
                    .filter((s) => s.startAt && s.endAt)
                    .map((s) => ({ startAt: s.startAt, endAt: s.endAt }));
                  const invalidSession = validSessions.find(
                    (s) => new Date(s.endAt).getTime() < new Date(s.startAt).getTime()
                  );
                  if (invalidSession) {
                    toast.error("Each session's end must be after its start");
                    return;
                  }
                  generateJobCardForInvoiceMutation.mutate({
                    token: token!,
                    invoiceId: manualJobCardInvoice.id,
                    completionDate: manualJobCardCompletionDate,
                    ...(manualJobCardStartDate ? { startDate: manualJobCardStartDate } : {}),
                    ...(validSessions.length > 0 ? { workSessions: validSessions } : {}),
                    ...(manualJobCardClientRep ? { clientRepName: manualJobCardClientRep } : {}),
                    ...(manualJobCardNotes ? { notes: manualJobCardNotes } : {}),
                  });
                }}
                disabled={generateJobCardForInvoiceMutation.isPending || !manualJobCardCompletionDate}
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
              >
                {generateJobCardForInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="h-4 w-4 mr-2" />
                    Generate & Download
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Change History Modal */}
      {showHistoryModal && historyInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <History className="h-5 w-5 mr-2 text-slate-600" />
                  Change History
                </h3>
                <p className="text-sm text-gray-600">
                  Invoice <span className="font-semibold">{historyInvoice.invoiceNumber}</span>
                  {historyInvoice.customerName ? <> — {historyInvoice.customerName}</> : null}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryInvoice(null);
                }}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {historyQuery.isLoading && (
              <div className="flex items-center justify-center py-8 text-gray-500">
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Loading history...
              </div>
            )}
            {historyQuery.error && (
              <div className="p-3 rounded-lg bg-red-50 text-sm text-red-700">
                {(historyQuery.error as any)?.message || "Failed to load history"}
              </div>
            )}
            {historyQuery.data && historyQuery.data.length === 0 && (
              <div className="p-6 text-center text-sm text-gray-500">
                No change history recorded yet. New edits from now on will be tracked automatically.
              </div>
            )}
            {historyQuery.data && historyQuery.data.length > 0 && (
              <ol className="space-y-3">
                {historyQuery.data.map((entry: any) => {
                  const actionColor =
                    entry.action === "CREATE" ? "bg-emerald-100 text-emerald-800"
                    : entry.action === "UPDATE" ? "bg-blue-100 text-blue-800"
                    : entry.action === "DELETE" ? "bg-red-100 text-red-800"
                    : entry.action === "STATUS_CHANGE" ? "bg-amber-100 text-amber-800"
                    : entry.action === "CONVERT" ? "bg-purple-100 text-purple-800"
                    : "bg-slate-100 text-slate-800";
                  const changes = entry.changes || {};
                  const changeKeys = Object.keys(changes);
                  return (
                    <li key={entry.id} className="p-3 rounded-lg border border-slate-200 bg-slate-50">
                      <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded ${actionColor}`}>
                            {entry.action.replace(/_/g, " ")}
                          </span>
                          <span className="text-sm font-medium text-gray-900">
                            {entry.userName || "Unknown user"}
                          </span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {new Date(entry.createdAt).toLocaleString()}
                        </span>
                      </div>
                      {entry.description && (
                        <p className="text-sm text-gray-700 mb-1">{entry.description}</p>
                      )}
                      {changeKeys.length > 0 && (
                        <div className="mt-2 rounded border border-slate-200 bg-white overflow-hidden">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-100 text-slate-700">
                                <th className="text-left px-2 py-1 font-medium">Field</th>
                                <th className="text-left px-2 py-1 font-medium">Before</th>
                                <th className="text-left px-2 py-1 font-medium">After</th>
                              </tr>
                            </thead>
                            <tbody>
                              {changeKeys.map((k) => {
                                const c = changes[k];
                                const fmt = (v: any) =>
                                  v === null || v === undefined ? <span className="text-slate-400">—</span>
                                  : typeof v === "boolean" ? String(v)
                                  : typeof v === "number" ? v.toLocaleString()
                                  : String(v);
                                return (
                                  <tr key={k} className="border-t border-slate-100">
                                    <td className="px-2 py-1 font-medium text-slate-700 align-top">{k}</td>
                                    <td className="px-2 py-1 text-slate-600 align-top">{fmt(c?.before)}</td>
                                    <td className="px-2 py-1 text-slate-900 align-top">{fmt(c?.after)}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </li>
                  );
                })}
              </ol>
            )}

            <div className="flex justify-end mt-5">
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryInvoice(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PR-QF — Send Quote First confirmation modal.
          Confirms the order to be quoted, and lets the admin optionally set
          a deposit % and validity window before minting the DRAFT quote.
          On confirm we call trpc.createQuotationFromOrder which links
          Order.quotationId, appends a QUOTE_SENT_AWAITING_CLIENT_PO blocker
          and writes audit entries on both Order + Quotation. */}
      {quoteFirstOrder && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Send className="h-5 w-5 text-amber-600" />
                  Send Quote First
                </h3>
                <p className="text-sm text-gray-600 mt-1">
                  Create a <strong>draft quote</strong> from{" "}
                  <strong>{quoteFirstOrder.orderNumber}</strong> so{" "}
                  <strong>{quoteFirstOrder.customerName}</strong> can raise a
                  PO against it. The order will stay in Ready-for-Invoicing
                  until the client's PO is captured.
                </p>
              </div>
              <button
                onClick={() => setQuoteFirstOrder(null)}
                className="text-gray-400 hover:text-gray-600"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-sm text-amber-900 mb-4">
              <p className="font-medium">What this does</p>
              <ul className="mt-1 list-disc list-inside space-y-0.5 text-amber-800">
                <li>Builds the quote from this job's materials, labour and call-out.</li>
                <li>Links the quote to the order so nothing gets double-billed.</li>
                <li>Records an audit entry on both the order and the new quote.</li>
                <li>You'll still need to review + send the quote to the client.</li>
              </ul>
            </div>

            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Valid for (days)
                </label>
                <input
                  type="number"
                  min={1}
                  max={365}
                  value={quoteFirstValidDays}
                  onChange={(e) => setQuoteFirstValidDays(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  Deposit requested (%)
                </label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={quoteFirstDepositPct}
                  onChange={(e) => setQuoteFirstDepositPct(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
              </div>
            </div>

            <div className="mb-5">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Notes for the client (optional)
              </label>
              <textarea
                value={quoteFirstNotes}
                onChange={(e) => setQuoteFirstNotes(e.target.value)}
                rows={3}
                placeholder="e.g. Payment terms, on-site conditions, warranty note..."
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-400"
              />
            </div>

            <div className="flex justify-end gap-2">
              <button
                onClick={() => setQuoteFirstOrder(null)}
                disabled={quoteFirstMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!token || !quoteFirstOrder) return;
                  const depositPctNum = quoteFirstDepositPct.trim() === ""
                    ? undefined
                    : Number(quoteFirstDepositPct);
                  const validDaysNum = quoteFirstValidDays.trim() === ""
                    ? undefined
                    : Number(quoteFirstValidDays);
                  quoteFirstMutation.mutate({
                    token,
                    orderId: quoteFirstOrder.id,
                    depositRequestedPercent:
                      Number.isFinite(depositPctNum as number)
                        ? (depositPctNum as number)
                        : undefined,
                    validUntilDays:
                      Number.isFinite(validDaysNum as number)
                        ? (validDaysNum as number)
                        : undefined,
                    notes: quoteFirstNotes.trim() || undefined,
                  });
                }}
                disabled={quoteFirstMutation.isPending}
                className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {quoteFirstMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                    Creating draft quote...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4 mr-1" />
                    Create draft quote
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}