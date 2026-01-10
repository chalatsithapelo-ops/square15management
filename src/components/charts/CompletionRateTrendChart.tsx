import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { CheckCircle, Target, Clock, AlertCircle } from 'lucide-react';

interface CompletionRateDataPoint {
  period: string;
  milestoneCompletionRate: number;
  totalMilestones: number;
  completedMilestones: number;
  inProgressMilestones: number;
  delayedMilestones: number;
  date: Date;
}

interface CompletionRateTrendChartProps {
  data: CompletionRateDataPoint[];
  isLoading?: boolean;
}

export function CompletionRateTrendChart({ data, isLoading }: CompletionRateTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Milestone Completion Trends</h2>
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
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Milestone Completion Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Target className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No milestone data available</p>
            <p className="text-xs text-gray-500 mt-1">Milestone completion rates will appear as projects progress</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  // Calculate average completion rate
  const avgCompletionRate = sortedData.reduce((sum, d) => sum + d.milestoneCompletionRate, 0) / sortedData.length;
  const latestData = sortedData[sortedData.length - 1];
  const isOnTrack = avgCompletionRate >= 70;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Milestone Completion Trends</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Current Rate</div>
          <div className={`text-lg font-bold ${
            latestData.milestoneCompletionRate >= 80 ? 'text-green-600' :
            latestData.milestoneCompletionRate >= 60 ? 'text-amber-600' :
            'text-red-600'
          }`}>
            {formatPercent(latestData.milestoneCompletionRate)}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="completionRateGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
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
              tickFormatter={formatPercent}
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
                if (name === 'Completion Rate') {
                  return [formatPercent(value), name];
                }
                return [value, name];
              }}
              labelStyle={{ color: '#111827', fontWeight: 600 }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px' }}
              iconType="circle"
            />
            <Area
              type="monotone" 
              dataKey="milestoneCompletionRate" 
              stroke="#10b981" 
              strokeWidth={3}
              fill="url(#completionRateGradient)"
              dot={{ fill: '#10b981', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6 }}
              name="Completion Rate"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <Target className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Total</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.totalMilestones}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <CheckCircle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Completed</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.completedMilestones}</p>
          </div>
          <div className="bg-amber-50 rounded-lg p-3">
            <div className="flex items-center text-amber-600 mb-1">
              <Clock className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">In Progress</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.inProgressMilestones}</p>
          </div>
          <div className="bg-red-50 rounded-lg p-3">
            <div className="flex items-center text-red-600 mb-1">
              <AlertCircle className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Delayed</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{latestData.delayedMilestones}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
