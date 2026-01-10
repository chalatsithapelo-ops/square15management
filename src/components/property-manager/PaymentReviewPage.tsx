import { useState, useMemo } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { Fragment } from "react";
import { X, CheckCircle, XCircle, Eye, FileText, Banknote } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

interface PaymentReviewPageProps {
  token: string;
}

const approvalSchema = z.object({
  approvalNotes: z.string().optional(),
});

const rejectionSchema = z.object({
  rejectionReason: z.string().min(10, "Rejection reason must be at least 10 characters"),
});

export function PaymentReviewPage({ token }: PaymentReviewPageProps) {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<"ALL" | "PENDING" | "APPROVED" | "REJECTED">("PENDING");
  const [selectedPaymentType, setSelectedPaymentType] = useState<"ALL" | "RENT" | "UTILITIES" | "CLAIM">("ALL");
  const [selectedPayment, setSelectedPayment] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isApproveOpen, setIsApproveOpen] = useState(false);
  const [isRejectOpen, setIsRejectOpen] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const approvalForm = useForm({
    resolver: zodResolver(approvalSchema),
    defaultValues: {
      approvalNotes: "",
    },
  });

  const rejectionForm = useForm({
    resolver: zodResolver(rejectionSchema),
    defaultValues: {
      rejectionReason: "",
    },
  });

  const paymentsQuery = useQuery(
    trpc.getPropertyManagerPayments.queryOptions({
      token,
      status: selectedStatus === "ALL" ? undefined : selectedStatus,
      paymentType: selectedPaymentType === "ALL" ? undefined : selectedPaymentType,
    })
  );

  const payments = paymentsQuery.data as any;
  const refetch = () => paymentsQuery.refetch();

  const approveMutation = useMutation(
    trpc.approveCustomerPayment.mutationOptions({
      onSuccess: () => {
        toast.success("Payment approved successfully!");
        refetch();
        setIsApproveOpen(false);
        setIsDetailsOpen(false);
        approvalForm.reset();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to approve payment");
      },
    })
  );

  const rejectMutation = useMutation(
    trpc.rejectCustomerPayment.mutationOptions({
      onSuccess: () => {
        toast.success("Payment rejected");
        refetch();
        setIsRejectOpen(false);
        setIsDetailsOpen(false);
        rejectionForm.reset();
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to reject payment");
      },
    })
  );

  const handleViewDetails = (payment: any) => {
    setSelectedPayment(payment);
    setIsDetailsOpen(true);
  };

  const handleApprove = (payment: any) => {
    setSelectedPayment(payment);
    setIsApproveOpen(true);
  };

  const handleReject = (payment: any) => {
    setSelectedPayment(payment);
    setIsRejectOpen(true);
  };

  const onApprovalSubmit = (data: z.infer<typeof approvalSchema>) => {
    if (!selectedPayment) return;
    approveMutation.mutate({
      token,
      paymentId: selectedPayment.id,
      approvalNotes: data.approvalNotes,
    });
  };

  const onRejectionSubmit = (data: z.infer<typeof rejectionSchema>) => {
    if (!selectedPayment) return;
    rejectMutation.mutate({
      token,
      paymentId: selectedPayment.id,
      rejectionReason: data.rejectionReason,
    });
  };

  const pendingCount = useMemo(() => {
    return payments?.filter((p: any) => p.status === "PENDING").length || 0;
  }, [payments]);

  return (
    <div className="space-y-6">
      {/* Header with gradient */}
      <div className="bg-gradient-to-r from-indigo-600 via-purple-600 to-blue-600 rounded-xl p-8 text-white shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Payment Review</h1>
            <p className="mt-2 text-indigo-100">Review and manage customer payments</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm rounded-xl px-6 py-3 border border-white/30">
            <div className="text-sm text-indigo-100">Pending Payments</div>
            <div className="text-3xl font-bold">{pendingCount}</div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Status
            </label>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value as any)}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="ALL">All Status</option>
              <option value="PENDING">Pending</option>
              <option value="APPROVED">Approved</option>
              <option value="REJECTED">Rejected</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Payment Type
            </label>
            <select
              value={selectedPaymentType}
              onChange={(e) => setSelectedPaymentType(e.target.value as any)}
              className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-indigo-500 focus:ring-indigo-500"
            >
              <option value="ALL">All Types</option>
              <option value="RENT">Rent</option>
              <option value="UTILITIES">Utilities</option>
              <option value="CLAIM">Claim</option>
            </select>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Payment #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Building
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Expected
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {payments?.map((payment: any) => (
                <tr key={payment.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                    {payment.paymentNumber}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {new Date(payment.paymentDate).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                    {payment.customer.firstName} {payment.customer.lastName}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {payment.building?.name || "N/A"}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.paymentType === "RENT"
                          ? "bg-blue-100 text-blue-800"
                          : payment.paymentType === "UTILITIES"
                          ? "bg-green-100 text-green-800"
                          : "bg-purple-100 text-purple-800"
                      }`}
                    >
                      {payment.paymentType}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900 dark:text-white">
                    R{payment.amount.toFixed(2)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                    {payment.expectedAmount ? (
                      <span
                        className={
                          payment.amount !== payment.expectedAmount
                            ? "text-yellow-600 dark:text-yellow-400 font-semibold"
                            : ""
                        }
                      >
                        R{payment.expectedAmount.toFixed(2)}
                        {payment.amount !== payment.expectedAmount && " ⚠️"}
                      </span>
                    ) : (
                      "N/A"
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        payment.status === "PENDING"
                          ? "bg-yellow-100 text-yellow-800"
                          : payment.status === "APPROVED"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {payment.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleViewDetails(payment)}
                        className="text-indigo-600 hover:text-indigo-900 dark:text-indigo-400 dark:hover:text-indigo-300"
                        title="View Details"
                      >
                        <Eye className="h-5 w-5" />
                      </button>
                      {payment.status === "PENDING" && (
                        <>
                          <button
                            onClick={() => handleApprove(payment)}
                            className="text-green-600 hover:text-green-900 dark:text-green-400 dark:hover:text-green-300"
                            title="Approve"
                          >
                            <CheckCircle className="h-5 w-5" />
                          </button>
                          <button
                            onClick={() => handleReject(payment)}
                            className="text-red-600 hover:text-red-900 dark:text-red-400 dark:hover:text-red-300"
                            title="Reject"
                          >
                            <XCircle className="h-5 w-5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {(!payments || payments.length === 0) && (
          <div className="text-center py-12">
            <Banknote className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-500 dark:text-gray-400">No payments found</p>
          </div>
        )}
      </div>

      {/* Payment Details Modal */}
      <Transition appear show={isDetailsOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsDetailsOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-4xl transform rounded-2xl bg-white dark:bg-gray-800 text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                  <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <Dialog.Title
                      as="h3"
                      className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent"
                    >
                      Payment Details
                    </Dialog.Title>
                    <button
                      onClick={() => setIsDetailsOpen(false)}
                      className="text-gray-400 hover:text-gray-500"
                    >
                      <X className="h-6 w-6" />
                    </button>
                  </div>

                  {selectedPayment && (
                    <div className="overflow-y-auto p-6 space-y-6">
                      {/* Payment Information Grid */}
                      <div className="grid grid-cols-2 gap-6">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Payment Number
                          </label>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedPayment.paymentNumber}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Payment Type
                          </label>
                          <p className="mt-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                selectedPayment.paymentType === "RENT"
                                  ? "bg-blue-100 text-blue-800"
                                  : selectedPayment.paymentType === "UTILITIES"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-purple-100 text-purple-800"
                              }`}
                            >
                              {selectedPayment.paymentType}
                            </span>
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Customer
                          </label>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedPayment.customer.firstName} {selectedPayment.customer.lastName}
                          </p>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {selectedPayment.customer.email}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Building
                          </label>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedPayment.building?.name || "N/A"}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Amount Paid
                          </label>
                          <p className="mt-1 text-lg font-bold text-gray-900 dark:text-white">
                            R{selectedPayment.amount.toFixed(2)}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Expected Amount
                          </label>
                          <p className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
                            {selectedPayment.expectedAmount ? `R${selectedPayment.expectedAmount.toFixed(2)}` : "N/A"}
                          </p>
                        </div>

                        {selectedPayment.amount !== selectedPayment.expectedAmount && selectedPayment.deviationReason && (
                          <div className="col-span-2">
                            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                              <div className="flex items-start">
                                <div className="flex-shrink-0">
                                  <FileText className="h-5 w-5 text-yellow-400" />
                                </div>
                                <div className="ml-3">
                                  <h3 className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                                    Deviation Reason
                                  </h3>
                                  <div className="mt-2 text-sm text-yellow-700 dark:text-yellow-300">
                                    {selectedPayment.deviationReason}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Payment Method
                          </label>
                          <p className="mt-1 text-gray-900 dark:text-white">
                            {selectedPayment.paymentMethod?.replace("_", " ") || "N/A"}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Transaction Reference
                          </label>
                          <p className="mt-1 text-gray-900 dark:text-white">
                            {selectedPayment.transactionReference || "N/A"}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Payment Date
                          </label>
                          <p className="mt-1 text-gray-900 dark:text-white">
                            {new Date(selectedPayment.paymentDate).toLocaleDateString()}
                          </p>
                        </div>

                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Status
                          </label>
                          <p className="mt-1">
                            <span
                              className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                                selectedPayment.status === "PENDING"
                                  ? "bg-yellow-100 text-yellow-800"
                                  : selectedPayment.status === "APPROVED"
                                  ? "bg-green-100 text-green-800"
                                  : "bg-red-100 text-red-800"
                              }`}
                            >
                              {selectedPayment.status}
                            </span>
                          </p>
                        </div>

                        {selectedPayment.notes && (
                          <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                              Notes
                            </label>
                            <p className="mt-1 text-gray-900 dark:text-white">
                              {selectedPayment.notes}
                            </p>
                          </div>
                        )}
                      </div>

                      {/* Proof of Payment */}
                      {selectedPayment.proofOfPayment && selectedPayment.proofOfPayment.length > 0 && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Proof of Payment
                          </label>
                          <div className="grid grid-cols-3 gap-4">
                            {selectedPayment.proofOfPayment.map((url: string, index: number) => (
                              <div key={index} className="relative group">
                                <img
                                  src={url}
                                  alt={`Proof ${index + 1}`}
                                  className="w-full h-32 object-cover rounded-lg cursor-pointer border-2 border-gray-200 dark:border-gray-700 hover:border-indigo-500 transition-colors"
                                  onClick={() => setSelectedImage(url)}
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Actions */}
                  {selectedPayment && selectedPayment.status === "PENDING" && (
                    <div className="flex justify-end space-x-3 p-6 border-t border-gray-200 dark:border-gray-700 flex-shrink-0">
                      <button
                        onClick={() => {
                          setIsDetailsOpen(false);
                          handleReject(selectedPayment);
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center space-x-2"
                      >
                        <XCircle className="h-5 w-5" />
                        <span>Reject</span>
                      </button>
                      <button
                        onClick={() => {
                          setIsDetailsOpen(false);
                          handleApprove(selectedPayment);
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>Approve</span>
                      </button>
                    </div>
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Approve Modal */}
      <Transition appear show={isApproveOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsApproveOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Approve Payment
                  </Dialog.Title>

                  <form onSubmit={approvalForm.handleSubmit(onApprovalSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Approval Notes (Optional)
                      </label>
                      <textarea
                        {...approvalForm.register("approvalNotes")}
                        rows={4}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-green-500 focus:ring-green-500"
                        placeholder="Add any notes about this approval..."
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsApproveOpen(false)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={approveMutation.isPending}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center space-x-2"
                      >
                        <CheckCircle className="h-5 w-5" />
                        <span>{approveMutation.isPending ? "Approving..." : "Approve Payment"}</span>
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Reject Modal */}
      <Transition appear show={isRejectOpen} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setIsRejectOpen(false)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-25" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4 text-center">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="w-full max-w-md transform overflow-hidden rounded-2xl bg-white dark:bg-gray-800 p-6 text-left align-middle shadow-xl transition-all">
                  <Dialog.Title as="h3" className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                    Reject Payment
                  </Dialog.Title>

                  <form onSubmit={rejectionForm.handleSubmit(onRejectionSubmit)} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Rejection Reason <span className="text-red-500">*</span>
                      </label>
                      <textarea
                        {...rejectionForm.register("rejectionReason")}
                        rows={4}
                        className="w-full rounded-lg border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-red-500 focus:ring-red-500"
                        placeholder="Provide a clear reason for rejecting this payment..."
                      />
                      {rejectionForm.formState.errors.rejectionReason && (
                        <p className="mt-1 text-sm text-red-600">
                          {rejectionForm.formState.errors.rejectionReason.message}
                        </p>
                      )}
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={() => setIsRejectOpen(false)}
                        className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={rejectMutation.isPending}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center space-x-2"
                      >
                        <XCircle className="h-5 w-5" />
                        <span>{rejectMutation.isPending ? "Rejecting..." : "Reject Payment"}</span>
                      </button>
                    </div>
                  </form>
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>

      {/* Image Viewer Modal */}
      <Transition appear show={selectedImage !== null} as={Fragment}>
        <Dialog as="div" className="relative z-50" onClose={() => setSelectedImage(null)}>
          <Transition.Child
            as={Fragment}
            enter="ease-out duration-300"
            enterFrom="opacity-0"
            enterTo="opacity-100"
            leave="ease-in duration-200"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <div className="fixed inset-0 bg-black bg-opacity-75" />
          </Transition.Child>

          <div className="fixed inset-0 overflow-y-auto">
            <div className="flex min-h-full items-center justify-center p-4">
              <Transition.Child
                as={Fragment}
                enter="ease-out duration-300"
                enterFrom="opacity-0 scale-95"
                enterTo="opacity-100 scale-100"
                leave="ease-in duration-200"
                leaveFrom="opacity-100 scale-100"
                leaveTo="opacity-0 scale-95"
              >
                <Dialog.Panel className="relative max-w-5xl">
                  <button
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-12 right-0 text-white hover:text-gray-300"
                  >
                    <X className="h-8 w-8" />
                  </button>
                  {selectedImage && (
                    <img
                      src={selectedImage}
                      alt="Proof of Payment"
                      className="max-h-[80vh] w-auto rounded-lg"
                    />
                  )}
                </Dialog.Panel>
              </Transition.Child>
            </div>
          </div>
        </Dialog>
      </Transition>
    </div>
  );
}
