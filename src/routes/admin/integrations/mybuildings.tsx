import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, RefreshCw, CheckCircle2, XCircle, Copy, ExternalLink, Loader2, Building2 } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/integrations/mybuildings")({
  component: MyBuildingsIntegrationPage,
});

function MyBuildingsIntegrationPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
        <div className="max-w-md rounded-xl border bg-white p-6 text-center shadow-sm">
          <Building2 className="mx-auto mb-3 h-8 w-8 text-teal-600" />
          <h1 className="text-lg font-semibold text-gray-900">Sign in to view the myBuildings integration</h1>
          <p className="mt-2 text-sm text-gray-600">Your Square 15 session is missing or has expired. Sign in through the management portal, then reopen this page.</p>
          <Link to="/" className="mt-4 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700">Return to Square 15</Link>
        </div>
      </div>
    );
  }

  const statusQ = useQuery(trpc.getMyBuildingsIntegrationStatus.queryOptions({ token }));
  const logsQ = useQuery(trpc.listMyBuildingsSyncLog.queryOptions({ token, take: 25 }));

  const testMut = useMutation(
    trpc.testMyBuildingsConnection.mutationOptions({
      onSuccess: (r) => r.ok ? toast.success(`Connected · HTTP ${r.status}`) : toast.error(`Failed: ${r.error ?? "Unknown"}`),
      onError: (e) => toast.error(e.message),
    }),
  );
  const syncMut = useMutation(
    trpc.syncMyBuildingsNow.mutationOptions({
      onSuccess: (r) => {
        toast.success(`Sync: fetched ${r.fetched} · new ${r.created} · updated ${r.updated}`);
        qc.invalidateQueries({ queryKey: trpc.getMyBuildingsIntegrationStatus.queryKey({ token }) });
        qc.invalidateQueries({ queryKey: trpc.listMyBuildingsSyncLog.queryKey({ token, take: 25 }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const s = statusQ.data as any;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h1 className="text-lg font-semibold">myBuildings Integration (Eris Properties)</h1>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 space-y-5">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Connection</div>
            <div className={`text-2xl font-semibold ${s?.tokenConfigured ? "text-emerald-700" : "text-red-700"}`}>
              {s?.tokenConfigured ? "Configured" : "Not configured"}
            </div>
            <div className="text-xs text-gray-500 mt-1 truncate">{s?.baseUrl}</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Orders synced</div>
            <div className="text-2xl font-semibold text-gray-900">{s?.totalOrders ?? "…"}</div>
            <div className="text-xs text-gray-500 mt-1">{s?.openOrders ?? "…"} still open</div>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <div className="text-xs text-gray-500 uppercase tracking-wide mb-1">Last poll</div>
            <div className={`text-2xl font-semibold ${s?.lastPollSuccess ? "text-emerald-700" : "text-amber-700"}`}>
              {s?.lastPollAt ? new Date(s.lastPollAt).toLocaleTimeString() : "—"}
            </div>
            <div className="text-xs text-gray-500 mt-1">Every {Math.round((s?.pollInterval ?? 600_000) / 60000)} min · {s?.lastPollSuccess === false ? s.lastPollError : "OK"}</div>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4 space-y-3">
          <h2 className="text-sm font-semibold">Actions</h2>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => testMut.mutate({ token })}
              disabled={testMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {testMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Test connection
            </button>
            <button
              onClick={() => syncMut.mutate({ token })}
              disabled={syncMut.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-teal-600 text-white text-sm hover:bg-teal-700 disabled:opacity-50"
            >
              {syncMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Sync now
            </button>
            <Link
              to="/admin/client-work-orders"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm hover:bg-gray-50"
            >
              View client work orders <ExternalLink className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>

        <div className="bg-white rounded-xl border p-4">
          <h2 className="text-sm font-semibold mb-2">Webhook setup (paste this into Eris Configure API page)</h2>
          <p className="text-xs text-gray-600 mb-2">
            Log into Eris → Configure API Access → Outgoing Web Hooks section → paste this URL in the "Web Hook URL" field. Leave the Authorization header blank (or set <code>Bearer &lt;secret&gt;</code> and mirror it in our <code>.env</code> as <code>MYBUILDINGS_WEBHOOK_BEARER</code>).
          </p>
          <div className="flex items-center gap-2 bg-gray-50 border rounded p-2 text-xs font-mono">
            <span className="flex-1 truncate">{s?.webhookUrl}</span>
            <button
              onClick={() => {
                if (s?.webhookUrl) {
                  navigator.clipboard.writeText(s.webhookUrl);
                  toast.success("Copied");
                }
              }}
              className="p-1 hover:bg-gray-200 rounded"
            >
              <Copy className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        <SiteMappingSection token={token} />

        <CashflowSummary token={token} />

        <div className="bg-white rounded-xl border">
          <div className="px-4 py-3 border-b flex items-center justify-between">
            <h2 className="text-sm font-semibold">Recent sync activity</h2>
            {logsQ.isFetching && <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-400" />}
          </div>
          <div className="divide-y">
            {(logsQ.data ?? []).length === 0 && (
              <div className="p-4 text-sm text-gray-400">No activity yet.</div>
            )}
            {((logsQ.data ?? []) as any[]).map((l: any) => (
              <div key={l.id} className="px-4 py-2 text-xs flex items-center gap-3">
                <span className={`w-16 shrink-0 font-semibold ${l.success ? "text-emerald-700" : "text-red-700"}`}>
                  {l.success ? "OK" : "FAIL"}
                </span>
                <span className="w-14 shrink-0 text-gray-500">{l.direction}</span>
                <span className="w-52 shrink-0 font-mono">{l.operation}</span>
                <span className="w-32 shrink-0 text-gray-500">{l.externalRef ?? ""}</span>
                <span className="flex-1 text-gray-600 truncate">{l.errorMessage ?? ""}</span>
                <span className="text-gray-400">{new Date(l.createdAt).toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function SiteMappingSection({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mapQ = useQuery(trpc.listSiteMappings.queryOptions({ token }));
  const unmappedQ = useQuery(trpc.listUnmappedSites.queryOptions({ token }));
  const [openForm, setOpenForm] = useState<string | null>(null);
  const [form, setForm] = useState<{ externalSite: string; externalCode: string; linkedBuildingId: string; linkedClientId: string }>({
    externalSite: "", externalCode: "", linkedBuildingId: "", linkedClientId: "",
  });

  const upsertMut = useMutation(
    trpc.upsertSiteMapping.mutationOptions({
      onSuccess: () => {
        toast.success("Mapping saved");
        setOpenForm(null);
        qc.invalidateQueries({ queryKey: trpc.listSiteMappings.queryKey({ token }) });
        qc.invalidateQueries({ queryKey: trpc.listUnmappedSites.queryKey({ token }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const deleteMut = useMutation(
    trpc.deleteSiteMapping.mutationOptions({
      onSuccess: () => {
        toast.success("Deleted");
        qc.invalidateQueries({ queryKey: trpc.listSiteMappings.queryKey({ token }) });
        qc.invalidateQueries({ queryKey: trpc.listUnmappedSites.queryKey({ token }) });
      },
    }),
  );

  const mappings = (mapQ.data ?? []) as any[];
  const unmapped = (unmappedQ.data ?? []) as any[];

  const startNewFor = (externalSite: string) => {
    setForm({ externalSite, externalCode: "", linkedBuildingId: "", linkedClientId: "" });
    setOpenForm(externalSite);
  };

  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="text-sm font-semibold mb-1">Site → Building mappings</h2>
      <p className="text-xs text-gray-500 mb-3">Link the site names Eris uses to your own <b>ClientBuilding</b> records — historical + future work orders auto-link for benchmarking and rate history.</p>

      {mappings.length > 0 && (
        <div className="mb-4">
          <div className="text-xs font-semibold text-gray-700 mb-2">Existing mappings ({mappings.length})</div>
          <div className="divide-y border rounded">
            {mappings.map((m: any) => (
              <div key={m.id} className="px-3 py-2 text-xs flex items-center justify-between">
                <div>
                  <div className="font-medium">{m.externalSite} {m.externalCode ? <span className="font-mono text-gray-500">({m.externalCode})</span> : null}</div>
                  <div className="text-gray-500">
                    → {m.linkedBuilding ? `${m.linkedBuilding.name}` : "no building"} · {m.linkedClient ? m.linkedClient.name || m.linkedClient.companyName : "no client"}
                    <span className="ml-2 text-gray-400">· auto-linked {m.autoLinkedCount}× </span>
                  </div>
                </div>
                <button
                  onClick={() => { if (confirm("Delete this mapping?")) deleteMut.mutate({ token, id: m.id }); }}
                  className="text-red-500 hover:text-red-700 text-xs"
                >delete</button>
              </div>
            ))}
          </div>
        </div>
      )}

      {unmapped.length > 0 && (
        <div>
          <div className="text-xs font-semibold text-amber-800 mb-2">Unmapped sites ({unmapped.length}) — click to map</div>
          <div className="space-y-2">
            {unmapped.map((u: any) => (
              <div key={u.externalSite} className="border rounded p-2">
                <div className="flex items-center justify-between text-xs">
                  <div>
                    <span className="font-medium">{u.externalSite}</span>
                    <span className="ml-2 text-gray-500">· {u.count} order{u.count === 1 ? "" : "s"}</span>
                  </div>
                  {openForm === u.externalSite ? (
                    <button onClick={() => setOpenForm(null)} className="text-gray-500 hover:text-gray-700">cancel</button>
                  ) : (
                    <button onClick={() => startNewFor(u.externalSite)} className="text-teal-700 hover:underline">map this</button>
                  )}
                </div>
                {openForm === u.externalSite && (
                  <div className="mt-2 grid grid-cols-1 md:grid-cols-3 gap-2 text-xs">
                    <input
                      value={form.externalCode}
                      onChange={(e) => setForm({ ...form, externalCode: e.target.value })}
                      placeholder="Building code (e.g. RV01)"
                      className="border rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      value={form.linkedBuildingId}
                      onChange={(e) => setForm({ ...form, linkedBuildingId: e.target.value })}
                      placeholder="ClientBuilding ID"
                      className="border rounded px-2 py-1"
                    />
                    <input
                      type="number"
                      value={form.linkedClientId}
                      onChange={(e) => setForm({ ...form, linkedClientId: e.target.value })}
                      placeholder="Client ID (optional)"
                      className="border rounded px-2 py-1"
                    />
                    <button
                      onClick={() =>
                        upsertMut.mutate({
                          token,
                          externalSite: form.externalSite,
                          externalCode: form.externalCode || undefined,
                          linkedBuildingId: form.linkedBuildingId ? Number(form.linkedBuildingId) : null,
                          linkedClientId: form.linkedClientId ? Number(form.linkedClientId) : null,
                        })
                      }
                      disabled={upsertMut.isPending}
                      className="col-span-full md:col-auto px-3 py-1 bg-teal-600 text-white rounded font-semibold disabled:opacity-50"
                    >Save mapping</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {mappings.length === 0 && unmapped.length === 0 && (
        <div className="text-xs text-gray-400">No sites to map yet — waiting for Eris orders.</div>
      )}
    </div>
  );
}

function CashflowSummary({ token }: { token: string }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.getMyBuildingsCashflowForecast.queryOptions({ token }));
  const o = q.data as any;
  if (!o) return null;
  const fmt = (n: number) => "R " + Math.round(n).toLocaleString();
  return (
    <div className="bg-white rounded-xl border p-4">
      <h2 className="text-sm font-semibold mb-3">Eris cashflow forecast</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-blue-50 border border-blue-200 rounded p-3">
          <div className="text-[11px] text-blue-800 uppercase font-semibold">Open orders</div>
          <div className="text-2xl font-bold text-blue-900">{o.openWorkOrders}</div>
        </div>
        <div className="bg-indigo-50 border border-indigo-200 rounded p-3">
          <div className="text-[11px] text-indigo-800 uppercase font-semibold">Approved (Eris)</div>
          <div className="text-lg font-bold text-indigo-900">{fmt(o.openApprovedTotal)}</div>
        </div>
        <div className="bg-purple-50 border border-purple-200 rounded p-3">
          <div className="text-[11px] text-purple-800 uppercase font-semibold">Ready to invoice</div>
          <div className="text-lg font-bold text-purple-900">{fmt(o.openLinkedInvoicesTotal)}</div>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded p-3">
          <div className="text-[11px] text-emerald-800 uppercase font-semibold">Awaiting payment</div>
          <div className="text-lg font-bold text-emerald-900">{fmt(o.awaitingPaymentTotal)}</div>
          <div className="text-[10px] text-emerald-700">{o.awaitingPaymentCount} invoice(s)</div>
        </div>
      </div>
    </div>
  );
}

