import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { FileText, Plus, Loader2, Clock, CheckCircle2, XCircle, Package, AlertCircle, DollarSign, Edit2, Send, Download, Search } from "lucide-react";
import { CreateRFQModal } from "./CreateRFQModal";
import { EditRFQModal } from "./EditRFQModal";
import toast from "react-hot-toast";

interface ComparisonQuotation {
  id: number;
  quoteNumber: string;
  total: number;
  subtotal: number;
  tax: number;
  status: string;
  createdAt: Date;
  createdBy: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    contractorCompanyName: string | null;
    rating: number | null;
  } | null;
}

interface RFQ {
  id: number;
  rfqNumber: string;
  title: string;
  description: string;
  scopeOfWork: string;
  buildingName: string | null;
  buildingAddress: string;
  urgency: "LOW" | "NORMAL" | "HIGH" | "URGENT";
  estimatedBudget: number | null;
  status: "DRAFT" | "SUBMITTED" | "RECEIVED" | "UNDER_REVIEW" | "QUOTED" | "APPROVED" | "REJECTED" | "CONVERTED_TO_ORDER";
  submittedDate: Date | null;
  createdAt: Date;
  attachments: string[];
  notes?: string | null;
  generatedOrderId?: number | null;
  adminQuote?: {
    quoteNumber: string;
    subtotal: number;
    tax: number;
    total: number;
    estimatedDuration?: string;
    notes?: string;
  };
  contractorQuotation?: {
    id: number;
    quoteNumber: string;
    total: number;
    subtotal: number;
    tax: number;
    createdBy: {
      id: number;
      firstName: string;
      lastName: string;
      email: string;
      contractorCompanyName: string | null;
    } | null;
  };

  generatedOrder?: {
    id: number;
    orderNumber?: string | null;
  } | null;
}

const statusConfig: Record<RFQ["status"], { label: string; color: string; icon: React.ElementType }> = {
  DRAFT: { label: "Draft", color: "bg-gray-100 text-gray-700", icon: FileText },
  SUBMITTED: { label: "Submitted", color: "bg-blue-100 text-blue-700", icon: Clock },
  RECEIVED: { label: "Received", color: "bg-indigo-100 text-indigo-700", icon: CheckCircle2 },
  UNDER_REVIEW: { label: "Under Review", color: "bg-yellow-100 text-yellow-700", icon: Clock },
  QUOTED: { label: "Quote Sent", color: "bg-purple-100 text-purple-700", icon: FileText },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-700", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-700", icon: XCircle },
  CONVERTED_TO_ORDER: { label: "Order Issued", color: "bg-teal-100 text-teal-700", icon: Package },
};

function getStatusBadge(status: RFQ["status"]) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.color}`}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </span>
  );
}

export function RFQsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRFQ, setSelectedRFQ] = useState<RFQ | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("SUBMITTED");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [downloadingRFQId, setDownloadingRFQId] = useState<number | null>(null);

  const rfqsQuery = useQuery(
    trpc.getPropertyManagerRFQs.queryOptions(
      {
        token: token!,
        status: statusFilter,
      },
      {
        enabled: !!token,
        refetchInterval: 30000,
      }
    )
  );

  const allRFQsQuery = useQuery(
    trpc.getPropertyManagerRFQs.queryOptions(
      {
        token: token!,
      },
      {
        enabled: !!token,
      }
    )
  );

  const allRFQs: RFQ[] = (allRFQsQuery.data as RFQ[]) || [];
  const fetchedRFQs: RFQ[] = useMemo(() => {
    // Requirement: once an RFQ is converted to an Order, its approved quotation
    // should still reflect under the "Approved" tab.
    if (statusFilter === "APPROVED") {
      return allRFQs.filter(
        (rfq) => rfq.status === "APPROVED" || rfq.status === "CONVERTED_TO_ORDER"
      );
    }

    return ((rfqsQuery.data as RFQ[]) || []) as RFQ[];
  }, [allRFQs, rfqsQuery.data, statusFilter]);
  
  // Apply search filter
  const rfqs = useMemo(() => {
    let filtered = fetchedRFQs;
    
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter((rfq: RFQ) => 
        rfq.rfqNumber?.toLowerCase().includes(query) ||
        rfq.title?.toLowerCase().includes(query) ||
        rfq.description?.toLowerCase().includes(query) ||
        rfq.buildingName?.toLowerCase().includes(query) ||
        rfq.buildingAddress?.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [fetchedRFQs, searchQuery]);
  
  const statusCounts = allRFQs.reduce((acc, rfq) => {
    acc[rfq.status] = (acc[rfq.status] || 0) + 1;
    return acc;
  }, {} as Record<RFQ["status"], number>);

  const approveQuoteMutation = useMutation(
    trpc.updatePropertyManagerRFQStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Quote approved successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to approve quote.");
      },
    })
  );

  const rejectQuoteMutation = useMutation(
    trpc.updatePropertyManagerRFQStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Quote rejected.");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to reject quote.");
      },
    })
  );

  const handleApproveQuote = (rfqId: number) => {
    if (!token) return;
    if (confirm("Are you sure you want to approve this quote?")) {
      approveQuoteMutation.mutate({
        token,
        rfqId,
        action: "APPROVE",
      });
    }
  };

  const handleRejectQuote = (rfqId: number) => {
    if (!token) return;
    const reason = prompt("Please provide a reason for rejection:");
    if (reason) {
      rejectQuoteMutation.mutate({
        token,
        rfqId,
        action: "REJECT",
        rejectionReason: reason,
      });
    }
  };

  const handleEditRFQ = (rfq: RFQ) => {
    setSelectedRFQ(rfq);
    setShowEditModal(true);
  };

  if (rfqsQuery.isLoading && !rfqsQuery.data) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-teal-500" />
        <p className="ml-3 text-gray-600">Loading RFQs...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <CreateRFQModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />
      
      <EditRFQModal 
        isOpen={showEditModal} 
        onClose={() => {
          setShowEditModal(false);
          setSelectedRFQ(null);
        }}
        rfq={selectedRFQ}
      />

      {/* Search and Filter */}
      <div className="space-y-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by RFQ number, title, description or building..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
          />
        </div>
        
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-4">
          <div className="flex flex-wrap gap-2">
            {Object.entries(statusConfig).map(([key, config]) => (
              <button
                key={key}
                onClick={() => setStatusFilter(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === key
                    ? `bg-teal-600 text-white shadow-md`
                    : `bg-gray-100 text-gray-700 hover:bg-gray-200`
                }`}
              >
                {config.label} ({statusCounts[key as RFQ["status"]] || 0})
              </button>
            ))}
          </div>
          
          <button 
            onClick={() => setShowCreateModal(true)}
            className="inline-flex items-center px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors shadow-md"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create RFQ
          </button>
        </div>
      </div>

      {/* RFQ List */}
      {rfqsQuery.isError && (
        <div className="p-4 bg-red-100 border border-red-400 text-red-700 rounded-lg">
          <AlertCircle className="inline h-5 w-5 mr-2" />
          Failed to fetch RFQs. Please try refreshing the page.
        </div>
      )}

      {rfqs.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No RFQs Found</h3>
          <p className="text-sm text-gray-600 mb-6">
            You haven't submitted any RFQs yet. Click "Create RFQ" to start a new request.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {rfqs.map((rfq) => (
            <RFQCard 
              key={rfq.id} 
              rfq={rfq} 
              onApproveQuote={handleApproveQuote}
              onRejectQuote={handleRejectQuote}
              onEdit={handleEditRFQ}
              downloadingRFQId={downloadingRFQId}
              setDownloadingRFQId={setDownloadingRFQId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RFQCard({ rfq, onApproveQuote, onRejectQuote, onEdit, downloadingRFQId, setDownloadingRFQId }: { 
  rfq: RFQ; 
  onApproveQuote: (rfqId: number) => void;
  onRejectQuote: (rfqId: number) => void;
  onEdit: (rfq: RFQ) => void;
  downloadingRFQId: number | null;
  setDownloadingRFQId: (id: number | null) => void;
}) {
  const [showQuoteDetails, setShowQuoteDetails] = useState(false);
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [compareRFQNumber, setCompareRFQNumber] = useState<string | null>(null);
  const [compareResults, setCompareResults] = useState<ComparisonQuotation[]>([]);
  const [showCompare, setShowCompare] = useState(false);
  
  const downloadRFQPdfMutation = useMutation(
    trpc.generatePropertyManagerRFQPdf.mutationOptions({
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
          link.download = data.filename || 'rfq.pdf';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the URL object
          window.URL.revokeObjectURL(url);
        }
        toast.success("PDF downloaded successfully!");
        setDownloadingRFQId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF.");
        setDownloadingRFQId(null);
      },
    })
  );

  const downloadQuotationPdfMutation = useMutation(
    trpc.generateQuotationPdf.mutationOptions({
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
          link.download = `quotation-${rfq.rfqNumber || rfq.id}.pdf`;
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          
          // Clean up the URL object
          window.URL.revokeObjectURL(url);
        }
        toast.success("Contractor quotation downloaded successfully!");
        setDownloadingRFQId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate quotation PDF.");
        setDownloadingRFQId(null);
      },
    })
  );

  const downloadGeneratedOrderPdfMutation = useMutation(
    trpc.generatePropertyManagerOrderPdf.mutationOptions({
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
          link.download = data.filename || "order.pdf";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
        toast.success("Order PDF downloaded successfully!");
        setDownloadingRFQId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate order PDF.");
        setDownloadingRFQId(null);
      },
    })
  );

  const quotationPdfCopiesQuery = useQuery(
    trpc.getPropertyManagerQuotationPdfCopies.queryOptions(
      {
        token: token!,
        rfqId: rfq.id,
      },
      {
        enabled: !!token && (rfq.status === "APPROVED" || rfq.status === "REJECTED" || rfq.status === "CONVERTED_TO_ORDER"),
        refetchInterval: 30000,
      }
    )
  );

  const downloadQuotationPdfCopyMutation = useMutation(
    trpc.downloadPropertyManagerQuotationPdfCopy.mutationOptions({
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
          link.download = data.filename || "quotation-copy.pdf";
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          window.URL.revokeObjectURL(url);
        }
        toast.success("Saved quotation copy downloaded.");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to download saved copy.");
      },
    })
  );

  const deleteQuotationPdfCopyMutation = useMutation(
    trpc.deletePropertyManagerQuotationPdfCopy.mutationOptions({
      onSuccess: () => {
        toast.success("Saved copy deleted.");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerQuotationPdfCopies.queryKey({ token: token!, rfqId: rfq.id }),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete saved copy.");
      },
    })
  );

  const convertToOrderMutation = useMutation(
    trpc.createPropertyManagerOrder.mutationOptions({
      onSuccess: (data: any) => {
        toast.success(`Order created successfully (${data?.orderNumber || ""})`.trim());
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerOrders.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to convert to order.");
      },
    })
  );

  const selectQuotationMutation = useMutation(
    trpc.selectQuotationForRFQ.mutationOptions({
      onSuccess: () => {
        toast.success("Quotation approved; others rejected.");
        setShowCompare(false);
        setCompareResults([]);
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to approve quotation.");
      },
    })
  );

  const handleCompare = async () => {
    if (!token) return;

    const rfqNumber = window.prompt(
      "Enter the RFQ number to compare:",
      rfq.rfqNumber
    );
    if (!rfqNumber?.trim()) return;

    const cleaned = rfqNumber.trim();
    setCompareRFQNumber(cleaned);

    try {
      const data = await queryClient.fetchQuery(
        trpc.getQuotationsForRFQComparison.queryOptions({
          token,
          rfqNumber: cleaned,
        })
      );

      const results = (data as ComparisonQuotation[]) || [];
      setCompareResults(results);
      setShowCompare(true);
      if (results.length === 0) {
        toast.error("No quotations found for that RFQ number.");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to compare quotations.");
    }
  };

  const handleApproveSelected = (quotationId: number) => {
    if (!token) return;
    const rfqNumber = (compareRFQNumber || rfq.rfqNumber).trim();
    selectQuotationMutation.mutate({
      token,
      rfqNumber,
      selectedQuotationId: quotationId,
    });
  };

  const handleDownloadPdf = () => {
    if (!token) return;
    setDownloadingRFQId(rfq.id);

    // If RFQ has been converted to an order, download the issued Order PDF (not the RFQ/quotation).
    if (rfq.status === "CONVERTED_TO_ORDER") {
      const orderId = rfq.generatedOrder?.id ?? rfq.generatedOrderId;
      if (!orderId) {
        toast.error("This RFQ is marked as Order Issued, but no Order record was found.");
        setDownloadingRFQId(null);
        return;
      } else {
      downloadGeneratedOrderPdfMutation.mutate({
          orderId,
      });
      return;
      }
    }
    
    // If we have a contractor quotation, download that (covers RECEIVED + UNDER_REVIEW)
    if (rfq.contractorQuotation?.id) {
      downloadQuotationPdfMutation.mutate({
        token,
        quotationId: rfq.contractorQuotation.id,
      });
    } else {
      // Otherwise download the RFQ PDF
      downloadRFQPdfMutation.mutate({
        token,
        rfqId: rfq.id,
      });
    }
  };

  const handleConvertToOrder = () => {
    if (!token) return;
    if (rfq.status !== "APPROVED") return;

    if (!confirm("Convert this approved RFQ to an Order?")) return;

    const description = "Issued based on approved quotation. See itemised scope and billing in the generated work order.";
    const scopeOfWork = "See approved quotation for itemised scope of work and billing.";

    convertToOrderMutation.mutate({
      token,
      generatedFromRFQId: rfq.id,
      title: rfq.title,
      description,
      scopeOfWork,
      buildingAddress: rfq.buildingAddress,
      buildingName: rfq.buildingName || undefined,
      totalAmount: 0,
    });
  };
  
  const getUrgencyColor = (urgency: RFQ["urgency"]) => {
    switch (urgency) {
      case "URGENT": return "bg-red-500";
      case "HIGH": return "bg-orange-500";
      case "NORMAL": return "bg-blue-500";
      default: return "bg-gray-500";
    }
  };
  
  return (
    <div className="bg-gray-50 p-4 border border-gray-200 rounded-lg shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start mb-3">
        <h4 className="text-md font-semibold text-gray-900 flex items-center space-x-2">
          <span>{rfq.rfqNumber} - {rfq.title}</span>
        </h4>
        <div className="flex items-center space-x-2 flex-shrink-0">
          {getStatusBadge(rfq.status)}
          <span className={`h-2.5 w-2.5 rounded-full ${getUrgencyColor(rfq.urgency)}`} title={rfq.urgency}></span>
        </div>
      </div>
      
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm text-gray-700">
        <p><strong>Property:</strong> {rfq.buildingName || "N/A"}</p>
        <p><strong>Address:</strong> {rfq.buildingAddress}</p>
        <p><strong>Budget:</strong> R{(rfq.estimatedBudget || 0).toLocaleString()}</p>
        <p><strong>Urgency:</strong> {rfq.urgency}</p>
        <p className="col-span-2 text-xs text-gray-500">
          Submitted: {rfq.submittedDate ? new Date(rfq.submittedDate).toLocaleDateString() : new Date(rfq.createdAt).toLocaleDateString()}
        </p>
      </div>

      {/* Show contractor details for RECEIVED status */}
      {rfq.status === 'RECEIVED' && rfq.contractorQuotation && (
        <div className="mt-3 p-3 bg-indigo-50 border border-indigo-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-indigo-900 flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Contractor Quotation Received
            </h5>
          </div>
          <div className="space-y-1 text-sm text-gray-700">
            <p><strong>From:</strong> {rfq.contractorQuotation.createdBy?.firstName} {rfq.contractorQuotation.createdBy?.lastName}</p>
            {rfq.contractorQuotation.createdBy?.contractorCompanyName && (
              <p><strong>Company:</strong> {rfq.contractorQuotation.createdBy.contractorCompanyName}</p>
            )}
            <p><strong>Email:</strong> {rfq.contractorQuotation.createdBy?.email}</p>
            <p><strong>Quote Number:</strong> {rfq.contractorQuotation.quoteNumber}</p>
            <p><strong>Quote Amount:</strong> <span className="text-lg font-semibold text-indigo-900">R{rfq.contractorQuotation.total.toLocaleString()}</span></p>
          </div>
        </div>
      )}

      <p className="mt-2 text-sm text-gray-600 line-clamp-2">
        {rfq.description}
      </p>

      {(rfq.status === "APPROVED" || rfq.status === "REJECTED" || rfq.status === "CONVERTED_TO_ORDER") && (
        <div className="mt-3 p-3 bg-gray-50 border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-gray-900">Saved Quotation Copies</h5>
          </div>

          {quotationPdfCopiesQuery.isLoading ? (
            <p className="text-sm text-gray-600">Loading saved copies...</p>
          ) : quotationPdfCopiesQuery.isError ? (
            <p className="text-sm text-red-600">Failed to load saved copies.</p>
          ) : !Array.isArray(quotationPdfCopiesQuery.data) || quotationPdfCopiesQuery.data.length === 0 ? (
            <p className="text-sm text-gray-600">No saved copies yet.</p>
          ) : (
            <div className="space-y-2">
              {quotationPdfCopiesQuery.data.map((copy: any) => (
                <div key={copy.id} className="flex items-center justify-between gap-3 p-2 bg-white border border-gray-200 rounded">
                  <div className="text-sm text-gray-800">
                    <div className="font-semibold">
                      {copy.decision === "APPROVED" ? "Approved" : "Rejected"} • {copy.filename}
                    </div>
                    <div className="text-xs text-gray-600">
                      Saved: {copy.createdAt ? new Date(copy.createdAt).toLocaleDateString() : ""}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => {
                        if (!token) return;
                        downloadQuotationPdfCopyMutation.mutate({ token, copyId: copy.id });
                      }}
                      disabled={downloadQuotationPdfCopyMutation.isPending}
                      className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded disabled:opacity-50"
                    >
                      Download
                    </button>
                    <button
                      onClick={() => {
                        if (!token) return;
                        if (!confirm("Delete this saved copy? This will NOT delete the original quotation.")) return;
                        deleteQuotationPdfCopyMutation.mutate({ token, copyId: copy.id });
                      }}
                      disabled={deleteQuotationPdfCopyMutation.isPending}
                      className="px-2 py-1 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {rfq.adminQuote && rfq.status === 'QUOTED' && (
        <div className="mt-3 p-3 bg-purple-50 border border-purple-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-purple-900 flex items-center">
              <DollarSign className="h-4 w-4 mr-1" />
              Quote Received
            </h5>
            <button
              onClick={() => setShowQuoteDetails(!showQuoteDetails)}
              className="text-xs text-purple-600 hover:text-purple-800"
            >
              {showQuoteDetails ? "Hide" : "View"} Details
            </button>
          </div>
          <p className="text-sm text-gray-700">
            <strong>Quote Number:</strong> {rfq.adminQuote.quoteNumber}
          </p>
          <p className="text-sm text-gray-700">
            <strong>Total:</strong> R{rfq.adminQuote.total.toLocaleString()}
          </p>
          {showQuoteDetails && (
            <div className="mt-2 space-y-1 text-xs text-gray-600">
              <p><strong>Subtotal:</strong> R{rfq.adminQuote.subtotal.toLocaleString()}</p>
              <p><strong>Tax:</strong> R{rfq.adminQuote.tax.toLocaleString()}</p>
              {rfq.adminQuote.estimatedDuration && (
                <p><strong>Est. Duration:</strong> {rfq.adminQuote.estimatedDuration}</p>
              )}
              {rfq.adminQuote.notes && (
                <p className="mt-1"><strong>Notes:</strong> {rfq.adminQuote.notes}</p>
              )}
            </div>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end space-x-2">
        {/* Download PDF button - available for all statuses except DRAFT */}
        {rfq.status !== 'DRAFT' && (
          <button
            onClick={handleDownloadPdf}
            disabled={downloadingRFQId === rfq.id}
            className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {downloadingRFQId === rfq.id ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Download PDF
          </button>
        )}
        
        {/* Status change dropdown for RECEIVED RFQs */}
        {rfq.status === 'RECEIVED' && (
          <StatusChangeDropdown rfq={rfq} />
        )}

        {/* Compare button for UNDER_REVIEW RFQs */}
        {rfq.status === 'UNDER_REVIEW' && (
          <button
            onClick={handleCompare}
            disabled={selectQuotationMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors disabled:opacity-50"
          >
            Compare
          </button>
        )}

        {/* Convert approved RFQ to Order */}
        {rfq.status === "APPROVED" && (
          <button
            onClick={handleConvertToOrder}
            disabled={convertToOrderMutation.isPending}
            className="px-3 py-1.5 text-sm font-medium text-white bg-teal-600 hover:bg-teal-700 rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
          >
            {convertToOrderMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Package className="h-4 w-4" />
            )}
            Convert to Order
          </button>
        )}
        
        {/* Allow editing in DRAFT or SUBMITTED status */}
        {(rfq.status === 'DRAFT' || rfq.status === 'SUBMITTED') && (
          <button 
            onClick={() => onEdit(rfq)}
            className="px-3 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors flex items-center gap-2"
          >
            <Edit2 className="h-4 w-4" />
            Edit & Resubmit
          </button>
        )}
        {rfq.status === 'QUOTED' && (
          <>
            <button 
              onClick={() => onApproveQuote(rfq.id)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
            >
              Approve Quote
            </button>
            <button 
              onClick={() => onRejectQuote(rfq.id)}
              className="px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
            >
              Reject Quote
            </button>
          </>
        )}
      </div>

      {rfq.status === 'UNDER_REVIEW' && showCompare && (
        <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h5 className="text-sm font-semibold text-yellow-900">Quotation Comparison</h5>
            <button
              onClick={() => {
                setShowCompare(false);
                setCompareResults([]);
              }}
              className="text-xs text-yellow-700 hover:text-yellow-900"
            >
              Close
            </button>
          </div>

          {compareResults.length === 0 ? (
            <p className="text-sm text-gray-700">No quotations found.</p>
          ) : (
            <div className="space-y-2">
              {compareResults.map((q) => (
                <div key={q.id} className="p-2 bg-white border border-yellow-200 rounded">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm text-gray-800">
                      <div className="font-semibold">{q.quoteNumber} - R{q.total.toLocaleString()}</div>
                      <div className="text-xs text-gray-600">
                        Contractor: {q.createdBy ? `${q.createdBy.firstName} ${q.createdBy.lastName}` : "N/A"}
                        {q.createdBy?.contractorCompanyName ? ` (${q.createdBy.contractorCompanyName})` : ""}
                        {q.createdBy?.rating != null ? ` • Rating: ${q.createdBy.rating}/5` : " • Rating: N/A"}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => {
                          if (!token) return;
                          setDownloadingRFQId(rfq.id);
                          downloadQuotationPdfMutation.mutate({ token, quotationId: q.id });
                        }}
                        disabled={downloadQuotationPdfMutation.isPending}
                        className="px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded"
                      >
                        Download
                      </button>
                      <button
                        onClick={() => handleApproveSelected(q.id)}
                        disabled={selectQuotationMutation.isPending}
                        className="px-2 py-1 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded disabled:opacity-50"
                      >
                        {selectQuotationMutation.isPending ? "Approving..." : "Approve"}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Status change dropdown component for RECEIVED RFQs
function StatusChangeDropdown({ rfq }: { rfq: RFQ }) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [isChanging, setIsChanging] = useState(false);

  const updateStatusMutation = useMutation(
    trpc.updatePropertyManagerRFQStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Status updated successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
        setIsChanging(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update status.");
        setIsChanging(false);
      },
    })
  );

  const handleStatusChange = (newStatus: string) => {
    if (!token) return;
    
    if (newStatus === "UNDER_REVIEW") {
      setIsChanging(true);
      updateStatusMutation.mutate({
        token,
        rfqId: rfq.id,
        action: "START_REVIEW",
      });
    } else if (newStatus === "REJECTED") {
      const reason = prompt("Please provide a reason for rejection:");
      if (reason) {
        setIsChanging(true);
        updateStatusMutation.mutate({
          token,
          rfqId: rfq.id,
          action: "REJECT",
          rejectionReason: reason,
        });
      }
    }
  };

  return (
    <div className="relative">
      <select
        value=""
        onChange={(e) => handleStatusChange(e.target.value)}
        disabled={isChanging}
        className="px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
      >
        <option value="">Change Status...</option>
        <option value="UNDER_REVIEW">→ Start Review</option>
        <option value="REJECTED">✗ Reject</option>
      </select>
      {isChanging && (
        <div className="absolute right-0 top-0 mt-2 mr-2">
          <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
        </div>
      )}
    </div>
  );
}
