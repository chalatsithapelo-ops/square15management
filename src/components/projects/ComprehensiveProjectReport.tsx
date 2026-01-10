import { useMemo } from "react";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Target,
  AlertTriangle,
  CheckCircle,
  Clock,
  Users,
  FileText,
  Activity,
  Shield,
  Zap,
  BarChart3,
  Package,
  CreditCard,
} from "lucide-react";
import { ProgressRing } from "~/components/ProgressRing";
import { MetricCard } from "~/components/MetricCard";

interface ComprehensiveProjectReportProps {
  reportData: any; // The data returned from getComprehensiveProjectReport
  isLoading?: boolean;
}

export function ComprehensiveProjectReport({ reportData, isLoading }: ComprehensiveProjectReportProps) {
  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  if (!reportData) {
    return (
      <div className="text-center py-12">
        <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
        <p className="mt-4 text-gray-600">No report data available</p>
      </div>
    );
  }

  const { project, financialSummary, timelineSummary, progressSummary, paymentSummary, riskSummary, changeOrderSummary, resourceSummary, qualitySummary, invoiceSummary, healthScore, milestones } = reportData;

  // Helper function to format currency
  const formatCurrency = (amount: number) => {
    return `R${amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Helper function to format dates
  const formatDate = (date: string | null) => {
    if (!date) return "Not set";
    return new Date(date).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short', day: 'numeric' });
  };

  // Helper function to get status color
  const getStatusColor = (status: string) => {
    switch (status) {
      case "COMPLETED": return "bg-green-100 text-green-800";
      case "IN_PROGRESS": return "bg-blue-100 text-blue-800";
      case "PLANNING": case "NOT_STARTED": return "bg-gray-100 text-gray-800";
      case "ON_HOLD": return "bg-yellow-100 text-yellow-800";
      case "CANCELLED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  // Helper function to get health score color
  const getHealthScoreColor = (score: number) => {
    if (score >= 80) return "#10b981"; // green
    if (score >= 60) return "#f59e0b"; // amber
    return "#ef4444"; // red
  };

  return (
    <div className="space-y-6">
      {/* Project Overview Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-700 rounded-xl shadow-lg overflow-hidden">
        <div className="p-8 text-white">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <div className="text-sm font-medium opacity-90 mb-1">{project.projectNumber}</div>
              <h1 className="text-3xl font-bold mb-2">{project.name}</h1>
              <p className="text-purple-100 mb-4">{project.description}</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <div className="opacity-75 mb-1">Customer</div>
                  <div className="font-medium">{project.customerName}</div>
                </div>
                <div>
                  <div className="opacity-75 mb-1">Type</div>
                  <div className="font-medium">{project.projectType}</div>
                </div>
                <div>
                  <div className="opacity-75 mb-1">Status</div>
                  <div className="font-medium">{project.status.replace(/_/g, ' ')}</div>
                </div>
                <div>
                  <div className="opacity-75 mb-1">Assigned To</div>
                  <div className="font-medium">
                    {project.assignedTo ? `${project.assignedTo.firstName} ${project.assignedTo.lastName}` : "Unassigned"}
                  </div>
                </div>
              </div>
            </div>
            <div className="ml-6">
              <ProgressRing
                percentage={progressSummary.overallProgress}
                size={140}
                strokeWidth={10}
                color="#ffffff"
                backgroundColor="rgba(255, 255, 255, 0.2)"
                showPercentage={true}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Project Health Score */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-purple-100 p-3 rounded-lg">
              <Activity className="h-6 w-6 text-purple-600" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Project Health Score</h3>
              <p className="text-sm text-gray-600">Overall project health assessment</p>
            </div>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold" style={{ color: getHealthScoreColor(healthScore) }}>
              {Math.round(healthScore)}
            </div>
            <div className="text-sm text-gray-600">out of 100</div>
          </div>
        </div>
        <div className="mt-4">
          <div className="w-full bg-gray-200 rounded-full h-3">
            <div
              className="h-3 rounded-full transition-all"
              style={{ 
                width: `${healthScore}%`,
                backgroundColor: getHealthScoreColor(healthScore),
              }}
            />
          </div>
        </div>
      </div>

      {/* Key Financial Metrics */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-6 w-6 mr-2 text-green-600" />
          Financial Summary
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <MetricCard
            name="Total Budget"
            value={formatCurrency(financialSummary.totalBudgetAllocated)}
            icon={DollarSign}
            color="blue"
            gradient={true}
          />
          <MetricCard
            name="Actual Cost"
            value={formatCurrency(financialSummary.totalActualCost)}
            icon={BarChart3}
            color="purple"
            gradient={true}
          />
          <MetricCard
            name="Budget Variance"
            value={formatCurrency(Math.abs(financialSummary.budgetVariance))}
            icon={financialSummary.budgetVariance >= 0 ? TrendingDown : TrendingUp}
            color={financialSummary.budgetVariance >= 0 ? "green" : "red"}
            gradient={true}
            subtitle={financialSummary.budgetVariance >= 0 ? "Under budget" : "Over budget"}
          />
          <MetricCard
            name="Profit Margin"
            value={`${financialSummary.profitMargin.toFixed(1)}%`}
            icon={TrendingUp}
            color={financialSummary.profitMargin >= 0 ? "green" : "red"}
            gradient={true}
            subtitle={formatCurrency(financialSummary.actualProfit)}
          />
        </div>
      </div>

      {/* Detailed Financial Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Cost Breakdown</h3>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <div className="text-sm text-gray-600 mb-1">Labour Cost</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(financialSummary.totalLabourCost)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Material Cost</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(financialSummary.totalMaterialCost)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Operational Cost</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(financialSummary.totalOperationalCost)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-600 mb-1">Expected Profit</div>
              <div className="text-xl font-bold text-gray-900">{formatCurrency(financialSummary.totalExpectedProfit)}</div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-sm">
              <div>
                <div className="text-gray-600 mb-1">Diesel</div>
                <div className="font-semibold text-gray-900">{formatCurrency(financialSummary.totalDieselCost)}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Rent</div>
                <div className="font-semibold text-gray-900">{formatCurrency(financialSummary.totalRentCost)}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Admin</div>
                <div className="font-semibold text-gray-900">{formatCurrency(financialSummary.totalAdminCost)}</div>
              </div>
              <div>
                <div className="text-gray-600 mb-1">Other</div>
                <div className="font-semibold text-gray-900">{formatCurrency(financialSummary.totalOtherOperationalCost)}</div>
              </div>
            </div>
          </div>
          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700">Budget Utilization</span>
              <span className="text-sm font-bold text-gray-900">
                {financialSummary.budgetUtilization.toFixed(1)}%
              </span>
            </div>
            <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
              <div
                className={`h-2 rounded-full transition-all ${
                  financialSummary.budgetUtilization > 100 ? "bg-red-600" :
                  financialSummary.budgetUtilization > 90 ? "bg-yellow-600" :
                  "bg-green-600"
                }`}
                style={{ width: `${Math.min(financialSummary.budgetUtilization, 100)}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Timeline and Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Timeline Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-indigo-50">
            <div className="flex items-center space-x-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <Calendar className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Timeline</h3>
                <p className="text-sm text-gray-600">Project schedule overview</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Start Date</span>
              <span className="text-sm font-semibold text-gray-900">{formatDate(timelineSummary.earliestStart)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">End Date</span>
              <span className="text-sm font-semibold text-gray-900">{formatDate(timelineSummary.latestEnd)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Total Duration</span>
              <span className="text-sm font-semibold text-gray-900">{timelineSummary.totalDurationDays} days</span>
            </div>
            {timelineSummary.delayedMilestonesCount > 0 && (
              <>
                <div className="pt-4 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-red-600 flex items-center">
                      <AlertTriangle className="h-4 w-4 mr-1" />
                      Delayed Milestones
                    </span>
                    <span className="text-sm font-semibold text-red-600">{timelineSummary.delayedMilestonesCount}</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-red-600">Total Delay</span>
                  <span className="text-sm font-semibold text-red-600">{timelineSummary.totalDelayDays} days</span>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Progress Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <Target className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Progress</h3>
                <p className="text-sm text-gray-600">Milestone completion status</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{progressSummary.totalMilestones}</div>
                <div className="text-sm text-gray-600">Total Milestones</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-green-600">{progressSummary.milestonesByStatus.COMPLETED}</div>
                <div className="text-sm text-gray-600">Completed</div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">In Progress</span>
                <span className="font-semibold text-blue-600">{progressSummary.milestonesByStatus.IN_PROGRESS}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Planning</span>
                <span className="font-semibold text-gray-600">{progressSummary.milestonesByStatus.PLANNING}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">On Hold</span>
                <span className="font-semibold text-yellow-600">{progressSummary.milestonesByStatus.ON_HOLD}</span>
              </div>
            </div>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Completion Rate</span>
                <span className="text-sm font-bold text-gray-900">{progressSummary.completionRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all"
                  style={{ width: `${progressSummary.completionRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          name="Payment Requests"
          value={paymentSummary.total}
          icon={CreditCard}
          color="pink"
          subtitle={`${paymentSummary.pending} pending`}
        />
        <MetricCard
          name="Open Risks"
          value={riskSummary.critical}
          icon={Shield}
          color={riskSummary.critical > 0 ? "red" : "green"}
          subtitle={`${riskSummary.open} total open`}
        />
        <MetricCard
          name="Change Orders"
          value={changeOrderSummary.total}
          icon={FileText}
          color="amber"
          subtitle={`${changeOrderSummary.pending} pending`}
        />
        <MetricCard
          name="Quality Pass Rate"
          value={`${qualitySummary.passRate.toFixed(0)}%`}
          icon={CheckCircle}
          color={qualitySummary.passRate >= 90 ? "green" : qualitySummary.passRate >= 70 ? "amber" : "red"}
          subtitle={`${qualitySummary.passed}/${qualitySummary.total} passed`}
        />
      </div>

      {/* Milestone Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200 bg-gray-50">
          <h3 className="text-lg font-semibold text-gray-900 flex items-center">
            <Target className="h-5 w-5 mr-2 text-purple-600" />
            Milestone Breakdown
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Milestone</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Progress</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Budget</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Timeline</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assigned To</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {milestones.map((milestone: any) => {
                const variance = milestone.budgetAllocated - milestone.actualCost;
                const utilizationRate = milestone.budgetAllocated > 0 
                  ? (milestone.actualCost / milestone.budgetAllocated) * 100 
                  : 0;
                
                return (
                  <tr key={milestone.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{milestone.sequenceOrder}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{milestone.name}</div>
                      <div className="text-xs text-gray-500">{milestone.description.substring(0, 50)}...</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(milestone.status)}`}>
                        {milestone.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="w-16 bg-gray-200 rounded-full h-2 mr-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${milestone.progressPercentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-gray-900">{milestone.progressPercentage}%</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(milestone.budgetAllocated)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatCurrency(milestone.actualCost)}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`text-sm font-medium ${variance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                      </span>
                      <div className="text-xs text-gray-500">{utilizationRate.toFixed(0)}%</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div>{formatDate(milestone.startDate)}</div>
                      <div className="text-xs">{formatDate(milestone.endDate)}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {milestone.assignedTo ? `${milestone.assignedTo.firstName} ${milestone.assignedTo.lastName}` : "Unassigned"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Payment and Invoice Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Payment Requests */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-rose-50">
            <div className="flex items-center space-x-3">
              <div className="bg-pink-600 p-2 rounded-lg">
                <CreditCard className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Payment Requests</h3>
                <p className="text-sm text-gray-600">Artisan payment summary</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">{paymentSummary.pending}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Approved</div>
                <div className="text-2xl font-bold text-blue-600">{paymentSummary.approved}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Paid</div>
                <div className="text-2xl font-bold text-green-600">{paymentSummary.paid}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Rejected</div>
                <div className="text-2xl font-bold text-red-600">{paymentSummary.rejected}</div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Pending Amount</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(paymentSummary.totalPendingAmount)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Paid</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(paymentSummary.totalPaidAmount)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Invoices */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
            <div className="flex items-center space-x-3">
              <div className="bg-indigo-600 p-2 rounded-lg">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Invoices</h3>
                <p className="text-sm text-gray-600">Customer billing summary</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Draft</div>
                <div className="text-2xl font-bold text-gray-600">{invoiceSummary.draft}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Sent</div>
                <div className="text-2xl font-bold text-blue-600">{invoiceSummary.sent}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Paid</div>
                <div className="text-2xl font-bold text-green-600">{invoiceSummary.paid}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Overdue</div>
                <div className="text-2xl font-bold text-red-600">{invoiceSummary.overdue}</div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Invoiced</span>
                <span className="text-lg font-bold text-gray-900">{formatCurrency(invoiceSummary.totalAmount)}</span>
              </div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Paid</span>
                <span className="text-lg font-bold text-green-600">{formatCurrency(invoiceSummary.totalPaid)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Outstanding</span>
                <span className="text-lg font-bold text-yellow-600">{formatCurrency(invoiceSummary.totalOutstanding)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Risk and Change Orders */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Summary */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-red-50 to-orange-50">
            <div className="flex items-center space-x-3">
              <div className="bg-red-600 p-2 rounded-lg">
                <Shield className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Risk Analysis</h3>
                <p className="text-sm text-gray-600">Project risk assessment</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{riskSummary.critical}</div>
                <div className="text-xs text-gray-600">Critical</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{riskSummary.open}</div>
                <div className="text-xs text-gray-600">Open</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{riskSummary.mitigated}</div>
                <div className="text-xs text-gray-600">Mitigated</div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="text-sm font-medium text-gray-700 mb-3">By Category</div>
              <div className="space-y-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Technical</span>
                  <span className="font-semibold text-gray-900">{riskSummary.byCategory.TECHNICAL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Financial</span>
                  <span className="font-semibold text-gray-900">{riskSummary.byCategory.FINANCIAL}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Schedule</span>
                  <span className="font-semibold text-gray-900">{riskSummary.byCategory.SCHEDULE}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">Resource</span>
                  <span className="font-semibold text-gray-900">{riskSummary.byCategory.RESOURCE}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-600">External</span>
                  <span className="font-semibold text-gray-900">{riskSummary.byCategory.EXTERNAL}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Change Orders */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-amber-50 to-yellow-50">
            <div className="flex items-center space-x-3">
              <div className="bg-amber-600 p-2 rounded-lg">
                <Zap className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Change Orders</h3>
                <p className="text-sm text-gray-600">Scope change impact</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">{changeOrderSummary.pending}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Approved</div>
                <div className="text-2xl font-bold text-green-600">{changeOrderSummary.approved}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Rejected</div>
                <div className="text-2xl font-bold text-red-600">{changeOrderSummary.rejected}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Implemented</div>
                <div className="text-2xl font-bold text-blue-600">{changeOrderSummary.implemented}</div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-gray-600">Total Cost Impact</span>
                <span className={`text-lg font-bold ${changeOrderSummary.totalCostImpact >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {changeOrderSummary.totalCostImpact >= 0 ? '+' : ''}{formatCurrency(changeOrderSummary.totalCostImpact)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">Total Time Impact</span>
                <span className={`text-lg font-bold ${changeOrderSummary.totalTimeImpact > 0 ? 'text-red-600' : 'text-gray-900'}`}>
                  {changeOrderSummary.totalTimeImpact > 0 ? '+' : ''}{changeOrderSummary.totalTimeImpact} days
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Resource and Quality */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Resource Allocation */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-teal-50 to-cyan-50">
            <div className="flex items-center space-x-3">
              <div className="bg-teal-600 p-2 rounded-lg">
                <Users className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Resource Allocation</h3>
                <p className="text-sm text-gray-600">Artisan assignments</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center">
                <div className="text-3xl font-bold text-teal-600">{resourceSummary.totalArtisansAssigned}</div>
                <div className="text-sm text-gray-600 mt-1">Total Artisans</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{resourceSummary.milestonesWithAssignment}</div>
                <div className="text-sm text-gray-600 mt-1">Assigned Milestones</div>
              </div>
            </div>
            {resourceSummary.milestonesWithoutAssignment > 0 && (
              <div className="mt-4 pt-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-amber-600 flex items-center">
                    <AlertTriangle className="h-4 w-4 mr-1" />
                    Unassigned Milestones
                  </span>
                  <span className="text-lg font-bold text-amber-600">{resourceSummary.milestonesWithoutAssignment}</span>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quality Metrics */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-green-50 to-emerald-50">
            <div className="flex items-center space-x-3">
              <div className="bg-green-600 p-2 rounded-lg">
                <CheckCircle className="h-5 w-5 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Quality Checkpoints</h3>
                <p className="text-sm text-gray-600">Quality assurance status</p>
              </div>
            </div>
          </div>
          <div className="p-6 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm text-gray-600 mb-1">Passed</div>
                <div className="text-2xl font-bold text-green-600">{qualitySummary.passed}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Failed</div>
                <div className="text-2xl font-bold text-red-600">{qualitySummary.failed}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Pending</div>
                <div className="text-2xl font-bold text-yellow-600">{qualitySummary.pending}</div>
              </div>
              <div>
                <div className="text-sm text-gray-600 mb-1">Waived</div>
                <div className="text-2xl font-bold text-gray-600">{qualitySummary.waived}</div>
              </div>
            </div>
            <div className="pt-4 border-t border-gray-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Pass Rate</span>
                <span className="text-lg font-bold text-gray-900">{qualitySummary.passRate.toFixed(1)}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className={`h-2 rounded-full transition-all ${
                    qualitySummary.passRate >= 90 ? 'bg-green-600' :
                    qualitySummary.passRate >= 70 ? 'bg-yellow-600' :
                    'bg-red-600'
                  }`}
                  style={{ width: `${qualitySummary.passRate}%` }}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
