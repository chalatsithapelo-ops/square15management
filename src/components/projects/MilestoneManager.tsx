import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC, useTRPCClient } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  Edit,
  Trash2,
  Upload,
  FileText,
  DollarSign,
  Calendar,
  Users,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  X,
  Loader2,
  ChevronDown,
  ChevronUp,
  Target,
  List,
  BarChart3,
  FileDown,
  Shield,
  Brain,
  TrendingDown,
  AlertOctagon,
} from "lucide-react";
import WeeklyBudgetTracker from "~/components/projects/WeeklyBudgetTracker";
import GanttChart from "~/components/projects/GanttChart";

interface MilestoneManagerProps {
  projectId: number;
  projectBudget?: number;
}

const milestoneSchema = z.object({
  name: z.string().min(1, "Milestone name is required"),
  description: z.string().min(1, "Description is required"),
  sequenceOrder: z.number().min(1),
  labourCost: z.number().min(0).default(0),
  materialCost: z.number().min(0).default(0),
  dieselCost: z.number().min(0).default(0),
  rentCost: z.number().min(0).default(0),
  adminCost: z.number().min(0).default(0),
  otherOperationalCost: z.number().min(0).default(0),
  expectedProfit: z.number().default(0),
  budgetAllocated: z.number().min(0).default(0),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  assignedToId: z.number().optional(),
  notes: z.string().optional(),
});

type MilestoneForm = z.infer<typeof milestoneSchema>;

const riskSchema = z.object({
  riskDescription: z.string().min(1, "Risk description is required"),
  riskCategory: z.enum(["TECHNICAL", "FINANCIAL", "SCHEDULE", "RESOURCE", "EXTERNAL"]),
  probability: z.enum(["LOW", "MEDIUM", "HIGH"]),
  impact: z.enum(["LOW", "MEDIUM", "HIGH"]),
  mitigationStrategy: z.string().optional(),
});

type RiskForm = z.infer<typeof riskSchema>;

const milestoneStatuses = [
  { value: "PLANNING", label: "Planning", color: "bg-gray-100 text-gray-800", icon: Clock },
  { value: "NOT_STARTED", label: "Not Started", color: "bg-blue-100 text-blue-800", icon: Clock },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-yellow-100 text-yellow-800", icon: TrendingUp },
  { value: "ON_HOLD", label: "On Hold", color: "bg-orange-100 text-orange-800", icon: AlertTriangle },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800", icon: X },
];

export default function MilestoneManager({ projectId, projectBudget }: MilestoneManagerProps) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const trpcClient = useTRPCClient();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState<number | null>(null);
  const [expandedMilestones, setExpandedMilestones] = useState<Set<number>>(new Set());
  const [expandedMilestoneTabs, setExpandedMilestoneTabs] = useState<Record<number, string>>({});
  const [uploadingQuotations, setUploadingQuotations] = useState<number | null>(null);
  const [deletingQuotationId, setDeletingQuotationId] = useState<number | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "gantt">("list");
  const [generatingReportId, setGeneratingReportId] = useState<number | null>(null);
  const [showRiskForm, setShowRiskForm] = useState<Record<number, boolean>>({});
  const [editingRisk, setEditingRisk] = useState<number | null>(null);
  const [showRiskAnalysisModal, setShowRiskAnalysisModal] = useState(false);
  const [riskAnalysisResults, setRiskAnalysisResults] = useState<any>(null);
  const [analyzingRisks, setAnalyzingRisks] = useState(false);
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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [paymentComments, setPaymentComments] = useState<Record<number, string>>({});

  const milestonesQuery = useQuery(
    trpc.getMilestonesByProject.queryOptions({
      token: token!,
      projectId,
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
    setValue,
    watch,
  } = useForm<MilestoneForm>({
    resolver: zodResolver(milestoneSchema),
  });

  const {
    register: registerRisk,
    handleSubmit: handleSubmitRisk,
    formState: { errors: riskErrors },
    reset: resetRisk,
    setValue: setRiskValue,
  } = useForm<RiskForm>({
    resolver: zodResolver(riskSchema),
  });

  // Auto-calculate material cost when materials change
  useEffect(() => {
    const totalMaterialCost = calculateTotalMaterialCost();
    setValue("materialCost", totalMaterialCost);
  }, [materials, setValue]);

  // Auto-calculate expected profit: Budget Allocated - (Material Cost + Labour Cost + Operational Costs)
  const budgetAllocated = watch("budgetAllocated");
  const materialCost = watch("materialCost");
  const labourCost = watch("labourCost");
  const dieselCost = watch("dieselCost");
  const rentCost = watch("rentCost");
  const adminCost = watch("adminCost");
  const otherOperationalCost = watch("otherOperationalCost");

  useEffect(() => {
    if (budgetAllocated !== undefined && materialCost !== undefined && labourCost !== undefined &&
        dieselCost !== undefined && rentCost !== undefined && adminCost !== undefined && 
        otherOperationalCost !== undefined) {
      const totalCosts = materialCost + labourCost + dieselCost + rentCost + adminCost + otherOperationalCost;
      const calculatedProfit = budgetAllocated - totalCosts;
      setValue("expectedProfit", calculatedProfit);
    }
  }, [budgetAllocated, materialCost, labourCost, dieselCost, rentCost, adminCost, otherOperationalCost, setValue]);

  const createMilestoneMutation = useMutation(
    trpc.createMilestone.mutationOptions({
      onSuccess: () => {
        toast.success("Milestone created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getProjects.queryKey() });
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create milestone");
      },
    })
  );

  const updateMilestoneMutation = useMutation(
    trpc.updateMilestone.mutationOptions({
      onSuccess: () => {
        toast.success("Milestone updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getProjects.queryKey() });
        reset();
        setShowAddForm(false);
        setEditingMilestone(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update milestone");
      },
    })
  );

  const uploadQuotationMutation = useMutation(
    trpc.uploadMilestoneSupplierQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Supplier quotation uploaded successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        setUploadingQuotations(null);
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to upload quotation");
      },
    })
  );

  const deleteQuotationMutation = useMutation(
    trpc.deleteMilestoneSupplierQuotation.mutationOptions({
      onSuccess: () => {
        toast.success("Supplier quotation deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        setDeletingQuotationId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete quotation");
      },
    })
  );

  const updatePaymentRequestStatusMutation = useMutation(
    trpc.updatePaymentRequestStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Payment request updated");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getProjects.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update payment request");
      },
    })
  );

  const generateMilestoneReportMutation = useMutation(
    trpc.generateMilestoneReportPdf.mutationOptions({
      onSuccess: (data, variables) => {
        // Convert base64 to blob and trigger download
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        
        // Find milestone name for filename
        const milestone = milestones.find(m => m.id === variables.milestoneId);
        const fileName = milestone 
          ? `milestone-report-${milestone.name.replace(/\s+/g, "-").toLowerCase()}-${new Date().toISOString().split("T")[0]}.pdf`
          : `milestone-report-${variables.milestoneId}-${new Date().toISOString().split("T")[0]}.pdf`;
        
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        
        toast.success("Milestone report downloaded successfully!");
        setGeneratingReportId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate milestone report");
        setGeneratingReportId(null);
      },
    })
  );

  const createRiskMutation = useMutation(
    trpc.createMilestoneRisk.mutationOptions({
      onSuccess: () => {
        toast.success("Risk created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        resetRisk();
        setShowRiskForm({});
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create risk");
      },
    })
  );

  const updateRiskMutation = useMutation(
    trpc.updateMilestoneRisk.mutationOptions({
      onSuccess: () => {
        toast.success("Risk updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
        setEditingRisk(null);
        resetRisk();
        setShowRiskForm({});
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update risk");
      },
    })
  );

  const deleteRiskMutation = useMutation(
    trpc.deleteMilestoneRisk.mutationOptions({
      onSuccess: () => {
        toast.success("Risk deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getMilestonesByProject.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete risk");
      },
    })
  );

  const analyzeProjectRisksMutation = useMutation(
    trpc.analyzeProjectRisks.mutationOptions({
      onSuccess: (data) => {
        setRiskAnalysisResults(data);
        setShowRiskAnalysisModal(true);
        setAnalyzingRisks(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to analyze project risks");
        setAnalyzingRisks(false);
      },
    })
  );

  const milestones = milestonesQuery.data || [];
  const artisans = artisansQuery.data || [];

  const toggleMilestoneExpanded = (milestoneId: number) => {
    setExpandedMilestones((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(milestoneId)) {
        newSet.delete(milestoneId);
      } else {
        newSet.add(milestoneId);
      }
      return newSet;
    });
  };

  const handleEditMilestone = (milestone: any) => {
    setEditingMilestone(milestone.id);
    setShowAddForm(true);
    reset({
      name: milestone.name,
      description: milestone.description,
      sequenceOrder: milestone.sequenceOrder,
      labourCost: milestone.labourCost,
      materialCost: milestone.materialCost,
      dieselCost: milestone.dieselCost || 0,
      rentCost: milestone.rentCost || 0,
      adminCost: milestone.adminCost || 0,
      otherOperationalCost: milestone.otherOperationalCost || 0,
      expectedProfit: milestone.expectedProfit,
      budgetAllocated: milestone.budgetAllocated,
      startDate: milestone.startDate ? new Date(milestone.startDate).toISOString().split("T")[0] : "",
      endDate: milestone.endDate ? new Date(milestone.endDate).toISOString().split("T")[0] : "",
      assignedToId: milestone.assignedToId || undefined,
      notes: milestone.notes || "",
    });
    
    // Populate materials if they exist
    if (milestone.materials && milestone.materials.length > 0) {
      setMaterials(milestone.materials.map((m: any) => ({
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

  const handleQuotationUpload = async (milestoneId: number, file: File) => {
    try {
      setUploadingQuotations(milestoneId);
      
      // Get presigned URL using the tRPC client directly (it's a mutation)
      const { presignedUrl, fileUrl } = await trpcClient.getPresignedUploadUrl.mutate({
        token: token!,
        fileName: file.name,
        fileType: file.type,
      });
      
      // Upload to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }
      
      // Save to database using the fileUrl from the response
      uploadQuotationMutation.mutate({
        token: token!,
        milestoneId,
        url: fileUrl,
        supplierName: "",
        category: "MATERIALS",
      });
    } catch (error) {
      console.error("Upload error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to upload file");
      setUploadingQuotations(null);
    }
  };

  const handleDeleteQuotation = (quotationId: number) => {
    if (window.confirm("Are you sure you want to delete this supplier quotation? This action cannot be undone.")) {
      deleteQuotationMutation.mutate({
        token: token!,
        quotationId,
      });
    }
  };

  const handleGenerateMilestoneReport = (milestoneId: number) => {
    setGeneratingReportId(milestoneId);
    generateMilestoneReportMutation.mutate({
      token: token!,
      milestoneId,
    });
  };

  const handleEditRisk = (milestoneId: number, risk: any) => {
    setEditingRisk(risk.id);
    setShowRiskForm({ [milestoneId]: true });
    resetRisk({
      riskDescription: risk.riskDescription,
      riskCategory: risk.riskCategory,
      probability: risk.probability,
      impact: risk.impact,
      mitigationStrategy: risk.mitigationStrategy || "",
    });
  };

  const handleDeleteRisk = (riskId: number) => {
    if (window.confirm("Are you sure you want to delete this risk? This action cannot be undone.")) {
      deleteRiskMutation.mutate({
        token: token!,
        riskId,
      });
    }
  };

  const handleUpdateRiskStatus = (riskId: number, status: "OPEN" | "MITIGATED" | "CLOSED") => {
    updateRiskMutation.mutate({
      token: token!,
      riskId,
      status,
    });
  };

  const handleAnalyzeRisks = () => {
    setAnalyzingRisks(true);
    
    const analysisPromise = analyzeProjectRisksMutation.mutateAsync({
      token: token!,
      projectId,
      includeFinancialRisks: true,
      includeTimelineRisks: true,
      includeResourceRisks: true,
    });

    toast.promise(
      analysisPromise,
      {
        loading: "Analyzing project risks with AI...",
        success: "Risk analysis complete!",
        error: "Failed to analyze risks",
      }
    );
  };

  const onSubmitRisk = (milestoneId: number) => (data: RiskForm) => {
    if (editingRisk) {
      updateRiskMutation.mutate({
        token: token!,
        riskId: editingRisk,
        ...data,
      });
    } else {
      createRiskMutation.mutate({
        token: token!,
        milestoneId,
        ...data,
      });
    }
  };

  const getRiskSeverityColor = (probability: string, impact: string) => {
    if (probability === "HIGH" || impact === "HIGH") {
      return "border-red-300 bg-red-50";
    }
    if (probability === "MEDIUM" || impact === "MEDIUM") {
      return "border-yellow-300 bg-yellow-50";
    }
    return "border-blue-300 bg-blue-50";
  };

  const getRiskBadgeColor = (value: string) => {
    if (value === "HIGH") return "bg-red-100 text-red-800";
    if (value === "MEDIUM") return "bg-yellow-100 text-yellow-800";
    return "bg-green-100 text-green-800";
  };

  const onSubmit = (data: MilestoneForm) => {
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

    if (editingMilestone) {
      updateMilestoneMutation.mutate({
        token: token!,
        milestoneId: editingMilestone,
        ...data,
        materials: materialsData,
      });
    } else {
      createMilestoneMutation.mutate({
        token: token!,
        projectId,
        ...data,
        materials: materialsData,
      });
    }
  };

  const calculateTotalBudget = () => {
    return milestones.reduce((sum, m) => sum + (m.budgetAllocated || 0), 0);
  };

  const calculateTotalActualCost = () => {
    return milestones.reduce((sum, m) => sum + (m.actualCost || 0), 0);
  };

  const getBudgetStatus = (milestone: any) => {
    if (!milestone.budgetAllocated || milestone.budgetAllocated === 0) {
      return { status: "no-budget", color: "text-gray-600" };
    }
    
    const variance = milestone.actualCost - milestone.budgetAllocated;
    const variancePercentage = (variance / milestone.budgetAllocated) * 100;
    
    if (variancePercentage > 10) {
      return { status: "over-budget", color: "text-red-600", variance, variancePercentage };
    } else if (variancePercentage > 0) {
      return { status: "at-budget", color: "text-yellow-600", variance, variancePercentage };
    } else {
      return { status: "under-budget", color: "text-green-600", variance, variancePercentage };
    }
  };

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
      
      // Get presigned URL using the tRPC client directly (it's a mutation)
      const { presignedUrl, fileUrl } = await trpcClient.getPresignedUploadUrl.mutate({
        token: token!,
        fileName: file.name,
        fileType: file.type,
      });
      
      // Upload to MinIO
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        body: file,
        headers: {
          "Content-Type": file.type,
        },
      });
      
      if (!uploadResponse.ok) {
        throw new Error(`Upload failed with status ${uploadResponse.status}`);
      }
      
      // Use the fileUrl from the response
      updateMaterial(index, "supplierQuotationUrl", fileUrl);
      toast.success("Material quotation uploaded!");
      setUploadingMaterialQuotation(null);
    } catch (error) {
      console.error("Error uploading quotation:", error);
      toast.error("Failed to upload material quotation");
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

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-200">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-5 h-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-blue-900">Total Milestones</h3>
          </div>
          <p className="text-2xl font-bold text-blue-600">{milestones.length}</p>
        </div>

        <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-xl p-4 border border-purple-200">
          <div className="flex items-center gap-2 mb-2">
            <DollarSign className="w-5 h-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-purple-900">Total Budget</h3>
          </div>
          <p className="text-2xl font-bold text-purple-600">R{calculateTotalBudget().toLocaleString()}</p>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-200">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-5 h-5 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-900">Actual Cost</h3>
          </div>
          <p className="text-2xl font-bold text-amber-600">R{calculateTotalActualCost().toLocaleString()}</p>
        </div>

        <div className={`rounded-xl p-4 border ${
          calculateTotalActualCost() <= calculateTotalBudget()
            ? 'bg-gradient-to-br from-green-50 to-emerald-50 border-green-200'
            : 'bg-gradient-to-br from-red-50 to-rose-50 border-red-200'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {calculateTotalActualCost() <= calculateTotalBudget() ? (
              <CheckCircle className="w-5 h-5 text-green-600" />
            ) : (
              <AlertTriangle className="w-5 h-5 text-red-600" />
            )}
            <h3 className={`text-sm font-semibold ${
              calculateTotalActualCost() <= calculateTotalBudget() ? 'text-green-900' : 'text-red-900'
            }`}>
              Variance
            </h3>
          </div>
          <p className={`text-2xl font-bold ${
            calculateTotalActualCost() <= calculateTotalBudget() ? 'text-green-600' : 'text-red-600'
          }`}>
            R{Math.abs(calculateTotalBudget() - calculateTotalActualCost()).toLocaleString()}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {calculateTotalActualCost() <= calculateTotalBudget() ? 'Under Budget' : 'Over Budget'}
          </p>
        </div>
      </div>

      {/* View Mode Toggle and Add Milestone Button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:space-x-4 w-full sm:w-auto">
          <h2 className="text-xl font-bold text-gray-900">Work Breakdown Structure</h2>
          
          {/* View Mode Toggle */}
          <div className="flex bg-white rounded-lg border border-gray-300 overflow-hidden shadow-sm">
            <button
              onClick={() => setViewMode("list")}
              className={`px-3 py-2 text-sm font-medium transition-colors flex items-center space-x-2 ${
                viewMode === "list"
                  ? "bg-purple-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <List className="h-4 w-4" />
              <span>List View</span>
            </button>
            <button
              onClick={() => setViewMode("gantt")}
              className={`px-3 py-2 text-sm font-medium transition-colors flex items-center space-x-2 ${
                viewMode === "gantt"
                  ? "bg-purple-600 text-white"
                  : "text-gray-700 hover:bg-gray-100"
              }`}
            >
              <BarChart3 className="h-4 w-4" />
              <span>Gantt Chart</span>
            </button>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
          <button
            onClick={handleAnalyzeRisks}
            disabled={analyzingRisks || milestones.length === 0}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md transition-all disabled:opacity-50"
          >
            {analyzingRisks ? (
              <>
                <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Brain className="h-5 w-5 mr-2" />
                Analyze Risks with AI
              </>
            )}
          </button>
          <button
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingMilestone(null);
              setMaterials([]);
              reset({
                sequenceOrder: milestones.length + 1,
                labourCost: 0,
                materialCost: 0,
                dieselCost: 0,
                rentCost: 0,
                adminCost: 0,
                otherOperationalCost: 0,
                expectedProfit: 0,
                budgetAllocated: 0,
              });
            }}
            className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-md transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            Add Milestone
          </button>
        </div>
      </div>

      {/* Add/Edit Milestone Form */}
      {showAddForm && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {editingMilestone ? "Edit Milestone" : "Add New Milestone"}
          </h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Milestone Name *
                </label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Foundation Work"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sequence Order *
                </label>
                <input
                  type="number"
                  {...register("sequenceOrder", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1"
                />
                {errors.sequenceOrder && (
                  <p className="mt-1 text-sm text-red-600">{errors.sequenceOrder.message}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Detailed description of the milestone deliverables..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Labour Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("labourCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.labourCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.labourCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Material Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("materialCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.materialCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.materialCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Diesel Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("dieselCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.dieselCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.dieselCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Rent Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("rentCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.rentCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.rentCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Admin Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("adminCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.adminCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.adminCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Other Operational Cost (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("otherOperationalCost", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.otherOperationalCost && (
                  <p className="mt-1 text-sm text-red-600">{errors.otherOperationalCost.message}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Expected Profit (R)
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("expectedProfit", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Budget Allocated (R) *
                </label>
                <input
                  type="number"
                  step="0.01"
                  {...register("budgetAllocated", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="0.00"
                />
                {errors.budgetAllocated && (
                  <p className="mt-1 text-sm text-red-600">{errors.budgetAllocated.message}</p>
                )}
              </div>

              {/* Materials Section */}
              <div className="md:col-span-2 border-t pt-4 mt-4">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Material Items</h3>
                    <p className="text-xs text-gray-600 mt-1">
                      Add specific materials needed for this milestone with supplier details
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={addMaterial}
                    className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
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

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Material Name *
                            </label>
                            <input
                              type="text"
                              value={material.name}
                              onChange={(e) => updateMaterial(index, "name", e.target.value)}
                              placeholder="e.g., Cement bags"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>

                          <div className="sm:col-span-2">
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <input
                              type="text"
                              value={material.description}
                              onChange={(e) => updateMaterial(index, "description", e.target.value)}
                              placeholder="Additional details"
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-gray-700 mb-1">
                              Supplier Quotation Document
                            </label>
                            {material.supplierQuotationUrl ? (
                              <div className="flex items-center space-x-2">
                                <a
                                  href={material.supplierQuotationUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 px-3 py-2 text-sm bg-purple-50 border border-purple-200 rounded-lg text-purple-700 hover:bg-purple-100 transition-colors flex items-center"
                                >
                                  <FileText className="h-4 w-4 mr-2" />
                                  View Quotation
                                </a>
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

                          <div className="sm:col-span-2 bg-white border border-gray-200 rounded p-2">
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

                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                      <div className="flex justify-between text-sm font-semibold">
                        <span className="text-purple-900">Total Material Cost:</span>
                        <span className="text-purple-900">R{calculateTotalMaterialCost().toFixed(2)}</span>
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

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  {...register("startDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  {...register("endDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assign to Artisan
                </label>
                <select
                  {...register("assignedToId", {
                    setValueAs: (v) => (v === "" ? undefined : parseInt(v)),
                  })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">-- Select Artisan (Optional) --</option>
                  {artisans.map((artisan) => (
                    <option key={artisan.id} value={artisan.id}>
                      {artisan.firstName} {artisan.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes
                </label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Additional notes..."
                />
              </div>
            </div>

            <div className="flex flex-col-reverse sm:flex-row justify-end gap-3 pt-4 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingMilestone(null);
                  setMaterials([]);
                  reset();
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={createMilestoneMutation.isPending || updateMilestoneMutation.isPending}
                className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
              >
                {editingMilestone
                  ? updateMilestoneMutation.isPending
                    ? "Updating..."
                    : "Update Milestone"
                  : createMilestoneMutation.isPending
                  ? "Creating..."
                  : "Create Milestone"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Milestones View */}
      {viewMode === "gantt" ? (
        <GanttChart milestones={milestones} />
      ) : (
        <div className="space-y-4">
          {milestones.length === 0 ? (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Target className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No milestones yet</p>
              <p className="text-xs text-gray-500 mt-1">Add milestones to create your project plan</p>
            </div>
          ) : (
            milestones.map((milestone, index) => {
              const isExpanded = expandedMilestones.has(milestone.id);
              const budgetStatus = getBudgetStatus(milestone);
              const statusInfo = milestoneStatuses.find((s) => s.value === milestone.status);
              const StatusIcon = statusInfo?.icon || Clock;

              return (
                <div
                  key={milestone.id}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
                >
                  {/* Milestone Header */}
                  <div
                    className="p-4 sm:p-6 cursor-pointer hover:bg-gray-50 transition-colors"
                    onClick={() => toggleMilestoneExpanded(milestone.id)}
                  >
                    <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                      <div className="flex-1 w-full">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3 mb-2 flex-1 min-w-0">
                            <span className="flex items-center justify-center w-8 h-8 rounded-full bg-purple-100 text-purple-700 font-bold text-sm flex-shrink-0">
                              {milestone.sequenceOrder}
                            </span>
                            <h3 className="text-lg font-semibold text-gray-900 truncate">{milestone.name}</h3>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEditMilestone(milestone);
                            }}
                            className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors sm:hidden flex-shrink-0"
                          >
                            <Edit className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <div className="flex flex-wrap items-center gap-2 mb-3">
                          <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusInfo?.color}`}>
                            <StatusIcon className="inline h-3 w-3 mr-1" />
                            {statusInfo?.label}
                          </span>
                          {milestone.risks && milestone.risks.length > 0 && (
                            <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              <AlertTriangle className="inline h-3 w-3 mr-1" />
                              {milestone.risks.length} Risk{milestone.risks.length !== 1 ? "s" : ""}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-gray-600 mb-3">{milestone.description}</p>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                          <div>
                            <span className="text-gray-600">Budget:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              R{milestone.budgetAllocated.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Actual:</span>
                            <span className={`ml-2 font-semibold ${budgetStatus.color}`}>
                              R{milestone.actualCost.toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-600">Progress:</span>
                            <span className="ml-2 font-semibold text-gray-900">
                              {milestone.progressPercentage}%
                            </span>
                          </div>
                          {milestone.assignedTo && (
                            <div>
                              <span className="text-gray-600">Assigned:</span>
                              <span className="ml-2 font-semibold text-gray-900">
                                {milestone.assignedTo.firstName} {milestone.assignedTo.lastName}
                              </span>
                            </div>
                          )}
                        </div>

                        {/* Progress Bar */}
                        <div className="mt-3">
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div
                              className="bg-gradient-to-r from-purple-600 to-purple-700 h-2 rounded-full transition-all"
                              style={{ width: `${milestone.progressPercentage}%` }}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 w-full sm:w-auto justify-between sm:justify-start">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleEditMilestone(milestone);
                          }}
                          className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors hidden sm:block"
                        >
                          <Edit className="h-5 w-5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="h-5 w-5 text-gray-600" />
                        ) : (
                          <ChevronDown className="h-5 w-5 text-gray-600" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Content - Tabbed Interface */}
                  {isExpanded && (
                    <div className="border-t border-gray-200 bg-gray-50">
                      {/* Tab Navigation */}
                      <div className="flex border-b border-gray-200 bg-white px-4 sm:px-6 overflow-x-auto">
                        {["overview", "budget", "quotations", "risks", "payments"].map((tab) => (
                          <button
                            key={tab}
                            onClick={(e) => {
                              e.stopPropagation();
                              setExpandedMilestoneTabs((prev) => ({
                                ...prev,
                                [milestone.id]: tab,
                              }));
                            }}
                            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                              (expandedMilestoneTabs[milestone.id] || "overview") === tab
                                ? "border-purple-600 text-purple-600"
                                : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300"
                            }`}
                          >
                            {tab.charAt(0).toUpperCase() + tab.slice(1)}
                          </button>
                        ))}
                      </div>

                      {/* Tab Content */}
                      <div className="p-4 sm:p-6">
                        {/* Overview Tab */}
                        {(!expandedMilestoneTabs[milestone.id] || expandedMilestoneTabs[milestone.id] === "overview") && (
                          <div className="text-sm text-gray-600 space-y-4">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Financial Breakdown</p>
                                <p className="mb-2">
                                  <strong>Labour Cost:</strong> R{milestone.labourCost.toLocaleString()}
                                </p>
                                <p className="mb-2">
                                  <strong>Material Cost:</strong> R{milestone.materialCost.toLocaleString()}
                                </p>
                                <p className="mb-2">
                                  <strong>Diesel Cost:</strong> R{(milestone.dieselCost || 0).toLocaleString()}
                                </p>
                                <p className="mb-2">
                                  <strong>Rent Cost:</strong> R{(milestone.rentCost || 0).toLocaleString()}
                                </p>
                                <p className="mb-2">
                                  <strong>Admin Cost:</strong> R{(milestone.adminCost || 0).toLocaleString()}
                                </p>
                                <p className="mb-2">
                                  <strong>Other Operational Cost:</strong> R{(milestone.otherOperationalCost || 0).toLocaleString()}
                                </p>
                                <p className="mb-2 pt-2 border-t border-gray-300">
                                  <strong>Expected Profit:</strong> R{milestone.expectedProfit.toLocaleString()}
                                </p>
                              </div>
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Timeline</p>
                                {milestone.startDate && (
                                  <p className="mb-2">
                                    <strong>Start Date:</strong> {new Date(milestone.startDate).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.endDate && (
                                  <p className="mb-2">
                                    <strong>End Date:</strong> {new Date(milestone.endDate).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.actualStartDate && (
                                  <p className="mb-2">
                                    <strong>Actual Start:</strong> {new Date(milestone.actualStartDate).toLocaleDateString()}
                                  </p>
                                )}
                                {milestone.actualEndDate && (
                                  <p className="mb-2">
                                    <strong>Actual End:</strong> {new Date(milestone.actualEndDate).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                            </div>
                            {milestone.notes && (
                              <div>
                                <p className="font-medium text-gray-900 mb-1">Notes</p>
                                <p className="text-gray-600">{milestone.notes}</p>
                              </div>
                            )}
                            
                            {/* Download Milestone Report Button */}
                            <div className="mt-4 pt-4 border-t border-gray-200">
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGenerateMilestoneReport(milestone.id);
                                }}
                                disabled={generatingReportId === milestone.id}
                                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-sm"
                              >
                                {generatingReportId === milestone.id ? (
                                  <>
                                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                    Generating Report...
                                  </>
                                ) : (
                                  <>
                                    <FileDown className="h-4 w-4 mr-2" />
                                    Download Milestone Report
                                  </>
                                )}
                              </button>
                              <p className="text-xs text-gray-500 mt-2">
                                Generate a comprehensive PDF report including weekly summaries, financial breakdown, timeline performance, and photo gallery.
                              </p>
                            </div>
                            
                            {/* Display materials */}
                            {milestone.materials && milestone.materials.length > 0 && (
                              <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="font-medium text-gray-900 mb-2 flex items-center">
                                  <FileText className="h-4 w-4 mr-1" />
                                  Material Items ({milestone.materials.length})
                                </p>
                                <div className="space-y-2">
                                  {milestone.materials.map((material: any, idx: number) => (
                                    <div key={idx} className="bg-white rounded p-3 text-xs border border-gray-200">
                                      <div className="flex items-start justify-between mb-1">
                                        <div className="flex-1 min-w-0">
                                          <span className="font-semibold text-gray-900">{material.name}</span>
                                          {material.supplier && (
                                            <span className="text-gray-600 ml-2">from {material.supplier}</span>
                                          )}
                                        </div>
                                        <span className="font-bold text-purple-900 ml-2 flex-shrink-0">
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
                                          className="inline-flex items-center text-purple-700 hover:text-purple-800 mt-1"
                                        >
                                          <FileText className="h-3 w-3 mr-1" />
                                          View Supplier Quotation
                                          {material.supplierQuotationAmount && (
                                            <span className="ml-1">(R{material.supplierQuotationAmount.toFixed(2)})</span>
                                          )}
                                        </a>
                                      )}
                                    </div>
                                  ))}
                                  <div className="border-t border-purple-300 pt-2 mt-2">
                                    <div className="flex justify-between text-sm font-bold text-purple-900">
                                      <span>Total Materials Cost:</span>
                                      <span>
                                        R{milestone.materials
                                          .reduce((sum: number, m: any) => sum + m.totalCost, 0)
                                          .toFixed(2)}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Budget Tab */}
                        {expandedMilestoneTabs[milestone.id] === "budget" && (
                          <WeeklyBudgetTracker
                            milestoneId={milestone.id}
                            milestoneBudget={milestone.budgetAllocated}
                            milestoneName={milestone.name}
                          />
                        )}

                        {/* Quotations Tab */}
                        {expandedMilestoneTabs[milestone.id] === "quotations" && (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <h4 className="font-semibold text-gray-900">Supplier Quotations</h4>
                              <div>
                                <input
                                  ref={fileInputRef}
                                  type="file"
                                  accept=".pdf,.jpg,.jpeg,.png"
                                  className="hidden"
                                  onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                      handleQuotationUpload(milestone.id, file);
                                    }
                                  }}
                                />
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    fileInputRef.current?.click();
                                  }}
                                  disabled={uploadingQuotations === milestone.id}
                                  className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                                >
                                  {uploadingQuotations === milestone.id ? (
                                    <>
                                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                      Uploading...
                                    </>
                                  ) : (
                                    <>
                                      <Upload className="h-4 w-4 mr-2" />
                                      Upload Quotation
                                    </>
                                  )}
                                </button>
                              </div>
                            </div>

                            {milestone.supplierQuotations && milestone.supplierQuotations.length > 0 ? (
                              <div className="grid grid-cols-1 gap-3">
                                {milestone.supplierQuotations.map((quotation: any) => (
                                  <div
                                    key={quotation.id}
                                    className="bg-white rounded-lg border border-gray-200 p-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-purple-300 transition-colors"
                                  >
                                    <div className="flex items-center space-x-3 flex-1 min-w-0 w-full sm:w-auto">
                                      <FileText className="h-8 w-8 text-purple-600 flex-shrink-0" />
                                      <div className="flex-1 min-w-0">
                                        <div className="font-medium text-gray-900 truncate">
                                          {quotation.category}
                                          {quotation.supplierName && ` - ${quotation.supplierName}`}
                                        </div>
                                        {quotation.amount && (
                                          <div className="text-sm text-gray-600 mt-1">
                                            Amount: R{quotation.amount.toLocaleString()}
                                          </div>
                                        )}
                                        {quotation.description && (
                                          <div className="text-sm text-gray-600 mt-1">{quotation.description}</div>
                                        )}
                                        <div className="text-xs text-gray-500 mt-1">
                                          Uploaded {new Date(quotation.createdAt).toLocaleDateString()}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:space-x-2">
                                      <a
                                        href={quotation.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        onClick={(e) => e.stopPropagation()}
                                        className="px-4 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors text-center"
                                      >
                                        View Document
                                      </a>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDeleteQuotation(quotation.id);
                                        }}
                                        disabled={deleteQuotationMutation.isPending}
                                        className="p-2 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors disabled:opacity-50"
                                        title="Delete quotation"
                                      >
                                        <Trash2 className="h-5 w-5" />
                                      </button>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                                <FileText className="mx-auto h-12 w-12 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-600">No supplier quotations uploaded yet</p>
                                <p className="text-xs text-gray-500 mt-1">Upload quotations to track supplier costs</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Payments Tab */}
                        {expandedMilestoneTabs[milestone.id] === "payments" && (
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <h4 className="font-semibold text-gray-900">Payment Requests</h4>
                              <span className="text-xs text-gray-500">
                                {(milestone as any).paymentRequests?.length || 0} request(s)
                              </span>
                            </div>

                            {(!(milestone as any).paymentRequests || (milestone as any).paymentRequests.length === 0) && (
                              <div className="bg-white border border-gray-200 rounded-lg p-4 text-sm text-gray-600">
                                No payment requests submitted for this milestone.
                              </div>
                            )}

                            {((milestone as any).paymentRequests || []).map((pr: any) => {
                              const canReview = user?.role === "PROPERTY_MANAGER" || user?.role === "JUNIOR_ADMIN" || user?.role === "SENIOR_ADMIN";
                              const isPending = pr.status === "PENDING";
                              const commentValue = paymentComments[pr.id] ?? "";

                              return (
                                <div key={pr.id} className="bg-white border border-gray-200 rounded-lg p-4">
                                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                                    <div>
                                      <div className="text-sm font-semibold text-gray-900">
                                        {pr.requestNumber}  R{Number(pr.calculatedAmount || 0).toLocaleString()}
                                      </div>
                                      <div className="text-xs text-gray-600 mt-1">
                                        Contractor: {pr.artisan?.firstName} {pr.artisan?.lastName}
                                      </div>
                                      <div className="text-xs text-gray-600">
                                        Status: <span className="font-medium">{pr.status}</span>
                                      </div>
                                      {pr.rejectionReason && (
                                        <div className="text-xs text-red-700 mt-1">Rejection reason: {pr.rejectionReason}</div>
                                      )}
                                      {pr.notes && (
                                        <div className="text-xs text-gray-600 mt-1 whitespace-pre-wrap">Notes: {pr.notes}</div>
                                      )}
                                    </div>
                                  </div>

                                  {canReview && (
                                    <div className="mt-3 grid grid-cols-1 sm:grid-cols-3 gap-2">
                                      <input
                                        type="text"
                                        value={commentValue}
                                        onChange={(e) => setPaymentComments((prev) => ({ ...prev, [pr.id]: e.target.value }))}
                                        placeholder="Comment (optional)"
                                        className="sm:col-span-2 w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        disabled={updatePaymentRequestStatusMutation.isPending}
                                      />
                                      <div className="flex gap-2">
                                        <button
                                          type="button"
                                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50"
                                          disabled={!isPending || updatePaymentRequestStatusMutation.isPending}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!token) return;
                                            updatePaymentRequestStatusMutation.mutate({
                                              token,
                                              paymentRequestId: pr.id,
                                              status: "APPROVED",
                                              notes: commentValue?.trim() ? `PM comment: ${commentValue.trim()}` : undefined,
                                            });
                                          }}
                                        >
                                          Approve
                                        </button>
                                        <button
                                          type="button"
                                          className="flex-1 px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50"
                                          disabled={!isPending || updatePaymentRequestStatusMutation.isPending}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (!token) return;
                                            const reason = commentValue?.trim();
                                            if (!reason) {
                                              toast.error("Please provide a rejection reason");
                                              return;
                                            }
                                            updatePaymentRequestStatusMutation.mutate({
                                              token,
                                              paymentRequestId: pr.id,
                                              status: "REJECTED",
                                              rejectionReason: reason,
                                            });
                                          }}
                                        >
                                          Reject
                                        </button>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* Risks Tab */}
                        {expandedMilestoneTabs[milestone.id] === "risks" && (
                          <div className="space-y-4">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                              <h4 className="font-semibold text-gray-900">Risk Management</h4>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setShowRiskForm({ [milestone.id]: !showRiskForm[milestone.id] });
                                  setEditingRisk(null);
                                  resetRisk({
                                    riskDescription: "",
                                    riskCategory: "TECHNICAL",
                                    probability: "MEDIUM",
                                    impact: "MEDIUM",
                                    mitigationStrategy: "",
                                  });
                                }}
                                className="w-full sm:w-auto inline-flex items-center justify-center px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                              >
                                <Plus className="h-4 w-4 mr-2" />
                                Add Risk
                              </button>
                            </div>

                            {/* Risk Form */}
                            {showRiskForm[milestone.id] && (
                              <div className="bg-gray-50 rounded-lg border border-gray-200 p-4">
                                <h5 className="text-sm font-semibold text-gray-900 mb-3">
                                  {editingRisk ? "Edit Risk" : "Add New Risk"}
                                </h5>
                                <form onSubmit={handleSubmitRisk(onSubmitRisk(milestone.id))} className="space-y-3">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Risk Description *
                                    </label>
                                    <textarea
                                      {...registerRisk("riskDescription")}
                                      rows={2}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                      placeholder="Describe the potential risk..."
                                    />
                                    {riskErrors.riskDescription && (
                                      <p className="mt-1 text-xs text-red-600">{riskErrors.riskDescription.message}</p>
                                    )}
                                  </div>

                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Category *
                                      </label>
                                      <select
                                        {...registerRisk("riskCategory")}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                      >
                                        <option value="TECHNICAL">Technical</option>
                                        <option value="FINANCIAL">Financial</option>
                                        <option value="SCHEDULE">Schedule</option>
                                        <option value="RESOURCE">Resource</option>
                                        <option value="EXTERNAL">External</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Probability *
                                      </label>
                                      <select
                                        {...registerRisk("probability")}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                      >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                      </select>
                                    </div>

                                    <div>
                                      <label className="block text-xs font-medium text-gray-700 mb-1">
                                        Impact *
                                      </label>
                                      <select
                                        {...registerRisk("impact")}
                                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                      >
                                        <option value="LOW">Low</option>
                                        <option value="MEDIUM">Medium</option>
                                        <option value="HIGH">High</option>
                                      </select>
                                    </div>
                                  </div>

                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 mb-1">
                                      Mitigation Strategy
                                    </label>
                                    <textarea
                                      {...registerRisk("mitigationStrategy")}
                                      rows={2}
                                      className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                                      placeholder="Describe how to mitigate this risk..."
                                    />
                                  </div>

                                  <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setShowRiskForm({});
                                        setEditingRisk(null);
                                        resetRisk();
                                      }}
                                      className="w-full sm:w-auto px-3 py-1.5 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                                    >
                                      Cancel
                                    </button>
                                    <button
                                      type="submit"
                                      disabled={createRiskMutation.isPending || updateRiskMutation.isPending}
                                      className="w-full sm:w-auto px-3 py-1.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                                    >
                                      {editingRisk
                                        ? updateRiskMutation.isPending
                                          ? "Updating..."
                                          : "Update Risk"
                                        : createRiskMutation.isPending
                                        ? "Creating..."
                                        : "Create Risk"}
                                    </button>
                                  </div>
                                </form>
                              </div>
                            )}

                            {/* Risk List */}
                            {milestone.risks && milestone.risks.length > 0 ? (
                              <div className="space-y-3">
                                {milestone.risks.map((risk: any) => (
                                  <div
                                    key={risk.id}
                                    className={`border-l-4 rounded-lg p-4 ${getRiskSeverityColor(risk.probability, risk.impact)}`}
                                  >
                                    <div className="flex flex-col sm:flex-row items-start justify-between gap-3 mb-2">
                                      <div className="flex-1 w-full">
                                        <div className="flex flex-wrap items-center gap-2 mb-2">
                                          <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-700 text-white">
                                            {risk.riskCategory}
                                          </span>
                                          <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                                            risk.status === "OPEN" ? "bg-red-100 text-red-800" :
                                            risk.status === "MITIGATED" ? "bg-yellow-100 text-yellow-800" :
                                            "bg-green-100 text-green-800"
                                          }`}>
                                            {risk.status}
                                          </span>
                                        </div>
                                        <p className="text-sm font-medium text-gray-900 mb-2">
                                          {risk.riskDescription}
                                        </p>
                                        <div className="flex flex-wrap items-center gap-3 text-xs mb-2">
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-600">Probability:</span>
                                            <span className={`px-1.5 py-0.5 rounded font-medium ${getRiskBadgeColor(risk.probability)}`}>
                                              {risk.probability}
                                            </span>
                                          </div>
                                          <div className="flex items-center space-x-1">
                                            <span className="text-gray-600">Impact:</span>
                                            <span className={`px-1.5 py-0.5 rounded font-medium ${getRiskBadgeColor(risk.impact)}`}>
                                              {risk.impact}
                                            </span>
                                          </div>
                                        </div>
                                        {risk.mitigationStrategy && (
                                          <div className="mt-2 pt-2 border-t border-gray-300">
                                            <div className="flex items-start space-x-2">
                                              <Shield className="h-3 w-3 text-gray-600 flex-shrink-0 mt-0.5" />
                                              <div className="flex-1 min-w-0">
                                                <p className="text-xs font-medium text-gray-700">Mitigation Strategy:</p>
                                                <p className="text-xs text-gray-600 mt-0.5">{risk.mitigationStrategy}</p>
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                      <div className="flex sm:flex-col gap-2 w-full sm:w-auto">
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditRisk(milestone.id, risk);
                                          }}
                                          className="flex-1 sm:flex-none p-1.5 text-gray-600 hover:text-gray-900 hover:bg-white rounded transition-colors"
                                          title="Edit risk"
                                        >
                                          <Edit className="h-4 w-4" />
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleDeleteRisk(risk.id);
                                          }}
                                          disabled={deleteRiskMutation.isPending}
                                          className="flex-1 sm:flex-none p-1.5 text-red-600 hover:text-red-700 hover:bg-white rounded transition-colors disabled:opacity-50"
                                          title="Delete risk"
                                        >
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                      </div>
                                    </div>
                                    
                                    {/* Status Update Buttons */}
                                    {risk.status !== "CLOSED" && (
                                      <div className="mt-3 pt-3 border-t border-gray-300">
                                        <p className="text-xs font-medium text-gray-700 mb-2">Update Status:</p>
                                        <div className="flex flex-wrap gap-2">
                                          {risk.status !== "OPEN" && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateRiskStatus(risk.id, "OPEN");
                                              }}
                                              className="px-2 py-1 text-xs font-medium text-red-700 bg-red-100 hover:bg-red-200 rounded transition-colors"
                                            >
                                              Reopen
                                            </button>
                                          )}
                                          {risk.status !== "MITIGATED" && (
                                            <button
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                handleUpdateRiskStatus(risk.id, "MITIGATED");
                                              }}
                                              className="px-2 py-1 text-xs font-medium text-yellow-700 bg-yellow-100 hover:bg-yellow-200 rounded transition-colors"
                                            >
                                              Mark Mitigated
                                            </button>
                                          )}
                                          <button
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              handleUpdateRiskStatus(risk.id, "CLOSED");
                                            }}
                                            className="px-2 py-1 text-xs font-medium text-green-700 bg-green-100 hover:bg-green-200 rounded transition-colors"
                                          >
                                            Close Risk
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <div className="text-center py-8 bg-white rounded-lg border border-gray-200">
                                <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
                                <p className="mt-2 text-sm text-gray-600">No risks identified yet</p>
                                <p className="text-xs text-gray-500 mt-1">Add risks to track potential project issues</p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Risk Analysis Modal */}
      {showRiskAnalysisModal && riskAnalysisResults && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-auto">
            <div className="sticky top-0 bg-gradient-to-r from-red-600 to-orange-600 px-6 py-4 flex items-center justify-between z-10">
              <div className="flex items-center space-x-3">
                <div className="bg-white/20 p-2 rounded-lg">
                  <Brain className="h-6 w-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-white">AI Risk Analysis Results</h3>
                  <p className="text-sm text-red-100">{riskAnalysisResults.projectName}</p>
                </div>
              </div>
              <button
                onClick={() => setShowRiskAnalysisModal(false)}
                className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Summary */}
              <div className="bg-gradient-to-r from-red-50 to-orange-50 border border-red-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Risk Summary</h4>
                <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-gray-900">{riskAnalysisResults.summary.totalRisksIdentified}</div>
                    <div className="text-xs text-gray-600">Total Risks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-red-600">{riskAnalysisResults.summary.criticalRisks}</div>
                    <div className="text-xs text-gray-600">Critical</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{riskAnalysisResults.summary.highRisks}</div>
                    <div className="text-xs text-gray-600">High</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-yellow-600">{riskAnalysisResults.summary.mediumRisks}</div>
                    <div className="text-xs text-gray-600">Medium</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{riskAnalysisResults.summary.lowRisks}</div>
                    <div className="text-xs text-gray-600">Low</div>
                  </div>
                </div>
              </div>

              {/* Project Metrics */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Project Health Indicators</h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                  <div>
                    <span className="text-gray-600">Budget Utilization:</span>
                    <div className="font-semibold text-gray-900">{riskAnalysisResults.projectMetrics.budgetUtilization}%</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Overall Progress:</span>
                    <div className="font-semibold text-gray-900">{riskAnalysisResults.projectMetrics.overallProgress}%</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Overdue Milestones:</span>
                    <div className="font-semibold text-gray-900">{riskAnalysisResults.projectMetrics.overdueMilestones}</div>
                  </div>
                  <div>
                    <span className="text-gray-600">Existing Risks:</span>
                    <div className="font-semibold text-gray-900">{riskAnalysisResults.projectMetrics.existingRisks}</div>
                  </div>
                </div>
              </div>

              {/* Risks List */}
              <div>
                <h4 className="text-sm font-semibold text-gray-900 mb-3">Identified Risks</h4>
                <div className="space-y-4">
                  {riskAnalysisResults.risks.map((risk: any, idx: number) => (
                    <div
                      key={idx}
                      className={`border-l-4 rounded-lg p-4 ${
                        risk.severity === "CRITICAL"
                          ? "border-red-500 bg-red-50"
                          : risk.severity === "HIGH"
                          ? "border-orange-500 bg-orange-50"
                          : risk.severity === "MEDIUM"
                          ? "border-yellow-500 bg-yellow-50"
                          : "border-blue-500 bg-blue-50"
                      }`}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="font-semibold text-gray-900">{risk.riskTitle}</h5>
                            <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                              risk.severity === "CRITICAL"
                                ? "bg-red-100 text-red-800"
                                : risk.severity === "HIGH"
                                ? "bg-orange-100 text-orange-800"
                                : risk.severity === "MEDIUM"
                                ? "bg-yellow-100 text-yellow-800"
                                : "bg-blue-100 text-blue-800"
                            }`}>
                              {risk.severity}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800">
                              {risk.category}
                            </span>
                            <span className="px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                              Likelihood: {risk.likelihood}
                            </span>
                          </div>
                          <p className="text-sm text-gray-700 mb-2">{risk.description}</p>
                          
                          <div className="text-sm text-gray-600 mb-2">
                            <strong>Impact:</strong> {risk.impact}
                          </div>

                          {risk.indicators && risk.indicators.length > 0 && (
                            <div className="mb-2">
                              <strong className="text-xs text-gray-700">Indicators:</strong>
                              <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                                {risk.indicators.map((indicator: string, i: number) => (
                                  <li key={i}>{indicator}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {risk.mitigationStrategies && risk.mitigationStrategies.length > 0 && (
                            <div className="mb-2">
                              <strong className="text-xs text-gray-700">Mitigation Strategies:</strong>
                              <ul className="list-disc list-inside text-xs text-gray-600 mt-1">
                                {risk.mitigationStrategies.map((strategy: string, i: number) => (
                                  <li key={i}>{strategy}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {risk.immediateActions && risk.immediateActions.length > 0 && (
                            <div className="bg-white border border-red-300 rounded p-2 mt-2">
                              <strong className="text-xs text-red-700 flex items-center">
                                <AlertOctagon className="h-3 w-3 mr-1" />
                                Immediate Actions Required:
                              </strong>
                              <ul className="list-disc list-inside text-xs text-red-600 mt-1">
                                {risk.immediateActions.map((action: string, i: number) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          )}

                          {risk.estimatedImpactCost && (
                            <div className="text-sm font-semibold text-red-700 mt-2">
                              Estimated Impact: R{risk.estimatedImpactCost.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <p className="text-sm text-yellow-800">
                  <strong>Note:</strong> This is an AI-generated analysis. Review each risk carefully and use the milestone risk management features to track and mitigate these risks.
                </p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setShowRiskAnalysisModal(false)}
                  className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 rounded-lg transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
