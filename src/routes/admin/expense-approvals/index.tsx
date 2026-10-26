import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, CheckCircle2, AlertTriangle, XCircle, Loader2, ExternalLink, Receipt, Filter, MapPin, CreditCard } from "lucide-react";

export const Route = createFileRoute("/admin/expense-approvals/")({
  component: ExpenseApprovalsPage,
});

const ZAR = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(n ?? 0);

const STATES = ["DRAFT", "SUBMITTED", "APPROVED", "POSTED", "DISPUTED", "REJECTED"] as const;
const PAYMENT_METHODS = ["TM_CARD", "COMPANY_CARD", "OWN_CASH", "PETTY_CASH", "ARTISAN_CLAIM"] as const;

function ExpenseApprovalsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const [stateFilter, setStateFilter] = useState<string>("SUBMITTED");
  const [paymentFilter, setPaymentFilter] = useState<string>("");

  const listQuery = useQuery(trpc.adminListExpenseSlipsForReview.queryOptions({
    token: token!,
    state: stateFilter || undefined as any,
    paymentMethod: paymentFilter || undefined as any,
    limit: 100,
  } as any));

  const approve = useMutation(trpc.adminApproveExpenseSlip.mutationOptions({
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: [["adminListExpenseSlipsForReview"]] }); },
    onError: (e) => toast.error(e.message),
  }));
  const dispute = useMutation(trpc.adminDisputeExpenseSlip.mutationOptions({
    onSuccess: () => { toast.success("Disputed"); qc.invalidateQueries({ queryKey: [["adminListExpenseSlipsForReview"]] }); },
    onError: (e) => toast.error(e.message),
  }));
  const reject = useMutation(trpc.adminRejectExpenseSlip.mutationOptions({
    onSuccess: () => { toast.success("Rejected"); qc.invalidateQueries({ queryKey: [["adminListExpenseSlipsForReview"]] }); },
    onError: (e) => toast.error(e.message),
  }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Expense Approvals</h1>
            <p className="text-sm text-slate-600">Review artisan-submitted receipts, approve into the TM statement, or dispute.</p>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex flex-wrap items-end gap-3">
          <Filter className="w-4 h-4 text-slate-400 mb-2.5" />
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">State</label>
            <select value={stateFilter} onChange={(e) => setStateFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All</option>
              {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Payment method</label>
            <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              <option value="">All</option>
              {PAYMENT_METHODS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </div>
        </div>

        {/* List */}
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {listQuery.isLoading && (
            <div className="px-4 py-12 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading…</div>
          )}
          {listQuery.data?.length === 0 && (
            <div className="px-4 py-12 text-center text-slate-400 italic">Nothing to review 🎉</div>
          )}
          <ul className="divide-y divide-slate-100">
            {listQuery.data?.map((s: any) => (
              <SlipRow key={s.id} slip={s} onApprove={() => approve.mutate({ token: token!, id: s.id })} onDispute={(reason) => dispute.mutate({ token: token!, id: s.id, reason })} onReject={(reason) => reject.mutate({ token: token!, id: s.id, reason })} />
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

function SlipRow({ slip, onApprove, onDispute, onReject }: { slip: any; onApprove: () => void; onDispute: (reason: string) => void; onReject: (reason: string) => void }) {
  const [reason, setReason] = useState("");
  const [showReason, setShowReason] = useState<"dispute" | "reject" | null>(null);

  const stateBadge = (s: string) => {
    const cls: Record<string, string> = {
      SUBMITTED: "bg-blue-100 text-blue-800",
      APPROVED: "bg-emerald-100 text-emerald-800",
      POSTED: "bg-indigo-100 text-indigo-800",
      DISPUTED: "bg-amber-100 text-amber-800",
      REJECTED: "bg-rose-100 text-rose-800",
      DRAFT: "bg-slate-100 text-slate-600",
    };
    return <span className={`text-[10px] uppercase tracking-wide font-bold rounded px-2 py-0.5 ${cls[s] ?? "bg-slate-100"}`}>{s}</span>;
  };

  return (
    <li className="px-4 py-3 hover:bg-slate-50">
      <div className="flex items-start gap-4">
        <a href={slip.url} target="_blank" rel="noreferrer" className="shrink-0 w-20 h-20 bg-slate-100 rounded-lg overflow-hidden border border-slate-200 flex items-center justify-center hover:border-indigo-400">
          {/\.(jpe?g|png|gif|webp)$/i.test(slip.url) ? (
            <img src={slip.url} alt="receipt" className="w-full h-full object-cover" />
          ) : (
            <Receipt className="w-8 h-8 text-slate-400" />
          )}
        </a>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-slate-900">{ZAR(slip.amount)}</span>
            <span className="text-xs text-slate-500">excl: {ZAR(slip.amountExclVat)}</span>
            {stateBadge(slip.state)}
            <span className="text-xs text-slate-500">·</span>
            <span className="text-xs font-mono text-slate-600">{slip.category}</span>
            {slip.paymentMethod && (
              <span className="text-xs text-slate-700 inline-flex items-center gap-1">
                <CreditCard className="w-3 h-3" />
                {slip.paymentMethod}{slip.cardLast4 ? ` ****${slip.cardLast4}` : ""}
              </span>
            )}
          </div>

          <div className="text-sm text-slate-700 mt-1">
            <Link to={"/admin/operations" as any} className="text-indigo-600 hover:underline font-mono text-xs">
              {slip.order?.orderNumber} <ExternalLink className="w-3 h-3 inline" />
            </Link>
            {" · "}
            <span>{slip.supplierName ?? "—"}</span>
            {slip.description ? <span className="text-slate-500"> · {slip.description}</span> : null}
          </div>

          <div className="text-xs text-slate-500 mt-1 flex flex-wrap items-center gap-3">
            <span>Submitted by: {slip.submittedBy ? `${slip.submittedBy.firstName} ${slip.submittedBy.lastName}` : "—"}</span>
            <span>Purchased: {slip.purchasedAt ? new Date(slip.purchasedAt).toLocaleDateString("en-ZA") : "—"}</span>
            {(slip.gpsLat != null && slip.gpsLng != null) && (
              <a href={`https://maps.google.com/?q=${slip.gpsLat},${slip.gpsLng}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-indigo-600 hover:underline">
                <MapPin className="w-3 h-3" /> GPS
              </a>
            )}
            {slip.disputedReason && <span className="text-amber-700">Disputed: {slip.disputedReason}</span>}
          </div>
        </div>

        <div className="shrink-0 flex flex-col gap-1">
          {(slip.state === "SUBMITTED" || slip.state === "DISPUTED") && (
            <>
              <button onClick={onApprove} className="inline-flex items-center gap-1 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium">
                <CheckCircle2 className="w-3.5 h-3.5" /> Approve
              </button>
              <button onClick={() => setShowReason("dispute")} className="inline-flex items-center gap-1 px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded text-xs font-medium">
                <AlertTriangle className="w-3.5 h-3.5" /> Dispute
              </button>
              <button onClick={() => setShowReason("reject")} className="inline-flex items-center gap-1 px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded text-xs font-medium">
                <XCircle className="w-3.5 h-3.5" /> Reject
              </button>
            </>
          )}
        </div>
      </div>

      {showReason && (
        <div className="mt-3 pl-24">
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={`Reason for ${showReason}…`}
            rows={2}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex justify-end gap-2 mt-2">
            <button onClick={() => { setShowReason(null); setReason(""); }} className="text-xs text-slate-500">Cancel</button>
            <button
              onClick={() => {
                if (reason.trim().length < 3) { toast.error("Reason ≥ 3 chars required"); return; }
                if (showReason === "dispute") onDispute(reason); else onReject(reason);
                setShowReason(null); setReason("");
              }}
              className={`px-3 py-1 text-xs font-medium text-white rounded ${showReason === "dispute" ? "bg-amber-600" : "bg-rose-600"}`}
            >Confirm {showReason}</button>
          </div>
        </div>
      )}
    </li>
  );
}
