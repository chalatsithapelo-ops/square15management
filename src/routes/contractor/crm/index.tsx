import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, Fragment, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Tab } from "@headlessui/react";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  TrendingUp,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Sparkles,
  AlertCircle,
  CheckCircle,
  Clock,
  Zap,
  Target,
  Loader2,
  Bell,
  BarChart3,
  Users,
  Edit,
} from "lucide-react";
import { SalesFunnelChart } from "~/components/crm/SalesFunnelChart";
import { SalesDashboardOverview } from "~/components/crm/SalesDashboardOverview";
import { SendEmailModal } from "~/components/crm/SendEmailModal";
import { BulkEmailModal } from "~/components/crm/BulkEmailModal";
import { LeadConversionTrendChart } from "~/components/charts/LeadConversionTrendChart";
import { SalesPipelineTrendChart } from "~/components/charts/SalesPipelineTrendChart";
import { WinRateTrendChart } from "~/components/charts/WinRateTrendChart";
import { EmployeeSalesDashboard } from "~/components/admin/EmployeeSalesDashboard";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import {
  OTHER_SERVICE_TYPE_VALUE,
  resolveServiceType,
  splitServiceType,
} from "~/utils/serviceTypeOther";

export const Route = createFileRoute("/contractor/crm/")({
  component: CRMPageGuarded,
});

function CRMPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasCRM" returnPath="/contractor/dashboard">
      <CRMPage />
    </RequireSubscriptionFeature>
  );
}

const leadSchema = z
  .object({
    customerName: z.string().min(1, "Customer name is required"),
    companyName: z.string().optional(),
    customerEmail: z.string().email("Invalid email address"),
    customerPhone: z.string().min(1, "Phone number is required"),
    address: z.string().optional(),
    serviceType: z.string().min(1, "Service type is required"),
    otherServiceType: z.string().optional(),
    description: z.string().min(1, "Description is required"),
    estimatedValue: z.number().optional(),
    nextFollowUpDate: z.string().optional(),
    followUpAssignedToId: z.preprocess(
      (val) => (typeof val === 'number' && Number.isNaN(val) ? undefined : val),
      z.number().optional()
    ),
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

type LeadForm = z.infer<typeof leadSchema>;

const serviceTypeOptions = [
  "Painting",
  "Plumbing",
  "Electrical",
  "Construction",
  "Affordable Housing",
  "Social Housing",
  "Shopping Center",
  "General Maintenance",
  "HVAC",
  "Carpentry",
  "Roofing",
  "Flooring",
  "Tiling",
] as const;

const leadStatuses = [
  { value: "NEW", label: "New", color: "bg-gray-100 text-gray-800" },
  { value: "CONTACTED", label: "Contacted", color: "bg-blue-100 text-blue-800" },
  { value: "QUALIFIED", label: "Qualified", color: "bg-yellow-100 text-yellow-800" },
  { value: "PROPOSAL_SENT", label: "Proposal Sent", color: "bg-purple-100 text-purple-800" },
  { value: "NEGOTIATION", label: "Negotiation", color: "bg-orange-100 text-orange-800" },
  { value: "WON", label: "Won", color: "bg-green-100 text-green-800" },
  { value: "LOST", label: "Lost", color: "bg-red-100 text-red-800" },
];

function CRMPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingLead, setEditingLead] = useState<any | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [scoringLeadId, setScoringLeadId] = useState<number | null>(null);
  const [leadScores, setLeadScores] = useState<Record<number, any>>({});
  const [classifyingService, setClassifyingService] = useState(false);
  const [selectedTab, setSelectedTab] = useState(0);
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [selectedLeadForEmail, setSelectedLeadForEmail] = useState<{
    id: number;
    name: string;
    email: string;
  } | null>(null);
  const [selectedLeadIds, setSelectedLeadIds] = useState<Set<number>>(new Set());
  const [bulkEmailModalOpen, setBulkEmailModalOpen] = useState(false);

  // Date range for employee performance (default to last 90 days)
  const defaultStartDate = new Date();
  defaultStartDate.setDate(defaultStartDate.getDate() - 90);
  
  const [startDate, setStartDate] = useState(defaultStartDate.toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const leadsQuery = useQuery(
    trpc.getLeads.queryOptions({
      token: token!,
      status: statusFilter as any,
    })
  );

  const salesPerformanceQuery = useQuery(
    trpc.getSalesPerformance.queryOptions({
      token: token!,
    })
  );

  const employeePerformanceQuery = useQuery(
    trpc.getEmployeeSalesPerformance.queryOptions({
      token: token!,
      startDate,
      endDate,
    })
  );

  const adminsQuery = useQuery(
    trpc.getAdmins.queryOptions({
      token: token!,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    getValues,
    watch,
  } = useForm<LeadForm>({
    resolver: zodResolver(leadSchema),
  });

  // Watch description field for auto-classification
  const description = watch("description");
  const address = watch("address");
  const selectedServiceType = watch("serviceType");

  const createLeadMutation = useMutation(
    trpc.createLead.mutationOptions({
      onSuccess: () => {
        toast.success("Lead created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getLeads.queryKey() });
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create lead");
      },
    })
  );

  const updateLeadDetailsMutation = useMutation(
    trpc.updateLeadDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Lead updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getLeads.queryKey() });
        reset();
        setShowAddForm(false);
        setEditingLead(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update lead");
      },
    })
  );

  const updateLeadStatusMutation = useMutation(
    trpc.updateLeadStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Lead status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getLeads.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update lead status");
      },
    })
  );

  const scoreLeadMutation = useMutation(
    trpc.scoreLeadWithAI.mutationOptions({
      onSuccess: (data, variables) => {
        setLeadScores({
          ...leadScores,
          [variables.leadId]: data,
        });
        toast.success("Lead scored successfully!");
        setScoringLeadId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to score lead");
        setScoringLeadId(null);
      },
    })
  );

  const classifyServiceMutation = useMutation(
    trpc.classifyServiceType.mutationOptions({
      onSuccess: (data) => {
        // Update the form with the suggested service type
        const currentValues = getValues();
        reset({
          ...currentValues,
          serviceType: data.suggestedServiceType,
          otherServiceType: "",
        });
        toast.success(`Service type suggested: ${data.suggestedServiceType}`);
        setClassifyingService(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to classify service type");
        setClassifyingService(false);
      },
    })
  );

  // Auto-classify service type when description is entered
  useEffect(() => {
    // Only auto-classify if:
    // 1. Form is shown (user is actively filling it)
    // 2. Description has sufficient length (at least 20 chars for better accuracy)
    // 3. Service type is not already set
    // 4. Not already classifying
    // 5. Not editing (only for new leads)
    if (
      showAddForm &&
      description &&
      description.trim().length >= 20 &&
      !getValues("serviceType") &&
      !classifyingService &&
      !editingLead
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
  }, [description, address, showAddForm]);

  const onSubmit = (data: LeadForm) => {
    const resolvedServiceType = resolveServiceType(data.serviceType, data.otherServiceType);

    if (!resolvedServiceType) {
      toast.error("Please select or specify a service type");
      return;
    }

    const { otherServiceType: _otherServiceType, ...rest } = data;
    if (editingLead) {
      // Update existing lead
      updateLeadDetailsMutation.mutate({
        token: token!,
        leadId: editingLead.id,
        ...rest,
        serviceType: resolvedServiceType,
        // Convert datetime-local string to ISO 8601 format
        nextFollowUpDate: data.nextFollowUpDate 
          ? new Date(data.nextFollowUpDate).toISOString() 
          : undefined,
        // Convert NaN to undefined so backend can default to current user
        followUpAssignedToId: Number.isNaN(data.followUpAssignedToId) 
          ? undefined 
          : data.followUpAssignedToId,
      });
    } else {
      // Create new lead
      createLeadMutation.mutate({
        token: token!,
        ...rest,
        serviceType: resolvedServiceType,
        // Convert datetime-local string to ISO 8601 format
        nextFollowUpDate: data.nextFollowUpDate 
          ? new Date(data.nextFollowUpDate).toISOString() 
          : undefined,
        // Convert NaN to undefined so backend can default to current user
        followUpAssignedToId: Number.isNaN(data.followUpAssignedToId) 
          ? undefined 
          : data.followUpAssignedToId,
      });
    }
  };

  const handleScoreLead = (leadId: number) => {
    setScoringLeadId(leadId);
    scoreLeadMutation.mutate({
      token: token!,
      leadId,
    });
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

  const handleEditLead = (lead: any) => {
    setEditingLead(lead);
    setShowAddForm(true);

      const split = splitServiceType(lead.serviceType, serviceTypeOptions);
    
    // Pre-populate form with lead data
    reset({
      customerName: lead.customerName,
      companyName: lead.companyName || "",
      customerEmail: lead.customerEmail,
      customerPhone: lead.customerPhone,
      address: lead.address || "",
        serviceType: split.serviceType,
        otherServiceType: split.otherServiceType,
      description: lead.description,
      estimatedValue: lead.estimatedValue || undefined,
      // Convert ISO date to datetime-local format (YYYY-MM-DDTHH:mm)
      nextFollowUpDate: lead.nextFollowUpDate 
        ? new Date(lead.nextFollowUpDate).toISOString().slice(0, 16)
        : "",
      followUpAssignedToId: lead.followUpAssignedToId || undefined,
    });
  };

  const handleOpenEmailModal = (lead: any) => {
    setSelectedLeadForEmail({
      id: lead.id,
      name: lead.customerName,
      email: lead.customerEmail,
    });
    setEmailModalOpen(true);
  };

  const handleCloseEmailModal = () => {
    setEmailModalOpen(false);
    setSelectedLeadForEmail(null);
  };

  const handleSelectAll = () => {
    if (selectedLeadIds.size === filteredLeads.length) {
      setSelectedLeadIds(new Set());
    } else {
      setSelectedLeadIds(new Set(filteredLeads.map((lead) => lead.id)));
    }
  };

  const handleSelectLead = (leadId: number) => {
    const newSelected = new Set(selectedLeadIds);
    if (newSelected.has(leadId)) {
      newSelected.delete(leadId);
    } else {
      newSelected.add(leadId);
    }
    setSelectedLeadIds(newSelected);
  };

  const handleOpenBulkEmailModal = () => {
    setBulkEmailModalOpen(true);
  };

  const handleCloseBulkEmailModal = () => {
    setBulkEmailModalOpen(false);
  };

  const setPresetRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  const leads = leadsQuery.data || [];
  const filteredLeads = leads.filter((lead) =>
    lead.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.customerEmail.toLowerCase().includes(searchTerm.toLowerCase()) ||
    lead.serviceType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const selectedLeads = filteredLeads
    .filter((lead) => selectedLeadIds.has(lead.id))
    .map((lead) => ({
      id: lead.id,
      name: lead.customerName,
      email: lead.customerEmail,
    }));

  // Calculate funnel metrics from salesPerformanceQuery data when available
  const funnelMetrics = salesPerformanceQuery.data
    ? leadStatuses.map((status) => ({
        ...status,
        count: salesPerformanceQuery.data.leadsByStatus[status.value as keyof typeof salesPerformanceQuery.data.leadsByStatus] || 0,
      }))
    : leadStatuses.map((status) => ({
        ...status,
        count: 0,
      }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
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
              <div className="bg-gradient-to-br from-blue-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <TrendingUp className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">CRM - Lead Management</h1>
                <p className="text-sm text-gray-600">{leads.length} total leads</p>
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
              <Link
                to="/contractor/crm/campaigns"
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-purple-600 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-all"
              >
                <Mail className="h-5 w-5 mr-2" />
                Campaigns
              </Link>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setEditingLead(null);
                  reset();
                }}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 shadow-md transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Lead
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tab.Group selectedIndex={selectedTab} onChange={setSelectedTab}>
          <Tab.List className="flex space-x-1 rounded-xl bg-blue-100 p-1 mb-6 overflow-x-auto scrollbar-none touch-pan-x">
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                    ${selected 
                      ? 'bg-white text-blue-700 shadow' 
                      : 'text-blue-600 hover:bg-white/[0.12] hover:text-blue-700'
                    }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <Users className="h-4 w-4" />
                    <span>Leads</span>
                  </div>
                </button>
              )}
            </Tab>
            <Tab as={Fragment}>
              {({ selected }) => (
                <button
                  className={`w-full rounded-lg py-2.5 text-sm font-medium leading-5 transition-all
                    ${selected 
                      ? 'bg-white text-blue-700 shadow' 
                      : 'text-blue-600 hover:bg-white/[0.12] hover:text-blue-700'
                    }`}
                >
                  <div className="flex items-center justify-center space-x-2">
                    <BarChart3 className="h-4 w-4" />
                    <span>Analytics</span>
                  </div>
                </button>
              )}
            </Tab>
          </Tab.List>

          <Tab.Panels>
            {/* Leads Tab */}
            <Tab.Panel>
              {/* Sales Funnel Overview */}
              {salesPerformanceQuery.isLoading ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                  </div>
                </div>
              ) : salesPerformanceQuery.data ? (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">Sales Funnel</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                    {funnelMetrics.map((metric) => (
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
              ) : null}

              {/* Add Lead Form */}
              {showAddForm && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
                  <h2 className="text-lg font-semibold text-gray-900 mb-4">
                    {editingLead ? "Edit Lead" : "Add New Lead"}
                  </h2>
                  <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Customer Name *
                      </label>
                      <input
                        type="text"
                        {...register("customerName")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="John Doe"
                      />
                      {errors.customerName && (
                        <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Company Name
                      </label>
                      <input
                        type="text"
                        {...register("companyName")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="ABC Company (Optional)"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Email *
                      </label>
                      <input
                        type="email"
                        {...register("customerEmail")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="john@example.com"
                      />
                      {errors.customerEmail && (
                        <p className="mt-1 text-sm text-red-600">{errors.customerEmail.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Phone *
                      </label>
                      <input
                        type="text"
                        {...register("customerPhone")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="+27 123 456 789"
                      />
                      {errors.customerPhone && (
                        <p className="mt-1 text-sm text-red-600">{errors.customerPhone.message}</p>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Service Type *
                      </label>
                      <div className="flex space-x-2">
                        <select
                          {...register("serviceType")}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      {selectedServiceType === OTHER_SERVICE_TYPE_VALUE && (
                        <div className="mt-2">
                          <input
                            type="text"
                            {...register("otherServiceType")}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Specify service type"
                          />
                          {errors.otherServiceType && (
                            <p className="mt-1 text-sm text-red-600">{errors.otherServiceType.message}</p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Address
                      </label>
                      <input
                        type="text"
                        {...register("address")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="123 Main St, City"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Estimated Value (R)
                      </label>
                      <input
                        type="number"
                        {...register("estimatedValue", { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="50000"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Next Follow-Up Date
                      </label>
                      <input
                        type="datetime-local"
                        {...register("nextFollowUpDate")}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Assign Follow-Up To
                      </label>
                      <select
                        {...register("followUpAssignedToId", { valueAsNumber: true })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">Select person (default: you)</option>
                        {(adminsQuery.data || []).map((admin) => (
                          <option key={admin.id} value={admin.id}>
                            {admin.firstName} {admin.lastName}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Description *
                      </label>
                      <textarea
                        {...register("description")}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Describe the service requirements..."
                      />
                      {errors.description && (
                        <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                      )}
                    </div>

                    <div className="md:col-span-2 flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddForm(false);
                          setEditingLead(null);
                          reset();
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={createLeadMutation.isPending || updateLeadDetailsMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        {editingLead 
                          ? (updateLeadDetailsMutation.isPending ? "Updating..." : "Update Lead")
                          : (createLeadMutation.isPending ? "Creating..." : "Create Lead")
                        }
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Search and Filter */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
                <div className="flex items-center space-x-4">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search leads by name, email, or service..."
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={() => setStatusFilter(null)}
                    className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                  >
                    <Filter className="h-5 w-5 mr-2" />
                    {statusFilter ? "Clear Filter" : "All Leads"}
                  </button>
                </div>
              </div>

              {/* Bulk Actions */}
              {selectedLeadIds.size > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Users className="h-5 w-5 text-blue-600" />
                      <span className="text-sm font-medium text-blue-900">
                        {selectedLeadIds.size} lead{selectedLeadIds.size !== 1 ? "s" : ""} selected
                      </span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedLeadIds(new Set())}
                        className="px-3 py-2 text-sm font-medium text-blue-700 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Clear Selection
                      </button>
                      <button
                        onClick={handleOpenBulkEmailModal}
                        className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 rounded-lg transition-all shadow-md"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Send Bulk Email
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Leads List */}
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Select All Header */}
                {filteredLeads.length > 0 && (
                  <div className="bg-gray-50 border-b border-gray-200 px-6 py-3">
                    <label className="flex items-center space-x-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selectedLeadIds.size === filteredLeads.length && filteredLeads.length > 0}
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <span className="text-sm font-medium text-gray-700">
                        Select All ({filteredLeads.length})
                      </span>
                    </label>
                  </div>
                )}
                
                <div className="divide-y divide-gray-200">
                  {filteredLeads.map((lead) => {
                    const leadScore = leadScores[lead.id];
                    const priorityColors = {
                      HIGH: "bg-red-100 text-red-800 border-red-300",
                      MEDIUM: "bg-yellow-100 text-yellow-800 border-yellow-300",
                      LOW: "bg-gray-100 text-gray-800 border-gray-300",
                    };
                    const urgencyIcons = {
                      IMMEDIATE: <Zap className="h-3 w-3 text-red-600" />,
                      URGENT: <AlertCircle className="h-3 w-3 text-orange-600" />,
                      NORMAL: <Clock className="h-3 w-3 text-blue-600" />,
                      LOW: <CheckCircle className="h-3 w-3 text-gray-600" />,
                    };

                    return (
                    <div key={lead.id} className="p-6 hover:bg-gray-50 transition-colors">
                      <div className="flex items-start space-x-4">
                        {/* Checkbox */}
                        <div className="pt-1">
                          <input
                            type="checkbox"
                            checked={selectedLeadIds.has(lead.id)}
                            onChange={() => handleSelectLead(lead.id)}
                            className="h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                          />
                        </div>
                        
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <h3 className="text-lg font-semibold text-gray-900">{lead.customerName}</h3>
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                leadStatuses.find((s) => s.value === lead.status)?.color
                              }`}
                            >
                              {leadStatuses.find((s) => s.value === lead.status)?.label}
                            </span>
                            {leadScore && (
                              <>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-xs font-medium border ${
                                    priorityColors[leadScore.priority as keyof typeof priorityColors]
                                  }`}
                                >
                                  {leadScore.priority} Priority
                                </span>
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                  <Target className="h-3 w-3 mr-1" />
                                  Score: {leadScore.score}/100
                                </span>
                                {leadScore.urgencyLevel && (
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                    {urgencyIcons[leadScore.urgencyLevel as keyof typeof urgencyIcons]}
                                    <span className="ml-1">{leadScore.urgencyLevel}</span>
                                  </span>
                                )}
                              </>
                            )}
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600">
                            <div className="flex items-center">
                              <Mail className="h-4 w-4 mr-2 text-gray-400" />
                              {lead.customerEmail}
                            </div>
                            <div className="flex items-center">
                              <Phone className="h-4 w-4 mr-2 text-gray-400" />
                              {lead.customerPhone}
                            </div>
                            {lead.address && (
                              <div className="flex items-center">
                                <MapPin className="h-4 w-4 mr-2 text-gray-400" />
                                {lead.address}
                              </div>
                            )}
                            {lead.estimatedValue && (
                              <div className="flex items-center">
                                <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                                R{lead.estimatedValue.toLocaleString()}
                              </div>
                            )}
                          </div>
                          <div className="mt-3">
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Service:</span> {lead.serviceType}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">{lead.description}</p>
                          </div>

                          {/* Follow-up Information */}
                          {lead.nextFollowUpDate && (
                            <div className="mt-3 flex items-center space-x-4">
                              <div className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg ${
                                new Date(lead.nextFollowUpDate) < new Date()
                                  ? 'bg-red-50 border border-red-200'
                                  : new Date(lead.nextFollowUpDate).toDateString() === new Date().toDateString()
                                  ? 'bg-yellow-50 border border-yellow-200'
                                  : 'bg-blue-50 border border-blue-200'
                              }`}>
                                <Bell className={`h-4 w-4 ${
                                  new Date(lead.nextFollowUpDate) < new Date()
                                    ? 'text-red-600'
                                    : new Date(lead.nextFollowUpDate).toDateString() === new Date().toDateString()
                                    ? 'text-yellow-600'
                                    : 'text-blue-600'
                                }`} />
                                <span className={`text-sm font-medium ${
                                  new Date(lead.nextFollowUpDate) < new Date()
                                    ? 'text-red-900'
                                    : new Date(lead.nextFollowUpDate).toDateString() === new Date().toDateString()
                                    ? 'text-yellow-900'
                                    : 'text-blue-900'
                                }`}>
                                  Follow-up: {new Date(lead.nextFollowUpDate).toLocaleDateString()}
                                  {new Date(lead.nextFollowUpDate) < new Date() && ' (OVERDUE)'}
                                  {new Date(lead.nextFollowUpDate).toDateString() === new Date().toDateString() && ' (TODAY)'}
                                </span>
                              </div>
                              {lead.followUpAssignedTo && (
                                <div className="text-sm text-gray-600">
                                  Assigned to: {lead.followUpAssignedTo.firstName} {lead.followUpAssignedTo.lastName}
                                </div>
                              )}
                            </div>
                          )}

                          {/* AI Insights Section */}
                          {leadScore && (
                            <div className="mt-4 space-y-3">
                              {/* Reasoning */}
                              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                                <p className="text-xs font-semibold text-blue-900 mb-1 flex items-center">
                                  <Sparkles className="h-3 w-3 mr-1" />
                                  AI Analysis
                                </p>
                                <p className="text-sm text-blue-800">{leadScore.reasoning}</p>
                              </div>

                              {/* Recommended Actions */}
                              {leadScore.recommendedActions && leadScore.recommendedActions.length > 0 && (
                                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-green-900 mb-2">Recommended Actions:</p>
                                  <ul className="space-y-1">
                                    {leadScore.recommendedActions.map((action: string, idx: number) => (
                                      <li key={idx} className="text-sm text-green-800 flex items-start">
                                        <CheckCircle className="h-4 w-4 mr-2 mt-0.5 flex-shrink-0" />
                                        <span>{action}</span>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}

                              {/* Suggested Artisan */}
                              {leadScore.suggestedArtisanId && leadScore.artisanMatchReasoning && (
                                <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-purple-900 mb-1">Suggested Artisan:</p>
                                  <p className="text-sm text-purple-800">{leadScore.artisanMatchReasoning}</p>
                                </div>
                              )}

                              {/* Estimated Project Value */}
                              {leadScore.estimatedProjectValue && !lead.estimatedValue && (
                                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                                  <p className="text-xs font-semibold text-amber-900 mb-1">AI Estimated Value:</p>
                                  <p className="text-sm text-amber-800">
                                    R{leadScore.estimatedProjectValue.toLocaleString()}
                                  </p>
                                </div>
                              )}
                            </div>
                          )}

                          <div className="mt-2 flex items-center text-xs text-gray-500">
                            <Calendar className="h-3 w-3 mr-1" />
                            Created {new Date(lead.createdAt).toLocaleDateString()}
                            <User className="h-3 w-3 ml-3 mr-1" />
                            by {lead.createdBy?.firstName} {lead.createdBy?.lastName}
                          </div>
                        </div>
                        <div className="ml-4 flex flex-col space-y-2">
                          {!leadScore && (
                            <button
                              onClick={() => handleScoreLead(lead.id)}
                              disabled={scoringLeadId === lead.id}
                              className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors disabled:opacity-50"
                            >
                              {scoringLeadId === lead.id ? (
                                <>
                                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                  Scoring...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="h-4 w-4 mr-2" />
                                  Score Lead
                                </>
                              )}
                            </button>
                          )}
                          <button
                            onClick={() => handleEditLead(lead)}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                          >
                            <Edit className="h-4 w-4 mr-2" />
                            Edit
                          </button>
                          <button
                            onClick={() => handleOpenEmailModal(lead)}
                            className="inline-flex items-center px-3 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 rounded-lg transition-colors"
                          >
                            <Mail className="h-4 w-4 mr-2" />
                            Send Email
                          </button>
                          <select
                            value={lead.status}
                            onChange={(e) =>
                              updateLeadStatusMutation.mutate({
                                token: token!,
                                leadId: lead.id,
                                status: e.target.value as any,
                              })
                            }
                            className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {leadStatuses.map((status) => (
                              <option key={status.value} value={status.value}>
                                {status.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>
                  )})}
                  {filteredLeads.length === 0 && (
                    <div className="p-12 text-center">
                      <TrendingUp className="mx-auto h-12 w-12 text-gray-400" />
                      <p className="mt-2 text-sm text-gray-600">No leads found</p>
                    </div>
                  )}
                </div>
              </div>
            </Tab.Panel>

            {/* Analytics Tab */}
            <Tab.Panel>
              {salesPerformanceQuery.isLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                </div>
              ) : salesPerformanceQuery.data ? (
                <div className="space-y-6">
                  <SalesDashboardOverview
                    summary={salesPerformanceQuery.data.summary}
                    conversionRates={salesPerformanceQuery.data.conversionRates}
                    monthlyTrends={salesPerformanceQuery.data.monthlyTrends}
                    topServiceTypes={salesPerformanceQuery.data.topServiceTypes}
                  />
                  
                  <SalesFunnelChart
                    data={salesPerformanceQuery.data.leadsByStatus}
                    conversionRates={salesPerformanceQuery.data.conversionRates}
                  />

                  {/* New Trend Charts */}
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="lg:col-span-2">
                      <LeadConversionTrendChart
                        data={(salesPerformanceQuery.data.conversionRateTrends || []).map((trend: any) => ({
                          ...trend,
                          date: new Date(trend.month + '-01'),
                        }))}
                        isLoading={false}
                      />
                    </div>
                    <SalesPipelineTrendChart
                      data={(salesPerformanceQuery.data.pipelineValueTrends || []).map((trend: any) => ({
                        ...trend,
                        date: new Date(trend.month + '-01'),
                      }))}
                      isLoading={false}
                    />
                    <WinRateTrendChart
                      data={(salesPerformanceQuery.data.winRateTrends || []).map((trend: any) => ({
                        ...trend,
                        date: new Date(trend.month + '-01'),
                      }))}
                      isLoading={false}
                    />
                  </div>

                  {/* Employee Performance Comparison */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                    <div className="flex items-center justify-between mb-6">
                      <div>
                        <h2 className="text-lg font-semibold text-gray-900">Employee Sales Performance</h2>
                        <p className="text-sm text-gray-600 mt-1">Compare sales metrics across your team</p>
                      </div>
                    </div>

                    {/* Date Range Filter */}
                    <div className="bg-gray-50 rounded-lg p-4 mb-6">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between space-y-4 sm:space-y-0">
                        <div className="flex items-center space-x-2">
                          <Calendar className="h-5 w-5 text-gray-400" />
                          <span className="text-sm font-medium text-gray-700">Date Range:</span>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 w-full sm:w-auto">
                          {/* Quick Preset Buttons */}
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => setPresetRange(30)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                            >
                              Last 30 Days
                            </button>
                            <button
                              onClick={() => setPresetRange(90)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                            >
                              Last 90 Days
                            </button>
                            <button
                              onClick={() => setPresetRange(180)}
                              className="px-3 py-1.5 text-xs font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-lg transition-colors"
                            >
                              Last 6 Months
                            </button>
                          </div>

                          {/* Custom Date Inputs */}
                          <div className="flex items-center space-x-2">
                            <input
                              type="date"
                              value={startDate}
                              onChange={(e) => setStartDate(e.target.value)}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                            <span className="text-gray-500">to</span>
                            <input
                              type="date"
                              value={endDate}
                              onChange={(e) => setEndDate(e.target.value)}
                              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Dashboard Content */}
                    {employeePerformanceQuery.isLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <div className="text-center">
                          <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto mb-4" />
                          <p className="text-sm text-gray-600">Loading employee performance data...</p>
                        </div>
                      </div>
                    ) : employeePerformanceQuery.isError ? (
                      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
                        <p className="text-sm text-red-800">
                          Failed to load employee performance data. Please try again.
                        </p>
                      </div>
                    ) : (
                      <EmployeeSalesDashboard 
                        data={employeePerformanceQuery.data || []} 
                        isLoading={false}
                      />
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-center py-12">
                  <p className="text-gray-600">No analytics data available</p>
                </div>
              )}
            </Tab.Panel>
          </Tab.Panels>
        </Tab.Group>
      </main>

      {/* Email Modal */}
      {selectedLeadForEmail && (
        <SendEmailModal
          isOpen={emailModalOpen}
          onClose={handleCloseEmailModal}
          recipientName={selectedLeadForEmail.name}
          recipientEmail={selectedLeadForEmail.email}
          leadId={selectedLeadForEmail.id}
          token={token || ""}
        />
      )}

      {/* Bulk Email Modal */}
      <BulkEmailModal
        isOpen={bulkEmailModalOpen}
        onClose={handleCloseBulkEmailModal}
        selectedLeads={selectedLeads}
        token={token || ""}
      />
    </div>
  );
}
