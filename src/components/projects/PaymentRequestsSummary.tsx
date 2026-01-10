import { useMemo } from "react";
import { Link } from "@tanstack/react-router";
import { CreditCard, Clock, CheckCircle, User, DollarSign } from "lucide-react";

interface PaymentRequest {
  id: number;
  requestNumber: string;
  status: string;
  calculatedAmount: number;
  createdAt: string;
  artisan: {
    id: number;
    firstName: string;
    lastName: string;
  };
  milestoneId: number | null;
}

interface Project {
  id: number;
  name: string;
  projectNumber: string;
  milestones?: Array<{
    id: number;
    name: string;
  }>;
}

interface PaymentRequestsSummaryProps {
  paymentRequests: PaymentRequest[];
  projects: Project[];
}

export function PaymentRequestsSummary({ paymentRequests, projects }: PaymentRequestsSummaryProps) {
  const paymentStats = useMemo(() => {
    const pending = paymentRequests.filter((pr) => pr.status === "PENDING");
    const approved = paymentRequests.filter((pr) => pr.status === "APPROVED");
    const paid = paymentRequests.filter((pr) => pr.status === "PAID");

    const pendingAmount = pending.reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);
    const approvedAmount = approved.reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);
    const paidAmount = paid.reduce((sum, pr) => sum + (pr.calculatedAmount || 0), 0);

    // Get recent pending/approved requests
    const recentRequests = [...pending, ...approved]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5);

    return {
      pending,
      approved,
      paid,
      pendingAmount,
      approvedAmount,
      paidAmount,
      totalOutstanding: pendingAmount + approvedAmount,
      recentRequests,
    };
  }, [paymentRequests]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case "PENDING": return "bg-yellow-100 text-yellow-800";
      case "APPROVED": return "bg-blue-100 text-blue-800";
      case "PAID": return "bg-green-100 text-green-800";
      case "REJECTED": return "bg-red-100 text-red-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getMilestoneInfo = (milestoneId: number | null) => {
    if (!milestoneId) return null;
    
    for (const project of projects) {
      const milestone = project.milestones?.find((m) => m.id === milestoneId);
      if (milestone) {
        return {
          milestoneName: milestone.name,
          projectName: project.name,
          projectNumber: project.projectNumber,
        };
      }
    }
    return null;
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
      <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-pink-50 to-rose-50">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="bg-pink-600 p-2 rounded-lg">
              <CreditCard className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900">Payment Requests</h3>
              <p className="text-sm text-gray-600">
                R{paymentStats.totalOutstanding.toLocaleString()} outstanding
              </p>
            </div>
          </div>
          <Link
            to="/admin/payment-requests"
            className="text-sm font-medium text-pink-600 hover:text-pink-700"
          >
            View All →
          </Link>
        </div>
      </div>

      <div className="p-6">
        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <Clock className="h-4 w-4 text-yellow-600" />
              <span className="text-xs font-medium text-yellow-700">Pending</span>
            </div>
            <div className="text-xl font-bold text-yellow-900">{paymentStats.pending.length}</div>
            <div className="text-xs text-yellow-700 mt-1">
              R{paymentStats.pendingAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <CheckCircle className="h-4 w-4 text-blue-600" />
              <span className="text-xs font-medium text-blue-700">Approved</span>
            </div>
            <div className="text-xl font-bold text-blue-900">{paymentStats.approved.length}</div>
            <div className="text-xs text-blue-700 mt-1">
              R{paymentStats.approvedAmount.toLocaleString()}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center space-x-2 mb-1">
              <DollarSign className="h-4 w-4 text-green-600" />
              <span className="text-xs font-medium text-green-700">Paid</span>
            </div>
            <div className="text-xl font-bold text-green-900">{paymentStats.paid.length}</div>
            <div className="text-xs text-green-700 mt-1">
              R{paymentStats.paidAmount.toLocaleString()}
            </div>
          </div>
        </div>

        {/* Recent Requests */}
        {paymentStats.recentRequests.length > 0 ? (
          <div>
            <h4 className="text-sm font-semibold text-gray-900 mb-3">Recent Requests</h4>
            <div className="space-y-2">
              {paymentStats.recentRequests.map((request) => {
                const milestoneInfo = getMilestoneInfo(request.milestoneId);

                return (
                  <div
                    key={request.id}
                    className="bg-gray-50 rounded-lg p-3 hover:bg-gray-100 transition-colors"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="text-sm font-medium text-gray-900">
                            {request.requestNumber}
                          </span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(request.status)}`}>
                            {request.status}
                          </span>
                        </div>
                        <div className="flex items-center space-x-1 text-xs text-gray-600">
                          <User className="h-3 w-3" />
                          <span>
                            {request.artisan.firstName} {request.artisan.lastName}
                          </span>
                        </div>
                        {milestoneInfo && (
                          <div className="text-xs text-gray-500 mt-1">
                            {milestoneInfo.milestoneName} • {milestoneInfo.projectNumber}
                          </div>
                        )}
                      </div>
                      <div className="text-right ml-3">
                        <div className="text-sm font-bold text-gray-900">
                          R{(request.calculatedAmount || 0).toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-500">
                          {new Date(request.createdAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="text-center py-8">
            <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No payment requests</p>
          </div>
        )}
      </div>
    </div>
  );
}
