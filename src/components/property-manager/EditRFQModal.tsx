import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState, useEffect } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, FileText, Upload, AlertCircle } from "lucide-react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PhotoUpload } from "../PhotoUpload";

interface EditRFQModalProps {
  isOpen: boolean;
  onClose: () => void;
  rfq: {
    id: number;
    title: string;
    description: string;
    scopeOfWork: string;
    buildingName: string | null;
    buildingAddress: string;
    urgency: string;
    estimatedBudget: number | null;
    notes?: string | null;
  } | null;
}

const urgencyOptions = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;

const rfqSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description is required"),
  scopeOfWork: z.string().min(10, "Scope of Work is required"),
  buildingName: z.string().optional(),
  buildingAddress: z.string().min(5, "Property address is required"),
  urgency: z.enum(urgencyOptions).default("NORMAL"),
  estimatedBudget: z.preprocess(
    (val) => {
      // Handle empty string, undefined, null, or NaN
      if (val === "" || val === undefined || val === null || (typeof val === 'number' && isNaN(val))) {
        return undefined;
      }
      const num = Number(val);
      return isNaN(num) ? undefined : num;
    },
    z.number().min(0, "Budget must be positive").optional()
  ),
  notes: z.string().optional(),
  selectedContractorIds: z.array(z.number()).optional(),
});

type RFQFormInput = z.infer<typeof rfqSchema>;

export function EditRFQModal({ isOpen, onClose, rfq }: EditRFQModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedContractors, setSelectedContractors] = useState<number[]>([]);
  const [uploadedAttachments, setUploadedAttachments] = useState<string[]>([]);

  // Fetch contractors for multi-select
  const contractorsQuery = useQuery({
    ...trpc.getContractors.queryOptions({ token: token! }),
    enabled: !!token && isOpen,
  });

  const contractors = contractorsQuery.data?.contractors || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<RFQFormInput>({
    resolver: zodResolver<RFQFormInput>(rfqSchema),
  });

  useEffect(() => {
    if (rfq) {
      reset({
        title: rfq.title,
        description: rfq.description,
        scopeOfWork: rfq.scopeOfWork,
        buildingName: rfq.buildingName || "",
        buildingAddress: rfq.buildingAddress,
        urgency: rfq.urgency as any,
        estimatedBudget: rfq.estimatedBudget ?? undefined,
        notes: rfq.notes || "",
      });
      setSelectedContractors([]);
    }
  }, [rfq, reset]);

  const updateRfqMutation = useMutation(
    trpc.updatePropertyManagerRFQ.mutationOptions({
      onSuccess: () => {
        toast.success("RFQ updated and submitted successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getPropertyManagerRFQs.queryKey(),
        });
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update RFQ.");
        console.error(error);
      },
    })
  );

  const onSubmit: SubmitHandler<RFQFormInput> = (data) => {
    if (!token || !rfq) {
      toast.error("Authentication required.");
      return;
    }

    if (selectedContractors.length === 0) {
      toast.error("Please select at least one contractor to receive this RFQ.");
      return;
    }

    updateRfqMutation.mutate({
      token,
      rfqId: rfq.id,
      ...data,
      estimatedBudget: data.estimatedBudget ?? undefined,
      attachments: uploadedAttachments,
      selectedContractorIds: selectedContractors,
      status: "SUBMITTED", // Submit when editing
    });
  };

  const handleClose = () => {
    reset();
    setSelectedContractors([]);
    setUploadedAttachments([]);
    onClose();
  };

  const handleContractorToggle = (contractorId: number) => {
    setSelectedContractors((prev) =>
      prev.includes(contractorId)
        ? prev.filter((id) => id !== contractorId)
        : [...prev, contractorId]
    );
  };

  const isSubmitting = updateRfqMutation.isPending;

  if (!rfq) return null;

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
          <div className="fixed inset-0 bg-black/50" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-2 sm:p-4 text-center">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-300"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-200"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <Dialog.Panel className="w-full max-w-full sm:max-w-4xl transform rounded-lg sm:rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="p-3 sm:p-6 border-b border-gray-200 flex-shrink-0">
                  <Dialog.Title
                    as="h3"
                    className="text-base sm:text-lg font-semibold leading-6 text-gray-900"
                  >
                    <FileText className="inline h-5 w-5 mr-2 text-teal-600" />
                    Request for Quotation (RFQ)
                  </Dialog.Title>
                </div>
                
                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: RFQ Details */}
                    <div className="space-y-4">
                        {/* Title */}
                        <div>
                          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                            RFQ Title
                          </label>
                          <input
                            type="text"
                            id="title"
                            {...register("title")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
                        </div>

                        {/* Building Address and Name */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="buildingAddress" className="block text-sm font-medium text-gray-700">
                              Property Address *
                            </label>
                            <input
                              type="text"
                              id="buildingAddress"
                              {...register("buildingAddress")}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                              disabled={isSubmitting}
                            />
                            {errors.buildingAddress && <p className="mt-1 text-sm text-red-600">{errors.buildingAddress.message}</p>}
                          </div>
                          <div>
                            <label htmlFor="buildingName" className="block text-sm font-medium text-gray-700">
                              Building Name (Optional)
                            </label>
                            <input
                              type="text"
                              id="buildingName"
                              {...register("buildingName")}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                              disabled={isSubmitting}
                            />
                          </div>
                        </div>

                        {/* Contractor Selection */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">
                            Select Contractors to Receive RFQ *
                          </label>
                          {contractorsQuery.isLoading ? (
                            <div className="flex items-center justify-center py-4 text-sm text-gray-500">
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Loading contractors...
                            </div>
                          ) : contractors.length === 0 ? (
                            <p className="text-sm text-gray-500 py-2">No contractors available</p>
                          ) : (
                            <div className="max-h-48 overflow-y-auto border border-gray-300 rounded-lg p-3 space-y-2">
                              {contractors.map((contractor: any) => (
                                <label
                                  key={contractor.id}
                                  className="flex items-center space-x-3 cursor-pointer hover:bg-gray-50 p-2 rounded"
                                >
                                  <input
                                    type="checkbox"
                                    checked={selectedContractors.includes(contractor.id)}
                                    onChange={() => handleContractorToggle(contractor.id)}
                                    className="h-4 w-4 text-teal-600 focus:ring-teal-500 border-gray-300 rounded"
                                    disabled={isSubmitting}
                                  />
                                  <span className="text-sm text-gray-900">
                                    {contractor.companyName || `${contractor.firstName} ${contractor.lastName}`}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    ({contractor.email})
                                  </span>
                                  {!contractor.portalAccessEnabled ? (
                                    <span className="text-xs text-amber-600">(No portal access - email only)</span>
                                  ) : contractor.hasPortalUser === false ? (
                                    <span className="text-xs text-amber-600">(Email only - portal not configured)</span>
                                  ) : null}
                                </label>
                              ))}
                            </div>
                          )}
                          {selectedContractors.length > 0 && (
                            <p className="mt-2 text-sm text-teal-600">
                              {selectedContractors.length} contractor(s) selected
                            </p>
                          )}
                        </div>

                        {/* Description */}
                        <div>
                          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                            Brief Description / Problem Summary *
                          </label>
                          <textarea
                            id="description"
                            rows={3}
                            {...register("description")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.description && <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>}
                        </div>

                         {/* Scope of Work */}
                        <div>
                          <label htmlFor="scopeOfWork" className="block text-sm font-medium text-gray-700">
                            Detailed Scope of Work *
                          </label>
                          <textarea
                            id="scopeOfWork"
                            rows={5}
                            {...register("scopeOfWork")}
                            placeholder="e.g. Needs plastering on the exterior wall. Requires 5 litres of paint, colour code: R300."
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.scopeOfWork && <p className="mt-1 text-sm text-red-600">{errors.scopeOfWork.message}</p>}
                        </div>

                        {/* Urgency and Budget */}
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label htmlFor="urgency" className="block text-sm font-medium text-gray-700">
                              Urgency Level
                            </label>
                            <select
                              id="urgency"
                              {...register("urgency")}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                              disabled={isSubmitting}
                            >
                              {urgencyOptions.map(option => (
                                <option key={option} value={option}>
                                  {option.charAt(0) + option.slice(1).toLowerCase()}
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label htmlFor="estimatedBudget" className="block text-sm font-medium text-gray-700">
                              Estimated Budget (R)
                            </label>
                            <input
                              type="number"
                              id="estimatedBudget"
                              step="0.01"
                              {...register("estimatedBudget", { valueAsNumber: true })}
                              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                              disabled={isSubmitting}
                              placeholder="Optional"
                            />
                            {errors.estimatedBudget && <p className="mt-1 text-sm text-red-600">{errors.estimatedBudget.message}</p>}
                          </div>
                        </div>
                    </div>

                    {/* Column 2: Attachments and Notes */}
                    <div className="space-y-4">
                        {/* Attachments */}
                        <PhotoUpload
                          onPhotosUploaded={setUploadedAttachments}
                          minimumPhotos={0}
                          title="Property Photos & Documents"
                          description="Upload any relevant pictures or documents related to the RFQ."
                          isPublic={true}
                        />
                        <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start">
                            <AlertCircle className="h-5 w-5 text-yellow-600 mr-3 mt-1 flex-shrink-0" />
                            <p className="text-sm text-yellow-800">
                                Attachments will be publicly accessible by administrators and assigned artisans.
                            </p>
                        </div>
                        
                        {/* Notes */}
                        <div>
                          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                            Internal Notes (Admin/PM use only)
                          </label>
                          <textarea
                            id="notes"
                            rows={3}
                            {...register("notes")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                            placeholder="Add internal notes or context for the admin team."
                          />
                        </div>
                    </div>
                  </div>
                </form>

                {/* Footer Actions */}
                <div className="flex-shrink-0 p-3 sm:p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit(onSubmit)}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-teal-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-5 w-5 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 mr-2" />
                          Submit RFQ to Admin
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </Dialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </Dialog>
    </Transition>
  );
}
