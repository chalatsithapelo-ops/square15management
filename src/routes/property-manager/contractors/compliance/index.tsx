import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  ShieldCheck,
  ShieldAlert,
  Shield,
  AlertTriangle,
  RefreshCw,
  Loader2,
  Lock,
  Unlock,
  FileText,
  Settings,
  CheckCircle2,
  XCircle,
  Calendar,
} from "lucide-react";

export const Route = createFileRoute("/property-manager/contractors/compliance/")({
  component: PmCompliancePage,
});

const BAND_COLORS: Record<string, string> = {
  GREEN: "bg-green-100 text-green-800 border-green-300",
  AMBER: "bg-yellow-100 text-yellow-800 border-yellow-300",
  RED: "bg-red-100 text-red-800 border-red-300",
};

function PmCompliancePage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token || !user) {
    navigate({ to: "/" });
    return null;
  }

  const [selectedContractorId, setSelectedContractorId] = useState<number | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const overview = useQuery(trpc.getPmComplianceOverview.queryOptions({ token }));
  const detail = useQuery({
    ...trpc.getContractorCompliance.queryOptions({ token, contractorId: selectedContractorId ?? 0 }),
    enabled: selectedContractorId !== null,
  });

  const recompute = useMutation(trpc.recomputeContractorScore.mutationOptions({
    onSuccess: (r: any) => {
      toast.success(`Recomputed ${r.scoredCount} contractors`);
      qc.invalidateQueries({ queryKey: trpc.getPmComplianceOverview.queryKey() });
      if (selectedContractorId) {
        qc.invalidateQueries({ queryKey: trpc.getContractorCompliance.queryKey({ token, contractorId: selectedContractorId }) });
      }
    },
    onError: (e) => toast.error(e.message),
  }));

  const counts = (overview.data as any)?.counts;
  const rows = (overview.data as any)?.contractors ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/property-manager/dashboard" className="text-gray-500 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
            <ShieldCheck className="w-7 h-7 text-green-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Contractor compliance</h1>
              <p className="text-sm text-gray-500">SA OHS Act 85 of 1993 · COIDA · Construction Regs 2014</p>
            </div>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowSettings((s) => !s)}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50"
            >
              <Settings className="w-4 h-4" /> Settings
            </button>
            <button
              onClick={() => recompute.mutate({ token })}
              disabled={recompute.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded border bg-white hover:bg-gray-50"
            >
              {recompute.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recompute
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Aggregate cards */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <Card color="green" icon={<ShieldCheck className="w-5 h-5" />} label="GREEN" value={counts?.green ?? 0} />
          <Card color="yellow" icon={<Shield className="w-5 h-5" />} label="AMBER" value={counts?.amber ?? 0} />
          <Card color="red" icon={<ShieldAlert className="w-5 h-5" />} label="RED" value={counts?.red ?? 0} />
          <Card color="gray" icon={<AlertTriangle className="w-5 h-5" />} label="Unscored" value={counts?.unscored ?? 0} />
          <Card color="red" icon={<Lock className="w-5 h-5" />} label="Auto-blocked" value={counts?.autoBlocked ?? 0} />
        </div>

        {showSettings && <RequirementsSettings token={token} userRole={user.role} />}

        {/* Contractor list */}
        <div className="bg-white rounded-lg shadow border overflow-hidden">
          <div className="px-4 py-2 border-b bg-gray-50 flex items-center justify-between">
            <div className="text-sm font-medium">Contractors ({rows.length})</div>
          </div>

          {overview.isLoading ? (
            <div className="text-center py-10"><Loader2 className="w-6 h-6 animate-spin mx-auto" /></div>
          ) : rows.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No contractors assigned yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Contractor</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Service</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Status</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Score</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Band</th>
                    <th className="px-3 py-2 text-left text-xs font-medium uppercase">Issues</th>
                    <th className="px-3 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.map((c: any) => (
                    <tr key={c.id} className="hover:bg-gray-50">
                      <td className="px-3 py-2">
                        <div className="font-medium">{c.firstName} {c.lastName}</div>
                        <div className="text-xs text-gray-500">{c.companyName ?? c.email}</div>
                      </td>
                      <td className="px-3 py-2 text-xs">{c.serviceType}</td>
                      <td className="px-3 py-2">
                        {c.autoBlocked ? (
                          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded inline-flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Blocked
                          </span>
                        ) : c.autoBlockOverride ? (
                          <span className="text-xs px-2 py-0.5 bg-amber-100 text-amber-800 rounded inline-flex items-center gap-1">
                            <Unlock className="w-3 h-3" /> Override
                          </span>
                        ) : (
                          <span className="text-xs px-2 py-0.5 bg-gray-100 text-gray-700 rounded">{c.status}</span>
                        )}
                      </td>
                      <td className="px-3 py-2 font-mono">{c.score ?? "—"}</td>
                      <td className="px-3 py-2">
                        {c.band ? (
                          <span className={`text-xs px-2 py-0.5 rounded border ${BAND_COLORS[c.band]}`}>{c.band}</span>
                        ) : (
                          <span className="text-xs text-gray-400">unscored</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {c.missingCount > 0 && <span className="mr-2 text-red-600">{c.missingCount} missing</span>}
                        {c.expiredCount > 0 && <span className="mr-2 text-red-600">{c.expiredCount} expired</span>}
                        {c.expiringCount30d > 0 && <span className="text-amber-600">{c.expiringCount30d} expiring</span>}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          onClick={() => setSelectedContractorId(c.id)}
                          className="text-xs text-indigo-600 hover:underline"
                        >View</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Detail drawer */}
      {selectedContractorId !== null && (
        <div className="fixed inset-0 bg-black bg-opacity-40 z-40 flex justify-end" onClick={() => setSelectedContractorId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-2xl bg-white h-full overflow-y-auto p-6 space-y-4 shadow-xl">
            <div className="flex justify-between items-start">
              <h2 className="text-xl font-bold">Compliance detail</h2>
              <button onClick={() => setSelectedContractorId(null)} className="text-gray-500 hover:text-gray-900">×</button>
            </div>
            {detail.isLoading ? <Loader2 className="w-6 h-6 animate-spin" /> : detail.data ? (
              <DetailPanel data={detail.data as any} token={token} userRole={user.role} onMutated={() => {
                qc.invalidateQueries({ queryKey: trpc.getContractorCompliance.queryKey({ token, contractorId: selectedContractorId }) });
                qc.invalidateQueries({ queryKey: trpc.getPmComplianceOverview.queryKey() });
              }} />
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Card({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: number; color: "green" | "yellow" | "red" | "gray" }) {
  const map: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-700",
    yellow: "bg-yellow-50 border-yellow-200 text-yellow-700",
    red: "bg-red-50 border-red-200 text-red-700",
    gray: "bg-gray-50 border-gray-200 text-gray-700",
  };
  return (
    <div className={`p-3 rounded-lg border ${map[color]}`}>
      <div className="flex items-center gap-2 text-xs">{icon}{label}</div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </div>
  );
}

function DetailPanel({ data, token, userRole, onMutated }: { data: any; token: string; userRole: string; onMutated: () => void }) {
  const trpc = useTRPC();
  const [overrideUntil, setOverrideUntil] = useState("");
  const [overrideReason, setOverrideReason] = useState("");

  const override = useMutation(trpc.overrideContractorAutoBlock.mutationOptions({
    onSuccess: () => { toast.success("Override applied"); onMutated(); },
    onError: (e) => toast.error(e.message),
  }));
  const clearOverride = useMutation(trpc.clearContractorAutoBlockOverride.mutationOptions({
    onSuccess: () => { toast.success("Override cleared"); onMutated(); },
    onError: (e) => toast.error(e.message),
  }));

  const c = data.contractor;
  const s = data.score;
  const isAdmin = userRole === "ADMIN" || userRole === "SENIOR_ADMIN";

  return (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-lg font-semibold">{c.firstName} {c.lastName}</span>
          {s && <span className={`text-xs px-2 py-0.5 rounded border ${BAND_COLORS[s.band]}`}>{s.band} · {s.score}/100</span>}
          {c.autoBlocked && <span className="text-xs px-2 py-0.5 bg-red-100 text-red-800 rounded">AUTO-BLOCKED</span>}
        </div>
        <div className="text-sm text-gray-600">{c.companyName ?? ""} · {c.serviceType}</div>
        <div className="text-xs text-gray-500">{c.email}</div>
      </div>

      {c.autoBlocked && isAdmin && (
        <div className="bg-amber-50 border border-amber-200 p-3 rounded space-y-2">
          <div className="text-sm font-medium text-amber-900">Override auto-block</div>
          <div className="flex gap-2">
            <input type="date" value={overrideUntil} onChange={(e) => setOverrideUntil(e.target.value)} className="px-2 py-1 text-sm border rounded" />
            <input type="text" placeholder="Reason" value={overrideReason} onChange={(e) => setOverrideReason(e.target.value)} className="flex-1 px-2 py-1 text-sm border rounded" />
            <button
              onClick={() => override.mutate({ token, contractorId: c.id, until: overrideUntil, reason: overrideReason })}
              disabled={!overrideUntil || overrideReason.length < 3 || override.isPending}
              className="px-3 py-1 text-sm bg-amber-600 text-white rounded disabled:opacity-50"
            >Apply</button>
          </div>
        </div>
      )}

      {c.autoBlockOverride && isAdmin && (
        <div className="bg-blue-50 border border-blue-200 p-3 rounded">
          <div className="text-sm">Override active until {c.autoBlockOverrideUntil ? new Date(c.autoBlockOverrideUntil).toLocaleDateString() : "—"}</div>
          {c.autoBlockOverrideReason && <div className="text-xs text-gray-600">{c.autoBlockOverrideReason}</div>}
          <button
            onClick={() => clearOverride.mutate({ token, contractorId: c.id })}
            className="mt-2 px-2 py-1 text-xs bg-white border rounded"
          >Clear override</button>
        </div>
      )}

      {/* Score breakdown */}
      {s && Array.isArray(s.breakdown) && (
        <div>
          <div className="text-sm font-medium mb-1">Score breakdown</div>
          <table className="w-full text-xs border-collapse">
            <thead className="bg-gray-50">
              <tr><th className="px-2 py-1 text-left">Requirement</th><th className="px-2 py-1 text-left">Status</th><th className="px-2 py-1 text-left">Expiry</th><th className="px-2 py-1 text-right">Pts</th></tr>
            </thead>
            <tbody>
              {s.breakdown.map((b: any, i: number) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1">{b.customLabel ?? b.documentType}</td>
                  <td className="px-2 py-1">
                    <span className={`px-1.5 py-0.5 rounded ${
                      b.status === "OK" ? "bg-green-100 text-green-800"
                      : b.status === "EXPIRING_30D" ? "bg-yellow-100 text-yellow-800"
                      : b.status === "EXPIRING_7D" ? "bg-orange-100 text-orange-800"
                      : "bg-red-100 text-red-800"
                    }`}>{b.status}</span>
                  </td>
                  <td className="px-2 py-1">{b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : "—"}</td>
                  <td className="px-2 py-1 text-right">{b.points}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Documents */}
      <div>
        <div className="text-sm font-medium mb-1">Documents ({data.documents?.length ?? 0})</div>
        <div className="space-y-1">
          {data.documents?.map((d: any) => {
            const days = d.expiryDate ? Math.floor((new Date(d.expiryDate).getTime() - Date.now()) / 86400000) : null;
            return (
              <div key={d.id} className="flex items-center justify-between text-xs p-2 bg-gray-50 rounded">
                <div>
                  <div className="font-medium">{d.title}</div>
                  <div className="text-gray-500">{d.documentType}{d.expiryDate ? ` · expires ${new Date(d.expiryDate).toLocaleDateString()}` : ""}</div>
                </div>
                {days !== null && (
                  <span className={`px-1.5 py-0.5 rounded ${days < 0 ? "bg-red-100 text-red-800" : days <= 7 ? "bg-orange-100 text-orange-800" : days <= 30 ? "bg-yellow-100 text-yellow-800" : "bg-green-100 text-green-800"}`}>
                    {days < 0 ? `${-days}d expired` : `${days}d left`}
                  </span>
                )}
              </div>
            );
          })}
          {(!data.documents || data.documents.length === 0) && <div className="text-xs text-gray-500">No documents on file.</div>}
        </div>
      </div>
    </div>
  );
}

function RequirementsSettings({ token, userRole }: { token: string; userRole: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.listComplianceRequirements.queryOptions({ token }));
  const [showAdd, setShowAdd] = useState(false);
  const [docType, setDocType] = useState("COIDA_LETTER");
  const [weight, setWeight] = useState(10);
  const [mandatory, setMandatory] = useState(true);

  const upsert = useMutation(trpc.upsertComplianceRequirement.mutationOptions({
    onSuccess: () => {
      toast.success("Saved");
      setShowAdd(false);
      qc.invalidateQueries({ queryKey: trpc.listComplianceRequirements.queryKey() });
    },
    onError: (e) => toast.error(e.message),
  }));
  const del = useMutation(trpc.deleteComplianceRequirement.mutationOptions({
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: trpc.listComplianceRequirements.queryKey() }); },
    onError: (e) => toast.error(e.message),
  }));
  const seed = useMutation(trpc.seedSaDefaultRequirements.mutationOptions({
    onSuccess: (r: any) => { toast.success(`Seeded ${r.created} SA defaults`); qc.invalidateQueries({ queryKey: trpc.listComplianceRequirements.queryKey() }); },
    onError: (e) => toast.error(e.message),
  }));

  const DOC_TYPES = [
    "COIDA_LETTER", "TAX_CLEARANCE", "PUBLIC_LIABILITY", "LETTER_OF_GOOD_STANDING",
    "BBBEE_CERT", "ID_DOCUMENT", "CIPC_REGISTRATION", "SAFETY_FILE",
    "WORK_AT_HEIGHTS", "MEDICAL_FITNESS", "POPIA_CONSENT", "VAT_REGISTRATION",
    "COMPANY_PROFILE", "METHOD_STATEMENT", "OTHER",
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow border space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold flex items-center gap-2"><Settings className="w-4 h-4" />Compliance requirements</h2>
        <div className="flex gap-2">
          <button onClick={() => seed.mutate({ token })} className="text-xs px-2 py-1 border rounded">Seed SA defaults</button>
          <button onClick={() => setShowAdd(true)} className="text-xs px-2 py-1 bg-indigo-600 text-white rounded">+ Add</button>
        </div>
      </div>
      {list.isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : (
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr><th className="px-2 py-1 text-left">Document</th><th className="px-2 py-1 text-right">Weight</th><th className="px-2 py-1 text-center">Mandatory</th><th className="px-2 py-1 text-center">Active</th><th></th></tr>
          </thead>
          <tbody>
            {(list.data ?? []).map((r: any) => (
              <tr key={r.id} className="border-t">
                <td className="px-2 py-1">{r.customLabel ?? r.documentType}</td>
                <td className="px-2 py-1 text-right">{r.weight}</td>
                <td className="px-2 py-1 text-center">{r.isMandatory ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-gray-400 inline" />}</td>
                <td className="px-2 py-1 text-center">{r.isActive ? <CheckCircle2 className="w-4 h-4 text-green-600 inline" /> : <XCircle className="w-4 h-4 text-gray-400 inline" />}</td>
                <td className="px-2 py-1 text-right">
                  <button onClick={() => del.mutate({ token, id: r.id })} className="text-red-600 hover:underline">Delete</button>
                </td>
              </tr>
            ))}
            {(list.data ?? []).length === 0 && (
              <tr><td colSpan={5} className="text-center py-3 text-gray-400">No custom requirements. SA defaults will be used.</td></tr>
            )}
          </tbody>
        </table>
      )}

      {showAdd && (
        <div className="border rounded p-3 space-y-2 bg-gray-50">
          <div className="grid grid-cols-3 gap-2">
            <select value={docType} onChange={(e) => setDocType(e.target.value)} className="px-2 py-1 border rounded text-sm">
              {DOC_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input type="number" min={1} max={100} value={weight} onChange={(e) => setWeight(parseInt(e.target.value) || 10)} className="px-2 py-1 border rounded text-sm" placeholder="Weight" />
            <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={mandatory} onChange={(e) => setMandatory(e.target.checked)} /> Mandatory</label>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowAdd(false)} className="px-2 py-1 text-sm border rounded">Cancel</button>
            <button
              onClick={() => upsert.mutate({ token, documentType: docType, weight, isMandatory: mandatory, isActive: true })}
              disabled={upsert.isPending}
              className="px-2 py-1 text-sm bg-indigo-600 text-white rounded disabled:opacity-50"
            >Save</button>
          </div>
        </div>
      )}
    </div>
  );
}
