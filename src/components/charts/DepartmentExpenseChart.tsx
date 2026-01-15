import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { Building2 } from 'lucide-react';

interface DepartmentExpense {
  department: string;
  total: number;
  payslips: number;
  paymentRequests: number;
  orderLabour: number;
  orderMaterials: number;
  milestoneLabour: number;
  milestoneMaterials: number;
}

interface DepartmentExpenseChartProps {
  data: DepartmentExpense[];
  isLoading?: boolean;
}

const COLORS = [
  '#8b5cf6', // purple-600
  '#ec4899', // pink-600
  '#f59e0b', // amber-500
  '#10b981', // green-500
  '#3b82f6', // blue-500
  '#ef4444', // red-500
  '#14b8a6', // teal-500
  '#f97316', // orange-500
];

export function DepartmentExpenseChart({ data, isLoading }: DepartmentExpenseChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Building2 className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Expenses by Department</h2>
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
          <Building2 className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Expenses by Department</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Building2 className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No expense data available</p>
            <p className="text-xs text-gray-500 mt-1">Complete work to see department expenses</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const totalExpenses = data.reduce((sum, item) => sum + item.total, 0);

  // Format department names for display
  const formatDepartmentName = (dept: string) => {
    return dept
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  const chartData = data.map((item) => ({
    ...item,
    displayName: formatDepartmentName(item.department),
  }));

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <Building2 className="h-5 w-5 text-purple-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Expenses by Department</h2>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="displayName" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
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
              formatter={(value: number) => formatCurrency(value)}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              verticalAlign="top"
              height={36}
            />
            <Bar dataKey="total" name="Total Expenses" radius={[8, 8, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex justify-between text-sm">
          <span className="font-medium text-gray-700">Total Expenses:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(totalExpenses)}</span>
        </div>
      </div>
    </div>
  );
}
