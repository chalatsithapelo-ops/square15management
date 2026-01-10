import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import {
  Building2,
  User,
  Mail,
  Phone,
  DollarSign,
  Calendar,
  Zap,
  Droplet,
  Flame,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
} from "lucide-react";

export const Route = createFileRoute("/customer/onboarding/")({
  component: CustomerOnboardingPage,
});

const onboardingSchema = z.object({
  propertyManagerId: z.number().min(1, "Property Manager is required"),
  buildingId: z.number().min(1, "Building selection is required"),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Valid email is required"),
  phoneNumber: z.string().min(10, "Valid phone number is required"),
  leaseStartDate: z.string().optional(),
  monthlyRent: z.string().optional(),
  securityDeposit: z.string().optional(),
  electricityMeterNumber: z.string().optional(),
  waterMeterNumber: z.string().optional(),
  gasMeterNumber: z.string().optional(),
});

type OnboardingFormData = z.infer<typeof onboardingSchema>;

function CustomerOnboardingPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [propertyManagerId, setPropertyManagerId] = useState<number | null>(null);

  // Fetch buildings for selected PM
  const buildingsQuery = useQuery({
    queryKey: ["getBuildingsForOnboarding", propertyManagerId],
    queryFn: async () => {
      if (!token || !propertyManagerId) return [];
      const result = await trpc.getBuildingsForOnboarding.query({
        token,
        propertyManagerId: propertyManagerId,
      });
      return result || [];
    },
    enabled: !!token && !!propertyManagerId,
  });

  // Fetch existing onboarding status
  const onboardingStatusQuery = useQuery({
    queryKey: ["getCustomerOnboardingStatus"],
    queryFn: async () => {
      if (!token || !user?.id) return null;
      // Placeholder - will fetch customer's onboarding status
      // For now, returning null (no existing onboarding)
      return null;
    },
    enabled: !!token && !!user?.id,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<OnboardingFormData>({
    resolver: zodResolver(onboardingSchema),
    defaultValues: {
      firstName: user?.name?.split(" ")[0] || "",
      lastName: user?.name?.split(" ")[1] || "",
      email: user?.email || "",
    },
  });

  const submitOnboardingMutation = useMutation({
    mutationFn: async (data: OnboardingFormData) => {
      if (!token) throw new Error("Not authenticated");
      const result = await trpc.submitTenantOnboarding.mutate({
        token,
        propertyManagerId: data.propertyManagerId,
        buildingId: data.buildingId,
        firstName: data.firstName,
        lastName: data.lastName,
        email: data.email,
        phoneNumber: data.phoneNumber,
        leaseStartDate: data.leaseStartDate || undefined,
        monthlyRent: data.monthlyRent ? parseFloat(data.monthlyRent) : undefined,
        securityDeposit: data.securityDeposit ? parseFloat(data.securityDeposit) : undefined,
        electricityMeterNumber: data.electricityMeterNumber,
        waterMeterNumber: data.waterMeterNumber,
        gasMeterNumber: data.gasMeterNumber,
      });
      return result;
    },
    onSuccess: (result) => {
      toast.success(result.message || "Onboarding request submitted successfully!");
      queryClient.invalidateQueries({ queryKey: ["getCustomerOnboardingStatus"] });
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to submit onboarding request");
    },
  });

  const onSubmit = (data: OnboardingFormData) => {
    submitOnboardingMutation.mutate(data);
  };

  const buildingId = watch("buildingId");
  const selectedBuilding = buildingsQuery.data?.find((b: any) => b.id === buildingId);

  // If already onboarded, show status
  if (onboardingStatusQuery.data) {
    const status = onboardingStatusQuery.data;
    return (
      <div className="p-6">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-md p-8">
            <div className="text-center mb-8">
              {status.onboardingStatus === "PENDING" && (
                <div className="flex flex-col items-center">
                  <Clock className="h-16 w-16 text-yellow-500 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Onboarding Pending
                  </h2>
                  <p className="text-gray-600">
                    Your onboarding request is currently under review by the Property Manager.
                  </p>
                </div>
              )}
              {status.onboardingStatus === "APPROVED" && (
                <div className="flex flex-col items-center">
                  <CheckCircle2 className="h-16 w-16 text-green-500 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Onboarding Approved
                  </h2>
                  <p className="text-gray-600">
                    Welcome! You have been approved and can now access all tenant services.
                  </p>
                </div>
              )}
              {status.onboardingStatus === "REJECTED" && (
                <div className="flex flex-col items-center">
                  <XCircle className="h-16 w-16 text-red-500 mb-4" />
                  <h2 className="text-2xl font-bold text-gray-900 mb-2">
                    Onboarding Rejected
                  </h2>
                  <p className="text-gray-600 mb-4">
                    Your onboarding request was not approved.
                  </p>
                  {status.rejectionReason && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-left">
                      <p className="text-sm font-medium text-red-800">Reason:</p>
                      <p className="text-sm text-red-700 mt-1">{status.rejectionReason}</p>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            <div className="bg-gray-50 rounded-lg p-6 space-y-3">
              <h3 className="font-semibold text-gray-900 mb-3">Your Information</h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">Name:</span>
                  <p className="font-medium">{status.firstName} {status.lastName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Email:</span>
                  <p className="font-medium">{status.email}</p>
                </div>
                <div>
                  <span className="text-gray-600">Phone:</span>
                  <p className="font-medium">{status.phoneNumber}</p>
                </div>
                <div>
                  <span className="text-gray-600">Building:</span>
                  <p className="font-medium">{status.building?.name || "N/A"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-md p-8">
          <div className="mb-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Tenant Onboarding
            </h1>
            <p className="text-gray-600">
              Complete this form to request access to your property management portal.
              Your request will be reviewed by the Property Manager.
            </p>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
            {/* Personal Information */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <User className="h-5 w-5 mr-2" />
                Personal Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    First Name *
                  </label>
                  <input
                    type="text"
                    {...register("firstName")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="John"
                  />
                  {errors.firstName && (
                    <p className="mt-1 text-sm text-red-600">{errors.firstName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    {...register("lastName")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Doe"
                  />
                  {errors.lastName && (
                    <p className="mt-1 text-sm text-red-600">{errors.lastName.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address *
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="email"
                      {...register("email")}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="john@example.com"
                    />
                  </div>
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number *
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="tel"
                      {...register("phoneNumber")}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="+27 123 456 789"
                    />
                  </div>
                  {errors.phoneNumber && (
                    <p className="mt-1 text-sm text-red-600">{errors.phoneNumber.message}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Property Manager & Building Selection */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Building2 className="h-5 w-5 mr-2" />
                Property Information
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Property Manager ID *
                  </label>
                  <input
                    type="number"
                    {...register("propertyManagerId", { valueAsNumber: true })}
                    onChange={(e) => {
                      const value = parseInt(e.target.value);
                      if (value) {
                        setPropertyManagerId(value);
                        setValue("propertyManagerId", value);
                      }
                    }}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter PM ID"
                  />
                  {errors.propertyManagerId && (
                    <p className="mt-1 text-sm text-red-600">{errors.propertyManagerId.message}</p>
                  )}
                  <p className="mt-1 text-xs text-gray-500">
                    Contact your property manager for this ID
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Building *
                  </label>
                  <select
                    {...register("buildingId", { valueAsNumber: true })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    disabled={!propertyManagerId || buildingsQuery.isLoading}
                  >
                    <option value="">Select a building</option>
                    {buildingsQuery.data?.map((building: any) => (
                      <option key={building.id} value={building.id}>
                        {building.name} - {building.address}
                      </option>
                    ))}
                  </select>
                  {errors.buildingId && (
                    <p className="mt-1 text-sm text-red-600">{errors.buildingId.message}</p>
                  )}
                  {buildingsQuery.isLoading && (
                    <p className="mt-1 text-xs text-gray-500">Loading buildings...</p>
                  )}
                </div>
              </div>

              {selectedBuilding && (
                <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <p className="text-sm font-medium text-blue-900">Selected Building:</p>
                  <p className="text-sm text-blue-700 mt-1">
                    {selectedBuilding.name} - {selectedBuilding.address}, {selectedBuilding.city}, {selectedBuilding.state} {selectedBuilding.zipCode}
                  </p>
                </div>
              )}
            </div>

            {/* Lease Information (Optional) */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Calendar className="h-5 w-5 mr-2" />
                Lease Information (Optional)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Lease Start Date
                  </label>
                  <input
                    type="date"
                    {...register("leaseStartDate")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Monthly Rent
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      {...register("monthlyRent")}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Security Deposit
                  </label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-3 h-5 w-5 text-gray-400" />
                    <input
                      type="number"
                      step="0.01"
                      {...register("securityDeposit")}
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0.00"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Utility Meters (Optional) */}
            <div>
              <h2 className="text-xl font-semibold text-gray-900 mb-4 flex items-center">
                <Zap className="h-5 w-5 mr-2" />
                Utility Meters (Optional)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Zap className="inline h-4 w-4 mr-1" />
                    Electricity Meter #
                  </label>
                  <input
                    type="text"
                    {...register("electricityMeterNumber")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter meter number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Droplet className="inline h-4 w-4 mr-1" />
                    Water Meter #
                  </label>
                  <input
                    type="text"
                    {...register("waterMeterNumber")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter meter number"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Flame className="inline h-4 w-4 mr-1" />
                    Gas Meter #
                  </label>
                  <input
                    type="text"
                    {...register("gasMeterNumber")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter meter number"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex items-center justify-between pt-6 border-t">
              <div className="flex items-center text-sm text-gray-600">
                <AlertCircle className="h-4 w-4 mr-2" />
                <span>* Required fields</span>
              </div>
              <button
                type="submit"
                disabled={submitOnboardingMutation.isPending}
                className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {submitOnboardingMutation.isPending ? "Submitting..." : "Submit Onboarding Request"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
