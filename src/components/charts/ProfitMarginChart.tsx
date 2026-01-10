import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface ProfitMarginDataPoint {
  period: string;
  profitMargin: number;
  netProfit: number;
  revenue: number;
  date: Date;
}

interface ProfitMarginChartProps {
  data: ProfitMarginDataPoint[];
  isLoading?: boolean;
}

export function ProfitMarginChart({ data, isLoading }: ProfitMarginChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <TrendingUp className="h-5 w-5 text-brand-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Profit Margin Trends</h2>
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
          <TrendingUp className="h-5 w-5 text-brand-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Profit Margin Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No profit margin data available</p>
            <p className="text-xs text-gray-500 mt-1">Generate financial reports to see trends</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  // Determine if overall trend is positive or negative
  const avgMargin = sortedData.reduce((sum, d) => sum + d.profitMargin, 0) / sortedData.length;
  const isPositiveTrend = avgMargin >= 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          {isPositiveTrend ? (
            <TrendingUp className="h-5 w-5 text-brand-success-600 mr-2" />
          ) : (
            <TrendingDown className="h-5 w-5 text-brand-danger-600 mr-2" />
          )}
          <h2 className="text-lg font-semibold text-gray-900">Profit Margin Trends</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Average Margin</div>
          <div className={`text-lg font-bold ${isPositiveTrend ? 'text-brand-success-600' : 'text-brand-danger-600'}`}>
            {formatPercent(avgMargin)}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
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
              formatter={(value: number, name: string) => {
                if (name === 'Profit Margin') {
                  return [formatPercent(value), name];
                }
                return [formatCurrency(value), name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="line"
            />
            <ReferenceLine 
              y={0} 
              stroke="#9ca3af" 
              strokeDasharray="3 3"
              label={{ value: 'Break-even', position: 'right', fill: '#6b7280', fontSize: 12 }}
            />
            <Line 
              type="monotone" 
              dataKey="profitMargin" 
              stroke="#2D5016" 
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color = payload.profitMargin >= 0 ? '#10b981' : '#dc2626';
                return <circle cx={cx} cy={cy} r={4} fill={color} />;
              }}
              activeDot={{ r: 6 }}
              name="Profit Margin"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
