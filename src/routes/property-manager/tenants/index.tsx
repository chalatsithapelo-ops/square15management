import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { AddTenantModal, type AddTenantFormData } from "~/components/property-manager/AddTenantModal";
import {
  Users,
  Building2,
  CheckCircle2,
  Clock,
  XCircle,
  Eye,
  DollarSign,
  Zap,
  Calendar,
  Plus,
  FileText,
  ArrowLeft,
  Edit2,
  AlertCircle,
  Wrench,
  MessageSquare,
} from "lucide-react";

export const Route = createFileRoute("/property-manager/tenants/")({
  component: PropertyManagerTenantsPage,
});

function PropertyManagerTenantsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [view, setView] = useState<"overview" | "pending" | "detail" | "approve" | "record">("overview");
  const [selectedTenant, setSelectedTenant] = useState<any | null>(null);
  const [activeTab, setActiveTab] = useState<"profile" | "maintenance" | "rent" | "utilities">("profile");
  const [rejectionReason, setRejectionReason] = useState("");
  const [showAddTenantModal, setShowAddTenantModal] = useState(false);
  const [tenantCredentials, setTenantCredentials] = useState<any>(null);

  // Fetch buildings for add tenant form
  const buildingsQuery = useQuery({
    ...trpc.getBuildings.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch tenants overview
  const tenantsQuery = useQuery({
    ...trpc.getTenantsOverview.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Fetch pending onboardings
  const pendingQuery = useQuery({
    ...trpc.getPendingOnboardings.queryOptions({ token: token! }),
    enabled: !!token,
  });

  // Approve onboarding
  const approveMutation = useMutation(
    trpc.approveTenantOnboarding.mutationOptions({
      onSuccess: () => {
        toast.success("Tenant onboarding approved!");
        setView("overview");
        queryClient.invalidateQueries({ queryKey: ["getPendingOnboardings"] });
        queryClient.invalidateQueries({ queryKey: ["getTenantsOverview"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to approve onboarding");
      },
    })
  );

  // Reject onboarding
  const rejectMutation = useMutation(
    trpc.rejectTenantOnboarding.mutationOptions({
      onSuccess: () => {
        toast.success("Tenant onboarding rejected");
        setView("overview");
        setRejectionReason("");
        queryClient.invalidateQueries({ queryKey: ["getPendingOnboardings"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to reject onboarding");
      },
    })
  );

  // Add tenant mutation
  const addTenantMutation = useMutation(
    trpc.addTenant.mutationOptions({
      onSuccess: (result) => {
        toast.success("Tenant added successfully!");
        setTenantCredentials(result.credentials);
        queryClient.invalidateQueries({ queryKey: ["getTenantsOverview"] });
      },
      onError: (error: any) => {
        toast.error(error.message || "Failed to add tenant");
      },
    })
  );

  const handleAddTenant = (data: AddTenantFormData) => {
    if (!token) {
      toast.error("Not authenticated");
      return;
    }
    
    // Convert date strings to ISO format
    const leaseStartDate = new Date(data.leaseStartDate).toISOString();
    const leaseEndDate = new Date(data.leaseEndDate).toISOString();
    
    addTenantMutation.mutate({
      token,
      ...data,
      leaseStartDate,
      leaseEndDate,
    });
  };

  const tenants = (tenantsQuery.data as any)?.tenants ?? [];
  const metrics = (tenantsQuery.data as any)?.metrics ?? ({} as any);
  const pendingOnboardings = pendingQuery.data || [];
  const buildings = buildingsQuery.data || [];

  console.log("Tenants page - Buildings query status:", {
    isLoading: buildingsQuery.isLoading,
    isError: buildingsQuery.isError,
    buildings: buildings,
  });

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center">
              <Users className="h-8 w-8 mr-3 text-blue-600" />
              Tenant Management
            </h1>
            <p className="text-gray-600 mt-2">
              Manage tenant onboarding, rent payments, utilities, and maintenance requests
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Link
              to="/property-manager/maintenance/received"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <Wrench className="w-5 h-5" />
              Maintenance
            </Link>
            <Link
              to="/property-manager/feedback"
              className="px-4 py-2 bg-white text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 flex items-center gap-2"
            >
              <MessageSquare className="w-5 h-5" />
              Complaints &amp; Compliments
            </Link>
            <button
              onClick={() => setShowAddTenantModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 shadow-md"
            >
              <Plus className="w-5 h-5" />
              Add Tenant
            </button>
          </div>
        </div>

        {/* Add Tenant Modal */}
        <AddTenantModal
          isOpen={showAddTenantModal}
          onClose={() => {
            setShowAddTenantModal(false);
            setTenantCredentials(null);
          }}
          onSubmit={handleAddTenant}
          buildings={buildings}
          isLoading={addTenantMutation.isPending}
          credentials={tenantCredentials}
        />

        {/* Overview Metrics */}
        {view === "overview" && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Total Tenants</h3>
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{(metrics as any).totalTenants || 0}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Active Tenants</h3>
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{(metrics as any).activeTenants || 0}</p>
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Pending Onboarding</h3>
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">{(metrics as any).pendingOnboarding || 0}</p>
                {(metrics as any).pendingOnboarding > 0 && (
                  <button
                    onClick={() => setView("pending")}
                    className="mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    Review Now →
                  </button>
                )}
              </div>

              <div className="bg-white rounded-lg shadow-md p-6">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">Monthly Rent</h3>
                  <DollarSign className="h-5 w-5 text-green-600" />
                </div>
                <p className="text-3xl font-bold text-gray-900">
                  R {(((metrics as any).totalMonthlyRent || 0) as number).toLocaleString()}
                </p>
              </div>
            </div>

            {/* Tenants List */}
            <div className="bg-white rounded-lg shadow-md p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">All Tenants</h2>
              {tenantsQuery.isLoading ? (
                <div className="text-center py-8 text-gray-600">Loading tenants...</div>
              ) : tenants.length === 0 ? (
                <div className="text-center py-8 text-gray-600">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                  <p>No tenants yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Name</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Building</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Contact</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Monthly Rent</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Status</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-700 uppercase">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {tenants.map((tenant: any) => (
                        <tr key={tenant.id} className="hover:bg-gray-50">
                          <td className="px-4 py-4">
                            <div>
                              <p className="font-medium text-gray-900">
                                {tenant.firstName} {tenant.lastName}
                              </p>
                              <p className="text-sm text-gray-500">{tenant.email}</p>
                            </div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="flex items-center">
                              <Building2 className="h-4 w-4 mr-2 text-gray-400" />
                              <span className="text-sm text-gray-900">{tenant.building?.name || "N/A"}</span>
                            </div>
                          </td>
                          <td className="px-4 py-4 text-sm text-gray-900">{tenant.phoneNumber}</td>
                          <td className="px-4 py-4 text-sm font-medium text-gray-900">
                            {tenant.monthlyRent ? `R ${tenant.monthlyRent.toLocaleString()}` : "N/A"}
                          </td>
                          <td className="px-4 py-4">
                            {tenant.status === "ACTIVE" && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                <CheckCircle2 className="h-3 w-3 mr-1" />
                                Active
                              </span>
                            )}
                            {tenant.status === "PENDING" && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                                <Clock className="h-3 w-3 mr-1" />
                                Pending
                              </span>
                            )}
                            {tenant.status === "INACTIVE" && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-4">
                            <button
                              onClick={() => {
                                setSelectedTenant(tenant);
                                setView("detail");
                              }}
                              className="text-blue-600 hover:text-blue-700 text-sm font-medium flex items-center"
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Pending Onboardings View */}
        {view === "pending" && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => setView("overview")}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Pending Onboarding Requests</h2>
            </div>

            {pendingQuery.isLoading ? (
              <div className="text-center py-8 text-gray-600">Loading...</div>
            ) : pendingOnboardings.length === 0 ? (
              <div className="bg-white rounded-lg shadow-md p-8 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
                <p className="text-gray-600">No pending onboarding requests</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-6">
                {pendingOnboardings.map((request: any) => (
                  <div key={request.id} className="bg-white rounded-lg shadow-md p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          {request.firstName} {request.lastName}
                        </h3>
                        <p className="text-sm text-gray-600 mt-1">
                          Submitted {new Date(request.onboardedDate).toLocaleDateString()}
                        </p>
                      </div>
                      <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-yellow-100 text-yellow-800">
                        <Clock className="h-4 w-4 mr-1" />
                        Pending Review
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <p className="text-sm text-gray-600">Email</p>
                        <p className="text-sm font-medium text-gray-900">{request.email}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Phone</p>
                        <p className="text-sm font-medium text-gray-900">{request.phoneNumber}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Building</p>
                        <p className="text-sm font-medium text-gray-900">
                          {request.building?.name || "N/A"}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Address</p>
                        <p className="text-sm font-medium text-gray-900">
                          {request.building?.address}, {request.building?.city}
                        </p>
                      </div>
                    </div>

                    {request.monthlyRent && (
                      <div className="bg-gray-50 rounded-lg p-4 mb-4">
                        <h4 className="text-sm font-medium text-gray-700 mb-2">Tenant's Proposed Terms</h4>
                        <div className="grid grid-cols-3 gap-4">
                          {request.monthlyRent && (
                            <div>
                              <p className="text-xs text-gray-600">Monthly Rent</p>
                              <p className="text-sm font-medium text-gray-900">R {request.monthlyRent.toLocaleString()}</p>
                            </div>
                          )}
                          {request.securityDeposit && (
                            <div>
                              <p className="text-xs text-gray-600">Security Deposit</p>
                              <p className="text-sm font-medium text-gray-900">R {request.securityDeposit.toLocaleString()}</p>
                            </div>
                          )}
                          {request.leaseStartDate && (
                            <div>
                              <p className="text-xs text-gray-600">Lease Start</p>
                              <p className="text-sm font-medium text-gray-900">
                                {new Date(request.leaseStartDate).toLocaleDateString()}
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3">
                      <button
                        onClick={() => {
                          setSelectedTenant(request);
                          setView("approve");
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center"
                      >
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Approve
                      </button>
                      <button
                        onClick={() => {
                          if (!token) {
                            toast.error("Not authenticated");
                            return;
                          }
                          if (confirm("Enter rejection reason:")) {
                            const reason = prompt("Rejection reason:");
                            if (reason) {
                              rejectMutation.mutate({
                                token,
                                customerId: request.id,
                                rejectionReason: reason,
                              });
                            }
                          }
                        }}
                        className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center"
                      >
                        <XCircle className="h-4 w-4 mr-2" />
                        Reject
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approve View - Simple Form */}
        {view === "approve" && selectedTenant && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => setView("pending")}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">Approve Tenant Onboarding</h2>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!token) {
                    toast.error("Not authenticated");
                    return;
                  }
                  const formData = new FormData(e.currentTarget);
                  approveMutation.mutate({
                    token,
                    customerId: selectedTenant.id,
                    leaseStartDate: formData.get("leaseStartDate") as string,
                    leaseEndDate: formData.get("leaseEndDate") as string,
                    monthlyRent: parseFloat(formData.get("monthlyRent") as string),
                    securityDeposit: formData.get("securityDeposit")
                      ? parseFloat(formData.get("securityDeposit") as string)
                      : undefined,
                  });
                }}
                className="space-y-6"
              >
                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                  <h3 className="font-semibold text-gray-900 mb-2">Tenant Information</h3>
                  <p className="text-sm text-gray-600">
                    {selectedTenant.firstName} {selectedTenant.lastName} - {selectedTenant.email}
                  </p>
                  <p className="text-sm text-gray-600">
                    Building: {selectedTenant.building?.name}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lease Start Date *
                    </label>
                    <input
                      type="date"
                      name="leaseStartDate"
                      required
                      defaultValue={selectedTenant.leaseStartDate?.split("T")[0]}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Lease End Date *
                    </label>
                    <input
                      type="date"
                      name="leaseEndDate"
                      required
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Monthly Rent (R) *
                    </label>
                    <input
                      type="number"
                      name="monthlyRent"
                      step="0.01"
                      required
                      defaultValue={selectedTenant.monthlyRent}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Security Deposit (R)
                    </label>
                    <input
                      type="number"
                      name="securityDeposit"
                      step="0.01"
                      defaultValue={selectedTenant.securityDeposit}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setView("pending")}
                    className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={approveMutation.isPending}
                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-400"
                  >
                    {approveMutation.isPending ? "Approving..." : "Approve & Activate"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tenant Detail View - Placeholder */}
        {view === "detail" && selectedTenant && (
          <div className="space-y-6">
            <div className="flex items-center mb-4">
              <button
                onClick={() => setView("overview")}
                className="mr-4 text-gray-600 hover:text-gray-900"
              >
                <ArrowLeft className="h-5 w-5" />
              </button>
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedTenant.firstName} {selectedTenant.lastName}
              </h2>
            </div>

            <div className="bg-white rounded-lg shadow-md p-6">
              <p className="text-gray-600">Tenant detail view - Full implementation pending</p>
              <p className="text-sm text-gray-500 mt-2">
                This will show: Profile, Maintenance Requests, Rent Payments, Utility Readings
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
