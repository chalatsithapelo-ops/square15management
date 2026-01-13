import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { X, Star } from "lucide-react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

interface RateWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function RateWorkModal({ isOpen, onClose, order }: RateWorkModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [qualityRating, setQualityRating] = useState(0);
  const [timelinessRating, setTimelinessRating] = useState(0);
  const [professionalismRating, setProfessionalismRating] = useState(0);
  const [communicationRating, setCommunicationRating] = useState(0);
  const [overallRating, setOverallRating] = useState(0);
  const [comments, setComments] = useState("");
  const [kpiRatings, setKpiRatings] = useState<{ kpiId: string; rating: number; notes?: string }[]>([]);
  const [error, setError] = useState("");
  const [selectedContractorManagementId, setSelectedContractorManagementId] = useState<string>("");
  const [selectedContractorUserId, setSelectedContractorUserId] = useState<string>("");

  // Fetch contractors to select from if order doesn't have contractorId
  const contractorsQuery = useQuery(
    trpc.getContractors.queryOptions({
      token: token!,
    })
  );

  const contractors = (contractorsQuery.data as any)?.contractors || [];

  // PropertyManagerOrder.contractorId is a User id.
  // If the order doesn't have it (legacy), the selector chooses a Contractor record and we map it to userId.
  const contractorUserId: string = String(order.contractorId || selectedContractorUserId || "");

  const resolvedContractorManagementId: number | null = (() => {
    if (selectedContractorManagementId) return parseInt(selectedContractorManagementId);
    if (!contractorUserId) return null;
    const match = contractors.find((c: any) => String(c.userId || "") === String(contractorUserId));
    return match?.id ?? null;
  })();

  // Fetch contractor's KPIs
  const kpisQuery = useQuery({
    ...trpc.getContractorPerformance.queryOptions({
      token: token!,
      contractorId: resolvedContractorManagementId || 0,
    }),
    enabled: !!resolvedContractorManagementId,
  });

  const kpis = (kpisQuery as any)?.data?.kpis || [];

  const rateWorkMutation = useMutation(
    trpc.rateCompletedWork.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getPropertyManagerOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getContractors.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getContractorPerformance.queryKey() });
        onClose();
        resetForm();
      },
      onError: (error: any) => {
        setError(error.message || "Failed to rate work");
      },
    })
  );

  const resetForm = () => {
    setQualityRating(0);
    setTimelinessRating(0);
    setProfessionalismRating(0);
    setCommunicationRating(0);
    setOverallRating(0);
    setComments("");
    setKpiRatings([]);
    setError("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!contractorUserId) {
      setError("Please select a contractor");
      return;
    }

    if (!qualityRating || !timelinessRating || !professionalismRating || !communicationRating || !overallRating) {
      setError("Please provide all ratings");
      return;
    }

    rateWorkMutation.mutate({
      token: token!,
      orderId: order.id,
      contractorId: parseInt(contractorUserId),
      contractorManagementId: resolvedContractorManagementId || undefined,
      qualityRating,
      timelinessRating,
      professionalismRating,
      communicationRating,
      overallRating,
      comments: comments || undefined,
      kpiRatings: kpiRatings.length > 0 ? kpiRatings.map(r => ({
        kpiId: parseInt(r.kpiId),
        rating: r.rating,
        notes: r.notes,
      })) : undefined,
    });
  };

  const handleContractorSelect = (contractorManagementId: string) => {
    setSelectedContractorManagementId(contractorManagementId);
    const selected = contractors.find((c: any) => String(c.id) === String(contractorManagementId));
    if (!selected) {
      setSelectedContractorUserId("");
      return;
    }
    if (!selected.userId) {
      setSelectedContractorUserId("");
      setError("Selected contractor does not have a portal user account");
      return;
    }
    setSelectedContractorUserId(String(selected.userId));
  };

  const handleKpiRatingChange = (kpiId: string, rating: number) => {
    setKpiRatings((prev) => {
      const existing = prev.find((r) => r.kpiId === kpiId);
      if (existing) {
        return prev.map((r) => (r.kpiId === kpiId ? { ...r, rating } : r));
      } else {
        return [...prev, { kpiId, rating }];
      }
    });
  };

  const StarRating = ({
    rating,
    setRating,
    label,
  }: {
    rating: number;
    setRating: (rating: number) => void;
    label: string;
  }) => {
    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setRating(star)}
              className={`transition-colors ${
                star <= rating ? "text-yellow-400" : "text-gray-300"
              } hover:text-yellow-400`}
            >
              <Star className="w-6 h-6 fill-current" />
            </button>
          ))}
          <span className="ml-2 text-sm text-gray-600">{rating > 0 ? `${rating}/5` : "Not rated"}</span>
        </div>
      </div>
    );
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={onClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white shadow-xl transition-all max-h-[90vh] flex flex-col">
                <Dialog.Title as="div" className="flex items-center justify-between p-6 border-b border-gray-200 flex-shrink-0">
                  <h3 className="text-lg font-bold text-gray-900">Rate Completed Work</h3>
                  <button
                    onClick={onClose}
                    className="text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </Dialog.Title>

                <div className="overflow-y-auto flex-1 px-6">
                  <form onSubmit={handleSubmit} className="space-y-6 py-6">
                    {/* Order Info */}
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p className="text-sm text-gray-600">
                      Order: <span className="font-medium text-gray-900">{order.title || order.serviceType || "N/A"}</span>
                    </p>
                    <p className="text-sm text-gray-600">
                      Company: <span className="font-medium text-gray-900">{order.companyName || "N/A"}</span>
                    </p>
                  </div>

                  {/* Contractor Selection (if order doesn't have contractorId) */}
                  {!order.contractorId && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Contractor <span className="text-red-500">*</span>
                      </label>
                      <select
                        value={selectedContractorManagementId}
                        onChange={(e) => handleContractorSelect(e.target.value)}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        required
                      >
                        <option value="">-- Select Contractor --</option>
                        {contractors.map((contractor: any) => (
                          <option key={contractor.id} value={contractor.id} disabled={!contractor.userId}>
                            {contractor.companyName} - {contractor.email}{contractor.userId ? "" : " (no portal user)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {error && (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                      {error}
                    </div>
                  )}

                  {/* Main Ratings */}
                  <div className="space-y-4">
                    <h4 className="font-semibold text-gray-900">Performance Ratings</h4>
                    <StarRating
                      rating={qualityRating}
                      setRating={setQualityRating}
                      label="Quality of Work"
                    />
                    <StarRating
                      rating={timelinessRating}
                      setRating={setTimelinessRating}
                      label="Timeliness"
                    />
                    <StarRating
                      rating={professionalismRating}
                      setRating={setProfessionalismRating}
                      label="Professionalism"
                    />
                    <StarRating
                      rating={communicationRating}
                      setRating={setCommunicationRating}
                      label="Communication"
                    />
                    <StarRating
                      rating={overallRating}
                      setRating={setOverallRating}
                      label="Overall Rating"
                    />
                  </div>

                  {/* Comments */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Comments (Optional)
                    </label>
                    <textarea
                      value={comments}
                      onChange={(e) => setComments(e.target.value)}
                      rows={3}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      placeholder="Add any additional comments about the work..."
                    />
                  </div>

                  {/* KPI Ratings (Optional) */}
                  {kpis.length > 0 && (
                    <div className="space-y-4">
                      <h4 className="font-semibold text-gray-900">KPI-Specific Ratings (Optional)</h4>
                      <p className="text-sm text-gray-600">
                        Rate how this work contributed to specific KPIs
                      </p>
                      {kpis.map((kpi: any) => {
                        const kpiRating = kpiRatings.find((r) => r.kpiId === kpi.id);
                        return (
                          <div key={kpi.id} className="border border-gray-200 rounded-lg p-4">
                            <div className="mb-2">
                              <p className="font-medium text-gray-900">{kpi.kpiName}</p>
                              <p className="text-sm text-gray-600">{kpi.description}</p>
                            </div>
                            <div className="flex gap-1">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                  key={star}
                                  type="button"
                                  onClick={() => handleKpiRatingChange(kpi.id, star)}
                                  className={`transition-colors ${
                                    star <= (kpiRating?.rating || 0) ? "text-yellow-400" : "text-gray-300"
                                  } hover:text-yellow-400`}
                                >
                                  <Star className="w-5 h-5 fill-current" />
                                </button>
                              ))}
                              <span className="ml-2 text-sm text-gray-600">
                                {kpiRating?.rating ? `${kpiRating.rating}/5` : "Not rated"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex justify-end gap-3 pt-4 border-t">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={rateWorkMutation.isPending}
                      className="px-4 py-2 text-sm font-medium text-white bg-teal-600 rounded-lg hover:bg-teal-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                    >
                      {rateWorkMutation.isPending ? "Submitting..." : "Submit Rating"}
                    </button>
                  </div>
                  </form>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
