import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Area, AreaChart } from 'recharts';
import { DollarSign, TrendingUp, AlertTriangle } from 'lucide-react';

interface BudgetUtilizationDataPoint {
  period: string;
  budgetUtilizationPercentage: number;
  totalProjectBudget: number;
  totalProjectActualCost: number;
  projectsOverBudget: number;
  date: Date;
}

interface BudgetUtilizationTrendChartProps {
  data: BudgetUtilizationDataPoint[];
  isLoading?: boolean;
}

export function BudgetUtilizationTrendChart({ data, isLoading }: BudgetUtilizationTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Budget Utilization Trends</h2>
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
          <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Budget Utilization Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No budget data available</p>
            <p className="text-xs text-gray-500 mt-1">Budget metrics will appear as projects are created</p>
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

  // Calculate average utilization
  const avgUtilization = sortedData.reduce((sum, d) => sum + d.budgetUtilizationPercentage, 0) / sortedData.length;
  const latestData = sortedData[sortedData.length - 1];
  const isHealthy = avgUtilization <= 90;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <DollarSign className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Budget Utilization Trends</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Current Utilization</div>
          <div className={`text-lg font-bold ${
            latestData.budgetUtilizationPercentage > 100 ? 'text-red-600' :
            latestData.budgetUtilizationPercentage > 90 ? 'text-amber-600' :
            'text-green-600'
          }`}>
            {formatPercent(latestData.budgetUtilizationPercentage)}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="budgetUtilizationGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
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
                padding: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'Budget Utilization') {
                  return [formatPercent(value), name];
                }
                return [value, name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="line"
            />
            <ReferenceLine 
              y={90} 
              stroke="#f59e0b" 
              strokeDasharray="3 3"
              label={{ value: 'Warning (90%)', position: 'right', fill: '#f59e0b', fontSize: 11 }}
            />
            <ReferenceLine 
              y={100} 
              stroke="#dc2626" 
              strokeDasharray="3 3"
              label={{ value: 'Over Budget', position: 'right', fill: '#dc2626', fontSize: 11 }}
            />
            <Area
              type="monotone" 
              dataKey="budgetUtilizationPercentage" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#budgetUtilizationGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const color = payload.budgetUtilizationPercentage > 100 ? '#dc2626' :
                             payload.budgetUtilizationPercentage > 90 ? '#f59e0b' :
                             '#10b981';
                return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={{ r: 6 }}
              name="Budget Utilization"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Budget</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(latestData.totalProjectBudget)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Actual Cost</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(latestData.totalProjectActualCost)}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Over Budget</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.projectsOverBudget} projects</p>
          </div>
        </div>
      </div>
    </div>
  );
}
