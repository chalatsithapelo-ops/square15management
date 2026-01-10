import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { DollarSign, TrendingUp, Briefcase } from 'lucide-react';

interface PipelineTrendDataPoint {
  month: string;
  pipelineValue: number;
  activeLeads: number;
  date: Date;
}

interface SalesPipelineTrendChartProps {
  data: PipelineTrendDataPoint[];
  isLoading?: boolean;
}

export function SalesPipelineTrendChart({ data, isLoading }: SalesPipelineTrendChartProps) {
  if (isLoading) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center mb-4">
          <Briefcase className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Sales Pipeline Value Trends</h2>
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
          <Briefcase className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Sales Pipeline Value Trends</h2>
        </div>
        <div className="h-80 flex items-center justify-center">
          <div className="text-center">
            <Briefcase className="mx-auto h-12 w-12 text-gray-400 mb-2" />
            <p className="text-sm text-gray-600">No pipeline data available</p>
            <p className="text-xs text-gray-500 mt-1">Add estimated values to leads to track pipeline</p>
          </div>
        </div>
      </div>
    );
  }

  // Sort data by date
  const sortedData = [...data].sort((a, b) => a.date.getTime() - b.date.getTime());

  const formatCurrency = (value: number) => `R${value.toLocaleString()}`;

  const formatMonthLabel = (month: string) => {
    const [year, monthNum] = month.split('-');
    return new Date(parseInt(year), parseInt(monthNum) - 1).toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short' 
    });
  };

  const currentPipeline = sortedData[sortedData.length - 1].pipelineValue;
  const avgPipeline = sortedData.reduce((sum, d) => sum + d.pipelineValue, 0) / sortedData.length;
  const totalActiveLeads = sortedData[sortedData.length - 1].activeLeads;

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center">
          <Briefcase className="h-5 w-5 text-purple-600 mr-2" />
          <h2 className="text-lg font-semibold text-gray-900">Sales Pipeline Value Trends</h2>
        </div>
        <div className="text-right">
          <div className="text-xs text-gray-500">Current Pipeline</div>
          <div className="text-lg font-bold text-purple-600">
            {formatCurrency(currentPipeline)}
          </div>
        </div>
      </div>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={sortedData} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
            <defs>
              <linearGradient id="pipelineGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a855f7" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a855f7" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis 
              dataKey="month" 
              stroke="#6b7280"
              style={{ fontSize: '12px' }}
              tickFormatter={formatMonthLabel}
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
                if (name === 'Pipeline Value') return [formatCurrency(value), name];
                return [value, name];
              }}
              labelFormatter={formatMonthLabel}
              labelStyle={{ color: '#111827', fontWeight: 600, marginBottom: '8px' }}
            />
            <Legend 
              wrapperStyle={{ fontSize: '14px', paddingTop: '10px' }}
              iconType="circle"
            />
            <Area 
              type="monotone" 
              dataKey="pipelineValue" 
              stroke="#a855f7" 
              strokeWidth={3}
              fill="url(#pipelineGradient)"
              dot={{ fill: '#a855f7', r: 4, strokeWidth: 2, stroke: '#fff' }}
              activeDot={{ r: 6, strokeWidth: 2 }}
              name="Pipeline Value"
              animationDuration={1000}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-purple-50 rounded-lg p-3">
            <div className="flex items-center text-purple-600 mb-1">
              <DollarSign className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Avg Pipeline</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{formatCurrency(avgPipeline)}</p>
          </div>
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center text-blue-600 mb-1">
              <Briefcase className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Active Leads</span>
            </div>
            <p className="text-lg font-bold text-gray-900">{totalActiveLeads}</p>
          </div>
          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center text-green-600 mb-1">
              <TrendingUp className="h-4 w-4 mr-1" />
              <span className="text-xs font-medium">Avg per Lead</span>
            </div>
            <p className="text-lg font-bold text-gray-900">
              {formatCurrency(totalActiveLeads > 0 ? currentPipeline / totalActiveLeads : 0)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
