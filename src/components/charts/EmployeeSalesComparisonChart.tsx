import { useState } from "react";
import { BarChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, Cell } from 'recharts';
import { Bar } from 'recharts/es6/cartesian/Bar';
import { Users, TrendingUp, Clock, Target, Award } from 'lucide-react';

interface EmployeePerformanceData {
  employee: {
    id: number;
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  metrics: {
    totalLeads: number;
    wonLeads: number;
    lostLeads: number;
    activeLeads: number;
    conversionRate: number;
    winRate: number;
    contactRate: number;
    avgResponseTimeHours: number;
    avgDealValue: number;
    pipelineValue: number;
    totalWonValue: number;
  };
  leadsByStatus: {
    NEW: number;
    CONTACTED: number;
    QUALIFIED: number;
    PROPOSAL_SENT: number;
    NEGOTIATION: number;
    WON: number;
    LOST: number;
  };
}

interface EmployeeSalesComparisonChartProps {
  data: EmployeePerformanceData[];
  isLoading?: boolean;
}

type MetricType = "leadVolume" | "conversionRate" | "responseTime" | "winRate" | "dealValue";

export function EmployeeSalesComparisonChart({ data, isLoading }: EmployeeSalesComparisonChartProps) {
  const [selectedMetric, setSelectedMetric] = useState<MetricType>("leadVolume");

  const metricOptions = [
    { value: "leadVolume" as MetricType, label: "Lead Volume", icon: Users, color: "#3b82f6" },
    { value: "conversionRate" as MetricType, label: "Conversion Rate", icon: Target, color: "#10b981" },
    { value: "responseTime" as MetricType, label: "Response Time", icon: Clock, color: "#f59e0b" },
    { value: "winRate" as MetricType, label: "Win Rate", icon: TrendingUp, color: "#8b5cf6" },
    { value: "dealValue" as MetricType, label: "Avg Deal Value", icon: Award, color: "#ec4899" },
  ];

  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Employee Performance Comparison</h2>
          </div>
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
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center">
            <Users className="h-5 w-5 text-blue-600 mr-2" />
            <h2 className="text-lg font-semibold text-gray-900">Employee Performance Comparison</h2>
          </div>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <Users className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No employee performance data available</p>
            <p className="text-xs text-gray-500 mt-1">Leads need to be created to see performance metrics</p>
          </div>
        </div>
      </div>
    );
  }

  // Transform data based on selected metric
  const chartData = data.map((item) => {
    const employeeName = `${item.employee.firstName} ${item.employee.lastName}`;
    
    let value = 0;
    switch (selectedMetric) {
      case "leadVolume":
        value = item.metrics.totalLeads;
        break;
      case "conversionRate":
        value = item.metrics.conversionRate;
        break;
      case "responseTime":
        value = item.metrics.avgResponseTimeHours;
        break;
      case "winRate":
        value = item.metrics.winRate;
        break;
      case "dealValue":
        value = item.metrics.avgDealValue;
        break;
    }

    return {
      name: employeeName,
      value: value,
      fullData: item,
    };
  });

  const selectedOption = metricOptions.find(opt => opt.value === selectedMetric)!;

  const formatValue = (value: number) => {
    switch (selectedMetric) {
      case "leadVolume":
        return value.toString();
      case "conversionRate":
      case "winRate":
        return `${value.toFixed(1)}%`;
      case "responseTime":
        return `${value.toFixed(1)}h`;
      case "dealValue":
        return `R${value.toLocaleString()}`;
      default:
        return value.toString();
    }
  };

  // Color cells based on performance (green for good, red for poor)
  const getBarColor = (value: number, index: number) => {
    // For response time, lower is better
    if (selectedMetric === "responseTime") {
      const maxValue = Math.max(...chartData.map(d => d.value));
      const ratio = value / maxValue;
      if (ratio < 0.5) return "#10b981"; // Green for fast response
      if (ratio < 0.75) return "#f59e0b"; // Orange for medium
      return "#ef4444"; // Red for slow
    }
    
    // For other metrics, higher is better
    const maxValue = Math.max(...chartData.map(d => d.value));
    const ratio = value / maxValue;
    if (ratio > 0.75) return "#10b981"; // Green for high performance
    if (ratio > 0.5) return "#f59e0b"; // Orange for medium
    return "#ef4444"; // Red for low performance
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <selectedOption.icon className="h-5 w-5 text-blue-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Employee Performance Comparison</h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {metricOptions.map((option) => (
            <button
              key={option.value}
              onClick={() => setSelectedMetric(option.value)}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                selectedMetric === option.value
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      </div>
      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 60 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="name" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              angle={-45}
              textAnchor="end"
              height={80}
            />
            <YAxis 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatValue}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#ffffff',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
                padding: '12px',
              }}
              formatter={(value: number, name: string, props: any) => {
                const item = props.payload.fullData;
                return [
                  <div key="tooltip" className="space-y-1">
                    <div className="font-semibold text-gray-900">{formatValue(value)}</div>
                    <div className="text-xs text-gray-600 space-y-0.5">
                      <div>Total Leads: {item.metrics.totalLeads}</div>
                      <div>Won: {item.metrics.wonLeads}</div>
                      <div>Win Rate: {item.metrics.winRate.toFixed(1)}%</div>
                      <div>Pipeline: R{item.metrics.pipelineValue.toLocaleString()}</div>
                    </div>
                  </div>,
                  selectedOption.label
                ];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="square"
            />
            <Bar 
              dataKey="value" 
              name={selectedOption.label}
              radius={[8, 8, 0, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.value, index)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
