import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { SignedMinioImage, SignedMinioLink } from "~/components/SignedMinioUrl";
import RFQReportModal from "~/components/RFQReportModal";
import { ClientSelector } from "~/components/ClientSelector";
import { LineItemTemplatePicker } from "~/components/LineItemTemplatePicker";
import {
  PortfolioScopeToggle,
  useInitialPortfolioScope,
  type PortfolioScope,
} from "~/components/PortfolioScopeToggle";
import { PricingCatalogAutocomplete, DeviationBadge } from "~/components/PricingCatalogAutocomplete";
import { QuoteScopeBuilder } from "~/components/QuoteScopeBuilder";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  FileText,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Trash2,
  Edit,
  Download,
  Loader2,
  Sparkles,
  Wand2,
  ChevronDown,
  ChevronUp,
  FileSpreadsheet,
  Receipt,
  Briefcase,
  CheckCircle,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  History,
  X,
  Wallet,
  PenLine,
  Link2,
} from "lucide-react";
import { ReportModal } from "~/components/ReportModal";
import { JobCardSignatureModal } from "~/components/JobCardSignatureModal";
import { SendSignatureRequestModal } from "~/components/SendSignatureRequestModal";
import { PhotoUpload } from "~/components/PhotoUpload";

export const Route = createFileRoute("/admin/quotations/")({
  component: QuotationsPage,
});

const quotationSchema = z.object({
  customerName: z.string().min(1, "Building name is required"),
  quoteNumber: z.string().min(1).optional(),
  clientReferenceQuoteNumber: z.string().optional(),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  quotationDate: z.string().optional(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.number().optional(),
  companyMaterialCost: z.number().optional(),
  companyLabourCost: z.number().optional(),
  projectDescription: z.string().optional(),
  customerVatNumber: z.string().optional(),
});

type QuotationForm = z.infer<typeof quotationSchema>;

const quotationStatuses = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING_ARTISAN_REVIEW", label: "Pending Artisan Review", color: "bg-yellow-100 text-yellow-800" },
  { value: "IN_PROGRESS", label: "In Progress (Artisan)", color: "bg-blue-100 text-blue-800" },
  { value: "PENDING_JUNIOR_MANAGER_REVIEW", label: "Ready for Admin Review", color: "bg-orange-100 text-orange-800" },
  { value: "PENDING_SENIOR_MANAGER_REVIEW", label: "Pending Senior Admin Review", color: "bg-orange-100 text-orange-800" },
  { value: "APPROVED", label: "Approved", color: "bg-green-100 text-green-800" },
  { value: "SENT_TO_CUSTOMER", label: "Sent to Customer", color: "bg-purple-100 text-purple-800" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
  { value: "APPROVED_BY_CUSTOMER", label: "Approved by Customer", color: "bg-emerald-100 text-emerald-800" },
  { value: "REJECTED_BY_CUSTOMER", label: "Rejected by Customer", color: "bg-rose-100 text-rose-800" },
];

function getAvailableStatusTransitions(currentStatus: string, userRole: string) {
  const isAdminRole = userRole === "SENIOR_ADMIN" || userRole === "JUNIOR_ADMIN";
  // Admin-tier roles (including Technical Manager / Manager / generic ADMIN) should
  // never be stuck in the quotation workflow — they can move the quote to ANY
  // status from ANY status. Backend already permits this.
  const isAdminTier =
    isAdminRole ||
    userRole === "ADMIN" ||
    userRole === "TECHNICAL_MANAGER" ||
    userRole === "MANAGER";

  if (isAdminTier) {
    const allStatuses = [
      "DRAFT",
      "PENDING_ARTISAN_REVIEW",
      "IN_PROGRESS",
      "PENDING_JUNIOR_MANAGER_REVIEW",
      "PENDING_SENIOR_MANAGER_REVIEW",
      "APPROVED",
      "SENT_TO_CUSTOMER",
      "APPROVED_BY_CUSTOMER",
      "REJECTED_BY_CUSTOMER",
      "REJECTED",
    ];
    return allStatuses.filter((s) => s !== currentStatus);
  }

  const transitions: Record<string, string[]> = {
    DRAFT: ["PENDING_ARTISAN_REVIEW"],
    PENDING_ARTISAN_REVIEW: ["IN_PROGRESS", "DRAFT"],
    IN_PROGRESS: ["PENDING_JUNIOR_MANAGER_REVIEW", "PENDING_ARTISAN_REVIEW"],
    PENDING_JUNIOR_MANAGER_REVIEW: isAdminRole
      ? ["PENDING_SENIOR_MANAGER_REVIEW", "APPROVED", "REJECTED", "IN_PROGRESS"]
      : [],
    PENDING_SENIOR_MANAGER_REVIEW: isAdminRole
      ? ["APPROVED", "REJECTED", "IN_PROGRESS"]
      : [],
    APPROVED: isAdminRole
      ? ["SENT_TO_CUSTOMER", "APPROVED_BY_CUSTOMER", "REJECTED_BY_CUSTOMER", "REJECTED"]
      : ["SENT_TO_CUSTOMER"],
    SENT_TO_CUSTOMER: isAdminRole ? ["APPROVED_BY_CUSTOMER", "REJECTED_BY_CUSTOMER", "REJECTED"] : [],
    REJECTED: ["DRAFT"],
    APPROVED_BY_CUSTOMER: isAdminRole ? ["REJECTED_BY_CUSTOMER"] : [],
    REJECTED_BY_CUSTOMER: isAdminRole ? ["SENT_TO_CUSTOMER", "APPROVED_BY_CUSTOMER", "DRAFT"] : [],
  };

  return transitions[currentStatus] || [];
}

interface LineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  total: number;
  unitOfMeasure: string;
}

function QuotationsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" },
  ]);
  const [companyMaterialCost, setCompanyMaterialCost] = useState<string>("");
  const [companyLabourCost, setCompanyLabourCost] = useState<string>("");
  const [discountPercent, setDiscountPercent] = useState<string>("");
  // Deposit REQUESTED from the client on the quotation document itself.
  const [depositRequestedPercent, setDepositRequestedPercent] = useState<string>("");
  const [depositDueDate, setDepositDueDate] = useState<string>("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionQuotationId, setRejectionQuotationId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [generatingLineItems, setGeneratingLineItems] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showRFQReportModal, setShowRFQReportModal] = useState(false);
  const [selectedRFQReportQuotation, setSelectedRFQReportQuotation] = useState<any | null>(null);
  const [downloadingRFQReportPdfId, setDownloadingRFQReportPdfId] = useState<number | null>(null);
  const [deletingQuotationId, setDeletingQuotationId] = useState<number | null>(null);
  const [expandedQuotations, setExpandedQuotations] = useState<Set<number>>(new Set());
  const initialScope = useInitialPortfolioScope();
  const [scope, setScope] = useState<PortfolioScope>(initialScope);
  const [selectedQuotationIds, setSelectedQuotationIds] = useState<Set<number>>(new Set());
  const bulkUpdateMutation = useMutation(
    trpc.bulkUpdateQuotationStatus.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(`Updated ${res?.count ?? "selected"} quotation(s)`);
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setSelectedQuotationIds(new Set());
      },
      onError: (e: any) => toast.error(e?.message || "Bulk update failed"),
    })
  );
  const bulkDeleteMutation = useMutation(
    trpc.bulkDeleteQuotations.mutationOptions({
      onSuccess: (res: any) => {
        toast.success(`Deleted ${res?.count ?? "selected"} quotation(s)`);
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setSelectedQuotationIds(new Set());
      },
      onError: (e: any) => toast.error(e?.message || "Bulk delete failed"),
    })
  );
  const [clientSelectorResetKey, setClientSelectorResetKey] = useState(0);
  const [selectedClientId, setSelectedClientId] = useState<number | undefined>(undefined);
  const [selectedClientBuildingId, setSelectedClientBuildingId] = useState<number | undefined>(undefined);
  const [showConvertModal, setShowConvertModal] = useState(false);
  const [convertingQuotation, setConvertingQuotation] = useState<any>(null);
  const [convertCreateOrder, setConvertCreateOrder] = useState(true);
  const [convertAssignedTo, setConvertAssignedTo] = useState<string>("");
  const [convertDueDate, setConvertDueDate] = useState<string>("");
  const [convertNotes, setConvertNotes] = useState<string>("");

  // Retroactive job card generation (for jobs done off-system)
  type JobCardWorkSession = { startAt: string; endAt: string };
  const [showJobCardModal, setShowJobCardModal] = useState(false);
  const [jobCardQuotation, setJobCardQuotation] = useState<any>(null);
  const [jobCardCompletionDate, setJobCardCompletionDate] = useState<string>("");
  const [jobCardStartDate, setJobCardStartDate] = useState<string>("");
  const [jobCardSessions, setJobCardSessions] = useState<JobCardWorkSession[]>([
    { startAt: "", endAt: "" },
  ]);
  const [jobCardClientRep, setJobCardClientRep] = useState<string>("");
  const [jobCardNotes, setJobCardNotes] = useState<string>("");
  const [jobCardClientPO, setJobCardClientPO] = useState<string>("");
  // Edit mode: when set, the modal updates an existing manually-generated
  // order instead of creating a new one. Populated by clicking "Edit Job
  // Card" on a row where generatedOrder already exists.
  const [editingJobCardOrderId, setEditingJobCardOrderId] = useState<number | null>(null);
  // Retroactive traceability — before/after site photos and materials-used
  // ledger, both persisted on the created Order so the job card PDF renders
  // the full evidence trail (same shape as jobs completed via the normal flow).
  type JobCardMaterialRow = {
    name: string;
    description: string;
    quantity: string;
    unitPrice: string;
    supplier: string;
  };
  const [jobCardBeforePictures, setJobCardBeforePictures] = useState<string[]>([]);
  const [jobCardAfterPictures, setJobCardAfterPictures] = useState<string[]>([]);
  const [jobCardMaterials, setJobCardMaterials] = useState<JobCardMaterialRow[]>([]);
  const [generatingJobCardId, setGeneratingJobCardId] = useState<number | null>(null);
  const [pendingJobCardOrderNumber, setPendingJobCardOrderNumber] = useState<string>("");

  // Post-generation job card actions (mirror admin/operations row buttons so a
  // quotation with a generatedOrder gets the same Sign / Send / Download flow).
  const [signJobCardOrderId, setSignJobCardOrderId] = useState<number | null>(null);
  const [sendSigOrder, setSendSigOrder] = useState<{
    id: number;
    customerName: string;
    customerEmail: string;
    customerPhone: string;
  } | null>(null);
  const [downloadingJobCardOrderId, setDownloadingJobCardOrderId] = useState<number | null>(null);
  const [mergingQuoteJobCardId, setMergingQuoteJobCardId] = useState<number | null>(null);

  // Change history (audit trail)
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyQuotation, setHistoryQuotation] = useState<any>(null);
  const historyQuery = useQuery(
    trpc.getEntityAuditLog.queryOptions(
      {
        token: token!,
        entityType: "Quotation",
        entityId: historyQuotation?.id ?? 0,
        limit: 200,
      },
      { enabled: !!token && !!historyQuotation?.id && showHistoryModal }
    )
  );

  const toggleQuotationExpansion = (quotationId: number) => {
    const newExpanded = new Set(expandedQuotations);
    if (newExpanded.has(quotationId)) {
      newExpanded.delete(quotationId);
    } else {
      newExpanded.add(quotationId);
    }
    setExpandedQuotations(newExpanded);
  };

  const isAdmin = user?.role === "JUNIOR_ADMIN" || user?.role === "SENIOR_ADMIN";

  const unitOfMeasureOptions = [
    { value: "m2", label: "m2" },
    { value: "Lm", label: "Lm" },
    { value: "Sum", label: "Sum" },
    { value: "m3", label: "m3" },
    { value: "Hr", label: "Hr" },
  ];

  const quotationsQuery = useQuery(
    trpc.getQuotations.queryOptions({
      token: token!,
      status: statusFilter as any,
      scope,
    })
  );

  const artisansQuery = useQuery(
    trpc.getArtisans.queryOptions({
      token: token!,
    })
  );

  const artisans = artisansQuery.data || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    setValue,
  } = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
  });

  const createQuotationMutation = useMutation(
    trpc.createQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
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
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create quotation");
      },
    })
  );

  const updateQuotationDetailsMutation = useMutation(
    trpc.updateQuotationDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        reset();
        setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
        setCompanyMaterialCost("");
        setCompanyLabourCost("");
        setDiscountPercent("");
        setDepositRequestedPercent("");
        setDepositDueDate("");
        setShowAddForm(false);
        setEditingQuotation(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update quotation");
      },
    })
  );

  const updateQuotationStatusMutation = useMutation(
    trpc.updateQuotationStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update quotation status");
      },
    })
  );

  const generateQuotationPdfMutation = useMutation(
    trpc.generateQuotationPdf.mutationOptions({
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
        const quotation = quotations.find(q => q.id === variables.quotationId);
        link.download = `quotation-${quotation?.quoteNumber || variables.quotationId}.pdf`;
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

  const generateRFQReportPdfMutation = useMutation(
    trpc.generateRFQReportPdf.mutationOptions({
      onSuccess: (data, variables) => {
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
        const quotation = quotations.find(q => q.id === variables.quotationId);
        link.download = `rfq-report-${quotation?.quoteNumber || variables.quotationId}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("RFQ Report PDF downloaded successfully!");
        setDownloadingRFQReportPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate RFQ Report PDF");
        setDownloadingRFQReportPdfId(null);
      },
    })
  );

  const generateLineItemsMutation = useMutation(
    trpc.generateQuotationLineItems.mutationOptions({
      onSuccess: (data) => {
        // Replace current line items with AI-generated ones
        setLineItems(data.lineItems);
        toast.success(`Generated ${data.lineItems.length} line items with AI!`);
        setGeneratingLineItems(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate line items");
        setGeneratingLineItems(false);
      },
    })
  );

  const deleteQuotationMutation = useMutation(
    trpc.deleteQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setShowDeleteModal(false);
        setDeletingQuotationId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete quotation");
      },
    })
  );

  // Keep the last-attempted convert payload so we can retry with
  // updateExisting=true after the user confirms the sync prompt. Some
  // TanStack/tRPC mutation option shapes don't pass `variables` to onError,
  // so a ref is the reliable way to recover the input.
  const lastConvertPayloadRef = useRef<any>(null);
  const convertToInvoiceMutation = useMutation(
    trpc.convertQuotationToInvoice.mutationOptions({
      onSuccess: (data: any) => {
        const verb = data?.updated ? "refreshed" : "created";
        toast.success(
          `Invoice ${data.invoice.invoiceNumber} ${verb} successfully!${data.order ? ` Order ${data.order.orderNumber} also created.` : ""}`,
        );
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setShowConvertModal(false);
        setConvertingQuotation(null);
        setConvertCreateOrder(true);
        setConvertAssignedTo("");
        setConvertDueDate("");
        setConvertNotes("");
        lastConvertPayloadRef.current = null;
      },
      onError: (error: any) => {
        // If the quotation was already invoiced, offer to REFRESH the existing
        // invoice with the latest quotation contents instead of hard-failing.
        const isAlreadyConverted =
          error?.data?.code === "CONFLICT" ||
          /already converted to invoice/i.test(error?.message ?? "");
        const payload = lastConvertPayloadRef.current;
        if (isAlreadyConverted && payload && !payload.updateExisting) {
          const proceed = window.confirm(
            `${error?.message ?? "This quotation is already linked to an invoice."}\n\nUpdate the existing invoice with the latest quotation details?`,
          );
          if (proceed) {
            const retryPayload = { ...payload, updateExisting: true };
            lastConvertPayloadRef.current = retryPayload;
            convertToInvoiceMutation.mutate(retryPayload);
            return;
          }
        }
        toast.error(error.message || "Failed to convert quotation to invoice");
      },
    })
  );

  const convertToOrderMutation = useMutation(
    trpc.convertQuotationToOrder.mutationOptions({
      onSuccess: (data) => {
        toast.success(`Order ${data.order.orderNumber} created successfully!`);
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to assign job from quotation");
      },
    })
  );

  const jobCardPdfMutation = useMutation(
    trpc.generateJobCardPdf.mutationOptions({
      onSuccess: (data: any) => {
        try {
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
          link.download = `job-card-${pendingJobCardOrderNumber || "download"}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
          toast.success("Job card PDF downloaded");
        } catch (e) {
          toast.error("Failed to download job card PDF");
        }
        setGeneratingJobCardId(null);
        setPendingJobCardOrderNumber("");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate job card PDF");
        setGeneratingJobCardId(null);
        setPendingJobCardOrderNumber("");
      },
    })
  );

  const generateJobCardMutation = useMutation(
    trpc.generateJobCardForQuotation.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message || `Job card ${data.order.orderNumber} created`);
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setShowJobCardModal(false);
        setJobCardQuotation(null);
        setJobCardCompletionDate("");
        setJobCardStartDate("");
        setJobCardSessions([{ startAt: "", endAt: "" }]);
        setJobCardClientRep("");
        setJobCardNotes("");
        setJobCardClientPO("");
        setJobCardBeforePictures([]);
        setJobCardAfterPictures([]);
        setJobCardMaterials([]);
        setEditingJobCardOrderId(null);
        // Immediately download the job card PDF for the new order
        setGeneratingJobCardId(data.order.id);
        setPendingJobCardOrderNumber(data.order.orderNumber);
        jobCardPdfMutation.mutate({ token: token!, orderId: data.order.id });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate job card");
      },
    })
  );

  // Update path — used when the admin clicks "Edit Job Card" on a row that
  // already has a manually-generated order. Same modal, different mutation.
  const updateManualJobCardMutation = useMutation(
    trpc.updateManualJobCard.mutationOptions({
      onSuccess: (data) => {
        toast.success(data.message || `Job card ${data.orderNumber} updated`);
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        setShowJobCardModal(false);
        setJobCardQuotation(null);
        setJobCardCompletionDate("");
        setJobCardStartDate("");
        setJobCardSessions([{ startAt: "", endAt: "" }]);
        setJobCardClientRep("");
        setJobCardNotes("");
        setJobCardClientPO("");
        setJobCardBeforePictures([]);
        setJobCardAfterPictures([]);
        setJobCardMaterials([]);
        setEditingJobCardOrderId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update job card");
      },
    })
  );

  // Populate the modal from an existing generated order and open in edit
  // mode. Keeps the same visual shell as the "Generate" flow so admins only
  // have one form to learn.
  const openEditJobCardModal = (quotation: any, ord: any) => {
    // Strip the machine-managed retroTag + sessionsBlock + "Job card
    // generated from quotation ..." trailer from notes so the textarea shows
    // only the free-text portion the admin originally typed.
    const rawNotes: string = ord?.notes || "";
    const strippedNotes = rawNotes
      .split("\n")
      .filter((line: string) => !/^\[Manually generated retroactively/.test(line))
      .filter((line: string) => !/^Job card generated from quotation/.test(line))
      .join("\n")
      // Also strip the "Work sessions:" block (label line + indented rows).
      .replace(/(^|\n)Work sessions:(\n\s{2}\d+\..*)+/g, "")
      .trim();

    // Parse the persisted "Work sessions:" block back into the editor rows
    // so the admin can tweak individual days.
    const sessions: JobCardWorkSession[] = [];
    const sessionRegex = /^\s{2}\d+\.\s+(.+?)\s→\s(.+)$/gm;
    const sessionBlockMatch = rawNotes.match(/Work sessions:\n((?:\s{2}\d+\..*(?:\n|$))+)/);
    if (sessionBlockMatch?.[1]) {
      let m: RegExpExecArray | null;
      while ((m = sessionRegex.exec(sessionBlockMatch[1])) !== null) {
        const startStr = m[1]!.trim();
        const endStr = m[2]!.trim();
        // toLocalString'd back to datetime-local — best effort; if it fails
        // we leave the row blank so the admin can re-enter.
        const parseZa = (s: string) => {
          const d = new Date(s);
          if (Number.isNaN(d.getTime())) return "";
          const pad = (n: number) => n.toString().padStart(2, "0");
          return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };
        sessions.push({ startAt: parseZa(startStr), endAt: parseZa(endStr) });
      }
    }

    const toDatetimeLocal = (v: any) => {
      if (!v) return "";
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) return "";
      const pad = (n: number) => n.toString().padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    setJobCardQuotation(quotation);
    setEditingJobCardOrderId(ord.id);
    setJobCardCompletionDate(toDatetimeLocal(ord.endTime));
    setJobCardStartDate(toDatetimeLocal(ord.startTime));
    setJobCardSessions(sessions.length > 0 ? sessions : [{ startAt: "", endAt: "" }]);
    setJobCardClientRep(ord.clientRepName || "");
    setJobCardClientPO(ord.clientOrderNumber || "");
    setJobCardNotes(strippedNotes);
    setJobCardBeforePictures(Array.isArray(ord.beforePictures) ? ord.beforePictures : []);
    setJobCardAfterPictures(Array.isArray(ord.afterPictures) ? ord.afterPictures : []);
    setJobCardMaterials(
      Array.isArray(ord.materials)
        ? ord.materials.map((m: any) => ({
            name: m.name || "",
            description: m.description || "",
            quantity: m.quantity != null ? String(m.quantity) : "",
            unitPrice: m.unitPrice != null ? String(m.unitPrice) : "",
            supplier: m.supplier || "",
          }))
        : []
    );
    setShowJobCardModal(true);
  };


  // ─── Post-generation job card helpers (used by the row action bar when
  //     quotation.generatedOrder exists) ────────────────────────────────────
  // Silent mutation hooks — the shared `jobCardPdfMutation` and
  // `generateQuotationPdfMutation` above both trigger auto-downloads via
  // their onSuccess hooks. For the Download / Merge buttons on generated
  // rows we need to await the base64 bytes without those side effects.
  const jobCardPdfSilentMutation = useMutation(trpc.generateJobCardPdf.mutationOptions());
  const quotationPdfSilentMutation = useMutation(trpc.generateQuotationPdf.mutationOptions());

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

  const handleDownloadJobCardForRow = async (orderId: number, orderNumber: string) => {
    setDownloadingJobCardOrderId(orderId);
    try {
      const data: any = await jobCardPdfSilentMutation.mutateAsync({ token: token!, orderId });
      downloadPdfBytes(base64ToUint8Array(data.pdf), `job-card-${orderNumber || orderId}.pdf`);
      toast.success("Job card downloaded");
    } catch (err: any) {
      toast.error(err?.message || "Failed to download job card");
    } finally {
      setDownloadingJobCardOrderId(null);
    }
  };

  // Merge Quotation PDF + Job Card PDF into a single file — mirrors the
  // "Invoice + Order + Job Card" pattern from admin/operations so the client
  // can be sent both documents as one attachment.
  const handleMergeQuoteJobCard = async (quotation: any) => {
    const ord = quotation.generatedOrder;
    if (!ord) {
      toast.error("No job card has been generated for this quotation yet");
      return;
    }
    setMergingQuoteJobCardId(quotation.id);
    const toastId = toast.loading("Preparing combined Quote + Job Card PDF...");
    try {
      const [{ PDFDocument }] = await Promise.all([import("pdf-lib")]);
      const [quotePdf, jobCardPdf] = await Promise.all([
        quotationPdfSilentMutation.mutateAsync({ token: token!, quotationId: quotation.id }),
        jobCardPdfSilentMutation.mutateAsync({ token: token!, orderId: ord.id }),
      ]);
      const merged = await PDFDocument.create();
      const appendBase64 = async (b64: string) => {
        const src = await PDFDocument.load(base64ToUint8Array(b64));
        const copied = await merged.copyPages(src, src.getPageIndices());
        copied.forEach((p) => merged.addPage(p));
      };
      await appendBase64((quotePdf as any).pdf);
      await appendBase64((jobCardPdf as any).pdf);
      const bytes = await merged.save();
      downloadPdfBytes(
        bytes,
        `quote-and-jobcard-${quotation.quoteNumber || quotation.id}.pdf`
      );
      toast.success("Quote + Job Card downloaded!", { id: toastId });
    } catch (err: any) {
      toast.error(err?.message || "Failed to generate combined PDF", { id: toastId });
    } finally {
      setMergingQuoteJobCardId(null);
    }
  };

  const handleEditQuotation = (quotation: any) => {
    setEditingQuotation(quotation.id);
    setShowAddForm(true);
    
    // Populate form fields
    reset({
      customerName: quotation.customerName,
      quoteNumber: quotation.quoteNumber,
      clientReferenceQuoteNumber: quotation.clientReferenceQuoteNumber || "",
      customerEmail: quotation.customerEmail,
      customerPhone: quotation.customerPhone,
      address: quotation.address,
      quotationDate: quotation.createdAt ? new Date(quotation.createdAt).toISOString().split('T')[0] : "",
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : "",
      notes: quotation.notes || "",
      assignedToId: quotation.assignedToId || undefined,
      projectDescription: quotation.projectDescription || "",
      customerVatNumber: quotation.customerVatNumber || "",
    });
    
    // Populate line items
    if (quotation.items && Array.isArray(quotation.items)) {
      setLineItems(quotation.items);
    }
    
    // Populate cost fields
    setCompanyMaterialCost(quotation.companyMaterialCost?.toString() || "");
    setCompanyLabourCost(quotation.companyLabourCost?.toString() || "");
    setDiscountPercent(
      quotation.discountPercent && quotation.discountPercent > 0
        ? String(quotation.discountPercent)
        : "",
    );
    setDepositRequestedPercent(
      (quotation as any).depositRequestedPercent && (quotation as any).depositRequestedPercent > 0
        ? String((quotation as any).depositRequestedPercent)
        : "",
    );
    setDepositDueDate(
      (quotation as any).depositDueDate
        ? new Date((quotation as any).depositDueDate).toISOString().slice(0, 10)
        : "",
    );
  };

  const handleStatusChange = (quotationId: number, newStatus: string) => {
    if (newStatus === "REJECTED") {
      setRejectionQuotationId(quotationId);
      setShowRejectionModal(true);
    } else {
      updateQuotationStatusMutation.mutate({
        token: token!,
        quotationId,
        status: newStatus as any,
      });
    }
  };

  const handleRejectQuotation = () => {
    if (!rejectionQuotationId || !rejectionReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    updateQuotationStatusMutation.mutate({
      token: token!,
      quotationId: rejectionQuotationId,
      status: "REJECTED",
      rejectionReason: rejectionReason.trim(),
    });

    setShowRejectionModal(false);
    setRejectionQuotationId(null);
    setRejectionReason("");
  };

  const handleExportPdf = (quotationId: number) => {
    setGeneratingPdfId(quotationId);
    generateQuotationPdfMutation.mutate({
      token: token!,
      quotationId,
    });
  };

  const handleDeleteClick = (quotationId: number) => {
    setDeletingQuotationId(quotationId);
    setShowDeleteModal(true);
  };

  const handleConfirmDelete = () => {
    if (!deletingQuotationId) return;
    
    deleteQuotationMutation.mutate({
      token: token!,
      quotationId: deletingQuotationId,
    });
  };

  const handleGenerateLineItems = () => {
    const customerName = getValues("customerName");
    const customerEmail = getValues("customerEmail");
    const serviceType = (getValues() as any).serviceType as string | undefined;
    const address = getValues("address");
    const notes = getValues("notes");
    
    // Validate required fields for AI generation
    if (!customerName || !customerName.trim()) {
      toast.error("Please enter the building name before generating line items");
      return;
    }
    
    if (!customerEmail || !customerEmail.trim()) {
      toast.error("Please enter the customer email before generating line items");
      return;
    }
    
    // Build a comprehensive description
    let description = `Customer: ${customerName}\n`;
    if (customerEmail) description += `Email: ${customerEmail}\n`;
    if (serviceType) description += `Service Type: ${serviceType}\n`;
    if (address) description += `Location: ${address}\n`;
    if (notes) description += `Additional Notes: ${notes}`;
    
    if (!serviceType && !notes) {
      toast.error("Please provide either a service type or notes describing the work before generating line items");
      return;
    }

    setGeneratingLineItems(true);
    generateLineItemsMutation.mutate({
      token: token!,
      serviceDescription: description,
      serviceType: serviceType || undefined,
      address: address || undefined,
    });
  };

  const addLineItem = () => {
    setLineItems([...lineItems, { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    setLineItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;

        const nextItem = { ...item, [field]: value } as LineItem;

        if (field === "quantity" || field === "unitPrice") {
          nextItem.total = Number(nextItem.quantity) * Number(nextItem.unitPrice);
        }

        return nextItem;
      })
    );
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const clampedDiscountPct = () => {
    const raw = parseFloat(discountPercent);
    if (!Number.isFinite(raw) || raw <= 0) return 0;
    return Math.min(100, raw);
  };

  const calculateDiscountAmount = () => {
    return calculateSubtotal() * (clampedDiscountPct() / 100);
  };

  const calculateNetSubtotal = () => {
    return Math.max(0, calculateSubtotal() - calculateDiscountAmount());
  };

  const calculateTax = () => {
    return calculateNetSubtotal() * 0.15; // 15% VAT (on discounted subtotal)
  };

  const calculateTotal = () => {
    return calculateNetSubtotal() + calculateTax();
  };

  const calculateEstimatedProfit = () => {
    const subtotal = calculateNetSubtotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    return subtotal - materialCost - labourCost;
  };

  // Deposit REQUESTED from the client (percent-based). Amount is derived
  // from the canonical total so the form and PDF always match.
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

  const onSubmit = (data: QuotationForm) => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();
    const discountPct = clampedDiscountPct();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    const estimatedProfit = calculateNetSubtotal() - materialCost - labourCost;

    if (editingQuotation) {
      updateQuotationDetailsMutation.mutate({
        token: token!,
        quotationId: editingQuotation,
        ...data,
        quoteNumber: data.quoteNumber,
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
      createQuotationMutation.mutate({
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
        clientId: selectedClientId,
        clientBuildingId: selectedClientBuildingId,
      });
    }
  };

  const quotations: any[] = quotationsQuery.data || [];
  const filteredQuotations = quotations.filter((quotation) =>
    quotation.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quotation.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quotation.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusMetrics = quotationStatuses.map((status) => ({
    ...status,
    count: quotations.filter((q) => q.status === status.value).length,
  }));

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
              <div className="bg-gradient-to-br from-brand-secondary-600 to-brand-secondary-700 p-2 rounded-xl shadow-md">
                <FileText className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Quotations</h1>
                <p className="text-sm text-gray-600">
                  {quotations.length} total quotations • Workflow: Draft → Artisan Review → In Progress → Admin Review → Approved
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-brand-secondary-600 to-brand-secondary-700 hover:from-brand-secondary-700 hover:to-brand-secondary-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-secondary-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Quotation
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
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {statusMetrics.map((metric) => (
              <div
                key={metric.value}
                className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setStatusFilter(statusFilter === metric.value ? null : metric.value)}
              >
                <div className="text-3xl font-bold text-gray-900 mb-1">{metric.count}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${metric.color}`}>
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuotation ? "Edit Quotation" : "Create New Quotation"}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">Shown as the site/building on the PDF.</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Quotation Number
                  </label>
                  <input
                    type="text"
                    {...register("quoteNumber", {
                      setValueAs: (v) =>
                        typeof v === "string" && v.trim() === "" ? undefined : v,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                    placeholder="Leave empty to auto-generate"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {editingQuotation 
                      ? "You can edit this number if needed. It must be unique."
                      : "Optional: Enter a custom number or leave empty to auto-generate."
                    }
                  </p>
                  {errors.quoteNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.quoteNumber.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Client Reference Quote Number
                  </label>
                  <input
                    type="text"
                    {...register("clientReferenceQuoteNumber", {
                      setValueAs: (v) =>
                        typeof v === "string" && v.trim() === "" ? undefined : v,
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                    placeholder="e.g. PM RFQ number"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Used to reference the client/PM quote number (e.g. RFQ number).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email *</label>
                  <input
                    type="email"
                    {...register("customerEmail")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  />
                  {errors.address && (
                    <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Project Description</label>
                  <textarea
                    {...register("projectDescription")}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                    placeholder="e.g. 4123456789"
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    Optional: Customer's VAT registration number (appears on PDF).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Assign to Artisan
                  </label>
                  <select
                    {...register("assignedToId", { 
                      setValueAs: (v) => v === "" ? undefined : parseInt(v) 
                    })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  >
                    <option value="">-- Select Artisan (Optional) --</option>
                    {artisans.map((artisan) => (
                      <option key={artisan.id} value={artisan.id}>
                        {artisan.firstName} {artisan.lastName}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Quotation Date</label>
                  <input
                    type="date"
                    {...register("quotationDate")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Valid Until</label>
                  <input
                    type="date"
                    {...register("validUntil")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  />
                </div>
              </div>

              <div className="border-t pt-4 mt-4">
                <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center">
                  <span className="bg-brand-secondary-100 text-brand-secondary-800 px-2 py-1 rounded text-xs font-medium mr-2">
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                    />
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-900">Line Items</h3>
                  <div className="flex space-x-2">
                    <button
                      type="button"
                      onClick={handleGenerateLineItems}
                      disabled={generatingLineItems}
                      className="text-sm text-purple-700 bg-purple-50 hover:bg-purple-100 font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                      title="AI-powered line item generation"
                    >
                      {generatingLineItems ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                          Generating...
                        </>
                      ) : (
                        <>
                          <Wand2 className="h-4 w-4 mr-1" />
                          Generate with AI
                        </>
                      )}
                    </button>
                    <LineItemTemplatePicker
                      token={token!}
                      onInsert={(item) => setLineItems((prev) => [...prev, item])}
                      canManage={true}
                    />
                    <QuoteScopeBuilder
                      token={token!}
                      clientId={selectedClientId ?? null}
                      clientBuildingId={selectedClientBuildingId ?? null}
                      onReplaceItems={(newItems) =>
                        setLineItems(newItems.length > 0 ? newItems : [{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }])
                      }
                    />
                    <button
                      type="button"
                      onClick={addLineItem}
                      className="text-sm text-brand-secondary-600 hover:text-brand-secondary-700 font-medium"
                    >
                      + Add Item
                    </button>
                  </div>
                </div>
                <div className="space-y-3">
                  {lineItems.map((item, index) => (
                    <div key={index} className="grid grid-cols-12 gap-3 items-start">
                      <div className="col-span-4">
                        <PricingCatalogAutocomplete
                          token={token!}
                          value={item.description}
                          onChange={(v) => updateLineItem(index, "description", v)}
                          onPick={(p) => {
                            updateLineItem(index, "description", p.description);
                            updateLineItem(index, "unitOfMeasure", p.unitOfMeasure);
                            updateLineItem(index, "unitPrice", p.unitPrice);
                          }}
                          clientId={selectedClientId ?? null}
                          clientBuildingId={selectedClientBuildingId ?? null}
                          placeholder="Start typing — pricing catalog will suggest…"
                        />
                      </div>
                      <div className="col-span-1">
                        <select
                          value={item.unitOfMeasure}
                          onChange={(e) => updateLineItem(index, "unitOfMeasure", e.target.value)}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                        />
                      </div>
                      <div className="col-span-2">
                        <input
                          type="number"
                          value={item.unitPrice}
                          onChange={(e) => updateLineItem(index, "unitPrice", parseFloat(e.target.value) || 0)}
                          placeholder="Price"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                            className="p-2 text-red-600 hover:text-red-700"
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
                  <label htmlFor="discount-percent" className="text-sm font-medium text-gray-700">
                    Discount (%)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="discount-percent"
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
                {/* Deposit Required (requested from client, shown on the quotation PDF) */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b pb-3 mb-1 bg-indigo-50/60 -mx-4 px-4 pt-3">
                  <div>
                    <label htmlFor="quote-deposit-percent" className="text-sm font-semibold text-indigo-900 flex items-center gap-1">
                      <Wallet className="h-4 w-4" />
                      Deposit Required (%)
                    </label>
                    <p className="text-[11px] text-indigo-700/80 mt-0.5">
                      Displayed on the quotation PDF as up-front payment before work begins.
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
                      id="quote-deposit-percent"
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
                  <span>Total (Client Price):</span>
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
                    setEditingQuotation(null);
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
                  disabled={createQuotationMutation.isPending || updateQuotationDetailsMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary-600 hover:bg-brand-secondary-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {editingQuotation 
                    ? (updateQuotationDetailsMutation.isPending ? "Updating..." : "Update Quotation")
                    : (createQuotationMutation.isPending ? "Creating..." : "Create Quotation")
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search quotations..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
              />
            </div>
            <button
              onClick={() => setStatusFilter(null)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Filter className="h-5 w-5 mr-2" />
              {statusFilter ? "Clear Filter" : "All Quotations"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {selectedQuotationIds.size > 0 && (
            <div className="sticky top-0 z-10 px-4 sm:px-6 py-3 bg-brand-secondary-50 border-b border-brand-secondary-200 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-brand-secondary-900">
                {selectedQuotationIds.size} selected
              </span>
              <div className="flex-1" />
              <button
                type="button"
                disabled={bulkUpdateMutation.isPending}
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    token: token!,
                    quotationIds: Array.from(selectedQuotationIds),
                    status: "SENT_TO_CUSTOMER",
                  })
                }
                className="px-3 py-1.5 text-xs font-medium bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
              >
                Send to customer
              </button>
              <button
                type="button"
                disabled={bulkUpdateMutation.isPending}
                onClick={() =>
                  bulkUpdateMutation.mutate({
                    token: token!,
                    quotationIds: Array.from(selectedQuotationIds),
                    status: "APPROVED",
                  })
                }
                className="px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg disabled:opacity-50"
              >
                Approve
              </button>
              <button
                type="button"
                disabled={bulkUpdateMutation.isPending}
                onClick={() => {
                  const reason = window.prompt("Rejection reason (optional):") || undefined;
                  bulkUpdateMutation.mutate({
                    token: token!,
                    quotationIds: Array.from(selectedQuotationIds),
                    status: "REJECTED",
                    rejectionReason: reason,
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium bg-amber-600 hover:bg-amber-700 text-white rounded-lg disabled:opacity-50"
              >
                Reject
              </button>
              <button
                type="button"
                disabled={bulkDeleteMutation.isPending}
                onClick={() => {
                  if (!window.confirm(`Delete ${selectedQuotationIds.size} quotation(s)? Quotations linked to orders or invoices cannot be deleted.`)) return;
                  bulkDeleteMutation.mutate({
                    token: token!,
                    quotationIds: Array.from(selectedQuotationIds),
                  });
                }}
                className="px-3 py-1.5 text-xs font-medium bg-red-600 hover:bg-red-700 text-white rounded-lg disabled:opacity-50"
              >
                Delete
              </button>
              <button
                type="button"
                onClick={() => setSelectedQuotationIds(new Set())}
                className="px-3 py-1.5 text-xs font-medium bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 rounded-lg"
              >
                Clear
              </button>
            </div>
          )}
          {filteredQuotations.length > 0 && (
            <div className="px-4 sm:px-6 py-2 border-b border-gray-200 bg-gray-50 flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300"
                checked={
                  filteredQuotations.length > 0 &&
                  filteredQuotations.every((q: any) => selectedQuotationIds.has(q.id))
                }
                onChange={(e) => {
                  if (e.target.checked) {
                    setSelectedQuotationIds(new Set(filteredQuotations.map((q: any) => q.id)));
                  } else {
                    setSelectedQuotationIds(new Set());
                  }
                }}
              />
              <span className="text-xs text-gray-600">Select all on this page</span>
            </div>
          )}
          <div className="divide-y divide-gray-200">
            {filteredQuotations.map((quotation) => {
              const isExpanded = expandedQuotations.has(quotation.id);
              const hasDetails = (
                (quotation.quotationLineItems && Array.isArray(quotation.quotationLineItems) && (quotation.quotationLineItems as any[]).length > 0) ||
                (quotation.numPeopleNeeded && quotation.estimatedDuration) ||
                (quotation.companyMaterialCost !== undefined || quotation.companyLabourCost !== undefined) ||
                (quotation.expenseSlips && quotation.expenseSlips.length > 0) ||
                (quotation.beforePictures && quotation.beforePictures.length > 0)
              );
              const totalCostToCompany = (quotation.companyMaterialCost || 0) + (quotation.companyLabourCost || 0);
              
              return (
              <div key={quotation.id} className="hover:bg-gray-50/50 transition-colors">
                {/* Compact Header */}
                <div className="px-4 sm:px-6 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 min-w-0 flex-1 overflow-hidden">
                      <input
                        type="checkbox"
                        className="h-4 w-4 rounded border-gray-300 flex-shrink-0"
                        checked={selectedQuotationIds.has(quotation.id)}
                        onChange={(e) => {
                          setSelectedQuotationIds((prev) => {
                            const next = new Set(prev);
                            if (e.target.checked) next.add(quotation.id);
                            else next.delete(quotation.id);
                            return next;
                          });
                        }}
                        onClick={(e) => e.stopPropagation()}
                      />
                      {hasDetails && (
                        <button
                          onClick={() => toggleQuotationExpansion(quotation.id)}
                          className="p-1 hover:bg-gray-200 rounded transition-colors flex-shrink-0"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-gray-500" /> : <ChevronDown className="h-4 w-4 text-gray-500" />}
                        </button>
                      )}
                      <h3 className="text-sm font-bold text-gray-900 flex-shrink-0">{quotation.quoteNumber}</h3>
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          quotationStatuses.find((s) => s.value === quotation.status)?.color
                        }`}
                      >
                        {quotationStatuses.find((s) => s.value === quotation.status)?.label || quotation.status}
                      </span>
                      {(quotation.status === "APPROVED" || quotation.status === "APPROVED_BY_CUSTOMER") && !quotation.generatedInvoice && (
                        <span
                          className="px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200 inline-flex items-center gap-1 flex-shrink-0"
                          title="This quotation has been approved but no invoice has been raised yet."
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span className="hidden xl:inline">Not Invoiced</span>
                        </span>
                      )}
                      <span className="text-sm text-gray-700 font-medium truncate hidden sm:inline min-w-0 flex-1">{quotation.customerName}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-sm font-bold text-gray-900">R{(quotation.total || 0).toLocaleString()}</span>
                      {isAdmin && quotation.estimatedProfit !== undefined && (
                        <span className={`text-xs font-semibold ${quotation.estimatedProfit >= 0 ? "text-green-600" : "text-red-600"}`}>
                          (P: R{quotation.estimatedProfit.toLocaleString()})
                        </span>
                      )}
                      {/* Inline actions */}
                      <div className="hidden sm:flex items-center gap-1">
                        {(quotation.status === "PENDING_JUNIOR_MANAGER_REVIEW" || quotation.status === "PENDING_SENIOR_MANAGER_REVIEW" || quotation.status === "IN_PROGRESS") && (
                          <button
                            onClick={() => { setSelectedRFQReportQuotation(quotation); setShowRFQReportModal(true); }}
                            className="px-2 py-1 text-xs font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors inline-flex items-center"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1" />RFQ
                          </button>
                        )}
                        {(quotation.status === "APPROVED" || quotation.status === "SENT_TO_CUSTOMER" || quotation.status === "APPROVED_BY_CUSTOMER") && (
                          <button
                            onClick={() => handleExportPdf(quotation.id)}
                            disabled={generateQuotationPdfMutation.isPending && generatingPdfId === quotation.id}
                            className="px-2 py-1 text-xs font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                          >
                            {generateQuotationPdfMutation.isPending && generatingPdfId === quotation.id ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />PDF</>
                            ) : (
                              <><Download className="h-3.5 w-3.5 mr-1" />PDF</>
                            )}
                          </button>
                        )}
                        {(quotation.status === "APPROVED_BY_CUSTOMER" || quotation.status === "APPROVED") && isAdmin && !quotation.generatedOrder && (
                          <button
                            onClick={() => {
                              convertToOrderMutation.mutate({
                                token: token!,
                                quotationId: quotation.id,
                              });
                            }}
                            disabled={convertToOrderMutation.isPending}
                            className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            title={quotation.assignedToId ? "Create job order assigned to existing artisan" : "Create job order (no artisan assigned)"}
                          >
                            <Briefcase className="h-3.5 w-3.5 mr-1" />Assign Job
                          </button>
                        )}
                        {/* Invoice Quote stays available even after a job order
                            has been created — the invoice is a separate artifact
                            and admins often raise it after site work starts. It
                            only disappears once an invoice has actually been
                            generated for this quotation. */}
                        {(quotation.status === "APPROVED_BY_CUSTOMER" || quotation.status === "APPROVED") && isAdmin && !quotation.generatedInvoice && (
                          <button
                            onClick={() => {
                              setConvertingQuotation(quotation);
                              setShowConvertModal(true);
                            }}
                            className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center"
                          >
                            <Receipt className="h-3.5 w-3.5 mr-1" />Invoice Quote
                          </button>
                        )}
                        {quotation.generatedInvoice && (
                          <a
                            href={`/admin/invoices?invoiceId=${quotation.generatedInvoice.id}`}
                            className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 rounded-lg transition-colors inline-flex items-center"
                            title={`Already invoiced as ${quotation.generatedInvoice.invoiceNumber} (${quotation.generatedInvoice.status}). Click to open.`}
                          >
                            <Receipt className="h-3.5 w-3.5 mr-1" />
                            {quotation.generatedInvoice.invoiceNumber}
                            <span className="ml-1 text-[10px] text-emerald-800 uppercase">{String(quotation.generatedInvoice.status).toLowerCase()}</span>
                          </a>
                        )}
                        {isAdmin && !quotation.generatedOrder && quotation.status !== "DRAFT" && quotation.status !== "REJECTED" && quotation.status !== "REJECTED_BY_CUSTOMER" && (
                          <button
                            onClick={() => {
                              setJobCardQuotation(quotation);
                              setJobCardCompletionDate(new Date().toISOString().slice(0, 16));
                              setJobCardStartDate(quotation.createdAt ? new Date(quotation.createdAt).toISOString().slice(0, 16) : "");
                              setJobCardSessions([{ startAt: "", endAt: "" }]);
                              setJobCardClientRep("");
                              setJobCardNotes("");
                              setShowJobCardModal(true);
                            }}
                            disabled={generateJobCardMutation.isPending || jobCardPdfMutation.isPending}
                            className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                            title="Manually generate a job card for work already completed off-system"
                          >
                            {(generateJobCardMutation.isPending || (jobCardPdfMutation.isPending && generatingJobCardId != null)) ? (
                              <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Job Card</>
                            ) : (
                              <><FileText className="h-3.5 w-3.5 mr-1" />Manual Job Card</>
                            )}
                          </button>
                        )}
                        {/* Post-generation job card actions — mirror admin/operations so a
                            quotation with a generatedOrder gets Signed badge + Download /
                            Sign / Send / Edit job card in the same visual language. */}
                        {isAdmin && quotation.generatedOrder && (() => {
                          const ord: any = quotation.generatedOrder;
                          const isSigned = !!(ord.signedJobCardUrl && ord.clientRepSignDate);
                          const awaiting = !isSigned && !!ord.signatureRequestSentAt;
                          const clientUnavailable = !isSigned && !awaiting && !!ord.clientUnavailableToSign;
                          return (
                            <>
                              {isSigned ? (
                                <span
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg"
                                  title={`Signed by ${ord.clientRepName ?? "client"} on ${new Date(ord.clientRepSignDate).toLocaleString("en-ZA")}`}
                                >
                                  <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Signed
                                </span>
                              ) : awaiting ? (
                                <span
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 rounded-lg animate-pulse"
                                  title={`Link sent ${new Date(ord.signatureRequestSentAt).toLocaleString("en-ZA")} — awaiting client signature`}
                                >
                                  <Link2 className="h-3.5 w-3.5 mr-1" />Awaiting Signature
                                </span>
                              ) : clientUnavailable ? (
                                <span
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg"
                                  title="Client marked as unavailable to sign"
                                >
                                  Client Unavailable
                                </span>
                              ) : (
                                <span
                                  className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg"
                                  title="Client has not signed this job card"
                                >
                                  Not Signed
                                </span>
                              )}
                              <button
                                onClick={() => handleDownloadJobCardForRow(ord.id, ord.orderNumber)}
                                disabled={downloadingJobCardOrderId === ord.id}
                                className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                              >
                                {downloadingJobCardOrderId === ord.id ? (
                                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Downloading...</>
                                ) : (
                                  <><Receipt className="h-3.5 w-3.5 mr-1" />Job Card</>
                                )}
                              </button>
                              <button
                                onClick={() => handleMergeQuoteJobCard(quotation)}
                                disabled={mergingQuoteJobCardId === quotation.id}
                                className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                                title="Download a single PDF containing this quotation followed by the generated job card"
                              >
                                {mergingQuoteJobCardId === quotation.id ? (
                                  <><Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />Preparing...</>
                                ) : (
                                  <><FileText className="h-3.5 w-3.5 mr-1" />Quote + Job Card</>
                                )}
                              </button>
                              {!isSigned && (
                                <button
                                  onClick={() => setSendSigOrder({
                                    id: ord.id,
                                    customerName: ord.customerName || quotation.customerName,
                                    customerEmail: ord.customerEmail || quotation.customerEmail,
                                    customerPhone: ord.customerPhone || quotation.customerPhone,
                                  })}
                                  className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors inline-flex items-center"
                                  title="Send the client a link to sign the job card remotely"
                                >
                                  <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                                  {ord.signatureRequestSentAt ? "Resend Link" : "Send Sign Link"}
                                </button>
                              )}
                              {(!ord.clientRepSignDate || !ord.artisanSignatureUrl) && !ord.isPMOrder && (
                                <button
                                  onClick={() => setSignJobCardOrderId(ord.id)}
                                  className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors inline-flex items-center"
                                  title={!ord.clientRepSignDate ? "Capture client signature in-person (client & artisan)" : "Capture artisan signature"}
                                >
                                  <PenLine className="h-3.5 w-3.5 mr-1" />Sign Job Card
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => openEditJobCardModal(quotation, ord)}
                                className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center"
                                title="Edit this manually-generated job card (dates, materials, photos, notes)"
                              >
                                <Edit className="h-3.5 w-3.5 mr-1" />Edit Job Card
                              </button>
                            </>
                          );
                        })()}
                        <button
                          onClick={() => handleEditQuotation(quotation)}
                          className="px-2 py-1 text-xs font-medium text-brand-secondary-700 bg-brand-secondary-50 hover:bg-brand-secondary-100 rounded-lg transition-colors inline-flex items-center"
                        >
                          <Edit className="h-3.5 w-3.5 mr-1" />Edit
                        </button>
                        {isAdmin && (
                          <button
                            onClick={() => {
                              setHistoryQuotation(quotation);
                              setShowHistoryModal(true);
                            }}
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors inline-flex items-center"
                            title="View change history for this quotation"
                          >
                            <History className="h-3.5 w-3.5 mr-1" />History
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteClick(quotation.id)}
                          className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <select
                          value={quotation.status}
                          onChange={(e) => handleStatusChange(quotation.id, e.target.value)}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                        >
                          <option value={quotation.status}>
                            {quotationStatuses.find((s) => s.value === quotation.status)?.label || quotation.status}
                          </option>
                          {getAvailableStatusTransitions(quotation.status, user?.role || "").map((statusValue) => {
                            const statusLabel = quotationStatuses.find((s) => s.value === statusValue)?.label || statusValue;
                            let displayLabel = statusLabel;
                            if (statusValue === "PENDING_ARTISAN_REVIEW" && quotation.status === "DRAFT") displayLabel = "→ Assign to Artisan";
                            else if (statusValue === "APPROVED") displayLabel = "✓ Approve";
                            else if (statusValue === "SENT_TO_CUSTOMER") displayLabel = "📧 Send to Customer";
                            else if (statusValue === "REJECTED") displayLabel = "✗ Reject";
                            else if (statusValue === "IN_PROGRESS") displayLabel = "← Send Back";
                            else if (statusValue === "DRAFT") displayLabel = "← Back to Draft";
                            else if (statusValue === "APPROVED_BY_CUSTOMER") displayLabel = "✓ Customer Approved";
                            else if (statusValue === "REJECTED_BY_CUSTOMER") displayLabel = "✗ Customer Rejected";
                            else if (statusValue === "SENT_TO_CUSTOMER") displayLabel = "📧 Resend to Customer";
                            return <option key={statusValue} value={statusValue}>{displayLabel}</option>;
                          })}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Compact info row */}
                  <div className="flex items-center gap-3 mt-1 ml-7 text-xs text-gray-500 flex-wrap">
                    <span className="sm:hidden">{quotation.customerName}</span>
                    <span className="flex items-center"><Mail className="h-3 w-3 mr-1" />{quotation.customerEmail}</span>
                    <span className="flex items-center"><Phone className="h-3 w-3 mr-1" />{quotation.customerPhone}</span>
                    {quotation.assignedTo && (
                      <span className="flex items-center"><User className="h-3 w-3 mr-1" />{quotation.assignedTo.firstName} {quotation.assignedTo.lastName}</span>
                    )}
                    {quotation.validUntil && (
                      <span className="flex items-center"><Calendar className="h-3 w-3 mr-1" />Valid until {new Date(quotation.validUntil).toLocaleDateString()}</span>
                    )}
                    {isAdmin && totalCostToCompany > 0 && (
                      <span className="text-gray-600">
                        Cost: <span className="font-medium">R{totalCostToCompany.toLocaleString()}</span>
                      </span>
                    )}
                  </div>

                  {/* Mobile actions row */}
                  <div className="flex flex-wrap gap-1.5 mt-2 sm:hidden">
                    {(quotation.status === "PENDING_JUNIOR_MANAGER_REVIEW" || quotation.status === "PENDING_SENIOR_MANAGER_REVIEW" || quotation.status === "IN_PROGRESS") && (
                      <button
                        onClick={() => { setSelectedRFQReportQuotation(quotation); setShowRFQReportModal(true); }}
                        className="px-2 py-1 text-xs font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1 inline" />RFQ Report
                      </button>
                    )}
                    {(quotation.status === "APPROVED" || quotation.status === "SENT_TO_CUSTOMER" || quotation.status === "APPROVED_BY_CUSTOMER") && (
                      <button
                        onClick={() => handleExportPdf(quotation.id)}
                        disabled={generateQuotationPdfMutation.isPending && generatingPdfId === quotation.id}
                        className="px-2 py-1 text-xs font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg disabled:opacity-50"
                      >
                        <Download className="h-3.5 w-3.5 mr-1 inline" />PDF
                      </button>
                    )}
                    {(quotation.status === "APPROVED_BY_CUSTOMER" || quotation.status === "APPROVED") && isAdmin && !quotation.generatedOrder && (
                      <button
                        onClick={() => {
                          convertToOrderMutation.mutate({
                            token: token!,
                            quotationId: quotation.id,
                          });
                        }}
                        disabled={convertToOrderMutation.isPending}
                        className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg disabled:opacity-50"
                        title={quotation.assignedToId ? "Create job order assigned to existing artisan" : "Create job order (no artisan assigned)"}
                      >
                        <Briefcase className="h-3.5 w-3.5 mr-1 inline" />Assign Job
                      </button>
                    )}
                    {(quotation.status === "APPROVED_BY_CUSTOMER" || quotation.status === "APPROVED") && isAdmin && !quotation.generatedInvoice && (
                      <button
                        onClick={() => {
                          setConvertingQuotation(quotation);
                          setShowConvertModal(true);
                        }}
                        className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg"
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1 inline" />Invoice Quote
                      </button>
                    )}
                    {quotation.generatedInvoice && (
                      <a
                        href={`/admin/invoices?invoiceId=${quotation.generatedInvoice.id}`}
                        className="px-2 py-1 text-xs font-medium text-emerald-700 bg-emerald-100 border border-emerald-300 hover:bg-emerald-200 rounded-lg inline-flex items-center"
                        title={`Already invoiced as ${quotation.generatedInvoice.invoiceNumber} (${quotation.generatedInvoice.status}). Click to open.`}
                      >
                        <Receipt className="h-3.5 w-3.5 mr-1" />
                        {quotation.generatedInvoice.invoiceNumber}
                        <span className="ml-1 text-[10px] text-emerald-800 uppercase">{String(quotation.generatedInvoice.status).toLowerCase()}</span>
                      </a>
                    )}
                    {isAdmin && !quotation.generatedOrder && quotation.status !== "DRAFT" && quotation.status !== "REJECTED" && quotation.status !== "REJECTED_BY_CUSTOMER" && (
                      <button
                        onClick={() => {
                          setJobCardQuotation(quotation);
                          setJobCardCompletionDate(new Date().toISOString().slice(0, 16));
                          setJobCardStartDate(quotation.createdAt ? new Date(quotation.createdAt).toISOString().slice(0, 16) : "");
                          setJobCardSessions([{ startAt: "", endAt: "" }]);
                          setJobCardClientRep("");
                          setJobCardNotes("");
                          setShowJobCardModal(true);
                        }}
                        disabled={generateJobCardMutation.isPending || jobCardPdfMutation.isPending}
                        className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg disabled:opacity-50"
                        title="Manually generate a job card for work already completed off-system"
                      >
                        <FileText className="h-3.5 w-3.5 mr-1 inline" />Manual Job Card
                      </button>
                    )}
                    {/* Post-generation actions (mobile) — same buttons as desktop */}
                    {isAdmin && quotation.generatedOrder && (() => {
                      const ord: any = quotation.generatedOrder;
                      const isSigned = !!(ord.signedJobCardUrl && ord.clientRepSignDate);
                      const awaiting = !isSigned && !!ord.signatureRequestSentAt;
                      const clientUnavailable = !isSigned && !awaiting && !!ord.clientUnavailableToSign;
                      return (
                        <>
                          {isSigned ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-green-700 bg-green-50 rounded-lg">
                              <CheckCircle2 className="h-3.5 w-3.5 mr-1" />Signed
                            </span>
                          ) : awaiting ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-amber-800 bg-amber-50 rounded-lg">
                              <Link2 className="h-3.5 w-3.5 mr-1" />Awaiting
                            </span>
                          ) : clientUnavailable ? (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-gray-100 rounded-lg">
                              Client Unavailable
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-lg">
                              Not Signed
                            </span>
                          )}
                          <button
                            onClick={() => handleDownloadJobCardForRow(ord.id, ord.orderNumber)}
                            disabled={downloadingJobCardOrderId === ord.id}
                            className="px-2 py-1 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg disabled:opacity-50"
                          >
                            <Receipt className="h-3.5 w-3.5 mr-1 inline" />Job Card
                          </button>
                          <button
                            onClick={() => handleMergeQuoteJobCard(quotation)}
                            disabled={mergingQuoteJobCardId === quotation.id}
                            className="px-2 py-1 text-xs font-medium text-purple-700 bg-purple-50 rounded-lg disabled:opacity-50"
                          >
                            <FileText className="h-3.5 w-3.5 mr-1 inline" />Quote + Job Card
                          </button>
                          {!isSigned && (
                            <button
                              onClick={() => setSendSigOrder({
                                id: ord.id,
                                customerName: ord.customerName || quotation.customerName,
                                customerEmail: ord.customerEmail || quotation.customerEmail,
                                customerPhone: ord.customerPhone || quotation.customerPhone,
                              })}
                              className="px-2 py-1 text-xs font-medium text-amber-700 bg-amber-50 rounded-lg"
                            >
                              <AlertTriangle className="h-3.5 w-3.5 mr-1 inline" />
                              {ord.signatureRequestSentAt ? "Resend Link" : "Send Sign Link"}
                            </button>
                          )}
                          {(!ord.clientRepSignDate || !ord.artisanSignatureUrl) && !ord.isPMOrder && (
                            <button
                              onClick={() => setSignJobCardOrderId(ord.id)}
                              className="px-2 py-1 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg"
                            >
                              <PenLine className="h-3.5 w-3.5 mr-1 inline" />Sign
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => openEditJobCardModal(quotation, ord)}
                            className="px-2 py-1 text-xs font-medium text-slate-700 bg-slate-100 rounded-lg"
                          >
                            <Edit className="h-3.5 w-3.5 mr-1 inline" />Edit
                          </button>
                        </>
                      );
                    })()}
                    <button onClick={() => handleEditQuotation(quotation)} className="px-2 py-1 text-xs font-medium text-brand-secondary-700 bg-brand-secondary-50 rounded-lg">
                      <Edit className="h-3.5 w-3.5 mr-1 inline" />Edit
                    </button>
                    <button onClick={() => handleDeleteClick(quotation.id)} className="px-2 py-1 text-xs font-medium text-red-700 bg-red-50 rounded-lg">
                      <Trash2 className="h-3.5 w-3.5 inline" />
                    </button>
                    <select
                      value={quotation.status}
                      onChange={(e) => handleStatusChange(quotation.id, e.target.value)}
                      className="px-2 py-1 text-xs border border-gray-300 rounded-lg"
                    >
                      <option value={quotation.status}>{quotationStatuses.find((s) => s.value === quotation.status)?.label || quotation.status}</option>
                      {getAvailableStatusTransitions(quotation.status, user?.role || "").map((statusValue) => {
                        let displayLabel = quotationStatuses.find((s) => s.value === statusValue)?.label || statusValue;
                        if (statusValue === "APPROVED") displayLabel = "✓ Approve";
                        else if (statusValue === "REJECTED") displayLabel = "✗ Reject";
                        else if (statusValue === "APPROVED_BY_CUSTOMER") displayLabel = "✓ Customer Approved";
                        else if (statusValue === "REJECTED_BY_CUSTOMER") displayLabel = "✗ Customer Rejected";
                        else if (statusValue === "SENT_TO_CUSTOMER" && quotation.status === "REJECTED_BY_CUSTOMER") displayLabel = "📧 Resend to Customer";
                        return <option key={statusValue} value={statusValue}>{displayLabel}</option>;
                      })}
                    </select>
                  </div>
                </div>

                {/* Rejection reason - always visible if present */}
                {quotation.rejectionReason && (
                  <div className="mx-4 sm:mx-6 mb-2 bg-red-50 border border-red-200 rounded-lg p-2">
                    <p className="text-xs font-medium text-red-900">Rejection: <span className="font-normal text-red-700">{quotation.rejectionReason}</span></p>
                  </div>
                )}

                {/* Expanded Details */}
                {isExpanded && hasDetails && (
                  <div className="px-4 sm:px-6 pb-4 space-y-3">
                    {/* Artisan Scope of Work */}
                    {quotation.quotationLineItems && Array.isArray(quotation.quotationLineItems) && (quotation.quotationLineItems as any[]).length > 0 && (
                      <div className="bg-brand-primary-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Artisan's Scope of Work</h4>
                        <div className="space-y-1">
                          {(quotation.quotationLineItems as any[]).map((item: any, idx: number) => (
                            <div key={idx} className="bg-white rounded px-2 py-1.5 text-xs flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-900">{item.description}</span>
                                {item.quantity && <span className="text-gray-500 ml-2">Qty: {item.quantity}</span>}
                                {item.notes && <span className="text-gray-500 ml-2">— {item.notes}</span>}
                              </div>
                              <span className="text-xs bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded flex-shrink-0">{item.category}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Labour Estimation - compact row */}
                    {quotation.numPeopleNeeded && quotation.estimatedDuration && quotation.durationUnit && (
                      <div className="bg-green-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Labour Estimation</h4>
                        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs">
                          <span className="text-gray-600">People: <span className="font-medium text-gray-900">{quotation.numPeopleNeeded}</span></span>
                          <span className="text-gray-600">Duration: <span className="font-medium text-gray-900">{quotation.estimatedDuration} {quotation.durationUnit === "HOURLY" ? "hours" : "days"}</span></span>
                          <span className="text-gray-600">Rate: <span className="font-medium text-gray-900">R{quotation.labourRate?.toFixed(2) || "0.00"}/{quotation.durationUnit === "HOURLY" ? "hr" : "day"}</span></span>
                          <span className="text-gray-600">Total Labour: <span className="font-bold text-gray-900">R{quotation.companyLabourCost?.toFixed(2) || ((quotation.numPeopleNeeded || 0) * (quotation.estimatedDuration || 0) * (quotation.labourRate || 0)).toFixed(2)}</span></span>
                        </div>
                      </div>
                    )}

                    {/* Cost Breakdown - compact */}
                    {isAdmin && (quotation.companyMaterialCost !== undefined || quotation.companyLabourCost !== undefined) && (
                      <div className="bg-brand-secondary-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Cost Breakdown (Company)</h4>
                        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
                          <span className="text-gray-600">Material: <span className="font-medium text-gray-900">R{quotation.companyMaterialCost?.toFixed(2) || "0.00"}</span></span>
                          <span className="text-gray-600">Labour: <span className="font-medium text-gray-900">R{quotation.companyLabourCost?.toFixed(2) || "0.00"}</span></span>
                          <span className="text-gray-600 border-l border-gray-300 pl-4">Total Cost: <span className="font-bold text-gray-900">R{totalCostToCompany.toFixed(2)}</span></span>
                          <span className="text-gray-600">Client Quote: <span className="font-bold text-gray-900">R{(quotation.total || 0).toFixed(2)}</span></span>
                        </div>
                      </div>
                    )}

                    {/* Supplier Quotations */}
                    {quotation.expenseSlips && quotation.expenseSlips.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Supplier Quotations ({quotation.expenseSlips.length})</h4>
                        <div className="space-y-1">
                          {quotation.expenseSlips.map((slip: any, idx: number) => (
                            <div key={idx} className="bg-white rounded px-2 py-1.5 text-xs flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-gray-900">{slip.category}{slip.description && ` - ${slip.description}`}</span>
                                {slip.amount && <span className="text-gray-600 ml-2">R{slip.amount.toFixed(2)}</span>}
                              </div>
                              <a href={slip.url} target="_blank" rel="noopener noreferrer" className="text-brand-primary-600 hover:text-brand-primary-700 text-xs font-medium flex-shrink-0">View</a>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assessment Photos */}
                    {quotation.beforePictures.length > 0 && (
                      <div className="bg-gray-50 rounded-lg p-3">
                        <h4 className="text-xs font-semibold text-gray-900 mb-2">Assessment Photos ({quotation.beforePictures.length})</h4>
                        <div className="grid grid-cols-3 md:grid-cols-5 gap-1.5">
                          {quotation.beforePictures.map((url: string, idx: number) => (
                            <SignedMinioLink key={idx} url={url} target="_blank" rel="noopener noreferrer" className="block">
                              <SignedMinioImage url={url} alt={`Assessment ${idx + 1}`} className="w-full h-16 object-cover rounded border border-gray-200 hover:border-brand-primary-500 transition-colors" />
                            </SignedMinioLink>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
              );
            })}
            {filteredQuotations.length === 0 && (
              <div className="p-12 text-center">
                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No quotations found</p>
              </div>
            )}
          </div>
        </div>
      </main>

      {showRejectionModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Reject Quotation</h3>
            <p className="text-sm text-gray-600 mb-4">
              Please provide a reason for rejecting this quotation. This will be visible to the artisan.
            </p>
            <textarea
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              placeholder="Enter rejection reason..."
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500 mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowRejectionModal(false);
                  setRejectionQuotationId(null);
                  setRejectionReason("");
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRejectQuotation}
                disabled={!rejectionReason.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-danger-600 hover:bg-brand-danger-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                Reject Quotation
              </button>
            </div>
          </div>
        </div>
      )}

      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Delete Quotation</h3>
            <p className="text-sm text-gray-600 mb-6">
              Are you sure you want to delete this quotation? This action cannot be undone. All associated data including expense slips and line items will be permanently deleted.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => {
                  setShowDeleteModal(false);
                  setDeletingQuotationId(null);
                }}
                disabled={deleteQuotationMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmDelete}
                disabled={deleteQuotationMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
              >
                {deleteQuotationMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete Quotation
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      <RFQReportModal
        isOpen={showRFQReportModal}
        onClose={() => {
          setShowRFQReportModal(false);
          setSelectedRFQReportQuotation(null);
        }}
        quotation={selectedRFQReportQuotation}
        onDownloadPdf={(quotationId: number) => {
          if (!token) return;
          setDownloadingRFQReportPdfId(quotationId);
          generateRFQReportPdfMutation.mutate({ token, quotationId });
        }}
        isDownloading={generateRFQReportPdfMutation.isPending && selectedRFQReportQuotation?.id === downloadingRFQReportPdfId}
      />

      <ReportModal
        isOpen={showReportModal}
        onClose={() => setShowReportModal(false)}
        title="Quotations Report"
        filenamePrefix="quotations_report"
        columns={[
          { header: "Quote #", key: "quoteNumber" },
          { header: "Client Ref #", key: "clientReferenceQuoteNumber" },
          { header: "Building Name", key: "customerName" },
          { header: "Company", key: "client", format: (v: any) => v?.companyName || v?.name || "\u2014" },
          { header: "Building", key: "clientBuilding", format: (v: any) => v?.name || "\u2014" },
          { header: "Email", key: "customerEmail" },
          { header: "Phone", key: "customerPhone" },
          { header: "Address", key: "address" },
          { header: "Status", key: "status" },
          { header: "Job Status", key: "generatedOrder", format: (v: any) => {
            if (!v) return "No Order Yet";
            const map: Record<string, string> = {
              PENDING: "Order Pending",
              ASSIGNED: "Assigned to Artisan",
              IN_PROGRESS: "Job In Progress",
              COMPLETED: "Job Done",
              CANCELLED: "Cancelled",
            };
            return map[v.status] || v.status;
          } },
          { header: "Order #", key: "generatedOrder", format: (v: any) => v?.orderNumber || "\u2014" },
          { header: "Invoice #", key: "generatedInvoice", format: (v: any) => v?.invoiceNumber || "\u2014" },
          { header: "Invoice Status", key: "generatedInvoice", format: (v: any) => {
            if (!v) return "Not Invoiced";
            if (v.status === "PAID") return "Paid";
            if (v.status === "OVERDUE") return "Overdue";
            if (v.status === "SENT") return "Sent / Awaiting Payment";
            return v.status;
          } },
          { header: "Paid?", key: "generatedInvoice", format: (v: any) => {
            if (!v) return "\u2014";
            return v.status === "PAID" ? `Yes (${v.paidDate ? new Date(v.paidDate).toLocaleDateString() : ""})` : "No";
          } },
          { header: "Total", key: "total", format: (v: any) => `R${(v || 0).toLocaleString()}` },
          { header: "Est. Profit", key: "estimatedProfit", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "Material Cost", key: "companyMaterialCost", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "Labour Cost", key: "companyLabourCost", format: (v: any) => v != null ? `R${Number(v).toLocaleString()}` : "\u2014" },
          { header: "People Needed", key: "numPeopleNeeded" },
          { header: "Est. Duration", key: "estimatedDuration" },
          { header: "Valid Until", key: "validUntil", format: (v: any) => v ? new Date(v).toLocaleDateString() : "\u2014" },
          { header: "Assigned To", key: "assignedTo", format: (v: any) => v ? `${v.firstName} ${v.lastName}` : "Unassigned" },
          { header: "Date Created", key: "createdAt", format: (v: any) => v ? new Date(v).toLocaleDateString() : "\u2014" },
          { header: "Notes", key: "notes" },
        ]}
        data={quotations}
        searchAccessors={[
          (r: any) => r.customerName,
          (r: any) => r.customerEmail,
          (r: any) => r.customerPhone,
          (r: any) => r.address,
          (r: any) => r.quoteNumber,
          (r: any) => r.clientReferenceQuoteNumber,
          (r: any) => r.client?.companyName,
          (r: any) => r.client?.name,
          (r: any) => r.clientBuilding?.name,
          (r: any) => r.clientBuilding?.address,
          (r: any) => r.generatedOrder?.orderNumber,
          (r: any) => r.generatedInvoice?.invoiceNumber,
          (r: any) => r.assignedTo ? `${r.assignedTo.firstName} ${r.assignedTo.lastName}` : "",
          (r: any) => r.notes,
        ]}
        presets={[
          { label: "Approved \u2014 No Order Yet", description: "Customer approved the quote but no order has been created", predicate: (r: any) => (r.status === "APPROVED_BY_CUSTOMER" || r.status === "APPROVED") && !r.generatedOrder },
          { label: "Job Done \u2014 Not Invoiced", description: "Order completed but no invoice exists", predicate: (r: any) => r.generatedOrder?.status === "COMPLETED" && !r.generatedInvoice },
          { label: "Invoiced \u2014 Unpaid", description: "Invoice raised but not yet paid", predicate: (r: any) => !!r.generatedInvoice && r.generatedInvoice.status !== "PAID" && r.generatedInvoice.status !== "CANCELLED" },
          { label: "Paid", description: "Invoice marked paid", predicate: (r: any) => r.generatedInvoice?.status === "PAID" },
          { label: "Rejected / Lost", description: "Customer rejected the quote", predicate: (r: any) => r.status === "REJECTED_BY_CUSTOMER" || r.status === "REJECTED" },
          { label: "Pending Customer Decision", description: "Sent to customer, awaiting response", predicate: (r: any) => r.status === "SENT_TO_CUSTOMER" },
        ]}
        filters={[
          {
            label: "Quote Status",
            key: "status",
            options: [
              { value: "DRAFT", label: "Draft" },
              { value: "PENDING_ARTISAN_REVIEW", label: "Pending Artisan Review" },
              { value: "IN_PROGRESS", label: "In Progress" },
              { value: "PENDING_JUNIOR_MANAGER_REVIEW", label: "Pending Jr Manager Review" },
              { value: "PENDING_SENIOR_MANAGER_REVIEW", label: "Pending Sr Manager Review" },
              { value: "APPROVED", label: "Approved" },
              { value: "SENT_TO_CUSTOMER", label: "Sent to Customer" },
              { value: "REJECTED", label: "Rejected" },
              { value: "APPROVED_BY_CUSTOMER", label: "Approved by Customer" },
              { value: "REJECTED_BY_CUSTOMER", label: "Rejected by Customer" },
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

      {/* Convert Quotation to Invoice Modal */}
      {showConvertModal && convertingQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full p-6 m-auto max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <Receipt className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invoice Quote</h3>
                <p className="text-sm text-gray-500">Convert {convertingQuotation.quoteNumber} to invoice</p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Summary */}
              <div className="bg-gray-50 rounded-lg p-3 space-y-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Customer</span>
                  <span className="font-medium">{convertingQuotation.customerName}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Total</span>
                  <span className="font-bold text-gray-900">R{(convertingQuotation.total || 0).toLocaleString()}</span>
                </div>
              </div>

              {/* Create Order checkbox */}
              <label className="flex items-start gap-3 p-3 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={convertCreateOrder}
                  onChange={(e) => setConvertCreateOrder(e.target.checked)}
                  className="mt-0.5 h-4 w-4 text-brand-secondary-600 focus:ring-brand-secondary-500 border-gray-300 rounded"
                />
                <div>
                  <span className="text-sm font-medium text-gray-900">Also create Job Card (Order)</span>
                  <p className="text-xs text-gray-500 mt-0.5">Creates a client order and links it to the invoice</p>
                </div>
              </label>

              {/* Assign To (if creating order) */}
              {convertCreateOrder && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Assign Job To (Optional)</label>
                  <select
                    value={convertAssignedTo}
                    onChange={(e) => setConvertAssignedTo(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  >
                    <option value="">Unassigned</option>
                    {artisans.map((artisan: any) => (
                      <option key={artisan.id} value={artisan.id.toString()}>
                        {artisan.firstName} {artisan.lastName}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Due Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Invoice Due Date (Optional)</label>
                <input
                  type="date"
                  value={convertDueDate}
                  onChange={(e) => setConvertDueDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (Optional)</label>
                <textarea
                  value={convertNotes}
                  onChange={(e) => setConvertNotes(e.target.value)}
                  rows={2}
                  placeholder="Any additional notes for the invoice..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowConvertModal(false);
                  setConvertingQuotation(null);
                  setConvertCreateOrder(true);
                  setConvertAssignedTo("");
                  setConvertDueDate("");
                  setConvertNotes("");
                }}
                disabled={convertToInvoiceMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  const payload = {
                    token: token!,
                    quotationId: convertingQuotation.id,
                    createOrder: convertCreateOrder,
                    ...(convertAssignedTo ? { assignedToId: parseInt(convertAssignedTo) } : {}),
                    ...(convertDueDate ? { dueDate: convertDueDate } : {}),
                    ...(convertNotes ? { notes: convertNotes } : {}),
                  };
                  lastConvertPayloadRef.current = payload;
                  convertToInvoiceMutation.mutate(payload);
                }}
                disabled={convertToInvoiceMutation.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
              >
                {convertToInvoiceMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Converting...
                  </>
                ) : (
                  <>
                    <Receipt className="h-4 w-4 mr-2" />
                    Create Invoice{convertCreateOrder ? " & Job Card" : ""}
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Manual Job Card Modal - retroactive job card for work done off-system */}
      {showJobCardModal && jobCardQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold text-gray-900 mb-1">
              {editingJobCardOrderId != null ? "Edit Manual Job Card" : "Generate Manual Job Card"}
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              For quotation <span className="font-semibold">{jobCardQuotation.quoteNumber}</span> —{" "}
              {editingJobCardOrderId != null
                ? "update the on-site record captured for this job card. Changes save immediately; no new order is created."
                : "creates a completed job order snapshot and downloads the job card PDF. Use this when the job was completed off-system and no order was created at the time."}
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date &amp; Time (optional)
                </label>
                <input
                  type="datetime-local"
                  value={jobCardStartDate}
                  onChange={(e) => setJobCardStartDate(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  When the crew started on site. Defaults to the quotation date if left blank. Ignored if you
                  add Work Sessions below.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Completion Date &amp; Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="datetime-local"
                  value={jobCardCompletionDate}
                  onChange={(e) => setJobCardCompletionDate(e.target.value)}
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
                      setJobCardSessions((prev) => [...prev, { startAt: "", endAt: "" }])
                    }
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 inline-flex items-center"
                  >
                    + Add another session
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Add one row per day the crew was on site. Leave blank if unknown — start defaults to the
                  quotation date.
                </p>
                <div className="space-y-2">
                  {jobCardSessions.map((session, idx) => (
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
                            setJobCardSessions((prev) =>
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
                            setJobCardSessions((prev) =>
                              prev.map((s, i) => (i === idx ? { ...s, endAt: e.target.value } : s))
                            )
                          }
                          className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setJobCardSessions((prev) =>
                            prev.length === 1 ? [{ startAt: "", endAt: "" }] : prev.filter((_, i) => i !== idx)
                          )
                        }
                        disabled={jobCardSessions.length === 1 && !session.startAt && !session.endAt}
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
                  value={jobCardClientRep}
                  onChange={(e) => setJobCardClientRep(e.target.value)}
                  placeholder="Person who accepted the completed work on site"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Leave blank if the client was unavailable to sign.
                </p>
              </div>

              {/* Client traceability — appears as "Client PO No" on the job
                  card PDF header alongside our own Job No / Our Quote No.
                  Free-text so admins can capture the client's PO, work order
                  reference, or any other cross-reference identifier. */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client PO No (optional)
                </label>
                <input
                  type="text"
                  value={jobCardClientPO}
                  onChange={(e) => setJobCardClientPO(e.target.value)}
                  placeholder="Client purchase-order / work-order reference"
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
                <p className="text-xs text-gray-500 mt-1">
                  Rendered on the job card PDF header as the client's cross-reference to our job number.
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes (optional)</label>
                <textarea
                  value={jobCardNotes}
                  onChange={(e) => setJobCardNotes(e.target.value)}
                  rows={3}
                  placeholder="Any context for the job card record..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Before Pictures (optional) — rendered on the job card PDF */}
              <div className="border-t border-gray-200 pt-4">
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">Before Pictures (optional)</label>
                  <p className="text-xs text-gray-500">
                    Photos of the work area before the crew started. Rendered on the job card PDF.
                  </p>
                </div>
                <PhotoUpload
                  onPhotosUploaded={setJobCardBeforePictures}
                  minimumPhotos={0}
                  title="Before Pictures"
                  description="Upload site photos captured before the work started (optional)."
                  isPublic={false}
                  initialUrls={jobCardBeforePictures}
                />
              </div>

              {/* After Pictures (optional) — rendered on the job card PDF */}
              <div className="border-t border-gray-200 pt-4">
                <div className="mb-2">
                  <label className="block text-sm font-medium text-gray-700">After Pictures (optional)</label>
                  <p className="text-xs text-gray-500">
                    Photos of the completed work. Rendered on the job card PDF next to the before shots.
                  </p>
                </div>
                <PhotoUpload
                  onPhotosUploaded={setJobCardAfterPictures}
                  minimumPhotos={0}
                  title="After Pictures"
                  description="Upload site photos captured after the work was completed (optional)."
                  isPublic={false}
                  initialUrls={jobCardAfterPictures}
                />
              </div>

              {/* Materials Used — traceability ledger persisted as Material rows */}
              <div className="border-t border-gray-200 pt-4">
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm font-medium text-gray-700">Materials Used (optional)</label>
                  <button
                    type="button"
                    onClick={() =>
                      setJobCardMaterials((prev) => [
                        ...prev,
                        { name: "", description: "", quantity: "", unitPrice: "", supplier: "" },
                      ])
                    }
                    className="text-xs font-medium text-amber-700 hover:text-amber-800 inline-flex items-center"
                  >
                    + Add material
                  </button>
                </div>
                <p className="text-xs text-gray-500 mb-2">
                  Traceability record of parts and materials consumed on site. Appears in the "Materials Used"
                  table on the job card PDF and updates the order's material cost.
                </p>
                {jobCardMaterials.length === 0 ? (
                  <p className="text-xs text-gray-400 italic border border-dashed border-gray-300 rounded-lg p-3 text-center">
                    No materials added. Click "Add material" to record parts consumed on site.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {jobCardMaterials.map((mat, idx) => {
                      const qty = parseFloat(mat.quantity);
                      const price = parseFloat(mat.unitPrice);
                      const lineTotal =
                        Number.isFinite(qty) && Number.isFinite(price) ? qty * price : 0;
                      return (
                        <div
                          key={idx}
                          className="p-2 border border-gray-200 rounded-lg bg-gray-50 space-y-2"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-[2fr_1fr_auto] gap-2">
                            <input
                              type="text"
                              value={mat.name}
                              onChange={(e) =>
                                setJobCardMaterials((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, name: e.target.value } : m))
                                )
                              }
                              placeholder="Material name (e.g. Copper elbow 22mm)"
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <input
                              type="text"
                              value={mat.supplier}
                              onChange={(e) =>
                                setJobCardMaterials((prev) =>
                                  prev.map((m, i) => (i === idx ? { ...m, supplier: e.target.value } : m))
                                )
                              }
                              placeholder="Supplier (optional)"
                              className="px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                            />
                            <button
                              type="button"
                              onClick={() =>
                                setJobCardMaterials((prev) => prev.filter((_, i) => i !== idx))
                              }
                              className="px-2 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 rounded-lg"
                              aria-label="Remove material"
                            >
                              Remove
                            </button>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">Qty</label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={mat.quantity}
                                onChange={(e) =>
                                  setJobCardMaterials((prev) =>
                                    prev.map((m, i) => (i === idx ? { ...m, quantity: e.target.value } : m))
                                  )
                                }
                                placeholder="0"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                                Unit price (R)
                              </label>
                              <input
                                type="number"
                                min="0"
                                step="0.01"
                                value={mat.unitPrice}
                                onChange={(e) =>
                                  setJobCardMaterials((prev) =>
                                    prev.map((m, i) =>
                                      i === idx ? { ...m, unitPrice: e.target.value } : m
                                    )
                                  )
                                }
                                placeholder="0.00"
                                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                              />
                            </div>
                            <div>
                              <label className="block text-[11px] font-medium text-gray-600 mb-0.5">
                                Line total
                              </label>
                              <div className="w-full px-2 py-1.5 text-sm bg-white border border-gray-200 rounded-lg text-gray-700">
                                R {lineTotal.toFixed(2)}
                              </div>
                            </div>
                          </div>
                          <input
                            type="text"
                            value={mat.description}
                            onChange={(e) =>
                              setJobCardMaterials((prev) =>
                                prev.map((m, i) =>
                                  i === idx ? { ...m, description: e.target.value } : m
                                )
                              )
                            }
                            placeholder="Description / notes (optional)"
                            className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
                {editingJobCardOrderId != null
                  ? "Saving replaces the on-site record for this manual job card (dates, materials, photos, notes). The order number and quotation link stay unchanged."
                  : "A completed order will be created with a snapshot of this quotation's customer, address, line items, and totals. The order will be flagged in its notes as manually generated retroactively."}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => {
                  setShowJobCardModal(false);
                  setJobCardQuotation(null);
                  setJobCardBeforePictures([]);
                  setJobCardAfterPictures([]);
                  setJobCardMaterials([]);
                  setEditingJobCardOrderId(null);
                }}
                disabled={
                  generateJobCardMutation.isPending || updateManualJobCardMutation.isPending
                }
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  if (!jobCardCompletionDate) {
                    toast.error("Completion date is required");
                    return;
                  }
                  const validSessions = jobCardSessions
                    .filter((s) => s.startAt && s.endAt)
                    .map((s) => ({ startAt: s.startAt, endAt: s.endAt }));
                  const invalidSession = validSessions.find(
                    (s) => new Date(s.endAt).getTime() < new Date(s.startAt).getTime()
                  );
                  if (invalidSession) {
                    toast.error("Each session's end must be after its start");
                    return;
                  }
                  const parsedMaterials = jobCardMaterials
                    .map((m) => {
                      const qty = parseFloat(m.quantity);
                      const price = parseFloat(m.unitPrice);
                      return {
                        name: m.name.trim(),
                        description: m.description.trim(),
                        quantity: Number.isFinite(qty) ? qty : 0,
                        unitPrice: Number.isFinite(price) ? price : 0,
                        supplier: m.supplier.trim(),
                      };
                    })
                    .filter((m) => m.name && m.quantity > 0);
                  const commonPayload = {
                    token: token!,
                    completionDate: jobCardCompletionDate,
                    ...(jobCardStartDate ? { startDate: jobCardStartDate } : {}),
                    ...(validSessions.length > 0 ? { workSessions: validSessions } : {}),
                    ...(jobCardClientRep ? { clientRepName: jobCardClientRep } : {}),
                    ...(jobCardNotes ? { notes: jobCardNotes } : {}),
                    ...(jobCardClientPO.trim() ? { clientOrderNumber: jobCardClientPO.trim() } : {}),
                    ...(jobCardBeforePictures.length > 0 ? { beforePictures: jobCardBeforePictures } : {}),
                    ...(jobCardAfterPictures.length > 0 ? { afterPictures: jobCardAfterPictures } : {}),
                    ...(parsedMaterials.length > 0
                      ? {
                          materials: parsedMaterials.map((m) => ({
                            name: m.name,
                            ...(m.description ? { description: m.description } : {}),
                            quantity: m.quantity,
                            unitPrice: m.unitPrice,
                            ...(m.supplier ? { supplier: m.supplier } : {}),
                          })),
                        }
                      : {}),
                  };
                  if (editingJobCardOrderId != null) {
                    updateManualJobCardMutation.mutate({
                      ...commonPayload,
                      orderId: editingJobCardOrderId,
                    });
                  } else {
                    generateJobCardMutation.mutate({
                      ...commonPayload,
                      quotationId: jobCardQuotation.id,
                    });
                  }
                }}
                disabled={
                  generateJobCardMutation.isPending ||
                  updateManualJobCardMutation.isPending ||
                  !jobCardCompletionDate
                }
                className="px-4 py-2 text-sm font-medium text-white bg-amber-600 hover:bg-amber-700 rounded-lg disabled:opacity-50 transition-colors inline-flex items-center"
              >
                {editingJobCardOrderId != null ? (
                  updateManualJobCardMutation.isPending ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )
                ) : generateJobCardMutation.isPending ? (
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
      {showHistoryModal && historyQuotation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <History className="h-5 w-5 mr-2 text-slate-600" />
                  Change History
                </h3>
                <p className="text-sm text-gray-600">
                  Quotation <span className="font-semibold">{historyQuotation.quoteNumber}</span>
                  {historyQuotation.customerName ? <> — {historyQuotation.customerName}</> : null}
                </p>
              </div>
              <button
                onClick={() => {
                  setShowHistoryModal(false);
                  setHistoryQuotation(null);
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
                  setHistoryQuotation(null);
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Post-completion in-person Sign Job Card modal (shared with admin/operations) */}
      {signJobCardOrderId !== null && token && (() => {
        const q = quotations.find((qq: any) => qq.generatedOrder?.id === signJobCardOrderId);
        const ord: any = q?.generatedOrder;
        if (!ord) return null;
        return (
          <JobCardSignatureModal
            token={token}
            currentUserName={user ? `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() : undefined}
            order={{
              id: ord.id,
              orderNumber: ord.orderNumber,
              serviceType: ord.serviceType,
              description: ord.description,
              signedJobCardUrl: ord.signedJobCardUrl,
              clientRepName: ord.clientRepName,
              clientRepSignDate: ord.clientRepSignDate,
              artisanSignatureUrl: ord.artisanSignatureUrl,
              artisanSignedByName: ord.artisanSignedByName,
              artisanSignDate: ord.artisanSignDate,
              isPMOrder: !!ord.isPMOrder,
            }}
            onClose={() => {
              setSignJobCardOrderId(null);
              queryClient.invalidateQueries({ queryKey: [["getQuotations"]] as any });
            }}
          />
        );
      })()}

      {/* Send Signature Request modal (shared component) */}
      {sendSigOrder && token && (
        <SendSignatureRequestModal
          token={token}
          order={sendSigOrder}
          onClose={() => setSendSigOrder(null)}
        />
      )}
    </div>
  );
}
