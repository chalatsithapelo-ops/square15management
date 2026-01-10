import { Dialog, Transition } from "@headlessui/react";
import { Fragment, useState } from "react";
import { useForm, SubmitHandler } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2, Plus } from "lucide-react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { PhotoUpload } from "../PhotoUpload";

interface CreateBuildingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const buildingTypeOptions = [
  "RESIDENTIAL",
  "COMMERCIAL",
  "MIXED_USE",
  "INDUSTRIAL",
] as const;

const buildingSchema = z.object({
  name: z.string().min(3, "Building name is required"),
  address: z.string().min(5, "Address is required"),
  buildingType: z.enum(buildingTypeOptions),
  numberOfUnits: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(1, "Number of units must be at least 1").optional()
  ),
  totalSquareFeet: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().positive("Square feet must be positive").optional()
  ),
  yearBuilt: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().int().min(1800).max(new Date().getFullYear()).optional()
  ),
  estimatedValue: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().positive("Value must be positive").optional()
  ),
  monthlyExpenses: z.preprocess(
    (val) => (val === "" || val === undefined ? undefined : Number(val)),
    z.number().positive("Expenses must be positive").optional()
  ),
  notes: z.string().optional(),
});

type BuildingFormInput = z.infer<typeof buildingSchema>;

export function CreateBuildingModal({ isOpen, onClose }: CreateBuildingModalProps) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<BuildingFormInput>({
    resolver: zodResolver(buildingSchema),
    defaultValues: {
      buildingType: "RESIDENTIAL",
    },
  });

  const createBuildingMutation = useMutation(
    trpc.createBuilding.mutationOptions({
      onSuccess: () => {
        toast.success("Building added successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getBuildings.queryKey(),
        });
        handleClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add building.");
        console.error(error);
      },
    })
  );

  const onSubmit: SubmitHandler<BuildingFormInput> = (data) => {
    if (!token) {
      toast.error("Authentication required to add building.");
      return;
    }

    createBuildingMutation.mutate({
      token,
      ...data,
      photos: uploadedPhotos,
    });
  };

  const handleClose = () => {
    reset();
    setUploadedPhotos([]);
    onClose();
  };

  const isSubmitting = createBuildingMutation.isPending;

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
                    <Building2 className="inline h-5 w-5 mr-2 text-teal-600" />
                    Add New Building
                  </Dialog.Title>
                </div>

                <form onSubmit={handleSubmit(onSubmit)} className="flex-1 overflow-y-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Column 1: Building Details */}
                    <div className="space-y-4">
                      {/* Name */}
                      <div>
                        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                          Building Name *
                        </label>
                        <input
                          type="text"
                          id="name"
                          {...register("name")}
                          placeholder="e.g., Sunset Apartments"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                        {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
                      </div>

                      {/* Address */}
                      <div>
                        <label htmlFor="address" className="block text-sm font-medium text-gray-700">
                          Address *
                        </label>
                        <input
                          type="text"
                          id="address"
                          {...register("address")}
                          placeholder="123 Main Street, City, Postal Code"
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                        {errors.address && <p className="mt-1 text-sm text-red-600">{errors.address.message}</p>}
                      </div>

                      {/* Building Type and Year Built */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="buildingType" className="block text-sm font-medium text-gray-700">
                            Building Type *
                          </label>
                          <select
                            id="buildingType"
                            {...register("buildingType")}
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          >
                            {buildingTypeOptions.map((option) => (
                              <option key={option} value={option}>
                                {option.replace(/_/g, " ")}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div>
                          <label htmlFor="yearBuilt" className="block text-sm font-medium text-gray-700">
                            Year Built
                          </label>
                          <input
                            type="number"
                            id="yearBuilt"
                            {...register("yearBuilt")}
                            placeholder="2020"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.yearBuilt && (
                            <p className="mt-1 text-sm text-red-600">{errors.yearBuilt.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Number of Units and Square Feet */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="numberOfUnits" className="block text-sm font-medium text-gray-700">
                            Number of Units
                          </label>
                          <input
                            type="number"
                            id="numberOfUnits"
                            {...register("numberOfUnits")}
                            placeholder="10"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.numberOfUnits && (
                            <p className="mt-1 text-sm text-red-600">{errors.numberOfUnits.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="totalSquareFeet" className="block text-sm font-medium text-gray-700">
                            Total Square Feet
                          </label>
                          <input
                            type="number"
                            id="totalSquareFeet"
                            step="0.01"
                            {...register("totalSquareFeet")}
                            placeholder="5000"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.totalSquareFeet && (
                            <p className="mt-1 text-sm text-red-600">{errors.totalSquareFeet.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Estimated Value and Monthly Expenses */}
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label htmlFor="estimatedValue" className="block text-sm font-medium text-gray-700">
                            Estimated Value (R)
                          </label>
                          <input
                            type="number"
                            id="estimatedValue"
                            step="0.01"
                            {...register("estimatedValue")}
                            placeholder="5000000"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.estimatedValue && (
                            <p className="mt-1 text-sm text-red-600">{errors.estimatedValue.message}</p>
                          )}
                        </div>

                        <div>
                          <label htmlFor="monthlyExpenses" className="block text-sm font-medium text-gray-700">
                            Monthly Expenses (R)
                          </label>
                          <input
                            type="number"
                            id="monthlyExpenses"
                            step="0.01"
                            {...register("monthlyExpenses")}
                            placeholder="50000"
                            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                            disabled={isSubmitting}
                          />
                          {errors.monthlyExpenses && (
                            <p className="mt-1 text-sm text-red-600">{errors.monthlyExpenses.message}</p>
                          )}
                        </div>
                      </div>

                      {/* Notes */}
                      <div>
                        <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
                          Notes
                        </label>
                        <textarea
                          id="notes"
                          rows={3}
                          {...register("notes")}
                          placeholder="Additional information about the building..."
                          className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 sm:text-sm"
                          disabled={isSubmitting}
                        />
                      </div>
                    </div>

                    {/* Column 2: Photos */}
                    <div className="space-y-4">
                      <PhotoUpload
                        onPhotosUploaded={setUploadedPhotos}
                        minimumPhotos={0}
                        title="Building Photos"
                        description="Upload photos of the property (optional)."
                        isPublic={true}
                      />
                    </div>
                  </div>
                </form>

                {/* Footer Actions */}
                <div className="flex-shrink-0 p-3 sm:p-6 border-t border-gray-200 bg-gray-50">
                  <div className="flex justify-end space-x-3">
                    <button
                      type="button"
                      onClick={handleClose}
                      className="inline-flex justify-center rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-teal-500 focus:ring-offset-2 disabled:opacity-50"
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
                          Adding...
                        </>
                      ) : (
                        <>
                          <Plus className="h-5 w-5 mr-2" />
                          Add Building
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
