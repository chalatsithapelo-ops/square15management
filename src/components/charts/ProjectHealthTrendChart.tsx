import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, ReferenceLine, Area, AreaChart } from 'recharts';
import { Activity, TrendingUp, TrendingDown, AlertTriangle, FolderKanban } from 'lucide-react';

interface ProjectHealthDataPoint {
  period: string;
  averageProjectHealthScore: number;
  totalProjects: number;
  activeProjects: number;
  projectsAtRisk: number;
  date: Date;
}

interface ProjectHealthTrendChartProps {
  data: ProjectHealthDataPoint[];
  isLoading?: boolean;
}

export function ProjectHealthTrendChart({ data, isLoading }: ProjectHealthTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Activity className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Project Health Trends</h2>
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
          <Activity className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Project Health Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Activity className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No project health data available</p>
            <p className="text-xs text-gray-500 mt-1">Health metrics will appear as projects are created</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatScore = (value: number) => {
    return value.toFixed(1);
  };

  // Calculate average health score
  const avgHealthScore = sortedData.reduce((sum, d) => sum + d.averageProjectHealthScore, 0) / sortedData.length;
  const latestData = sortedData[sortedData.length - 1];
  
  // Determine health status
  const getHealthStatus = (score: number) => {
    if (score >= 80) return { label: 'Excellent', color: 'text-green-600', icon: TrendingUp };
    if (score >= 60) return { label: 'Good', color: 'text-blue-600', icon: Activity };
    if (score >= 40) return { label: 'Fair', color: 'text-amber-600', icon: AlertTriangle };
    return { label: 'Poor', color: 'text-red-600', icon: TrendingDown };
  };

  const healthStatus = getHealthStatus(latestData.averageProjectHealthScore);
  const HealthIcon = healthStatus.icon;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Activity className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Project Health Trends</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Current Health</div>
          <div className="flex items-center justify-end space-x-2">
            <HealthIcon className={`h-4 w-4 ${healthStatus.color}`} />
            <div className={`text-lg font-bold ${healthStatus.color}`}>
              {formatScore(latestData.averageProjectHealthScore)}/100
            </div>
          </div>
          <div className={`text-xs font-medium ${healthStatus.color}`}>
            {healthStatus.label}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="healthScoreGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
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
              domain={[0, 100]}
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
                if (name === 'Health Score') {
                  return [formatScore(value), name];
                }
                return [value, name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="circle"
            />
            <ReferenceLine 
              y={80} 
              stroke="#10b981" 
              strokeDasharray="3 3"
              label={{ value: 'Excellent', position: 'right', fill: '#10b981', fontSize: 11 }}
            />
            <ReferenceLine 
              y={60} 
              stroke="#3b82f6" 
              strokeDasharray="3 3"
              label={{ value: 'Good', position: 'right', fill: '#3b82f6', fontSize: 11 }}
            />
            <ReferenceLine 
              y={40} 
              stroke="#f59e0b" 
              strokeDasharray="3 3"
              label={{ value: 'Fair', position: 'right', fill: '#f59e0b', fontSize: 11 }}
            />
            <Area
              type="monotone" 
              dataKey="averageProjectHealthScore" 
              stroke="#8b5cf6" 
              strokeWidth={3}
              fill="url(#healthScoreGradient)"
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const score = payload.averageProjectHealthScore;
                const color = score >= 80 ? '#10b981' :
                             score >= 60 ? '#3b82f6' :
                             score >= 40 ? '#f59e0b' :
                             '#dc2626';
                return <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={2} />;
              }}
              activeDot={{ r: 6 }}
              name="Health Score"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <FolderKanban className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total Projects</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.totalProjects}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <Activity className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Active</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.activeProjects}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center text-red-600 mb-1">
              <AlertTriangle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">At Risk</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.projectsAtRisk}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
