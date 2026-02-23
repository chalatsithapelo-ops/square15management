import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { SignedMinioImage, SignedMinioLink } from "~/components/SignedMinioUrl";
import RFQReportModal from "~/components/RFQReportModal";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
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
} from "lucide-react";

export const Route = createFileRoute("/contractor/quotations/")({
  component: QuotationsPageGuarded,
});

function QuotationsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasQuotations" returnPath="/contractor/dashboard">
      <QuotationsPage />
    </RequireSubscriptionFeature>
  );
}

const quotationSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  serviceType: z.string().optional(),
  quoteNumber: z.string().min(1).optional(),
  clientReferenceQuoteNumber: z.string().optional(),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.number().optional(),
  companyMaterialCost: z.number().optional(),
  companyLabourCost: z.number().optional(),
});

type QuotationForm = z.infer<typeof quotationSchema>;

const quotationStatuses = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING_ARTISAN_REVIEW", label: "Pending Artisan Review", color: "bg-yellow-100 text-yellow-800" },
  { value: "IN_PROGRESS", label: "In Progress (Artisan)", color: "bg-blue-100 text-blue-800" },
  { value: "PENDING_JUNIOR_MANAGER_REVIEW", label: "Pending Junior Manager Review", color: "bg-orange-100 text-orange-800" },
  { value: "PENDING_SENIOR_MANAGER_REVIEW", label: "Pending Senior Manager Review", color: "bg-amber-100 text-amber-800" },
  { value: "APPROVED", label: "Approved", color: "bg-green-100 text-green-800" },
  { value: "SENT_TO_CUSTOMER", label: "Sent to Customer", color: "bg-purple-100 text-purple-800" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
];

function getAvailableStatusTransitions(currentStatus: string, userRole: string) {
  const transitions: Record<string, string[]> = {
    DRAFT: ["PENDING_ARTISAN_REVIEW"],
    PENDING_ARTISAN_REVIEW: ["IN_PROGRESS", "DRAFT"],
    IN_PROGRESS: ["PENDING_JUNIOR_MANAGER_REVIEW", "PENDING_ARTISAN_REVIEW"],
    PENDING_JUNIOR_MANAGER_REVIEW: userRole === "CONTRACTOR_JUNIOR_MANAGER" || userRole === "CONTRACTOR_SENIOR_MANAGER" || userRole === "CONTRACTOR"
      ? ["PENDING_SENIOR_MANAGER_REVIEW", "REJECTED", "IN_PROGRESS"]
      : [],
    PENDING_SENIOR_MANAGER_REVIEW: userRole === "CONTRACTOR_SENIOR_MANAGER" || userRole === "CONTRACTOR"
      ? ["APPROVED", "REJECTED", "PENDING_JUNIOR_MANAGER_REVIEW"]
      : [],
    APPROVED: ["SENT_TO_CUSTOMER"],
    SENT_TO_CUSTOMER: [],
    REJECTED: ["DRAFT"],
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
  const [editingQuotation, setEditingQuotation] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" },
  ]);
  const [companyMaterialCost, setCompanyMaterialCost] = useState<string>("");
  const [companyLabourCost, setCompanyLabourCost] = useState<string>("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionQuotationId, setRejectionQuotationId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [downloadingPmRfqPdfId, setDownloadingPmRfqPdfId] = useState<number | null>(null);
  const [showRFQReportModal, setShowRFQReportModal] = useState(false);
  const [selectedRFQReportQuotation, setSelectedRFQReportQuotation] = useState<any | null>(null);
  const [downloadingRFQReportPdfId, setDownloadingRFQReportPdfId] = useState<number | null>(null);
  const [generatingLineItems, setGeneratingLineItems] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletingQuotationId, setDeletingQuotationId] = useState<number | null>(null);

  const isManager = user?.role === "CONTRACTOR_JUNIOR_MANAGER" || user?.role === "CONTRACTOR_SENIOR_MANAGER";

  const unitOfMeasureOptions = [
    { value: "m2", label: "m2" },
    { value: "Lm", label: "Lm" },
    { value: "Sum", label: "Sum" },
    { value: "m3", label: "m3" },
    { value: "Hr", label: "Hr" },
  ];

  const quotationsQuery = useQuery({
    ...trpc.getQuotations.queryOptions({
      token: token!,
      status: statusFilter as any,
    }),
    refetchInterval: 10000, // Refetch every 10 seconds
  });

  // Fetch all quotations for accurate counts/overview, regardless of current status filter.
  const allQuotationsQuery = useQuery({
    ...trpc.getQuotations.queryOptions({
      token: token!,
    }),
    refetchInterval: 10000,
  });

  // Fetch PropertyManagerRFQs sent to this contractor
  const pmRfqsQuery = useQuery({
    ...trpc.getPropertyManagerRFQs.queryOptions({
      token: token!,
    }),
    refetchInterval: 10000, // Refetch every 10 seconds to keep in sync with PM updates
  });

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
  } = useForm<QuotationForm>({
    resolver: zodResolver(quotationSchema),
  });

  const createQuotationMutation = useMutation(
    trpc.createQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getQuotations.queryKey() });
        reset();
        setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
        setCompanyMaterialCost("");
        setCompanyLabourCost("");
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

  const generatePmRfqPdfMutation = useMutation(
    trpc.generatePropertyManagerRFQPdf.mutationOptions({
      onSuccess: (data) => {
        if (data.pdfBase64) {
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
          link.download = data.filename || "rfq.pdf";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
        toast.success("PDF downloaded successfully!");
        setDownloadingPmRfqPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PM RFQ PDF");
        setDownloadingPmRfqPdfId(null);
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
        // Replace current line items with AI-generated ones (coerce to full LineItem shape)
        setLineItems(
          (data.lineItems || []).map((item: any) => {
            const quantity = typeof item.quantity === "number" ? item.quantity : 1;
            const unitPrice = typeof item.unitPrice === "number" ? item.unitPrice : 0;
            return {
              description: String(item.description ?? ""),
              quantity,
              unitPrice,
              total: typeof item.total === "number" ? item.total : quantity * unitPrice,
              unitOfMeasure: String(item.unitOfMeasure ?? "Sum"),
            } as LineItem;
          })
        );
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
      validUntil: quotation.validUntil ? new Date(quotation.validUntil).toISOString().split('T')[0] : "",
      notes: quotation.notes || "",
      assignedToId: quotation.assignedToId || undefined,
    });
    
    // Populate line items
    if (quotation.items && Array.isArray(quotation.items)) {
      setLineItems(quotation.items);
    }
    
    // Populate cost fields
    setCompanyMaterialCost(quotation.companyMaterialCost?.toString() || "");
    setCompanyLabourCost(quotation.companyLabourCost?.toString() || "");
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

  const handleDownloadPmRfqPdf = (rfqId: number) => {
    setDownloadingPmRfqPdfId(rfqId);
    generatePmRfqPdfMutation.mutate({
      token: token!,
      rfqId,
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
    const serviceType = getValues("serviceType");
    const address = getValues("address");
    const notes = getValues("notes");
    
    // Validate required fields for AI generation
    if (!customerName || !customerName.trim()) {
      toast.error("Please enter the customer name before generating line items");
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
    setLineItems((prev) => prev.filter((_, i) => i !== index));
  };

  const updateLineItem = (index: number, field: keyof LineItem, value: string | number) => {
    const newItems = [...lineItems];
    if (!newItems[index]) return;
    newItems[index] = { ...newItems[index]!, [field]: value };
    
    if (field === "quantity" || field === "unitPrice") {
      newItems[index]!.total = newItems[index]!.quantity * newItems[index]!.unitPrice;
    }
    
    setLineItems(newItems);
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.15; // 15% VAT
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const calculateEstimatedProfit = () => {
    const subtotal = calculateSubtotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    return subtotal - materialCost - labourCost;
  };

  const onSubmit = (data: QuotationForm) => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    const estimatedProfit = subtotal - materialCost - labourCost;

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
        companyMaterialCost: materialCost,
        companyLabourCost: labourCost,
        estimatedProfit,
      });
    }
  };

  const quotations = quotationsQuery.data || [];
  const allQuotations = allQuotationsQuery.data || [];
  const filteredQuotations = quotations.filter((quotation) =>
    quotation.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quotation.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    quotation.quoteNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const shouldShowDraftRfqsInList = statusFilter === null || statusFilter === "DRAFT";
  const draftPmRfqs = (pmRfqsQuery.data || []).filter((rfq: any) => rfq.status === "SUBMITTED");
  const filteredDraftPmRfqs = shouldShowDraftRfqsInList
    ? draftPmRfqs.filter((rfq: any) => {
        const q = searchTerm.toLowerCase();
        if (!q) return true;
        return (
          (rfq.title || "").toLowerCase().includes(q) ||
          (rfq.rfqNumber || "").toLowerCase().includes(q) ||
          (rfq.buildingAddress || "").toLowerCase().includes(q) ||
          (`${rfq.propertyManager?.firstName || ""} ${rfq.propertyManager?.lastName || ""}`)
            .toLowerCase()
            .includes(q) ||
          (rfq.propertyManager?.email || "").toLowerCase().includes(q)
        );
      })
    : [];

  const statusMetrics = quotationStatuses.map((status) => ({
    ...status,
    count: allQuotations.filter((q) => q.status === status.value).length,
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/dashboard"
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
                  {allQuotations.length} total quotations • Workflow: Draft → Artisan Review → In Progress → Junior Manager Review → Senior Manager Review → Approved → Sent to Customer
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
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search and Filter (match Operations layout) */}
        <div className="space-y-4 mb-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by customer name, email or quote number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-secondary-500 focus:border-transparent"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !statusFilter
                  ? "bg-brand-secondary-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ALL ({allQuotations.length})
            </button>
            {quotationStatuses.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(statusFilter === status.value ? null : status.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status.value
                    ? "bg-brand-secondary-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status.label.toUpperCase()} ({statusMetrics.find((m) => m.value === status.value)?.count || 0})
              </button>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingQuotation ? "Edit Quotation" : "Create New Quotation"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name *
                  </label>
                  <input
                    type="text"
                    {...register("customerName")}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                  )}
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
                    Manager Only
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
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateLineItem(index, "description", e.target.value)}
                          placeholder="Description"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
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
                          value={`R${item.total.toFixed(2)}`}
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">R{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-medium">R{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total (Client Price):</span>
                  <span>R{calculateTotal().toFixed(2)}</span>
                </div>
                
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

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredDraftPmRfqs.map((rfq: any) => (
              <div
                key={`pm-rfq-${rfq.id}`}
                className="p-6 hover:bg-gray-50 transition-colors"
              >
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">{rfq.title}</h3>
                        <p className="text-sm text-gray-600 mt-1">RFQ #{rfq.rfqNumber}</p>
                      </div>
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={`px-3 py-1 text-xs font-medium rounded-full ${
                            rfq.urgency === "URGENT"
                              ? "bg-red-100 text-red-800"
                              : rfq.urgency === "HIGH"
                                ? "bg-orange-100 text-orange-800"
                                : rfq.urgency === "NORMAL"
                                  ? "bg-blue-100 text-blue-800"
                                  : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {rfq.urgency}
                        </span>
                        <span className="px-3 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-800">
                          Draft
                        </span>
                      </div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <p className="text-gray-700">{rfq.description}</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 text-sm text-gray-600">
                        <div className="flex items-center">
                          <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{rfq.buildingAddress}</span>
                        </div>
                        {rfq.estimatedBudget && (
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                            <span>Est. Budget: R {rfq.estimatedBudget.toFixed(2)}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-2 text-gray-400" />
                          <span>{rfq.propertyManager.firstName} {rfq.propertyManager.lastName}</span>
                        </div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          <span>Submitted: {new Date(rfq.submittedDate).toLocaleDateString()}</span>
                        </div>
                      </div>
                    </div>

                    {rfq.scopeOfWork && (
                      <div className="mt-4 p-3 bg-white rounded-lg border border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Scope of Work:</p>
                        <p className="text-sm text-gray-600 whitespace-pre-wrap">{rfq.scopeOfWork}</p>
                      </div>
                    )}

                    {rfq.notes && (
                      <div className="mt-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                        <p className="text-xs font-semibold text-amber-700 mb-1">Notes:</p>
                        <p className="text-sm text-amber-900">{rfq.notes}</p>
                      </div>
                    )}

                    {rfq.attachments && rfq.attachments.length > 0 && (
                      <div className="mt-3">
                        <p className="text-xs font-semibold text-gray-700 mb-2">
                          Attachments ({rfq.attachments.length}):
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {rfq.attachments.map((url: string, idx: number) => (
                            <a
                              key={idx}
                              href={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="px-3 py-1 text-xs bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-700 transition-colors"
                            >
                              View Attachment {idx + 1}
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-2 lg:min-w-[200px]">
                    <button
                      className="px-4 py-2 text-sm font-medium text-white bg-brand-secondary-600 hover:bg-brand-secondary-700 rounded-lg transition-colors"
                      onClick={() => {
                        reset({
                          customerName: `${rfq.propertyManager.firstName} ${rfq.propertyManager.lastName}`,
                          customerEmail: rfq.propertyManager.email,
                          customerPhone: rfq.propertyManager.phone || "",
                          address: rfq.buildingAddress,
                          clientReferenceQuoteNumber: rfq.rfqNumber || "",
                          notes: `Quotation for RFQ: ${rfq.title}\n\nScope: ${rfq.scopeOfWork}`,
                        });
                        setShowAddForm(true);
                        setLineItems([
                          {
                            description: rfq.title,
                            quantity: 1,
                            unitPrice: 0,
                            total: 0,
                            unitOfMeasure: "Sum",
                          },
                        ]);
                        toast.success("Form pre-filled with RFQ details. Add pricing and submit.");
                      }}
                    >
                      Create Quotation
                    </button>
                    <button
                      onClick={() => handleDownloadPmRfqPdf(rfq.id)}
                      disabled={generatePmRfqPdfMutation.isPending && downloadingPmRfqPdfId === rfq.id}
                      className="px-4 py-2 text-sm font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors inline-flex items-center justify-center disabled:opacity-50"
                    >
                      {generatePmRfqPdfMutation.isPending && downloadingPmRfqPdfId === rfq.id
                        ? "Generating PDF..."
                        : "Download RFQ PDF"}
                    </button>
                    <a
                      href={`mailto:${rfq.propertyManager.email}`}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors text-center"
                    >
                      <Mail className="h-4 w-4 inline mr-1" />
                      Contact PM
                    </a>
                  </div>
                </div>
              </div>
            ))}
            {filteredQuotations.map((quotation) => (
              <div key={quotation.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{quotation.quoteNumber}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          quotationStatuses.find((s) => s.value === quotation.status)?.color
                        }`}
                      >
                        {quotationStatuses.find((s) => s.value === quotation.status)?.label || quotation.status}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {quotation.customerName}
                      </div>
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-2 text-gray-400" />
                        {quotation.customerEmail}
                      </div>
                      <div className="flex items-center">
                        <Phone className="h-4 w-4 mr-2 text-gray-400" />
                        {quotation.customerPhone}
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        R{quotation.total.toLocaleString()}
                      </div>
                    </div>
                    {quotation.assignedTo && (
                      <div className="text-sm text-gray-600 flex items-center mb-2">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        Assigned to: <span className="font-medium ml-1">{quotation.assignedTo.firstName} {quotation.assignedTo.lastName}</span>
                      </div>
                    )}
                    {(() => {
                      const estimatedProfit = (quotation as any).estimatedProfit as number | undefined;
                      if (!isManager || typeof estimatedProfit !== "number") return null;
                      return (
                      <div className="text-sm flex items-center mb-2">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        <span className="text-gray-600">Estimated Profit:</span>
                        <span className={`font-semibold ml-2 ${estimatedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                          R{estimatedProfit.toLocaleString()}
                        </span>
                      </div>
                      );
                    })()}
                    {quotation.validUntil && (
                      <div className="text-sm text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        Valid until {new Date(quotation.validUntil).toLocaleDateString()}
                      </div>
                    )}
                    {quotation.rejectionReason && (
                      <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                        <div className="text-xs font-medium text-gray-700 mb-2">
                          Site Assessment ({quotation.beforePictures.length})
                        </div>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                          {quotation.beforePictures.map((url: string, idx: number) => (
                            <SignedMinioLink
                              key={idx}
                              url={url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block"
                            >
                              <SignedMinioImage
                                url={url}
                                alt={`Assessment ${idx + 1}`}
                                className="w-full h-20 object-cover rounded border border-gray-200 hover:border-brand-primary-500 transition-colors"
                              />
                            </SignedMinioLink>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="ml-4 flex space-x-2">
                    {(quotation.status === "PENDING_JUNIOR_MANAGER_REVIEW" || quotation.status === "PENDING_SENIOR_MANAGER_REVIEW" || quotation.status === "IN_PROGRESS") && (
                      <button
                        onClick={() => {
                          setSelectedRFQReportQuotation(quotation);
                          setShowRFQReportModal(true);
                        }}
                        className="px-3 py-2 text-sm font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors inline-flex items-center"
                      >
                        <FileText className="h-4 w-4 mr-1" />
                        View RFQ Report
                      </button>
                    )}
                    {quotation.status === "APPROVED" && (
                      <button
                        onClick={() => handleExportPdf(quotation.id)}
                        disabled={generateQuotationPdfMutation.isPending && generatingPdfId === quotation.id}
                        className="px-3 py-2 text-sm font-medium text-brand-primary-700 bg-brand-primary-50 hover:bg-brand-primary-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                      >
                        {generateQuotationPdfMutation.isPending && generatingPdfId === quotation.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <Download className="h-4 w-4 mr-1" />
                            Export PDF
                          </>
                        )}
                      </button>
                    )}
                    <button
                      onClick={() => handleEditQuotation(quotation)}
                      className="px-3 py-2 text-sm font-medium text-brand-secondary-700 bg-brand-secondary-50 hover:bg-brand-secondary-100 rounded-lg transition-colors inline-flex items-center"
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteClick(quotation.id)}
                      className="px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center"
                    >
                      <Trash2 className="h-4 w-4 mr-1" />
                      Delete
                    </button>
                    <select
                      value={quotation.status}
                      onChange={(e) => handleStatusChange(quotation.id, e.target.value)}
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-secondary-500"
                    >
                      <option value={quotation.status}>
                        {quotationStatuses.find((s) => s.value === quotation.status)?.label || quotation.status}
                      </option>
                      {getAvailableStatusTransitions(quotation.status, user?.role || "").map((statusValue) => {
                        const statusLabel = quotationStatuses.find((s) => s.value === statusValue)?.label || statusValue;
                        let displayLabel = statusLabel;
                        
                        if (statusValue === "PENDING_ARTISAN_REVIEW" && quotation.status === "DRAFT") {
                          displayLabel = "→ Assign to Artisan";
                        } else if (statusValue === "PENDING_JUNIOR_MANAGER_REVIEW" && quotation.status === "IN_PROGRESS") {
                          displayLabel = "→ Submit for Junior Manager Review";
                        } else if (statusValue === "PENDING_SENIOR_MANAGER_REVIEW" && quotation.status === "PENDING_JUNIOR_MANAGER_REVIEW") {
                          displayLabel = "→ Forward to Senior Manager";
                        } else if (statusValue === "APPROVED" && quotation.status === "PENDING_SENIOR_MANAGER_REVIEW") {
                          displayLabel = "✓ Approve";
                        } else if (statusValue === "SENT_TO_CUSTOMER" && quotation.status === "APPROVED") {
                          displayLabel = "📧 Send to Customer";
                        } else if (statusValue === "REJECTED") {
                          displayLabel = "✗ Reject";
                        } else if (statusValue === "IN_PROGRESS" && (quotation.status === "PENDING_JUNIOR_MANAGER_REVIEW" || quotation.status === "PENDING_SENIOR_MANAGER_REVIEW")) {
                          displayLabel = "← Send Back to Artisan";
                        } else if (statusValue === "PENDING_JUNIOR_MANAGER_REVIEW" && quotation.status === "PENDING_SENIOR_MANAGER_REVIEW") {
                          displayLabel = "← Send Back to Junior Manager";
                        } else if (statusValue === "DRAFT") {
                          displayLabel = "← Back to Draft";
                        }
                        
                        return (
                          <option key={statusValue} value={statusValue}>
                            {displayLabel}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {filteredQuotations.length === 0 && filteredDraftPmRfqs.length === 0 && (
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto">
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
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto">
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
    </div>
  );
}
