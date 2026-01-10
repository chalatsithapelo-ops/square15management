import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import {
  Plus,
  Search,
  Filter,
  MoreVertical,
  Edit,
  Trash2,
  Eye,
  Download,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { Dialog } from "@headlessui/react";
import { ContractorDetailsModal } from "./ContractorDetailsModal";
import { CreateContractorModal } from "./CreateContractorModal";
import { EditContractorModal } from "./EditContractorModal";

export function ContractorManagement() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [searchTerm, setSearchTerm] = useState("");
  const [serviceTypeFilter, setServiceTypeFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingContractor, setEditingContractor] = useState<any>(null);
  const [selectedContractor, setSelectedContractor] = useState<any>(null);
  const [showViewDetails, setShowViewDetails] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [contractorToDelete, setContractorToDelete] = useState<any>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Fetch contractors
  const contractorsQuery = useQuery(
    trpc.getContractors.queryOptions({
      token: token!,
      serviceType: serviceTypeFilter || undefined,
      status: statusFilter || undefined,
      searchQuery: searchTerm || undefined,
    })
  );

  const contractors = contractorsQuery.data?.contractors || [];

  // Delete contractor mutation
  const deleteContractorMutation = useMutation(
    trpc.deleteContractor.mutationOptions({
      onSuccess: () => {
        toast.success("Contractor deleted successfully!");
        queryClient.invalidateQueries({
          queryKey: trpc.getContractors.queryKey(),
        });
        setShowDeleteConfirm(false);
        setContractorToDelete(null);
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to delete contractor");
      },
    })
  );

  const handleDeleteContractor = () => {
    if (!token || !contractorToDelete) return;
    
    deleteContractorMutation.mutate({
      token,
      contractorId: contractorToDelete.id,
    });
  };

  // Service types for filtering (can be extended)
  const serviceTypes = [
    "PLUMBING",
    "ELECTRICAL",
    "HVAC",
    "CARPENTRY",
    "PAINTING",
    "ROOFING",
    "GENERAL_MAINTENANCE",
  ];

  const statuses = ["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"];

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Contractor Management</h1>
        <button
          onClick={() => {
            setEditingContractor(null);
            setShowAddForm(true);
          }}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-blue-700"
        >
          <Plus className="w-5 h-5" />
          Add Contractor
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow p-4 space-y-4">
        <div className="flex gap-4 items-end flex-wrap">
          {/* Search */}
          <div className="flex-1 min-w-[250px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Search
            </label>
            <div className="relative">
              <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
              <input
                type="text"
                placeholder="Name, email, or company..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          {/* Service Type Filter */}
          <div className="w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Service Type
            </label>
            <select
              value={serviceTypeFilter || ""}
              onChange={(e) =>
                setServiceTypeFilter(e.target.value || null)
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              {serviceTypes.map((type) => (
                <option key={type} value={type}>
                  {type.replace(/_/g, " ")}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Status
            </label>
            <select
              value={statusFilter || ""}
              onChange={(e) => setStatusFilter(e.target.value || null)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Status</option>
              {statuses.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Contractors Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {contractorsQuery.isLoading ? (
          <div className="p-8 text-center text-gray-500">Loading contractors...</div>
        ) : contractors.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-2" />
            <p className="text-gray-600">No contractors found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Company</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Service Type</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Jobs Completed</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Total Spent</th>
                  <th className="px-6 py-3 text-left text-sm font-semibold text-gray-700">Rating</th>
                  <th className="px-6 py-3 text-center text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {contractors.map((contractor: any) => (
                  <tr
                    key={contractor.id}
                    className="border-b border-gray-200 hover:bg-gray-50"
                  >
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {contractor.firstName} {contractor.lastName}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      {contractor.companyName || "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">
                      <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                        {contractor.serviceType}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      <span
                        className={`px-2 py-1 rounded text-xs font-semibold ${
                          contractor.status === "ACTIVE"
                            ? "bg-green-100 text-green-800"
                            : contractor.status === "INACTIVE"
                            ? "bg-gray-100 text-gray-800"
                            : contractor.status === "SUSPENDED"
                            ? "bg-yellow-100 text-yellow-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {contractor.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {contractor.totalJobsCompleted}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      R {contractor.totalSpent.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-900">
                      {contractor.averageRating.toFixed(1)} / 5
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex gap-2 justify-center">
                        <button
                          onClick={() => {
                            setSelectedContractor(contractor);
                            setShowViewDetails(true);
                          }}
                          className="text-blue-600 hover:text-blue-800"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setEditingContractor(contractor);
                            setShowEditModal(true);
                          }}
                          className="text-yellow-600 hover:text-yellow-800"
                          title="Edit"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            setContractorToDelete(contractor);
                            setShowDeleteConfirm(true);
                          }}
                          className="text-red-600 hover:text-red-800"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Contractor Details Modal */}
      {selectedContractor && (
        <ContractorDetailsModal
          contractor={selectedContractor}
          isOpen={showViewDetails}
          onClose={() => {
            setShowViewDetails(false);
            setSelectedContractor(null);
          }}
        />
      )}

      {/* Create Contractor Modal */}
      <CreateContractorModal
        isOpen={showAddForm}
        onClose={() => setShowAddForm(false)}
      />

      {/* Edit Contractor Modal */}
      <EditContractorModal
        isOpen={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingContractor(null);
        }}
        contractor={editingContractor}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="mx-auto max-w-md w-full bg-white rounded-lg shadow-xl p-6">
            <Dialog.Title className="text-lg font-bold text-gray-900 mb-4">
              Delete Contractor
            </Dialog.Title>
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete {contractorToDelete?.firstName} {contractorToDelete?.lastName}? This action cannot be undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setContractorToDelete(null);
                }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 font-medium"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteContractor}
                disabled={deleteContractorMutation.isPending}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleteContractorMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </div>
  );
}
