import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { Users } from 'lucide-react';

interface ClientRevenueData {
  clientName: string;
  revenue: number;
  invoiceCount: number;
}

interface RevenueByClientChartProps {
  data: ClientRevenueData[];
  isLoading?: boolean;
}

export function RevenueByClientChart({ data, isLoading }: RevenueByClientChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Users className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Revenue by Client</h2>
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
          <Users className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Revenue by Client</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No client revenue data available</p>
            <p className="text-xs text-gray-500 mt-1">Complete invoices to see client breakdown</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  // Sort by revenue descending and take top 10
  const sortedData = [...data]
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Top Clients by Revenue</h2>
        </div>
        <div className="text-xs text-gray-500">Top 10</div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="clientName" 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
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
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                return [value, 'Invoices'];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="rect"
            />
            <Bar dataKey="revenue" fill="#3b82f6" name="Revenue" radius={[8, 8, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
