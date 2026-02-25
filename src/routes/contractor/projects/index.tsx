import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  FolderKanban,
  Phone,
  Mail,
  MapPin,
  Calendar,
  DollarSign,
  User,
  Building2,
  Loader2,
  Download,
  FileText,
  Sparkles,
  Brain,
  Target,
  AlertTriangle,
  Lightbulb,
  TrendingUpIcon,
  BarChart3,
} from "lucide-react";
import MilestoneManager from "~/components/projects/MilestoneManager";

export const Route = createFileRoute("/contractor/projects/")({
  component: ProjectsPageGuarded,
});

function ProjectsPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasProjectManagement" returnPath="/contractor/dashboard">
      <ProjectsPage />
    </RequireSubscriptionFeature>
  );
}

const projectSchema = z.object({
  name: z.string().min(1, "Project name is required"),
  description: z.string().min(1, "Description is required"),
  customerName: z.string().min(1, "Customer name is required"),
  customerEmail: z.string().email("Invalid email address"),
  customerPhone: z.string().min(1, "Phone number is required"),
  address: z.string().min(1, "Address is required"),
  projectType: z.string().min(1, "Project type is required"),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  estimatedBudget: z.number().optional(),
});

type ProjectForm = z.infer<typeof projectSchema>;

const projectStatuses = [
  { value: "PLANNING", label: "Planning", color: "bg-gray-100 text-gray-800" },
  { value: "IN_PROGRESS", label: "In Progress", color: "bg-blue-100 text-blue-800" },
  { value: "ON_HOLD", label: "On Hold", color: "bg-yellow-100 text-yellow-800" },
  { value: "COMPLETED", label: "Completed", color: "bg-green-100 text-green-800" },
  { value: "CANCELLED", label: "Cancelled", color: "bg-red-100 text-red-800" },
];

function ProjectsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [viewingProjectId, setViewingProjectId] = useState<number | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<number | null>(null);
  const [showAIInsights, setShowAIInsights] = useState(false);
  const [aiInsights, setAiInsights] = useState<any>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  const projectsQuery = useQuery(
    trpc.getProjects.queryOptions({
      token: token!,
      status: statusFilter as any,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<ProjectForm>({
    resolver: zodResolver(projectSchema),
  });

  const createProjectMutation = useMutation(
    trpc.createProject.mutationOptions({
      onSuccess: () => {
        toast.success("Project created successfully!");
        queryClient.invalidateQueries({ 
          queryKey: ["getProjects"] 
        });
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create project");
      },
    })
  );

  const updateProjectStatusMutation = useMutation(
    trpc.updateProjectStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Project status updated!");
        queryClient.invalidateQueries({ 
          queryKey: ["getProjects"] 
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update project status");
      },
    })
  );

  const updateActualCostMutation = useMutation(
    trpc.updateProjectActualCost.mutationOptions({
      onSuccess: (data) => {
        toast.success("Project costs updated!");
        queryClient.invalidateQueries({ 
          queryKey: ["getProjects"] 
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update project costs");
      },
    })
  );

  const updateProjectDetailsMutation = useMutation(
    trpc.updateProjectDetails.mutationOptions({
      onSuccess: () => {
        toast.success("Project details updated successfully!");
        queryClient.invalidateQueries({ 
          queryKey: ["getProjects"] 
        });
        reset();
        setShowAddForm(false);
        setEditingProjectId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update project details");
      },
    })
  );

  const generateProjectReportMutation = useMutation(
    trpc.generateProjectReportPdf.mutationOptions({
      onSuccess: (data) => {
        // Decode base64 PDF and trigger download
        const binaryString = atob(data.pdf);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        const currentProject = projects.find((p) => p.id === viewingProjectId);
        const filename = currentProject 
          ? `${currentProject.projectNumber}_${currentProject.name.replace(/\s+/g, "_")}_Full_Report.pdf`
          : `Project_Report_${new Date().getTime()}.pdf`;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);
        toast.success("Project report downloaded successfully!");
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate project report");
      },
    })
  );

  const getBudgetStatus = (project: any) => {
    if (!project.estimatedBudget || project.estimatedBudget === 0) {
      return { status: "no-budget", color: "text-gray-600", bgColor: "bg-gray-100" };
    }
    
    const variance = project.actualCost - project.estimatedBudget;
    const variancePercentage = (variance / project.estimatedBudget) * 100;
    
    if (variancePercentage > 10) {
      return { 
        status: "over-budget", 
        color: "text-red-600", 
        bgColor: "bg-red-100",
        variance,
        variancePercentage 
      };
    } else if (variancePercentage > 0) {
      return { 
        status: "at-budget", 
        color: "text-yellow-600", 
        bgColor: "bg-yellow-100",
        variance,
        variancePercentage 
      };
    } else {
      return { 
        status: "under-budget", 
        color: "text-green-600", 
        bgColor: "bg-green-100",
        variance,
        variancePercentage 
      };
    }
  };

  const handleEditProject = (project: any) => {
    setEditingProjectId(project.id);
    setShowAddForm(true);
    reset({
      name: project.name,
      description: project.description,
      customerName: project.customerName,
      customerEmail: project.customerEmail,
      customerPhone: project.customerPhone,
      address: project.address,
      projectType: project.projectType,
      startDate: project.startDate ? new Date(project.startDate).toISOString().split('T')[0] : undefined,
      endDate: project.endDate ? new Date(project.endDate).toISOString().split('T')[0] : undefined,
      estimatedBudget: project.estimatedBudget || undefined,
    });
  };

  const onSubmit = (data: ProjectForm) => {
    if (editingProjectId) {
      updateProjectDetailsMutation.mutate({
        token: token!,
        projectId: editingProjectId,
        ...data,
      });
    } else {
      createProjectMutation.mutate({
        token: token!,
        ...data,
      });
    }
  };

  const projects = projectsQuery.data || [];
  const filteredProjects = projects.filter((project) =>
    project.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.projectType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Calculate status metrics
  const statusMetrics = projectStatuses.map((status) => ({
    ...status,
    count: projects.filter((p) => p.status === status.value).length,
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
              <div className="bg-gradient-to-br from-purple-600 to-purple-700 p-2 rounded-xl shadow-md">
                <FolderKanban className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Project Management</h1>
                <p className="text-sm text-gray-600">{projects.length} total projects</p>
              </div>
            </div>
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <button
                onClick={() => {
                  setShowAIInsights(!showAIInsights);
                  setShowAddForm(false);
                  setViewingProjectId(null);
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-purple-300 text-sm font-medium rounded-lg text-purple-700 bg-purple-50 hover:bg-purple-100 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-sm transition-all"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                AI Insights
              </button>
              <button
                onClick={() => {
                  setShowAddForm(!showAddForm);
                  setEditingProjectId(null);
                  reset();
                }}
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 shadow-md transition-all"
              >
                <Plus className="h-5 w-5 mr-2" />
                Add Project
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* AI Insights View */}
        {showAIInsights && (
          <div className="space-y-6 mb-8">
            {/* AI Insights Header */}
            <div className="bg-gradient-to-br from-purple-50 via-blue-50 to-indigo-50 rounded-2xl p-8 border border-purple-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl shadow-lg">
                    <Brain className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-gray-900">AI Project Insights</h2>
                    <p className="text-sm text-gray-600 mt-1">
                      AI-powered analysis of your project portfolio and strategic recommendations
                    </p>
                  </div>
                </div>
                <button
                  onClick={async () => {
                    setGeneratingInsights(true);
                    try {
                      const totalEstimatedBudget = projects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
                      const totalActualCost = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
                      
                      const result = await trpc.generateProjectInsights.mutate({
                        token: token!,
                        projectsData: {
                          projects: projects.slice(0, 20).map(p => ({
                            name: p.name,
                            status: p.status,
                            projectType: p.projectType,
                            estimatedBudget: p.estimatedBudget,
                            actualCost: p.actualCost,
                            startDate: p.startDate,
                            endDate: p.endDate,
                            customerName: p.customerName,
                            milestones: [],
                          })),
                          summary: {
                            total: projects.length,
                            planning: projects.filter(p => p.status === 'PLANNING').length,
                            inProgress: projects.filter(p => p.status === 'IN_PROGRESS').length,
                            onHold: projects.filter(p => p.status === 'ON_HOLD').length,
                            completed: projects.filter(p => p.status === 'COMPLETED').length,
                            cancelled: projects.filter(p => p.status === 'CANCELLED').length,
                            totalEstimatedBudget,
                            totalActualCost,
                          },
                        },
                      });
                      setAiInsights(result.insights);
                      toast.success("AI insights generated successfully!");
                    } catch (error: any) {
                      toast.error(error.message || "Failed to generate insights");
                    } finally {
                      setGeneratingInsights(false);
                    }
                  }}
                  disabled={generatingInsights}
                  className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {generatingInsights ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white" />
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>{aiInsights ? 'Regenerate' : 'Generate'} Insights</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* AI Insights Content */}
            {aiInsights && (
              <div className="space-y-6">
                {/* Parse and Display AI Insights */}
                {aiInsights.rawText.split('\n\n').map((section: string, index: number) => {
                  const lines = section.trim().split('\n');
                  if (lines.length === 0) return null;

                  const [headerLine = '', ...contentLines] = lines;
                  const header = headerLine.replace(/^\*\*|\*\*$/g, '').replace(/^#+\s*/, '');

                  let icon = Brain;
                  let iconColor = "from-blue-500 to-blue-600";

                  if (header.toLowerCase().includes('assessment') || header.toLowerCase().includes('health')) {
                    icon = TrendingUpIcon;
                    iconColor = "from-green-500 to-emerald-600";
                  } else if (header.toLowerCase().includes('strength')) {
                    icon = Target;
                    iconColor = "from-blue-500 to-indigo-600";
                  } else if (header.toLowerCase().includes('issue') || header.toLowerCase().includes('critical') || header.toLowerCase().includes('risk')) {
                    icon = AlertTriangle;
                    iconColor = "from-orange-500 to-red-600";
                  } else if (header.toLowerCase().includes('recommendation') || header.toLowerCase().includes('optimization') || header.toLowerCase().includes('resource')) {
                    icon = Lightbulb;
                    iconColor = "from-purple-500 to-pink-600";
                  } else if (header.toLowerCase().includes('score') || header.toLowerCase().includes('performance')) {
                    icon = BarChart3;
                    iconColor = "from-indigo-500 to-purple-600";
                  }

                  const IconComponent = icon;

                  return (
                    <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
                      <div className="flex items-start gap-4">
                        <div className={`p-3 bg-gradient-to-br ${iconColor} rounded-xl shadow-md flex-shrink-0`}>
                          <IconComponent className="w-6 h-6 text-white" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-semibold text-gray-900 mb-3">{header}</h3>
                          <div className="prose prose-sm max-w-none text-gray-700 space-y-2">
                            {contentLines.map((line, i) => {
                              const trimmedLine = line.trim();
                              if (!trimmedLine) return null;

                              if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ') || trimmedLine.startsWith('• ')) {
                                return (
                                  <div key={i} className="flex items-start gap-2 ml-2">
                                    <span className="text-blue-500 mt-1.5">•</span>
                                    <span className="flex-1">{trimmedLine.replace(/^[-*•]\s*/, '').replace(/^\*\*|\*\*$/g, '')}</span>
                                  </div>
                                );
                              } else if (trimmedLine.match(/^\d+\./)) {
                                return (
                                  <div key={i} className="flex items-start gap-2 ml-2">
                                    <span className="font-semibold text-blue-600">{trimmedLine.match(/^\d+\./)![0]}</span>
                                    <span className="flex-1">{trimmedLine.replace(/^\d+\.\s*/, '').replace(/^\*\*|\*\*$/g, '')}</span>
                                  </div>
                                );
                              } else {
                                return <p key={i} className="leading-relaxed">{trimmedLine.replace(/^\*\*|\*\*$/g, '')}</p>;
                              }
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}

                {/* Generated At Footer */}
                <div className="text-center text-sm text-gray-500">
                  Generated {new Date(aiInsights.generatedAt).toLocaleString()} • Powered by Claude AI
                </div>
              </div>
            )}

            {/* Empty State */}
            {!aiInsights && !generatingInsights && (
              <div className="text-center py-16 bg-white rounded-xl shadow-sm border border-gray-200">
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-full mb-4">
                  <Brain className="w-8 h-8 text-purple-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">No Insights Yet</h3>
                <p className="text-gray-600 mb-6 max-w-md mx-auto">
                  Click "Generate Insights" to get AI-powered analysis of your project portfolio with strategic recommendations.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Status Overview */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Project Status</h2>
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

        {/* Add Project Form */}
        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">
              {editingProjectId ? "Edit Project" : "Add New Project"}
            </h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Name *
                </label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Affordable Housing Development"
                />
                {errors.name && (
                  <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Project Type *
                </label>
                <select
                  {...register("projectType")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Select type</option>
                  <option value="Affordable Housing">Affordable Housing</option>
                  <option value="Social Housing">Social Housing</option>
                  <option value="Shopping Center">Shopping Center</option>
                  <option value="Commercial Development">Commercial Development</option>
                  <option value="Residential Development">Residential Development</option>
                </select>
                {errors.projectType && (
                  <p className="mt-1 text-sm text-red-600">{errors.projectType.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Customer Name *
                </label>
                <input
                  type="text"
                  {...register("customerName")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="John Doe"
                />
                {errors.customerName && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerName.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Email *
                </label>
                <input
                  type="email"
                  {...register("customerEmail")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="+27 123 456 789"
                />
                {errors.customerPhone && (
                  <p className="mt-1 text-sm text-red-600">{errors.customerPhone.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  {...register("address")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="123 Main St, City"
                />
                {errors.address && (
                  <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>
                )}
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  {...register("startDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  {...register("endDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>

              <div className="md:col-span-1">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Estimated Budget (R)
                </label>
                <input
                  type="number"
                  {...register("estimatedBudget", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="1000000"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description *
                </label>
                <textarea
                  {...register("description")}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Describe the project details..."
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                )}
              </div>

              <div className="md:col-span-2 flex flex-col sm:flex-row justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingProjectId(null);
                    reset();
                  }}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createProjectMutation.isPending || updateProjectDetailsMutation.isPending}
                  className="w-full sm:w-auto px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {editingProjectId 
                    ? (updateProjectDetailsMutation.isPending ? "Updating..." : "Update Project")
                    : (createProjectMutation.isPending ? "Creating..." : "Create Project")
                  }
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Project Detail View with Milestones */}
        {viewingProjectId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
              <h2 className="text-xl font-bold text-gray-900">
                Project Details & Milestones
              </h2>
              <div className="w-full sm:w-auto flex flex-col sm:flex-row items-stretch gap-2">
                {(() => {
                  const currentProject = projects.find((p) => p.id === viewingProjectId);
                  return currentProject?.status === "COMPLETED" && (
                    <button
                      onClick={() => generateProjectReportMutation.mutate({
                        token: token!,
                        projectId: viewingProjectId,
                      })}
                      disabled={generateProjectReportMutation.isPending}
                      className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 rounded-lg disabled:opacity-50 transition-all shadow-md"
                      title="Download comprehensive project report"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      {generateProjectReportMutation.isPending ? "Generating..." : "Download Full Report"}
                    </button>
                  );
                })()}
                <button
                  onClick={() => setViewingProjectId(null)}
                  className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Back to Projects List
                </button>
              </div>
            </div>
            <MilestoneManager
              projectId={viewingProjectId}
              projectBudget={projects.find((p) => p.id === viewingProjectId)?.estimatedBudget || undefined}
            />
          </div>
        )}

        {/* Search and Filter */}
        {!viewingProjectId && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
            <div className="flex flex-col sm:flex-row items-center gap-4">
              <div className="w-full flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search projects by name, customer, or type..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
              </div>
              <button
                onClick={() => setStatusFilter(null)}
                className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              >
                <Filter className="h-5 w-5 mr-2" />
                {statusFilter ? "Clear Filter" : "All Projects"}
              </button>
            </div>
          </div>
        )}

        {/* Projects List */}
        {!viewingProjectId && (
          <div className="space-y-4">
            {filteredProjects.map((project) => (
              <div key={project.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col md:flex-row items-start justify-between gap-4">
                    <div className="flex-1 w-full">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
                        <h3 className="text-lg font-semibold text-gray-900">{project.name}</h3>
                        <span className="text-sm text-gray-500">{project.projectNumber}</span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            projectStatuses.find((s) => s.value === project.status)?.color
                          }`}
                        >
                          {projectStatuses.find((s) => s.value === project.status)?.label}
                        </span>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 mt-3 border-t border-gray-200 pt-3">
                        <div className="flex items-start">
                          <User className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                          <span>{project.customerName}</span>
                        </div>
                        <div className="flex items-start">
                          <Mail className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                          <span className="truncate">{project.customerEmail}</span>
                        </div>
                        <div className="flex items-start">
                          <Phone className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                          <span>{project.customerPhone}</span>
                        </div>
                        <div className="flex items-start">
                          <MapPin className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                          <span>{project.address}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm text-gray-600 mt-3 border-t border-gray-200 pt-3">
                        <div className="flex items-start">
                          <Building2 className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                          <div>
                            <span className="font-medium">Type:</span>&nbsp;{project.projectType}
                          </div>
                        </div>
                        {project.estimatedBudget && (
                          <div className="flex items-start">
                            <DollarSign className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Budget:</span>&nbsp;R{(project.estimatedBudget || 0).toLocaleString()}
                            </div>
                          </div>
                        )}
                        {project.startDate && (
                          <div className="flex items-start">
                            <Calendar className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                            <div>
                              <span className="font-medium">Start:</span>&nbsp;{new Date(project.startDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                        {project.endDate && (
                          <div className="flex items-start">
                            <Calendar className="h-4 w-4 mr-2 mt-0.5 text-gray-400 flex-shrink-0" />
                            <div>
                              <span className="font-medium">End:</span>&nbsp;{new Date(project.endDate).toLocaleDateString()}
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="mt-3 border-t border-gray-200 pt-3">
                        <p className="text-sm text-gray-600">{project.description}</p>
                      </div>

                      {/* Budget vs Actual Tracking */}
                      {project.estimatedBudget && (
                        <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-gray-900">Budget Tracking</h4>
                            <button
                              onClick={() =>
                                updateActualCostMutation.mutate({
                                  token: token!,
                                  projectId: project.id,
                                })
                              }
                              disabled={updateActualCostMutation.isPending}
                              className="text-xs font-medium text-teal-700 hover:text-teal-800 disabled:opacity-50"
                            >
                              {updateActualCostMutation.isPending ? "Updating..." : "Recalculate"}
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm mb-3">
                            <div>
                              <span className="text-gray-600">Budget:</span>
                              <span className="ml-2 font-semibold text-gray-900">
                                R{(project.estimatedBudget || 0).toLocaleString()}
                              </span>
                            </div>
                            <div>
                              <span className="text-gray-600">Actual:</span>
                              <span className="ml-2 font-semibold text-gray-900">
                                R{(project.actualCost || 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {(() => {
                            const budgetStatus = getBudgetStatus(project);
                            const percentage = project.estimatedBudget > 0 
                              ? Math.min(((project.actualCost || 0) / project.estimatedBudget) * 100, 100)
                              : 0;
                            
                            return (
                              <>
                                <div className="w-full bg-gray-200 rounded-full h-3 mb-2">
                                  <div
                                    className={`h-3 rounded-full transition-all ${
                                      budgetStatus.status === "over-budget"
                                        ? "bg-red-600"
                                        : budgetStatus.status === "at-budget"
                                        ? "bg-yellow-600"
                                        : "bg-green-600"
                                    }`}
                                    style={{ width: `${percentage}%` }}
                                  />
                                </div>
                                {budgetStatus.status !== "no-budget" && (
                                  <div className={`text-xs font-medium ${budgetStatus.color}`}>
                                    {budgetStatus.status === "over-budget" && (
                                      <>Over budget by R{Math.abs(budgetStatus.variance || 0).toLocaleString()} ({Math.abs(budgetStatus.variancePercentage || 0).toFixed(1)}%)</>
                                    )}
                                    {budgetStatus.status === "at-budget" && (
                                      <>At budget (+R{(budgetStatus.variance || 0).toLocaleString()}, {(budgetStatus.variancePercentage || 0).toFixed(1)}%)</>
                                    )}
                                    {budgetStatus.status === "under-budget" && (
                                      <>Under budget by R{Math.abs(budgetStatus.variance || 0).toLocaleString()} ({Math.abs(budgetStatus.variancePercentage || 0).toFixed(1)}%)</>
                                    )}
                                  </div>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      )}

                      {/* Milestone Summary */}
                      {project.milestones && project.milestones.length > 0 && (
                        <div className="mt-4 p-4 bg-purple-50 rounded-lg border border-purple-200">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-semibold text-purple-900">Milestones</h4>
                            <span className="text-xs font-medium text-purple-700">
                              {project.milestones.length} total
                            </span>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                            <div>
                              <span className="text-purple-600">Planning:</span>
                              <span className="ml-1 font-semibold text-purple-900">
                                {project.milestones.filter((m: any) => m.status === "PLANNING" || m.status === "NOT_STARTED").length}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-600">In Progress:</span>
                              <span className="ml-1 font-semibold text-purple-900">
                                {project.milestones.filter((m: any) => m.status === "IN_PROGRESS").length}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-600">Completed:</span>
                              <span className="ml-1 font-semibold text-purple-900">
                                {project.milestones.filter((m: any) => m.status === "COMPLETED").length}
                              </span>
                            </div>
                            <div>
                              <span className="text-purple-600">Budget:</span>
                              <span className="ml-1 font-semibold text-purple-900">
                                R{project.milestones.reduce((sum: number, m: any) => sum + (m.budgetAllocated || 0), 0).toLocaleString()}
                              </span>
                            </div>
                          </div>
                          {project.milestones.some((m: any) => m.risks && m.risks.length > 0) && (
                            <div className="mt-2 text-xs text-red-700 font-medium">
                              ⚠️ {project.milestones.reduce((sum: number, m: any) => sum + (m.risks?.length || 0), 0)} active risk(s)
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="w-full md:w-auto md:ml-4 flex flex-col gap-2 mt-4 md:mt-0">
                      <select
                        value={project.status}
                        onChange={(e) =>
                          updateProjectStatusMutation.mutate({
                            token: token!,
                            projectId: project.id,
                            status: e.target.value as any,
                          })
                        }
                        className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                      >
                        {projectStatuses.map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                      <button
                        onClick={() => handleEditProject(project)}
                        className="w-full px-3 py-2 text-sm font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors"
                      >
                        Edit Details
                      </button>
                      <button
                        onClick={() => setViewingProjectId(project.id)}
                        className="w-full px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors"
                      >
                        View Milestones
                      </button>
                      <Link
                        to="/contractor/projects/$projectId/report"
                        params={{ projectId: project.id.toString() }}
                        className="w-full px-3 py-2 text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors text-center"
                      >
                        View Report
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {filteredProjects.length === 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
                <FolderKanban className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No projects found</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
