import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Loader2,
  Sparkles,
  Building2,
  AlertTriangle,
} from "lucide-react";

export const Route = createFileRoute("/admin/jobs/needs-review/")({
  component: NeedsReviewPage,
});

function NeedsReviewPage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) {
    navigate({ to: "/" });
    return null;
  }

  const [statusFilter, setStatusFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [rejectModalOrderId, setRejectModalOrderId] = useState<number | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [approveNote, setApproveNote] = useState("");
  const [approvingId, setApprovingId] = useState<number | null>(null);

  const list = useQuery(trpc.adminListSelfInitiated.queryOptions({ token, status: statusFilter }));

  const approve = useMutation(trpc.adminApproveSelfInitiated.mutationOptions({
    onSuccess: () => {
      toast.success("Approved");
      qc.invalidateQueries({ queryKey: trpc.adminListSelfInitiated.queryKey() });
      setApprovingId(null); setApproveNote("");
    },
    onError: (e) => toast.error(e.message),
  }));

  const reject = useMutation(trpc.adminRejectSelfInitiated.mutationOptions({
    onSuccess: () => {
      toast.success("Rejected");
      qc.invalidateQueries({ queryKey: trpc.adminListSelfInitiated.queryKey() });
      setRejectModalOrderId(null); setRejectReason("");
    },
    onError: (e) => toast.error(e.message),
  }));

  const rows = (list.data as any[]) || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
            <Sparkles className="w-7 h-7 text-indigo-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Self-initiated jobs — review</h1>
              <p className="text-sm text-gray-500">Approve or reject artisan-started jobs</p>
            </div>
          </div>
          <div className="flex gap-2">
            {(["pending", "approved", "rejected", "all"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 text-sm rounded border ${statusFilter === s ? "bg-indigo-600 text-white border-indigo-600" : "bg-white"}`}
              >{s}</button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {list.isLoading ? (
          <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
        ) : rows.length === 0 ? (
          <div className="text-center py-10 text-gray-500">No jobs in this state.</div>
        ) : (
          <div className="space-y-3">
            {rows.map((o) => (
              <div key={o.id} className="bg-white rounded-lg shadow border p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-bold">{o.orderNumber}</span>
                      <span className={`text-xs px-2 py-0.5 rounded ${o.status === "CANCELLED" ? "bg-red-100 text-red-800" : "bg-indigo-100 text-indigo-800"}`}>{o.status}</span>
                      {o.clientOrderNumber && <span className="text-xs text-gray-500">PO: {o.clientOrderNumber}</span>}
                      <span className="text-xs text-gray-500">{o.orderNumberStatus}</span>
                    </div>
                    <div className="mt-1 text-sm">
                      <Building2 className="inline w-4 h-4 text-gray-400" /> {o.clientBuilding?.name ?? "—"}{" — "}{o.clientBuilding?.address ?? o.address}
                    </div>
                    <div className="mt-1 text-sm text-gray-700">{o.serviceType} · {o.description}</div>
                    {o.initiatedBy && (
                      <div className="mt-1 text-xs text-gray-500">
                        By {o.initiatedBy.firstName} {o.initiatedBy.lastName} ({o.initiatedBy.email})
                      </div>
                    )}
                    {Array.isArray(o.ohsRiskAssessments) && o.ohsRiskAssessments.length > 0 && (
                      <div className="mt-1 text-xs">
                        SSRA: {o.ohsRiskAssessments.map((r: any) => (
                          <span key={r.id} className="inline-block ml-1 px-1.5 py-0.5 bg-amber-50 text-amber-800 rounded border border-amber-200">
                            {r.reference} · {r.overallRisk}
                          </span>
                        ))}
                      </div>
                    )}
                    {o.noOrderReason && (
                      <div className="mt-1 text-xs text-orange-700 flex items-start gap-1">
                        <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                        {o.noOrderReason}
                      </div>
                    )}
                    {o.selfInitiatedRejectReason && (
                      <div className="mt-1 text-xs text-red-700">Rejected: {o.selfInitiatedRejectReason}</div>
                    )}
                  </div>
                  {statusFilter === "pending" && (
                    <div className="flex flex-col gap-1">
                      <button
                        onClick={() => setApprovingId(o.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-green-600 text-white rounded hover:bg-green-700"
                      ><CheckCircle2 className="w-4 h-4" /> Approve</button>
                      <button
                        onClick={() => setRejectModalOrderId(o.id)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs bg-red-600 text-white rounded hover:bg-red-700"
                      ><XCircle className="w-4 h-4" /> Reject</button>
                    </div>
                  )}
                </div>

                {approvingId === o.id && (
                  <div className="mt-3 pt-3 border-t bg-green-50 -mx-4 px-4 pb-3 rounded-b">
                    <label className="block text-xs text-gray-600 mb-1">Optional approval note</label>
                    <textarea value={approveNote} onChange={(e) => setApproveNote(e.target.value)} className="w-full px-2 py-1 text-sm border rounded h-16" />
                    <div className="mt-2 flex justify-end gap-2">
                      <button onClick={() => { setApprovingId(null); setApproveNote(""); }} className="px-3 py-1 text-xs border rounded">Cancel</button>
                      <button
                        disabled={approve.isPending}
                        onClick={() => approve.mutate({ token, orderId: o.id, note: approveNote || undefined })}
                        className="px-3 py-1 text-xs bg-green-600 text-white rounded disabled:opacity-50"
                      >
                        {approve.isPending ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                        Confirm approve
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal */}
      {rejectModalOrderId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-5 space-y-3 max-h-[90vh] overflow-y-auto">
            <h3 className="font-semibold text-lg">Reject this self-initiated job</h3>
            <p className="text-sm text-gray-600">The artisan will be notified with the reason.</p>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Reason..."
              className="w-full px-3 py-2 border rounded h-24"
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => { setRejectModalOrderId(null); setRejectReason(""); }} className="px-3 py-1.5 border rounded">Cancel</button>
              <button
                disabled={reject.isPending || rejectReason.trim().length < 3}
                onClick={() => reject.mutate({ token, orderId: rejectModalOrderId, reason: rejectReason })}
                className="px-3 py-1.5 bg-red-600 text-white rounded disabled:opacity-50"
              >
                {reject.isPending ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
                Reject
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
