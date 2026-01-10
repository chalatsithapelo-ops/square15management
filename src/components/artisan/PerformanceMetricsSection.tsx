import { Clock, TrendingUp, DollarSign, BarChart3 } from "lucide-react";

interface PerformanceMetrics {
  averageJobDurationMinutes: number;
  averageEarningsPerJob: number;
  totalLaborCost: number;
  totalMaterialCost: number;
  overallRevenue: number;
  onTimeCompletionRate: number;
  totalHoursWorked: number;
  totalDaysWorked: number;
  monthlyEarnings: { month: string; earnings: number }[];
}

interface PerformanceMetricsSectionProps {
  metrics: PerformanceMetrics;
}

export function PerformanceMetricsSection({ metrics }: PerformanceMetricsSectionProps) {
  const formatDuration = (minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  const laborPercentage =
    metrics.overallRevenue > 0
      ? (metrics.totalLaborCost / metrics.overallRevenue) * 100
      : 0;
  const materialPercentage =
    metrics.overallRevenue > 0
      ? (metrics.totalMaterialCost / metrics.overallRevenue) * 100
      : 0;

  const maxMonthlyEarnings = Math.max(...metrics.monthlyEarnings.map((m) => m.earnings), 1);

  return (
    <div className="space-y-6">
      {/* Time Tracking Summary - Prominent Display */}
      <div className="bg-gradient-to-br from-blue-600 to-blue-700 rounded-xl shadow-lg border border-blue-800 p-6 text-white">
        <h3 className="text-xl font-bold mb-4 flex items-center">
          <Clock className="h-6 w-6 mr-2" />
          Time Tracking Summary
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-100 mb-1">Total Hours Worked</p>
            <p className="text-4xl font-bold">{metrics.totalHoursWorked.toFixed(1)}</p>
            <p className="text-xs text-blue-100 mt-2">
              Across all completed jobs
            </p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-100 mb-1">Total Days Worked</p>
            <p className="text-4xl font-bold">{metrics.totalDaysWorked.toFixed(1)}</p>
            <p className="text-xs text-blue-100 mt-2">
              Cumulative work days logged
            </p>
          </div>
          <div className="bg-white bg-opacity-20 rounded-lg p-4">
            <p className="text-sm font-medium text-blue-100 mb-1">Avg Job Duration</p>
            <p className="text-4xl font-bold">{formatDuration(metrics.averageJobDurationMinutes)}</p>
            <p className="text-xs text-blue-100 mt-2">
              Average time per job
            </p>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-blue-500">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-blue-100">Efficiency Rate:</span>
              <span className="ml-2 font-semibold">
                {metrics.totalHoursWorked > 0 
                  ? ((metrics.totalHoursWorked / (metrics.totalDaysWorked * 8)) * 100).toFixed(0)
                  : 0}%
              </span>
            </div>
            <div>
              <span className="text-blue-100">Avg Hours/Day:</span>
              <span className="ml-2 font-semibold">
                {metrics.totalDaysWorked > 0 
                  ? (metrics.totalHoursWorked / metrics.totalDaysWorked).toFixed(1)
                  : 0}h
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Key Performance Indicators */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-3">
            <div className="flex-shrink-0 bg-blue-100 rounded-lg p-3">
              <Clock className="h-6 w-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Job Duration</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatDuration(metrics.averageJobDurationMinutes)}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Total: {metrics.totalHoursWorked}h worked
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-3">
            <div className="flex-shrink-0 bg-green-100 rounded-lg p-3">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg Per Job</p>
              <p className="text-2xl font-bold text-gray-900">
                R{metrics.averageEarningsPerJob.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Average earnings per completed job
          </p>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-3">
            <div className="flex-shrink-0 bg-purple-100 rounded-lg p-3">
              <Clock className="h-6 w-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">On-Time Project Completion Rate</p>
              <p className="text-2xl font-bold text-gray-900">
                {metrics.onTimeCompletionRate.toFixed(1)}%
              </p>
            </div>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            Percentage of milestones completed on time
          </p>
        </div>
      </div>

      {/* Cost Breakdown */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <DollarSign className="h-5 w-5 mr-2 text-gray-600" />
          Cost Breakdown
        </h3>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Labor Costs</span>
              <span className="text-sm font-semibold text-gray-900">
                R{metrics.totalLaborCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({laborPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-blue-600 h-2.5 rounded-full"
                style={{ width: `${laborPercentage}%` }}
              ></div>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-gray-700">Material Costs</span>
              <span className="text-sm font-semibold text-gray-900">
                R{metrics.totalMaterialCost.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} ({materialPercentage.toFixed(1)}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div
                className="bg-orange-600 h-2.5 rounded-full"
                style={{ width: `${materialPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly Earnings Chart */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
          <TrendingUp className="h-5 w-5 mr-2 text-gray-600" />
          Earnings Trend (Last 6 Months)
        </h3>
        <div className="space-y-3">
          {metrics.monthlyEarnings.map((month) => (
            <div key={month.month}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-700">{month.month}</span>
                <span className="text-sm font-semibold text-gray-900">
                  R{month.earnings.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-green-600 h-2 rounded-full transition-all duration-500"
                  style={{
                    width: `${maxMonthlyEarnings > 0 ? (month.earnings / maxMonthlyEarnings) * 100 : 0}%`,
                  }}
                ></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
