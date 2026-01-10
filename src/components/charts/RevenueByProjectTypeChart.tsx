import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { Briefcase } from 'lucide-react';

interface ProjectTypeRevenueData {
  projectType: string;
  revenue: number;
  projectCount: number;
}

interface RevenueByProjectTypeChartProps {
  data: ProjectTypeRevenueData[];
  isLoading?: boolean;
}

const COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#ef4444', '#06b6d4', '#f97316'];

export function RevenueByProjectTypeChart({ data, isLoading }: RevenueByProjectTypeChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Briefcase className="h-5 w-5 text-indigo-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Revenue by Project Type</h2>
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
          <Briefcase className="h-5 w-5 text-indigo-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Revenue by Project Type</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No project type data available</p>
            <p className="text-xs text-gray-500 mt-1">Create projects to see breakdown</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

  const chartData = data.map((item, index) => ({
    ...item,
    name: item.projectType,
    value: item.revenue,
    color: COLORS[index % COLORS.length],
  }));

  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / totalRevenue) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Briefcase className="h-5 w-5 text-indigo-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Revenue by Project Type</h2>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={renderCustomLabel}
              outerRadius={100}
              innerRadius={60}
              fill="#8884d8"
              dataKey="value"
              paddingAngle={2}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
              }}
              formatter={(value: number) => formatCurrency(value)}
            />
            <Legend 
              verticalAlign="bottom" 
              height={36}
              wrapperStyle={{ fontSize: '14px' }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">Total Revenue:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(totalRevenue)}</span>
        </div>
      </div>
    </div>
  );
}
