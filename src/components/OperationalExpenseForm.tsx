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
  Trash2,
  Calendar,
  FileText,
  Loader2,
  Receipt,
  Upload,
  ExternalLink,
  AlertCircle,
} from "lucide-react";

const expenseSchema = z.object({
  date: z.string().min(1, "Date is required"),
  category: z.enum([
    "PETROL",
    "OFFICE_SUPPLIES",
    "RENT",
    "UTILITIES",
    "INSURANCE",
    "SALARIES",
    "MARKETING",
    "MAINTENANCE",
    "TRAVEL",
    "PROFESSIONAL_FEES",
    "TELECOMMUNICATIONS",
    "SOFTWARE_SUBSCRIPTIONS",
    "OTHER",
  ]),
  description: z.string().min(1, "Description is required"),
  amount: z.number().positive("Amount must be positive"),
  vendor: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
  documentUrl: z.string().optional(),
  isRecurring: z.boolean().default(false),
  recurringPeriod: z.string().optional(),
});

type ExpenseForm = z.infer<typeof expenseSchema>;

const expenseCategories = [
  { value: "PETROL", label: "Petrol/Fuel" },
  { value: "OFFICE_SUPPLIES", label: "Office Supplies/Stationery" },
  { value: "RENT", label: "Rent" },
  { value: "UTILITIES", label: "Utilities" },
  { value: "INSURANCE", label: "Insurance" },
  { value: "SALARIES", label: "Salaries" },
  { value: "MARKETING", label: "Marketing" },
  { value: "MAINTENANCE", label: "Maintenance" },
  { value: "TRAVEL", label: "Travel" },
  { value: "PROFESSIONAL_FEES", label: "Professional Fees" },
  { value: "TELECOMMUNICATIONS", label: "Telecommunications" },
  { value: "SOFTWARE_SUBSCRIPTIONS", label: "Software Subscriptions" },
  { value: "OTHER", label: "Other" },
];

interface OperationalExpenseFormProps {
  onClose?: () => void;
}

export function OperationalExpenseForm({ onClose }: OperationalExpenseFormProps) {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editingExpense, setEditingExpense] = useState<number | null>(null);
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
  } = useForm<ExpenseForm>({
    resolver: zodResolver(expenseSchema),
    defaultValues: {
      date: new Date().toISOString().split("T")[0],
      isRecurring: false,
    },
  });

  const isRecurring = watch("isRecurring");

  const getPresignedUrlMutation = useMutation(
    trpc.getPresignedUploadUrl.mutationOptions()
  );

  const expensesQuery = useQuery(
    trpc.getOperationalExpenses.queryOptions({
      token: token!,
    })
  );

  const createExpenseMutation = useMutation(
    trpc.createOperationalExpense.mutationOptions({
      onSuccess: () => {
        toast.success("Operational expense added successfully!");
        queryClient.invalidateQueries({ queryKey: ["getOperationalExpenses"] });
        reset();
        setDocumentUrl("");
        setShowForm(false);
        if (onClose) onClose();
      },
      onError: (error) => {
        toast.error(error.message || "Failed to add expense");
      },
    })
  );

  const updateExpenseMutation = useMutation(
    trpc.updateOperationalExpense.mutationOptions({
      onSuccess: () => {
        toast.success("Expense updated successfully!");
        queryClient.invalidateQueries({ queryKey: ["getOperationalExpenses"] });
        setEditingExpense(null);
        reset();
        setDocumentUrl("");
        setShowForm(false);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update expense");
      },
    })
  );

  const approveExpenseMutation = useMutation(
    trpc.approveOperationalExpense.mutationOptions({
      onSuccess: () => {
        toast.success("Expense approval updated!");
        queryClient.invalidateQueries({ queryKey: ["getOperationalExpenses"] });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update approval status");
      },
    })
  );

  const onSubmit = (data: ExpenseForm) => {
    if (editingExpense) {
      updateExpenseMutation.mutate({
        token: token!,
        id: editingExpense,
        ...data,
      });
    } else {
      createExpenseMutation.mutate({
        token: token!,
        ...data,
      });
    }
  };

  const handleEdit = (expense: any) => {
    setEditingExpense(expense.id);
    setDocumentUrl(expense.documentUrl || "");
    reset({
      date: new Date(expense.date).toISOString().split("T")[0],
      category: expense.category,
      description: expense.description,
      amount: expense.amount,
      vendor: expense.vendor || "",
      referenceNumber: expense.referenceNumber || "",
      notes: expense.notes || "",
      documentUrl: expense.documentUrl || "",
      isRecurring: expense.isRecurring,
      recurringPeriod: expense.recurringPeriod || "",
    });
    setShowForm(true);
  };

  const handleApprove = (id: number, approve: boolean) => {
    approveExpenseMutation.mutate({
      token: token!,
      id,
      isApproved: approve,
    });
  };

  const expenses = expensesQuery.data || [];
  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);
  const approvedExpenses = expenses.filter((exp) => exp.isApproved);
  const pendingExpenses = expenses.filter((exp) => !exp.isApproved);

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Receipt className="h-6 w-6 text-blue-600" />
            Operational Expenses
          </h2>
          <p className="text-sm text-gray-600 mt-1">
            Track business expenses not tied to orders
          </p>
        </div>
        <button
          onClick={() => {
            setShowForm(!showForm);
            setEditingExpense(null);
            reset();
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          {showForm ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {showForm ? "Cancel" : "Add Expense"}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-gray-50 rounded-lg p-4">
          <p className="text-sm text-gray-600">Total Expenses</p>
          <p className="text-2xl font-bold text-gray-900">R {totalExpenses.toFixed(2)}</p>
        </div>
        <div className="bg-green-50 rounded-lg p-4">
          <p className="text-sm text-green-600">Approved</p>
          <p className="text-2xl font-bold text-green-900">{approvedExpenses.length}</p>
        </div>
        <div className="bg-yellow-50 rounded-lg p-4">
          <p className="text-sm text-yellow-600">Pending Approval</p>
          <p className="text-2xl font-bold text-yellow-900">{pendingExpenses.length}</p>
        </div>
      </div>

      {/* Approval Info Message */}
      {!canApprove && pendingExpenses.length > 0 && (
        <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-blue-900">Pending Senior Approval</p>
              <p className="text-sm text-blue-700 mt-1">
                You have {pendingExpenses.length} expense{pendingExpenses.length !== 1 ? 's' : ''} pending approval. 
                Only <span className="font-semibold">Senior Admin</span> can approve or reject expenses.
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Current role: <span className="font-mono bg-blue-100 px-2 py-0.5 rounded">{user?.role || 'Unknown'}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {canApprove && pendingExpenses.length > 0 && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-green-900">You can approve expenses</p>
              <p className="text-sm text-green-700 mt-1">
                As a {user?.role}, you can approve or reject the {pendingExpenses.length} pending expense{pendingExpenses.length !== 1 ? 's' : ''} below.
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {expenseCategories.map((cat) => (
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Enter expense description..."
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0.00"
              />
              {errors.amount && (
                <p className="text-sm text-red-600 mt-1">{errors.amount.message}</p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Vendor/Supplier
              </label>
              <input
                type="text"
                {...register("vendor")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Supplier name"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Reference/Receipt Number
              </label>
              <input
                type="text"
                {...register("referenceNumber")}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Receipt #"
              />
            </div>

            <div>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  {...register("isRecurring")}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm font-medium text-gray-700">Recurring Expense</span>
              </label>
            </div>

            {isRecurring && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Recurring Period
                </label>
                <select
                  {...register("recurringPeriod")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Additional notes..."
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Receipt/Proof Document (Optional)
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
                      className="flex-1 text-sm text-gray-600 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 disabled:opacity-50"
                    />
                    {uploadingDocument && (
                      <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    )}
                  </div>
                )}
                <p className="text-xs text-gray-500">
                  Upload a photo or PDF of the receipt/invoice (optional, max 10MB)
                </p>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={() => {
                setShowForm(false);
                setEditingExpense(null);
                setDocumentUrl("");
                reset();
              }}
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createExpenseMutation.isPending || updateExpenseMutation.isPending}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              {(createExpenseMutation.isPending || updateExpenseMutation.isPending) && (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              {editingExpense ? "Update" : "Add"} Expense
            </button>
          </div>
        </form>
      )}

      {/* Expense List */}
      <div className="space-y-3">
        {expensesQuery.isLoading ? (
          <div className="text-center py-8">
            <Loader2 className="h-8 w-8 animate-spin mx-auto text-gray-400" />
          </div>
        ) : expenses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No operational expenses recorded yet
          </div>
        ) : (
          expenses.map((expense) => (
            <div
              key={expense.id}
              className={`bg-white border-2 rounded-lg p-4 ${
                expense.isApproved ? "border-green-200" : "border-yellow-200"
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h4 className="font-semibold text-gray-900">{expense.description}</h4>
                    <span
                      className={`px-2 py-1 text-xs rounded-full ${
                        expense.isApproved
                          ? "bg-green-100 text-green-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      {expense.isApproved ? "Approved" : "Pending"}
                    </span>
                    <span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                      {expenseCategories.find((c) => c.value === expense.category)?.label}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600">Amount:</span>
                      <span className="ml-2 font-semibold text-gray-900">
                        R {expense.amount.toFixed(2)}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Date:</span>
                      <span className="ml-2 text-gray-900">
                        {new Date(expense.date).toLocaleDateString()}
                      </span>
                    </div>
                    {expense.vendor && (
                      <div>
                        <span className="text-gray-600">Vendor:</span>
                        <span className="ml-2 text-gray-900">{expense.vendor}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-600">By:</span>
                      <span className="ml-2 text-gray-900">
                        {expense.createdBy.firstName} {expense.createdBy.lastName}
                      </span>
                    </div>
                  </div>
                  {expense.notes && (
                    <p className="text-sm text-gray-600 mt-2">{expense.notes}</p>
                  )}
                </div>
                <div className="flex flex-col gap-2 ml-4">
                  {!expense.isApproved && (
                    <>
                      {/* Only creator or senior users can edit */}
                      {(expense.createdById === user?.id || canApprove) && (
                        <button
                          onClick={() => handleEdit(expense)}
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
                            onClick={() => handleApprove(expense.id, true)}
                            className="p-2 text-green-600 hover:bg-green-50 rounded transition-colors"
                            title="Approve"
                            disabled={approveExpenseMutation.isPending}
                          >
                            <Check className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleApprove(expense.id, false)}
                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                            title="Reject"
                            disabled={approveExpenseMutation.isPending}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </>
                      )}
                    </>
                  )}
                  {/* Senior users can edit approved expenses */}
                  {expense.isApproved && canApprove && (
                    <button
                      onClick={() => handleEdit(expense)}
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
