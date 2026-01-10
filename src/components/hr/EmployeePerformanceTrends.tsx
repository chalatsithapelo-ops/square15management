import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { TrendingUp, TrendingDown, DollarSign, Target, Clock, Star, CheckCircle, Download } from 'lucide-react';
import { MetricCard } from '~/components/MetricCard';

interface MonthlyMetric {
  period: string;
  date: Date;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  conversionRate: number;
  contactRate: number;
  totalValue: number;
  wonValue: number;
  avgDealValue: number;
}

interface MonthlyOrder {
  period: string;
  date: Date;
  completedOrders: number;
  totalRevenue: number;
}

interface MonthlyReview {
  period: string;
  date: Date;
  reviewCount: number;
  avgRating: number;
}

interface PerformanceSummary {
  totalLeads: number;
  wonLeads: number;
  conversionRate: number;
  totalWonValue: number;
  avgDealValue: number;
  totalOrdersCompleted: number;
  totalRevenue: number;
  avgRating: number;
  reviewCount: number;
  avgResponseTimeHours: number;
}

interface EmployeeKPI {
  id: number;
  kpiName: string;
  targetValue: number;
  actualValue: number;
  unit: string;
  achievementRate: number;
  status: string;
  periodStart: Date;
  periodEnd: Date;
}

interface EmployeePerformanceTrendsProps {
  monthlyMetrics: MonthlyMetric[];
  monthlyOrders: MonthlyOrder[];
  monthlyReviews: MonthlyReview[];
  summary: PerformanceSummary;
  employeeRole: string;
  kpis?: EmployeeKPI[];
  isLoading?: boolean;
  onExport?: () => void;
}

export function EmployeePerformanceTrends({
  monthlyMetrics,
  monthlyOrders,
  monthlyReviews,
  summary,
  employeeRole,
  kpis,
  isLoading,
  onExport,
}: EmployeePerformanceTrendsProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`;
  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const hasSalesData = monthlyMetrics.length > 0;
  const hasOrderData = monthlyOrders.length > 0;
  const hasReviewData = monthlyReviews.length > 0;

  // Calculate trend (comparing first half vs second half of data)
  const calculateTrend = (data: number[]) => {
    if (data.length < 2) return 0;
    const midpoint = Math.floor(data.length / 2);
    const firstHalf = data.slice(0, midpoint);
    const secondHalf = data.slice(midpoint);
    const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
    return firstAvg > 0 ? ((secondAvg - firstAvg) / firstAvg) * 100 : 0;
  };

  const conversionTrend = hasSalesData ? calculateTrend(monthlyMetrics.map(m => m.conversionRate)) : 0;
  const dealValueTrend = hasSalesData ? calculateTrend(monthlyMetrics.map(m => m.avgDealValue)) : 0;

  return (
    <div className="space-y-6">
      {/* Export Button */}
      {onExport && (
        <div className="flex justify-end">
          <button
            onClick={onExport}
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 rounded-lg transition-colors"
          >
            <Download className="h-4 w-4 mr-2" />
            Export Performance Data
          </button>
        </div>
      )}

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {hasSalesData && (
          <>
            <MetricCard
              name="Conversion Rate"
              value={formatPercent(summary.conversionRate)}
              icon={Target}
              color="green"
              subtitle={`${summary.wonLeads}/${summary.totalLeads} won`}
              trend={conversionTrend}
            />
            <MetricCard
              name="Avg Deal Value"
              value={formatCurrency(summary.avgDealValue)}
              icon={DollarSign}
              color="purple"
              subtitle={`${formatCurrency(summary.totalWonValue)} total`}
              trend={dealValueTrend}
            />
            {summary.avgResponseTimeHours > 0 && (
              <MetricCard
                name="Avg Response Time"
                value={`${summary.avgResponseTimeHours.toFixed(1)}h`}
                icon={Clock}
                color="blue"
                subtitle="Time to first contact"
              />
            )}
          </>
        )}
        {hasOrderData && (
          <>
            <MetricCard
              name="Orders Completed"
              value={summary.totalOrdersCompleted}
              icon={Target}
              color="blue"
              subtitle={formatCurrency(summary.totalRevenue)}
            />
            <MetricCard
              name="Total Revenue"
              value={formatCurrency(summary.totalRevenue)}
              icon={DollarSign}
              color="green"
              subtitle={`${summary.totalOrdersCompleted} orders`}
            />
          </>
        )}
        {hasReviewData && (
          <MetricCard
            name="Average Rating"
            value={`${summary.avgRating.toFixed(1)}/5`}
            icon={Star}
            color="orange"
            subtitle={`${summary.reviewCount} reviews`}
          />
        )}
      </div>

      {/* KPI Tracking */}
      {kpis && kpis.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Target className="h-5 w-5 text-indigo-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Key Performance Indicators</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {kpis.map((kpi) => {
              const isAchieved = kpi.achievementRate >= 100;
              const isNearTarget = kpi.achievementRate >= 80 && kpi.achievementRate < 100;
              const statusColor = isAchieved 
                ? 'bg-green-100 text-green-800 border-green-200' 
                : isNearTarget 
                ? 'bg-yellow-100 text-yellow-800 border-yellow-200'
                : 'bg-red-100 text-red-800 border-red-200';
              
              return (
                <div key={kpi.id} className={`p-4 rounded-lg border-2 ${statusColor}`}>
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{kpi.kpiName}</h4>
                    {isAchieved && <CheckCircle className="h-5 w-5" />}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline justify-between">
                      <span className="text-2xl font-bold">
                        {kpi.actualValue}
                      </span>
                      <span className="text-sm font-medium">
                        / {kpi.targetValue} {kpi.unit}
                      </span>
                    </div>
                    <div className="w-full bg-white/50 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          isAchieved ? 'bg-green-600' : isNearTarget ? 'bg-yellow-600' : 'bg-red-600'
                        }`}
                        style={{ width: `${Math.min(kpi.achievementRate, 100)}%` }}
                      />
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span>{kpi.achievementRate.toFixed(0)}% achieved</span>
                      <span className="text-gray-600">
                        {new Date(kpi.periodStart).toLocaleDateString()} - {new Date(kpi.periodEnd).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Sales Performance Trends */}
      {hasSalesData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Conversion Rate Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Target className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Conversion Rate Trend</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={formatPercent}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatPercent(value), 'Conversion Rate']}
                  />
                  <Area
                    type="monotone" 
                    dataKey="conversionRate" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#conversionGradient)"
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Deal Value Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-purple-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Average Deal Value</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Avg Deal Value']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="avgDealValue" 
                    stroke="#9333ea" 
                    strokeWidth={2}
                    dot={{ fill: '#9333ea', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Lead Volume Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <TrendingUp className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Lead Volume & Outcomes</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                  />
                  <Legend />
                  <Line 
                    type="monotone" 
                    dataKey="totalLeads" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                    name="Total Leads"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="wonLeads" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    dot={{ fill: '#10b981', r: 3 }}
                    name="Won"
                  />
                  <Line 
                    type="monotone" 
                    dataKey="lostLeads" 
                    stroke="#ef4444" 
                    strokeWidth={2}
                    dot={{ fill: '#ef4444', r: 3 }}
                    name="Lost"
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Revenue Generated</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyMetrics} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Won Value']}
                  />
                  <Area
                    type="monotone" 
                    dataKey="wonValue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#revenueGradient)"
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Artisan Performance Trends */}
      {hasOrderData && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Completed Orders Trend */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <Target className="h-5 w-5 text-blue-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Orders Completed</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={monthlyOrders} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [value, 'Orders']}
                  />
                  <Line 
                    type="monotone" 
                    dataKey="completedOrders" 
                    stroke="#3b82f6" 
                    strokeWidth={2}
                    dot={{ fill: '#3b82f6', r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Revenue from Orders */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <DollarSign className="h-5 w-5 text-green-600 mr-2" />
              <h3 className="text-lg font-semibold text-gray-900">Revenue from Orders</h3>
            </div>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlyOrders} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <defs>
                    <linearGradient id="orderRevenueGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis 
                    dataKey="period" 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                  />
                  <YAxis 
                    stroke="#6b7280"
                    style={{ fontSize: '12px' }}
                    tickFormatter={formatCurrency}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#ffffff',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                    }}
                    formatter={(value: number) => [formatCurrency(value), 'Revenue']}
                  />
                  <Area
                    type="monotone" 
                    dataKey="totalRevenue" 
                    stroke="#10b981" 
                    strokeWidth={2}
                    fill="url(#orderRevenueGradient)"
                    dot={{ fill: '#10b981', r: 3 }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* Review Trend */}
      {hasReviewData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center mb-4">
            <Star className="h-5 w-5 text-orange-600 mr-2" />
            <h3 className="text-lg font-semibold text-gray-900">Customer Rating Trend</h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={monthlyReviews} margin={{ top: 5, right: 20, left: 20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis 
                  dataKey="period" 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                />
                <YAxis 
                  stroke="#6b7280"
                  style={{ fontSize: '12px' }}
                  domain={[0, 5]}
                  ticks={[0, 1, 2, 3, 4, 5]}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#ffffff',
                    border: '1px solid #e5e7eb',
                    borderRadius: '8px',
                    boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                  }}
                  formatter={(value: number, name: string) => {
                    if (name === 'Average Rating') {
                      return [`${value.toFixed(1)}/5`, name];
                    }
                    return [value, name];
                  }}
                />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="avgRating" 
                  stroke="#f97316" 
                  strokeWidth={2}
                  dot={{ fill: '#f97316', r: 3 }}
                  name="Average Rating"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* No Data State */}
      {!hasSalesData && !hasOrderData && !hasReviewData && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
          <TrendingDown className="mx-auto h-12 w-12 text-gray-400 mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Performance Data Available</h3>
          <p className="text-sm text-gray-600">
            Performance trends will appear here as the employee completes activities.
          </p>
        </div>
      )}
    </div>
  );
}
