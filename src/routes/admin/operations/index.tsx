import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useRef, useMemo, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { SignedMinioLink } from "~/components/SignedMinioUrl";
import {
  OTHER_SERVICE_TYPE_VALUE,
  resolveServiceType,
  splitServiceType,
} from "~/utils/serviceTypeOther";
import {
  ArrowLeft,
  Plus,
  Search,
  ClipboardList,
  Phone,
  Mail,
  MapPin,
  Calendar,
  User,
  Wrench,
  Download,
  Upload,
  FileText,
  Loader2,
  Sparkles,
  Target,
  TrendingUp,
  Award,
  AlertTriangle,
  X,
  Receipt,
  ExternalLink,
  DollarSign,
} from "lucide-react";
import { FileAttachment } from "~/components/FileAttachment";
import { OperationalExpenseForm } from "~/components/OperationalExpenseForm";

export const Route = createFileRoute("/admin/operations/")({
  component: OperationsPage,
});

const orderSchema = z
  .object({
    orderNumber: z.preprocess(
      (val) => (val === "" ? undefined : val),
      z.string().min(1).optional()
    ),
    customerName: z.string().min(1, "Customer name is required"),
    customerEmail: z.string().email("Invalid email address"),
    customerPhone: z.string().min(1, "Phone number is required"),
    address: z.string().min(1, "Address is required"),
    serviceType: z.string().min(1, "Service type is required"),
    otherServiceType: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    assignedToId: z.number().optional(),
    callOutFee: z.number().default(0),
    labourRate: z.number().optional(),
    totalMaterialBudget: z.number().optional(),
    numLabourersNeeded: z.number().int().optional(),
    totalLabourCostBudget: z.number().optional(),
    notes: z.string().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.serviceType === OTHER_SERVICE_TYPE_VALUE) {
      if (!v.otherServiceType || !v.otherServiceType.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Please specify the service type",
          path: ["otherServiceType"],
        });
      }
    }
  });

type OrderForm = z.infer<typeof orderSchema>;

const serviceTypeOptions = [
  "Painting",
  "Plumbing",
  "Electrical",
  "Construction",
  "General Maintenance",
] as const;

const orderStatuses = [
  { value: "PENDING", label: "Pending", color: "bg-gray-100 text-gray-800" },
  { value: "ASSIGNED", label: "Assigned", color: "bg-yellow-100 text-yellow-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

function OperationsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [selectedOrderForDocs, setSelectedOrderForDocs] = useState<number | null>(null);
  const [selectedOrderForPdf, setSelectedOrderForPdf] = useState<number | null>(null);
  const [downloadingJobCardId, setDownloadingJobCardId] = useState<number | null>(null);
  const [downloadingMergedPdfId, setDownloadingMergedPdfId] = useState<number | null>(null);
  const [editingOrder, setEditingOrder] = useState<number | null>(null);
  const [pendingDocuments, setPendingDocuments] = useState<string[]>([]);
  const [classifyingService, setClassifyingService] = useState(false);
  const [suggestingArtisan, setSuggestingArtisan] = useState(false);
  const [artisanSuggestions, setArtisanSuggestions] = useState<any>(null);
  const [showArtisanSuggestions, setShowArtisanSuggestions] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [materials, setMaterials] = useState<Array<{
    name: string;
    description: string;
    quantity: string;
    unitPrice: string;
    supplier: string;
    supplierQuotationUrl: string;
    supplierQuotationAmount: string;
  }>>([]);
  const [uploadingMaterialQuotation, setUploadingMaterialQuotation] = useState<number | null>(null);

  const ordersQuery = useQuery(
    trpc.getOrders.queryOptions({
      token: token!,
    })
  );

  const artisansQuery = useQuery(
    trpc.getArtisans.queryOptions({
      token: token!,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    setValue,
    watch,
  } = useForm<OrderForm>({
    resolver: zodResolver(orderSchema),
  });

  const createOrderMutation = useMutation(
    trpc.createOrder.mutationOptions({
      onSuccess: () => {
        toast.success("Order created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        reset();
        setShowAddForm(false);
        setPendingDocuments([]);
        setMaterials([]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create order");
      },
    })
  );

  const updateOrderDetailsMutation = useMutation(
    trpc.updateOrderDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Order updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        reset();
        setShowAddForm(false);
        setEditingOrder(null);
        setMaterials([]);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update order");
      },
    })
  );

  const uploadDocumentsMutation = useMutation(
    trpc.uploadOrderDocuments.mutationOptions({
      onSuccess: () => {
        toast.success("Documents uploaded successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        setSelectedOrderForDocs(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to upload documents");
      },
    })
  );

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const generatePdfQuery = useMutation(
    trpc.generateOrderPdf.mutationOptions({
      onSuccess: (data) => {
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
        link.download = `order-${selectedOrderForPdf}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("PDF downloaded successfully!");
        setSelectedOrderForPdf(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate PDF");
      },
    })
  );

  const generateOrderPdfRawMutation = useMutation(trpc.generateOrderPdf.mutationOptions());
  const generateJobCardPdfMutation = useMutation(trpc.generateJobCardPdf.mutationOptions());
  const generateInvoicePdfMutation = useMutation(trpc.generateInvoicePdf.mutationOptions());

  const base64ToUint8Array = (base64: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Uint8Array(byteNumbers);
  };

  const downloadPdfBytes = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes], { type: "application/pdf" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  };

  const handleDownloadJobCard = async (orderId: number) => {
    setDownloadingJobCardId(orderId);
    try {
      const jobCardData = await generateJobCardPdfMutation.mutateAsync({
        token: token!,
        orderId,
      });
      downloadPdfBytes(base64ToUint8Array(jobCardData.pdf), `job-card-${orderId}.pdf`);
      toast.success("Job card downloaded successfully!");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to download job card");
    } finally {
      setDownloadingJobCardId(null);
    }
  };

  const handleDownloadMergedPdf = async (order: any) => {
    if (!order?.invoice?.id) {
      toast.error("No invoice found for this order");
      return;
    }

    setDownloadingMergedPdfId(order.id);
    const toastId = toast.loading("Preparing combined PDF...");
    try {
      const [{ PDFDocument }] = await Promise.all([import("pdf-lib")]);

      const [invoicePdf, orderPdf, jobCardPdf] = await Promise.all([
        generateInvoicePdfMutation.mutateAsync({ token: token!, invoiceId: order.invoice.id }),
        generateOrderPdfRawMutation.mutateAsync({ token: token!, orderId: order.id, isPMOrder: false }),
        generateJobCardPdfMutation.mutateAsync({ token: token!, orderId: order.id, isPMOrder: false }),
      ]);

      const merged = await PDFDocument.create();

      const append = async (base64: string) => {
        const src = await PDFDocument.load(base64ToUint8Array(base64));
        const pages = await merged.copyPages(src, src.getPageIndices());
        pages.forEach((p) => merged.addPage(p));
      };

      // Required order: Invoice (top) -> Customer Order Summary -> Job Card
      await append(invoicePdf.pdf);
      await append(orderPdf.pdf);
      await append(jobCardPdf.pdf);

      const bytes = await merged.save();
      downloadPdfBytes(bytes, `invoice-order-jobcard-${order.invoice.invoiceNumber || order.id}.pdf`);
      toast.success("Combined PDF downloaded!", { id: toastId });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to generate combined PDF", { id: toastId });
    } finally {
      setDownloadingMergedPdfId(null);
    }
  };

  const classifyServiceMutation = useMutation(
    trpc.classifyServiceType.mutationOptions({
      onSuccess: (data) => {
        setValue("serviceType", data.suggestedServiceType);
        setValue("otherServiceType", "");
        toast.success(`Service type suggested: ${data.suggestedServiceType}`);
        setClassifyingService(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to classify service type");
        setClassifyingService(false);
      },
    })
  );

  const suggestArtisanQuery = useMutation(
    trpc.suggestArtisanForJob.mutationOptions({
      onSuccess: (data) => {
        setArtisanSuggestions(data);
        setShowArtisanSuggestions(true);
        
        // Auto-select the top-ranked artisan (first in the array)
        if (data.rankedArtisans && data.rankedArtisans.length > 0) {
          const topArtisan = data.rankedArtisans[0];
          setValue("assignedToId", topArtisan.artisanId);
          toast.success(`Top match: ${topArtisan.artisan?.firstName} ${topArtisan.artisan?.lastName} (${topArtisan.matchScore}/100)`);
        }
        
        setSuggestingArtisan(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to suggest artisans");
        setSuggestingArtisan(false);
      },
    })
  );

  // Watch description field for auto-classification
  const description = watch("description");
  const address = watch("address");
  const serviceType = watch("serviceType");

  // Auto-classify service type when description is entered
  useEffect(() => {
    // Only auto-classify if:
    // 1. Form is shown (user is actively filling it)
    // 2. Description has sufficient length (at least 20 chars for better accuracy)
    // 3. Service type is not already set
    // 4. Not already classifying
    // 5. Not editing an existing order
    if (
      showAddForm &&
      !editingOrder &&
      description &&
      description.trim().length >= 20 &&
      !getValues("serviceType") &&
      !classifyingService
    ) {
      const timeoutId = setTimeout(() => {
        setClassifyingService(true);
        classifyServiceMutation.mutate({
          token: token!,
          description,
          address: address || undefined,
        });
      }, 1500); // Debounce for 1.5 seconds

      return () => clearTimeout(timeoutId);
    }
  }, [description, address, showAddForm, editingOrder]);

  const addMaterial = () => {
    setMaterials([...materials, {
      name: "",
      description: "",
      quantity: "1",
      unitPrice: "0",
      supplier: "",
      supplierQuotationUrl: "",
      supplierQuotationAmount: "",
    }]);
  };

  const removeMaterial = (index: number) => {
    setMaterials(materials.filter((_, i) => i !== index));
  };

  const updateMaterial = (index: number, field: string, value: string) => {
    const newMaterials = [...materials];
    newMaterials[index] = { ...newMaterials[index], [field]: value };
    setMaterials(newMaterials);
  };

  const handleMaterialQuotationUpload = async (index: number, file: File) => {
    try {
      setUploadingMaterialQuotation(index);
      
      const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
        token: token!,
        fileName: file.name,
        fileType: file.type,
      });

      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload ${file.name}`);
      }

      updateMaterial(index, "supplierQuotationUrl", fileUrl);
      toast.success("Supplier quotation uploaded!");
      setUploadingMaterialQuotation(null);
    } catch (error) {
      console.error("Error uploading quotation:", error);
      toast.error("Failed to upload supplier quotation");
      setUploadingMaterialQuotation(null);
    }
  };

  const calculateTotalMaterialCost = () => {
    return materials.reduce((sum, material) => {
      const qty = parseFloat(material.quantity) || 0;
      const price = parseFloat(material.unitPrice) || 0;
      return sum + (qty * price);
    }, 0);
  };

  const handleEditOrder = (order: any) => {
    setEditingOrder(order.id);
    setShowAddForm(true);
    setPendingDocuments([]);
    
    const split = splitServiceType(order.serviceType, serviceTypeOptions);

    // Populate form fields
    reset({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      customerEmail: order.customerEmail,
      customerPhone: order.customerPhone,
      address: order.address,
      serviceType: split.serviceType,
      otherServiceType: split.otherServiceType,
      description: order.description,
      assignedToId: order.assignedToId || undefined,
      callOutFee: order.callOutFee,
      labourRate: order.labourRate || undefined,
      totalMaterialBudget: order.totalMaterialBudget || undefined,
      numLabourersNeeded: order.numLabourersNeeded || undefined,
      totalLabourCostBudget: order.totalLabourCostBudget || undefined,
      notes: order.notes || "",
    });
    
    // Populate materials if they exist
    if (order.materials && order.materials.length > 0) {
      setMaterials(order.materials.map((m: any) => ({
        name: m.name,
        description: m.description || "",
        quantity: m.quantity.toString(),
        unitPrice: m.unitPrice.toString(),
        supplier: m.supplier || "",
        supplierQuotationUrl: m.supplierQuotationUrl || "",
        supplierQuotationAmount: m.supplierQuotationAmount?.toString() || "",
      })));
    } else {
      setMaterials([]);
    }
  };

  const handleClassifyService = () => {
    const description = getValues("description");
    const address = getValues("address");
    
    if (!description || description.trim().length < 10) {
      toast.error("Please enter a detailed description first (at least 10 characters)");
      return;
    }

    setClassifyingService(true);
    classifyServiceMutation.mutate({
      token: token!,
      description,
      address: address || undefined,
    });
  };

  const handleSuggestArtisan = () => {
    const serviceType = getValues("serviceType");
    const description = getValues("description");
    const address = getValues("address");
    
    if (!serviceType) {
      toast.error("Please select a service type first");
      return;
    }
    
    if (!description || description.trim().length < 10) {
      toast.error("Please enter a detailed description first");
      return;
    }

    setSuggestingArtisan(true);
    suggestArtisanQuery.mutate({
      token: token!,
      serviceType,
      description,
      address: address || undefined,
    });
  };

  const handleSelectSuggestedArtisan = (artisanId: number) => {
    setValue("assignedToId", artisanId);
    setShowArtisanSuggestions(false);
    toast.success("Artisan selected!");
  };

  const handlePendingDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setUploadingDocs(true);
      const documentUrls: string[] = [];

      for (const file of files) {
        const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
          token: token!,
          fileName: file.name,
          fileType: file.type,
        });

        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        documentUrls.push(fileUrl);
      }

      setPendingDocuments([...pendingDocuments, ...documentUrls]);
      toast.success("Documents uploaded successfully!");
      setUploadingDocs(false);
      
      // Clear the file input
      if (e.target) {
        e.target.value = "";
      }
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast.error("Failed to upload documents");
      setUploadingDocs(false);
    }
  };

  const handleRemovePendingDocument = (index: number) => {
    setPendingDocuments(pendingDocuments.filter((_, i) => i !== index));
  };

  const handleDocumentUpload = async (e: React.ChangeEvent<HTMLInputElement>, orderId: number) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    try {
      setUploadingDocs(true);
      const documentUrls: string[] = [];

      for (const file of files) {
        const { presignedUrl, fileUrl } = await getPresignedUrlMutation.mutateAsync({
          token: token!,
          fileName: file.name,
          fileType: file.type,
        });

        const uploadResponse = await fetch(presignedUrl, {
          method: "PUT",
          body: file,
          headers: {
            "Content-Type": file.type,
          },
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload ${file.name}`);
        }

        documentUrls.push(fileUrl);
      }

      uploadDocumentsMutation.mutate({
        token: token!,
        orderId,
        documentUrls,
      });

      setUploadingDocs(false);
    } catch (error) {
      console.error("Error uploading documents:", error);
      toast.error("Failed to upload documents");
      setUploadingDocs(false);
    }
  };

  const handleExportPdf = (orderId: number) => {
    setSelectedOrderForPdf(orderId);
    generatePdfQuery.mutate({
      token: token!,
      orderId,
    });
  };

  const onSubmit = (data: OrderForm) => {
    const resolvedServiceType = resolveServiceType(data.serviceType, data.otherServiceType);

    if (!resolvedServiceType) {
      toast.error("Please select or specify a service type");
      return;
    }

    const { otherServiceType: _otherServiceType, ...rest } = data;

    // Prepare materials data
    const materialsData = materials.length > 0 ? materials.map(m => ({
      name: m.name,
      description: m.description || undefined,
      quantity: parseFloat(m.quantity) || 0,
      unitPrice: parseFloat(m.unitPrice) || 0,
      supplier: m.supplier || undefined,
      supplierQuotationUrl: m.supplierQuotationUrl || undefined,
      supplierQuotationAmount: m.supplierQuotationAmount ? parseFloat(m.supplierQuotationAmount) : undefined,
    })) : undefined;

    if (editingOrder) {
      updateOrderDetailsMutation.mutate({
        token: token!,
        orderId: editingOrder,
        orderNumber: rest.orderNumber,
        ...rest,
        serviceType: resolvedServiceType,
        assignedToId: data.assignedToId ? Number(data.assignedToId) : null,
        callOutFee: Number(data.callOutFee) || 0,
        labourRate: data.labourRate ? Number(data.labourRate) : null,
        totalMaterialBudget: data.totalMaterialBudget ? Number(data.totalMaterialBudget) : undefined,
        numLabourersNeeded: data.numLabourersNeeded ? Number(data.numLabourersNeeded) : undefined,
        totalLabourCostBudget: data.totalLabourCostBudget ? Number(data.totalLabourCostBudget) : undefined,
        notes: data.notes || undefined,
        materials: materialsData,
      });
    } else {
      createOrderMutation.mutate({
        token: token!,
        ...rest,
        serviceType: resolvedServiceType,
        assignedToId: data.assignedToId ? Number(data.assignedToId) : undefined,
        callOutFee: Number(data.callOutFee) || 0,
        labourRate: data.labourRate ? Number(data.labourRate) : undefined,
        totalMaterialBudget: data.totalMaterialBudget ? Number(data.totalMaterialBudget) : undefined,
        numLabourersNeeded: data.numLabourersNeeded ? Number(data.numLabourersNeeded) : undefined,
        totalLabourCostBudget: data.totalLabourCostBudget ? Number(data.totalLabourCostBudget) : undefined,
        documentUrls: pendingDocuments.length > 0 ? pendingDocuments : undefined,
        notes: data.notes || undefined,
        materials: materialsData,
      });
    }
  };

  const orders = ordersQuery.data || [];
  const artisans = artisansQuery.data || [];
  
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    orderStatuses.forEach(status => {
      counts[status.value] = orders.filter((o) => o.status === status.value).length;
    });
    return counts;
  }, [orders]);
  
  const filteredOrders = useMemo(() => {
    let filtered = orders;
    
    // Apply status filter first
    if (statusFilter) {
      filtered = filtered.filter(order => order.status === statusFilter);
    }
    
    // Apply search filter
    if (searchTerm.trim()) {
      const query = searchTerm.toLowerCase();
      filtered = filtered.filter(order =>
        order.orderNumber.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.address.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [orders, statusFilter, searchTerm]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
              <div className="bg-gradient-to-br from-green-600 to-green-700 p-2 rounded-xl shadow-md">
                <ClipboardList className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Operations Management</h1>
                <p className="text-sm text-gray-600">{orders.length} total orders</p>
              </div>
            </div>
            <button
              onClick={() => {
                setShowAddForm(!showAddForm);
                if (showAddForm) {
                  setEditingOrder(null);
                  setPendingDocuments([]);
                  setMaterials([]);
                  reset();
                }
              }}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              New Order
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
              placeholder="Search by order number, customer name or service type..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
          
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setStatusFilter(null)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                !statusFilter
                  ? "bg-green-600 text-white shadow-md"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              ALL ({orders.length})
            </button>
            {orderStatuses.map((status) => (
              <button
                key={status.value}
                onClick={() => setStatusFilter(statusFilter === status.value ? null : status.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  statusFilter === status.value
                    ? "bg-green-600 text-white shadow-md"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {status.label.toUpperCase()} ({statusCounts[status.value] || 0})
              </button>
            ))}
          </div>
        </div>

        {/* Add Order Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingOrder ? "Edit Order" : "Create New Order"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  {...register("customerName")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="John Doe"
                />
                {errors.customerName && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Order Number
                </label>
                <input
                  type="text"
                  {...register("orderNumber")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Leave empty to auto-generate"
                />
                <p className="mt-1 text-xs text-gray-500">
                  {editingOrder 
                    ? "You can edit this number if needed. It must be unique."
                    : "Optional: Enter a custom number or leave empty to auto-generate."
                  }
                </p>
                {errors.orderNumber && (
                  <p className="mt-1 text-sm text-red-600">{errors.orderNumber.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  {...register("customerEmail")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="john@example.com"
                />
                {errors.customerEmail && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerEmail.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone *
                </label>
                <input
                  type="text"
                  {...register("customerPhone")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="+27 123 456 789"
                />
                {errors.customerPhone && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerPhone.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Service Type *
                </label>
                <div className="flex space-x-2">
                  <select
                    {...register("serviceType")}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Select service</option>
                    {serviceTypeOptions.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value={OTHER_SERVICE_TYPE_VALUE}>Other</option>
                  </select>
                  <button
                    type="button"
                    onClick={handleClassifyService}
                    disabled={classifyingService}
                    className="px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center whitespace-nowrap"
                    title="AI-powered service classification (auto-triggers after typing)"
                  >
                    {classifyingService ? (
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
                {errors.serviceType && (
                  <p className="mt-1 text-sm text-red-600">{errors.serviceType.message}</p>
                )}
                {serviceType === OTHER_SERVICE_TYPE_VALUE && (
                  <div className="mt-2">
                    <input
                      type="text"
                      {...register("otherServiceType")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                      placeholder="Specify service type"
                    />
                    {errors.otherServiceType && (
                      <p className="mt-1 text-sm text-red-600">{errors.otherServiceType.message}</p>
                    )}
                  </div>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  {...register("address")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="123 Main St, City"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Artisan
                </label>
                <div className="flex space-x-2">
                  <select
                    {...register("assignedToId", { valueAsNumber: true })}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  >
                    <option value="">Unassigned</option>
                    {artisans.map((artisan) => (
                      <option key={artisan.id} value={artisan.id}>
                        {artisan.firstName} {artisan.lastName}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleSuggestArtisan}
                    disabled={suggestingArtisan}
                    className="px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50 inline-flex items-center whitespace-nowrap"
                    title="AI-powered artisan matching (auto-selects best match)"
                  >
                    {suggestingArtisan ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        AI...
                      </>
                    ) : (
                      <>
                        <Target className="h-4 w-4 mr-1" />
                        AI
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Call Out Fee (R)
                </label>
                <input
                  type="number"
                  {...register("callOutFee", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="500"
                  defaultValue={0}
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labour Rate (R/hour)
                </label>
                <input
                  type="number"
                  {...register("labourRate", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="250"
                  step="0.01"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Material Budget (R)
                </label>
                <input
                  type="number"
                  {...register("totalMaterialBudget", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="5000"
                  step="0.01"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Budget for materials - visible to artisan
                </p>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Number of Labourers Needed
                </label>
                <input
                  type="number"
                  {...register("numLabourersNeeded", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="2"
                  step="1"
                  min="1"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Expected number of labourers - visible to artisan
                </p>
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Total Labour Cost Budget (R)
                </label>
                <input
                  type="number"
                  {...register("totalLabourCostBudget", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="2000"
                  step="0.01"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Budget for labour costs - visible to artisan
                </p>
              </div>

              {/* Materials Section */}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Material Items</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Add specific materials needed for this job with supplier details
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMaterial}
                    className="inline-flex items-center px-3 py-1.5 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                  >
                    <Plus className="h-4 w-4 mr-1" />
                    Add Material
                  </button>
                </div>

                {materials.length > 0 && (
                  <div className="space-y-4">
                    {materials.map((material, index) => (
                      <div key={index} className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                        <div className="flex items-start justify-between mb-3">
                          <span className="text-sm font-medium text-gray-700">Material #{index + 1}</span>
                          <button
                            type="button"
                            onClick={() => removeMaterial(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-5 w-5" />
                          </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Material Name *
                            </label>
                            <input
                              type="text"
                              value={material.name}
                              onChange={(e) => updateMaterial(index, "name", e.target.value)}
                              placeholder="e.g., Cement bags"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Supplier
                            </label>
                            <input
                              type="text"
                              value={material.supplier}
                              onChange={(e) => updateMaterial(index, "supplier", e.target.value)}
                              placeholder="e.g., BuildMart"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Quantity *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={material.quantity}
                              onChange={(e) => updateMaterial(index, "quantity", e.target.value)}
                              placeholder="0"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Unit Price (R) *
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={material.unitPrice}
                              onChange={(e) => updateMaterial(index, "unitPrice", e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={material.description}
                              onChange={(e) => updateMaterial(index, "description", e.target.value)}
                              placeholder="Additional details"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Supplier Quotation Amount (R)
                            </label>
                            <input
                              type="number"
                              min="0"
                              step="0.01"
                              value={material.supplierQuotationAmount}
                              onChange={(e) => updateMaterial(index, "supplierQuotationAmount", e.target.value)}
                              placeholder="0.00"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Supplier Quotation Document
                            </label>
                            {material.supplierQuotationUrl ? (
                              <div className="flex items-center space-x-2">
                                <SignedMinioLink
                                  url={material.supplierQuotationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 px-3 py-2 text-sm bg-green-50 border border-green-200 rounded-lg text-green-700 hover:bg-green-100 transition-colors flex items-center"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Quotation
                                </SignedMinioLink>
                                <button
                                  type="button"
                                  onClick={() => updateMaterial(index, "supplierQuotationUrl", "")}
                                  className="p-2 text-red-600 hover:text-red-700"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            ) : (
                              <label className="w-full flex items-center justify-center px-3 py-2 text-sm border-2 border-dashed border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                                {uploadingMaterialQuotation === index ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Uploading...
                                  </>
                                ) : (
                                  <>
                                    <Upload className="h-4 w-4 mr-2" />
                                    Upload
                                  </>
                                )}
                                <input
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleMaterialQuotationUpload(index, file);
                                    }
                                  }}
                                  className="hidden"
                                  disabled={uploadingMaterialQuotation !== null}
                                />
                              </label>
                            )}
                          </div>

                          <div className="md:col-span-2 bg-white border border-gray-200 rounded p-2">
                            <div className="flex justify-between text-sm">
                              <span className="text-gray-600">Total Cost:</span>
                              <span className="font-semibold text-gray-900">
                                R{((parseFloat(material.quantity) || 0) * (parseFloat(material.unitPrice) || 0)).toFixed(2)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-blue-900">Total Material Cost:</span>
                        <span className="text-blue-900">R{calculateTotalMaterialCost().toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {materials.length === 0 && (
                  <div className="text-center py-8 bg-gray-50 border border-gray-200 rounded-lg">
                    <p className="text-sm text-gray-600">No materials added yet</p>
                    <p className="text-xs text-gray-500 mt-1">Click "Add Material" to specify materials needed</p>
                  </div>
                )}
              </div>

              {/* Document Upload Section - Only for new orders */}
              {!editingOrder && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Order Documents (Optional)
                  </label>
                  <p className="text-xs text-gray-600 mb-2">
                    Upload documents that the artisan will need to complete this job (e.g., specifications, diagrams, client instructions)
                  </p>
                  
                  <label className="w-full flex items-center justify-center px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                    {uploadingDocs ? (
                      <>
                        <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-5 w-5 mr-2" />
                        Upload Documents
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx,.jpg,.jpeg,.png"
                      onChange={handlePendingDocumentUpload}
                      className="hidden"
                      disabled={uploadingDocs}
                    />
                  </label>
                  
                  {/* Display uploaded documents */}
                  {pendingDocuments.length > 0 && (
                    <div className="mt-3 space-y-2">
                      <p className="text-xs font-medium text-gray-700">Uploaded Documents:</p>
                      {pendingDocuments.map((docUrl, idx) => (
                        <div key={idx} className="flex items-center space-x-2">
                          <div className="flex-1">
                            <FileAttachment url={docUrl} isOwnMessage={false} />
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemovePendingDocument(idx)}
                            className="text-red-600 hover:text-red-700 text-xs font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Describe the work to be done..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Job Notes (Optional)
                </label>
                <textarea
                  {...register("notes")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="Add notes about job progress, issues, or requirements..."
                />
                <p className="mt-1 text-xs text-gray-500">
                  Internal notes visible to admins and the assigned artisan
                </p>
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingOrder(null);
                    setPendingDocuments([]);
                    setMaterials([]);
                    reset();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createOrderMutation.isPending || updateOrderDetailsMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {editingOrder 
                    ? (updateOrderDetailsMutation.isPending ? "Updating..." : "Update Order")
                    : (createOrderMutation.isPending ? "Creating..." : "Create Order")
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Artisan Suggestions Modal */}
        {showArtisanSuggestions && artisanSuggestions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-gray-900 flex items-center">
                    <Target className="h-6 w-6 mr-2 text-purple-600" />
                    AI Artisan Recommendations
                  </h2>
                  <button
                    onClick={() => setShowArtisanSuggestions(false)}
                    className="text-gray-400 hover:text-gray-600"
                  >
                    <X className="h-6 w-6" />
                  </button>
                </div>

                {/* Overall Recommendation */}
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 mb-6">
                  <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center">
                    <Sparkles className="h-4 w-4 mr-1" />
                    Overall Recommendation
                  </p>
                  <p className="text-sm text-purple-800">{artisanSuggestions.overallRecommendation}</p>
                </div>

                {/* Ranked Artisans */}
                <div className="space-y-4">
                  {artisanSuggestions.rankedArtisans.map((ranked: any, idx: number) => (
                    <div
                      key={ranked.artisanId}
                      className={`border rounded-lg p-4 ${
                        idx === 0
                          ? "border-green-300 bg-green-50"
                          : idx === 1
                          ? "border-blue-300 bg-blue-50"
                          : "border-gray-200 bg-white"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center space-x-3">
                          <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                            idx === 0
                              ? "bg-green-600 text-white"
                              : idx === 1
                              ? "bg-blue-600 text-white"
                              : "bg-gray-600 text-white"
                          } font-bold text-sm`}>
                            #{idx + 1}
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">
                              {ranked.artisan.firstName} {ranked.artisan.lastName}
                            </h3>
                            <p className="text-sm text-gray-600">
                              {ranked.artisan.completedOrders} completed jobs • {ranked.artisan.activeOrders} active
                            </p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end space-y-2">
                          <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                            ranked.matchScore >= 80
                              ? "bg-green-100 text-green-800"
                              : ranked.matchScore >= 60
                              ? "bg-blue-100 text-blue-800"
                              : "bg-gray-100 text-gray-800"
                          }`}>
                            <Award className="h-4 w-4 mr-1" />
                            {ranked.matchScore}/100
                          </span>
                          <button
                            onClick={() => handleSelectSuggestedArtisan(ranked.artisanId)}
                            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                              idx === 0
                                ? "bg-green-600 hover:bg-green-700 text-white"
                                : "bg-gray-600 hover:bg-gray-700 text-white"
                            }`}
                          >
                            Select
                          </button>
                        </div>
                      </div>

                      <div className="mb-3">
                        <p className="text-sm text-gray-700">{ranked.reasoning}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Strengths */}
                        {ranked.strengths && ranked.strengths.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-xs font-semibold text-green-900 mb-2 flex items-center">
                              <TrendingUp className="h-3 w-3 mr-1" />
                              Strengths
                            </p>
                            <ul className="space-y-1">
                              {ranked.strengths.map((strength: string, sIdx: number) => (
                                <li key={sIdx} className="text-xs text-gray-700 flex items-start">
                                  <span className="text-green-600 mr-1">✓</span>
                                  <span>{strength}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Concerns */}
                        {ranked.concerns && ranked.concerns.length > 0 && (
                          <div className="bg-white rounded-lg p-3 border border-gray-200">
                            <p className="text-xs font-semibold text-amber-900 mb-2 flex items-center">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Considerations
                            </p>
                            <ul className="space-y-1">
                              {ranked.concerns.map((concern: string, cIdx: number) => (
                                <li key={cIdx} className="text-xs text-gray-700 flex items-start">
                                  <span className="text-amber-600 mr-1">!</span>
                                  <span>{concern}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>

                      {/* Artisan Details */}
                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-gray-600">
                          {ranked.artisan.hourlyRate && (
                            <div>
                              <span className="font-medium">Hourly Rate:</span> R{ranked.artisan.hourlyRate}
                            </div>
                          )}
                          {ranked.artisan.dailyRate && (
                            <div>
                              <span className="font-medium">Daily Rate:</span> R{ranked.artisan.dailyRate}
                            </div>
                          )}
                          {ranked.artisan.phone && (
                            <div>
                              <span className="font-medium">Phone:</span> {ranked.artisan.phone}
                            </div>
                          )}
                          <div>
                            <span className="font-medium">Email:</span> {ranked.artisan.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setShowArtisanSuggestions(false)}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <div className="w-full flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search orders by number, customer, or service..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
            </div>
            {statusFilter && (
              <button
                onClick={() => setStatusFilter(null)}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                Clear Filter
              </button>
            )}
          </div>
        </div>

        {/* Orders List */}
        <div className="space-y-4">
          {filteredOrders.map((order) => (
            <div key={order.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-6">
                <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{order.orderNumber}</h3>
                      <span
                        className={`px-3 py-1 rounded-full text-sm font-medium ${
                          orderStatuses.find((s) => s.value === order.status)?.color
                        }`}
                      >
                        {orderStatuses.find((s) => s.value === order.status)?.label}
                      </span>
                    </div>

                    <div className="text-sm font-medium text-gray-700 mb-3">{order.customerName}</div>

                    <div className="space-y-2">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                        <div className="flex items-center text-gray-600">
                          <Mail className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="break-all">{order.customerEmail}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Phone className="h-4 w-4 mr-2 text-blue-600" />
                          <span>{order.customerPhone}</span>
                        </div>
                        <div className="flex items-center text-gray-600 sm:col-span-2">
                          <MapPin className="h-4 w-4 mr-2 text-blue-600" />
                          <span>{order.address}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Wrench className="h-4 w-4 mr-2 text-blue-600" />
                          <span>{order.serviceType}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <DollarSign className="h-4 w-4 mr-2 text-blue-600" />
                          <span className="font-semibold">R {order.totalCost.toLocaleString()}</span>
                        </div>
                        <div className="flex items-center text-gray-600">
                          <Calendar className="h-4 w-4 mr-2 text-blue-600" />
                          <span>{new Date(order.createdAt).toLocaleDateString()}</span>
                        </div>
                        {order.assignedTo && (
                          <div className="flex items-center text-gray-600">
                            <User className="h-4 w-4 mr-2 text-blue-600" />
                            <span>Assigned to {order.assignedTo.firstName} {order.assignedTo.lastName}</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {order.description && (
                      <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                        <p className="text-xs font-semibold text-gray-700 mb-1">Description:</p>
                        <p className="text-sm text-gray-600">{order.description}</p>
                      </div>
                    )}

                {order.notes && (
                  <div className="mt-3 p-3 bg-amber-50 rounded-lg">
                    <p className="text-xs font-semibold text-amber-700 mb-1">Notes:</p>
                    <p className="text-sm text-amber-900">{order.notes}</p>
                  </div>
                )}

                {/* Display materials */}
                {order.materials && order.materials.length > 0 && (
                  <div className="mt-3 bg-green-50 border border-green-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-green-900 mb-2 flex items-center">
                      <FileText className="h-4 w-4 mr-1" />
                      Materials ({order.materials.length})
                    </p>
                    <div className="space-y-2">
                      {order.materials.map((material: any, idx: number) => (
                        <div key={idx} className="bg-white rounded p-2 text-xs">
                          <div className="flex items-start justify-between mb-1">
                            <div className="flex-1">
                              <span className="font-semibold text-green-900">{material.name}</span>
                              {material.supplier && (
                                <span className="text-gray-600 ml-2">from {material.supplier}</span>
                              )}
                            </div>
                            <span className="font-bold text-green-900 ml-2">
                              R{material.totalCost.toFixed(2)}
                            </span>
                          </div>
                          <div className="text-gray-600">
                            Qty: {material.quantity} × R{material.unitPrice.toFixed(2)}
                          </div>
                          {material.description && (
                            <div className="text-gray-600 mt-1">{material.description}</div>
                          )}
                          {material.supplierQuotationUrl && (
                            <a
                              href={material.supplierQuotationUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center text-green-700 hover:text-green-800 mt-1"
                            >
                              <ExternalLink className="h-3 w-3 mr-1" />
                              View Supplier Quotation
                              {material.supplierQuotationAmount && (
                                <span className="ml-1">(R{material.supplierQuotationAmount.toFixed(2)})</span>
                              )}
                            </a>
                          )}
                        </div>
                      ))}
                      <div className="border-t border-green-300 pt-2 mt-2">
                        <div className="flex justify-between text-sm font-bold text-green-900">
                          <span>Total Materials Cost:</span>
                          <span>
                            R{order.materials
                              .reduce((sum: number, m: any) => sum + m.totalCost, 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Display uploaded documents */}
                {order.documents && order.documents.length > 0 && (
                  <div className="mt-3">
                    <p className="text-xs font-medium text-gray-700 mb-2">Attached Documents:</p>
                    <div className="space-y-1">
                      {order.documents.map((docUrl, idx) => (
                        <FileAttachment key={idx} url={docUrl} isOwnMessage={false} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Display expense slips */}
                {order.expenseSlips && order.expenseSlips.length > 0 && (
                  <div className="mt-3 bg-purple-50 border border-purple-200 rounded-lg p-3">
                    <p className="text-sm font-semibold text-purple-900 mb-2 flex items-center">
                      <Receipt className="h-4 w-4 mr-1" />
                      Expense Slips & Purchases
                    </p>
                    <div className="space-y-2">
                      {order.expenseSlips.map((slip: any, idx: number) => {
                        const categoryLabels: Record<string, string> = {
                          MATERIALS: "Materials",
                          TOOLS: "Tools",
                          TRANSPORTATION: "Transportation",
                          OTHER: "Other",
                        };
                        
                        return (
                          <div key={idx} className="bg-white rounded p-2 text-xs">
                            <div className="flex items-start justify-between mb-1">
                              <div className="flex-1">
                                <span className="font-semibold text-purple-900">
                                  {categoryLabels[slip.category] || slip.category}
                                </span>
                                {slip.description && (
                                  <span className="text-gray-600 ml-2">- {slip.description}</span>
                                )}
                              </div>
                              {slip.amount !== null && slip.amount !== undefined && (
                                <span className="font-bold text-purple-900 ml-2">
                                  R{slip.amount.toFixed(2)}
                                </span>
                              )}
                            </div>
                            <FileAttachment url={slip.url} isOwnMessage={false} />
                          </div>
                        );
                      })}
                      <div className="border-t border-purple-300 pt-2 mt-2">
                        <div className="flex justify-between text-sm font-bold text-purple-900">
                          <span>Total from Slips:</span>
                          <span>
                            R{order.expenseSlips
                              .reduce((sum: number, slip: any) => sum + (slip.amount || 0), 0)
                              .toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Invoice Status for Completed Orders */}
                {order.status === "COMPLETED" && order.invoice && (
                  <div className="mt-3 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <Receipt className="h-5 w-5 text-blue-600 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-semibold text-blue-900">
                            Invoice Auto-Generated
                          </p>
                          <p className="text-xs text-blue-700">
                            Invoice #{order.invoice.invoiceNumber} • Status: {order.invoice.status.replace('_', ' ')}
                          </p>
                        </div>
                      </div>
                      <Link
                        to="/admin/invoices/"
                        search={{ invoiceId: order.invoice.id }}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
                      >
                        View Invoice
                        <ExternalLink className="h-3 w-3 ml-1" />
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons Section */}
          <div className="border-t border-gray-200 bg-gray-50 px-4 sm:px-6 py-3">
                <div className="flex flex-wrap gap-2">
                  {/* Edit button - only show for PENDING and ASSIGNED orders (not yet started) */}
                  {(order.status === 'PENDING' || order.status === 'ASSIGNED') && (
                    <button
                      onClick={() => handleEditOrder(order)}
                      className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                    >
                      <Wrench className="h-4 w-4 mr-1" />
                      Edit
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleExportPdf(order.id)}
                    disabled={generatePdfQuery.isPending && selectedOrderForPdf === order.id}
                    className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {generatePdfQuery.isPending && selectedOrderForPdf === order.id ? (
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

                  {order.status === "COMPLETED" && (
                    <>
                      <button
                        onClick={() => handleDownloadJobCard(order.id)}
                        disabled={downloadingJobCardId === order.id}
                        className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-50"
                      >
                        {downloadingJobCardId === order.id ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                            Downloading...
                          </>
                        ) : (
                          <>
                            <Receipt className="h-4 w-4 mr-1" />
                            Job Card
                          </>
                        )}
                      </button>

                      {order.invoice && (
                        <button
                          onClick={() => handleDownloadMergedPdf(order)}
                          disabled={downloadingMergedPdfId === order.id}
                          className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          {downloadingMergedPdfId === order.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                              Preparing...
                            </>
                          ) : (
                            <>
                              <FileText className="h-4 w-4 mr-1" />
                              Invoice + Order + Job Card
                            </>
                          )}
                        </button>
                      )}
                    </>
                  )}
                  
                  <label className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors cursor-pointer">
                    {uploadingDocs && selectedOrderForDocs === order.id ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                        Uploading...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-1" />
                        Upload Document
                      </>
                    )}
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.doc,.docx"
                      onChange={(e) => {
                        setSelectedOrderForDocs(order.id);
                        handleDocumentUpload(e, order.id);
                      }}
                      className="hidden"
                      disabled={uploadingDocs}
                    />
                  </label>
                </div>
              </div>
            </div>
          ))}
          {filteredOrders.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Wrench className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No orders found</p>
            </div>
          )}
        </div>

        {/* Operational Expenses */}
        <div className="mt-8">
          <OperationalExpenseForm />
        </div>
      </main>
    </div>
  );
}

export default OperationsPage;
