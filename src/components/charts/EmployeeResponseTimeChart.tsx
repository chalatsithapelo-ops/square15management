import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from 'recharts';
import { Clock, Zap, AlertTriangle } from 'lucide-react';

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

interface EmployeeResponseTimeChartProps {
  data: EmployeePerformanceData[];
  isLoading?: boolean;
}

export function EmployeeResponseTimeChart({ data, isLoading }: EmployeeResponseTimeChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Clock className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Average Response Time by Employee</h2>
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
          <Clock className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Average Response Time by Employee</h2>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No response time data available</p>
            <p className="text-xs text-gray-500 mt-1">Leads need to be contacted to track response times</p>
          </div>
        </div>
      </div>
    );
  }

  // Filter out employees with no response time data and sort by response time
  const chartData = data
    .filter(item => item.metrics.avgResponseTimeHours > 0)
    .map((item) => ({
      name: `${item.employee.firstName} ${item.employee.lastName}`,
      responseTime: item.metrics.avgResponseTimeHours,
      totalLeads: item.metrics.totalLeads,
      contactRate: item.metrics.contactRate,
      fullData: item,
    }))
    .sort((a, b) => a.responseTime - b.responseTime); // Fastest first

  if (chartData.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Clock className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Average Response Time by Employee</h2>
        </div>
        <div className="h-96 flex items-center justify-center">
          <div className="text-center">
            <Clock className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No employees have contacted leads yet</p>
            <p className="text-xs text-gray-500 mt-1">Response times will appear once leads are contacted</p>
          </div>
        </div>
      </div>
    );
  }

  // Determine performance thresholds (in hours)
  const fastThreshold = 24; // Less than 24 hours is fast
  const mediumThreshold = 72; // Less than 72 hours (3 days) is medium

  const getBarColor = (responseTime: number) => {
    if (responseTime <= fastThreshold) return "#10b981"; // Green - Fast
    if (responseTime <= mediumThreshold) return "#f59e0b"; // Orange - Medium
    return "#ef4444"; // Red - Slow
  };

  const getPerformanceLabel = (responseTime: number) => {
    if (responseTime <= fastThreshold) return "Fast";
    if (responseTime <= mediumThreshold) return "Medium";
    return "Slow";
  };

  const formatTime = (hours: number) => {
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      const days = Math.floor(hours / 24);
      const remainingHours = hours % 24;
      if (remainingHours < 1) {
        return `${days}d`;
      }
      return `${days}d ${remainingHours.toFixed(0)}h`;
    }
  };

  // Calculate average response time
  const avgResponseTime = chartData.reduce((sum, item) => sum + item.responseTime, 0) / chartData.length;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Clock className="h-5 w-5 text-orange-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Average Response Time by Employee</h2>
        </div>
        <div className="text-sm text-gray-600">
          Team Average: <span className="font-semibold text-gray-900">{formatTime(avgResponseTime)}</span>
        </div>
      </div>

      {/* Performance Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs">
        <div className="flex items-center">
          <Zap className="h-3 w-3 text-green-600 mr-1" />
          <span className="text-gray-600">Fast (&lt; 24h)</span>
        </div>
        <div className="flex items-center">
          <Clock className="h-3 w-3 text-orange-600 mr-1" />
          <span className="text-gray-600">Medium (24-72h)</span>
        </div>
        <div className="flex items-center">
          <AlertTriangle className="h-3 w-3 text-red-600 mr-1" />
          <span className="text-gray-600">Slow (&gt; 72h)</span>
        </div>
      </div>

      <div className="h-96">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart 
            data={chartData} 
            layout="vertical"
            margin={{ top: 5, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              type="number"
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatTime}
            />
            <YAxis 
              type="category"
              dataKey="name" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              width={90}
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
                const item = props.payload;
                const performance = getPerformanceLabel(value);
                const performanceColor = 
                  performance === "Fast" ? "text-green-600" : 
                  performance === "Medium" ? "text-orange-600" : 
                  "text-red-600";
                
                return [
                  <div key="tooltip" className="space-y-1">
                    <div className="font-semibold text-gray-900">{formatTime(value)}</div>
                    <div className={`text-xs font-medium ${performanceColor}`}>
                      {performance} Response
                    </div>
                    <div className="text-xs text-gray-600 space-y-0.5 pt-1">
                      <div>Total Leads: {item.totalLeads}</div>
                      <div>Contact Rate: {item.contactRate.toFixed(1)}%</div>
                    </div>
                  </div>,
                  "Avg Response Time"
                ];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="square"
            />
            <Bar 
              dataKey="responseTime" 
              name="Response Time"
              radius={[0, 8, 8, 0]}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.responseTime)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Summary Stats */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <Zap className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Fast Responders</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {chartData.filter(d => d.responseTime <= fastThreshold).length}
            </p>
          </div>
          <div className="bg-orange-50 rounded-lg p-3">
            <div className="flex items-center text-orange-600 mb-1">
              <Clock className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Medium</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {chartData.filter(d => d.responseTime > fastThreshold && d.responseTime <= mediumThreshold).length}
            </p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Needs Improvement</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {chartData.filter(d => d.responseTime > mediumThreshold).length}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
