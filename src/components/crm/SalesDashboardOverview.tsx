import { DollarSign, TrendingUp, Clock, Target, Users, Award, Calendar } from "lucide-react";

interface SalesDashboardOverviewProps {
  summary: {
    totalLeads: number;
    contactedLeads: number;
    qualifiedLeads: number;
    proposalSentLeads: number;
    wonLeads: number;
    lostLeads: number;
    activeLeads: number;
    averageDealValue: number;
    pipelineValue: number;
    averageSalesCycleDays: number;
  };
  conversionRates: {
    leadToContactedRate: number;
    contactedToQualifiedRate: number;
    qualifiedToProposalRate: number;
    proposalToWonRate: number;
    overallWinRate: number;
  };
  monthlyTrends: Array<{
    month: string;
    totalLeads: number;
    wonLeads: number;
    lostLeads: number;
    revenue: number;
  }>;
  topServiceTypes: Array<{
    serviceType: string;
    totalLeads: number;
    wonLeads: number;
    totalValue: number;
    winRate: number;
  }>;
}

export function SalesDashboardOverview({ summary, conversionRates, monthlyTrends, topServiceTypes }: SalesDashboardOverviewProps) {
  const metrics = [
    {
      label: "Pipeline Value",
      value: `R${summary.pipelineValue.toLocaleString()}`,
      icon: DollarSign,
      color: "bg-blue-500",
      textColor: "text-blue-600",
      bgColor: "bg-blue-50",
    },
    {
      label: "Average Deal Value",
      value: `R${Math.round(summary.averageDealValue).toLocaleString()}`,
      icon: Award,
      color: "bg-green-500",
      textColor: "text-green-600",
      bgColor: "bg-green-50",
    },
    {
      label: "Win Rate",
      value: `${conversionRates.overallWinRate.toFixed(1)}%`,
      icon: Target,
      color: "bg-purple-500",
      textColor: "text-purple-600",
      bgColor: "bg-purple-50",
    },
    {
      label: "Avg. Sales Cycle",
      value: `${summary.averageSalesCycleDays} days`,
      icon: Clock,
      color: "bg-orange-500",
      textColor: "text-orange-600",
      bgColor: "bg-orange-50",
    },
    {
      label: "Active Leads",
      value: summary.activeLeads.toString(),
      icon: Users,
      color: "bg-indigo-500",
      textColor: "text-indigo-600",
      bgColor: "bg-indigo-50",
    },
    {
      label: "Won This Period",
      value: summary.wonLeads.toString(),
      icon: TrendingUp,
      color: "bg-emerald-500",
      textColor: "text-emerald-600",
      bgColor: "bg-emerald-50",
    },
  ];

  return (
    <div className="space-y-6">
      {/* Key Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => (
          <div key={metric.label} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">{metric.label}</p>
                <p className={`text-2xl font-bold ${metric.textColor}`}>{metric.value}</p>
              </div>
              <div className={`${metric.bgColor} p-3 rounded-lg`}>
                <metric.icon className={`h-6 w-6 ${metric.textColor}`} />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Monthly Trends */}
      {monthlyTrends.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <Calendar className="h-5 w-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Monthly Performance</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Month
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Leads
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Won
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lost
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Win Rate
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {monthlyTrends.map((trend) => {
                  const winRate = trend.totalLeads > 0 ? (trend.wonLeads / trend.totalLeads) * 100 : 0;
                  const monthName = new Date(trend.month + "-01").toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
                  
                  return (
                    <tr key={trend.month}>
                      <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                        {monthName}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-600">
                        {trend.totalLeads}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-green-600 font-medium">
                        {trend.wonLeads}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-red-600 font-medium">
                        {trend.lostLeads}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                        {winRate.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900 font-medium">
                        R{trend.revenue.toLocaleString()}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Top Service Types */}
      {topServiceTypes.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Top Performing Service Types</h3>
          <div className="space-y-4">
            {topServiceTypes.map((service, index) => (
              <div key={service.serviceType} className="flex items-center space-x-4">
                <div className="flex-shrink-0 w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                  <span className="text-sm font-bold text-blue-600">#{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-900">{service.serviceType}</span>
                    <span className="text-sm text-gray-600">
                      {service.wonLeads}/{service.totalLeads} won
                    </span>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex-1 bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-green-500 h-2 rounded-full transition-all duration-500"
                        style={{ width: `${service.winRate}%` }}
                      />
                    </div>
                    <span className="text-xs font-medium text-gray-600 w-12 text-right">
                      {service.winRate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="mt-1 text-xs text-gray-500">
                    Total Value: R{service.totalValue.toLocaleString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
