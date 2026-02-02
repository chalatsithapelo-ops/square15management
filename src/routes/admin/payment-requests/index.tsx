import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Search,
  Filter,
  CreditCard,
  User,
  DollarSign,
  Calendar,
  Clock,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";

export const Route = createFileRoute("/admin/payment-requests/")({
  component: PaymentRequestsPage,
});

const paymentRequestSchema = z.object({
  artisanId: z.number().min(1, "Please select an artisan"),
  hoursWorked: z.number().optional(),
  daysWorked: z.number().optional(),
  hourlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  calculatedAmount: z.number().min(0, "Amount must be positive"),
  notes: z.string().optional(),
});

type PaymentRequestForm = z.infer<typeof paymentRequestSchema>;

const paymentRequestStatuses = [
  { value: "PENDING", label: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { value: "APPROVED", label: "Approved", color: "bg-blue-100 text-blue-800" },
  { value: "REJECTED", label: "Rejected", color: "bg-red-100 text-red-800" },
  { value: "PAID", label: "Paid", color: "bg-green-100 text-green-800" },
];

function PaymentRequestsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Check user permissions
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasViewPaymentRequests = userPermissions.includes("VIEW_PAYMENT_REQUESTS");

  // Show loading state while checking permissions
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasViewPaymentRequests) {
    return <AccessDenied message="You do not have permission to access Payment Requests." />;
  }

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const paymentRequestsQuery = useQuery(
    trpc.getPaymentRequests.queryOptions({
      token: token!,
      status: statusFilter as any,
    })
  );

  const artisansQuery = useQuery(
    trpc.getArtisans.queryOptions({
      token: token!,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
  } = useForm<PaymentRequestForm>({
    resolver: zodResolver(paymentRequestSchema),
  });

  const selectedArtisanId = watch("artisanId");
  const hoursWorked = watch("hoursWorked");
  const daysWorked = watch("daysWorked");

  const selectedArtisan = artisansQuery.data?.find((a) => a.id === Number(selectedArtisanId));

  const calculateAmount = () => {
    if (!selectedArtisan) return 0;
    let amount = 0;
    const formHourlyRate = watch("hourlyRate");
    const formDailyRate = watch("dailyRate");
    
    if (hoursWorked) {
      const rate = formHourlyRate || selectedArtisan.hourlyRate || 0;
      amount += hoursWorked * rate;
    }
    if (daysWorked) {
      const rate = formDailyRate || selectedArtisan.dailyRate || 0;
      amount += daysWorked * rate;
    }
    return amount;
  };

  const createPaymentRequestMutation = useMutation(
    trpc.createPaymentRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Payment request created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getPaymentRequests.queryKey() });
        reset();
        setShowAddForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to create payment request");
      },
    })
  );

  const updatePaymentRequestStatusMutation = useMutation(
    trpc.updatePaymentRequestStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Payment request status updated!");
        queryClient.invalidateQueries({ queryKey: trpc.getPaymentRequests.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update payment request status");
      },
    })
  );

  const onSubmit = (data: PaymentRequestForm) => {
    createPaymentRequestMutation.mutate({
      token: token!,
      artisanId: Number(data.artisanId),
      hoursWorked: data.hoursWorked,
      daysWorked: data.daysWorked,
      hourlyRate: data.hourlyRate,
      dailyRate: data.dailyRate,
      calculatedAmount: data.calculatedAmount,
      orderIds: [],
      notes: data.notes,
    });
  };

  const paymentRequests = paymentRequestsQuery.data || [];
  const artisans = artisansQuery.data || [];
  
  const filteredPaymentRequests = paymentRequests.filter((pr) =>
    pr.artisan.firstName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pr.artisan.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    pr.requestNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const statusMetrics = paymentRequestStatuses.map((status) => ({
    ...status,
    count: paymentRequests.filter((pr) => pr.status === status.value).length,
  }));

  const totalPending = paymentRequests
    .filter((pr) => pr.status === "PENDING" || pr.status === "APPROVED")
    .reduce((sum, pr) => sum + pr.calculatedAmount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/admin/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-pink-600 to-pink-700 p-2 rounded-xl shadow-md">
                <CreditCard className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Payment Requests</h1>
                <p className="text-sm text-gray-600">
                  {paymentRequests.length} requests • R{totalPending.toLocaleString()} pending
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-pink-600 to-pink-700 hover:from-pink-700 hover:to-pink-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Create Request
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Status Overview</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {statusMetrics.map((metric) => (
              <div
                key={metric.value}
                className="text-center p-4 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                onClick={() => setStatusFilter(statusFilter === metric.value ? null : metric.value)}
              >
                <div className="text-3xl font-bold text-gray-900 mb-1">{metric.count}</div>
                <div className={`text-xs font-medium px-2 py-1 rounded-full inline-block ${metric.color}`}>
                  {metric.label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Create Payment Request</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Select Artisan *
                  </label>
                  <select
                    {...register("artisanId", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="">Select an artisan</option>
                    {artisans.map((artisan) => (
                      <option key={artisan.id} value={artisan.id}>
                        {artisan.firstName} {artisan.lastName} - 
                        {artisan.hourlyRate && ` R${artisan.hourlyRate}/hr`}
                        {artisan.dailyRate && ` R${artisan.dailyRate}/day`}
                      </option>
                    ))}
                  </select>
                  {errors.artisanId && (
                    <p className="mt-1 text-sm text-red-600">{errors.artisanId.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hours Worked
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    {...register("hoursWorked", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Hourly Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("hourlyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder={selectedArtisan?.hourlyRate?.toString() || "0"}
                  />
                  {selectedArtisan?.hourlyRate && (
                    <p className="mt-1 text-xs text-gray-500">
                      Profile rate: R{selectedArtisan.hourlyRate}/hour
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Days Worked
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    {...register("daysWorked", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="0"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Daily Rate (R)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    {...register("dailyRate", { valueAsNumber: true })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder={selectedArtisan?.dailyRate?.toString() || "0"}
                  />
                  {selectedArtisan?.dailyRate && (
                    <p className="mt-1 text-xs text-gray-500">
                      Profile rate: R{selectedArtisan.dailyRate}/day
                    </p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Total Amount (R) *
                  </label>
                  <input
                    type="number"
                    {...register("calculatedAmount", { 
                      valueAsNumber: true,
                      value: calculateAmount(),
                    })}
                    value={calculateAmount()}
                    readOnly
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 font-bold text-lg"
                  />
                  {errors.calculatedAmount && (
                    <p className="mt-1 text-sm text-red-600">{errors.calculatedAmount.message}</p>
                  )}
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                  <textarea
                    {...register("notes")}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    placeholder="Additional notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    reset();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createPaymentRequestMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createPaymentRequestMutation.isPending ? "Creating..." : "Create Request"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex items-center space-x-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search payment requests..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
              />
            </div>
            <button
              onClick={() => setStatusFilter(null)}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <Filter className="h-5 w-5 mr-2" />
              {statusFilter ? "Clear Filter" : "All Requests"}
            </button>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="divide-y divide-gray-200">
            {filteredPaymentRequests.map((request) => (
              <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">{request.requestNumber}</h3>
                      <span
                        className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          paymentRequestStatuses.find((s) => s.value === request.status)?.color
                        }`}
                      >
                        {paymentRequestStatuses.find((s) => s.value === request.status)?.label}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-sm text-gray-600 mb-3">
                      <div className="flex items-center">
                        <User className="h-4 w-4 mr-2 text-gray-400" />
                        {request.artisan.firstName} {request.artisan.lastName}
                      </div>
                      {request.hoursWorked && (
                        <div className="flex items-center">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          {request.hoursWorked} hours @ R{request.hourlyRate || request.artisan.hourlyRate || 0}/hr
                        </div>
                      )}
                      {request.daysWorked && (
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {request.daysWorked} days @ R{request.dailyRate || request.artisan.dailyRate || 0}/day
                        </div>
                      )}
                      <div className="flex items-center">
                        <DollarSign className="h-4 w-4 mr-2 text-gray-400" />
                        R{request.calculatedAmount.toLocaleString()}
                      </div>
                    </div>
                    {request.notes && (
                      <p className="text-sm text-gray-600 mb-2">{request.notes}</p>
                    )}
                    {request.status === "PENDING" && (request.hourlyRate || request.dailyRate) && (
                      <div className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded px-2 py-1 mb-2 inline-block">
                        ⚠️ Verify rate: 
                        {request.hourlyRate && ` R${request.hourlyRate}/hr (profile: R${request.artisan.hourlyRate || 0}/hr)`}
                        {request.dailyRate && ` R${request.dailyRate}/day (profile: R${request.artisan.dailyRate || 0}/day)`}
                      </div>
                    )}
                    <div className="text-xs text-gray-500">
                      Created {new Date(request.createdAt).toLocaleDateString()}
                      {request.approvedDate && ` • Approved ${new Date(request.approvedDate).toLocaleDateString()}`}
                      {request.paidDate && ` • Paid ${new Date(request.paidDate).toLocaleDateString()}`}
                    </div>
                  </div>
                  <div className="ml-4">
                    <select
                      value={request.status}
                      onChange={(e) =>
                        updatePaymentRequestStatusMutation.mutate({
                          token: token!,
                          paymentRequestId: request.id,
                          status: e.target.value as any,
                        })
                      }
                      className="px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-pink-500"
                    >
                      {paymentRequestStatuses.map((status) => (
                        <option key={status.value} value={status.value}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {filteredPaymentRequests.length === 0 && (
              <div className="p-12 text-center">
                <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-2 text-sm text-gray-600">No payment requests found</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
