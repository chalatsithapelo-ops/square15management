import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, ShieldCheck, AlertTriangle, CheckCircle2, TrendingUp, FileText, Loader2 } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/finance-health")({
  component: FinanceHealthPage,
});

function fmtR(n: number) { return "R " + Math.round(n).toLocaleString(); }

export function FinanceHealthPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"overview" | "flags" | "vat" | "history">("overview");

  if (!token) return null;

  const sumQ = useQuery(trpc.getFinanceHealthSummary.queryOptions({ token }));
  const flagQ = useQuery(trpc.listFlaggedFinanceItems.queryOptions({ token }));
  const histQ = useQuery(trpc.listFinanceAuditFixHistory.queryOptions({ token, take: 100 }));
  const dismissMut = useMutation(trpc.dismissFlag.mutationOptions({
    onSuccess: () => {
      toast.success("Flag resolved");
      qc.invalidateQueries({ queryKey: trpc.listFlaggedFinanceItems.queryKey({ token }) });
      qc.invalidateQueries({ queryKey: trpc.getFinanceHealthSummary.queryKey({ token }) });
    },
    onError: (e) => toast.error(e.message),
  }));

  const s = sumQ.data as any;

  return (
    <div className="min-h-screen bg-gray-50">
      {!embedded && (
        <div className="bg-white border-b">
          <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-4">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-teal-600" />
              <h1 className="text-lg font-semibold">Finance Health & Audit</h1>
            </div>
          </div>
        </div>
      )}
      <div className={`${embedded ? "" : "bg-white border-b"}`}>
        <div className={`max-w-7xl mx-auto ${embedded ? "" : "px-6"}`}>
          <div className="flex gap-1 overflow-x-auto">
            {(["overview", "flags", "vat", "history"] as const).map((k) => (
              <button key={k} onClick={() => setTab(k)}
                className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"}`}>
                {k}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className={`${embedded ? "py-4" : "max-w-7xl mx-auto px-6 py-6"} space-y-5`}>
        {!s ? <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div> :
          <>
            {tab === "overview" && (
              <>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <HealthTile ok={s.invoicesWithoutLines === 0} label="Invoices w/o line items" value={s.invoicesWithoutLines} subtitle="each needs line detail" />
                  <HealthTile ok={s.invoicesWithoutDueDate === 0} label="Invoices w/o due date" value={s.invoicesWithoutDueDate} subtitle="can't age properly" />
                  <HealthTile ok={s.lineMismatch.count === 0} label="Line-total mismatches" value={s.lineMismatch.count} subtitle={`R ${Math.round(s.lineMismatch.cumulative).toLocaleString()}`} />
                  <HealthTile ok={s.expenseFlags.noVat === 0} label="Expenses w/o VAT" value={s.expenseFlags.noVat} subtitle="input VAT uncaptured" />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4 text-amber-600" /> Debtors ageing</h3>
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr><th className="text-left px-2 py-1">Bucket</th><th className="px-2 py-1">#</th><th className="text-right px-2 py-1">Value</th></tr>
                      </thead>
                      <tbody>
                        {(s.ageingBuckets ?? []).map((b: any) => (
                          <tr key={b.bucket} className="border-t">
                            <td className="px-2 py-1 font-medium">{b.bucket}</td>
                            <td className="px-2 py-1 text-center">{b.count}</td>
                            <td className="px-2 py-1 text-right font-mono">{fmtR(b.value || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-800">
                      <b>{s.overdue.count}</b> invoices over 30 days overdue · <b>{fmtR(s.overdue.value || 0)}</b>
                    </div>
                  </div>

                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-600" /> Invoice status</h3>
                    <table className="w-full text-sm">
                      <tbody>
                        {s.invoiceStatusCounts.map((r: any) => (
                          <tr key={r.status} className="border-t">
                            <td className="px-2 py-1 font-medium">{r.status}</td>
                            <td className="px-2 py-1 text-center">{r.count}</td>
                            <td className="px-2 py-1 text-right font-mono">{fmtR(r.value || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-emerald-600" /> Recent auto-fixes</h3>
                  <table className="w-full text-sm">
                    <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                      <tr><th className="text-left px-2 py-1">Category</th><th className="px-2 py-1">Fixes applied</th><th className="text-right px-2 py-1">Most recent</th></tr>
                    </thead>
                    <tbody>
                      {s.recentFixes.map((r: any) => (
                        <tr key={r.category} className="border-t">
                          <td className="px-2 py-1 font-mono text-xs">{r.category}</td>
                          <td className="px-2 py-1 text-center">{r.count}</td>
                          <td className="px-2 py-1 text-right text-xs text-gray-500">{new Date(r.mostRecent).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {tab === "flags" && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Items flagged for manual review ({(flagQ.data ?? []).length})</h3>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">Category</th>
                      <th className="text-left px-3 py-2">Entity</th>
                      <th className="text-left px-3 py-2">Details</th>
                      <th className="text-left px-3 py-2">Flagged</th>
                      <th className="px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {((flagQ.data ?? []) as any[]).map((f: any) => (
                      <tr key={f.id} className="border-t hover:bg-gray-50">
                        <td className="px-3 py-2 text-xs font-mono text-amber-700">{f.category}</td>
                        <td className="px-3 py-2 text-xs">
                          {f.entity === "Invoice" ? (
                            <Link to={`/admin/invoices/${f.entityId}`} className="text-teal-700 hover:underline">
                              #{f.entityId} {f.before?.invoiceNumber}
                            </Link>
                          ) : (
                            <span>{f.entity} #{f.entityId}</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-mono max-w-md truncate">
                          {JSON.stringify(f.before)}
                        </td>
                        <td className="px-3 py-2 text-xs text-gray-500">{new Date(f.createdAt).toLocaleDateString()}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            onClick={() => {
                              const r = prompt("How did you resolve this? (brief note)");
                              if (r) dismissMut.mutate({ token, id: f.id, resolution: r });
                            }}
                            className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
                          >Resolve</button>
                        </td>
                      </tr>
                    ))}
                    {(flagQ.data ?? []).length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-gray-400 text-sm">No flags remaining — clean sheet 👍</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {tab === "vat" && (
              <>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3">Our VAT details</h3>
                  <div className="text-sm">Company VAT number: <b className="font-mono">{s.companyVatNumber ?? "— NOT SET —"}</b></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-3">Output VAT by month</h3>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr><th className="text-left px-2 py-1">Month</th><th>Inv</th><th className="text-right">Taxable sales</th><th className="text-right">Output VAT</th></tr>
                      </thead>
                      <tbody>
                        {s.vatByMonth.map((r: any) => (
                          <tr key={r.month} className="border-t">
                            <td className="px-2 py-1 font-mono">{r.month}</td>
                            <td className="px-2 py-1 text-center">{Number(r.invoices)}</td>
                            <td className="px-2 py-1 text-right">{fmtR(r.taxable_sales || 0)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmtR(r.output_vat || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="bg-white rounded-xl border p-4">
                    <h3 className="text-sm font-semibold mb-3">Input VAT by month (claimable)</h3>
                    <table className="w-full text-xs">
                      <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                        <tr><th className="text-left px-2 py-1">Month</th><th>#</th><th className="text-right">Gross</th><th className="text-right">Input VAT</th></tr>
                      </thead>
                      <tbody>
                        {s.inputVatByMonth.map((r: any) => (
                          <tr key={r.month} className="border-t">
                            <td className="px-2 py-1 font-mono">{r.month}</td>
                            <td className="px-2 py-1 text-center">{r.count}</td>
                            <td className="px-2 py-1 text-right">{fmtR(r.gross || 0)}</td>
                            <td className="px-2 py-1 text-right font-semibold">{fmtR(r.input_vat || 0)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                  <h3 className="font-semibold text-emerald-900 mb-2">VAT return proxy (last 2 months)</h3>
                  {(() => {
                    const outV = (s.vatByMonth as any[]).slice(0, 2).reduce((a, r) => a + Number(r.output_vat || 0), 0);
                    const inV = (s.inputVatByMonth as any[]).slice(0, 2).reduce((a, r) => a + Number(r.input_vat || 0), 0);
                    return (
                      <div className="grid grid-cols-3 gap-3">
                        <div><div className="text-xs text-emerald-700">Output VAT</div><div className="text-xl font-semibold">{fmtR(outV)}</div></div>
                        <div><div className="text-xs text-emerald-700">Input VAT</div><div className="text-xl font-semibold">{fmtR(inV)}</div></div>
                        <div><div className="text-xs text-emerald-700">VAT payable (estimate)</div><div className="text-xl font-semibold">{fmtR(outV - inV)}</div></div>
                      </div>
                    );
                  })()}
                </div>
              </>
            )}

            {tab === "history" && (
              <div className="bg-white rounded-xl border overflow-hidden">
                <div className="px-4 py-3 border-b"><h3 className="text-sm font-semibold">Audit fix history</h3></div>
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                    <tr>
                      <th className="text-left px-3 py-2">When</th>
                      <th className="text-left px-3 py-2">Category</th>
                      <th className="text-left px-3 py-2">Action</th>
                      <th className="text-left px-3 py-2">Entity</th>
                      <th className="text-left px-3 py-2">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {((histQ.data ?? []) as any[]).map((h: any) => (
                      <tr key={h.id} className="border-t">
                        <td className="px-3 py-2 text-xs text-gray-500">{new Date(h.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 text-xs font-mono">{h.category}</td>
                        <td className="px-3 py-2 text-xs">{h.action}</td>
                        <td className="px-3 py-2 text-xs">{h.entity} #{h.entityId}</td>
                        <td className="px-3 py-2 text-xs text-gray-600 font-mono max-w-md truncate">{JSON.stringify(h.after || h.before)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        }
      </div>
    </div>
  );
}

function HealthTile({ ok, label, value, subtitle }: { ok: boolean; label: string; value: number; subtitle: string }) {
  return (
    <div className={`rounded-xl border p-4 ${ok ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="text-xs text-gray-600 uppercase tracking-wide">{label}</div>
        {ok ? <CheckCircle2 className="w-4 h-4 text-emerald-600" /> : <AlertTriangle className="w-4 h-4 text-amber-600" />}
      </div>
      <div className={`text-3xl font-bold ${ok ? "text-emerald-700" : "text-amber-700"}`}>{value}</div>
      <div className="text-xs text-gray-500 mt-1">{subtitle}</div>
    </div>
  );
}
