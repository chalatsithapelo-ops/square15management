import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { MetricCard } from "~/components/MetricCard";
import { PayrollTrendChart } from "~/components/charts/PayrollTrendChart";
import { DepartmentExpenseChart } from "~/components/charts/DepartmentExpenseChart";
import { 
  Users, 
  DollarSign, 
  TrendingUp, 
  Calendar,
  FileText,
  Briefcase,
  Clock,
  CalendarCheck,
} from "lucide-react";

export function HRMetricsDashboard() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  
  // Default to current year
  const currentYear = new Date().getFullYear();
  const [startDate, setStartDate] = useState(`${currentYear}-01-01`);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const metricsQuery = useQuery(
    trpc.getHRFinancialMetrics.queryOptions({
      token: token!,
      startDate,
      endDate,
    })
  );

  const metrics = metricsQuery.data;
  const isLoading = metricsQuery.isLoading;

  // Calculate some derived metrics
  const totalDepartments = metrics?.departmentExpenses.length || 0;
  const highestExpenseDept = metrics?.departmentExpenses[0];

  // Format department name for display
  const formatDepartmentName = (dept: string) => {
    return dept
      .split('_')
      .map(word => word.charAt(0) + word.slice(1).toLowerCase())
      .join(' ');
  };

  return (
    <div className="space-y-6">
      {/* Date Range Filter */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              End Date
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
        </div>
      </div>

      {/* Key Metrics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard
          name="Total Employees"
          value={isLoading ? "..." : metrics?.keyMetrics.totalEmployees || 0}
          icon={Users}
          color="purple"
          gradient
        />
        <MetricCard
          name="Total Payroll Paid"
          value={isLoading ? "..." : `R${metrics?.keyMetrics.totalPayrollPaid.toLocaleString() || 0}`}
          icon={DollarSign}
          color="green"
          gradient
        />
        <MetricCard
          name="Total Expenses"
          value={isLoading ? "..." : `R${metrics?.keyMetrics.totalExpenses.toLocaleString() || 0}`}
          icon={TrendingUp}
          color="orange"
          gradient
        />
        <MetricCard
          name="Departments"
          value={isLoading ? "..." : totalDepartments}
          icon={Briefcase}
          color="blue"
          gradient
        />
      </div>

      {/* Additional Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <MetricCard
          name="Avg Monthly Salary"
          value={isLoading ? "..." : `R${Math.round(metrics?.keyMetrics.averageMonthlySalary || 0).toLocaleString()}`}
          icon={CalendarCheck}
          color="indigo"
          subtitle={`${metrics?.keyMetrics.employeesWithMonthlySalary || 0} employees`}
        />
        <MetricCard
          name="Avg Hourly Rate"
          value={isLoading ? "..." : `R${Math.round(metrics?.keyMetrics.averageHourlyRate || 0).toLocaleString()}`}
          icon={Clock}
          color="teal"
          subtitle={`${metrics?.keyMetrics.employeesWithHourlyRate || 0} employees`}
        />
        <MetricCard
          name="Avg Daily Rate"
          value={isLoading ? "..." : `R${Math.round(metrics?.keyMetrics.averageDailyRate || 0).toLocaleString()}`}
          icon={Calendar}
          color="amber"
          subtitle={`${metrics?.keyMetrics.employeesWithDailyRate || 0} employees`}
        />
      </div>

      {/* Payment Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <MetricCard
          name="Total Payslips Issued"
          value={isLoading ? "..." : metrics?.keyMetrics.totalPayslips || 0}
          icon={FileText}
          color="pink"
        />
        <MetricCard
          name="Payment Requests Paid"
          value={isLoading ? "..." : metrics?.keyMetrics.totalPaymentRequests || 0}
          icon={FileText}
          color="purple"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <PayrollTrendChart
          data={metrics?.payrollTrends || []}
          isLoading={isLoading}
        />
        <DepartmentExpenseChart
          data={metrics?.departmentExpenses || []}
          isLoading={isLoading}
        />
      </div>

      {/* Department Breakdown Table */}
      {!isLoading && metrics && metrics.departmentExpenses.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-900">Department Expense Breakdown</h2>
            <p className="text-sm text-gray-600 mt-1">Detailed view of expenses by department and category</p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Department
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payslips
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Payment Requests
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Labour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Order Materials
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Milestone Labour
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Milestone Materials
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {metrics.departmentExpenses.map((dept) => (
                  <tr key={dept.department} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {formatDepartmentName(dept.department)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.payslips.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.paymentRequests.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.orderLabour.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.orderMaterials.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.milestoneLabour.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-right">
                      R{dept.milestoneMaterials.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 text-right">
                      R{dept.total.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900">
                    TOTAL
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.payslips, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.paymentRequests, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.orderLabour, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.orderMaterials, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.milestoneLabour, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.departmentExpenses.reduce((sum, d) => sum + d.milestoneMaterials, 0).toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-gray-900 text-right">
                    R{metrics.keyMetrics.totalExpenses.toLocaleString()}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* Employee Distribution by Role */}
      {!isLoading && metrics && metrics.keyMetrics.employeesByRole.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Employee Distribution by Role</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {metrics.keyMetrics.employeesByRole.map((roleData) => (
              <div
                key={roleData.role}
                className="bg-gray-50 rounded-lg p-4 text-center"
              >
                <div className="text-2xl font-bold text-gray-900 mb-1">
                  {roleData.count}
                </div>
                <div className="text-xs font-medium text-gray-600">
                  {formatDepartmentName(roleData.role)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
