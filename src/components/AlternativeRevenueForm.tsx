import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import {
  DollarSign,
  Plus,
  X,
  Check,
  Edit2,
  Loader2,
  TrendingUp,
  Receipt,
  Upload,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

const revenueSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.enum([
    "CONSULTING",
    "RENTAL_INCOME",
    "INTEREST",
    "INVESTMENTS",
    "GRANTS",
    "DONATIONS",
    "OTHER",
  ]),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  source: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPeriod: z.string().optional(),
});

type RevenueForm = z.infer<typeof revenueSchema>;

const revenueCategories = [
  { value: "CONSULTING", label: "Consulting Services" },
  { value: "RENTAL_INCOME", label: "Rental Income" },
  { value: "INTEREST", label: "Interest" },
  { value: "INVESTMENTS", label: "Investments" },
  { value: "GRANTS", label: "Grants" },
  { value: "DONATIONS", label: "Donations" },
  { value: "OTHER", label: "Other" },
];

interface AlternativeRevenueFormProps {
  onClose?: () => void;
}

export function AlternativeRevenueForm({ onClose }: AlternativeRevenueFormProps) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingRevenue, setEditingRevenue] = useState<number | null>(null);
  const [uploadingDocument, setUploadingDocument] = useState(false);
  const [documentUrl, setDocumentUrl] = useState<string>("");
  
  // Check if user can approve
  // Admin portal: Only SENIOR_ADMIN can approve
  // Contractor portal: Any CONTRACTOR role can approve (CONTRACTOR, CONTRACTOR_MANAGER, SENIOR_CONTRACTOR_MANAGER)
  const canApprove = user?.role === "SENIOR_ADMIN" || 
                      user?.role?.includes("CONTRACTOR") || 
                      false;

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<RevenueForm>({
    resolver: zodResolver(revenueSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
    },
  });

  const isRecurring = watch("isRecurring");

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const revenuesQuery = useQuery(
    trpc.getAlternativeRevenues.queryOptions({
      token: token!,
    })
  );

  const createRevenueMutation = useMutation(
    trpc.createAlternativeRevenue.mutationOptions({
      onSuccess: () => {
        toast.success("Alternative revenue added successfully!");
        queryClient.invalidateQueries({ queryKey: ["getAlternativeRevenues"] });
        reset();
        setDocumentUrl("");
        setShowForm(false);
        if (onClose) onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add revenue");
      },
    })
  );

  const updateRevenueMutation = useMutation(
    trpc.updateAlternativeRevenue.mutationOptions({
      onSuccess: () => {
        toast.success("Revenue updated successfully!");
        queryClient.invalidateQueries({ queryKey: ["getAlternativeRevenues"] });
        setEditingRevenue(null);
        reset();
        setDocumentUrl("");
        setShowForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update revenue");
      },
    })
  );

  const approveRevenueMutation = useMutation(
    trpc.approveAlternativeRevenue.mutationOptions({
      onSuccess: () => {
        toast.success("Revenue approval updated!");
        queryClient.invalidateQueries({ queryKey: ["getAlternativeRevenues"] });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update approval status");
      },
    })
  );

  const onSubmit = (data: RevenueForm) => {
    if (editingRevenue) {
      updateRevenueMutation.mutate({
        token: token!,
        id: editingRevenue,
        ...data,
      });
    } else {
      createRevenueMutation.mutate({
        token: token!,
        ...data,
      });
    }
  };

  const handleEdit = (revenue: any) => {
    setEditingRevenue(revenue.id);
    setDocumentUrl(revenue.documentUrl || "");
    reset({
      date: new Date(revenue.date).toISOString().split("T")[0],
      category: revenue.category,
      description: revenue.description,
      amount: revenue.amount,
      source: revenue.source || "",
      referenceNumber: revenue.referenceNumber || "",
      notes: revenue.notes || "",
      documentUrl: revenue.documentUrl || "",
      isRecurring: revenue.isRecurring,
      recurringPeriod: revenue.recurringPeriod || "",
    });
    setShowForm(true);
  };

  const handleApprove = (id: number, approve: boolean) => {
    approveRevenueMutation.mutate({
      token: token!,
      id,
      isApproved: approve,
    });
  };

  const revenues = revenuesQuery.data || [];
  const totalRevenue = revenues.reduce((sum, rev) => sum + rev.amount, 0);
  const approvedRevenues = revenues.filter((rev) => rev.isApproved);
  const pendingRevenues = revenues.filter((rev) => !rev.isApproved);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <TrendingUp className="h-6 w-6 text-green-600" />
            Alternative Revenue
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track income not from regular invoices
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingRevenue(null);
            reset();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Revenue"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Revenue</p>
          <p className="text-2xl font-bold text-gray-900">R {totalRevenue.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Approved</p>
          <p className="text-2xl font-bold text-green-900">{approvedRevenues.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-yellow-600">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-900">{pendingRevenues.length}</p>
        </div>
      </div>

      {/* Approval Info Message */}
      {!canApprove && pendingRevenues.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Pending Senior Approval</p>
              <p className="text-sm text-blue-700 mt-1">
                You have {pendingRevenues.length} revenue item{pendingRevenues.length !== 1 ? 's' : ''} pending approval. 
                Only <span className="font-semibold">Senior Admin</span> can approve or reject revenue.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Current role: <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">{user?.role || 'Unknown'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {canApprove && pendingRevenues.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">You can approve revenue</p>
              <p className="text-sm text-green-700 mt-1">
                As a {user?.role}, you can approve or reject the {pendingRevenues.length} pending revenue item{pendingRevenues.length !== 1 ? 's' : ''} below.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      {showForm && (
        <form onSubmit={handleSubmit(onSubmit)} className="bg-gray-50 rounded-lg p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Date *
              </label>
              <input
                type="date"
                {...register("date")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              />
              {errors.date && (
                <p className="text-sm text-red-600 mt-1">{errors.date.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Category *
              </label>
              <select
                {...register("category")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {revenueCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>
                    {cat.label}
                  </option>
                ))}
              </select>
              {errors.category && (
                <p className="text-sm text-red-600 mt-1">{errors.category.message}</p>
              )}
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <textarea
                {...register("description")}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Enter revenue description..."
              />
              {errors.description && (
                <p className="text-sm text-red-600 mt-1">{errors.description.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount (R) *
              </label>
              <input
                type="number"
                step="0.01"
                {...register("amount", { valueAsNumber: true })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Source
              </label>
              <input
                type="text"
                {...register("source")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Revenue source"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference Number
              </label>
              <input
                type="text"
                {...register("referenceNumber")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Transaction #"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("isRecurring")}
                  className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                />
                <span className="text-sm font-medium text-gray-700">Recurring Revenue</span>
              </label>
            </div>

            {isRecurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recurring Period
                </label>
                <select
                  {...register("recurringPeriod")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                >
                  <option value="">Select period</option>
                  <option value="MONTHLY">Monthly</option>
                  <option value="QUARTERLY">Quarterly</option>
                  <option value="ANNUALLY">Annually</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Notes
              </label>
              <textarea
                {...register("notes")}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="Additional notes..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Supporting Document (Optional)
              </label>
              <div className="space-y-3">
                {documentUrl ? (
                  <div className="flex items-center justify-between p-3 bg-green-50 border border-green-200 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Receipt className="h-5 w-5 text-green-600" />
                      <span className="text-sm text-green-700">Document uploaded</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={documentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <ExternalLink className="h-4 w-4" />
                        View
                      </a>
                      <button
                        type="button"
                        onClick={() => {
                          setDocumentUrl("");
                          setValue("documentUrl", "");
                        }}
                        className="text-red-600 hover:text-red-700 text-sm"
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <input
                      type="file"
                      accept="image/*,.pdf"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;

                        setUploadingDocument(true);
                        try {
                          const { presignedUrl, fileUrl } =
                            await getPresignedUrlMutation.mutateAsync({
                              token: token!,
                              fileName: file.name,
                              fileType: file.type,
                            });

                          await fetch(presignedUrl, {
                            method: "PUT",
                            body: file,
                            headers: {
                              "Content-Type": file.type,
                            },
                          });

                          setDocumentUrl(fileUrl);
                          setValue("documentUrl", fileUrl);
                          toast.success("Document uploaded successfully!");
                        } catch (error) {
                          toast.error("Failed to upload document");
                        } finally {
                          setUploadingDocument(false);
                        }
                      }}
                      disabled={uploadingDocument}
                      className="flex-1 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-green-50 file:text-green-700 hover:file:bg-green-100 disabled:opacity-50"
                    />
                    {uploadingDocument && (
                      <Loader2 className="h-5 w-5 animate-spin text-green-600" />
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Upload supporting documentation (optional, max 10MB)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingRevenue(null);
                setDocumentUrl("");
                reset();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createRevenueMutation.isPending || updateRevenueMutation.isPending}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
            >
              {(createRevenueMutation.isPending || updateRevenueMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingRevenue ? "Update" : "Add"} Revenue
            </button>
          </div>
        </form>
      )}

      {/* Revenue List */}
      <div className="space-y-3">
        {revenuesQuery.isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : revenues.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No alternative revenue recorded yet
          </div>
        ) : (
          revenues.map((revenue) => (
            <div
              key={revenue.id}
              className={`bg-white border-2 rounded-lg p-4 ${
                revenue.isApproved ? "border-green-200" : "border-yellow-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{revenue.description}</h4>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        revenue.isApproved
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {revenue.isApproved ? "Approved" : "Pending"}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {revenueCategories.find((c) => c.value === revenue.category)?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="ml-2 font-semibold text-green-600">
                        R {revenue.amount.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Date:</span>
                      <span className="ml-2 text-gray-900">
                        {new Date(revenue.date).toLocaleDateString()}
                      </span>
                    </div>
                    {revenue.source && (
                      <div>
                        <span className="text-gray-600">Source:</span>
                        <span className="ml-2 text-gray-900">{revenue.source}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">By:</span>
                      <span className="ml-2 text-gray-900">
                        {revenue.createdBy.firstName} {revenue.createdBy.lastName}
                      </span>
                    </div>
                  </div>
                  {revenue.notes && (
                    <p className="text-sm text-gray-600 mt-2">{revenue.notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {!revenue.isApproved && (
                    <>
                      {/* Only creator or senior users can edit */}
                      {(revenue.createdById === user?.id || canApprove) && (
                        <button
                          onClick={() => handleEdit(revenue)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                          title="Edit"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                      )}
                      {/* Only senior users can approve/reject */}
                      {canApprove && (
                        <>
                          <button
                            onClick={() => handleApprove(revenue.id, true)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                            disabled={approveRevenueMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleApprove(revenue.id, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                            disabled={approveRevenueMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {/* Senior users can edit approved revenue */}
                  {revenue.isApproved && canApprove && (
                    <button
                      onClick={() => handleEdit(revenue)}
                      className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
