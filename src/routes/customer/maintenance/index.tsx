import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { SignedMinioImage } from "~/components/SignedMinioUrl";
import {
  Plus,
  Send,
  FileText,
  AlertCircle,
  CheckCircle2,
  Clock,
  User,
  Mail,
  Phone,
  Building2,
  Zap,
  AlertTriangle,
  Eye,
  EyeOff,
  Trash2,
  Edit2,
  ArrowLeft,
  Image,
  Upload,
  X,
} from "lucide-react";

export const Route = createFileRoute("/customer/maintenance/")({
  component: CustomerMaintenancePage,
});

const maintenanceRequestSchema = z.object({
  title: z.string().min(5, "Title is required"),
  description: z.string().min(20, "Description must be at least 20 characters"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  category: z.string().min(2, "Category is required"),
  recipientType: z.enum(["PM", "CONTRACTOR"]).default("PM"),
  contractorId: z.string().optional(),
  buildingName: z.string().optional(),
});

type MaintenanceFormData = z.infer<typeof maintenanceRequestSchema>;

const categoryOptions = [
  { value: "PLUMBING", label: "Plumbing" },
  { value: "ELECTRICAL", label: "Electrical" },
  { value: "HVAC", label: "HVAC/Cooling" },
  { value: "PAINTING", label: "Painting" },
  { value: "CARPENTRY", label: "Carpentry" },
  { value: "APPLIANCES", label: "Appliances" },
  { value: "FLOORING", label: "Flooring" },
  { value: "SECURITY", label: "Security/Locks" },
  { value: "PEST", label: "Pest Control" },
  { value: "GENERAL", label: "General Maintenance" },
  { value: "OTHER", label: "Other" },
];

const urgencyOptions = [
  { value: "LOW", label: "Low (Non-urgent)", icon: Clock },
  { value: "NORMAL", label: "Normal (Standard)", icon: FileText },
  { value: "HIGH", label: "High (Soon)", icon: AlertTriangle },
  { value: "URGENT", label: "Urgent (ASAP)", icon: AlertCircle },
];

function CustomerMaintenancePage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"list" | "form" | "detail">("list");
  const [selectedRequest, setSelectedRequest] = useState<any | null>(null);
  const [recipientType, setRecipientType] = useState<"PM" | "CONTRACTOR">("PM");
  const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
  const [isUploadingPhotos, setIsUploadingPhotos] = useState(false);

  // Get presigned URL mutation
  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  // Fetch maintenance requests
  const requestsQuery = useQuery({
    queryKey: ["getCustomerMaintenanceRequests"],
    queryFn: async () => {
      if (!token || !user?.id) return [];
      // Placeholder - will call tRPC procedure
      return [];
    },
    enabled: !!token && !!user?.id,
  });

  // Fetch contractors for direct submission
  const contractorsQuery = useQuery({
    queryKey: ["getContractorsForCustomer"],
    queryFn: async () => {
      if (!token) return [];
      try {
        const result = await trpc.getContractors.query({ token });
        return result.contractors || [];
      } catch {
        return [];
      }
    },
    enabled: !!token && recipientType === "CONTRACTOR",
  });

  // Submit maintenance request
  const submitRequestMutation = useMutation(
    trpc.submitMaintenanceRequest.mutationOptions({
      onSuccess: () => {
        toast.success("Maintenance request submitted successfully!");
        setView("list");
        setUploadedPhotos([]);
        form.reset();
        queryClient.invalidateQueries({ queryKey: ["getCustomerMaintenanceRequests"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to submit maintenance request");
      },
    })
  );

  const form = useForm<MaintenanceFormData>({
    resolver: zodResolver(maintenanceRequestSchema),
    defaultValues: {
      urgency: "NORMAL",
      category: "GENERAL",
      recipientType: "PM",
    },
  });

  const handleSubmit = form.handleSubmit((data) => {
    if (!token || !user?.id) {
      toast.error("Not authenticated");
      return;
    }

    submitRequestMutation.mutate({
      token,
      title: data.title,
      description: data.description,
      category: data.category,
      urgency: data.urgency,
      recipientType: data.recipientType as "PM" | "CONTRACTOR",
      contractorId: data.contractorId ? parseInt(data.contractorId) : undefined,
      buildingName: data.buildingName,
      customerId: user.id,
      photos: uploadedPhotos,
    });
  });

  const requests = requestsQuery.data || [];
  const draftRequests = requests.filter((r: any) => r.status === "DRAFT");
  const submittedRequests = requests.filter((r: any) => r.status === "SUBMITTED");
  const approvedRequests = requests.filter((r: any) => r.status === "APPROVED");
  const rejectedRequests = requests.filter((r: any) => r.status === "REJECTED");

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center">
            <Zap className="h-8 w-8 mr-3 text-orange-600" />
            Maintenance Requests
          </h1>
          <p className="text-gray-600 mt-2">
            Submit and track maintenance requests to your property manager or contractors
          </p>
        </div>

        {/* List View */}
        {view === "list" && (
          <div className="space-y-6">
            {/* Submit New Request Button */}
            <button
              onClick={() => setView("form")}
              className="inline-flex items-center px-6 py-3 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors shadow-md"
            >
              <Plus className="h-5 w-5 mr-2" />
              Submit New Request
            </button>

            {/* Status Overview Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Draft</p>
                    <p className="text-2xl font-bold text-gray-900">{draftRequests.length}</p>
                  </div>
                  <FileText className="h-8 w-8 text-gray-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Submitted</p>
                    <p className="text-2xl font-bold text-gray-900">{submittedRequests.length}</p>
                  </div>
                  <Clock className="h-8 w-8 text-blue-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Approved</p>
                    <p className="text-2xl font-bold text-gray-900">{approvedRequests.length}</p>
                  </div>
                  <CheckCircle2 className="h-8 w-8 text-green-400" />
                </div>
              </div>

              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Rejected</p>
                    <p className="text-2xl font-bold text-gray-900">{rejectedRequests.length}</p>
                  </div>
                  <AlertCircle className="h-8 w-8 text-red-400" />
                </div>
              </div>
            </div>

            {/* Requests Tabs */}
            <div className="space-y-6">
              {/* Draft Requests */}
              {draftRequests.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                    <h3 className="font-semibold text-gray-900">Draft Requests</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {draftRequests.map((request: any) => (
                      <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-gray-900">{request.title}</h4>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <span className="flex items-center text-gray-700">
                                <span className={`w-2 h-2 rounded-full mr-2 ${
                                  request.urgency === "URGENT" ? "bg-red-600" :
                                  request.urgency === "HIGH" ? "bg-orange-600" :
                                  request.urgency === "NORMAL" ? "bg-blue-600" :
                                  "bg-gray-400"
                                }`} />
                                {request.urgency}
                              </span>
                              <span className="text-gray-600">{request.category}</span>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <button
                              onClick={() => {
                                setSelectedRequest(request);
                                setView("form");
                              }}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Submitted Requests */}
              {submittedRequests.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-blue-50 px-6 py-4 border-b border-blue-200">
                    <h3 className="font-semibold text-blue-900">Submitted Requests (Pending Approval)</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {submittedRequests.map((request: any) => (
                      <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => {
                        setSelectedRequest(request);
                        setView("detail");
                      }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-gray-900">{request.title}</h4>
                              <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded">
                                {request.requestNumber}
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <span className="text-gray-600">Sent to: {request.recipientType === "PM" ? "Property Manager" : "Contractor"}</span>
                              <span className="text-gray-600">Submitted: {new Date(request.submittedDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Eye className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Approved Requests */}
              {approvedRequests.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-green-50 px-6 py-4 border-b border-green-200">
                    <h3 className="font-semibold text-green-900">Approved Requests</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {approvedRequests.map((request: any) => (
                      <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => {
                        setSelectedRequest(request);
                        setView("detail");
                      }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-gray-900">{request.title}</h4>
                              <span className="px-2 py-1 bg-green-100 text-green-800 text-xs font-medium rounded">
                                APPROVED
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                            <div className="flex gap-4 mt-3 text-sm">
                              <span className="text-gray-600">Approved: {new Date(request.approvedDate).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <Eye className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Rejected Requests */}
              {rejectedRequests.length > 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                  <div className="bg-red-50 px-6 py-4 border-b border-red-200">
                    <h3 className="font-semibold text-red-900">Rejected Requests</h3>
                  </div>
                  <div className="divide-y divide-gray-200">
                    {rejectedRequests.map((request: any) => (
                      <div key={request.id} className="p-6 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => {
                        setSelectedRequest(request);
                        setView("detail");
                      }}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <h4 className="font-semibold text-gray-900">{request.title}</h4>
                              <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded">
                                REJECTED
                              </span>
                            </div>
                            <p className="text-sm text-gray-600 mt-1">{request.description}</p>
                            {request.rejectionReason && (
                              <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                                <p className="text-sm text-red-900">
                                  <strong>Rejection Reason:</strong> {request.rejectionReason}
                                </p>
                              </div>
                            )}
                          </div>
                          <Eye className="h-5 w-5 text-gray-400" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {requests.length === 0 && (
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-12 text-center">
                  <Zap className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">No Maintenance Requests Yet</h3>
                  <p className="text-gray-600 mb-6">
                    Submit your first maintenance request to get started
                  </p>
                  <button
                    onClick={() => setView("form")}
                    className="inline-flex items-center px-6 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-medium transition-colors"
                  >
                    <Plus className="h-5 w-5 mr-2" />
                    Submit Request
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Form View */}
        {view === "form" && (
          <div className="space-y-6">
            <button
              onClick={() => {
                setView("list");
                setSelectedRequest(null);
                setUploadedPhotos([]);
                form.reset();
              }}
              className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedRequest ? "Edit Maintenance Request" : "Submit New Maintenance Request"}
              </h2>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Recipient Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Send Request To *
                  </label>
                  <div className="grid grid-cols-2 gap-4">
                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setRecipientType("PM")}>
                      <input
                        type="radio"
                        {...form.register("recipientType")}
                        value="PM"
                        checked={form.watch("recipientType") === "PM"}
                        className="h-4 w-4 text-teal-600"
                      />
                      <span className="ml-3">
                        <span className="block text-sm font-medium text-gray-900">Property Manager</span>
                        <span className="text-xs text-gray-600">They will review and assign contractor</span>
                      </span>
                    </label>

                    <label className="flex items-center p-4 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setRecipientType("CONTRACTOR")}>
                      <input
                        type="radio"
                        {...form.register("recipientType")}
                        value="CONTRACTOR"
                        checked={form.watch("recipientType") === "CONTRACTOR"}
                        className="h-4 w-4 text-teal-600"
                      />
                      <span className="ml-3">
                        <span className="block text-sm font-medium text-gray-900">Direct to Contractor</span>
                        <span className="text-xs text-gray-600">Send directly to a contractor</span>
                      </span>
                    </label>
                  </div>
                </div>

                {/* Contractor Selection */}
                {form.watch("recipientType") === "CONTRACTOR" && (
                  <div>
                    <label htmlFor="contractorId" className="block text-sm font-medium text-gray-700 mb-2">
                      Select Contractor *
                    </label>
                    <select
                      {...form.register("contractorId")}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    >
                      <option value="">Choose a contractor...</option>
                      {contractorsQuery.data?.map((contractor: any) => (
                        <option key={contractor.id} value={contractor.id}>
                          {contractor.companyName}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-2">
                    Request Title *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Leaking Kitchen Faucet"
                    {...form.register("title")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                  {form.formState.errors.title && (
                    <p className="text-red-600 text-sm mt-1">{form.formState.errors.title.message}</p>
                  )}
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    placeholder="Provide detailed description of the issue..."
                    {...form.register("description")}
                    rows={5}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent font-mono text-sm"
                  />
                  {form.formState.errors.description && (
                    <p className="text-red-600 text-sm mt-1">{form.formState.errors.description.message}</p>
                  )}
                </div>

                {/* Category */}
                <div>
                  <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-2">
                    Category *
                  </label>
                  <select
                    {...form.register("category")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  >
                    <option value="">Select a category...</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  {form.formState.errors.category && (
                    <p className="text-red-600 text-sm mt-1">{form.formState.errors.category.message}</p>
                  )}
                </div>

                {/* Urgency */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">
                    Urgency Level *
                  </label>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {urgencyOptions.map((option) => (
                      <label key={option.value} className="flex items-center p-3 border border-gray-200 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors">
                        <input
                          type="radio"
                          {...form.register("urgency")}
                          value={option.value}
                          className="h-4 w-4 text-teal-600"
                        />
                        <span className="ml-2 text-sm font-medium text-gray-900">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Building Name (Optional) */}
                <div>
                  <label htmlFor="buildingName" className="block text-sm font-medium text-gray-700 mb-2">
                    Building/Unit (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Unit 4B"
                    {...form.register("buildingName")}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                  />
                </div>

                {/* Photo Upload */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Image className="h-4 w-4 inline mr-2" />
                    Photos (Optional)
                  </label>
                  <p className="text-xs text-gray-600 mb-3">
                    Upload photos to help illustrate the maintenance issue
                  </p>
                  
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:border-teal-500 transition-colors">
                    <input
                      type="file"
                      id="photo-upload"
                      accept="image/*"
                      multiple
                      onChange={async (e) => {
                        const files = e.target.files;
                        if (!files || !token) return;

                        setIsUploadingPhotos(true);
                        
                        try {
                          const uploadedUrls: string[] = [];
                          
                          for (const file of Array.from(files)) {
                            // Get presigned upload URL from tRPC
                            const result = await getPresignedUrlMutation.mutateAsync({
                              token,
                              fileName: file.name,
                              fileType: file.type,
                            });

                            // Upload to MinIO
                            await fetch(result.uploadUrl, {
                              method: "PUT",
                              body: file,
                              headers: {
                                "Content-Type": file.type,
                              },
                            });

                            uploadedUrls.push(result.fileUrl);
                          }

                          setUploadedPhotos([...uploadedPhotos, ...uploadedUrls]);
                          toast.success(`${files.length} photo(s) uploaded successfully`);
                        } catch (error: any) {
                          toast.error(error.message || "Failed to upload photos");
                        } finally {
                          setIsUploadingPhotos(false);
                          e.target.value = "";
                        }
                      }}
                      className="hidden"
                    />
                    <label
                      htmlFor="photo-upload"
                      className="flex flex-col items-center justify-center cursor-pointer"
                    >
                      <Upload className="h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-sm font-medium text-gray-700 mb-1">
                        Click to upload photos
                      </p>
                      <p className="text-xs text-gray-500">
                        PNG, JPG up to 10MB each
                      </p>
                    </label>
                  </div>

                  {/* Uploaded Photos Preview */}
                  {uploadedPhotos.length > 0 && (
                    <div className="mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                      {uploadedPhotos.map((photoUrl, index) => (
                        <div key={index} className="relative group">
                          <SignedMinioImage
                            url={photoUrl}
                            alt={`Maintenance photo ${index + 1}`}
                            className="w-full h-24 object-cover rounded-lg border border-gray-200"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setUploadedPhotos(uploadedPhotos.filter((_, i) => i !== index));
                              toast.success("Photo removed");
                            }}
                            className="absolute top-1 right-1 bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {isUploadingPhotos && (
                    <div className="mt-3 flex items-center justify-center text-teal-600">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-teal-600 mr-2"></div>
                      <span className="text-sm">Uploading photos...</span>
                    </div>
                  )}
                </div>

                {/* Submit Button */}
                <div className="flex gap-4 pt-4 border-t border-gray-200">
                  <button
                    type="submit"
                    disabled={submitRequestMutation.isPending}
                    className="flex-1 px-6 py-3 bg-teal-600 hover:bg-teal-700 disabled:bg-gray-400 text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
                  >
                    <Send className="h-5 w-5" />
                    {submitRequestMutation.isPending ? "Submitting..." : "Submit Request"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setView("list");
                      setSelectedRequest(null);
                      setUploadedPhotos([]);
                      form.reset();
                    }}
                    className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Detail View */}
        {view === "detail" && selectedRequest && (
          <div className="space-y-6">
            <button
              onClick={() => {
                setView("list");
                setSelectedRequest(null);
              }}
              className="inline-flex items-center text-teal-600 hover:text-teal-700 font-medium transition-colors"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to List
            </button>

            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 space-y-6">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">{selectedRequest.title}</h2>
                  <p className="text-sm text-gray-600 mt-1">{selectedRequest.requestNumber}</p>
                </div>
                <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                  selectedRequest.status === "APPROVED" ? "bg-green-100 text-green-800" :
                  selectedRequest.status === "REJECTED" ? "bg-red-100 text-red-800" :
                  selectedRequest.status === "SUBMITTED" ? "bg-blue-100 text-blue-800" :
                  "bg-gray-100 text-gray-800"
                }`}>
                  {selectedRequest.status}
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Urgency</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{selectedRequest.urgency}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Category</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">{selectedRequest.category}</p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Sent To</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {selectedRequest.recipientType === "PM" ? "Property Manager" : "Contractor"}
                  </p>
                </div>
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs text-gray-600 uppercase tracking-wide">Submitted</p>
                  <p className="text-lg font-semibold text-gray-900 mt-1">
                    {new Date(selectedRequest.submittedDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Description</h3>
                <p className="text-gray-700 whitespace-pre-wrap">{selectedRequest.description}</p>
              </div>

              {selectedRequest.approvalNotes && (
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-blue-900 mb-1">Approval Notes</h4>
                  <p className="text-sm text-blue-800">{selectedRequest.approvalNotes}</p>
                </div>
              )}

              {selectedRequest.rejectionReason && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                  <h4 className="text-sm font-semibold text-red-900 mb-1">Rejection Reason</h4>
                  <p className="text-sm text-red-800">{selectedRequest.rejectionReason}</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
