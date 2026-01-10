import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  DollarSign,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  TrendingUp,
  Users,
} from "lucide-react";

export function RemunerationsTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
    })
  );

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const paymentRequests = paymentRequestsQuery.data || [];
  const employees = employeesQuery.data || [];

  // Calculate statistics
  const pendingRequests = paymentRequests.filter((pr) => pr.status === "PENDING");
  const approvedRequests = paymentRequests.filter((pr) => pr.status === "APPROVED");
  const paidRequests = paymentRequests.filter((pr) => pr.status === "PAID");
  
  const totalPending = pendingRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0);
  const totalApproved = approvedRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0);
  const totalPaid = paidRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0);
  
  const totalPayable = totalPending + totalApproved;

  // Calculate average rates
  const employeesWithRates = employees.filter((e) => e.hourlyRate || e.dailyRate);
  const avgHourlyRate = employeesWithRates.filter((e) => e.hourlyRate).length > 0
    ? employeesWithRates.filter((e) => e.hourlyRate).reduce((sum, e) => sum + (e.hourlyRate || 0), 0) / employeesWithRates.filter((e) => e.hourlyRate).length
    : 0;
  const avgDailyRate = employeesWithRates.filter((e) => e.dailyRate).length > 0
    ? employeesWithRates.filter((e) => e.dailyRate).reduce((sum, e) => sum + (e.dailyRate || 0), 0) / employeesWithRates.filter((e) => e.dailyRate).length
    : 0;

  // Recent payment requests
  const recentRequests = [...paymentRequests]
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 5);

  // Top earners (based on paid requests)
  const earningsByArtisan = paymentRequests
    .filter((pr) => pr.status === "PAID")
    .reduce((acc, pr) => {
      const key = `${pr.artisan.firstName} ${pr.artisan.lastName}`;
      acc[key] = (acc[key] || 0) + pr.calculatedAmount;
      return acc;
    }, {} as Record<string, number>);

  const topEarners = Object.entries(earningsByArtisan)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5);

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <Clock className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Pending</span>
          </div>
          <div className="text-3xl font-bold mb-1">R{totalPending.toLocaleString()}</div>
          <div className="text-sm opacity-90">{pendingRequests.length} requests</div>
        </div>

        <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <CheckCircle className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Approved</span>
          </div>
          <div className="text-3xl font-bold mb-1">R{totalApproved.toLocaleString()}</div>
          <div className="text-sm opacity-90">{approvedRequests.length} requests</div>
        </div>

        <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <DollarSign className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Paid</span>
          </div>
          <div className="text-3xl font-bold mb-1">R{totalPaid.toLocaleString()}</div>
          <div className="text-sm opacity-90">{paidRequests.length} requests</div>
        </div>

        <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl shadow-lg p-6 text-white">
          <div className="flex items-center justify-between mb-2">
            <AlertCircle className="h-8 w-8 opacity-80" />
            <span className="text-sm font-medium opacity-90">Total Payable</span>
          </div>
          <div className="text-3xl font-bold mb-1">R{totalPayable.toLocaleString()}</div>
          <div className="text-sm opacity-90">Pending + Approved</div>
        </div>
      </div>

      {/* Quick Access */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-gray-900">Payment Requests Management</h2>
          <Link
            to="/admin/payment-requests"
            className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            View All Requests
            <ArrowRight className="h-4 w-4 ml-2" />
          </Link>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          The full payment requests system allows you to create, review, approve, and process artisan payment requests. 
          This includes hourly and daily rate calculations, notes, and status tracking.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Average Rates</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Hourly Rate:</span>
                <span className="font-semibold text-gray-900">R{avgHourlyRate.toFixed(2)}/hr</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Daily Rate:</span>
                <span className="font-semibold text-gray-900">R{avgDailyRate.toFixed(2)}/day</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Employees with Rates:</span>
                <span className="font-semibold text-gray-900">{employeesWithRates.length}</span>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-sm font-semibold text-gray-900 mb-2">Quick Stats</h3>
            <div className="space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-between">
                <span>Total Requests:</span>
                <span className="font-semibold text-gray-900">{paymentRequests.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Unique Artisans:</span>
                <span className="font-semibold text-gray-900">{Object.keys(earningsByArtisan).length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Avg Request Amount:</span>
                <span className="font-semibold text-gray-900">
                  R{paymentRequests.length > 0 ? (paymentRequests.reduce((sum, pr) => sum + pr.calculatedAmount, 0) / paymentRequests.length).toFixed(0) : 0}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Payment Requests */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Payment Requests</h2>
        </div>
        <div className="divide-y divide-gray-200">
          {recentRequests.map((request) => (
            <div key={request.id} className="p-4 hover:bg-gray-50 transition-colors">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3 mb-1">
                    <span className="text-sm font-semibold text-gray-900">
                      {request.artisan.firstName} {request.artisan.lastName}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        request.status === "PAID"
                          ? "bg-green-100 text-green-800"
                          : request.status === "APPROVED"
                          ? "bg-blue-100 text-blue-800"
                          : request.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {request.status}
                    </span>
                  </div>
                  <div className="text-xs text-gray-500">
                    {request.hoursWorked && `${request.hoursWorked}h worked`}
                    {request.daysWorked && `${request.daysWorked} days worked`}
                    {" • "}
                    {new Date(request.createdAt).toLocaleDateString()}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-900">
                    R{request.calculatedAmount.toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
          {recentRequests.length === 0 && (
            <div className="p-8 text-center">
              <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No payment requests yet</p>
            </div>
          )}
        </div>
      </div>

      {/* Top Earners */}
      {topEarners.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-center space-x-2 mb-4">
            <TrendingUp className="h-5 w-5 text-purple-600" />
            <h2 className="text-lg font-semibold text-gray-900">Top Earners (All Time)</h2>
          </div>
          <div className="space-y-3">
            {topEarners.map(([name, amount], index) => (
              <div key={name} className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    index === 0 ? "bg-yellow-100 text-yellow-800" :
                    index === 1 ? "bg-gray-100 text-gray-800" :
                    index === 2 ? "bg-orange-100 text-orange-800" :
                    "bg-blue-100 text-blue-800"
                  } font-bold text-sm`}>
                    {index + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900">{name}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-gray-900">R{amount.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional HR Features Note */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-6">
        <div className="flex items-start space-x-3">
          <Users className="h-6 w-6 text-blue-600 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-blue-900 mb-1">
              Complete HR Management
            </h3>
            <p className="text-sm text-blue-800">
              This HR tool provides comprehensive employee management including:
            </p>
            <ul className="mt-2 text-sm text-blue-800 list-disc list-inside space-y-1">
              <li><strong>Employee Management:</strong> Update roles, rates, and contact information</li>
              <li><strong>KPI Tracking:</strong> Set and monitor performance targets for all employees</li>
              <li><strong>Leave Management:</strong> Handle leave requests with approval workflows</li>
              <li><strong>Document Management:</strong> Store contracts, certificates, and employee files</li>
              <li><strong>Remunerations:</strong> Process and track all employee payments</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
