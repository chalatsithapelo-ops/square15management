import { Clock, CheckCircle2, DollarSign, Calendar } from "lucide-react";

interface PaymentRequest {
  id: number;
  requestNumber: string;
  calculatedAmount: number;
  status: string;
  approvedDate: Date | null;
  createdAt: Date;
  hoursWorked: number | null;
  daysWorked: number | null;
  orderIds: number[];
}

interface PendingPaymentsSectionProps {
  paymentRequests: PaymentRequest[];
}

export function PendingPaymentsSection({ paymentRequests }: PendingPaymentsSectionProps) {
  const pendingRequests = paymentRequests.filter(
    (pr) => pr.status === "PENDING" || pr.status === "APPROVED"
  );

  if (pendingRequests.length === 0) {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
        <DollarSign className="mx-auto h-12 w-12 text-gray-400 mb-4" />
        <h3 className="text-lg font-medium text-gray-900 mb-2">No pending payments</h3>
        <p className="text-sm text-gray-600">All your payments are up to date</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {pendingRequests.map((request) => (
        <div
          key={request.id}
          className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between mb-4">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                {request.requestNumber}
              </h3>
              <div className="flex items-center mt-2 text-sm text-gray-600">
                <Calendar className="h-4 w-4 mr-2" />
                {request.status === "APPROVED" && request.approvedDate
                  ? `Approved on ${new Date(request.approvedDate).toLocaleDateString()}`
                  : `Requested on ${new Date(request.createdAt).toLocaleDateString()}`}
              </div>
            </div>
            {request.status === "APPROVED" ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                <CheckCircle2 className="h-4 w-4 mr-1" />
                Approved
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                <Clock className="h-4 w-4 mr-1" />
                Pending
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <p className="text-sm text-gray-500 mb-1">Amount</p>
              <p className="text-xl font-bold text-gray-900">
                R{(request.calculatedAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500 mb-1">Work Done</p>
              <p className="text-lg font-semibold text-gray-900">
                {request.hoursWorked
                  ? `${request.hoursWorked} hours`
                  : request.daysWorked
                  ? `${request.daysWorked} days`
                  : "N/A"}
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Jobs included:</span> {request.orderIds.length} order(s)
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
