import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Users, UserPlus, Activity } from 'lucide-react';

interface CustomerTrendData {
  period: string;
  newCustomers: number;
  activeCustomers: number;
  totalCustomers: number;
  date: Date;
}

interface CustomerTrendsChartProps {
  dailyData: CustomerTrendData[];
  weeklyData: CustomerTrendData[];
  monthlyData: CustomerTrendData[];
  isLoading?: boolean;
  onPeriodChange?: (period: "DAILY" | "WEEKLY" | "MONTHLY") => void;
}

export function CustomerTrendsChart({ 
  dailyData, 
  weeklyData, 
  monthlyData, 
  isLoading,
  onPeriodChange 
}: CustomerTrendsChartProps) {
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
            <Users className="h-5 w-5 text-purple-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Customer Trends</h2>
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
            <Users className="h-5 w-5 text-purple-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Customer Trends</h2>
          </div>
          <div className="flex gap-2">
            {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((period) => (
              <button
                key={period}
                onClick={() => handlePeriodChange(period)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  selectedPeriod === period
                    ? 'bg-purple-100 text-purple-700'
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
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No customer data available</p>
            <p className="text-xs text-gray-500 mt-1">Customer registrations will appear here</p>
          </div>
        </div>
      </div>
    );
  }

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

  const totalNewCustomers = currentData.reduce((sum, item) => sum + item.newCustomers, 0);
  const latestTotal = currentData.length > 0 ? currentData[currentData.length - 1].totalCustomers : 0;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Users className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Customer Trends</h2>
        </div>
        <div className="flex gap-2">
          {(["DAILY", "WEEKLY", "MONTHLY"] as const).map((period) => (
            <button
              key={period}
              onClick={() => handlePeriodChange(period)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedPeriod === period
                  ? 'bg-purple-100 text-purple-700'
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
              <linearGradient id="newCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="activeCustomersGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="totalCustomersGradient" x1="0" y1="0" x2="0" y2="1">
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
                if (name === 'newCustomers') return [value, 'New Customers'];
                if (name === 'activeCustomers') return [value, 'Active Customers'];
                if (name === 'totalCustomers') return [value, 'Total Customers'];
                return [value, name];
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
              dataKey="totalCustomers" 
              stroke="#3b82f6" 
              strokeWidth={3}
              fill="url(#totalCustomersGradient)"
              dot={{ fill: '#3b82f6', r: 4, strokeWidth: 2, stroke: '#fff' }}
              name="Total Customers"
              animationDuration={1000}
            />
            <Area 
              type="monotone" 
              dataKey="activeCustomers" 
              stroke="#10b981" 
              strokeWidth={2}
              fill="url(#activeCustomersGradient)"
              dot={{ fill: '#10b981', r: 3, strokeWidth: 2, stroke: '#fff' }}
              name="Active Customers"
              animationDuration={1200}
            />
            <Area 
              type="monotone" 
              dataKey="newCustomers" 
              stroke="#8b5cf6" 
              strokeWidth={2}
              fill="url(#newCustomersGradient)"
              dot={{ fill: '#8b5cf6', r: 3, strokeWidth: 2, stroke: '#fff' }}
              name="New Customers"
              animationDuration={1400}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <UserPlus className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">New in Period</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{totalNewCustomers}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <Activity className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Active Now</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {currentData.length > 0 ? currentData[currentData.length - 1].activeCustomers : 0}
            </p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <Users className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestTotal}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
