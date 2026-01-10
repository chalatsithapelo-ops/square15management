import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Calendar, TrendingUp, DollarSign, Receipt } from 'lucide-react';

interface RevenueDataPoint {
  period: string;
  revenue: number;
  invoiceCount: number;
  date: Date;
}

interface RevenueComparisonChartProps {
  dailyData: RevenueDataPoint[];
  weeklyData: RevenueDataPoint[];
  monthlyData: RevenueDataPoint[];
  isLoading?: boolean;
  onPeriodChange?: (period: "DAILY" | "WEEKLY" | "MONTHLY") => void;
}

export function RevenueComparisonChart({ 
  dailyData, 
  weeklyData, 
  monthlyData, 
  isLoading,
  onPeriodChange 
}: RevenueComparisonChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"DAILY" | "WEEKLY" | "MONTHLY">("MONTHLY");

  const handlePeriodChange = (period: "DAILY" | "WEEKLY" | "MONTHLY") => {
    setSelectedPeriod(period);
    onPeriodChange?.(period);
  };

  const currentData = 
    selectedPeriod === "DAILY" ? dailyData :
    selectedPeriod === "WEEKLY" ? weeklyData :
    monthlyData;

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Revenue Comparison</h2>
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-gray-400">Loading chart data...</div>
        </div>
      </div>
    );
  }

  if (currentData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Calendar className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Revenue Comparison</h2>
          </div>
          <div className="flex gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {period}
              </button>
            ))}
          </div>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <TrendingUp className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No revenue data available</p>
            <p className="text-xs text-gray-500 mt-1">Complete and pay invoices to see trends</p>
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return `R${value.toLocaleString()}`;
  };

  const formatPeriodLabel = (period: string) => {
    if (selectedPeriod === "DAILY") {
      return new Date(period).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
    } else if (selectedPeriod === "WEEKLY") {
      return `Week of ${new Date(period).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}`;
    } else {
      const [year, month] = period.split('-');
      return new Date(parseInt(year), parseInt(month) - 1).toLocaleDateString('en-ZA', { year: 'numeric', month: 'short' });
    }
  };

  const totalRevenue = currentData.reduce((sum, item) => sum + item.revenue, 0);
  const averageRevenue = currentData.length > 0 ? totalRevenue / currentData.length : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Calendar className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Revenue Comparison</h2>
        </div>
        <div className="flex gap-2">
          {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {period}
            </button>
          ))}
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={currentData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="period" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatPeriodLabel}
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
                padding: '12px',
              }}
              formatter={(value: number, name: string) => {
                if (name === 'revenue') return [formatCurrency(value), 'Revenue'];
                return [value, 'Invoices'];
              }}
              labelFormatter={formatPeriodLabel}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            <Area 
              type="monotone" 
              dataKey="revenue" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#revenueGradient)"
              dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name="Revenue"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Revenue</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(totalRevenue)}</p>
          </div>
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Average</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(averageRevenue)}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <Receipt className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Invoices</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {currentData.reduce((sum, item) => sum + item.invoiceCount, 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
