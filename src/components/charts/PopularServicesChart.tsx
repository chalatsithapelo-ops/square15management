import { useState } from "react";
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { Wrench, Award, TrendingUp } from 'lucide-react';

interface ServiceData {
  serviceType: string;
  orderCount: number;
  revenue: number;
  completedCount: number;
  averageRevenue: number;
}

interface PopularServicesChartProps {
  data: ServiceData[];
  isLoading?: boolean;
}

export function PopularServicesChart({ data, isLoading }: PopularServicesChartProps) {
  const [sortBy, setSortBy] = useState<"orders" | "revenue">("orders");

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Wrench className="h-5 w-5 text-orange-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Popular Services</h2>
          </div>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Wrench className="h-5 w-5 text-orange-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Popular Services</h2>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Wrench className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No service data available</p>
            <p className="text-xs text-gray-500 mt-1">Create orders to see popular services</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const barColors = ['#f97316', '#fb923c', '#fdba74', '#fed7aa', '#ffedd5', '#fff7ed', '#fef3c7', '#fde68a'];

  // Sort data based on selected criterion
  const sortedData = [...data].sort((a, b) => {
    if (sortBy === "orders") {
      return b.orderCount - a.orderCount;
    } else {
      return b.revenue - a.revenue;
    }
  });

  const totalOrders = data.reduce((sum, item) => sum + item.orderCount, 0);
  const totalRevenue = data.reduce((sum, item) => sum + item.revenue, 0);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Wrench className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Popular Services</h2>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy("orders")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              sortBy === "orders"
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            By Orders
          </button>
          <button
            onClick={() => setSortBy("revenue")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
              sortBy === "revenue"
                ? 'bg-orange-100 text-orange-700'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            By Revenue
          </button>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <defs>
              <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={1}/>
                <stop offset="100%" stopColor="#fb923c" stopOpacity={0.8}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="serviceType" 
              stroke="#6b7280"
              style={{ fontSize: '11px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={sortBy === "revenue" ? formatCurrency : undefined}
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
                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                if (name === 'orderCount') return [value, 'Orders'];
                if (name === 'completedCount') return [value, 'Completed'];
                return [value, name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            {sortBy === "orders" ? (
              <>
                <Bar dataKey="orderCount" name="Total Orders" radius={[8, 8, 0, 0]} animationDuration={1000}>
                  {sortedData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                  ))}
                </Bar>
                <Bar dataKey="completedCount" fill="#fb923c" name="Completed" radius={[8, 8, 0, 0]} animationDuration={1000} />
              </>
            ) : (
              <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]} animationDuration={1000}>
                {sortedData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={barColors[index % barColors.length]} />
                ))}
              </Bar>
            )}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center text-orange-600 mb-1">
              <Wrench className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Orders</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{totalOrders}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <Award className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Top Service</span>
            </div>
            <p className="text-sm font-bold text-gray-900 truncate">{sortedData[0]?.serviceType || 'N/A'}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
