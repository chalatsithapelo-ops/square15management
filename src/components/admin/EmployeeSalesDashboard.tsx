import { useState } from "react";
import { Users, TrendingUp, Target, Clock, Award, DollarSign, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";
import { MetricCard } from "~/components/MetricCard";
import { EmployeeSalesComparisonChart } from "~/components/charts/EmployeeSalesComparisonChart";
import { EmployeeResponseTimeChart } from "~/components/charts/EmployeeResponseTimeChart";

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

interface EmployeeSalesDashboardProps {
  data: EmployeePerformanceData[];
  isLoading?: boolean;
}

type SortField = "name" | "totalLeads" | "conversionRate" | "responseTime" | "winRate" | "dealValue";
type SortDirection = "asc" | "desc";

export function EmployeeSalesDashboard({ data, isLoading }: EmployeeSalesDashboardProps) {
  const [sortField, setSortField] = useState<SortField>("totalLeads");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
              <div className="h-8 bg-gray-200 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <Users className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-semibold text-gray-900 mb-2">No Sales Data Available</h3>
        <p className="text-sm text-gray-600">
          Employee sales performance will appear here once leads are created and managed.
        </p>
      </div>
    );
  }

  // Calculate team-wide metrics
  const totalLeads = data.reduce((sum, emp) => sum + emp.metrics.totalLeads, 0);
  const totalWonLeads = data.reduce((sum, emp) => sum + emp.metrics.wonLeads, 0);
  const totalWonValue = data.reduce((sum, emp) => sum + emp.metrics.totalWonValue, 0);
  const totalPipelineValue = data.reduce((sum, emp) => sum + emp.metrics.pipelineValue, 0);
  
  const avgConversionRate = totalLeads > 0 ? (totalWonLeads / totalLeads) * 100 : 0;
  const avgDealValue = totalWonLeads > 0 ? totalWonValue / totalWonLeads : 0;
  
  // Calculate average response time (only for employees with response time data)
  const employeesWithResponseTime = data.filter(emp => emp.metrics.avgResponseTimeHours > 0);
  const avgResponseTime = employeesWithResponseTime.length > 0
    ? employeesWithResponseTime.reduce((sum, emp) => sum + emp.metrics.avgResponseTimeHours, 0) / employeesWithResponseTime.length
    : 0;

  // Sort data
  const sortedData = [...data].sort((a, b) => {
    let aValue: number | string = 0;
    let bValue: number | string = 0;

    switch (sortField) {
      case "name":
        aValue = `${a.employee.firstName} ${a.employee.lastName}`;
        bValue = `${b.employee.firstName} ${b.employee.lastName}`;
        break;
      case "totalLeads":
        aValue = a.metrics.totalLeads;
        bValue = b.metrics.totalLeads;
        break;
      case "conversionRate":
        aValue = a.metrics.conversionRate;
        bValue = b.metrics.conversionRate;
        break;
      case "responseTime":
        aValue = a.metrics.avgResponseTimeHours;
        bValue = b.metrics.avgResponseTimeHours;
        break;
      case "winRate":
        aValue = a.metrics.winRate;
        bValue = b.metrics.winRate;
        break;
      case "dealValue":
        aValue = a.metrics.avgDealValue;
        bValue = b.metrics.avgDealValue;
        break;
    }

    if (typeof aValue === "string" && typeof bValue === "string") {
      return sortDirection === "asc" 
        ? aValue.localeCompare(bValue)
        : bValue.localeCompare(aValue);
    }

    return sortDirection === "asc" 
      ? (aValue as number) - (bValue as number)
      : (bValue as number) - (aValue as number);
  });

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) {
      return <ArrowUpDown className="h-4 w-4 text-gray-400" />;
    }
    return sortDirection === "asc" 
      ? <ChevronUp className="h-4 w-4 text-blue-600" />
      : <ChevronDown className="h-4 w-4 text-blue-600" />;
  };

  const formatTime = (hours: number) => {
    if (hours === 0) return "N/A";
    if (hours < 24) {
      return `${hours.toFixed(1)}h`;
    } else {
      const days = Math.floor(hours / 24);
      return `${days}d ${(hours % 24).toFixed(0)}h`;
    }
  };

  return (
    <div className="space-y-6">
      {/* Team Overview Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          name="Total Team Leads"
          value={totalLeads}
          icon={Users}
          color="blue"
          subtitle={`${data.length} employees`}
        />
        <MetricCard
          name="Avg Conversion Rate"
          value={`${avgConversionRate.toFixed(1)}%`}
          icon={Target}
          color="green"
          subtitle={`${totalWonLeads} won`}
        />
        <MetricCard
          name="Avg Response Time"
          value={formatTime(avgResponseTime)}
          icon={Clock}
          color="orange"
          subtitle={employeesWithResponseTime.length > 0 ? `${employeesWithResponseTime.length} employees` : "No data"}
        />
        <MetricCard
          name="Avg Deal Value"
          value={`R${Math.round(avgDealValue).toLocaleString()}`}
          icon={Award}
          color="purple"
          subtitle={`R${Math.round(totalWonValue).toLocaleString()} total`}
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-2">
          <EmployeeSalesComparisonChart data={data} isLoading={false} />
        </div>
        <div className="lg:col-span-2">
          <EmployeeResponseTimeChart data={data} isLoading={false} />
        </div>
      </div>

      {/* Detailed Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detailed Performance Breakdown</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Employee</span>
                    <SortIcon field="name" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("totalLeads")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Lead Volume</span>
                    <SortIcon field="totalLeads" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("conversionRate")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Conversion Rate</span>
                    <SortIcon field="conversionRate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("responseTime")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Avg Response</span>
                    <SortIcon field="responseTime" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("winRate")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Win Rate</span>
                    <SortIcon field="winRate" />
                  </div>
                </th>
                <th 
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                  onClick={() => handleSort("dealValue")}
                >
                  <div className="flex items-center space-x-1">
                    <span>Avg Deal Value</span>
                    <SortIcon field="dealValue" />
                  </div>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Pipeline Value
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sortedData.map((employee) => (
                <tr key={employee.employee.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 h-10 w-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-semibold">
                        {employee.employee.firstName[0]}{employee.employee.lastName[0]}
                      </div>
                      <div className="ml-4">
                        <div className="text-sm font-medium text-gray-900">
                          {employee.employee.firstName} {employee.employee.lastName}
                        </div>
                        <div className="text-xs text-gray-500">{employee.employee.role}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{employee.metrics.totalLeads}</div>
                    <div className="text-xs text-gray-500">
                      {employee.metrics.wonLeads}W / {employee.metrics.lostLeads}L / {employee.metrics.activeLeads}A
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        {employee.metrics.conversionRate.toFixed(1)}%
                      </div>
                      {employee.metrics.conversionRate >= avgConversionRate && (
                        <TrendingUp className="ml-2 h-4 w-4 text-green-600" />
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      employee.metrics.avgResponseTimeHours === 0 ? 'bg-gray-100 text-gray-800' :
                      employee.metrics.avgResponseTimeHours <= 24 ? 'bg-green-100 text-green-800' :
                      employee.metrics.avgResponseTimeHours <= 72 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {formatTime(employee.metrics.avgResponseTimeHours)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {employee.metrics.winRate.toFixed(1)}%
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      R{employee.metrics.avgDealValue.toLocaleString()}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      R{employee.metrics.pipelineValue.toLocaleString()}
                    </div>
                    <div className="text-xs text-gray-500">
                      {employee.metrics.activeLeads} active
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
