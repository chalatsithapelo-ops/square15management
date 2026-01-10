import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, useMemo } from "react";
import {
  ArrowLeft,
  LayoutDashboard,
  FolderKanban,
  Target,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Clock,
  CreditCard,
  Filter,
  Calendar,
  Users,
  BarChart3,
} from "lucide-react";
import { MetricCard } from "~/components/MetricCard";
import { ProjectHealthCards } from "~/components/projects/ProjectHealthCards";
import { MilestoneProgressSummary } from "~/components/projects/MilestoneProgressSummary";
import { ProjectBudgetOverview } from "~/components/projects/ProjectBudgetOverview";
import { PaymentRequestsSummary } from "~/components/projects/PaymentRequestsSummary";
import { RiskAlertsDashboard } from "~/components/projects/RiskAlertsDashboard";
import { BudgetUtilizationTrendChart } from "~/components/charts/BudgetUtilizationTrendChart";
import { CompletionRateTrendChart } from "~/components/charts/CompletionRateTrendChart";
import { ProjectHealthTrendChart } from "~/components/charts/ProjectHealthTrendChart";

export const Route = createFileRoute("/admin/projects/dashboard/")({
  component: ProjectManagerDashboard,
});

function ProjectManagerDashboard() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "week" | "month" | "quarter">("all");

  // Fetch all projects with milestones, payment requests, and risks
  const projectsQuery = useQuery(
    trpc.getProjects.queryOptions({
      token: token!,
      status: statusFilter as any,
    }, {
      refetchInterval: 30000, // Poll every 30 seconds
      refetchOnWindowFocus: true,
    })
  );

  // Fetch all payment requests
  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
    }, {
      refetchInterval: 30000,
      refetchOnWindowFocus: true,
    })
  );

  // Fetch metric snapshots for trend analysis
  const metricSnapshotsQuery = useQuery(
    trpc.getMetricSnapshots.queryOptions({
      token: token!,
      metricType: "DAILY",
      limit: 30,
    }, {
      refetchInterval: 60000, // Poll every 60 seconds
      refetchOnWindowFocus: true,
    })
  );

  const projects = projectsQuery.data || [];
  const paymentRequests = paymentRequestsQuery.data || [];
  const metricSnapshots = metricSnapshotsQuery.data || [];
  const isLoading = projectsQuery.isLoading || paymentRequestsQuery.isLoading || metricSnapshotsQuery.isLoading;

  // Calculate aggregated metrics
  const metrics = useMemo(() => {
    const allMilestones = projects.flatMap((p) => p.milestones || []);
    const activeProjects = projects.filter((p) => 
      p.status === "IN_PROGRESS" || p.status === "PLANNING"
    );
    
    // Budget metrics
    const totalBudget = projects.reduce((sum, p) => sum + (p.estimatedBudget || 0), 0);
    const totalActualCost = projects.reduce((sum, p) => sum + (p.actualCost || 0), 0);
    const budgetVariance = totalBudget - totalActualCost;
    const budgetUtilization = totalBudget > 0 ? (totalActualCost / totalBudget) * 100 : 0;
    
    // Milestone metrics
    const totalMilestones = allMilestones.length;
    const completedMilestones = allMilestones.filter((m) => m.status === "COMPLETED").length;
    const inProgressMilestones = allMilestones.filter((m) => m.status === "IN_PROGRESS").length;
    const delayedMilestones = allMilestones.filter((m) => {
      if (!m.endDate || m.status === "COMPLETED") return false;
      return new Date(m.endDate) < new Date();
    }).length;
    
    const milestoneCompletionRate = totalMilestones > 0 
      ? (completedMilestones / totalMilestones) * 100 
      : 0;
    
    // Payment request metrics
    const pendingPayments = paymentRequests.filter((pr) => pr.status === "PENDING").length;
    const approvedPayments = paymentRequests.filter((pr) => pr.status === "APPROVED").length;
    const totalPendingAmount = paymentRequests
      .filter((pr) => pr.status === "PENDING" || pr.status === "APPROVED")
      .reduce((sum, pr) => sum + pr.calculatedAmount, 0);
    
    // Risk metrics
    const allRisks = allMilestones.flatMap((m) => m.risks || []);
    const highRisks = allRisks.filter((r) => r.probability === "HIGH" || r.impact === "HIGH").length;
    
    // Projects by status
    const projectsByStatus = {
      PLANNING: projects.filter((p) => p.status === "PLANNING").length,
      IN_PROGRESS: projects.filter((p) => p.status === "IN_PROGRESS").length,
      ON_HOLD: projects.filter((p) => p.status === "ON_HOLD").length,
      COMPLETED: projects.filter((p) => p.status === "COMPLETED").length,
      CANCELLED: projects.filter((p) => p.status === "CANCELLED").length,
    };
    
    // Budget health
    const overBudgetProjects = projects.filter((p) => {
      if (!p.estimatedBudget || p.estimatedBudget === 0) return false;
      return p.actualCost > p.estimatedBudget * 1.1; // 10% over
    }).length;
    
    return {
      totalProjects: projects.length,
      activeProjects: activeProjects.length,
      totalBudget,
      totalActualCost,
      budgetVariance,
      budgetUtilization,
      totalMilestones,
      completedMilestones,
      inProgressMilestones,
      delayedMilestones,
      milestoneCompletionRate,
      pendingPayments,
      approvedPayments,
      totalPendingAmount,
      allRisks: allRisks.length,
      highRisks,
      projectsByStatus,
      overBudgetProjects,
    };
  }, [projects, paymentRequests]);

  // Prepare data for time-series charts
  const budgetUtilizationData = metricSnapshots.map((snapshot) => ({
    period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
    budgetUtilizationPercentage: snapshot.budgetUtilizationPercentage || 0,
    totalProjectBudget: snapshot.totalProjectBudget || 0,
    totalProjectActualCost: snapshot.totalProjectActualCost || 0,
    projectsOverBudget: snapshot.projectsOverBudget || 0,
    date: new Date(snapshot.snapshotDate),
  }));

  const completionRateData = metricSnapshots.map((snapshot) => ({
    period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
    milestoneCompletionRate: snapshot.milestoneCompletionRate || 0,
    totalMilestones: snapshot.totalMilestones || 0,
    completedMilestones: snapshot.completedMilestones || 0,
    inProgressMilestones: snapshot.inProgressMilestones || 0,
    delayedMilestones: snapshot.delayedMilestones || 0,
    date: new Date(snapshot.snapshotDate),
  }));

  const projectHealthData = metricSnapshots.map((snapshot) => ({
    period: new Date(snapshot.snapshotDate).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }),
    averageProjectHealthScore: snapshot.averageProjectHealthScore || 100,
    totalProjects: snapshot.totalProjects || 0,
    activeProjects: snapshot.activeProjects || 0,
    projectsAtRisk: snapshot.projectsAtRisk || 0,
    date: new Date(snapshot.snapshotDate),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-purple-600 to-indigo-700 p-2 rounded-xl shadow-md">
                <LayoutDashboard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Project Manager Dashboard</h1>
                <p className="text-sm text-gray-600">
                  Monitor all projects, milestones, and expenses
                </p>
              </div>
            </div>
            <Link
              to="/admin/projects"
              className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-lg text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
            >
              <FolderKanban className="h-5 w-5 mr-2" />
              View All Projects
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
          </div>
        ) : (
          <>
            {/* Key Metrics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
              <MetricCard
                name="Total Projects"
                value={metrics.totalProjects}
                icon={FolderKanban}
                color="purple"
                gradient={true}
                subtitle={`${metrics.activeProjects} active`}
              />
              <MetricCard
                name="Total Milestones"
                value={metrics.totalMilestones}
                icon={Target}
                color="blue"
                gradient={true}
                subtitle={`${metrics.completedMilestones} completed`}
              />
              <MetricCard
                name="Budget Utilization"
                value={`${metrics.budgetUtilization.toFixed(1)}%`}
                icon={DollarSign}
                color={metrics.budgetUtilization > 100 ? "red" : metrics.budgetUtilization > 90 ? "amber" : "green"}
                gradient={true}
                subtitle={`R${metrics.totalActualCost.toLocaleString()} / R${metrics.totalBudget.toLocaleString()}`}
              />
              <MetricCard
                name="Pending Payments"
                value={metrics.pendingPayments + metrics.approvedPayments}
                icon={CreditCard}
                color="pink"
                gradient={true}
                subtitle={`R${metrics.totalPendingAmount.toLocaleString()}`}
              />
            </div>

            {/* Secondary Metrics */}
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5 mb-8">
              <MetricCard
                name="Completion Rate"
                value={`${metrics.milestoneCompletionRate.toFixed(0)}%`}
                icon={CheckCircle}
                color="green"
              />
              <MetricCard
                name="In Progress"
                value={metrics.inProgressMilestones}
                icon={TrendingUp}
                color="blue"
              />
              <MetricCard
                name="Delayed"
                value={metrics.delayedMilestones}
                icon={Clock}
                color={metrics.delayedMilestones > 0 ? "red" : "gray"}
              />
              <MetricCard
                name="High Risks"
                value={metrics.highRisks}
                icon={AlertTriangle}
                color={metrics.highRisks > 0 ? "red" : "gray"}
              />
              <MetricCard
                name="Over Budget"
                value={metrics.overBudgetProjects}
                icon={AlertTriangle}
                color={metrics.overBudgetProjects > 0 ? "red" : "green"}
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Filter className="h-5 w-5 text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">Filters:</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-600">Status:</span>
                  <select
                    value={statusFilter || "all"}
                    onChange={(e) => setStatusFilter(e.target.value === "all" ? null : e.target.value)}
                    className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                  >
                    <option value="all">All Projects</option>
                    <option value="PLANNING">Planning</option>
                    <option value="IN_PROGRESS">In Progress</option>
                    <option value="ON_HOLD">On Hold</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>

                <div className="flex-1"></div>

                <div className="text-sm text-gray-600">
                  Last updated: {new Date().toLocaleTimeString()}
                </div>
              </div>
            </div>

            {/* Trend Analysis Section */}
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <BarChart3 className="h-5 w-5 mr-2 text-purple-600" />
                Trend Analysis
              </h2>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="lg:col-span-2">
                  <BudgetUtilizationTrendChart
                    data={budgetUtilizationData}
                    isLoading={metricSnapshotsQuery.isLoading}
                  />
                </div>
                <CompletionRateTrendChart
                  data={completionRateData}
                  isLoading={metricSnapshotsQuery.isLoading}
                />
                <ProjectHealthTrendChart
                  data={projectHealthData}
                  isLoading={metricSnapshotsQuery.isLoading}
                />
              </div>
            </div>

            {/* Project Health Cards */}
            <ProjectHealthCards projects={projects} />

            {/* Main Dashboard Content */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {/* Milestone Progress Summary */}
              <MilestoneProgressSummary projects={projects} />

              {/* Budget Overview */}
              <ProjectBudgetOverview projects={projects} />
            </div>

            {/* Payment Requests and Risks */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Payment Requests Summary */}
              <PaymentRequestsSummary paymentRequests={paymentRequests} projects={projects} />

              {/* Risk Alerts */}
              <RiskAlertsDashboard projects={projects} />
            </div>
          </>
        )}
      </main>
    </div>
  );
}
