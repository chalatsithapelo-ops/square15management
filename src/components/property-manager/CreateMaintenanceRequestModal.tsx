import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Wrench, Upload, AlertCircle, UserPlus } from "lucide-react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PhotoUpload } from "../PhotoUpload";

interface CreateMaintenanceRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  customerId: number;
}

const urgencyOptions = ["LOW", "NORMAL", "HIGH", "URGENT"] as const;
const categoryOptions = [
  "PLUMBING",
  "ELECTRICAL",
  "HVAC",
  "APPLIANCES",
  "STRUCTURAL",
  "PAINTING",
  "PEST_CONTROL",
  "GENERAL",
  "OTHER",
] as const;

const maintenanceRequestSchema = z.object({
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description is required"),
  urgency: z.enum(urgencyOptions).default("NORMAL"),
  category: z.string().min(2, "Category is required"),
});

type MaintenanceRequestFormInput = z.infer<typeof maintenanceRequestSchema>;

export function CreateMaintenanceRequestModal({
  isOpen,
  onClose,
  customerId,
}: CreateMaintenanceRequestModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [selectedContractor, setSelectedContractor] = useState<string>("");
  const [selectedBuilding, setSelectedBuilding] = useState<string>("");
  const [useManualEntry, setUseManualEntry] = useState(false);
  const [manualContractorData, setManualContractorData] = useState({
    companyName: "",
    email: "",
    phone: "",
    contactPerson: "",
  });

  // Fetch contractors from database
  const contractorsQuery = useQuery({
    ...trpc.getContractors.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch buildings from database
  const buildingsQuery = useQuery({
    ...trpc.getBuildings.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const contractors = contractorsQuery.data?.contractors || [];
  const buildings = buildingsQuery.data?.buildings || [];

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<MaintenanceRequestFormInput>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues: {
      urgency: "NORMAL",
      category: "GENERAL",
    },
  });

  const createRequestMutation = useMutation(
    trpc.createMaintenanceRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Maintenance request submitted successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getMaintenanceRequests.queryKey(),
        });
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to submit maintenance request.");
        console.error(error);
      },
    })
  );

  const onSubmit: SubmitHandler<MaintenanceRequestFormInput> = (data) => {
    if (!token) {
      toast.error("Authentication required to submit request.");
      return;
    }

    const contractorData = useManualEntry
      ? manualContractorData
      : selectedContractor
      ? {
          companyName: contractors.find((c: any) => c.id === parseInt(selectedContractor))?.companyName || "",
          email: contractors.find((c: any) => c.id === parseInt(selectedContractor))?.email || "",
          phone: contractors.find((c: any) => c.id === parseInt(selectedContractor))?.phone || "",
          contactPerson: `${contractors.find((c: any) => c.id === parseInt(selectedContractor))?.firstName} ${contractors.find((c: any) => c.id === parseInt(selectedContractor))?.lastName}`,
        }
      : undefined;

    createRequestMutation.mutate({
      token,
      customerId,
      ...data,
      photos: uploadedPhotos,
      buildingId: selectedBuilding ? parseInt(selectedBuilding) : undefined,
      contractorId: selectedContractor && !useManualEntry ? parseInt(selectedContractor) : undefined,
      contractorInfo: contractorData,
    });
  };

  const handleClose = () => {
    reset();
    setUploadedPhotos([]);
    setSelectedContractor("");
    setSelectedBuilding("");
    setUseManualEntry(false);
    setManualContractorData({ companyName: "", email: "", phone: "", contactPerson: "" });
    onClose();
  };

  const handleContractorSelect = (contractorId: string) => {
    setSelectedContractor(contractorId);
    if (contractorId && !useManualEntry) {
      const contractor = contractors.find((c: any) => c.id === parseInt(contractorId));
      if (contractor) {
        setManualContractorData({
          companyName: contractor.companyName || `${contractor.firstName} ${contractor.lastName}`,
          email: contractor.email,
          phone: contractor.phone,
          contactPerson: `${contractor.firstName} ${contractor.lastName}`,
        });
      }
    }
  };

  const isSubmitting = createRequestMutation.isPending;

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
              <Dialog.Panel className="w-full max-w-full sm:max-w-3xl transform rounded-lg sm:rounded-2xl bg-white text-left align-middle shadow-xl transition-all flex flex-col max-h-[95vh] sm:max-h-[90vh]">
                <div className="p-3 sm:p-6 border-b border-gray-200 flex-shrink-0">
                  <Dialog.Title
                    as="h3"
                    className="text-base sm:text-lg font-semibold leading-6 text-gray-900"
                  >
                    <Wrench className="inline h-5 w-5 mr-2 text-purple-600" />
                    Submit Maintenance Request
                  </Dialog.Title>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: Request Details */}
                    <div className="space-y-4">
                      {/* Building/Property Selection */}
                      <div>
                        <label htmlFor="building" className="block text-sm font-medium text-gray-700 mb-1">
                          Property/Building (Optional)
                        </label>
                        {buildingsQuery.isLoading ? (
                          <div className="flex items-center justify-center py-2 text-sm text-gray-500">
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Loading properties...
                          </div>
                        ) : (
                          <select
                            id="building"
                            value={selectedBuilding}
                            onChange={(e) => setSelectedBuilding(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            disabled={isSubmitting}
                          >
                            <option value="">Select a property</option>
                            {buildings.map((building: any) => (
                              <option key={building.id} value={building.id}>
                                {building.name} - {building.address}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>

                      {/* Contractor Selection */}
                      <div>
                        <div className="flex justify-between items-center mb-1">
                          <label className="block text-sm font-medium text-gray-700">
                            Contractor Information (Optional)
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setUseManualEntry(!useManualEntry);
                              if (!useManualEntry) {
                                setSelectedContractor("");
                              } else {
                                setManualContractorData({ companyName: "", email: "", phone: "", contactPerson: "" });
                              }
                            }}
                            className="text-xs text-purple-600 hover:text-purple-700 flex items-center"
                          >
                            <UserPlus className="h-3 w-3 mr-1" />
                            {useManualEntry ? "Select from Database" : "Manual Entry"}
                          </button>
                        </div>

                        {!useManualEntry ? (
                          <div>
                            {contractorsQuery.isLoading ? (
                              <div className="flex items-center justify-center py-2 text-sm text-gray-500">
                                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                                Loading contractors...
                              </div>
                            ) : (
                              <select
                                value={selectedContractor}
                                onChange={(e) => handleContractorSelect(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                                disabled={isSubmitting}
                              >
                                <option value="">Select a contractor</option>
                                {contractors.map((contractor: any) => (
                                  <option key={contractor.id} value={contractor.id}>
                                    {contractor.companyName || `${contractor.firstName} ${contractor.lastName}`}
                                  </option>
                                ))}
                              </select>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <input
                              type="text"
                              placeholder="Company Name"
                              value={manualContractorData.companyName}
                              onChange={(e) =>
                                setManualContractorData({ ...manualContractorData, companyName: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <input
                              type="email"
                              placeholder="Email"
                              value={manualContractorData.email}
                              onChange={(e) =>
                                setManualContractorData({ ...manualContractorData, email: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <input
                              type="tel"
                              placeholder="Phone"
                              value={manualContractorData.phone}
                              onChange={(e) =>
                                setManualContractorData({ ...manualContractorData, phone: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                            <input
                              type="text"
                              placeholder="Contact Person"
                              value={manualContractorData.contactPerson}
                              onChange={(e) =>
                                setManualContractorData({ ...manualContractorData, contactPerson: e.target.value })
                              }
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
                            />
                          </div>
                        )}
                      </div>

                      {/* Title */}
                      <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                          Issue Title *
                        </label>
                        <input
                          type="text"
                          id="title"
                          {...register("title")}
                          placeholder="e.g., Leaking faucet in kitchen"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                        {errors.title && <p className="mt-1 text-sm text-red-600">{errors.title.message}</p>}
                      </div>

                      {/* Category and Urgency */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="category" className="block text-sm font-medium text-gray-700">
                            Category *
                          </label>
                          <select
                            id="category"
                            {...register("category")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={isSubmitting}
                          >
                            {categoryOptions.map((option) => (
                              <option key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                          {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
                        </div>

                        <div>
                          <label htmlFor="urgency" className="block text-sm font-medium text-gray-700">
                            Urgency Level *
                          </label>
                          <select
                            id="urgency"
                            {...register("urgency")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                            disabled={isSubmitting}
                          >
                            {urgencyOptions.map((option) => (
                              <option key={option} value={option}>
                                {option.charAt(0) + option.slice(1).toLowerCase()}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>

                      {/* Description */}
                      <div>
                        <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                          Detailed Description *
                        </label>
                        <textarea
                          id="description"
                          rows={6}
                          {...register("description")}
                          placeholder="Please describe the issue in detail, including when it started and any relevant information..."
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-purple-500 focus:ring-purple-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                        {errors.description && (
                          <p className="mt-1 text-sm text-red-600">{errors.description.message}</p>
                        )}
                      </div>
                    </div>

                    {/* Column 2: Photos */}
                    <div className="space-y-4">
                      <PhotoUpload
                        onPhotosUploaded={setUploadedPhotos}
                        minimumPhotos={0}
                        title="Photos of the Issue"
                        description="Upload photos to help us understand the problem better (optional but recommended)."
                        isPublic={true}
                      />
                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start">
                        <AlertCircle className="h-5 w-5 text-blue-600 mr-3 mt-1 flex-shrink-0" />
                        <p className="text-sm text-blue-800">
                          Photos help us assess the issue more accurately and respond faster. They will be shared with
                          maintenance staff.
                        </p>
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
                      className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
                      disabled={isSubmitting}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      onClick={handleSubmit(onSubmit)}
                      className="inline-flex items-center justify-center rounded-md border border-transparent bg-purple-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 disabled:opacity-50"
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
                          Submit Request
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
