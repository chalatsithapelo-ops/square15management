import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Edit,
  FileText,
  Loader2,
  Mail,
  Plus,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/property-manager/statements/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || user.role !== "PROPERTY_MANAGER") {
      throw redirect({
        to: "/",
        search: { redirect: location.href },
      });
    }
  },
  component: PropertyManagerStatementsPage,
});

type StatementView = "RECEIVED" | "ISSUED";

function PropertyManagerStatementsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [activeView, setActiveView] = useState<StatementView>("RECEIVED");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);
  const [sendingStatementId, setSendingStatementId] = useState<number | null>(null);
  const [markingViewedId, setMarkingViewedId] = useState<number | null>(null);

  const [showEditModal, setShowEditModal] = useState(false);
  const [editingStatement, setEditingStatement] = useState<any | null>(null);
  const [editClientName, setEditClientName] = useState("");
  const [editCustomerPhone, setEditCustomerPhone] = useState("");
  const [editAddress, setEditAddress] = useState("");
  const [editNotes, setEditNotes] = useState("");

  const formatDateInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  };

  const getDefaultPeriod = () => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: formatDateInput(start), end: formatDateInput(end) };
  };

  const [bulkPeriodStart, setBulkPeriodStart] = useState(() => getDefaultPeriod().start);
  const [bulkPeriodEnd, setBulkPeriodEnd] = useState(() => getDefaultPeriod().end);
  const [bulkNotes, setBulkNotes] = useState("");

  const [createClientEmail, setCreateClientEmail] = useState("");
  const [createPeriodStart, setCreatePeriodStart] = useState(() => getDefaultPeriod().start);
  const [createPeriodEnd, setCreatePeriodEnd] = useState(() => getDefaultPeriod().end);
  const [createNotes, setCreateNotes] = useState("");
  const [createSendToCustomer, setCreateSendToCustomer] = useState(false);

  const queryDefaults = {
    enabled: !!token,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  };

  const receivedQuery = useQuery(
    trpc.getStatements.queryOptions(
      {
        token: token || "",
        view: "RECEIVED",
      },
      queryDefaults
    )
  );

  const issuedQuery = useQuery(
    trpc.getStatements.queryOptions(
      {
        token: token || "",
        view: "ISSUED",
      },
      queryDefaults
    )
  );

  const managedTenantsQuery = useQuery(
    trpc.getTenantsOverview.queryOptions(
      {
        token: token || "",
        status: "ACTIVE",
      },
      {
        enabled: !!token && activeView === "ISSUED",
        staleTime: 30_000,
      }
    )
  );

  const statements = activeView === "RECEIVED" ? receivedQuery.data || [] : issuedQuery.data || [];

  const generateStatementPdfMutation = useMutation(
    trpc.generateStatementPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const statement = statements.find((s: any) => s.id === variables.statementId);
        link.download = `statement-${statement?.statement_number || variables.statementId}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success("Statement PDF downloaded successfully!");
        setGeneratingPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to download statement PDF");
        setGeneratingPdfId(null);
      },
    })
  );

  const updateStatementDetailsMutation = useMutation(
    trpc.updateStatementDetails.mutationOptions({
      onSuccess: async () => {
        toast.success("Statement updated successfully!");
        setShowEditModal(false);
        setEditingStatement(null);
        await queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to update statement");
      },
    })
  );

  const sendStatementEmailMutation = useMutation(
    trpc.sendStatementEmail.mutationOptions({
      onSuccess: async () => {
        toast.success("Statement email sent!");
        setSendingStatementId(null);
        await queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to send statement email");
        setSendingStatementId(null);
      },
    })
  );

  const markStatementViewedMutation = useMutation(
    trpc.markStatementViewed.mutationOptions({
      onSuccess: async () => {
        toast.success("Marked as viewed");
        setMarkingViewedId(null);
        await queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to mark as viewed");
        setMarkingViewedId(null);
      },
    })
  );

  const generateManagedCustomerStatementsMutation = useMutation(
    trpc.generateManagedCustomerStatements.mutationOptions({
      onSuccess: async (data) => {
        toast.success(`Draft generation started for ${data.created} customer(s)`);
        await queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate draft statements");
      },
    })
  );

  const generateSingleStatementMutation = useMutation(
    trpc.generateStatement.mutationOptions({
      onSuccess: async () => {
        toast.success("Statement generation started");
        await queryClient.invalidateQueries({ queryKey: trpc.getStatements.queryKey() });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to generate statement");
      },
    })
  );

  const handleDownloadPdf = (statementId: number) => {
    if (!token) return;
    setGeneratingPdfId(statementId);
    generateStatementPdfMutation.mutate({
      token,
      statementId,
    });
  };

  const handleEditStatement = (statement: any) => {
    setEditingStatement(statement);
    setEditClientName(statement.client_name || "");
    setEditCustomerPhone(statement.customerPhone || "");
    setEditAddress(statement.address || "");
    setEditNotes(statement.notes || "");
    setShowEditModal(true);
  };

  const handleSaveEdits = () => {
    if (!token || !editingStatement) return;

    updateStatementDetailsMutation.mutate({
      token,
      statementId: editingStatement.id,
      client_name: editClientName,
      customerPhone: editCustomerPhone,
      address: editAddress,
      notes: editNotes,
    });
  };

  const handleSendStatement = (statementId: number) => {
    if (!token) return;
    setSendingStatementId(statementId);
    sendStatementEmailMutation.mutate({ token, statementId });
  };

  const handleMarkViewed = (statementId: number) => {
    if (!token) return;
    setMarkingViewedId(statementId);
    markStatementViewedMutation.mutate({ token, statementId });
  };

  const handleGenerateDrafts = () => {
    if (!token) return;
    if (!bulkPeriodStart || !bulkPeriodEnd) {
      toast.error("Please select a start and end date");
      return;
    }
    generateManagedCustomerStatementsMutation.mutate({
      token,
      period_start: bulkPeriodStart,
      period_end: bulkPeriodEnd,
      notes: bulkNotes || undefined,
    });
  };

  const handleCreateStatement = () => {
    if (!token) return;
    if (!createClientEmail) {
      toast.error("Please select a client/tenant");
      return;
    }
    if (!createPeriodStart || !createPeriodEnd) {
      toast.error("Please select a start and end date");
      return;
    }

    const tenants = (managedTenantsQuery.data as any)?.tenants ?? [];
    const tenant = tenants.find((t: any) => t.email === createClientEmail);

    generateSingleStatementMutation.mutate({
      token,
      client_email: createClientEmail,
      period_start: new Date(createPeriodStart).toISOString(),
      period_end: new Date(createPeriodEnd).toISOString(),
      customerName: tenant ? `${tenant.firstName} ${tenant.lastName}` : undefined,
      customerPhone: tenant?.phone || undefined,
      address: tenant?.address || undefined,
      notes: createNotes || undefined,
      sendToCustomer: createSendToCustomer,
    });
  };

  const viewMeta = useMemo(
    () =>
      ({
        RECEIVED: {
          label: "Statements Received",
          description: "Statements addressed to you (typically from contractors/suppliers).",
          icon: Mail,
        },
        ISSUED: {
          label: "Statements Issued",
          description: "Statements issued to customers/tenants you manage.",
          icon: Receipt,
        },
      }) satisfies Record<StatementView, { label: string; description: string; icon: any }>,
    []
  );

  const active = viewMeta[activeView];
  const Icon = active.icon;

  const isLoading = activeView === "RECEIVED" ? receivedQuery.isLoading : issuedQuery.isLoading;
  const error = activeView === "RECEIVED" ? receivedQuery.error : issuedQuery.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-blue-50/30">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/property-manager/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                <h1 className="text-xl font-semibold text-gray-900">Statements</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView("RECEIVED")}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeView === "RECEIVED"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Received
              </button>
              <button
                type="button"
                onClick={() => setActiveView("ISSUED")}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeView === "ISSUED"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Issued
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-50 border border-teal-100">
                <Icon className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{active.label}</h2>
                <p className="text-sm text-gray-600 mt-1">{active.description}</p>
              </div>
            </div>

            {activeView === "ISSUED" && (
              <div className="w-full max-w-xl">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Period start</label>
                    <input
                      type="date"
                      value={bulkPeriodStart}
                      onChange={(e) => setBulkPeriodStart(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Period end</label>
                    <input
                      type="date"
                      value={bulkPeriodEnd}
                      onChange={(e) => setBulkPeriodEnd(e.target.value)}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={handleGenerateDrafts}
                      disabled={generateManagedCustomerStatementsMutation.isPending}
                      className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                    >
                      {generateManagedCustomerStatementsMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <FileText className="h-4 w-4" />
                      )}
                      Generate drafts
                    </button>
                  </div>
                </div>
                <div className="mt-3">
                  <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                  <input
                    type="text"
                    value={bulkNotes}
                    onChange={(e) => setBulkNotes(e.target.value)}
                    placeholder="Notes to include on all statements"
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                  />
                </div>

                <div className="mt-5 pt-5 border-t border-gray-200">
                  <div className="flex items-center gap-2 mb-3">
                    <Plus className="h-4 w-4 text-teal-700" />
                    <p className="text-sm font-semibold text-gray-900">Create a statement for a single tenant</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div className="sm:col-span-2">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Client/Tenant</label>
                      <select
                        value={createClientEmail}
                        onChange={(e) => setCreateClientEmail(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      >
                        <option value="">Select…</option>
                        {((managedTenantsQuery.data as any)?.tenants ?? []).map((t: any) => (
                          <option key={t.id} value={t.email}>
                            {t.firstName} {t.lastName} — {t.email}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Period start</label>
                      <input
                        type="date"
                        value={createPeriodStart}
                        onChange={(e) => setCreatePeriodStart(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-700 mb-1">Period end</label>
                      <input
                        type="date"
                        value={createPeriodEnd}
                        onChange={(e) => setCreatePeriodEnd(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-3">
                      <label className="block text-xs font-medium text-gray-700 mb-1">Notes (optional)</label>
                      <input
                        type="text"
                        value={createNotes}
                        onChange={(e) => setCreateNotes(e.target.value)}
                        placeholder="Note for this statement"
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm"
                      />
                    </div>
                    <div className="sm:col-span-1 flex items-end">
                      <button
                        type="button"
                        onClick={handleCreateStatement}
                        disabled={generateSingleStatementMutation.isPending}
                        className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-60"
                      >
                        {generateSingleStatementMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                        Create
                      </button>
                    </div>
                    <div className="sm:col-span-4">
                      <label className="inline-flex items-center gap-2 text-xs text-gray-700">
                        <input
                          type="checkbox"
                          checked={createSendToCustomer}
                          onChange={(e) => setCreateSendToCustomer(e.target.checked)}
                          className="rounded border-gray-300"
                        />
                        Send to customer immediately (otherwise create as draft)
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="mt-6">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading statements…
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600">{(error as any).message || "Failed to load statements"}</div>
            )}

            {!isLoading && !error && statements.length === 0 && (
              <div className="text-sm text-gray-600">No statements found.</div>
            )}

            {!isLoading && !error && statements.length > 0 && (
              <div className="overflow-x-auto scrollbar-none touch-pan-x">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-3 pr-4 font-medium">Statement</th>
                      <th className="py-3 pr-4 font-medium">Client</th>
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">Total Due</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-0 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statements.map((s: any) => (
                      <tr key={s.id} className="text-gray-900">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="font-medium">{s.statement_number}</div>
                          <div className="text-xs text-gray-500">{new Date(s.statement_date).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium">{s.client_name || "—"}</div>
                          <div className="text-xs text-gray-500">{s.client_email}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                          {new Date(s.period_start).toLocaleDateString()} – {new Date(s.period_end).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                          {(s.total_amount_due ?? 0).toLocaleString(undefined, {
                            style: "currency",
                            currency: "ZAR",
                          })}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="py-3 pr-0 whitespace-nowrap text-right">
                          <div className="inline-flex items-center gap-2">
                            {activeView === "ISSUED" && (
                              <>
                                <button
                                  type="button"
                                  onClick={() => handleEditStatement(s)}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700"
                                >
                                  <Edit className="h-4 w-4" />
                                  Edit
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleSendStatement(s.id)}
                                  disabled={sendingStatementId === s.id || sendStatementEmailMutation.isPending}
                                  className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                                >
                                  {sendingStatementId === s.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Mail className="h-4 w-4" />
                                  )}
                                  Send
                                </button>
                              </>
                            )}

                            {activeView === "RECEIVED" && s.status !== "viewed" && (
                              <button
                                type="button"
                                onClick={() => handleMarkViewed(s.id)}
                                disabled={markingViewedId === s.id || markStatementViewedMutation.isPending}
                                className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                              >
                                {markingViewedId === s.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="h-4 w-4" />
                                )}
                                Mark viewed
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => handleDownloadPdf(s.id)}
                              disabled={generatingPdfId === s.id || generateStatementPdfMutation.isPending}
                              className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                            >
                              {generatingPdfId === s.id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Download className="h-4 w-4" />
                              )}
                              Download
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
        </div>
      </main>

      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => {
              if (!updateStatementDetailsMutation.isPending) {
                setShowEditModal(false);
                setEditingStatement(null);
              }
            }}
          />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Edit statement details</h3>
                <p className="text-sm text-gray-600 mt-1">
                  Amend customer details and notes before sending.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!updateStatementDetailsMutation.isPending) {
                    setShowEditModal(false);
                    setEditingStatement(null);
                  }
                }}
                disabled={updateStatementDetailsMutation.isPending}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
              >
                ✕
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Client name</label>
                <input
                  type="text"
                  value={editClientName}
                  onChange={(e) => setEditClientName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="text"
                  value={editCustomerPhone}
                  onChange={(e) => setEditCustomerPhone(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                <input
                  type="text"
                  value={editAddress}
                  onChange={(e) => setEditAddress(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200"
                />
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowEditModal(false);
                  setEditingStatement(null);
                }}
                disabled={updateStatementDetailsMutation.isPending}
                className="px-4 py-2 rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSaveEdits}
                disabled={updateStatementDetailsMutation.isPending}
                className="px-4 py-2 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 inline-flex items-center gap-2"
              >
                {updateStatementDetailsMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  type StatementStatus = "generated" | "sent" | "viewed" | "paid" | "overdue";
  const meta: Record<StatementStatus, { label: string; className: string }> = {
    generated: { label: "Generated", className: "bg-blue-50 text-blue-700 border-blue-200" },
    sent: { label: "Sent", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    viewed: { label: "Viewed", className: "bg-gray-50 text-gray-700 border-gray-200" },
    paid: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
    overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200" },
  };

  const knownStatuses = ["generated", "sent", "viewed", "paid", "overdue"] as const;
  const statusKey: StatementStatus = (knownStatuses as readonly string[]).includes(status)
    ? (status as StatementStatus)
    : "generated";

  const badge = meta[statusKey];
  if (!badge) return null;

  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${badge.className}`}>
      {badge.label}
    </span>
  );
}
