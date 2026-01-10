import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { Award, TrendingUp, TrendingDown } from 'lucide-react';

interface WinRateTrendDataPoint {
  month: string;
  winRate: number;
  wonLeads: number;
  totalLeads: number;
  date: Date;
}

interface WinRateTrendChartProps {
  data: WinRateTrendDataPoint[];
  isLoading?: boolean;
}

export function WinRateTrendChart({ data, isLoading }: WinRateTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Award className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Win Rate Trends</h2>
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
          <Award className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Win Rate Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Award className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No win rate data available</p>
            <p className="text-xs text-gray-500 mt-1">Close some leads to see win rate trends</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate average win rate and trend
  const avgWinRate = sortedData.reduce((sum, d) => sum + d.winRate, 0) / sortedData.length;
  const recentRate = sortedData[sortedData.length - 1].winRate;
  const isPositiveTrend = recentRate >= avgWinRate;

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
          <Award className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Win Rate Trends</h2>
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
          <LineChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
                if (name === 'Win Rate') return [formatPercent(value), name];
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
              y={avgWinRate} 
              stroke="#9ca3af" 
              strokeDasharray="3 3"
              label={{ 
                value: `Avg: ${formatPercent(avgWinRate)}`, 
                position: 'right', 
                fill: '#6b7280', 
                fontSize: 12 
              }}
            />
            <Line 
              type="monotone" 
              dataKey="winRate" 
              stroke="#10b981" 
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color = payload.winRate >= avgWinRate ? '#10b981' : '#ef4444';
                return <circle cx={cx} cy={cy} r={4} fill={color} strokeWidth={2} stroke="#fff" />;
              }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name="Win Rate"
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <Award className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Avg Win Rate</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatPercent(avgWinRate)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Wins</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {sortedData.reduce((sum, d) => sum + d.wonLeads, 0)}
            </p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Best Month</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {formatPercent(Math.max(...sortedData.map(d => d.winRate)))}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
