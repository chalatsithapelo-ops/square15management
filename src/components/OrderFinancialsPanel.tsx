/**
 * Admin order-financials panel.
 * Lives inside an expanded order card on /admin/operations.
 * Shows the order's computed commission base & lets admin edit:
 *  - Sales agent + slice (commission carve-out)
 *  - Technical Manager override
 *  - Quoted-amount override (when no invoice yet)
 *  - Reconciliation adjustments (signed +/-)
 *  - Commission-exclusion toggle (warranty / write-off jobs)
 */
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";
import { Banknote, ShieldCheck, ShieldOff, Plus, X, Loader2, Lock, AlertTriangle, TrendingUp, TrendingDown, ChevronDown, ChevronUp, Trash2, UserCircle2, Clock, Calendar } from "lucide-react";

const ZAR = (n: number) => new Intl.NumberFormat("en-ZA", { style: "currency", currency: "ZAR", minimumFractionDigits: 2 }).format(n ?? 0);

function formatRate(rateType: string, rateValue: number): string {
  switch (rateType) {
    case "PERCENT": return `${(rateValue * 100).toFixed(0)}%`;
    case "HOURLY": return `${ZAR(rateValue)}/hr`;
    case "DAILY": return `${ZAR(rateValue)}/day`;
    case "NONE": return "—";
    default: return String(rateValue);
  }
}

const ADJUSTMENT_KINDS = [
  { value: "RECONCILIATION", label: "Reconciliation" },
  { value: "MATERIAL_RETURN", label: "Material return" },
  { value: "CREDIT_NOTE", label: "Credit note" },
  { value: "WARRANTY_HOLDBACK", label: "Warranty holdback" },
  { value: "OTHER", label: "Other" },
] as const;

interface Props {
  orderId: number;
  artisans: Array<{ id: number; firstName: string; lastName: string; email: string }>;
}

export function OrderFinancialsPanel({ orderId, artisans }: Props) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [expanded, setExpanded] = useState(false);

  const summary = useQuery({
    ...trpc.adminGetOrderFinancialsSummary.queryOptions({ token: token!, orderId }),
    enabled: expanded,
  });

  const adjustments = useQuery({
    ...trpc.adminListOrderAdjustments.queryOptions({ token: token!, orderId }),
    enabled: expanded,
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: [["adminGetOrderFinancialsSummary"]] });
    qc.invalidateQueries({ queryKey: [["adminListOrderAdjustments"]] });
    qc.invalidateQueries({ queryKey: [["getOrders"]] });
  };

  const setSalesAgent = useMutation(trpc.adminSetOrderSalesAgent.mutationOptions({
    onSuccess: () => { toast.success("Sales agent updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const toggleExclusion = useMutation(trpc.adminToggleOrderCommissionExclusion.mutationOptions({
    onSuccess: () => { toast.success("Updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const setTm = useMutation(trpc.adminSetOrderTechnicalManager.mutationOptions({
    onSuccess: () => { toast.success("TM updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const setQuoted = useMutation(trpc.adminSetOrderQuotedAmount.mutationOptions({
    onSuccess: () => { toast.success("Quoted amount updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const setTmTime = useMutation(trpc.adminSetOrderTmTime.mutationOptions({
    onSuccess: () => { toast.success("TM time updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const setSalesAgentTime = useMutation(trpc.adminSetOrderSalesAgentTime.mutationOptions({
    onSuccess: () => { toast.success("Sales agent time updated"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));
  const addAdjustment = useMutation(trpc.adminAddOrderAdjustment.mutationOptions({
    onSuccess: () => { toast.success("Adjustment added"); invalidate(); setShowAddAdj(false); setNewAdj({ kind: "RECONCILIATION", amount: "", notes: "" }); },
    onError: (e) => toast.error(e.message),
  }));
  const deleteAdjustment = useMutation(trpc.adminDeleteOrderAdjustment.mutationOptions({
    onSuccess: () => { toast.success("Adjustment deleted"); invalidate(); },
    onError: (e) => toast.error(e.message),
  }));

  const [salesAgentId, setSalesAgentId] = useState<string>("");
  const [salesAgentAmount, setSalesAgentAmount] = useState("");
  const [tmId, setTmId] = useState<string>("");
  const [quotedAmount, setQuotedAmount] = useState("");
  const [exclusionReason, setExclusionReason] = useState("");
  const [tmHours, setTmHours] = useState("");
  const [tmDays, setTmDays] = useState("");
  const [agentHours, setAgentHours] = useState("");
  const [agentDays, setAgentDays] = useState("");
  const [showAddAdj, setShowAddAdj] = useState(false);
  const [newAdj, setNewAdj] = useState<{ kind: typeof ADJUSTMENT_KINDS[number]["value"]; amount: string; notes: string }>({ kind: "RECONCILIATION", amount: "", notes: "" });

  // Hydrate inputs once summary loads
  const order = summary.data?.order;
  const financials = summary.data?.financials;
  const effectiveRate = summary.data?.effectiveRate;
  const commissionAmount = summary.data?.commissionAmount ?? 0;
  const commissionRateType = summary.data?.commissionRateType ?? "PERCENT";
  const commissionRateValue = summary.data?.commissionRateValue ?? 0;
  if (order && salesAgentId === "" && order.salesAgentId != null) setSalesAgentId(String(order.salesAgentId));
  if (order && tmId === "" && order.technicalManagerId != null) setTmId(String(order.technicalManagerId));
  if (order && salesAgentAmount === "" && (order.salesAgentAmount ?? 0) > 0) setSalesAgentAmount(String(order.salesAgentAmount));
  if (order && quotedAmount === "" && order.quotedAmountExclVat != null) setQuotedAmount(String(order.quotedAmountExclVat));
  if (order && tmHours === "" && order.tmHoursWorked != null) setTmHours(String(order.tmHoursWorked));
  if (order && tmDays === "" && order.tmDaysWorked != null) setTmDays(String(order.tmDaysWorked));
  if (order && agentHours === "" && order.salesAgentHoursWorked != null) setAgentHours(String(order.salesAgentHoursWorked));
  if (order && agentDays === "" && order.salesAgentDaysWorked != null) setAgentDays(String(order.salesAgentDaysWorked));

  // Pick the rate strategy that matches this order's kind for display
  const isQuoted = !!financials?.isQuotedOrder;
  const activeRT = effectiveRate ? (isQuoted ? effectiveRate.quotedRateType : effectiveRate.openRateType) : "PERCENT";
  const activeRV = effectiveRate ? (isQuoted ? effectiveRate.quotedRateValue : effectiveRate.openRateValue) : 0;
  const needsHours = activeRT === "HOURLY";
  const needsDays = activeRT === "DAILY";

  return (
    <div className="bg-indigo-50/40 border border-indigo-200 rounded-lg p-3">
      <button onClick={() => setExpanded(!expanded)} className="w-full flex items-center justify-between text-xs font-semibold text-indigo-900">
        <span className="flex items-center gap-1.5">
          <Banknote className="h-3.5 w-3.5" />
          Financials & TM commission
          {financials?.commissionExcluded && <span className="ml-2 text-[10px] uppercase bg-amber-200 text-amber-900 rounded px-1.5 py-0.5">excluded</span>}
          {order?.monthLockedAt && <span className="ml-2 text-[10px] uppercase bg-emerald-200 text-emerald-900 rounded px-1.5 py-0.5 flex items-center gap-0.5"><Lock className="w-2.5 h-2.5" /> locked</span>}
        </span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>

      {expanded && (
        <div className="mt-3 space-y-3">
          {summary.isLoading && <div className="text-center text-xs text-gray-500 py-4"><Loader2 className="w-4 h-4 animate-spin inline mr-1" /> Loading…</div>}

          {financials && (
            <>
              {/* Summary numbers */}
              <div className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs">
                <KV label={`Quoted (excl)${isQuoted ? " • QUOTED" : " • OPEN"}`} value={ZAR(financials.quotedExclVat)} sub={`src: ${financials.quotedSource}`} />
                <KV label="Sales slice" value={ZAR(financials.salesAgentAmount)} sub={(financials.salesAgentName ?? "") + (financials.salesAgentSource === "RULE" ? " · rule" : "")} />
                <KV label="Expenses (excl)" value={ZAR(financials.expensesExclVat)} accent={financials.expensesExclVat > 0 ? "amber" : undefined} />
                <KV label="Base" value={ZAR(financials.commissionBase)} accent={financials.commissionBase < 0 ? "rose" : undefined} />
                <KV label={`TM @ ${formatRate(commissionRateType, commissionRateValue)}`} value={ZAR(commissionAmount)} accent={commissionAmount < 0 ? "rose" : commissionAmount > 0 ? "emerald" : undefined} />
              </div>

              {/* Breakdown */}
              <details className="text-xs text-gray-700">
                <summary className="cursor-pointer hover:text-indigo-700">Expense breakdown</summary>
                <div className="mt-2 pl-4 space-y-0.5">
                  <div>Receipts (excl VAT): <span className="font-mono">{ZAR(financials.expenseBreakdown.receiptsExclVat)}</span></div>
                  <div>Materials line items: <span className="font-mono">{ZAR(financials.expenseBreakdown.materialsExclVat)}</span></div>
                  <div>Labour: <span className="font-mono">{ZAR(financials.expenseBreakdown.labourExclVat)}</span></div>
                  <div>Adjustments: <span className="font-mono">{ZAR(financials.expenseBreakdown.adjustmentsExclVat)}</span></div>
                </div>
              </details>
            </>
          )}

          {/* Controls */}
          {order && !order.monthLockedAt && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Sales agent */}
              <div className="bg-white rounded-lg p-2 border border-indigo-100">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1 flex items-center gap-1"><UserCircle2 className="w-3 h-3" /> Sales agent</div>
                <div className="flex gap-1">
                  <select value={salesAgentId} onChange={(e) => setSalesAgentId(e.target.value)} className="flex-1 text-xs border border-gray-300 rounded px-2 py-1">
                    <option value="">— none —</option>
                    {artisans.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                  </select>
                  <input type="number" step="0.01" min="0" value={salesAgentAmount} onChange={(e) => setSalesAgentAmount(e.target.value)} placeholder="amount" className="w-24 text-xs border border-gray-300 rounded px-2 py-1" />
                </div>
                <button onClick={() => setSalesAgent.mutate({ token: token!, orderId, salesAgentId: salesAgentId ? Number(salesAgentId) : null, salesAgentAmount: salesAgentAmount ? Number(salesAgentAmount) : 0 })} disabled={setSalesAgent.isPending} className="mt-1 text-xs px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Save</button>
              </div>

              {/* TM override */}
              <div className="bg-white rounded-lg p-2 border border-indigo-100">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Technical Manager override</div>
                <select value={tmId} onChange={(e) => setTmId(e.target.value)} className="w-full text-xs border border-gray-300 rounded px-2 py-1">
                  <option value="">— auto (assigned artisan / lead) —</option>
                  {artisans.map((a) => <option key={a.id} value={a.id}>{a.firstName} {a.lastName}</option>)}
                </select>
                <button onClick={() => setTm.mutate({ token: token!, orderId, technicalManagerId: tmId ? Number(tmId) : null })} disabled={setTm.isPending} className="mt-1 text-xs px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Save</button>
              </div>

              {/* Quoted-amount override */}
              <div className="bg-white rounded-lg p-2 border border-indigo-100">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Quoted amount override (excl VAT)</div>
                <input type="number" step="0.01" min="0" value={quotedAmount} onChange={(e) => setQuotedAmount(e.target.value)} placeholder="from invoice if blank" className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                <button onClick={() => setQuoted.mutate({ token: token!, orderId, quotedAmountExclVat: quotedAmount ? Number(quotedAmount) : null })} disabled={setQuoted.isPending} className="mt-1 text-xs px-2 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded">Save</button>
              </div>

              {/* PR-7b — TM hours / days worked. Only meaningful when active rule is HOURLY or DAILY. */}
              {(needsHours || needsDays) && (
                <div className="bg-white rounded-lg p-2 border border-amber-300 col-span-1 md:col-span-2">
                  <div className="text-[10px] uppercase tracking-wide text-amber-700 font-semibold mb-1 flex items-center gap-1">
                    {needsHours ? <Clock className="w-3 h-3" /> : <Calendar className="w-3 h-3" />}
                    TM time worked on this order — required for {formatRate(activeRT, activeRV)}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Hours worked</label>
                      <input type="number" step="0.25" min="0" value={tmHours} onChange={(e) => setTmHours(e.target.value)} placeholder="e.g. 4.5" className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                    </div>
                    <div>
                      <label className="text-[10px] text-gray-500 block mb-0.5">Days worked</label>
                      <input type="number" step="0.5" min="0" value={tmDays} onChange={(e) => setTmDays(e.target.value)} placeholder="e.g. 1" className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                    </div>
                  </div>
                  <button onClick={() => setTmTime.mutate({ token: token!, orderId, tmHoursWorked: tmHours ? Number(tmHours) : null, tmDaysWorked: tmDays ? Number(tmDays) : null })} disabled={setTmTime.isPending} className="mt-2 text-xs px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded">Save TM time</button>
                  <p className="text-[10px] text-amber-700 mt-1">Estimated commission: {ZAR((needsHours ? Number(tmHours || 0) : Number(tmDays || 0)) * activeRV)}</p>
                </div>
              )}

              {/* Exclusion */}
              <div className="bg-white rounded-lg p-2 border border-indigo-100">
                <div className="text-[10px] uppercase tracking-wide text-gray-500 font-semibold mb-1">Commission exclusion</div>
                {order.commissionExcluded ? (
                  <>
                    <p className="text-[11px] text-amber-700 mb-1">Excluded: {order.commissionExclusionReason}</p>
                    <button onClick={() => toggleExclusion.mutate({ token: token!, orderId, excluded: false })} className="text-xs px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded inline-flex items-center gap-1"><ShieldCheck className="w-3 h-3" /> Re-include</button>
                  </>
                ) : (
                  <>
                    <input value={exclusionReason} onChange={(e) => setExclusionReason(e.target.value)} placeholder="reason ≥ 3 chars (e.g. warranty)" className="w-full text-xs border border-gray-300 rounded px-2 py-1 mb-1" />
                    <button onClick={() => { if (exclusionReason.trim().length < 3) { toast.error("Reason required"); return; } toggleExclusion.mutate({ token: token!, orderId, excluded: true, reason: exclusionReason }); }} className="text-xs px-2 py-0.5 bg-amber-600 hover:bg-amber-700 text-white rounded inline-flex items-center gap-1"><ShieldOff className="w-3 h-3" /> Exclude</button>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Adjustments list */}
          <div className="bg-white rounded-lg border border-indigo-100">
            <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-700">Adjustments</span>
              {!order?.monthLockedAt && (
                <button onClick={() => setShowAddAdj(true)} className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"><Plus className="w-3 h-3" /> Add</button>
              )}
            </div>
            {adjustments.data?.length === 0 ? (
              <div className="px-3 py-3 text-center text-xs text-gray-400 italic">No adjustments</div>
            ) : (
              <ul className="divide-y divide-gray-100 text-xs">
                {adjustments.data?.map((a: any) => (
                  <li key={a.id} className="px-3 py-2 flex items-center gap-2">
                    <span className={`font-mono w-20 text-right ${a.amount < 0 ? "text-rose-600" : "text-emerald-700"}`}>{ZAR(a.amount)}</span>
                    <span className="font-mono text-[10px] uppercase bg-gray-100 rounded px-1.5 py-0.5">{a.kind}</span>
                    <span className="flex-1 text-gray-700">{a.notes ?? "—"}</span>
                    <span className="text-[10px] text-gray-400">{a.createdBy?.firstName} {a.createdBy?.lastName} · {new Date(a.createdAt).toLocaleDateString("en-ZA")}</span>
                    {!order?.monthLockedAt && (
                      <button onClick={() => { if (confirm("Delete adjustment?")) deleteAdjustment.mutate({ token: token!, id: a.id }); }} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-3 h-3" /></button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {showAddAdj && (
              <div className="px-3 py-2 border-t border-gray-100 space-y-2">
                <div className="grid grid-cols-2 gap-2">
                  <select value={newAdj.kind} onChange={(e) => setNewAdj({ ...newAdj, kind: e.target.value as any })} className="text-xs border border-gray-300 rounded px-2 py-1">
                    {ADJUSTMENT_KINDS.map((k) => <option key={k.value} value={k.value}>{k.label}</option>)}
                  </select>
                  <input type="number" step="0.01" value={newAdj.amount} onChange={(e) => setNewAdj({ ...newAdj, amount: e.target.value })} placeholder="Signed amount excl VAT (use - for deductions)" className="text-xs border border-gray-300 rounded px-2 py-1" />
                </div>
                <input value={newAdj.notes} onChange={(e) => setNewAdj({ ...newAdj, notes: e.target.value })} placeholder="Reason (audit trail)" className="w-full text-xs border border-gray-300 rounded px-2 py-1" />
                <div className="flex justify-end gap-2">
                  <button onClick={() => setShowAddAdj(false)} className="text-xs px-2 py-0.5 text-gray-500">Cancel</button>
                  <button onClick={() => { const amt = parseFloat(newAdj.amount); if (!isFinite(amt)) { toast.error("Amount required"); return; } if (newAdj.notes.trim().length < 3) { toast.error("Notes required"); return; } addAdjustment.mutate({ token: token!, orderId, kind: newAdj.kind, amount: amt, notes: newAdj.notes }); }} disabled={addAdjustment.isPending} className="text-xs px-3 py-0.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded">{addAdjustment.isPending ? "..." : "Save"}</button>
                </div>
              </div>
            )}
          </div>

          {order?.monthLockedAt && (
            <div className="text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded p-2 flex items-start gap-2">
              <Lock className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              This order's month is locked. Unlock the TM's statement to edit financials.
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function KV({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "emerald" | "amber" | "rose" }) {
  const cls = accent === "emerald" ? "text-emerald-700" : accent === "amber" ? "text-amber-700" : accent === "rose" ? "text-rose-600" : "text-gray-900";
  return (
    <div className="bg-white rounded p-2 border border-indigo-100">
      <div className="text-[10px] uppercase tracking-wide text-gray-500">{label}</div>
      <div className={`text-sm font-bold tabular-nums ${cls}`}>{value}</div>
      {sub && <div className="text-[9px] text-gray-400 truncate">{sub}</div>}
    </div>
  );
}
