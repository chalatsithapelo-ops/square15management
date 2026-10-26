import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import { ArrowLeft, Plus, Loader2, Trash2, ShieldCheck, Clock, Calendar, Percent, Ban } from "lucide-react";

export const Route = createFileRoute("/admin/commission-rules/")({
  component: CommissionRulesPage,
});

const ZAR = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 0 }).format(n ?? 0);

type RateType = "PERCENT" | "HOURLY" | "DAILY" | "NONE";
const RATE_TYPE_LABEL: Record<RateType, string> = {
  PERCENT: "% of profit",
  HOURLY: "R per hour",
  DAILY: "R per day",
  NONE: "No commission",
};
const RATE_TYPE_ICON: Record<RateType, JSX.Element> = {
  PERCENT: <Percent className="w-3.5 h-3.5" />,
  HOURLY: <Clock className="w-3.5 h-3.5" />,
  DAILY: <Calendar className="w-3.5 h-3.5" />,
  NONE: <Ban className="w-3.5 h-3.5" />,
};

function formatRate(rateType: RateType, rateValue: number): string {
  switch (rateType) {
    case "PERCENT": return `${(rateValue * 100).toFixed(0)}%`;
    case "HOURLY": return `${ZAR(rateValue)}/hr`;
    case "DAILY": return `${ZAR(rateValue)}/day`;
    case "NONE": return "—";
  }
}

function CommissionRulesPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  const candidatesQuery = useQuery(trpc.adminListTmCandidates.queryOptions({ token: token! }));
  const candidates = candidatesQuery.data ?? [];

  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);

  const rulesQuery = useQuery({
    ...trpc.adminListCommissionRules.queryOptions({ token: token!, userId: selectedUserId ?? undefined }),
    enabled: true,
  });

  const upsert = useMutation(trpc.adminUpsertCommissionRule.mutationOptions({
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: [["adminListCommissionRules"]] });
      qc.invalidateQueries({ queryKey: [["adminListTmCandidates"]] });
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  }));

  const deactivate = useMutation(trpc.adminDeactivateCommissionRule.mutationOptions({
    onSuccess: () => {
      toast.success("Rule deactivated");
      qc.invalidateQueries({ queryKey: [["adminListCommissionRules"]] });
    },
    onError: (e) => toast.error(e.message),
  }));

  const del = useMutation(trpc.adminDeleteCommissionRule.mutationOptions({
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [["adminListCommissionRules"]] });
    },
    onError: (e) => toast.error(e.message),
  }));

  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const toggleSelected = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const [editing, setEditing] = useState<null | {
    id?: number;
    userId: number;
    role: "TM" | "SITE_LEAD" | "OPS" | "SALES_AGENT";
    rate: number;
    approvalThreshold: number;
    openRateType: RateType;
    openRateValue: number;
    quotedRateType: RateType;
    quotedRateValue: number;
    effectiveFrom?: string;
    notes?: string;
  }>(null);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/40">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="flex items-center gap-3 mb-6">
          <Link to="/admin/dashboard" className="text-slate-500 hover:text-slate-700"><ArrowLeft className="w-5 h-5" /></Link>
          <div className="flex-1">
            <h1 className="text-2xl font-bold text-slate-900">Commission Rules</h1>
            <p className="text-sm text-slate-600">Per-user commission rates with effective dates. Auto-approval threshold lets artisans add expenses up to a cap without admin review.</p>
          </div>
          <button
            onClick={() => setEditing({
              userId: selectedUserId ?? (candidates[0]?.id ?? 0),
              role: "TM",
              rate: 0.35,
              approvalThreshold: 5000,
              openRateType: "PERCENT",
              openRateValue: 0.35,
              quotedRateType: "PERCENT",
              quotedRateValue: 0.35,
            })}
            disabled={candidates.length === 0}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white rounded-lg text-sm font-medium"
          >
            <Plus className="w-4 h-4" /> New rule
          </button>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 mb-4 flex items-center gap-3">
          <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide">User</label>
          <select
            value={selectedUserId ?? ""}
            onChange={(e) => setSelectedUserId(Number(e.target.value) || null)}
            className="border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="">All users</option>
            {candidates.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {selectedIds.size > 0 && (
            <div className="px-4 py-2 bg-rose-50 border-b border-rose-200 flex items-center justify-between text-sm">
              <span className="text-rose-900 font-medium">{selectedIds.size} rule{selectedIds.size === 1 ? "" : "s"} selected</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setSelectedIds(new Set())}
                  className="text-xs px-3 py-1.5 text-slate-600 hover:text-slate-900"
                >Clear</button>
                <button
                  onClick={async () => {
                    if (!confirm(`Permanently delete ${selectedIds.size} commission rule${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`)) return;
                    const ids = Array.from(selectedIds);
                    let ok = 0; let failed = 0;
                    for (const id of ids) {
                      try {
                        await del.mutateAsync({ token: token!, id });
                        ok++;
                      } catch { failed++; }
                    }
                    setSelectedIds(new Set());
                    if (failed === 0) toast.success(`Deleted ${ok} rule${ok === 1 ? "" : "s"}`);
                    else toast.error(`${ok} deleted, ${failed} refused (see individual errors)`);
                  }}
                  disabled={del.isPending}
                  className="text-xs px-3 py-1.5 bg-rose-600 hover:bg-rose-700 disabled:bg-slate-300 text-white rounded-md font-medium inline-flex items-center gap-1"
                ><Trash2 className="w-3.5 h-3.5" /> Delete selected</button>
              </div>
            </div>
          )}
          <table className="min-w-full text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-600">
              <tr>
                <th className="px-3 py-2 w-8">
                  <input
                    type="checkbox"
                    checked={(rulesQuery.data?.length ?? 0) > 0 && selectedIds.size === rulesQuery.data?.length}
                    onChange={(e) => {
                      if (e.target.checked) setSelectedIds(new Set(rulesQuery.data?.map((r: any) => r.id) ?? []));
                      else setSelectedIds(new Set());
                    }}
                  />
                </th>
                <th className="text-left px-4 py-2">User</th>
                <th className="text-left px-4 py-2">Role</th>
                <th className="text-left px-4 py-2">Open orders</th>
                <th className="text-left px-4 py-2">Quoted orders</th>
                <th className="text-right px-4 py-2">Approval threshold</th>
                <th className="text-left px-4 py-2">Effective</th>
                <th className="text-left px-4 py-2">Notes</th>
                <th className="text-right px-4 py-2"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rulesQuery.isLoading && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-slate-400"><Loader2 className="w-5 h-5 animate-spin inline-block mr-2" /> Loading…</td></tr>
              )}
              {rulesQuery.data?.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-10 text-center text-slate-400 italic">No commission rules yet — click "New rule"</td></tr>
              )}
              {rulesQuery.data?.map((r: any) => {
                const openRT = (r.openRateType ?? "PERCENT") as RateType;
                const quotedRT = (r.quotedRateType ?? "PERCENT") as RateType;
                return (
                <tr key={r.id} className={r.effectiveTo == null ? "" : "opacity-60"}>
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleSelected(r.id)}
                    />
                  </td>
                  <td className="px-4 py-2">{r.user.firstName} {r.user.lastName} <span className="text-xs text-slate-500">· {r.user.email}</span></td>
                  <td className="px-4 py-2"><span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{r.role}</span></td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-emerald-50 text-emerald-800 px-2 py-0.5 rounded-full">
                      {RATE_TYPE_ICON[openRT]}
                      <span className="font-semibold">{formatRate(openRT, r.openRateValue ?? r.rate)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2">
                    <span className="inline-flex items-center gap-1 text-xs bg-violet-50 text-violet-800 px-2 py-0.5 rounded-full">
                      {RATE_TYPE_ICON[quotedRT]}
                      <span className="font-semibold">{formatRate(quotedRT, r.quotedRateValue ?? r.rate)}</span>
                    </span>
                  </td>
                  <td className="px-4 py-2 text-right tabular-nums">{ZAR(r.approvalThreshold)}</td>
                  <td className="px-4 py-2 text-xs">
                    {new Date(r.effectiveFrom).toISOString().slice(0, 10)}
                    {" → "}
                    {r.effectiveTo ? new Date(r.effectiveTo).toISOString().slice(0, 10) : <span className="text-emerald-600 font-semibold">active</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-slate-600 max-w-[240px] truncate">{r.notes ?? "—"}</td>
                  <td className="px-4 py-2 text-right">
                    <button
                      onClick={() => setEditing({
                        id: r.id,
                        userId: r.userId,
                        role: r.role,
                        rate: r.rate,
                        approvalThreshold: r.approvalThreshold,
                        openRateType: openRT,
                        openRateValue: r.openRateValue ?? r.rate,
                        quotedRateType: quotedRT,
                        quotedRateValue: r.quotedRateValue ?? r.rate,
                        effectiveFrom: new Date(r.effectiveFrom).toISOString().slice(0, 10),
                        notes: r.notes ?? "",
                      })}
                      className="text-indigo-600 hover:underline text-xs mr-3"
                    >Edit</button>
                    {r.effectiveTo == null && (
                      <button
                        onClick={() => {
                          if (!confirm("Deactivate this rule? (User reverts to default 35% / no auto-approve unless another active rule exists)")) return;
                          deactivate.mutate({ token: token!, id: r.id });
                        }}
                        className="text-rose-600 hover:underline text-xs mr-3"
                      ><Trash2 className="w-3.5 h-3.5 inline" /> Deactivate</button>
                    )}
                    <button
                      onClick={() => {
                        if (!confirm("Permanently delete this commission rule? This cannot be undone.")) return;
                        del.mutate({ token: token!, id: r.id }, {
                          onSuccess: () => toast.success("Rule deleted"),
                        });
                      }}
                      disabled={del.isPending}
                      className="text-rose-700 hover:underline text-xs font-medium"
                    ><Trash2 className="w-3.5 h-3.5 inline" /> Delete</button>
                  </td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Edit modal */}
        {editing && (
          <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg font-bold mb-1 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-indigo-600" /> {editing.id ? "Edit rule" : "New commission rule"}</h3>
              <p className="text-xs text-slate-500 mb-4">Saving a new rule for a user auto-closes the previous active one at today's date.</p>

              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">User</label>
                  <select
                    value={editing.userId}
                    onChange={(e) => setEditing({ ...editing, userId: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    disabled={!!editing.id}
                  >
                    {candidates.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.email}</option>)}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="col-span-2">
                    <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Role</label>
                    <select
                      value={editing.role}
                      onChange={(e) => setEditing({ ...editing, role: e.target.value as any })}
                      className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    >
                      <option value="TM">Technical Manager</option>
                      <option value="SITE_LEAD">Site Lead</option>
                      <option value="OPS">Operations</option>
                      <option value="SALES_AGENT">Sales Agent</option>
                    </select>
                  </div>
                </div>

                {/* PR-7b — per-order-kind rate strategy */}
                <RateStrategyEditor
                  label="OPEN orders (no quotation attached)"
                  accent="emerald"
                  rateType={editing.openRateType}
                  rateValue={editing.openRateValue}
                  onChange={(rt, rv) => setEditing({ ...editing, openRateType: rt, openRateValue: rv })}
                />
                <RateStrategyEditor
                  label="QUOTED orders (quotation linked)"
                  accent="violet"
                  rateType={editing.quotedRateType}
                  rateValue={editing.quotedRateValue}
                  onChange={(rt, rv) => setEditing({ ...editing, quotedRateType: rt, quotedRateValue: rv })}
                />

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Auto-approval threshold (ZAR)</label>
                  <input
                    type="number"
                    step="100"
                    min="0"
                    value={editing.approvalThreshold}
                    onChange={(e) => setEditing({ ...editing, approvalThreshold: Number(e.target.value) })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 mt-1">Artisan expenses up to this amount auto-approve without admin review. Anything above goes to the approval queue.</p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Effective from</label>
                  <input
                    type="date"
                    value={editing.effectiveFrom ?? new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setEditing({ ...editing, effectiveFrom: e.target.value })}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                  />
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-600 uppercase tracking-wide block mb-1">Notes</label>
                  <textarea
                    value={editing.notes ?? ""}
                    onChange={(e) => setEditing({ ...editing, notes: e.target.value })}
                    rows={2}
                    className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
                    placeholder="Optional reason / context"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 mt-6">
                <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-slate-600 hover:text-slate-900">Cancel</button>
                <button
                  onClick={() => {
                    // Ensure legacy `rate` (0..1 fraction) stays valid even when
                    // the visible strategy is flat-rate (HOURLY/DAILY) or NONE.
                    // Fall back to the QUOTED percent, then OPEN percent, then 0.
                    const legacyRate =
                      editing.quotedRateType === "PERCENT" ? Math.min(1, Math.max(0, editing.quotedRateValue))
                      : editing.openRateType === "PERCENT" ? Math.min(1, Math.max(0, editing.openRateValue))
                      : Math.min(1, Math.max(0, editing.rate));
                    upsert.mutate({ token: token!, ...editing, rate: legacyRate });
                  }}
                  disabled={upsert.isPending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:bg-slate-300"
                >
                  {upsert.isPending ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// PR-7b — Reusable editor for one (rateType, rateValue) pair used twice in the
// modal (once for OPEN orders, once for QUOTED orders).
function RateStrategyEditor({ label, accent, rateType, rateValue, onChange }: {
  label: string;
  accent: "emerald" | "violet";
  rateType: RateType;
  rateValue: number;
  onChange: (rt: RateType, rv: number) => void;
}) {
  const ring = accent === "emerald" ? "border-emerald-200 bg-emerald-50/40" : "border-violet-200 bg-violet-50/40";
  const dot = accent === "emerald" ? "bg-emerald-500" : "bg-violet-500";

  // Display value: percent rules are stored as fractions (0.35) but shown as
  // percents (35). Flat rates (HOURLY/DAILY) are shown raw in ZAR.
  const displayValue = rateType === "PERCENT" ? (rateValue * 100).toString() : rateValue.toString();
  const handleValueChange = (s: string) => {
    const n = Number(s);
    if (Number.isNaN(n)) return;
    onChange(rateType, rateType === "PERCENT" ? n / 100 : n);
  };

  const unit = rateType === "PERCENT" ? "%" : rateType === "HOURLY" ? "R/hr" : rateType === "DAILY" ? "R/day" : "";

  return (
    <div className={`rounded-lg border p-3 ${ring}`}>
      <div className="flex items-center gap-2 mb-2">
        <span className={`w-2 h-2 rounded-full ${dot}`}></span>
        <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">{label}</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Rate type</label>
          <select
            value={rateType}
            onChange={(e) => onChange(e.target.value as RateType, rateValue)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="PERCENT">{RATE_TYPE_LABEL.PERCENT}</option>
            <option value="HOURLY">{RATE_TYPE_LABEL.HOURLY}</option>
            <option value="DAILY">{RATE_TYPE_LABEL.DAILY}</option>
            <option value="NONE">{RATE_TYPE_LABEL.NONE}</option>
          </select>
        </div>
        <div>
          <label className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide block mb-1">Amount</label>
          <div className="relative">
            <input
              type="number"
              step={rateType === "PERCENT" ? "1" : "10"}
              min="0"
              disabled={rateType === "NONE"}
              value={displayValue}
              onChange={(e) => handleValueChange(e.target.value)}
              className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm pr-12 disabled:bg-slate-100 disabled:text-slate-400"
            />
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">{unit}</span>
          </div>
        </div>
      </div>
      <p className="text-[10px] text-slate-500 mt-2">
        {rateType === "PERCENT" && "Commission = profit × this percent. Best for sales agents and partner-style TMs."}
        {rateType === "HOURLY" && "Commission = TM hours worked on the order × this rate. Set hours on each order's Financials panel."}
        {rateType === "DAILY" && "Commission = TM days worked on the order × this rate. Set days on each order's Financials panel."}
        {rateType === "NONE" && "No commission earned on this type of order."}
      </p>
    </div>
  );
}
