import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { CreditCard } from 'lucide-react';

interface ExpenseDataPoint {
  name: string;
  value: number;
  color: string;
}

interface ExpenseBreakdownChartProps {
  labourCosts: number;
  materialCosts: number;
  artisanPayments: number;
  isLoading?: boolean;
}

const COLORS = {
  labour: '#ef4444',      // red-500
  materials: '#f59e0b',   // amber-500
  artisan: '#dc2626',     // red-600
};

export function ExpenseBreakdownChart({ 
  labourCosts, 
  materialCosts, 
  artisanPayments,
  isLoading 
}: ExpenseBreakdownChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <CreditCard className="h-5 w-5 text-brand-danger-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  const data: ExpenseDataPoint[] = [
    { name: 'Labour Costs', value: labourCosts, color: COLORS.labour },
    { name: 'Material Costs', value: materialCosts, color: COLORS.materials },
    { name: 'Artisan Payments', value: artisanPayments, color: COLORS.artisan },
  ].filter(item => item.value > 0);

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <CreditCard className="h-5 w-5 text-brand-danger-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No expense data available</p>
            <p className="text-xs text-gray-500 mt-1">Complete orders to see expense breakdown</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const totalExpenses = data.reduce((sum, item) => sum + item.value, 0);

  const renderCustomLabel = (entry: any) => {
    const percent = ((entry.value / totalExpenses) * 100).toFixed(1);
    return `${percent}%`;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center mb-4">
        <CreditCard className="h-5 w-5 text-brand-danger-600 mr-2" />
        <h2 className="text-lg font-semibold text-gray-900">Expense Breakdown</h2>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
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
              {data.map((entry, index) => (
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
          <span className="font-medium text-gray-700">Total Expenses:</span>
          <span className="font-semibold text-gray-900">{formatCurrency(totalExpenses)}</span>
        </div>
      </div>
    </div>
  );
}
