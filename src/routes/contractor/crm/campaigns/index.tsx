import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useEffect, useMemo, useState, Fragment } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { Dialog, Transition, Tab } from "@headlessui/react";
import {
  ArrowLeft,
  Plus,
  Mail,
  Send,
  Edit,
  Trash2,
  Eye,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Calendar,
  Users,
  Filter,
  Sparkles,
  Target,
  TrendingUp,
  Wand2,
  LayoutTemplate,
  MessageSquare,
  Palette,
  Zap,
  RefreshCw,
} from "lucide-react";
import { CampaignEditor } from "~/components/crm/CampaignEditor";
import { OTHER_SERVICE_TYPE_VALUE } from "~/utils/serviceTypeOther";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";

export const Route = createFileRoute("/contractor/crm/campaigns/")({
  component: CampaignsPageGuarded,
});

function CampaignsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasCRM" returnPath="/contractor/dashboard">
      <CampaignsPage />
    </RequireSubscriptionFeature>
  );
}

const campaignSchema = z.object({
  name: z.string().min(1, "Campaign name is required"),
  description: z.string().optional(),
  subject: z.string().min(1, "Email subject is required"),
  htmlBody: z.string().min(10, "Email body must be at least 10 characters"),
  targetStatuses: z.array(z.string()).optional(),
  targetServiceTypes: z.array(z.string()).optional(),
  otherServiceType: z.string().optional(),
  estimatedValueMin: z.number().optional(),
  estimatedValueMax: z.number().optional(),
  targetCustomerIds: z.array(z.number()).optional(),
  excludedCustomerIds: z.array(z.number()).optional(),
}).superRefine((v, ctx) => {
  if (v.targetServiceTypes?.includes(OTHER_SERVICE_TYPE_VALUE)) {
    const other = (v.otherServiceType || "").trim();
    if (!other) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["otherServiceType"],
        message: "Please specify the service type",
      });
    }
  }
});

type CampaignForm = z.infer<typeof campaignSchema>;

const campaignStatuses = [
  { value: "DRAFT", label: "Draft", color: "bg-gray-100 text-gray-800", icon: Edit },
  { value: "SCHEDULED", label: "Scheduled", color: "bg-blue-100 text-blue-800", icon: Clock },
  { value: "SENDING", label: "Sending", color: "bg-yellow-100 text-yellow-800", icon: Loader2 },
  { value: "SENT", label: "Sent", color: "bg-green-100 text-green-800", icon: CheckCircle },
  { value: "FAILED", label: "Failed", color: "bg-red-100 text-red-800", icon: XCircle },
];

const leadStatuses = [
  "NEW",
  "CONTACTED",
  "QUALIFIED",
  "PROPOSAL_SENT",
  "NEGOTIATION",
  "WON",
  "LOST",
];

const serviceTypes = [
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
];

function CampaignsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  
  const [showModal, setShowModal] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<any>(null);
  const [previewCampaign, setPreviewCampaign] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [sendingCampaignId, setSendingCampaignId] = useState<number | null>(null);
  const [sendResult, setSendResult] = useState<any>(null);
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<number[]>([]);
  const [excludedCustomerIds, setExcludedCustomerIds] = useState<number[]>([]);
  const [selectAllCustomers, setSelectAllCustomers] = useState(false);
  
  // AI Campaign Studio states
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showAIGenerateModal, setShowAIGenerateModal] = useState(false);
  const [showAIAmendModal, setShowAIAmendModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [aiServiceType, setAiServiceType] = useState('');
  const [aiDiscount, setAiDiscount] = useState('');
  const [aiTone, setAiTone] = useState<'professional' | 'friendly' | 'urgent' | 'festive' | 'casual'>('professional');
  const [aiAmendInstruction, setAiAmendInstruction] = useState('');
  const [amendingCampaignId, setAmendingCampaignId] = useState<number | null>(null);
  const [templateCategory, setTemplateCategory] = useState('all');
  const [creationMode, setCreationMode] = useState<'manual' | 'template' | 'ai'>('manual');

  const campaignsQuery = useQuery(
    trpc.getCampaigns.queryOptions({
      token: token!,
      ...(statusFilter !== null && { status: statusFilter as any }),
    })
  );

  const customersQuery = useQuery(
    trpc.getCustomers.queryOptions({
      token: token!,
    })
  );

  const templatesQuery = useQuery(
    trpc.getCampaignTemplates.queryOptions({
      token: token!,
      category: templateCategory !== 'all' ? templateCategory : undefined,
    })
  );

  const customers = customersQuery.data || [];
  const templates = templatesQuery.data?.templates || [];
  const templateCategories = templatesQuery.data?.categories || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<CampaignForm>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      description: "",
      subject: "",
      htmlBody: "",
      targetStatuses: [],
      targetServiceTypes: [],
      otherServiceType: "",
    },
  });

  const htmlBody = watch("htmlBody");
  const selectedTargetServiceTypes = watch("targetServiceTypes") || [];
  const showOtherServiceType = selectedTargetServiceTypes.includes(OTHER_SERVICE_TYPE_VALUE);

  useEffect(() => {
    if (!showOtherServiceType) {
      setValue("otherServiceType", "");
    }
  }, [showOtherServiceType, setValue]);

  const serviceTypeOptions = useMemo(() => {
    const extras = selectedTargetServiceTypes
      .filter((t) => t && t !== OTHER_SERVICE_TYPE_VALUE && !serviceTypes.includes(t));
    return Array.from(new Set([...serviceTypes, ...extras, OTHER_SERVICE_TYPE_VALUE]));
  }, [selectedTargetServiceTypes]);

  const createCampaignMutation = useMutation(
    trpc.createCampaign.mutationOptions({
      onSuccess: () => {
        toast.success("Campaign created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getCampaigns.queryKey() });
        handleCloseModal();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create campaign");
      },
    })
  );

  const updateCampaignMutation = useMutation(
    trpc.updateCampaign.mutationOptions({
      onSuccess: () => {
        toast.success("Campaign updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getCampaigns.queryKey() });
        handleCloseModal();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update campaign");
      },
    })
  );

  const sendCampaignMutation = useMutation(
    trpc.sendCampaign.mutationOptions({
      onSuccess: (data) => {
        setSendResult(data);
        if (data.totalFailed === 0) {
          toast.success(`Campaign sent to ${data.totalSent} recipients!`);
        } else {
          toast.success(`Sent ${data.totalSent} emails. ${data.totalFailed} failed.`);
        }
        queryClient.invalidateQueries({ queryKey: trpc.getCampaigns.queryKey() });
        setSendingCampaignId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send campaign");
        setSendingCampaignId(null);
      },
    })
  );

  const deleteCampaignMutation = useMutation(
    trpc.deleteCampaign.mutationOptions({
      onSuccess: () => {
        toast.success("Campaign deleted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getCampaigns.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to delete campaign");
      },
    })
  );

  const generateCampaignMutation = useMutation(
    trpc.generateCampaignContent.mutationOptions({
      onSuccess: (data) => {
        if (data.success && data.content) {
          toast.success("AI campaign generated! Loading into editor...");
          // Fill the form with the generated content
          setValue("name", data.content.name);
          setValue("subject", data.content.subject);
          setValue("htmlBody", data.content.htmlBody);
          setValue("description", data.content.description || "");
          setShowAIGenerateModal(false);
          setShowModal(true);
          setAiPrompt('');
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate campaign content");
      },
    })
  );

  const amendCampaignMutation = useMutation(
    trpc.amendCampaignWithAI.mutationOptions({
      onSuccess: (data) => {
        if (data.success && data.content) {
          toast.success(`Campaign amended: ${data.content.changesSummary}`);
          queryClient.invalidateQueries({ queryKey: trpc.getCampaigns.queryKey() });
          setShowAIAmendModal(false);
          setAiAmendInstruction('');
          setAmendingCampaignId(null);
        }
      },
      onError: (error) => {
        toast.error(error.message || "Failed to amend campaign");
      },
    })
  );

  const handleSelectAllCustomers = (checked: boolean) => {
    setSelectAllCustomers(checked);
    if (checked) {
      setSelectedCustomerIds(customers.map(c => c.id));
      setExcludedCustomerIds([]);
    } else {
      setSelectedCustomerIds([]);
      setExcludedCustomerIds([]);
    }
  };

  const handleCustomerToggle = (customerId: number) => {
    setSelectedCustomerIds(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
    // Remove from excluded if being selected
    setExcludedCustomerIds(prev => prev.filter(id => id !== customerId));
  };

  const handleCustomerExclude = (customerId: number) => {
    setExcludedCustomerIds(prev => {
      if (prev.includes(customerId)) {
        return prev.filter(id => id !== customerId);
      } else {
        return [...prev, customerId];
      }
    });
  };

  const onSubmit = (data: CampaignForm) => {
    const other = (data.otherServiceType || "").trim();
    const targetServiceTypesRaw = data.targetServiceTypes || [];
    const targetServiceTypesResolved = targetServiceTypesRaw.includes(OTHER_SERVICE_TYPE_VALUE)
      ? [...targetServiceTypesRaw.filter((t) => t !== OTHER_SERVICE_TYPE_VALUE), ...(other ? [other] : [])]
      : targetServiceTypesRaw;

    const targetCriteria = {
      statuses: data.targetStatuses,
      serviceTypes: targetServiceTypesResolved,
      estimatedValueMin: data.estimatedValueMin,
      estimatedValueMax: data.estimatedValueMax,
      targetCustomerIds: selectedCustomerIds.length > 0 ? selectedCustomerIds : undefined,
      excludedCustomerIds: excludedCustomerIds.length > 0 ? excludedCustomerIds : undefined,
    };

    if (editingCampaign) {
      updateCampaignMutation.mutate({
        token: token!,
        campaignId: editingCampaign.id,
        name: data.name,
        description: data.description,
        subject: data.subject,
        htmlBody: data.htmlBody,
        targetCriteria,
      });
    } else {
      createCampaignMutation.mutate({
        token: token!,
        name: data.name,
        description: data.description,
        subject: data.subject,
        htmlBody: data.htmlBody,
        targetCriteria,
      });
    }
  };

  const handleOpenModal = (campaign?: any) => {
    if (campaign) {
      setEditingCampaign(campaign);
      const criteria = campaign.targetCriteria as any;
      const persistedServiceTypes: string[] = Array.isArray(criteria?.serviceTypes) ? criteria.serviceTypes : [];
      const unknownServiceTypes = persistedServiceTypes.filter((t) => !serviceTypes.includes(t));
      const knownServiceTypes = persistedServiceTypes.filter((t) => serviceTypes.includes(t));

      const nextTargetServiceTypes =
        unknownServiceTypes.length === 1
          ? [...knownServiceTypes, OTHER_SERVICE_TYPE_VALUE]
          : persistedServiceTypes;

      reset({
        name: campaign.name,
        description: campaign.description || "",
        subject: campaign.subject,
        htmlBody: campaign.htmlBody,
        targetStatuses: criteria?.statuses || [],
        targetServiceTypes: nextTargetServiceTypes,
        otherServiceType: unknownServiceTypes.length === 1 ? unknownServiceTypes[0] : "",
        estimatedValueMin: criteria?.estimatedValueMin,
        estimatedValueMax: criteria?.estimatedValueMax,
      });
      // Set customer selection state
      setSelectedCustomerIds(criteria?.targetCustomerIds || []);
      setExcludedCustomerIds(criteria?.excludedCustomerIds || []);
      setSelectAllCustomers(false);
    } else {
      setEditingCampaign(null);
      reset({
        name: "",
        description: "",
        subject: "",
        htmlBody: "",
        targetStatuses: [],
        targetServiceTypes: [],
        otherServiceType: "",
      });
      setSelectedCustomerIds([]);
      setExcludedCustomerIds([]);
      setSelectAllCustomers(false);
    }
    setShowModal(true);
  };

  const handleCloseModal = () => {
    if (!createCampaignMutation.isPending && !updateCampaignMutation.isPending) {
      setShowModal(false);
      setEditingCampaign(null);
      reset();
      setSelectedCustomerIds([]);
      setExcludedCustomerIds([]);
      setSelectAllCustomers(false);
    }
  };

  const handleSendCampaign = (campaignId: number) => {
    if (confirm("Are you sure you want to send this campaign? This action cannot be undone.")) {
      setSendingCampaignId(campaignId);
      setSendResult(null);
      sendCampaignMutation.mutate({
        token: token!,
        campaignId,
      });
    }
  };

  const handleDeleteCampaign = (campaignId: number) => {
    if (confirm("Are you sure you want to delete this campaign?")) {
      deleteCampaignMutation.mutate({
        token: token!,
        campaignId,
      });
    }
  };

  const handleAIGenerate = () => {
    if (!aiPrompt.trim()) {
      toast.error("Please describe the campaign you want to create");
      return;
    }
    generateCampaignMutation.mutate({
      token: token!,
      prompt: aiPrompt,
      serviceType: aiServiceType || undefined,
      discountPercent: aiDiscount ? Number(aiDiscount) : undefined,
      tone: aiTone,
    });
  };

  const handleAmendCampaign = () => {
    if (!aiAmendInstruction.trim() || !amendingCampaignId) return;
    amendCampaignMutation.mutate({
      token: token!,
      campaignId: amendingCampaignId,
      instruction: aiAmendInstruction,
    });
  };

  const handleSelectTemplate = (template: any) => {
    setValue("name", template.name);
    setValue("subject", template.defaultSubject);
    setValue("htmlBody", template.htmlBody);
    setValue("description", template.description);
    setShowTemplateModal(false);
    setShowModal(true);
    toast.success(`Template "${template.name}" loaded! Customize it for your campaign.`);
  };

  const openAIAmendModal = (campaignId: number) => {
    setAmendingCampaignId(campaignId);
    setAiAmendInstruction('');
    setShowAIAmendModal(true);
  };

  const campaigns = campaignsQuery.data || [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/crm"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <Mail className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Marketing Campaigns</h1>
                <p className="text-sm text-gray-600">{campaigns.length} total campaigns</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowAIGenerateModal(true)}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 shadow-md transition-all"
              >
                <Wand2 className="h-5 w-5 mr-2" />
                AI Generate
              </button>
              <button
                onClick={() => setShowTemplateModal(true)}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 shadow-md transition-all"
              >
                <LayoutTemplate className="h-5 w-5 mr-2" />
                Templates
              </button>
              <button
                onClick={() => handleOpenModal()}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 shadow-md transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Manual Create
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Status Filter */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
            <Filter className="h-5 w-5 text-gray-400" />
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setStatusFilter(null)}
                className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === null
                    ? "bg-purple-100 text-purple-800"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All Campaigns
              </button>
              {campaignStatuses.map((status) => (
                <button
                  key={status.value}
                  onClick={() => setStatusFilter(statusFilter === status.value ? null : status.value)}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    statusFilter === status.value
                      ? status.color
                      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                  }`}
                >
                  {status.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Campaigns List */}
        <div className="grid grid-cols-1 gap-6">
          {campaigns.map((campaign) => {
            const statusInfo = campaignStatuses.find((s) => s.value === campaign.status);
            const StatusIcon = statusInfo?.icon || Mail;
            const targetCriteria = campaign.targetCriteria as any;

            return (
              <div
                key={campaign.id}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{campaign.name}</h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium inline-flex items-center ${statusInfo?.color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusInfo?.label}
                      </span>
                      {campaign.totalRecipients > 0 && (
                        <span className="text-sm text-gray-600">
                          <Users className="inline h-4 w-4 mr-1" />
                          {campaign.totalRecipients} recipients
                        </span>
                      )}
                    </div>

                    {campaign.description && (
                      <p className="text-sm text-gray-600 mb-3">{campaign.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <Mail className="h-4 w-4 mr-1 text-gray-400" />
                        Subject: {campaign.subject}
                      </div>
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-1 text-gray-400" />
                        Created {new Date(campaign.createdAt).toLocaleDateString()}
                      </div>
                      {campaign.sentAt && (
                        <div className="flex items-center">
                          <Send className="h-4 w-4 mr-1 text-gray-400" />
                          Sent {new Date(campaign.sentAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>

                    {/* Target Criteria */}
                    {(targetCriteria?.statuses?.length > 0 || targetCriteria?.serviceTypes?.length > 0 || targetCriteria?.targetCustomerIds?.length > 0) && (
                      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                        <div className="flex items-center space-x-2 mb-2">
                          <Target className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-semibold text-blue-900">Target Audience</span>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {targetCriteria?.statuses?.map((status: string) => (
                            <span
                              key={status}
                              className="px-2 py-1 bg-blue-100 text-blue-800 rounded text-xs font-medium"
                            >
                              Status: {status}
                            </span>
                          ))}
                          {targetCriteria?.serviceTypes?.map((type: string) => (
                            <span
                              key={type}
                              className="px-2 py-1 bg-purple-100 text-purple-800 rounded text-xs font-medium"
                            >
                              Service: {type}
                            </span>
                          ))}
                          {targetCriteria?.targetCustomerIds?.length > 0 && (
                            <span
                              className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs font-medium"
                            >
                              {targetCriteria.targetCustomerIds.length} customer(s) targeted
                              {targetCriteria?.excludedCustomerIds?.length > 0 && 
                                ` (${targetCriteria.excludedCustomerIds.length} excluded)`
                              }
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Campaign Stats */}
                    {campaign.status === "SENT" && (
                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-5 w-5 text-green-600" />
                            <div>
                              <p className="text-2xl font-bold text-green-900">{campaign.totalSent}</p>
                              <p className="text-xs text-green-700">Sent Successfully</p>
                            </div>
                          </div>
                        </div>
                        {campaign.totalFailed > 0 && (
                          <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                            <div className="flex items-center space-x-2">
                              <XCircle className="h-5 w-5 text-red-600" />
                              <div>
                                <p className="text-2xl font-bold text-red-900">{campaign.totalFailed}</p>
                                <p className="text-xs text-red-700">Failed</p>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="ml-4 flex flex-col space-y-2">
                    <button
                      onClick={() => setPreviewCampaign(campaign)}
                      className="inline-flex items-center px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      Preview
                    </button>
                    
                    {campaign.status === "DRAFT" && (
                      <>
                        <button
                          onClick={() => handleOpenModal(campaign)}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                        >
                          <Edit className="h-4 w-4 mr-2" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleSendCampaign(campaign.id)}
                          disabled={sendingCampaignId === campaign.id}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 rounded-lg transition-all disabled:opacity-50"
                        >
                          {sendingCampaignId === campaign.id ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Send className="h-4 w-4 mr-2" />
                              Send Now
                            </>
                          )}
                        </button>
                        <button
                          onClick={() => handleDeleteCampaign(campaign.id)}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </button>
                        <button
                          onClick={() => openAIAmendModal(campaign.id)}
                          className="inline-flex items-center px-3 py-2 text-sm font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors"
                        >
                          <Wand2 className="h-4 w-4 mr-2" />
                          AI Edit
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}

          {campaigns.length === 0 && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
              <Wand2 className="mx-auto h-12 w-12 text-purple-400 mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">No campaigns yet</h3>
              <p className="text-sm text-gray-600 mb-4">
                Let AI create stunning campaign designs, choose from templates, or build from scratch
              </p>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  onClick={() => setShowAIGenerateModal(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg transition-all"
                >
                  <Wand2 className="h-5 w-5 mr-2" />
                  AI Generate Campaign
                </button>
                <button
                  onClick={() => setShowTemplateModal(true)}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 rounded-lg transition-all"
                >
                  <LayoutTemplate className="h-5 w-5 mr-2" />
                  Choose Template
                </button>
                <button
                  onClick={() => handleOpenModal()}
                  className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 rounded-lg transition-all"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Manual Create
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Campaign Modal */}
      <Transition appear show={showModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={handleCloseModal}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-6xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                  {/* Modal Header */}
                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 flex-shrink-0">
                    <Dialog.Title className="text-lg font-semibold text-white">
                      {editingCampaign ? "Edit Campaign" : "Create New Campaign"}
                    </Dialog.Title>
                    <button
                      onClick={handleCloseModal}
                      disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors disabled:opacity-50"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  {/* Modal Content */}
                  <div className="overflow-y-auto flex-1 min-h-0">
                    <form onSubmit={handleSubmit(onSubmit)} className="p-6">
                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Left Column: Basic Info */}
                        <div className="lg:col-span-1 space-y-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Campaign Name *
                            </label>
                            <input
                              type="text"
                              {...register("name")}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Summer Promotion 2024"
                            />
                            {errors.name && (
                              <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                            )}
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Description
                            </label>
                            <textarea
                              {...register("description")}
                              rows={3}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Internal notes about this campaign..."
                            />
                          </div>

                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">
                              Email Subject *
                            </label>
                            <input
                              type="text"
                              {...register("subject")}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                              placeholder="Special Offer for {{customerName}}"
                            />
                            {errors.subject && (
                              <p className="mt-1 text-sm text-red-600">{errors.subject.message}</p>
                            )}
                            <p className="mt-1 text-xs text-gray-500">
                              You can use personalization tokens like {`{{customerName}}`}
                            </p>
                          </div>

                          {/* Target Audience */}
                          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                            <div className="flex items-center space-x-2 mb-3">
                              <Target className="h-4 w-4 text-blue-600" />
                              <h3 className="text-sm font-semibold text-blue-900">Target Audience</h3>
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-xs font-medium text-blue-900 mb-1">
                                  Lead Status
                                </label>
                                <select
                                  multiple
                                  {...register("targetStatuses")}
                                  className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  size={4}
                                >
                                  {leadStatuses.map((status) => (
                                    <option key={status} value={status}>
                                      {status}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-xs text-blue-700">Hold Ctrl/Cmd to select multiple</p>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-blue-900 mb-1">
                                  Service Type
                                </label>
                                <select
                                  multiple
                                  {...register("targetServiceTypes")}
                                  className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                  size={4}
                                >
                                  {serviceTypeOptions.map((type) => (
                                    <option key={type} value={type}>
                                      {type === OTHER_SERVICE_TYPE_VALUE ? "Other" : type}
                                    </option>
                                  ))}
                                </select>
                                <p className="mt-1 text-xs text-blue-700">Hold Ctrl/Cmd to select multiple</p>
                              </div>

                              {showOtherServiceType && (
                                <div>
                                  <label className="block text-xs font-medium text-blue-900 mb-1">
                                    Specify service type
                                  </label>
                                  <input
                                    type="text"
                                    {...register("otherServiceType")}
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Enter the service type"
                                  />
                                  {errors.otherServiceType && (
                                    <p className="mt-1 text-sm text-red-600">{errors.otherServiceType.message}</p>
                                  )}
                                </div>
                              )}

                              <div>
                                <label className="block text-xs font-medium text-blue-900 mb-1">
                                  Estimated Value Range
                                </label>
                                <div className="grid grid-cols-2 gap-2">
                                  <input
                                    type="number"
                                    {...register("estimatedValueMin", { valueAsNumber: true })}
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Min"
                                  />
                                  <input
                                    type="number"
                                    {...register("estimatedValueMax", { valueAsNumber: true })}
                                    className="w-full px-2 py-1 text-sm border border-blue-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="Max"
                                  />
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-blue-900 mb-2">
                                  Target Customers
                                </label>
                                <div className="bg-white border border-blue-300 rounded p-2 max-h-48 overflow-y-auto">
                                  <div className="mb-2 pb-2 border-b border-blue-200">
                                    <label className="flex items-center space-x-2 cursor-pointer">
                                      <input
                                        type="checkbox"
                                        checked={selectAllCustomers}
                                        onChange={(e) => handleSelectAllCustomers(e.target.checked)}
                                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                      />
                                      <span className="text-sm font-medium text-blue-900">Select All Customers</span>
                                    </label>
                                  </div>
                                  {customersQuery.isLoading ? (
                                    <div className="text-center py-4">
                                      <Loader2 className="h-5 w-5 animate-spin mx-auto text-blue-600" />
                                      <p className="text-xs text-blue-700 mt-2">Loading customers...</p>
                                    </div>
                                  ) : customers.length === 0 ? (
                                    <p className="text-xs text-blue-700 text-center py-4">No customers found</p>
                                  ) : (
                                    <div className="space-y-1">
                                      {customers.map((customer) => {
                                        const isSelected = selectedCustomerIds.includes(customer.id);
                                        const isExcluded = excludedCustomerIds.includes(customer.id);
                                        return (
                                          <div key={customer.id} className="flex items-center justify-between py-1">
                                            <label className="flex items-center space-x-2 cursor-pointer flex-1">
                                              <input
                                                type="checkbox"
                                                checked={isSelected}
                                                onChange={() => handleCustomerToggle(customer.id)}
                                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                              />
                                              <span className="text-xs text-gray-900">
                                                {customer.firstName} {customer.lastName}
                                                <span className="text-gray-500 ml-1">({customer.email})</span>
                                              </span>
                                            </label>
                                            {isSelected && (
                                              <button
                                                type="button"
                                                onClick={() => handleCustomerExclude(customer.id)}
                                                className={`text-xs px-2 py-0.5 rounded transition-colors ${
                                                  isExcluded
                                                    ? "bg-red-100 text-red-800 hover:bg-red-200"
                                                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                                }`}
                                              >
                                                {isExcluded ? "Excluded" : "Exclude"}
                                              </button>
                                            )}
                                          </div>
                                        );
                                      })}
                                    </div>
                                  )}
                                </div>
                                <p className="mt-1 text-xs text-blue-700">
                                  {selectedCustomerIds.length > 0 
                                    ? `${selectedCustomerIds.length - excludedCustomerIds.length} customer(s) selected${excludedCustomerIds.length > 0 ? `, ${excludedCustomerIds.length} excluded` : ""}`
                                    : "Select customers to target"}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>

                        {/* Right Column: Email Editor */}
                        <div className="lg:col-span-2">
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Email Content *
                          </label>
                          <CampaignEditor
                            value={htmlBody}
                            onChange={(html) => setValue("htmlBody", html)}
                            placeholder="Design your email here... Use the toolbar to format text and insert personalization tokens."
                          />
                          {errors.htmlBody && (
                            <p className="mt-1 text-sm text-red-600">{errors.htmlBody.message}</p>
                          )}
                          <p className="mt-2 text-xs text-gray-500">
                            Your email will be wrapped with company branding automatically when sent.
                          </p>
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex justify-end space-x-3 mt-6 pt-6 border-t border-gray-200">
                        <button
                          type="button"
                          onClick={handleCloseModal}
                          disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                          className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          disabled={createCampaignMutation.isPending || updateCampaignMutation.isPending}
                          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-indigo-700 hover:from-purple-700 hover:to-indigo-800 rounded-lg disabled:opacity-50 transition-all"
                        >
                          {(createCampaignMutation.isPending || updateCampaignMutation.isPending) ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              {editingCampaign ? "Updating..." : "Creating..."}
                            </>
                          ) : (
                            <>
                              {editingCampaign ? "Update Campaign" : "Create Campaign"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Preview Modal */}
      <Transition appear show={previewCampaign !== null} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setPreviewCampaign(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between bg-gradient-to-r from-purple-600 to-indigo-700 px-6 py-4 flex-shrink-0">
                    <Dialog.Title className="text-lg font-semibold text-white">
                      Campaign Preview
                    </Dialog.Title>
                    <button
                      onClick={() => setPreviewCampaign(null)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {previewCampaign && (
                      <div className="space-y-4">
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-1">Subject:</p>
                          <p className="text-gray-900">{previewCampaign.subject}</p>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-sm font-medium text-gray-700 mb-3">Email Content:</p>
                          <div
                            className="prose prose-sm max-w-none bg-white border border-gray-200 rounded p-4"
                            dangerouslySetInnerHTML={{ __html: previewCampaign.htmlBody }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Send Result Modal */}
      {sendResult && (
        <Transition appear show={true} as={Fragment}>
          <Dialog as="div" className="relative z-50" onClose={() => setSendResult(null)}>
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0"
              enterTo="opacity-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100"
              leaveTo="opacity-0"
            >
              <div className="fixed inset-0 bg-black bg-opacity-25" />
            </Transition.Child>

            <div className="fixed inset-0 overflow-y-auto">
              <div className="flex min-h-full items-center justify-center p-4">
                <Transition.Child
                  as={Fragment}
                  enter="ease-out duration-300"
                  enterFrom="opacity-0 scale-95"
                  enterTo="opacity-100 scale-100"
                  leave="ease-in duration-200"
                  leaveFrom="opacity-100 scale-100"
                  leaveTo="opacity-0 scale-95"
                >
                  <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                    <div className="flex items-center justify-between bg-gradient-to-r from-green-600 to-emerald-700 px-6 py-4 flex-shrink-0">
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Campaign Sent
                      </Dialog.Title>
                      <button
                        onClick={() => setSendResult(null)}
                        className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                      >
                        <XCircle className="h-5 w-5" />
                      </button>
                    </div>

                    <div className="p-6 space-y-4 overflow-y-auto flex-1 min-h-0">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                        <div className="flex items-center space-x-2 mb-2">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <h3 className="font-semibold text-green-900">
                            Successfully Sent: {sendResult.totalSent}
                          </h3>
                        </div>
                        {sendResult.successful.length > 0 && (
                          <ul className="text-sm text-green-800 space-y-1 ml-7 max-h-48 overflow-y-auto">
                            {sendResult.successful.map((recipient: any, idx: number) => (
                              <li key={idx}>
                                {recipient.name} ({recipient.email})
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      {sendResult.totalFailed > 0 && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                          <div className="flex items-center space-x-2 mb-2">
                            <XCircle className="h-5 w-5 text-red-600" />
                            <h3 className="font-semibold text-red-900">
                              Failed to Send: {sendResult.totalFailed}
                            </h3>
                          </div>
                          {sendResult.failed.length > 0 && (
                            <ul className="text-sm text-red-800 space-y-1 ml-7 max-h-48 overflow-y-auto">
                              {sendResult.failed.map((recipient: any, idx: number) => (
                                <li key={idx}>
                                  {recipient.name} ({recipient.email}) - {recipient.error}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      )}

                      <div className="flex justify-end pt-4 border-t border-gray-200">
                        <button
                          onClick={() => setSendResult(null)}
                          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 rounded-lg transition-all"
                        >
                          Close
                        </button>
                      </div>
                    </div>
                  </Dialog.Panel>
                </Transition.Child>
              </div>
            </div>
          </Dialog>
        </Transition>
      )}

      {/* Template Picker Modal */}
      <Transition appear show={showTemplateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setShowTemplateModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-5xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between bg-gradient-to-r from-emerald-500 to-teal-600 px-6 py-4 flex-shrink-0 rounded-t-2xl">
                    <div className="flex items-center space-x-3">
                      <LayoutTemplate className="h-6 w-6 text-white" />
                      <Dialog.Title className="text-lg font-semibold text-white">
                        Campaign Templates
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={() => setShowTemplateModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 overflow-y-auto flex-1 min-h-0">
                    {/* Category Filter */}
                    <div className="flex flex-wrap gap-2 mb-6">
                      {templateCategories.map((cat) => (
                        <button
                          key={cat.category}
                          onClick={() => setTemplateCategory(cat.category)}
                          className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                            templateCategory === cat.category
                              ? "bg-emerald-100 text-emerald-800"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                          }`}
                        >
                          {cat.icon} {cat.label} ({cat.count})
                        </button>
                      ))}
                    </div>

                    {/* Templates Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {templates.map((template) => (
                        <div
                          key={template.id}
                          className="bg-white border border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-all group cursor-pointer"
                          onClick={() => handleSelectTemplate(template)}
                        >
                          {/* Template Preview Card */}
                          <div
                            className="h-32 flex items-center justify-center"
                            style={{ background: template.thumbnail }}
                          >
                            <div className="text-center text-white">
                              <div className="text-3xl mb-1">
                                {template.category === 'discount' ? '💰' :
                                 template.category === 'seasonal' ? '🌤️' :
                                 template.category === 'service' ? '🔧' :
                                 template.category === 'followup' ? '📩' :
                                 template.category === 'newsletter' ? '📬' :
                                 template.category === 'holiday' ? '🎄' : '📢'}
                              </div>
                              <p className="text-sm font-semibold opacity-90">{template.name}</p>
                            </div>
                          </div>
                          <div className="p-4">
                            <h4 className="font-semibold text-gray-900 text-sm mb-1">{template.name}</h4>
                            <p className="text-xs text-gray-500 mb-3 line-clamp-2">{template.description}</p>
                            <div className="flex flex-wrap gap-1 mb-3">
                              {template.tags.slice(0, 3).map((tag: string) => (
                                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
                              ))}
                            </div>
                            <button className="w-full py-2 text-sm font-medium text-emerald-700 bg-emerald-50 rounded-lg group-hover:bg-emerald-100 transition-colors">
                              Use This Template
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>

                    {templates.length === 0 && (
                      <div className="text-center py-12">
                        <LayoutTemplate className="mx-auto h-12 w-12 text-gray-300 mb-4" />
                        <p className="text-gray-500">No templates found in this category</p>
                      </div>
                    )}
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* AI Generate Campaign Modal */}
      <Transition appear show={showAIGenerateModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !generateCampaignMutation.isPending && setShowAIGenerateModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-600 px-6 py-4 rounded-t-2xl">
                    <div className="flex items-center space-x-3">
                      <Wand2 className="h-6 w-6 text-white" />
                      <Dialog.Title className="text-lg font-semibold text-white">
                        AI Campaign Generator
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={() => !generateCampaignMutation.isPending && setShowAIGenerateModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-5">
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Sparkles className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-amber-900">Describe your campaign</p>
                          <p className="text-xs text-amber-700 mt-1">
                            Tell the AI what kind of campaign you want and it will generate professional content, 
                            graphics, and layout for you. Example: "10% discount on all plumbing services for January"
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Campaign Description *</label>
                      <textarea
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        placeholder="E.g., Create a summer maintenance special with 10% discount on all services, targeting homeowners..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-amber-500 focus:border-amber-500 min-h-[100px] resize-none"
                        disabled={generateCampaignMutation.isPending}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Service Focus</label>
                        <select
                          value={aiServiceType}
                          onChange={(e) => setAiServiceType(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                          disabled={generateCampaignMutation.isPending}
                        >
                          <option value="">All Services</option>
                          {serviceTypes.map((type) => (
                            <option key={type} value={type}>{type}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Discount %</label>
                        <input
                          type="number"
                          value={aiDiscount}
                          onChange={(e) => setAiDiscount(e.target.value)}
                          placeholder="e.g., 10"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-amber-500"
                          disabled={generateCampaignMutation.isPending}
                          min="0"
                          max="100"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Tone & Style</label>
                      <div className="flex flex-wrap gap-2">
                        {(['professional', 'friendly', 'urgent', 'festive', 'casual'] as const).map((tone) => (
                          <button
                            key={tone}
                            type="button"
                            onClick={() => setAiTone(tone)}
                            className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors capitalize ${
                              aiTone === tone
                                ? "bg-amber-100 text-amber-800 ring-2 ring-amber-400"
                                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                            }`}
                            disabled={generateCampaignMutation.isPending}
                          >
                            {tone === 'professional' ? '💼' : tone === 'friendly' ? '😊' : tone === 'urgent' ? '⚡' : tone === 'festive' ? '🎉' : '✌️'} {tone}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowAIGenerateModal(false)}
                        disabled={generateCampaignMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAIGenerate}
                        disabled={generateCampaignMutation.isPending || !aiPrompt.trim()}
                        className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-600 hover:to-orange-700 rounded-lg disabled:opacity-50 transition-all"
                      >
                        {generateCampaignMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Generating Design...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Generate Campaign
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* AI Amend Campaign Modal */}
      <Transition appear show={showAIAmendModal} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => !amendCampaignMutation.isPending && setShowAIAmendModal(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>
          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-lg transform rounded-2xl bg-white text-left align-middle shadow-xl transition-all">
                  <div className="flex items-center justify-between bg-gradient-to-r from-violet-500 to-purple-600 px-6 py-4 rounded-t-2xl">
                    <div className="flex items-center space-x-3">
                      <MessageSquare className="h-6 w-6 text-white" />
                      <Dialog.Title className="text-lg font-semibold text-white">
                        AI Campaign Editor
                      </Dialog.Title>
                    </div>
                    <button
                      onClick={() => !amendCampaignMutation.isPending && setShowAIAmendModal(false)}
                      className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors"
                    >
                      <XCircle className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="p-6 space-y-4">
                    <div className="bg-violet-50 border border-violet-200 rounded-lg p-4">
                      <div className="flex items-start space-x-3">
                        <Wand2 className="h-5 w-5 text-violet-600 mt-0.5 flex-shrink-0" />
                        <div>
                          <p className="text-sm font-medium text-violet-900">Tell the AI what to change</p>
                          <p className="text-xs text-violet-700 mt-1">
                            Describe the changes you want and AI will modify the campaign design, content, colors, 
                            or layout accordingly.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Amendment Instructions *</label>
                      <textarea
                        value={aiAmendInstruction}
                        onChange={(e) => setAiAmendInstruction(e.target.value)}
                        placeholder="E.g., Change the discount to 15%, make the colors blue and white, add a section about our warranty..."
                        className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm focus:ring-2 focus:ring-violet-500 focus:border-violet-500 min-h-[120px] resize-none"
                        disabled={amendCampaignMutation.isPending}
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <p className="text-xs text-gray-500 w-full mb-1">Quick edits:</p>
                      {[
                        "Make it more urgent",
                        "Change colors to blue",
                        "Add more details",
                        "Make it shorter",
                        "Change discount to 15%",
                        "Add a warranty section",
                      ].map((suggestion) => (
                        <button
                          key={suggestion}
                          type="button"
                          onClick={() => setAiAmendInstruction(suggestion)}
                          className="text-xs bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200 transition-colors"
                          disabled={amendCampaignMutation.isPending}
                        >
                          {suggestion}
                        </button>
                      ))}
                    </div>

                    <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                      <button
                        type="button"
                        onClick={() => setShowAIAmendModal(false)}
                        disabled={amendCampaignMutation.isPending}
                        className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleAmendCampaign}
                        disabled={amendCampaignMutation.isPending || !aiAmendInstruction.trim()}
                        className="inline-flex items-center px-6 py-2 text-sm font-medium text-white bg-gradient-to-r from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700 rounded-lg disabled:opacity-50 transition-all"
                      >
                        {amendCampaignMutation.isPending ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Applying Changes...
                          </>
                        ) : (
                          <>
                            <Wand2 className="h-4 w-4 mr-2" />
                            Apply Changes
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
