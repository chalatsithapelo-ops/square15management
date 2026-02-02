import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Plus,
  Search,
  AlertTriangle,
  Calendar,
  DollarSign,
  User,
  Edit,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { RequireSubscriptionFeature } from "~/components/RequireSubscriptionFeature";

export const Route = createFileRoute("/contractor/liabilities/")({
  component: LiabilitiesPageGuarded,
});

function LiabilitiesPageGuarded() {
  return (
    <RequireSubscriptionFeature feature="hasAssets" returnPath="/contractor/dashboard">
      <LiabilitiesPage />
    </RequireSubscriptionFeature>
  );
}
const liabilitySchema = z.object({
  name: z.string().min(1, "Liability name is required"),
  description: z.string().optional(),
  category: z.enum(["LOAN", "ACCOUNTS_PAYABLE", "CREDIT_LINE", "OTHER"], {
    required_error: "Category is required",
  }),
  amount: z.number().min(0, "Amount must be positive"),
  dueDate: z.string().optional(),
  creditor: z.string().optional(),
  referenceNumber: z.string().optional(),
  notes: z.string().optional(),
});

type LiabilityForm = z.infer<typeof liabilitySchema>;

const liabilityCategories = [
  { value: "LOAN", label: "Loans", color: "red" },
  { value: "ACCOUNTS_PAYABLE", label: "Accounts Payable", color: "orange" },
  { value: "CREDIT_LINE", label: "Credit Lines", color: "yellow" },
  { value: "OTHER", label: "Other", color: "gray" },
];

function LiabilitiesPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Check user permissions
  const userPermissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token!,
    })
  );

  const userPermissions = userPermissionsQuery.data?.permissions || [];
  const hasViewLiabilities = userPermissions.includes("VIEW_LIABILITIES");

  // Show loading state while checking permissions
  if (userPermissionsQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Show access denied if user doesn't have permission
  if (!hasViewLiabilities) {
    return <AccessDenied message="You do not have permission to access Liabilities." />;
  }

  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<"all" | "unpaid" | "paid">("all");
  const [editingLiability, setEditingLiability] = useState<number | null>(null);
  const [editValues, setEditValues] = useState<any>({});

  const liabilitiesQuery = useQuery(
    trpc.getLiabilities.queryOptions({
      token: token!,
    })
  );

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
  } = useForm<LiabilityForm>({
    resolver: zodResolver(liabilitySchema),
  });

  const createLiabilityMutation = useMutation(
    trpc.createLiabilities.mutationOptions({
      onSuccess: () => {
        toast.success("Liability created successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getLiabilities.queryKey() });
        reset();
        setShowAddForm(false);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to create liability");
      },
    })
  );

  const updateLiabilityMutation = useMutation(
    trpc.updateLiability.mutationOptions({
      onSuccess: () => {
        toast.success("Liability updated successfully!");
        queryClient.invalidateQueries({ queryKey: trpc.getLiabilities.queryKey() });
        setEditingLiability(null);
        setEditValues({});
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update liability");
      },
    })
  );

  const onSubmit = (data: LiabilityForm) => {
    createLiabilityMutation.mutate({
      token: token!,
      ...data,
    });
  };

  const handleEditSave = (liabilityId: number) => {
    updateLiabilityMutation.mutate({
      token: token!,
      liabilityId,
      ...editValues,
    });
  };

  const handleTogglePaid = (liability: any) => {
    const newIsPaid = !liability.isPaid;
    updateLiabilityMutation.mutate({
      token: token!,
      liabilityId: liability.id,
      isPaid: newIsPaid,
      paidDate: newIsPaid ? new Date().toISOString() : undefined,
    });
  };

  const liabilities = liabilitiesQuery.data || [];
  
  // Show loading state while data is being fetched
  if (liabilitiesQuery.isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading liabilities...</p>
        </div>
      </div>
    );
  }
  
  const filteredLiabilities = liabilities.filter((liability) => {
    const matchesSearch =
      liability.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (liability.creditor && liability.creditor.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (liability.referenceNumber && liability.referenceNumber.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !categoryFilter || liability.category === categoryFilter;
    
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "unpaid" && !liability.isPaid) ||
      (statusFilter === "paid" && liability.isPaid);
    
    return matchesSearch && matchesCategory && matchesStatus;
  });

  const totalLiabilities = liabilities.reduce((sum, liability) => sum + (liability.amount || 0), 0);
  const unpaidLiabilities = liabilities.filter(l => !l.isPaid).reduce((sum, l) => sum + (l.amount || 0), 0);
  const paidLiabilities = liabilities.filter(l => l.isPaid).reduce((sum, l) => sum + (l.amount || 0), 0);
  
  // Ensure all values are valid numbers for display
  const safeTotalLiabilities = Number(totalLiabilities) || 0;
  const safeUnpaidLiabilities = Number(unpaidLiabilities) || 0;
  const safePaidLiabilities = Number(paidLiabilities) || 0;
  
  const categoryStats = liabilityCategories.map((category) => ({
    ...category,
    count: liabilities.filter((l) => l.category === category.value).length,
    amount: liabilities.filter((l) => l.category === category.value).reduce((sum, l) => sum + (l.amount || 0), 0),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              <Link
                to="/contractor/dashboard"
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="h-5 w-5 text-gray-600" />
              </Link>
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-2 rounded-xl shadow-md">
                <AlertTriangle className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">Liability Management</h1>
                <p className="text-sm text-gray-600">
                  {liabilities.length} liabilities • R{safeTotalLiabilities.toLocaleString()} total • R{safeUnpaidLiabilities.toLocaleString()} unpaid
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className="w-full sm:w-auto inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 shadow-md transition-all"
            >
              <Plus className="h-5 w-5 mr-2" />
              Add Liability
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-gray-600">Total Liabilities</h3>
              <DollarSign className="h-5 w-5 text-gray-400" />
            </div>
            <p className="text-2xl font-bold text-gray-900">R {safeTotalLiabilities.toLocaleString()}</p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-red-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-red-600">Unpaid Liabilities</h3>
              <XCircle className="h-5 w-5 text-red-500" />
            </div>
            <p className="text-2xl font-bold text-red-600">R {safeUnpaidLiabilities.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {liabilities.filter(l => !l.isPaid).length} outstanding
            </p>
          </div>
          
          <div className="bg-white rounded-xl shadow-sm border border-green-200 p-6">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium text-green-600">Paid Liabilities</h3>
              <CheckCircle className="h-5 w-5 text-green-500" />
            </div>
            <p className="text-2xl font-bold text-green-600">R {safePaidLiabilities.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">
              {liabilities.filter(l => l.isPaid).length} settled
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Liabilities by Category</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categoryStats.map((stat) => (
              <div
                key={stat.value}
                className={`text-center p-4 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer ${
                  categoryFilter === stat.value ? 'bg-gray-100 ring-2 ring-gray-300' : 'bg-gray-50'
                }`}
                onClick={() => setCategoryFilter(categoryFilter === stat.value ? null : stat.value)}
              >
                <div className="text-2xl font-bold text-gray-900 mb-1">{stat.count}</div>
                <div className="text-xs text-gray-600 mb-2">{stat.label}</div>
                <div className="text-sm font-semibold text-red-600">R {stat.amount.toLocaleString()}</div>
              </div>
            ))}
          </div>
        </div>

        {showAddForm && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Add New Liability</h2>
            <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Liability Name *</label>
                <input
                  type="text"
                  {...register("name")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Business Loan"
                />
                {errors.name && <p className="mt-1 text-sm text-red-600">{errors.name.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                <select
                  {...register("category")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                >
                  <option value="">Select category</option>
                  {liabilityCategories.map((cat) => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
                {errors.category && <p className="mt-1 text-sm text-red-600">{errors.category.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (R) *</label>
                <input
                  type="number"
                  {...register("amount", { valueAsNumber: true })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="50000"
                />
                {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Due Date</label>
                <input
                  type="date"
                  {...register("dueDate")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Creditor/Lender</label>
                <input
                  type="text"
                  {...register("creditor")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="ABC Bank"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Reference Number</label>
                <input
                  type="text"
                  {...register("referenceNumber")}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="REF123456"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  {...register("description")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Liability description..."
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  {...register("notes")}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
                  placeholder="Additional notes..."
                />
              </div>

              <div className="md:col-span-2 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddForm(false);
                    reset();
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLiabilityMutation.isPending}
                  className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg disabled:opacity-50 transition-colors"
                >
                  {createLiabilityMutation.isPending ? "Creating..." : "Create Liability"}
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
          <div className="flex flex-col md:flex-row items-center space-y-4 md:space-y-0 md:space-x-4">
            <div className="flex-1 relative w-full">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search liabilities by name, creditor, or reference number..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            <div className="flex space-x-2">
              <button
                onClick={() => setStatusFilter("all")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === "all"
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                All
              </button>
              <button
                onClick={() => setStatusFilter("unpaid")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === "unpaid"
                    ? "bg-red-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Unpaid
              </button>
              <button
                onClick={() => setStatusFilter("paid")}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  statusFilter === "paid"
                    ? "bg-green-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                Paid
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredLiabilities.map((liability) => {
            const categoryInfo = liabilityCategories.find(c => c.value === liability.category);
            const isOverdue = liability.dueDate && !liability.isPaid && new Date(liability.dueDate) < new Date();
            
            return (
              <div
                key={liability.id}
                className={`bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow ${
                  isOverdue ? 'border-red-300 bg-red-50' : 'border-gray-200'
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-1">
                      <h3 className="text-lg font-semibold text-gray-900">{liability.name}</h3>
                      {liability.isPaid ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <XCircle className="h-5 w-5 text-red-500" />
                      )}
                    </div>
                    <p className="text-sm text-gray-600">{categoryInfo?.label || liability.category}</p>
                  </div>
                  <button
                    onClick={() => {
                      if (editingLiability === liability.id) {
                        handleEditSave(liability.id);
                      } else {
                        setEditingLiability(liability.id);
                        setEditValues({
                          amount: liability.amount,
                          dueDate: liability.dueDate ? new Date(liability.dueDate).toISOString().split('T')[0] : "",
                          creditor: liability.creditor,
                          referenceNumber: liability.referenceNumber,
                        });
                      }
                    }}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Edit className="h-5 w-5" />
                  </button>
                </div>

                {liability.description && (
                  <p className="text-sm text-gray-600 mb-3">{liability.description}</p>
                )}

                {isOverdue && (
                  <div className="mb-3 p-2 bg-red-100 border border-red-300 rounded-lg">
                    <p className="text-xs font-semibold text-red-800">⚠️ OVERDUE</p>
                  </div>
                )}

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between items-center">
                    <span className="text-gray-600">Amount:</span>
                    {editingLiability === liability.id ? (
                      <input
                        type="number"
                        value={editValues.amount || liability.amount}
                        onChange={(e) => setEditValues({ ...editValues, amount: parseFloat(e.target.value) })}
                        className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                      />
                    ) : (
                      <span className="font-medium text-gray-900">R{liability.amount.toLocaleString()}</span>
                    )}
                  </div>

                  {(liability.dueDate || editingLiability === liability.id) && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center">
                        <Calendar className="h-4 w-4 mr-1" />
                        Due Date:
                      </span>
                      {editingLiability === liability.id ? (
                        <input
                          type="date"
                          value={editValues.dueDate || (liability.dueDate ? new Date(liability.dueDate).toISOString().split('T')[0] : "")}
                          onChange={(e) => setEditValues({ ...editValues, dueDate: e.target.value })}
                          className="px-2 py-1 border border-gray-300 rounded text-sm"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">
                          {liability.dueDate ? new Date(liability.dueDate).toLocaleDateString() : "N/A"}
                        </span>
                      )}
                    </div>
                  )}

                  {(liability.creditor || editingLiability === liability.id) && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600 flex items-center">
                        <User className="h-4 w-4 mr-1" />
                        Creditor:
                      </span>
                      {editingLiability === liability.id ? (
                        <input
                          type="text"
                          value={editValues.creditor || liability.creditor || ""}
                          onChange={(e) => setEditValues({ ...editValues, creditor: e.target.value })}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{liability.creditor}</span>
                      )}
                    </div>
                  )}

                  {(liability.referenceNumber || editingLiability === liability.id) && (
                    <div className="flex justify-between items-center">
                      <span className="text-gray-600">Reference:</span>
                      {editingLiability === liability.id ? (
                        <input
                          type="text"
                          value={editValues.referenceNumber || liability.referenceNumber || ""}
                          onChange={(e) => setEditValues({ ...editValues, referenceNumber: e.target.value })}
                          className="w-32 px-2 py-1 border border-gray-300 rounded text-right"
                        />
                      ) : (
                        <span className="font-medium text-gray-900">{liability.referenceNumber}</span>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center pt-2 border-t">
                    <span className="text-gray-600">Status:</span>
                    <button
                      onClick={() => handleTogglePaid(liability)}
                      disabled={updateLiabilityMutation.isPending}
                      className={`px-3 py-1 text-xs font-semibold rounded-full transition-colors ${
                        liability.isPaid
                          ? "bg-green-100 text-green-800 hover:bg-green-200"
                          : "bg-red-100 text-red-800 hover:bg-red-200"
                      }`}
                    >
                      {liability.isPaid ? "Paid" : "Unpaid"}
                    </button>
                  </div>

                  {liability.isPaid && liability.paidDate && (
                    <div className="flex justify-between text-xs text-gray-500">
                      <span>Paid on:</span>
                      <span>{new Date(liability.paidDate).toLocaleDateString()}</span>
                    </div>
                  )}
                </div>

                {editingLiability === liability.id && (
                  <div className="mt-4 pt-4 border-t flex justify-end space-x-2">
                    <button
                      onClick={() => {
                        setEditingLiability(null);
                        setEditValues({});
                      }}
                      className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={() => handleEditSave(liability.id)}
                      disabled={updateLiabilityMutation.isPending}
                      className="px-3 py-1 text-sm text-white bg-red-600 hover:bg-red-700 rounded disabled:opacity-50"
                    >
                      {updateLiabilityMutation.isPending ? "Saving..." : "Save"}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {filteredLiabilities.length === 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-12 text-center">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-400" />
            <p className="mt-2 text-sm text-gray-600">No liabilities found</p>
          </div>
        )}
      </main>
    </div>
  );
}
