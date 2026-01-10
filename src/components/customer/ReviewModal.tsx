import { Fragment, useState } from "react";
import { Dialog, Transition } from "@headlessui/react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Star, X, Loader2, Award, Clock, ThumbsUp } from "lucide-react";
import toast from "react-hot-toast";

const reviewSchema = z.object({
  rating: z.number().min(1, "Please select a rating").max(5),
  comment: z.string().optional(),
  serviceQuality: z.number().min(1).max(5).optional(),
  professionalism: z.number().min(1).max(5).optional(),
  timeliness: z.number().min(1).max(5).optional(),
});

type ReviewFormData = z.infer<typeof reviewSchema>;

interface ReviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  artisanId: number;
  artisanName: string;
  orderId?: number;
  orderNumber?: string;
  projectId?: number;
  projectName?: string;
}

export function ReviewModal({
  isOpen,
  onClose,
  artisanId,
  artisanName,
  orderId,
  orderNumber,
  projectId,
  projectName,
}: ReviewModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [hoveredSubRating, setHoveredSubRating] = useState<{
    field: string;
    value: number;
  } | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
    reset,
  } = useForm<ReviewFormData>({
    resolver: zodResolver(reviewSchema),
    defaultValues: {
      rating: 0,
      comment: "",
      serviceQuality: undefined,
      professionalism: undefined,
      timeliness: undefined,
    },
  });

  const rating = watch("rating");
  const serviceQuality = watch("serviceQuality");
  const professionalism = watch("professionalism");
  const timeliness = watch("timeliness");

  const createReviewMutation = useMutation(
    trpc.createReview.mutationOptions({
      onSuccess: () => {
        toast.success("Review submitted successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getOrders.queryKey() });
        queryClient.invalidateQueries({ queryKey: trpc.getProjects.queryKey() });
        reset();
        onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to submit review");
      },
    })
  );

  const onSubmit = (data: ReviewFormData) => {
    if (!token) {
      toast.error("You must be logged in to submit a review");
      return;
    }

    if (data.rating === 0) {
      toast.error("Please select a rating");
      return;
    }

    createReviewMutation.mutate({
      token,
      artisanId,
      orderId,
      projectId,
      rating: data.rating,
      comment: data.comment || undefined,
      serviceQuality: data.serviceQuality || undefined,
      professionalism: data.professionalism || undefined,
      timeliness: data.timeliness || undefined,
    });
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const renderStarRating = (
    currentValue: number,
    fieldName: "rating" | "serviceQuality" | "professionalism" | "timeliness",
    label: string
  ) => {
    const displayValue =
      fieldName === "rating"
        ? hoveredRating || currentValue
        : hoveredSubRating?.field === fieldName
        ? hoveredSubRating.value
        : currentValue;

    return (
      <div className="space-y-2">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <div className="flex items-center space-x-1">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setValue(fieldName, star)}
              onMouseEnter={() => {
                if (fieldName === "rating") {
                  setHoveredRating(star);
                } else {
                  setHoveredSubRating({ field: fieldName, value: star });
                }
              }}
              onMouseLeave={() => {
                if (fieldName === "rating") {
                  setHoveredRating(0);
                } else {
                  setHoveredSubRating(null);
                }
              }}
              className="focus:outline-none transition-transform hover:scale-110"
            >
              <Star
                className={`h-8 w-8 ${
                  star <= displayValue
                    ? "text-yellow-400 fill-yellow-400"
                    : "text-gray-300"
                }`}
              />
            </button>
          ))}
          {currentValue > 0 && (
            <span className="ml-2 text-sm text-gray-600">
              {currentValue} {currentValue === 1 ? "star" : "stars"}
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <Transition appear show={isOpen} as={Fragment}>
      <Dialog as="div" className="relative z-50" onClose={handleClose}>
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
              <Dialog.Panel className="w-full max-w-2xl transform rounded-2xl bg-white p-6 text-left align-middle shadow-xl transition-all flex flex-col max-h-[90vh]">
                <div className="flex items-center justify-between pb-6 flex-shrink-0">
                  <Dialog.Title as="h3" className="text-xl font-semibold text-gray-900">
                    Leave a Review
                  </Dialog.Title>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="rounded-full p-1 hover:bg-gray-100 transition-colors"
                  >
                    <X className="h-5 w-5 text-gray-500" />
                  </button>
                </div>

                <form id="review-form" onSubmit={handleSubmit(onSubmit)} className="space-y-6 flex-1 overflow-y-auto pr-2 -mr-2 min-h-0">
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-sm text-blue-900">
                      <span className="font-semibold">Artisan:</span> {artisanName}
                    </p>
                    {orderNumber && (
                      <p className="text-sm text-blue-900 mt-1">
                        <span className="font-semibold">Order:</span> {orderNumber}
                      </p>
                    )}
                    {projectName && (
                      <p className="text-sm text-blue-900 mt-1">
                        <span className="font-semibold">Project:</span> {projectName}
                      </p>
                    )}
                  </div>

                  {/* Overall Rating */}
                  <div>
                    {renderStarRating(rating, "rating", "Overall Rating *")}
                    {errors.rating && (
                      <p className="mt-1 text-sm text-red-600">{errors.rating.message}</p>
                    )}
                  </div>

                  {/* Comment */}
                  <div>
                    <label htmlFor="comment" className="block text-sm font-medium text-gray-700 mb-1">
                      Comment (Optional)
                    </label>
                    <textarea
                      id="comment"
                      rows={4}
                      {...register("comment")}
                      placeholder="Share your experience with this artisan..."
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-vertical"
                    />
                  </div>

                  {/* Sub-ratings */}
                  <div className="border-t border-gray-200 pt-6">
                    <h4 className="text-sm font-semibold text-gray-900 mb-4">
                      Additional Ratings (Optional)
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div>
                        <div className="flex items-center mb-2">
                          <Award className="h-4 w-4 text-blue-600 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Service Quality</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setValue("serviceQuality", star)}
                              onMouseEnter={() =>
                                setHoveredSubRating({ field: "serviceQuality", value: star })
                              }
                              onMouseLeave={() => setHoveredSubRating(null)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  star <=
                                  (hoveredSubRating?.field === "serviceQuality"
                                    ? hoveredSubRating.value
                                    : serviceQuality || 0)
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center mb-2">
                          <ThumbsUp className="h-4 w-4 text-green-600 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Professionalism</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setValue("professionalism", star)}
                              onMouseEnter={() =>
                                setHoveredSubRating({ field: "professionalism", value: star })
                              }
                              onMouseLeave={() => setHoveredSubRating(null)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  star <=
                                  (hoveredSubRating?.field === "professionalism"
                                    ? hoveredSubRating.value
                                    : professionalism || 0)
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center mb-2">
                          <Clock className="h-4 w-4 text-purple-600 mr-2" />
                          <span className="text-sm font-medium text-gray-700">Timeliness</span>
                        </div>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setValue("timeliness", star)}
                              onMouseEnter={() =>
                                setHoveredSubRating({ field: "timeliness", value: star })
                              }
                              onMouseLeave={() => setHoveredSubRating(null)}
                              className="focus:outline-none"
                            >
                              <Star
                                className={`h-6 w-6 ${
                                  star <=
                                  (hoveredSubRating?.field === "timeliness"
                                    ? hoveredSubRating.value
                                    : timeliness || 0)
                                    ? "text-yellow-400 fill-yellow-400"
                                    : "text-gray-300"
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </form>

                {/* Action buttons */}
                <div className="flex space-x-3 justify-end pt-4 border-t border-gray-200 flex-shrink-0">
                  <button
                    type="button"
                    onClick={handleClose}
                    disabled={createReviewMutation.isPending}
                    className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    form="review-form"
                    disabled={createReviewMutation.isPending || rating === 0}
                    className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors inline-flex items-center"
                  >
                    {createReviewMutation.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Star className="h-4 w-4 mr-2" />
                        Submit Review
                      </>
                    )}
                  </button>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
