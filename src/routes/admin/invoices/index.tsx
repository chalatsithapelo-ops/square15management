import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
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
} from "lucide-react";
import { AlternativeRevenueForm } from "~/components/AlternativeRevenueForm";

export const Route = createFileRoute("/admin/invoices/")({
  component: InvoicesPage,
});

const invoiceSchema = z.object({
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  dueDate: z.string().optional(),
  notes: z.string().optional(),
  invoiceNumber: z.preprocess(
    (val) => val === "" ? undefined : val,
    z.string().min(1).optional()
  ),
});

type InvoiceForm = z.infer<typeof invoiceSchema>;

const invoiceStatuses = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800" },
  { value: "PENDING_REVIEW", label: "Pending Review (Jr Admin)", color: "bg-yellow-100 text-yellow-800" },
  { value: "PENDING_APPROVAL", label: "Pending Approval (Sr Admin)", color: "bg-orange-100 text-orange-800" },
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
  const transitions: Record<string, string[]> = {
    DRAFT: ["PENDING_REVIEW", "CANCELLED"],
    PENDING_REVIEW: userRole === "SENIOR_ADMIN" 
      ? ["PENDING_APPROVAL", "REJECTED", "CANCELLED"]
      : ["PENDING_APPROVAL", "REJECTED", "CANCELLED"],
    PENDING_APPROVAL: userRole === "SENIOR_ADMIN"
      ? ["SENT", "REJECTED", "CANCELLED"]
      : [],
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
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [editingInvoice, setEditingInvoice] = useState<number | null>(null);
  const [lineItems, setLineItems] = useState<LineItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" },
  ]);
  const [companyMaterialCost, setCompanyMaterialCost] = useState<string>("");
  const [companyLabourCost, setCompanyLabourCost] = useState<string>("");
  const [showRejectionModal, setShowRejectionModal] = useState(false);
  const [rejectionInvoiceId, setRejectionInvoiceId] = useState<number | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [expandedInvoices, setExpandedInvoices] = useState<Set<number>>(new Set());
  const [generatingDescriptionIndex, setGeneratingDescriptionIndex] = useState<number | null>(null);
  const [referencedOrder, setReferencedOrder] = useState<any | null>(null);
  const [downloadingOrderPdf, setDownloadingOrderPdf] = useState(false);

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
    })
  );

  const completedOrdersQuery = useQuery({
    ...trpc.getOrders.queryOptions({
      token: token!,
      status: "COMPLETED" as any,
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

  // Combine completed orders and filter those without invoices
  const completedOrdersWithoutInvoice = useMemo(() => {
    const orders = completedOrdersQuery.data || [];
    const pmOrders = completedPMOrdersQuery.data || [];
    
    // Filter orders that don't have an invoice
    const ordersWithoutInvoice = orders.filter((order: any) => !order.invoice && !order.invoiceId);
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
    
    return [...ordersWithoutInvoice, ...normalizedPMOrders];
  }, [completedOrdersQuery.data, completedPMOrdersQuery.data]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<InvoiceForm>({
    resolver: zodResolver(invoiceSchema),
  });

  const createInvoiceMutation = useMutation(
    trpc.createInvoice.mutationOptions({
      onSuccess: () => {
        toast.success("Invoice created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getPropertyManagerOrders.queryKey() });
        reset();
        setLineItems([{ description: "", quantity: 1, unitPrice: 0, total: 0, unitOfMeasure: "Sum" }]);
        setCompanyMaterialCost("");
        setCompanyLabourCost("");
        setReferencedOrder(null);
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create invoice");
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
      onSuccess: () => {
        toast.success("Invoice status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getInvoices.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update invoice status");
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
      dueDate: invoice.dueDate ? new Date(invoice.dueDate).toISOString().split('T')[0] : "",
      notes: invoice.notes || "",
      invoiceNumber: invoice.invoiceNumber,
    });
    
    // Populate line items
    if (invoice.items && Array.isArray(invoice.items)) {
      setLineItems(invoice.items);
    }
    
    // Populate cost fields
    setCompanyMaterialCost(invoice.companyMaterialCost?.toString() || "");
    setCompanyLabourCost(invoice.companyLabourCost?.toString() || "");
  };

  const handleExportPdf = (invoiceId: number) => {
    setGeneratingPdfId(invoiceId);
    generateInvoicePdfMutation.mutate({
      token: token!,
      invoiceId,
    });
  };

  const handleGenerateDescription = (index: number) => {
    const item = lineItems[index];
    
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
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === "quantity" || field === "unitPrice") {
      newItems[index].total = newItems[index].quantity * newItems[index].unitPrice;
    }
    
    setLineItems(newItems);
  };

  const calculateSubtotal = () => {
    return lineItems.reduce((sum, item) => sum + item.total, 0);
  };

  const calculateTax = () => {
    return calculateSubtotal() * 0.15;
  };

  const calculateTotal = () => {
    return calculateSubtotal() + calculateTax();
  };

  const calculateEstimatedProfit = () => {
    const total = calculateTotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    return total - materialCost - labourCost;
  };

  const onSubmit = (data: InvoiceForm) => {
    const subtotal = calculateSubtotal();
    const tax = calculateTax();
    const total = calculateTotal();
    const materialCost = parseFloat(companyMaterialCost) || 0;
    const labourCost = parseFloat(companyLabourCost) || 0;
    const estimatedProfit = total - materialCost - labourCost;

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
        companyMaterialCost: materialCost,
        companyLabourCost: labourCost,
        estimatedProfit,
        // Include PM order info if this is from a PM order
        isPMOrder: referencedOrder?.isPropertyManagerOrder || false,
        pmOrderId: referencedOrder?.isPropertyManagerOrder ? referencedOrder.id : undefined,
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
    
    // Add materials as line items
    if (order.materials && order.materials.length > 0) {
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

    // Add job activities as line items
    if (order.jobActivities && order.jobActivities.length > 0) {
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
  }, [invoices, statusFilter, searchTerm]);

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
              placeholder="Search by invoice number, customer name or email..."
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
          </div>
        </div>

        {/* Completed Jobs Without Invoices */}
        {completedOrdersWithoutInvoice.length > 0 && !statusFilter && (
          <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-xl shadow-sm border-2 border-purple-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-3">
                <div className="bg-purple-600 p-2 rounded-lg">
                  <Receipt className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Completed Jobs - Ready for Invoicing</h3>
                  <p className="text-sm text-gray-600">
                    {completedOrdersWithoutInvoice.length} completed job{completedOrdersWithoutInvoice.length !== 1 ? 's' : ''} waiting for invoice creation
                  </p>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {completedOrdersWithoutInvoice.map((order: any) => (
                <div key={`${order.isPropertyManagerOrder ? 'pm' : 'order'}-${order.id}`} className="bg-white rounded-lg border border-purple-200 p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-semibold text-gray-900">{order.orderNumber}</h4>
                        <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          Completed
                        </span>
                        {order.isPropertyManagerOrder && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            PM Order
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
                    <button
                      onClick={() => handleCreateInvoiceFromOrder(order)}
                      className="ml-4 inline-flex items-center px-3 py-1.5 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Create Invoice
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingInvoice ? "Edit Invoice" : "Create New Invoice"}
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
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                  />
                  {errors.customerName && (
                    <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                  )}
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
                  <button
                    type="button"
                    onClick={addLineItem}
                    className="text-sm text-brand-danger-600 hover:text-brand-danger-700 font-medium"
                  >
                    + Add Item
                  </button>
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
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal:</span>
                  <span className="font-medium">R{calculateSubtotal().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">VAT (15%):</span>
                  <span className="font-medium">R{calculateTax().toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold border-t pt-2">
                  <span>Total:</span>
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
                    setEditingInvoice(null);
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
            {filteredInvoices.map((invoice) => {
              const isExpanded = expandedInvoices.has(invoice.id);
              const items = Array.isArray(invoice.items) ? invoice.items : [];
              const hasOrderReference = !!invoice.order;
              
              return (
                <div key={invoice.id} className="hover:bg-gray-50 transition-colors">
                  <div className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">{invoice.invoiceNumber}</h3>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
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
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                              From Order
                            </span>
                          )}
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                          <div className="flex items-center">
                            <User className="h-4 w-4 mr-2 text-gray-400" />
                            {invoice.customerName}
                          </div>
                          <div className="flex items-center">
                            <Mail className="h-4 w-4 mr-2 text-gray-400" />
                            {invoice.customerEmail}
                          </div>
                          <div className="flex items-center">
                            <Phone className="h-4 w-4 mr-2 text-gray-400" />
                            {invoice.customerPhone}
                          </div>
                          <div className="flex items-center">
                            <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                            R{invoice.total.toLocaleString()}
                          </div>
                          {isAdmin && invoice.estimatedProfit !== undefined && (
                            <div className="flex items-center">
                              <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="text-gray-600">Estimated Profit:</span>
                              <span className={`font-semibold ml-2 ${invoice.estimatedProfit >= 0 ? "text-green-700" : "text-red-700"}`}>
                                R{invoice.estimatedProfit.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </div>
                        
                        {/* Internal Cost Breakdown */}
                        {isAdmin && (invoice.companyMaterialCost !== undefined || invoice.companyLabourCost !== undefined) && (
                          <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-4 mb-3 border border-green-100">
                            <h4 className="text-sm font-semibold text-gray-900 mb-2">Internal Cost Breakdown</h4>
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                              <div>
                                <span className="text-gray-600">Material Cost:</span>
                                <div className="font-medium text-gray-900">
                                  R{invoice.companyMaterialCost?.toFixed(2) || "0.00"}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-600">Labour Cost:</span>
                                <div className="font-medium text-gray-900">
                                  R{invoice.companyLabourCost?.toFixed(2) || "0.00"}
                                </div>
                              </div>
                              <div>
                                <span className="text-gray-600">Total Cost to Company:</span>
                                <div className="font-medium text-gray-900">
                                  R{((invoice.companyMaterialCost || 0) + (invoice.companyLabourCost || 0)).toFixed(2)}
                                </div>
                              </div>
                            </div>
                            <div className="mt-3 pt-3 border-t border-green-200">
                              <div className="flex justify-between items-center">
                                <span className="font-semibold text-gray-900">Client Invoice Total:</span>
                                <span className="font-bold text-gray-900">R{invoice.total.toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        
                        {/* Cost to Company Breakdown */}
                        <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-4 mb-3 border border-blue-100">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900">Cost to Company Breakdown</h4>
                            <button
                              onClick={() => toggleInvoiceExpansion(invoice.id)}
                              className="text-sm text-brand-danger-600 hover:text-brand-danger-700 font-medium inline-flex items-center"
                            >
                              {isExpanded ? (
                                <>
                                  <ChevronUp className="h-4 w-4 mr-1" />
                                  Hide Details
                                </>
                              ) : (
                                <>
                                  <ChevronDown className="h-4 w-4 mr-1" />
                                  Show Details
                                </>
                              )}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            {(invoice.companyMaterialCost !== undefined && invoice.companyMaterialCost > 0) && (
                              <div className="bg-white rounded-lg p-3 border border-green-200">
                                <div className="text-xs text-gray-600 mb-1">Material Cost</div>
                                <div className="text-lg font-bold text-green-700">R{invoice.companyMaterialCost.toLocaleString()}</div>
                              </div>
                            )}
                            {(invoice.companyLabourCost !== undefined && invoice.companyLabourCost > 0) && (
                              <div className="bg-white rounded-lg p-3 border border-blue-200">
                                <div className="text-xs text-gray-600 mb-1">Labour Cost</div>
                                <div className="text-lg font-bold text-blue-700">R{invoice.companyLabourCost.toLocaleString()}</div>
                              </div>
                            )}
                            {(invoice.companyMaterialCost !== undefined || invoice.companyLabourCost !== undefined) && (
                              <div className="bg-white rounded-lg p-3 border border-indigo-200">
                                <div className="text-xs text-gray-600 mb-1">Total Cost to Company</div>
                                <div className="text-lg font-bold text-indigo-700">
                                  R{((invoice.companyMaterialCost || 0) + (invoice.companyLabourCost || 0)).toLocaleString()}
                                </div>
                              </div>
                            )}
                          </div>
                          {(!invoice.companyMaterialCost && !invoice.companyLabourCost) && (
                            <div className="text-sm text-gray-500 italic">
                              No cost breakdown available for this invoice
                            </div>
                          )}
                        </div>

                        {/* Expanded Line Items Details */}
                        {isExpanded && items.length > 0 && (
                          <div className="bg-gray-50 rounded-lg p-4 mb-3 border border-gray-200">
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">Detailed Line Items</h4>
                            <div className="overflow-x-auto scrollbar-none touch-pan-x">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead>
                                  <tr className="bg-gray-100">
                                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      Description
                                    </th>
                                    <th className="px-3 py-2 text-center text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      UoM
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      Quantity
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      Unit Price
                                    </th>
                                    <th className="px-3 py-2 text-right text-xs font-medium text-gray-700 uppercase tracking-wider">
                                      Total
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {items.map((item: any, idx: number) => (
                                    <tr key={idx} className="hover:bg-gray-50">
                                      <td className="px-3 py-2 text-sm text-gray-900">{item.description}</td>
                                      <td className="px-3 py-2 text-sm text-gray-600 text-center">{item.unitOfMeasure || 'Sum'}</td>
                                      <td className="px-3 py-2 text-sm text-gray-900 text-right">{item.quantity}</td>
                                      <td className="px-3 py-2 text-sm text-gray-900 text-right">R{item.unitPrice.toFixed(2)}</td>
                                      <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">R{item.total.toFixed(2)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                                <tfoot className="bg-gray-50">
                                  <tr>
                                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-700 text-right">Subtotal:</td>
                                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">R{invoice.subtotal.toFixed(2)}</td>
                                  </tr>
                                  <tr>
                                    <td colSpan={4} className="px-3 py-2 text-sm font-medium text-gray-700 text-right">VAT (15%):</td>
                                    <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">R{invoice.tax.toFixed(2)}</td>
                                  </tr>
                                  <tr className="border-t-2 border-gray-300">
                                    <td colSpan={4} className="px-3 py-2 text-base font-bold text-gray-900 text-right">Total:</td>
                                    <td className="px-3 py-2 text-base font-bold text-brand-danger-600 text-right">R{invoice.total.toFixed(2)}</td>
                                  </tr>
                                </tfoot>
                              </table>
                            </div>
                          </div>
                        )}

                        {invoice.dueDate && (
                          <div className="text-sm text-gray-600 flex items-center mb-2">
                            <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                            Due {new Date(invoice.dueDate).toLocaleDateString()}
                          </div>
                        )}
                        {invoice.order && (
                          <div className="text-sm text-purple-600 font-medium">
                            Auto-generated from Order {invoice.order.orderNumber}
                          </div>
                        )}
                        {invoice.rejectionReason && (
                          <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                            <p className="text-sm font-medium text-red-900 mb-1">Rejection Reason:</p>
                            <p className="text-sm text-red-700">{invoice.rejectionReason}</p>
                          </div>
                        )}
                      </div>
                      <div className="ml-4 flex space-x-2">
                        {["SENT", "OVERDUE", "PAID"].includes(invoice.status) && (
                          <button
                            onClick={() => handleExportPdf(invoice.id)}
                            disabled={generateInvoicePdfMutation.isPending && generatingPdfId === invoice.id}
                            className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center"
                          >
                            {generateInvoicePdfMutation.isPending && generatingPdfId === invoice.id ? (
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
                          onClick={() => handleEditInvoice(invoice)}
                          className="px-3 py-2 text-sm font-medium text-brand-danger-700 bg-brand-danger-50 hover:bg-brand-danger-100 rounded-lg transition-colors"
                        >
                          Edit
                        </button>
                        <select
                          value={invoice.status}
                          onChange={(e) => handleStatusChange(invoice.id, e.target.value)}
                          className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-danger-500"
                        >
                          <option value={invoice.status}>
                            {invoice.status === "SENT" 
                              ? "Sent"
                              : invoice.status === "OVERDUE"
                              ? "Overdue"
                              : invoiceStatuses.find((s) => s.value === invoice.status)?.label
                            }
                          </option>
                          {getAvailableStatusTransitions(invoice.status, user?.role || "").map((statusValue) => {
                            return (
                              <option key={statusValue} value={statusValue}>
                                {statusValue === "SENT" && invoice.status === "PENDING_APPROVAL" 
                                  ? "✓ Approve (Send to Customer)"
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
                            );
                          })}
                        </select>
                      </div>
                    </div>
                  </div>
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
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 m-auto">
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
      </main>

      {/* Alternative Revenue */}
      <div className="p-4 md:p-8">
        <AlternativeRevenueForm />
      </div>
    </div>
  );
}
