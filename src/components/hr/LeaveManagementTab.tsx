import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  Plus,
  Calendar,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  X,
  User,
} from "lucide-react";
import { Dialog } from "@headlessui/react";

const leaveRequestSchema = z.object({
  employeeId: z.number().optional(),
  leaveType: z.enum([
    "ANNUAL",
    "SICK",
    "UNPAID",
    "MATERNITY",
    "PATERNITY",
    "STUDY",
    "FAMILY_RESPONSIBILITY",
    "OTHER",
  ]),
  startDate: z.string(),
  endDate: z.string(),
  totalDays: z.number().min(0.5, "Minimum 0.5 days"),
  reason: z.string().min(1, "Reason is required"),
  notes: z.string().optional(),
});

type LeaveRequestForm = z.infer<typeof leaveRequestSchema>;

const leaveTypeLabels: Record<string, string> = {
  ANNUAL: "Annual Leave",
  SICK: "Sick Leave",
  UNPAID: "Unpaid Leave",
  MATERNITY: "Maternity Leave",
  PATERNITY: "Paternity Leave",
  STUDY: "Study Leave",
  FAMILY_RESPONSIBILITY: "Family Responsibility",
  OTHER: "Other",
};

const leaveTypeColors: Record<string, string> = {
  ANNUAL: "bg-blue-100 text-blue-800",
  SICK: "bg-red-100 text-red-800",
  UNPAID: "bg-gray-100 text-gray-800",
  MATERNITY: "bg-pink-100 text-pink-800",
  PATERNITY: "bg-purple-100 text-purple-800",
  STUDY: "bg-green-100 text-green-800",
  FAMILY_RESPONSIBILITY: "bg-yellow-100 text-yellow-800",
  OTHER: "bg-orange-100 text-orange-800",
};

const statusConfig = {
  PENDING: { label: "Pending", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  APPROVED: { label: "Approved", color: "bg-green-100 text-green-800", icon: CheckCircle },
  REJECTED: { label: "Rejected", color: "bg-red-100 text-red-800", icon: XCircle },
  CANCELLED: { label: "Cancelled", color: "bg-gray-100 text-gray-800", icon: AlertCircle },
};

export function LeaveManagementTab() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<number | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [approvingRequest, setApprovingRequest] = useState<any>(null);

  const employeesQuery = useQuery(
    trpc.getEmployees.queryOptions({
      token: token!,
    })
  );

  const leaveRequestsQuery = useQuery(
    trpc.getLeaveRequests.queryOptions({
      token: token!,
      employeeId: selectedEmployee || undefined,
      status: statusFilter as any,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<LeaveRequestForm>({
    resolver: zodResolver(leaveRequestSchema),
    defaultValues: {
      leaveType: "ANNUAL",
    },
  });

  const createLeaveRequestMutation = useMutation(
    trpc.createLeaveRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Leave request created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getLeaveRequests.queryKey() });
        setShowCreateForm(false);
        reset();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create leave request");
      },
    })
  );

  const updateLeaveStatusMutation = useMutation(
    trpc.updateLeaveRequestStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Leave request status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getLeaveRequests.queryKey() });
        setApprovingRequest(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update leave request");
      },
    })
  );

  const employees = employeesQuery.data || [];
  const leaveRequests = leaveRequestsQuery.data || [];

  const onSubmit = (data: LeaveRequestForm) => {
    createLeaveRequestMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const handleApprove = (requestId: number) => {
    updateLeaveStatusMutation.mutate({
      token: token!,
      leaveRequestId: requestId,
      status: "APPROVED",
    });
  };

  const handleReject = (requestId: number, reason: string) => {
    updateLeaveStatusMutation.mutate({
      token: token!,
      leaveRequestId: requestId,
      status: "REJECTED",
      rejectionReason: reason,
    });
  };

  const statusStats = Object.entries(statusConfig).map(([status, config]) => ({
    status,
    ...config,
    count: leaveRequests.filter((lr) => lr.status === status).length,
  }));

  const totalDaysRequested = leaveRequests
    .filter((lr) => lr.status === "PENDING" || lr.status === "APPROVED")
    .reduce((sum, lr) => sum + lr.totalDays, 0);

  // Calculate start and end dates for watch
  const startDate = watch("startDate");
  const endDate = watch("endDate");

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {statusStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.status}
              onClick={() => setStatusFilter(statusFilter === stat.status ? null : stat.status)}
              className={`p-4 rounded-xl border-2 transition-all ${
                statusFilter === stat.status
                  ? "border-purple-600 bg-purple-50"
                  : "border-gray-200 bg-white hover:border-purple-300"
              }`}
            >
              <div className="text-center">
                <Icon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.count}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${stat.color}`}>
                  {stat.label}
                </div>
              </div>
            </button>
          );
        })}
      </div>

      {/* Header Actions */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <select
            value={selectedEmployee || ""}
            onChange={(e) => setSelectedEmployee(e.target.value ? Number(e.target.value) : null)}
            className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="">All Employees</option>
            {employees.map((emp) => (
              <option key={emp.id} value={emp.id}>
                {emp.firstName} {emp.lastName}
              </option>
            ))}
          </select>

          <div className="bg-white rounded-lg border border-gray-200 px-4 py-2">
            <span className="text-sm text-gray-600">Total Days: </span>
            <span className="text-sm font-bold text-gray-900">{totalDaysRequested.toFixed(1)}</span>
          </div>
        </div>

        <button
          onClick={() => setShowCreateForm(true)}
          className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
        >
          <Plus className="h-5 w-5 mr-2" />
          Request Leave
        </button>
      </div>

      {/* Leave Requests List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="divide-y divide-gray-200">
          {leaveRequests.map((request) => {
            const StatusIcon = statusConfig[request.status].icon;
            return (
              <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {request.employee.firstName} {request.employee.lastName}
                      </h3>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${leaveTypeColors[request.leaveType]}`}>
                        {leaveTypeLabels[request.leaveType]}
                      </span>
                      <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center ${statusConfig[request.status].color}`}>
                        <StatusIcon className="h-3 w-3 mr-1" />
                        {statusConfig[request.status].label}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-600 mb-2">
                      <div className="flex items-center">
                        <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                        {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      </div>
                      <div className="flex items-center">
                        <Clock className="h-4 w-4 mr-2 text-gray-400" />
                        {request.totalDays} day{request.totalDays !== 1 ? "s" : ""}
                      </div>
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {request.employee.role}
                      </div>
                    </div>

                    <p className="text-sm text-gray-700 mb-2">
                      <span className="font-medium">Reason:</span> {request.reason}
                    </p>

                    {request.notes && (
                      <p className="text-sm text-gray-600 mb-2">
                        <span className="font-medium">Notes:</span> {request.notes}
                      </p>
                    )}

                    {request.rejectionReason && (
                      <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-2">
                        <p className="text-sm text-red-800">
                          <span className="font-medium">Rejection Reason:</span> {request.rejectionReason}
                        </p>
                      </div>
                    )}

                    <div className="text-xs text-gray-500">
                      Requested {new Date(request.createdAt).toLocaleDateString()}
                      {request.approvedAt && ` • Approved ${new Date(request.approvedAt).toLocaleDateString()}`}
                      {request.approvedBy && ` by ${request.approvedBy.firstName} ${request.approvedBy.lastName}`}
                    </div>
                  </div>

                  {request.status === "PENDING" && (
                    <div className="ml-4 flex space-x-2">
                      <button
                        onClick={() => handleApprove(request.id)}
                        disabled={updateLeaveStatusMutation.isPending}
                        className="px-3 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => setApprovingRequest(request)}
                        disabled={updateLeaveStatusMutation.isPending}
                        className="px-3 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {leaveRequests.length === 0 && (
            <div className="p-12 text-center">
              <Calendar className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-2 text-sm text-gray-600">No leave requests found</p>
            </div>
          )}
        </div>
      </div>

      {/* Create Leave Request Modal */}
      <Dialog
        open={showCreateForm}
        onClose={() => setShowCreateForm(false)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-2xl w-full bg-white rounded-xl shadow-xl flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Request Leave
              </Dialog.Title>
              <button
                onClick={() => setShowCreateForm(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0">
              <div className="p-6 space-y-4 overflow-y-auto flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Employee (Optional - defaults to you)
                    </label>
                    <select
                      {...register("employeeId", { valueAsNumber: true })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      <option value="">Myself</option>
                      {employees.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.firstName} {emp.lastName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Leave Type *
                    </label>
                    <select
                      {...register("leaveType")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    >
                      {Object.entries(leaveTypeLabels).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Start Date *
                    </label>
                    <input
                      type="date"
                      {...register("startDate")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.startDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.startDate.message}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      End Date *
                    </label>
                    <input
                      type="date"
                      {...register("endDate")}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.endDate && (
                      <p className="mt-1 text-sm text-red-600">{errors.endDate.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Total Days *
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      {...register("totalDays", { valueAsNumber: true })}
                      placeholder="e.g., 1, 1.5, 2"
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.totalDays && (
                      <p className="mt-1 text-sm text-red-600">{errors.totalDays.message}</p>
                    )}
                    <p className="mt-1 text-xs text-gray-500">
                      Use 0.5 for half-day leave
                    </p>
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Reason *
                    </label>
                    <textarea
                      {...register("reason")}
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                    {errors.reason && (
                      <p className="mt-1 text-sm text-red-600">{errors.reason.message}</p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Additional Notes
                    </label>
                    <textarea
                      {...register("notes")}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                    />
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLeaveRequestMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createLeaveRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                </button>
              </div>
            </form>
          </Dialog.Panel>
        </div>
      </Dialog>

      {/* Reject Leave Request Modal */}
      <Dialog
        open={approvingRequest !== null}
        onClose={() => setApprovingRequest(null)}
        className="relative z-50"
      >
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-xl shadow-xl">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <Dialog.Title className="text-lg font-semibold text-gray-900">
                Reject Leave Request
              </Dialog.Title>
              <button
                onClick={() => setApprovingRequest(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6">
              <p className="text-sm text-gray-600 mb-4">
                Please provide a reason for rejecting this leave request.
              </p>
              <textarea
                id="rejectionReason"
                rows={4}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                placeholder="Reason for rejection..."
              />
              <div className="flex justify-end space-x-3 mt-4">
                <button
                  onClick={() => setApprovingRequest(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    const reason = (document.getElementById("rejectionReason") as HTMLTextAreaElement)?.value;
                    if (reason && approvingRequest) {
                      handleReject(approvingRequest.id, reason);
                    } else {
                      toast.error("Please provide a rejection reason");
                    }
                  }}
                  disabled={updateLeaveStatusMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {updateLeaveStatusMutation.isPending ? "Rejecting..." : "Reject Request"}
                </button>
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
