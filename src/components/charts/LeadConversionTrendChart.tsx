import { LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown, Target } from 'lucide-react';

interface ConversionTrendDataPoint {
  month: string;
  conversionRate: number;
  totalLeads: number;
  wonLeads: number;
  lostLeads: number;
  date: Date;
}

interface LeadConversionTrendChartProps {
  data: ConversionTrendDataPoint[];
  isLoading?: boolean;
}

export function LeadConversionTrendChart({ data, isLoading }: LeadConversionTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Lead Conversion Rate Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Target className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Lead Conversion Rate Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Target className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No conversion data available</p>
            <p className="text-xs text-gray-500 mt-1">Start managing leads to see conversion trends</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate average conversion rate and trend
  const avgConversionRate = sortedData.reduce((sum, d) => sum + d.conversionRate, 0) / sortedData.length;
  const recentRate = sortedData[sortedData.length - 1].conversionRate;
  const isPositiveTrend = recentRate >= avgConversionRate;

  const formatPercent = (value: number) => `${value.toFixed(1)}%`;

  const formatMonthLabel = (month: string) => {
    const [year, monthNum] = month.split('-');
    return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Target className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Lead Conversion Rate Trends</h2>
        </div>
        <div className="text-right">
          <div className="flex items-center space-x-2">
            {isPositiveTrend ? (
              <TrendingUp className="h-5 w-5 text-green-600" />
            ) : (
              <TrendingDown className="h-5 w-5 text-red-600" />
            )}
            <div>
              <div className="text-xs text-gray-500">Current Rate</div>
              <div className={`text-lg font-bold ${isPositiveTrend ? 'text-green-600' : 'text-red-600'}`}>
                {formatPercent(recentRate)}
              </div>
            </div>
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="conversionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatMonthLabel}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatPercent}
              domain={[0, 'auto']}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                padding: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Conversion Rate') return [formatPercent(value), name];
                return [value, name];
              }}
              labelFormatter={formatMonthLabel}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            <ReferenceLine 
              y={avgConversionRate} 
              stroke="#9ca3af" 
              strokeDasharray="3 3"
              label={{ 
                value: `Avg: ${formatPercent(avgConversionRate)}`, 
                position: 'right', 
                fill: '#6b7280', 
                fontSize: 12 
              }}
            />
            <Area 
              type="monotone" 
              dataKey="conversionRate" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#conversionGradient)"
              dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name="Conversion Rate"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <Target className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Average Rate</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatPercent(avgConversionRate)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Won</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {sortedData.reduce((sum, d) => sum + d.wonLeads, 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <TrendingDown className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Lost</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {sortedData.reduce((sum, d) => sum + d.lostLeads, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
