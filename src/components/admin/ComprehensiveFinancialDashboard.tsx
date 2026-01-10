import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  Target,
  Activity,
  BarChart3,
  Filter,
  Loader2,
} from "lucide-react";
import { MetricCard } from "~/components/MetricCard";
import { ProfitVarianceChart } from "~/components/charts/ProfitVarianceChart";

interface ComprehensiveFinancialDashboardProps {
  dateRange?: { start: string; end: string };
}

export function ComprehensiveFinancialDashboard({
  dateRange,
}: ComprehensiveFinancialDashboardProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  
  console.log('[ComprehensiveFinancialDashboard] Token:', token ? `${token.substring(0, 20)}...` : 'null');
  
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [expandedProjects, setExpandedProjects] = useState<Set<number>>(new Set());

  const profitAnalyticsQuery = useQuery({
    ...trpc.getProfitAnalytics.queryOptions({
      token: token || "",
      startDate: dateRange?.start,
      endDate: dateRange?.end,
      status: statusFilter !== "all" ? statusFilter as any : undefined,
    }),
    enabled: !!token,
  });
  
  console.log('[ComprehensiveFinancialDashboard] Query state:', {
    isLoading: profitAnalyticsQuery.isLoading,
    isError: profitAnalyticsQuery.isError,
    error: profitAnalyticsQuery.error?.message,
    hasToken: !!token,
  });

  const toggleProjectExpansion = (projectId: number) => {
    setExpandedProjects((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(projectId)) {
        newSet.delete(projectId);
      } else {
        newSet.add(projectId);
      }
      return newSet;
    });
  };

  const formatCurrency = (value: number | null | undefined) => {
    return `R ${(value || 0).toLocaleString()}`;
  };

  const formatPercentage = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const getVarianceColor = (variance: number) => {
    if (variance > 0) return "text-green-600";
    if (variance < 0) return "text-red-600";
    return "text-gray-600";
  };

  const getVarianceBgColor = (variance: number) => {
    if (variance > 0) return "bg-green-50 border-green-200";
    if (variance < 0) return "bg-red-50 border-red-200";
    return "bg-gray-50 border-gray-200";
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case "COMPLETED":
        return "bg-green-100 text-green-800";
      case "IN_PROGRESS":
        return "bg-blue-100 text-blue-800";
      case "ON_HOLD":
        return "bg-yellow-100 text-yellow-800";
      case "CANCELLED":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!profitAnalyticsQuery.data) return [];
    
    return profitAnalyticsQuery.data.projects.map((project) => ({
      name: project.name.length > 20 ? project.name.substring(0, 20) + "..." : project.name,
      expectedProfit: project.expectedProfit,
      actualProfit: project.actualProfit,
      variance: project.variance,
      id: project.id,
    }));
  }, [profitAnalyticsQuery.data]);

  if (profitAnalyticsQuery.isLoading || !token) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 text-gray-400 animate-spin" />
      </div>
    );
  }

  if (profitAnalyticsQuery.error && token) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6">
        <div className="flex items-center gap-3">
          <AlertCircle className="h-6 w-6 text-red-600" />
          <div>
            <h3 className="font-semibold text-red-900">Error Loading Dashboard</h3>
            <p className="text-sm text-red-700">{profitAnalyticsQuery.error.message}</p>
          </div>
        </div>
      </div>
    );
  }

  const data = profitAnalyticsQuery.data;
  if (!data) return null;

  const { summary, projects } = data;

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-4">
          <Filter className="h-5 w-5 text-gray-500" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
          >
            <option value="all">All Projects</option>
            <option value="PLANNING">Planning</option>
            <option value="IN_PROGRESS">In Progress</option>
            <option value="ON_HOLD">On Hold</option>
            <option value="COMPLETED">Completed</option>
          </select>
          <div className="text-sm text-gray-600">
            Showing {summary.totalProjects} project{summary.totalProjects !== 1 ? "s" : ""}
          </div>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <MetricCard
          name="Total Revenue"
          value={formatCurrency(summary.totalRevenue)}
          icon={DollarSign}
          color="blue"
          gradient
          subtitle={`Invoice: ${formatCurrency(summary.invoiceRevenue || 0)} | Alternative: ${formatCurrency(summary.alternativeRevenue || 0)}`}
        />
        <MetricCard
          name="Expected Profit"
          value={formatCurrency(summary.totalExpectedProfit)}
          icon={Target}
          color="purple"
          gradient
        />
        <MetricCard
          name="Actual Profit"
          value={formatCurrency(summary.totalActualProfit)}
          icon={TrendingUp}
          color={summary.totalActualProfit >= 0 ? "green" : "red"}
          gradient
        />
        <MetricCard
          name="Profit Variance"
          value={formatCurrency(summary.variance)}
          icon={summary.variance >= 0 ? TrendingUp : TrendingDown}
          color={summary.variance >= 0 ? "green" : "red"}
          gradient
          subtitle={`${formatPercentage(summary.variancePercentage)} vs expected`}
        />
      </div>

      {/* Revenue & Expense Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Revenue Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Invoice Revenue</span>
              <span className="font-semibold text-blue-600">{formatCurrency(summary.invoiceRevenue || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Alternative Revenue</span>
              <span className="font-semibold text-green-600">{formatCurrency(summary.alternativeRevenue || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 pt-3 border-t-2 border-gray-200">
              <span className="text-base font-semibold text-gray-900">Total Revenue</span>
              <span className="text-lg font-bold text-blue-600">{formatCurrency(summary.totalRevenue)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <h3 className="text-lg font-semibold text-gray-900">Cost Breakdown</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Project Costs</span>
              <span className="font-semibold text-orange-600">{formatCurrency(summary.projectCosts || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b border-gray-100">
              <span className="text-sm text-gray-600">Operational Expenses</span>
              <span className="font-semibold text-red-600">{formatCurrency(summary.operationalExpenses || 0)}</span>
            </div>
            <div className="flex justify-between items-center py-2 pt-3 border-t-2 border-gray-200">
              <span className="text-base font-semibold text-gray-900">Total Costs</span>
              <span className="text-lg font-bold text-red-600">{formatCurrency(summary.totalActualCost)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Indicators */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Activity className="h-5 w-5 text-green-600" />
            <span className="text-sm font-semibold text-green-900">On Track</span>
          </div>
          <p className="text-3xl font-bold text-green-600">{summary.onTrackProjects}</p>
          <p className="text-xs text-green-700 mt-1">Meeting expectations</p>
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            <span className="text-sm font-semibold text-blue-900">Profitable</span>
          </div>
          <p className="text-3xl font-bold text-blue-600">{summary.profitableProjects}</p>
          <p className="text-xs text-blue-700 mt-1">Generating profit</p>
        </div>

        <div className="bg-gradient-to-br from-red-50 to-orange-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="h-5 w-5 text-red-600" />
            <span className="text-sm font-semibold text-red-900">Unprofitable</span>
          </div>
          <p className="text-3xl font-bold text-red-600">{summary.unprofitableProjects}</p>
          <p className="text-xs text-red-700 mt-1">Operating at loss</p>
        </div>

        <div className="bg-gradient-to-br from-yellow-50 to-amber-50 border border-yellow-200 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="h-5 w-5 text-yellow-600" />
            <span className="text-sm font-semibold text-yellow-900">Over Budget</span>
          </div>
          <p className="text-3xl font-bold text-yellow-600">{summary.overBudgetProjects}</p>
          <p className="text-xs text-yellow-700 mt-1">Exceeding budget</p>
        </div>
      </div>

      {/* Alerts */}
      {summary.variance < 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-900">Profit Performance Alert</p>
              <p className="text-sm text-red-700">
                Overall actual profit is {formatCurrency(Math.abs(summary.variance))} below expectations 
                ({formatPercentage(Math.abs(summary.variancePercentage))}). Review underperforming projects 
                and take corrective action.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Profit Variance Chart */}
      <ProfitVarianceChart
        data={chartData}
        title="Project Profit Performance"
        type="project"
      />

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="h-5 w-5 text-purple-600" />
            <h3 className="text-sm font-semibold text-gray-900">Profit Margin</h3>
          </div>
          <p className="text-3xl font-bold text-purple-600">{formatPercentage(summary.profitMargin)}</p>
          <p className="text-xs text-gray-600 mt-1">
            Expected: {formatPercentage(summary.expectedProfitMargin)}
          </p>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${summary.profitMargin >= summary.expectedProfitMargin ? 'bg-green-500' : 'bg-red-500'}`}
              style={{ width: `${Math.min(Math.abs(summary.profitMargin), 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="h-5 w-5 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-900">Budget Utilization</h3>
          </div>
          <p className="text-3xl font-bold text-blue-600">{formatPercentage(summary.budgetUtilization)}</p>
          <p className="text-xs text-gray-600 mt-1">
            {formatCurrency(summary.totalActualCost)} of {formatCurrency(summary.totalBudget)}
          </p>
          <div className="mt-3 w-full bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                summary.budgetUtilization > 100 ? 'bg-red-500' : 
                summary.budgetUtilization > 90 ? 'bg-yellow-500' : 
                'bg-green-500'
              }`}
              style={{ width: `${Math.min(summary.budgetUtilization, 100)}%` }}
            />
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Activity className="h-5 w-5 text-green-600" />
            <h3 className="text-sm font-semibold text-gray-900">Success Rate</h3>
          </div>
          <p className="text-3xl font-bold text-green-600">
            {summary.totalProjects > 0 
              ? formatPercentage((summary.onTrackProjects / summary.totalProjects) * 100)
              : "0%"}
          </p>
          <p className="text-xs text-gray-600 mt-1">
            {summary.onTrackProjects} of {summary.totalProjects} projects on track
          </p>
        </div>
      </div>

      {/* Project Details Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
          <h3 className="text-lg font-semibold text-gray-900">Project & Milestone Details</h3>
          <p className="text-sm text-gray-600 mt-1">
            Detailed profit analysis for all projects and their milestones
          </p>
        </div>

        <div className="overflow-x-auto">
          {projects.length === 0 ? (
            <div className="text-center py-12">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No projects found</p>
              <p className="text-xs text-gray-500 mt-1">Create projects to see profit analysis</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-200">
              {projects.map((project) => (
                <div key={project.id}>
                  {/* Project Row */}
                  <div
                    className={`p-4 hover:bg-gray-50 cursor-pointer ${
                      expandedProjects.has(project.id) ? "bg-blue-50" : ""
                    }`}
                    onClick={() => toggleProjectExpansion(project.id)}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <button className="flex-shrink-0">
                          {expandedProjects.has(project.id) ? (
                            <ChevronDown className="h-5 w-5 text-gray-500" />
                          ) : (
                            <ChevronRight className="h-5 w-5 text-gray-500" />
                          )}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 truncate">{project.name}</p>
                            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(project.status)}`}>
                              {project.status}
                            </span>
                          </div>
                          <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                            <span>{project.projectNumber}</span>
                            <span>{project.customerName}</span>
                            {project.projectType && <span>• {project.projectType}</span>}
                            {project.milestoneCount > 0 && (
                              <span>• {project.completedMilestones}/{project.milestoneCount} milestones</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-6 flex-shrink-0">
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Budget</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(project.estimatedBudget)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Actual Cost</p>
                          <p className="text-sm font-semibold text-gray-900">{formatCurrency(project.actualCost)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Expected Profit</p>
                          <p className="text-sm font-semibold text-blue-600">{formatCurrency(project.expectedProfit)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-gray-500">Actual Profit</p>
                          <p className={`text-sm font-semibold ${getVarianceColor(project.actualProfit)}`}>
                            {formatCurrency(project.actualProfit)}
                          </p>
                        </div>
                        <div className="text-right min-w-[100px]">
                          <p className="text-xs text-gray-500">Variance</p>
                          <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg border ${getVarianceBgColor(project.variance)}`}>
                            {project.variance >= 0 ? (
                              <TrendingUp className="h-3 w-3" />
                            ) : (
                              <TrendingDown className="h-3 w-3" />
                            )}
                            <span className={`text-sm font-bold ${getVarianceColor(project.variance)}`}>
                              {formatCurrency(Math.abs(project.variance))}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Milestone Rows */}
                  {expandedProjects.has(project.id) && project.milestones.length > 0 && (
                    <div className="bg-gray-50 border-t border-gray-200">
                      <div className="px-4 py-2 bg-gray-100">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                          Milestones ({project.milestones.length})
                        </p>
                      </div>
                      {project.milestones.map((milestone) => (
                        <div
                          key={milestone.id}
                          className="px-4 py-3 pl-16 hover:bg-gray-100 border-b border-gray-200 last:border-b-0"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-medium text-gray-500">#{milestone.sequenceOrder}</span>
                                <p className="font-medium text-gray-900">{milestone.name}</p>
                                <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${getStatusBadgeColor(milestone.status)}`}>
                                  {milestone.status}
                                </span>
                                {milestone.riskCount > 0 && (
                                  <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                    <AlertCircle className="h-3 w-3" />
                                    {milestone.riskCount} risk{milestone.riskCount !== 1 ? "s" : ""}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                                <span>Progress: {formatPercentage(milestone.progressPercentage)}</span>
                                {milestone.assignedTo && (
                                  <span>• {milestone.assignedTo.firstName} {milestone.assignedTo.lastName}</span>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-6 flex-shrink-0">
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Budget</p>
                                <p className="text-sm font-medium text-gray-700">{formatCurrency(milestone.budgetAllocated)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Actual Cost</p>
                                <p className="text-sm font-medium text-gray-700">{formatCurrency(milestone.actualCost)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Expected Profit</p>
                                <p className="text-sm font-medium text-blue-600">{formatCurrency(milestone.expectedProfit)}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500">Actual Profit</p>
                                <p className={`text-sm font-medium ${getVarianceColor(milestone.actualProfit)}`}>
                                  {formatCurrency(milestone.actualProfit)}
                                </p>
                              </div>
                              <div className="text-right min-w-[100px]">
                                <p className="text-xs text-gray-500">Variance</p>
                                <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-xs ${getVarianceBgColor(milestone.variance)}`}>
                                  {milestone.variance >= 0 ? (
                                    <TrendingUp className="h-3 w-3" />
                                  ) : (
                                    <TrendingDown className="h-3 w-3" />
                                  )}
                                  <span className={`font-semibold ${getVarianceColor(milestone.variance)}`}>
                                    {formatCurrency(Math.abs(milestone.variance))}
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
