import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Cell } from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { TrendingUp, TrendingDown, DollarSign } from 'lucide-react';

interface ProfitVarianceDataPoint {
  name: string;
  expectedProfit: number;
  actualProfit: number;
  variance: number;
  id: number;
}

interface ProfitVarianceChartProps {
  data: ProfitVarianceDataPoint[];
  isLoading?: boolean;
  title?: string;
  type?: "project" | "milestone";
}

export function ProfitVarianceChart({ 
  data, 
  isLoading, 
  title = "Profit Variance Analysis",
  type = "project" 
}: ProfitVarianceChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <DollarSign className="h-5 w-5 text-brand-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <DollarSign className="h-5 w-5 text-brand-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No {type} data available</p>
            <p className="text-xs text-gray-500 mt-1">Add {type}s with budgets to see profit analysis</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  // Sort data by variance (worst performing first)
  const sortedData = [...data].sort((a, b) => a.variance - b.variance);

  // Take top 10 for better visualization
  const displayData = sortedData.slice(0, 10);

  const totalVariance = data.reduce((sum, item) => sum + item.variance, 0);
  const positiveVariance = data.filter((item) => item.variance > 0).length;
  const negativeVariance = data.filter((item) => item.variance < 0).length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <DollarSign className="h-5 w-5 text-brand-primary-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Total Variance</div>
          <div className={`text-lg font-bold ${totalVariance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
            {formatCurrency(totalVariance)}
          </div>
        </div>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={displayData} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              type="number"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatCurrency}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
              width={90}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number, name: string) => {
                const labels: Record<string, string> = {
                  expectedProfit: 'Expected Profit',
                  actualProfit: 'Actual Profit',
                  variance: 'Variance',
                };
                return [formatCurrency(value), labels[name] || name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="rect"
            />
            <ReferenceLine 
              x={0} 
              stroke="#9ca3af" 
              strokeDasharray="3 3"
            />
            <Bar 
              dataKey="expectedProfit" 
              fill="#3b82f6" 
              name="Expected Profit"
              radius={[0, 4, 4, 0]}
            />
            <Bar 
              dataKey="actualProfit" 
              name="Actual Profit"
              radius={[0, 4, 4, 0]}
            >
              {displayData.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={entry.actualProfit >= entry.expectedProfit ? '#10b981' : '#ef4444'} 
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Above Expected</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{positiveVariance}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center text-red-600 mb-1">
              <TrendingDown className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Below Expected</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{negativeVariance}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total {type}s</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{data.length}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
