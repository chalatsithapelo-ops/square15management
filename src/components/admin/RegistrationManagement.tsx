import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertCircle, CheckCircle, Clock, XCircle } from "lucide-react";
import { AccessDenied } from "~/components/AccessDenied";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";

type RegistrationsTab = "pending" | "approved" | "active" | "rejected";

type ApprovalItemKind = "REGISTRATION" | "PM_CONTRACTOR_PACKAGE_REQUEST";

function itemTypeSortKey(kind: ApprovalItemKind | undefined) {
  // Show PM contractor package approvals first
  if (kind === "PM_CONTRACTOR_PACKAGE_REQUEST") return 0;
  return 1;
}

function formatMoneyZAR(amount: number) {
  return `R${amount.toFixed(2)}`;
}

function compareStrings(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" });
}

function accountTypeSortKey(accountType: string) {
  if (accountType === "CONTRACTOR") return 0;
  if (accountType === "PROPERTY_MANAGER") return 1;
  return 2;
}

export function RegistrationManagement() {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const [selectedTab, setSelectedTab] = useState<RegistrationsTab>("pending");
  const [selectedRegistrationId, setSelectedRegistrationId] = useState<number | null>(null);
  const [lastRejectionEmailById, setLastRejectionEmailById] = useState<Record<number, boolean>>({});

  const registrationsQuery = useQuery({
    ...trpc.getAllRegistrations.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const forbiddenError =
    registrationsQuery.isError && (registrationsQuery.error as any)?.data?.code === "FORBIDDEN"
      ? registrationsQuery.error
      : null;

  const approveMutation = useMutation(
    trpc.approvePendingRegistration.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllRegistrations.queryKey({ token: token! }),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });
        alert("Registration approved successfully");
      },
    })
  );

  const rejectMutation = useMutation(
    trpc.rejectPendingRegistration.mutationOptions({
      onSuccess: async (data, variables) => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllRegistrations.queryKey({ token: token! }),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });

        const emailSent = Boolean((data as any)?.emailSent);
        setLastRejectionEmailById((prev) => ({ ...prev, [variables.registrationId]: emailSent }));
        alert(
          emailSent
            ? "Registration rejected. Rejection email sent to applicant."
            : "Registration rejected. Rejection email could not be sent (check SMTP settings/logs)."
        );
      },
    })
  );

  const markPaidMutation = useMutation(
    trpc.markRegistrationAsPaid.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllRegistrations.queryKey({ token: token! }),
        });
        await queryClient.invalidateQueries({
          queryKey: trpc.getPendingRegistrations.queryKey({ token: token!, isApproved: false }),
        });
        alert("Marked as paid");
      },
    })
  );

  const approveContractorPackageRequestMutation = useMutation(
    trpc.approveContractorPackageRequest.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllRegistrations.queryKey({ token: token! }),
        });
        alert("Contractor package request approved successfully");
      },
    })
  );

  const rejectContractorPackageRequestMutation = useMutation(
    trpc.rejectContractorPackageRequest.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.getAllRegistrations.queryKey({ token: token! }),
        });
        alert("Contractor package request rejected");
      },
    })
  );

  if (forbiddenError) {
    return <AccessDenied message={(forbiddenError as any)?.message || "Access denied"} returnPath="/" />;
  }

  if (registrationsQuery.isError) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="max-w-xl rounded-lg border border-red-200 bg-red-50 p-6 text-left">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-6 w-6 text-red-600" />
            <div>
              <div className="text-sm font-semibold text-red-900">Failed to load registrations</div>
              <div className="mt-1 text-sm text-red-800">
                {(registrationsQuery.error as any)?.message ?? "Unknown error"}
              </div>
              <div className="mt-2 text-xs text-red-700">
                This usually means the server query errored. Check server logs for the exact stack trace.
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <AlertCircle className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Not authenticated</h3>
          <p className="mt-1 text-sm text-gray-500">Please log in to view registrations.</p>
        </div>
      </div>
    );
  }

  const registrations = registrationsQuery.data ?? [];

  const pendingCount = registrations.filter((r: any) => r.derivedStatus === "PENDING").length;
  const approvedCount = registrations.filter((r: any) => r.derivedStatus === "APPROVED").length;
  const activeCount = registrations.filter((r: any) => r.derivedStatus === "ACTIVE").length;
  const rejectedCount = registrations.filter((r: any) => r.derivedStatus === "REJECTED").length;

  const filteredRegistrations = useMemo(() => {
    const filtered = registrations.filter((r: any) => {
      if (selectedTab === "pending") return r.derivedStatus === "PENDING";
      if (selectedTab === "approved") return r.derivedStatus === "APPROVED";
      if (selectedTab === "rejected") return r.derivedStatus === "REJECTED";
      return r.derivedStatus === "ACTIVE";
    });

    return filtered.sort((a: any, b: any) => {
      const kindCmp = itemTypeSortKey(a.kind) - itemTypeSortKey(b.kind);
      if (kindCmp !== 0) return kindCmp;

      if (a.kind === "PM_CONTRACTOR_PACKAGE_REQUEST" || b.kind === "PM_CONTRACTOR_PACKAGE_REQUEST") {
        const pkgA = a.package?.displayName ?? "";
        const pkgB = b.package?.displayName ?? "";
        const pkgCmp = compareStrings(pkgA, pkgB);
        if (pkgCmp !== 0) return pkgCmp;

        const areaA = (a.contractor?.companyName ?? a.contractor?.email ?? "") as string;
        const areaB = (b.contractor?.companyName ?? b.contractor?.email ?? "") as string;
        const areaCmp = compareStrings(areaA, areaB);
        if (areaCmp !== 0) return areaCmp;

        return compareStrings(
          `${a.contractor?.lastName ?? ""} ${a.contractor?.firstName ?? ""}`,
          `${b.contractor?.lastName ?? ""} ${b.contractor?.firstName ?? ""}`
        );
      }

      const typeCmp = accountTypeSortKey(a.accountType) - accountTypeSortKey(b.accountType);
      if (typeCmp !== 0) return typeCmp;

      const pkgA = a.package?.displayName ?? "";
      const pkgB = b.package?.displayName ?? "";
      const pkgCmp = compareStrings(pkgA, pkgB);
      if (pkgCmp !== 0) return pkgCmp;

      const areaA = (a.companyName ?? a.email ?? "") as string;
      const areaB = (b.companyName ?? b.email ?? "") as string;
      const areaCmp = compareStrings(areaA, areaB);
      if (areaCmp !== 0) return areaCmp;

      return compareStrings(`${a.lastName ?? ""} ${a.firstName ?? ""}`, `${b.lastName ?? ""} ${b.firstName ?? ""}`);
    });
  }, [registrations, selectedTab]);

  const selectedRegistration =
    selectedRegistrationId != null
      ? registrations.find((r: any) => r.id === selectedRegistrationId) ?? null
      : null;

  const selectedRejectionEmailSent =
    selectedRegistration && typeof selectedRegistration.id === "number"
      ? lastRejectionEmailById[selectedRegistration.id]
      : undefined;

  const handleApprove = (regId: number) => {
    const password = prompt("Set initial password for user (min 6 characters):");
    if (!password || password.length < 6) return;

    const skipPayment = confirm("Skip payment verification? (Only if manually confirmed)");
    approveMutation.mutate({
      token: token!,
      registrationId: regId,
      password,
      skipPaymentCheck: skipPayment,
    });
  };

  const handleReject = (regId: number) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    rejectMutation.mutate({ token: token!, registrationId: regId, reason });
  };

  const handleMarkPaid = (regId: number) => {
    const paymentId = prompt("Enter payment reference/ID:");
    if (!paymentId) return;
    markPaidMutation.mutate({ token: token!, registrationId: regId, paymentId });
  };

  const handleApproveContractorPackageRequest = (requestId: number) => {
    const passwordInput = prompt(
      "Set initial password for contractor portal user (min 6 characters). Leave blank if user already exists:"
    );

    const password = passwordInput && passwordInput.trim().length ? passwordInput.trim() : undefined;
    if (password && password.length < 6) return;

    approveContractorPackageRequestMutation.mutate({
      token: token!,
      requestId,
      password,
    });
  };

  const handleRejectContractorPackageRequest = (requestId: number) => {
    const reason = prompt("Reason for rejection:");
    if (!reason) return;
    rejectContractorPackageRequestMutation.mutate({ token: token!, requestId, reason });
  };

  const tabs: Array<{ id: RegistrationsTab; label: string; count: number; icon: any }> = [
    { id: "pending", label: "Pending", count: pendingCount, icon: Clock },
    { id: "approved", label: "Approved", count: approvedCount, icon: CheckCircle },
    { id: "active", label: "Active", count: activeCount, icon: CheckCircle },
    { id: "rejected", label: "Rejected", count: rejectedCount, icon: XCircle },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Registration Management</h1>
      </div>

      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setSelectedTab(tab.id);
                setSelectedRegistrationId(null);
              }}
              className={`group inline-flex items-center border-b-2 py-4 px-1 text-sm font-medium ${
                selectedTab === tab.id
                  ? "border-cyan-500 text-cyan-600"
                  : "border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700"
              }`}
            >
              <tab.icon
                className={`-ml-0.5 mr-2 h-5 w-5 ${
                  selectedTab === tab.id ? "text-cyan-500" : "text-gray-400 group-hover:text-gray-500"
                }`}
              />
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-2 rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Registrations</div>
              <div className="text-xs text-gray-500">Sorted by type, package, and area</div>
            </div>

            <div className="divide-y divide-gray-200">
              {filteredRegistrations.map((reg: any) => {
                const isSelected = reg.id === selectedRegistrationId;
                const isContractorPackageRequest = reg.kind === "PM_CONTRACTOR_PACKAGE_REQUEST";
                return (
                  <button
                    key={reg.id}
                    onClick={() => setSelectedRegistrationId(reg.id)}
                    className={`w-full text-left px-4 py-3 hover:bg-gray-50 ${isSelected ? "bg-cyan-50" : ""}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="font-medium text-gray-900 truncate">
                          {isContractorPackageRequest
                            ? `${reg.contractor?.firstName ?? ""} ${reg.contractor?.lastName ?? ""}`
                            : `${reg.firstName} ${reg.lastName}`}
                        </div>
                        <div className="text-sm text-gray-600 truncate">{isContractorPackageRequest ? reg.contractor?.email : reg.email}</div>
                        <div className="text-xs text-gray-500 truncate">
                          {isContractorPackageRequest
                            ? `PM Contractor Package  ${reg.package?.displayName ?? "Unknown package"}  ${reg.propertyManager?.email ?? ""}`
                            : `${reg.accountType}  ${reg.package?.displayName ?? "Unknown package"}${reg.companyName ? `  ${reg.companyName}` : ""}`}
                        </div>
                      </div>
                      <div className="shrink-0 text-right">
                        <div className="text-xs font-semibold text-gray-700">{reg.derivedStatus}</div>
                        <div className="mt-1">
                          {isContractorPackageRequest ? (
                            <span className="inline-flex items-center gap-1 text-xs text-gray-700">
                              {reg.contractor?.portalAccessEnabled ? (
                                <>
                                  <CheckCircle className="h-4 w-4 text-green-600" /> Portal
                                </>
                              ) : (
                                <>
                                  <Clock className="h-4 w-4 text-gray-500" /> Email Only
                                </>
                              )}
                            </span>
                          ) : reg.hasPaid ? (
                            <span className="inline-flex items-center gap-1 text-xs text-green-700">
                              <CheckCircle className="h-4 w-4" /> Paid
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-red-700">
                              <XCircle className="h-4 w-4" /> Unpaid
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}

              {!filteredRegistrations.length && (
                <div className="px-4 py-10 text-center text-sm text-gray-500">No registrations found</div>
              )}
            </div>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="rounded-lg border border-gray-200 bg-white">
            <div className="border-b border-gray-200 px-4 py-3">
              <div className="text-sm font-medium text-gray-900">Details</div>
              <div className="text-xs text-gray-500">Select a registration to manage it</div>
            </div>

            {!selectedRegistration ? (
              <div className="px-4 py-10 text-center text-sm text-gray-500">No registration selected</div>
            ) : (
              <div className="px-4 py-4 space-y-4">
                {selectedRegistration.kind === "PM_CONTRACTOR_PACKAGE_REQUEST" ? (
                  <>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedRegistration.contractor?.firstName} {selectedRegistration.contractor?.lastName}
                      </div>
                      <div className="text-sm text-gray-600">{selectedRegistration.contractor?.email}</div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Request</span>
                        <span className="font-medium">Contractor Package Approval</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Property Manager</span>
                        <span className="font-medium">{selectedRegistration.propertyManager?.email ?? "-"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Package</span>
                        <span className="font-medium">{selectedRegistration.package?.displayName ?? "Unknown"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Portal Access</span>
                        <span className="font-medium">
                          {selectedRegistration.contractor?.portalAccessEnabled ? "Enabled" : "Email Only"}
                        </span>
                      </div>
                    </div>

                    {selectedRegistration.derivedStatus === "REJECTED" && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                        <div className="font-semibold">Rejected</div>
                        {selectedRegistration.rejectedAt && (
                          <div className="mt-1 text-xs text-red-700">
                            Rejected on {new Date(selectedRegistration.rejectedAt).toLocaleString()}
                          </div>
                        )}
                        {selectedRegistration.rejectionReason && (
                          <div className="mt-2 whitespace-pre-wrap text-red-900">{selectedRegistration.rejectionReason}</div>
                        )}
                        {typeof selectedRejectionEmailSent === "boolean" && (
                          <div className="mt-2 text-xs text-red-800">
                            Rejection email: {selectedRejectionEmailSent ? "Sent" : "Failed"}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedRegistration.subscription && (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="text-sm font-medium text-gray-900">Contractor Subscription</div>
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Status</span>
                            <span className="font-medium">{selectedRegistration.subscription.status}</span>
                          </div>
                          {selectedRegistration.subscription.nextBillingDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Next billing</span>
                              <span className="font-medium">
                                {new Date(selectedRegistration.subscription.nextBillingDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedRegistration.derivedStatus === "PENDING" && (
                      <div className="flex flex-col gap-2">
                        <button
                          onClick={() => handleApproveContractorPackageRequest(selectedRegistration.id)}
                          disabled={
                            approveContractorPackageRequestMutation.isPending ||
                            rejectContractorPackageRequestMutation.isPending ||
                            markPaidMutation.isPending ||
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve (Enable Portal)
                        </button>
                        <button
                          onClick={() => handleRejectContractorPackageRequest(selectedRegistration.id)}
                          disabled={
                            approveContractorPackageRequestMutation.isPending ||
                            rejectContractorPackageRequestMutation.isPending ||
                            markPaidMutation.isPending ||
                            approveMutation.isPending ||
                            rejectMutation.isPending
                          }
                          className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-lg font-semibold text-gray-900">
                        {selectedRegistration.firstName} {selectedRegistration.lastName}
                      </div>
                      <div className="text-sm text-gray-600">{selectedRegistration.email}</div>
                    </div>

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Type</span>
                        <span className="font-medium">{selectedRegistration.accountType}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Package</span>
                        <span className="font-medium">{selectedRegistration.package?.displayName ?? "Unknown"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Monthly Charge</span>
                        <span className="font-medium">
                          {selectedRegistration.subscription?.monthlyCharge != null
                            ? formatMoneyZAR(selectedRegistration.subscription.monthlyCharge)
                            : selectedRegistration.package
                              ? formatMoneyZAR(
                                  (selectedRegistration.package.basePrice ?? 0) +
                                    (selectedRegistration.additionalUsers ?? 0) *
                                      (selectedRegistration.package.additionalUserPrice ?? 0) +
                                    (selectedRegistration.additionalTenants ?? 0) *
                                      (selectedRegistration.package.additionalTenantPrice ?? 0)
                                )
                              : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-gray-500">Amount Due</span>
                        <span className="font-medium">
                          {selectedRegistration.subscription?.amountDue != null
                            ? formatMoneyZAR(selectedRegistration.subscription.amountDue)
                            : formatMoneyZAR(0)}
                        </span>
                      </div>
                    </div>

                    {selectedRegistration.derivedStatus === "REJECTED" && (
                      <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                        <div className="font-semibold">Rejected</div>
                        {selectedRegistration.rejectedAt && (
                          <div className="mt-1 text-xs text-red-700">
                            Rejected on {new Date(selectedRegistration.rejectedAt).toLocaleString()}
                          </div>
                        )}
                        {selectedRegistration.rejectionReason && (
                          <div className="mt-2 whitespace-pre-wrap text-red-900">{selectedRegistration.rejectionReason}</div>
                        )}
                        {typeof selectedRejectionEmailSent === "boolean" && (
                          <div className="mt-2 text-xs text-red-800">
                            Rejection email: {selectedRejectionEmailSent ? "Sent" : "Failed"}
                          </div>
                        )}
                      </div>
                    )}

                    {selectedRegistration.subscription && (
                      <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
                        <div className="text-sm font-medium text-gray-900">Subscription</div>
                        <div className="mt-2 space-y-1 text-sm text-gray-700">
                          <div className="flex items-center justify-between">
                            <span className="text-gray-500">Status</span>
                            <span className="font-medium">{selectedRegistration.subscription.status}</span>
                          </div>
                          {selectedRegistration.subscription.nextBillingDate && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Next billing</span>
                              <span className="font-medium">
                                {new Date(selectedRegistration.subscription.nextBillingDate).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                          {selectedRegistration.subscription.trialEndsAt && (
                            <div className="flex items-center justify-between">
                              <span className="text-gray-500">Trial ends</span>
                              <span className="font-medium">
                                {new Date(selectedRegistration.subscription.trialEndsAt).toLocaleDateString()}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {selectedRegistration.derivedStatus === "PENDING" && (
                      <div className="flex flex-col gap-2">
                        {!selectedRegistration.hasPaid && (
                          <button
                            onClick={() => handleMarkPaid(selectedRegistration.id)}
                            disabled={
                              markPaidMutation.isPending ||
                              approveMutation.isPending ||
                              rejectMutation.isPending ||
                              approveContractorPackageRequestMutation.isPending ||
                              rejectContractorPackageRequestMutation.isPending
                            }
                            className="w-full rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                          >
                            Mark as Paid
                          </button>
                        )}
                        <button
                          onClick={() => handleApprove(selectedRegistration.id)}
                          disabled={
                            markPaidMutation.isPending ||
                            approveMutation.isPending ||
                            rejectMutation.isPending ||
                            approveContractorPackageRequestMutation.isPending ||
                            rejectContractorPackageRequestMutation.isPending
                          }
                          className="w-full rounded-md bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(selectedRegistration.id)}
                          disabled={
                            markPaidMutation.isPending ||
                            approveMutation.isPending ||
                            rejectMutation.isPending ||
                            approveContractorPackageRequestMutation.isPending ||
                            rejectContractorPackageRequestMutation.isPending
                          }
                          className="w-full rounded-md bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </div>
                    )}

                    {selectedRegistration.derivedStatus !== "PENDING" && !selectedRegistration.subscription && (
                      <div className="rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
                        Approved registration has no linked subscription.
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
