import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, Fragment } from "react";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import {
  ArrowLeft,
  Shield,
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Clock,
  FileText,
  Plus,
  Sparkles,
  Download,
  Loader2,
  Trash2,
  Megaphone,
  GraduationCap,
  Activity,
  ClipboardList,
  X,
  Edit,
} from "lucide-react";

export const Route = createFileRoute("/admin/ohs/")({
  component: OhsHomePage,
});

type Tab = "dashboard" | "risks" | "incidents" | "toolbox" | "documents" | "training";

function downloadBase64Pdf(b64: string, filename: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function riskBadge(level: string) {
  const map: Record<string, string> = {
    LOW: "bg-green-100 text-green-800",
    MEDIUM: "bg-yellow-100 text-yellow-800",
    HIGH: "bg-orange-100 text-orange-800",
    CRITICAL: "bg-red-100 text-red-800",
  };
  return map[level] || "bg-gray-100 text-gray-800";
}

function severityBadge(level: string) {
  return riskBadge(level);
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    DRAFT: "bg-gray-100 text-gray-800",
    PUBLISHED: "bg-green-100 text-green-800",
    ARCHIVED: "bg-gray-200 text-gray-600",
    REPORTED: "bg-yellow-100 text-yellow-800",
    UNDER_INVESTIGATION: "bg-blue-100 text-blue-800",
    CORRECTIVE_ACTION: "bg-orange-100 text-orange-800",
    CLOSED: "bg-green-100 text-green-800",
    REPORTED_TO_DOL: "bg-red-100 text-red-800",
    OPEN: "bg-yellow-100 text-yellow-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    REQUIRED: "bg-red-100 text-red-800",
    SCHEDULED: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-green-100 text-green-800",
    EXPIRED: "bg-red-100 text-red-800",
  };
  return map[status] || "bg-gray-100 text-gray-800";
}

function OhsHomePage() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [tab, setTab] = useState<Tab>("dashboard");

  if (!token || !user) {
    navigate({ to: "/" });
    return null;
  }

  const dash = useQuery(trpc.ohsDashboard.queryOptions({ token }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/dashboard" className="text-gray-500 hover:text-gray-900">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Shield className="w-7 h-7 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Occupational Health & Safety</h1>
              <p className="text-sm text-gray-500">SA OHS Act 85 of 1993 · Construction Regs 2014 · AI-assisted</p>
            </div>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-wrap gap-2 -mb-px">
            {[
              { id: "dashboard", label: "Dashboard", icon: Activity },
              { id: "risks", label: "Risk Assessments", icon: AlertTriangle },
              { id: "incidents", label: "Incidents", icon: AlertCircle },
              { id: "toolbox", label: "Toolbox Talks", icon: Megaphone },
              { id: "documents", label: "Documents", icon: FileText },
              { id: "training", label: "Training", icon: GraduationCap },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id as Tab)}
                className={`px-4 py-3 text-sm font-medium border-b-2 flex items-center gap-2 ${
                  tab === t.id
                    ? "border-amber-600 text-amber-700"
                    : "border-transparent text-gray-500 hover:text-gray-700"
                }`}
              >
                <t.icon className="w-4 h-4" />
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {tab === "dashboard" && <DashboardTab data={dash.data} loading={dash.isLoading} />}
        {tab === "risks" && <RiskAssessmentsTab token={token} />}
        {tab === "incidents" && <IncidentsTab token={token} />}
        {tab === "toolbox" && <ToolboxTab token={token} />}
        {tab === "documents" && <DocumentsTab token={token} />}
        {tab === "training" && <TrainingTab token={token} />}
      </div>
    </div>
  );
}

// ============================================================================
// Dashboard
// ============================================================================
function DashboardTab({ data, loading }: { data: any; loading: boolean }) {
  if (loading) return <div className="flex justify-center p-12"><Loader2 className="w-8 h-8 animate-spin text-amber-600" /></div>;
  if (!data) return null;
  if (data.mode !== "manager") return <div className="text-gray-600">Worker view available in your portal.</div>;

  const tiles = [
    { label: "Open Incidents", value: data.openIncidents, color: "text-yellow-600", icon: AlertCircle },
    { label: "Critical / High", value: data.criticalOpenIncidents, color: "text-red-600", icon: AlertTriangle },
    { label: "Open Corrective Actions", value: data.openCorrectiveActions, color: "text-orange-600", icon: ClipboardList },
    { label: "Training Due", value: data.trainingDue, color: "text-blue-600", icon: GraduationCap },
    { label: "Published Risk Assessments", value: data.publishedRiskAssessments, color: "text-green-600", icon: Shield },
    { label: "High/Critical Risks", value: data.highRiskAssessments, color: "text-red-600", icon: AlertTriangle },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {tiles.map((t) => (
          <div key={t.label} className="bg-white rounded-lg border p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm text-gray-500">{t.label}</span>
              <t.icon className={`w-4 h-4 ${t.color}`} />
            </div>
            <div className={`text-3xl font-bold ${t.color}`}>{t.value ?? 0}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border p-6">
        <h2 className="text-lg font-semibold mb-4">Recent Incidents</h2>
        {(!data.recentIncidents || data.recentIncidents.length === 0) ? (
          <p className="text-gray-500 text-sm">No recent incidents reported.</p>
        ) : (
          <div className="divide-y">
            {data.recentIncidents.map((inc: any) => (
              <div key={inc.id} className="py-3 flex items-center justify-between">
                <div>
                  <div className="font-medium text-gray-900">{inc.reference} · {inc.type.replace(/_/g, " ")}</div>
                  <div className="text-sm text-gray-500">{inc.location} · {new Date(inc.occurredAt).toLocaleDateString()}</div>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${severityBadge(inc.severity)}`}>{inc.severity}</span>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge(inc.status)}`}>{inc.status.replace(/_/g, " ")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-900">
        <div className="font-semibold mb-1 flex items-center gap-2"><Shield className="w-4 h-4" /> Legal compliance reminder</div>
        Section 24 of the OHS Act requires reporting to the Department of Employment & Labour within 7 days for any incident causing death, serious injury, or unconsciousness. Always investigate, document, and close out corrective actions.
      </div>
    </div>
  );
}

// ============================================================================
// Risk Assessments tab
// ============================================================================
function RiskAssessmentsTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.ohsListRiskAssessments.queryOptions({ token }));
  const [showCreate, setShowCreate] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);

  const exportPdf = useMutation(trpc.ohsExportRiskAssessmentPdf.mutationOptions({
    onSuccess: (res: any) => { downloadBase64Pdf(res.pdf, res.filename); setExportingId(null); },
    onError: (e: any) => { toast.error(e.message); setExportingId(null); },
  }));
  const approve = useMutation(trpc.ohsApproveRiskAssessment.mutationOptions({
    onSuccess: () => { toast.success("Approved"); qc.invalidateQueries({ queryKey: trpc.ohsListRiskAssessments.queryKey({ token }) }); },
    onError: (e: any) => toast.error(e.message),
  }));
  const del = useMutation(trpc.ohsDeleteRiskAssessment.mutationOptions({
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: trpc.ohsListRiskAssessments.queryKey({ token }) }); },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Risk Assessments</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
          <Sparkles className="w-4 h-4" /> Create with AI
        </button>
      </div>

      {list.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">
          No risk assessments yet. Click "Create with AI" to begin.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Activity</th>
                <th className="px-4 py-3">Overall risk</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.map((ra: any) => (
                <tr key={ra.id}>
                  <td className="px-4 py-3 font-mono text-xs">{ra.reference}</td>
                  <td className="px-4 py-3">{ra.title}</td>
                  <td className="px-4 py-3 text-gray-600">{ra.activity}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${riskBadge(ra.overallRisk)}`}>{ra.overallRisk}</span></td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge(ra.status)}`}>{ra.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setExportingId(ra.id); exportPdf.mutate({ token, riskAssessmentId: ra.id }); }} disabled={exportingId === ra.id} className="text-blue-600 hover:text-blue-800" title="Export PDF">
                        {exportingId === ra.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                      {ra.status === "DRAFT" && (
                        <button onClick={() => approve.mutate({ token, riskAssessmentId: ra.id })} className="text-green-600 hover:text-green-800" title="Approve & Publish">
                          <CheckCircle2 className="w-4 h-4" />
                        </button>
                      )}
                      <button onClick={() => { if (confirm(`Delete ${ra.reference}?`)) del.mutate({ token, riskAssessmentId: ra.id }); }} className="text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateRiskAssessmentModal token={token} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: trpc.ohsListRiskAssessments.queryKey({ token }) }); }} />}
    </div>
  );
}

function CreateRiskAssessmentModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [step, setStep] = useState<"input" | "review">("input");
  const [title, setTitle] = useState("");
  const [activity, setActivity] = useState("");
  const [location, setLocation] = useState("");
  const [knownHazards, setKnownHazards] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [aiSummary, setAiSummary] = useState<string>("");

  const analyze = useMutation(trpc.ohsAnalyzeRisks.mutationOptions({
    onSuccess: (res: any) => {
      setItems((res.items || []).map((it: any) => ({ ...it, aiSuggested: true })));
      setAiSummary(res.summary || "");
      setStep("review");
      toast.success("AI analysis complete — review and edit before saving");
    },
    onError: (e: any) => toast.error(e.message),
  }));

  const save = useMutation(trpc.ohsCreateRiskAssessment.mutationOptions({
    onSuccess: () => { toast.success("Risk assessment saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  const runAi = () => {
    if (!activity.trim()) { toast.error("Enter activity"); return; }
    analyze.mutate({
      token,
      activity,
      location: location || undefined,
      knownHazards: knownHazards ? knownHazards.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
    });
  };

  const updateItem = (idx: number, field: string, value: any) => {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, [field]: value } : it));
  };

  const addBlankItem = () => setItems((p) => [...p, {
    hazard: "", potentialHarm: "", inherentLikelihood: 3, inherentSeverity: 3,
    controls: "", residualLikelihood: 2, residualSeverity: 2,
    ppeRequired: [], trainingRequired: [], legalReferences: [], aiSuggested: false,
  }]);

  const removeItem = (idx: number) => setItems((p) => p.filter((_, i) => i !== idx));

  const submit = (publish: boolean) => {
    if (!title.trim()) { toast.error("Title required"); return; }
    if (items.length === 0) { toast.error("Add at least one risk item"); return; }
    save.mutate({
      token, title, activity, location: location || undefined,
      aiSummary: aiSummary || undefined, aiGenerated: items.some((i) => i.aiSuggested),
      items: items.map((it) => ({
        hazard: it.hazard, potentialHarm: it.potentialHarm,
        inherentLikelihood: Number(it.inherentLikelihood), inherentSeverity: Number(it.inherentSeverity),
        controls: it.controls, responsiblePerson: it.responsiblePerson || null,
        residualLikelihood: Number(it.residualLikelihood), residualSeverity: Number(it.residualSeverity),
        ppeRequired: it.ppeRequired || [], trainingRequired: it.trainingRequired || [], legalReferences: it.legalReferences || [],
        notes: it.notes || null, aiSuggested: !!it.aiSuggested,
      })),
      publish,
    });
  };

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-5xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold flex items-center gap-2"><Sparkles className="text-amber-600 w-5 h-5" /> Create Risk Assessment</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Title *</label>
                  <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Working at Heights — Roof Repair" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Sandton Office Park, Block C roof" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Activity / Task *</label>
                <textarea value={activity} onChange={(e) => setActivity(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" placeholder="Describe the work activity in detail" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Known hazards (optional, comma separated)</label>
                <input value={knownHazards} onChange={(e) => setKnownHazards(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. fall from height, electricity, asbestos" />
              </div>

              {step === "input" && (
                <div className="flex gap-2">
                  <button onClick={runAi} disabled={analyze.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2 disabled:opacity-50">
                    {analyze.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    Run AI Analysis
                  </button>
                  <button onClick={() => { setItems([]); setStep("review"); }} className="px-4 py-2 border rounded-lg flex items-center gap-2">
                    <Edit className="w-4 h-4" /> Skip AI — Manual entry
                  </button>
                </div>
              )}

              {step === "review" && (
                <>
                  {aiSummary && (
                    <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm">
                      <div className="font-semibold mb-1">AI Summary</div>
                      <div className="text-gray-700">{aiSummary}</div>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">Risk items ({items.length})</h3>
                    <button onClick={addBlankItem} className="text-sm text-amber-700 hover:underline flex items-center gap-1"><Plus className="w-4 h-4" /> Add row</button>
                  </div>
                  <div className="space-y-3">
                    {items.map((it, idx) => {
                      const inh = Number(it.inherentLikelihood) * Number(it.inherentSeverity);
                      const res = Number(it.residualLikelihood) * Number(it.residualSeverity);
                      const inhLevel = res >= 20 ? "CRITICAL" : inh >= 12 ? "HIGH" : inh >= 6 ? "MEDIUM" : "LOW";
                      const resLevel = res >= 20 ? "CRITICAL" : res >= 12 ? "HIGH" : res >= 6 ? "MEDIUM" : "LOW";
                      return (
                        <div key={idx} className="border rounded p-3 space-y-2 bg-gray-50">
                          <div className="flex justify-between items-start">
                            <div className="text-xs text-gray-500">Item {idx + 1}{it.aiSuggested ? " · AI suggested" : ""}</div>
                            <button onClick={() => removeItem(idx)} className="text-red-600"><Trash2 className="w-4 h-4" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input value={it.hazard} onChange={(e) => updateItem(idx, "hazard", e.target.value)} placeholder="Hazard" className="border rounded px-2 py-1 text-sm" />
                            <input value={it.potentialHarm} onChange={(e) => updateItem(idx, "potentialHarm", e.target.value)} placeholder="Potential harm" className="border rounded px-2 py-1 text-sm" />
                          </div>
                          <textarea value={it.controls} onChange={(e) => updateItem(idx, "controls", e.target.value)} placeholder="Control measures (per hierarchy of controls: eliminate → substitute → engineer → admin → PPE)" rows={2} className="w-full border rounded px-2 py-1 text-sm" />
                          <div className="grid grid-cols-4 gap-2 text-xs">
                            <div><label className="block text-gray-600">Inherent L (1-5)</label><input type="number" min={1} max={5} value={it.inherentLikelihood} onChange={(e) => updateItem(idx, "inherentLikelihood", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                            <div><label className="block text-gray-600">Inherent S (1-5)</label><input type="number" min={1} max={5} value={it.inherentSeverity} onChange={(e) => updateItem(idx, "inherentSeverity", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                            <div><label className="block text-gray-600">Residual L (1-5)</label><input type="number" min={1} max={5} value={it.residualLikelihood} onChange={(e) => updateItem(idx, "residualLikelihood", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                            <div><label className="block text-gray-600">Residual S (1-5)</label><input type="number" min={1} max={5} value={it.residualSeverity} onChange={(e) => updateItem(idx, "residualSeverity", e.target.value)} className="w-full border rounded px-2 py-1" /></div>
                          </div>
                          <div className="flex gap-2 text-xs">
                            <span>Inherent: <span className={`px-2 py-0.5 rounded ${riskBadge(inhLevel)}`}>{inh} · {inhLevel}</span></span>
                            <span>Residual: <span className={`px-2 py-0.5 rounded ${riskBadge(resLevel)}`}>{res} · {resLevel}</span></span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <input value={(it.ppeRequired || []).join(", ")} onChange={(e) => updateItem(idx, "ppeRequired", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="PPE (comma separated)" className="border rounded px-2 py-1" />
                            <input value={(it.legalReferences || []).join(", ")} onChange={(e) => updateItem(idx, "legalReferences", e.target.value.split(",").map((s) => s.trim()).filter(Boolean))} placeholder="Legal refs" className="border rounded px-2 py-1" />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
            <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              {step === "review" && (
                <>
                  <button onClick={() => submit(false)} disabled={save.isPending} className="px-4 py-2 border rounded-lg">Save as draft</button>
                  <button onClick={() => submit(true)} disabled={save.isPending} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2">
                    {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                    Save & Publish
                  </button>
                </>
              )}
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// Incidents tab
// ============================================================================
function IncidentsTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.ohsListIncidents.queryOptions({ token }));
  const [showReport, setShowReport] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [updatingIncident, setUpdatingIncident] = useState<any | null>(null);

  const exportPdf = useMutation(trpc.ohsExportIncidentPdf.mutationOptions({
    onSuccess: (res: any) => { downloadBase64Pdf(res.pdf, res.filename); setExportingId(null); },
    onError: (e: any) => { toast.error(e.message); setExportingId(null); },
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Incidents & Investigations</h2>
        <button onClick={() => setShowReport(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Report Incident
        </button>
      </div>
      {list.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No incidents reported.</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Severity</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Occurred</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.map((inc: any) => (
                <tr key={inc.id}>
                  <td className="px-4 py-3 font-mono text-xs">{inc.reference}</td>
                  <td className="px-4 py-3">{inc.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${severityBadge(inc.severity)}`}>{inc.severity}</span></td>
                  <td className="px-4 py-3">{inc.location}</td>
                  <td className="px-4 py-3">{new Date(inc.occurredAt).toLocaleDateString()}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs font-medium ${statusBadge(inc.status)}`}>{inc.status.replace(/_/g, " ")}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => setUpdatingIncident(inc)} className="text-blue-600 hover:text-blue-800" title="Investigate / Update"><Edit className="w-4 h-4" /></button>
                      <button onClick={() => { setExportingId(inc.id); exportPdf.mutate({ token, incidentId: inc.id }); }} disabled={exportingId === inc.id} className="text-blue-600 hover:text-blue-800" title="Export PDF">
                        {exportingId === inc.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showReport && <ReportIncidentModal token={token} onClose={() => setShowReport(false)} onSaved={() => { setShowReport(false); qc.invalidateQueries({ queryKey: trpc.ohsListIncidents.queryKey({ token }) }); }} />}
      {updatingIncident && <UpdateIncidentModal token={token} incident={updatingIncident} onClose={() => setUpdatingIncident(null)} onSaved={() => { setUpdatingIncident(null); qc.invalidateQueries({ queryKey: trpc.ohsListIncidents.queryKey({ token }) }); }} />}
    </div>
  );
}

function ReportIncidentModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [type, setType] = useState("NEAR_MISS");
  const [severity, setSeverity] = useState("LOW");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 16));
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [immediate, setImmediate] = useState("");
  const [injuredName, setInjuredName] = useState("");
  const [injuredRole, setInjuredRole] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [runAi, setRunAi] = useState(true);

  const submit = useMutation(trpc.ohsReportIncident.mutationOptions({
    onSuccess: () => { toast.success("Incident reported"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-semibold">Report Incident</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {["NEAR_MISS", "FIRST_AID", "MEDICAL_TREATMENT", "LOST_TIME_INJURY", "FATALITY", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "DANGEROUS_OCCURRENCE", "OCCUPATIONAL_DISEASE", "OTHER"].map((v) => (
                      <option key={v} value={v}>{v.replace(/_/g, " ")}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Severity</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Occurred at</label>
                  <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description (what happened, how, why)</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Immediate actions taken</label>
                <textarea value={immediate} onChange={(e) => setImmediate(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Injured / affected person</label>
                  <input value={injuredName} onChange={(e) => setInjuredName(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Their role</label>
                  <input value={injuredRole} onChange={(e) => setInjuredRole(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Witnesses</label>
                <input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={runAi} onChange={(e) => setRunAi(e.target.checked)} />
                Run AI analysis (root cause, reportability, suggested actions)
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button
                disabled={submit.isPending}
                onClick={() => submit.mutate({
                  token, type: type as any, severity: severity as any,
                  occurredAt: new Date(occurredAt).toISOString(),
                  location, description, immediateActions: immediate || undefined,
                  injuredPersonName: injuredName || undefined, injuredPersonRole: injuredRole || undefined,
                  witnesses: witnesses || undefined, runAi,
                })}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2"
              >
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />}
                Report
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

function UpdateIncidentModal({ token, incident, onClose, onSaved }: { token: string; incident: any; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [status, setStatus] = useState(incident.status);
  const [rootCause, setRootCause] = useState(incident.rootCause || "");
  const [investigationNotes, setInvestigationNotes] = useState(incident.investigationNotes || "");
  const [reportedToDol, setReportedToDol] = useState(!!incident.reportedToDol);
  const [reportedToDolBy, setReportedToDolBy] = useState(incident.reportedToDolBy || "");
  const [reportedToDolRef, setReportedToDolRef] = useState(incident.reportedToDolRef || "");

  // Corrective action form state
  const [caDescription, setCaDescription] = useState("");
  const [caResponsibleId, setCaResponsibleId] = useState<number | "">("");
  const [caDueDate, setCaDueDate] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const update = useMutation(trpc.ohsUpdateIncident.mutationOptions({
    onSuccess: () => { toast.success("Updated"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  const capas = useQuery(trpc.ohsListCorrectiveActions.queryOptions({ token, incidentId: incident.id }));
  const users = useQuery(trpc.ohsListAssignableUsers.queryOptions({ token, search: userSearch || undefined }));

  const addCa = useMutation(trpc.ohsAddCorrectiveAction.mutationOptions({
    onSuccess: () => {
      toast.success("Corrective action added");
      setCaDescription(""); setCaResponsibleId(""); setCaDueDate("");
      qc.invalidateQueries({ queryKey: trpc.ohsListCorrectiveActions.queryKey({ token, incidentId: incident.id }) });
    },
    onError: (e: any) => toast.error(e.message),
  }));

  const updateCa = useMutation(trpc.ohsUpdateCorrectiveAction.mutationOptions({
    onSuccess: () => {
      toast.success("Updated");
      qc.invalidateQueries({ queryKey: trpc.ohsListCorrectiveActions.queryKey({ token, incidentId: incident.id }) });
    },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-3xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between sticky top-0 bg-white z-10">
              <h2 className="text-xl font-semibold">{incident.reference} — Investigation</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-4">
              {incident.aiInsights && (
                <div className="bg-amber-50 border border-amber-200 rounded p-3 text-sm whitespace-pre-wrap">
                  <div className="font-semibold mb-1 flex items-center gap-1"><Sparkles className="w-4 h-4" /> AI Insights</div>
                  {incident.aiInsights}
                </div>
              )}
              {incident.dolReportable && (
                <div className="bg-red-50 border border-red-200 rounded p-3 text-sm">
                  <strong>⚠ AI suggests this is reportable to DoL under Sec 24 of OHS Act.</strong> Verify and file W.Cl.2 / Annexure 1 within 7 days.
                </div>
              )}
              <div>
                <label className="block text-sm font-medium mb-1">Status</label>
                <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                  {["REPORTED", "UNDER_INVESTIGATION", "CORRECTIVE_ACTION", "CLOSED", "REPORTED_TO_DOL"].map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Root cause</label>
                <textarea value={rootCause} onChange={(e) => setRootCause(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Investigation notes</label>
                <textarea value={investigationNotes} onChange={(e) => setInvestigationNotes(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div className="border rounded-lg p-3 bg-gray-50">
                <label className="flex items-center gap-2 text-sm font-medium">
                  <input type="checkbox" checked={reportedToDol} onChange={(e) => setReportedToDol(e.target.checked)} />
                  Reported to Department of Employment & Labour (Sec 24 OHS Act)
                </label>
                {reportedToDol && (
                  <div className="grid grid-cols-2 gap-3 mt-3">
                    <div>
                      <label className="block text-xs font-medium mb-1">Reported by (name)</label>
                      <input value={reportedToDolBy} onChange={(e) => setReportedToDolBy(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium mb-1">DoL reference / case no.</label>
                      <input value={reportedToDolRef} onChange={(e) => setReportedToDolRef(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" />
                    </div>
                  </div>
                )}
                {incident.reportedToDolAt && (
                  <p className="text-xs text-gray-500 mt-1">First filed: {new Date(incident.reportedToDolAt).toLocaleString()}</p>
                )}
              </div>

              {/* Corrective actions */}
              <div className="border-t pt-4">
                <h3 className="font-semibold mb-2 flex items-center gap-2"><ClipboardList className="w-4 h-4" /> Corrective Actions (CAPA)</h3>
                {capas.isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : !capas.data || capas.data.length === 0 ? (
                  <p className="text-sm text-gray-500 mb-3">No corrective actions yet.</p>
                ) : (
                  <div className="space-y-2 mb-3">
                    {capas.data.map((ca: any) => (
                      <div key={ca.id} className="border rounded p-3 text-sm bg-white">
                        <div className="flex justify-between items-start gap-2">
                          <div className="flex-1">
                            <p className="font-medium">{ca.description}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Responsible: {ca.responsible?.firstName} {ca.responsible?.lastName} • Due {new Date(ca.dueDate).toLocaleDateString()}
                              {ca.completedAt && ` • Completed ${new Date(ca.completedAt).toLocaleDateString()}`}
                              {ca.verifiedBy && ` • Verified by ${ca.verifiedBy.firstName} ${ca.verifiedBy.lastName}`}
                            </p>
                          </div>
                          <span className={`px-2 py-1 rounded text-xs ${statusBadge(ca.status)}`}>{ca.status}</span>
                        </div>
                        <div className="flex gap-1 mt-2">
                          {ca.status === "OPEN" && (
                            <button onClick={() => updateCa.mutate({ token, correctiveActionId: ca.id, status: "IN_PROGRESS" })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">Start</button>
                          )}
                          {(ca.status === "OPEN" || ca.status === "IN_PROGRESS") && (
                            <button onClick={() => updateCa.mutate({ token, correctiveActionId: ca.id, status: "COMPLETED" })} className="text-xs px-2 py-1 border rounded bg-green-50 hover:bg-green-100">Complete</button>
                          )}
                          {ca.status === "COMPLETED" && (
                            <button onClick={() => updateCa.mutate({ token, correctiveActionId: ca.id, status: "VERIFIED" })} className="text-xs px-2 py-1 border rounded bg-blue-50 hover:bg-blue-100">Verify</button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
                <div className="bg-gray-50 border rounded p-3">
                  <p className="text-xs font-medium mb-2">Add corrective action</p>
                  <textarea value={caDescription} onChange={(e) => setCaDescription(e.target.value)} placeholder="Description..." rows={2} className="w-full border rounded-lg px-3 py-2 text-sm mb-2" />
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search user..." className="w-full border rounded-lg px-3 py-2 text-sm mb-1" />
                      <select value={caResponsibleId} onChange={(e) => setCaResponsibleId(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded-lg px-3 py-2 text-sm">
                        <option value="">Select responsible person...</option>
                        {(users.data || []).map((u: any) => (
                          <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role})</option>
                        ))}
                      </select>
                    </div>
                    <input type="date" value={caDueDate} onChange={(e) => setCaDueDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm" />
                  </div>
                  <button
                    onClick={() => {
                      if (!caDescription || !caResponsibleId || !caDueDate) {
                        toast.error("Fill description, responsible person and due date");
                        return;
                      }
                      addCa.mutate({ token, incidentId: incident.id, description: caDescription, responsibleId: Number(caResponsibleId), dueDate: caDueDate });
                    }}
                    disabled={addCa.isPending}
                    className="mt-2 px-3 py-1.5 bg-amber-600 text-white rounded-lg text-sm hover:bg-amber-700"
                  >
                    {addCa.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : "Add CAPA"}
                  </button>
                </div>
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => update.mutate({ token, incidentId: incident.id, status, rootCause, investigationNotes, reportedToDol, reportedToDolBy: reportedToDolBy || null, reportedToDolRef: reportedToDolRef || null })} disabled={update.isPending} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                {update.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// Toolbox Talks tab
// ============================================================================
function ToolboxTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.ohsListToolboxTalks.queryOptions({ token }));
  const [showCreate, setShowCreate] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const [ackViewId, setAckViewId] = useState<number | null>(null);
  const exportPdf = useMutation(trpc.ohsExportToolboxTalkPdf.mutationOptions({
    onSuccess: (res: any) => { downloadBase64Pdf(res.pdf, res.filename); setExportingId(null); },
    onError: (e: any) => { toast.error(e.message); setExportingId(null); },
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Toolbox Talks</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Toolbox Talk
        </button>
      </div>
      {list.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No toolbox talks yet.</div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {list.data.map((t: any) => (
            <div key={t.id} className="bg-white border rounded-lg p-4">
              <div className="flex justify-between items-start mb-2">
                <div>
                  <div className="text-xs text-gray-500 font-mono">{t.reference}</div>
                  <h3 className="font-semibold">{t.title}</h3>
                </div>
                <span className={`px-2 py-1 rounded text-xs ${statusBadge(t.status)}`}>{t.status}</span>
              </div>
              <p className="text-sm text-gray-600 line-clamp-3 mb-3">{t.content}</p>
              <div className="flex justify-between items-center text-xs text-gray-500">
                <button onClick={() => setAckViewId(t.id)} className="text-blue-600 hover:underline">
                  {t.ackCount} acknowledgements
                </button>
                <button onClick={() => { setExportingId(t.id); exportPdf.mutate({ token, toolboxTalkId: t.id }); }} disabled={exportingId === t.id} className="text-blue-600 hover:underline flex items-center gap-1">
                  {exportingId === t.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Download className="w-3 h-3" />} PDF
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
      {showCreate && <CreateToolboxModal token={token} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: trpc.ohsListToolboxTalks.queryKey({ token }) }); }} />}
      {ackViewId !== null && <ToolboxAckModal token={token} toolboxTalkId={ackViewId} onClose={() => setAckViewId(null)} />}
    </div>
  );
}

function ToolboxAckModal({ token, toolboxTalkId, onClose }: { token: string; toolboxTalkId: number; onClose: () => void }) {
  const trpc = useTRPC();
  const data = useQuery(trpc.ohsListToolboxAcks.queryOptions({ token, toolboxTalkId }));
  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4">
          <Dialog.Panel className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-4 border-b flex justify-between">
              <h2 className="font-semibold">Acknowledgements</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-4 grid md:grid-cols-2 gap-4 text-sm">
              <div>
                <h3 className="font-semibold mb-2 text-green-700">Acknowledged ({data.data?.acks?.length || 0})</h3>
                {(data.data?.acks || []).map((a: any) => (
                  <div key={a.id} className="border-b py-1">
                    <p>{a.user?.firstName} {a.user?.lastName}</p>
                    <p className="text-xs text-gray-500">{new Date(a.acknowledgedAt).toLocaleString()}</p>
                  </div>
                ))}
                {!data.data?.acks?.length && <p className="text-gray-500 text-xs">None yet</p>}
              </div>
              <div>
                <h3 className="font-semibold mb-2 text-amber-700">Pending ({data.data?.pending?.length || 0})</h3>
                {(data.data?.pending || []).map((u: any) => (
                  <div key={u.id} className="border-b py-1">
                    <p>{u.firstName} {u.lastName}</p>
                    <p className="text-xs text-gray-500">{u.role} • {u.email}</p>
                  </div>
                ))}
                {!data.data?.pending?.length && <p className="text-gray-500 text-xs">All done</p>}
              </div>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

function CreateToolboxModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [topic, setTopic] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [targetRoles, setTargetRoles] = useState<string[]>(["ARTISAN", "CONTRACTOR"]);
  const [ackDeadline, setAckDeadline] = useState("");

  const generate = useMutation(trpc.ohsGenerateToolboxTalk.mutationOptions({
    onSuccess: (res: any) => {
      setTitle(res.title || title);
      setContent(`${res.summary || ""}\n\nKey points:\n${(res.keyPoints || []).map((p: string) => "• " + p).join("\n")}\n\nQuestions:\n${(res.questions || []).map((q: string) => "• " + q).join("\n")}`);
      toast.success("AI draft created — review and edit");
    },
    onError: (e: any) => toast.error(e.message),
  }));
  const save = useMutation(trpc.ohsCreateToolboxTalk.mutationOptions({
    onSuccess: () => { toast.success("Toolbox talk saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  const ROLES = ["ARTISAN", "CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER", "PROPERTY_MANAGER", "TECHNICAL_MANAGER", "MANAGER"];

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between"><h2 className="text-xl font-semibold">New Toolbox Talk</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Topic *</label>
                <div className="flex gap-2">
                  <input value={topic} onChange={(e) => setTopic(e.target.value)} className="flex-1 border rounded-lg px-3 py-2" placeholder="e.g. Working at heights — fall protection" />
                  <button onClick={() => topic ? generate.mutate({ token, topic }) : toast.error("Enter a topic")} disabled={generate.isPending} className="px-3 py-2 border rounded-lg flex items-center gap-1 text-sm">
                    {generate.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} AI
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content *</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full border rounded-lg px-3 py-2 font-mono text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Target roles</label>
                <div className="flex flex-wrap gap-2">
                  {ROLES.map((r) => (
                    <label key={r} className="flex items-center gap-1 text-sm bg-gray-100 px-2 py-1 rounded">
                      <input type="checkbox" checked={targetRoles.includes(r)} onChange={(e) => setTargetRoles((p) => e.target.checked ? [...p, r] : p.filter((x) => x !== r))} />
                      {r}
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ack deadline (optional)</label>
                <input type="date" value={ackDeadline} onChange={(e) => setAckDeadline(e.target.value)} className="border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => save.mutate({ token, topic, title, content, targetRoles, ackDeadline: ackDeadline || undefined, publish: false })} className="px-4 py-2 border rounded-lg">Save draft</button>
              <button onClick={() => save.mutate({ token, topic, title, content, targetRoles, ackDeadline: ackDeadline || undefined, publish: true })} disabled={save.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg flex items-center gap-2">
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Megaphone className="w-4 h-4" />} Publish
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// Documents tab
// ============================================================================
function DocumentsTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.ohsListDocuments.queryOptions({ token }));
  const [showCreate, setShowCreate] = useState(false);
  const [exportingId, setExportingId] = useState<number | null>(null);
  const exportPdf = useMutation(trpc.ohsExportDocumentPdf.mutationOptions({
    onSuccess: (res: any) => { downloadBase64Pdf(res.pdf, res.filename); setExportingId(null); },
    onError: (e: any) => { toast.error(e.message); setExportingId(null); },
  }));
  const del = useMutation(trpc.ohsDeleteDocument.mutationOptions({
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: trpc.ohsListDocuments.queryKey({ token }) }); },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">OHS Document Library</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> New Document
        </button>
      </div>
      {list.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No OHS documents yet.</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Reference</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Version</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.map((d: any) => (
                <tr key={d.id}>
                  <td className="px-4 py-3 font-mono text-xs">{d.reference}</td>
                  <td className="px-4 py-3">{d.type.replace(/_/g, " ")}</td>
                  <td className="px-4 py-3">{d.title}</td>
                  <td className="px-4 py-3">{d.version}</td>
                  <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${statusBadge(d.status)}`}>{d.status}</span></td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <button onClick={() => { setExportingId(d.id); exportPdf.mutate({ token, documentId: d.id }); }} disabled={exportingId === d.id} className="text-blue-600 hover:text-blue-800" title="Export PDF">
                        {exportingId === d.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      </button>
                      <button onClick={() => { if (confirm(`Delete ${d.reference}?`)) del.mutate({ token, documentId: d.id }); }} className="text-red-600 hover:text-red-800" title="Delete">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {showCreate && <CreateDocumentModal token={token} onClose={() => setShowCreate(false)} onSaved={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: trpc.ohsListDocuments.queryKey({ token }) }); }} />}
    </div>
  );
}

function CreateDocumentModal({ token, onClose, onSaved }: { token: string; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [type, setType] = useState("POLICY");
  const [title, setTitle] = useState("");
  const [version, setVersion] = useState("1.0");
  const [content, setContent] = useState("");
  const [requiresAck, setRequiresAck] = useState(false);
  const [reviewDate, setReviewDate] = useState("");

  const save = useMutation(trpc.ohsCreateDocument.mutationOptions({
    onSuccess: () => { toast.success("Document saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  const TYPES = ["POLICY", "PROCEDURE", "SAFE_WORK_METHOD", "RISK_ASSESSMENT", "EMERGENCY_PLAN", "TOOLBOX_TALK", "CHECKLIST", "MSDS", "PERMIT", "TRAINING_MATERIAL", "LEGAL_APPOINTMENT", "OTHER"];

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-2xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between"><h2 className="text-xl font-semibold">New OHS Document</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Version</label>
                  <input value={version} onChange={(e) => setVersion(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <input value={title} onChange={(e) => setTitle(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Content / body</label>
                <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Review date</label>
                <input type="date" value={reviewDate} onChange={(e) => setReviewDate(e.target.value)} className="border rounded-lg px-3 py-2" />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={requiresAck} onChange={(e) => setRequiresAck(e.target.checked)} />
                Requires acknowledgement by workers
              </label>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button onClick={() => save.mutate({ token, type: type as any, title, version, content, requiresAck, reviewDate: reviewDate || undefined, publish: false })} className="px-4 py-2 border rounded-lg">Save draft</button>
              <button onClick={() => save.mutate({ token, type: type as any, title, version, content, requiresAck, reviewDate: reviewDate || undefined, publish: true })} disabled={save.isPending} className="px-4 py-2 bg-amber-600 text-white rounded-lg flex items-center gap-2">
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Publish
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}

// ============================================================================
// Training tab
// ============================================================================
function TrainingTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const list = useQuery(trpc.ohsListTraining.queryOptions({ token }));
  const [editing, setEditing] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold">Training & Competency Records</h2>
        <button onClick={() => setShowCreate(true)} className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 flex items-center gap-2">
          <Plus className="w-4 h-4" /> Add Training
        </button>
      </div>
      {list.isLoading ? (
        <div className="flex justify-center p-12"><Loader2 className="w-6 h-6 animate-spin" /></div>
      ) : !list.data || list.data.length === 0 ? (
        <div className="bg-white border rounded-lg p-8 text-center text-gray-500">No training records yet. Click "Add Training" to register a course.</div>
      ) : (
        <div className="bg-white border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left">
              <tr>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Course</th>
                <th className="px-4 py-3">Provider</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Completed</th>
                <th className="px-4 py-3">Expires</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {list.data.map((r: any) => {
                const isExpiring = r.expiresAt && new Date(r.expiresAt).getTime() < Date.now() + 30 * 86400_000;
                return (
                  <tr key={r.id} className={isExpiring ? "bg-amber-50" : ""}>
                    <td className="px-4 py-3">{r.user ? `${r.user.firstName} ${r.user.lastName}` : ""}</td>
                    <td className="px-4 py-3">{r.course}</td>
                    <td className="px-4 py-3">{r.provider || "—"}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-1 rounded text-xs ${statusBadge(r.status)}`}>{r.status}</span></td>
                    <td className="px-4 py-3">{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => setEditing(r)} className="text-blue-600 hover:underline text-xs">Edit</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {(showCreate || editing) && (
        <TrainingFormModal
          token={token}
          record={editing}
          onClose={() => { setShowCreate(false); setEditing(null); }}
          onSaved={() => { setShowCreate(false); setEditing(null); qc.invalidateQueries({ queryKey: trpc.ohsListTraining.queryKey({ token }) }); }}
        />
      )}
    </div>
  );
}

function TrainingFormModal({ token, record, onClose, onSaved }: { token: string; record: any | null; onClose: () => void; onSaved: () => void }) {
  const trpc = useTRPC();
  const [userId, setUserId] = useState<number | "">(record?.userId || "");
  const [course, setCourse] = useState(record?.course || "");
  const [provider, setProvider] = useState(record?.provider || "");
  const [competency, setCompetency] = useState(record?.competency || "");
  const [status, setStatus] = useState(record?.status || "REQUIRED");
  const [completedAt, setCompletedAt] = useState(record?.completedAt ? new Date(record.completedAt).toISOString().slice(0, 10) : "");
  const [expiresAt, setExpiresAt] = useState(record?.expiresAt ? new Date(record.expiresAt).toISOString().slice(0, 10) : "");
  const [certificateUrl, setCertificateUrl] = useState(record?.certificateUrl || "");
  const [notes, setNotes] = useState(record?.notes || "");
  const [userSearch, setUserSearch] = useState("");

  const users = useQuery(trpc.ohsListAssignableUsers.queryOptions({ token, search: userSearch || undefined }));

  const save = useMutation(trpc.ohsUpsertTraining.mutationOptions({
    onSuccess: () => { toast.success("Saved"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-2xl w-full my-8">
            <div className="p-6 border-b flex justify-between">
              <h2 className="text-xl font-semibold">{record ? "Edit" : "Add"} Training Record</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-3">
              {!record && (
                <div>
                  <label className="block text-sm font-medium mb-1">Worker</label>
                  <input value={userSearch} onChange={(e) => setUserSearch(e.target.value)} placeholder="Search by name/email..." className="w-full border rounded-lg px-3 py-2 mb-1" />
                  <select value={userId} onChange={(e) => setUserId(e.target.value ? Number(e.target.value) : "")} className="w-full border rounded-lg px-3 py-2">
                    <option value="">Select...</option>
                    {(users.data || []).map((u: any) => (
                      <option key={u.id} value={u.id}>{u.firstName} {u.lastName} ({u.role}) — {u.email}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Course *</label>
                  <input value={course} onChange={(e) => setCourse(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="e.g. Working at Heights" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Provider</label>
                  <input value={provider} onChange={(e) => setProvider(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Competency</label>
                  <input value={competency} onChange={(e) => setCompetency(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Status</label>
                  <select value={status} onChange={(e) => setStatus(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {["REQUIRED", "SCHEDULED", "COMPLETED", "EXPIRED"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Completed at</label>
                  <input type="date" value={completedAt} onChange={(e) => setCompletedAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Expires at</label>
                  <input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Certificate URL</label>
                <input value={certificateUrl} onChange={(e) => setCertificateUrl(e.target.value)} className="w-full border rounded-lg px-3 py-2" placeholder="https://..." />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button
                onClick={() => {
                  if (!record && !userId) { toast.error("Select a worker"); return; }
                  if (!course) { toast.error("Course is required"); return; }
                  save.mutate({
                    token,
                    id: record?.id,
                    userId: record ? record.userId : Number(userId),
                    course,
                    provider: provider || null,
                    competency: competency || null,
                    status: status as any,
                    completedAt: completedAt || null,
                    expiresAt: expiresAt || null,
                    certificateUrl: certificateUrl || null,
                    notes: notes || null,
                  });
                }}
                disabled={save.isPending}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
              >
                {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Save"}
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
