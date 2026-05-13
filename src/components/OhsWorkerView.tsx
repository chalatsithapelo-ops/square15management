import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState, Fragment } from "react";
import toast from "react-hot-toast";
import { Dialog, Transition } from "@headlessui/react";
import { ArrowLeft, Shield, AlertCircle, FileText, GraduationCap, ClipboardList, Loader2, CheckCircle2, Megaphone, Download, X, PenLine } from "lucide-react";
import { SignaturePad } from "~/components/SignaturePad";

function downloadBase64Pdf(b64: string, filename: string) {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

export function OhsWorkerView({ backTo }: { backTo: string }) {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [showReport, setShowReport] = useState(false);

  if (!token || !user) { navigate({ to: "/" }); return null; }

  const dash = useQuery(trpc.ohsDashboard.queryOptions({ token }));
  const myTalks = useQuery(trpc.ohsListToolboxTalks.queryOptions({ token, forMe: true }));
  const myDocs = useQuery(trpc.ohsListDocuments.queryOptions({ token }));
  const myTraining = useQuery(trpc.ohsListTraining.queryOptions({ token }));
  const myIncidents = useQuery(trpc.ohsListIncidents.queryOptions({ token, mineOnly: true }));

  // Sign-to-acknowledge modal state. Either a toolbox-talk or a document.
  const [signTarget, setSignTarget] = useState<{ kind: "talk" | "doc"; id: number; title: string } | null>(null);

  const downloadTalk = useMutation(trpc.ohsExportToolboxTalkPdf.mutationOptions({
    onSuccess: (res: any) => downloadBase64Pdf(res.pdf, res.filename),
    onError: (e: any) => toast.error(e.message),
  }));
  const downloadDoc = useMutation(trpc.ohsExportDocumentPdf.mutationOptions({
    onSuccess: (res: any) => downloadBase64Pdf(res.pdf, res.filename),
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to={backTo as any} className="text-gray-500 hover:text-gray-900"><ArrowLeft className="w-5 h-5" /></Link>
            <Shield className="w-7 h-7 text-amber-600" />
            <div>
              <h1 className="text-2xl font-bold">My Health & Safety</h1>
              <p className="text-sm text-gray-500">Toolbox talks, documents, training & incident reporting</p>
            </div>
          </div>
          <button onClick={() => setShowReport(true)} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 flex items-center gap-2">
            <AlertCircle className="w-4 h-4" /> Report Incident
          </button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 space-y-6">
        {dash.data && dash.data.mode !== "manager" && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-amber-600">{(dash.data as any).pendingAcks ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Pending toolbox acks</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-blue-600">{(dash.data as any).trainingRequired ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Training required</div>
            </div>
            <div className="bg-white border rounded-lg p-4 text-center">
              <div className="text-3xl font-bold text-orange-600">{(dash.data as any).openCorrective ?? 0}</div>
              <div className="text-xs text-gray-500 mt-1">Open corrective actions</div>
            </div>
          </div>
        )}

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><Megaphone className="w-4 h-4 text-amber-600" /> Toolbox Talks</h2>
          {myTalks.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : !myTalks.data || myTalks.data.length === 0 ? (
            <p className="text-sm text-gray-500">No toolbox talks for you yet.</p>
          ) : (
            <div className="space-y-2">
              {myTalks.data.map((t: any) => (
                <div key={t.id} className="border rounded p-3">
                  <div className="flex justify-between items-start mb-1">
                    <div>
                      <div className="text-xs text-gray-500 font-mono">{t.reference}</div>
                      <h3 className="font-medium">{t.title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      {t.myAck ? (
                        <>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Signed</span>
                          <button onClick={() => downloadTalk.mutate({ token, toolboxTalkId: t.id })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1">
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setSignTarget({ kind: "talk", id: t.id, title: t.title })} className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1">
                          <PenLine className="w-3 h-3" /> Sign & acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{t.content}</p>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-amber-600" /> Safety Documents</h2>
          {myDocs.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : !myDocs.data || myDocs.data.length === 0 ? (
            <p className="text-sm text-gray-500">No published documents.</p>
          ) : (
            <div className="space-y-2">
              {myDocs.data.map((d: any) => (
                <div key={d.id} className="border rounded p-3 flex justify-between items-center">
                  <div>
                    <div className="text-xs text-gray-500 font-mono">{d.reference} · v{d.version}</div>
                    <h3 className="font-medium">{d.title}</h3>
                    <span className="text-xs text-gray-500">{d.type.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.requiresAck && (d.acks && d.acks[0] ? (
                      <>
                        <span className="text-xs text-green-700">Signed</span>
                        <button onClick={() => downloadDoc.mutate({ token, documentId: d.id })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1">
                          <Download className="w-3 h-3" /> PDF
                        </button>
                      </>
                    ) : (
                      <button onClick={() => setSignTarget({ kind: "doc", id: d.id, title: d.title })} className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1">
                        <PenLine className="w-3 h-3" /> Sign & acknowledge
                      </button>
                    ))}
                    {!d.requiresAck && (
                      <button onClick={() => downloadDoc.mutate({ token, documentId: d.id })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><GraduationCap className="w-4 h-4 text-amber-600" /> My Training</h2>
          {myTraining.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : !myTraining.data || myTraining.data.length === 0 ? (
            <p className="text-sm text-gray-500">No training records.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="text-left text-gray-500 text-xs"><th>Course</th><th>Status</th><th>Expires</th></tr></thead>
              <tbody className="divide-y">
                {myTraining.data.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2">{r.course}</td>
                    <td className="py-2"><span className="px-2 py-0.5 rounded text-xs bg-gray-100">{r.status}</span></td>
                    <td className="py-2">{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="bg-white border rounded-lg p-4">
          <h2 className="font-semibold mb-3 flex items-center gap-2"><ClipboardList className="w-4 h-4 text-amber-600" /> My Reported Incidents</h2>
          {myIncidents.isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : !myIncidents.data || myIncidents.data.length === 0 ? (
            <p className="text-sm text-gray-500">You have not reported any incidents.</p>
          ) : (
            <div className="space-y-2">
              {myIncidents.data.map((inc: any) => (
                <div key={inc.id} className="border rounded p-3">
                  <div className="flex justify-between">
                    <div className="font-medium">{inc.reference} · {inc.type.replace(/_/g, " ")}</div>
                    <span className="text-xs px-2 py-0.5 rounded bg-gray-100">{inc.status.replace(/_/g, " ")}</span>
                  </div>
                  <div className="text-xs text-gray-500 mt-1">{inc.location} · {new Date(inc.occurredAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {showReport && <ReportIncidentModal token={token} onClose={() => setShowReport(false)} onSaved={() => { setShowReport(false); qc.invalidateQueries({ queryKey: trpc.ohsListIncidents.queryKey({ token, mineOnly: true }) }); }} />}
      {signTarget && (
        <SignAcknowledgeModal
          token={token}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={() => {
            setSignTarget(null);
            if (signTarget.kind === "talk") {
              qc.invalidateQueries({ queryKey: trpc.ohsListToolboxTalks.queryKey({ token, forMe: true }) });
              qc.invalidateQueries({ queryKey: trpc.ohsDashboard.queryKey({ token }) });
            } else {
              qc.invalidateQueries({ queryKey: trpc.ohsListDocuments.queryKey({ token }) });
            }
          }}
        />
      )}
    </div>
  );
}

function SignAcknowledgeModal({
  token,
  target,
  onClose,
  onSigned,
}: {
  token: string;
  target: { kind: "talk" | "doc"; id: number; title: string };
  onClose: () => void;
  onSigned: () => void;
}) {
  const trpc = useTRPC();
  const [sigImage, setSigImage] = useState<string | null>(null);
  const [typedName, setTypedName] = useState("");
  const ackTalk = useMutation(trpc.ohsAcknowledgeToolboxTalk.mutationOptions({
    onSuccess: () => { toast.success("Signed & acknowledged"); onSigned(); },
    onError: (e: any) => toast.error(e.message),
  }));
  const ackDoc = useMutation(trpc.ohsAcknowledgeDocument.mutationOptions({
    onSuccess: () => { toast.success("Signed & acknowledged"); onSigned(); },
    onError: (e: any) => toast.error(e.message),
  }));
  const pending = ackTalk.isPending || ackDoc.isPending;

  function submit() {
    if (!sigImage && !typedName.trim()) {
      toast.error("Please draw your signature or type your full name.");
      return;
    }
    const payload = { token, signatureImage: sigImage || undefined, signatureText: typedName.trim() || undefined };
    if (target.kind === "talk") ackTalk.mutate({ ...payload, toolboxTalkId: target.id });
    else ackDoc.mutate({ ...payload, documentId: target.id });
  }

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-5 border-b flex justify-between items-center">
              <h2 className="text-lg font-semibold">Sign to acknowledge</h2>
              <button onClick={onClose}><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-sm text-gray-700">
                By signing below you confirm that you have read and understood <span className="font-medium">{target.title}</span> and will comply with its requirements.
              </p>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Draw your signature</label>
                <SignaturePad onChange={setSigImage} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Or type your full name</label>
                <input value={typedName} onChange={(e) => setTypedName(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Full name as it appears on your ID" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-2 text-sm border rounded">Cancel</button>
              <button onClick={submit} disabled={pending} className="px-4 py-2 text-sm bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-2">
                {pending && <Loader2 className="w-4 h-4 animate-spin" />}
                Sign & acknowledge
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
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
  const [witnesses, setWitnesses] = useState("");

  const submit = useMutation(trpc.ohsReportIncident.mutationOptions({
    onSuccess: () => { toast.success("Incident reported — admins notified"); onSaved(); },
    onError: (e: any) => toast.error(e.message),
  }));

  return (
    <Transition show={true} as={Fragment}>
      <Dialog onClose={onClose} className="relative z-50">
        <div className="fixed inset-0 bg-black/40" />
        <div className="fixed inset-0 flex items-center justify-center p-4 overflow-y-auto">
          <Dialog.Panel className="bg-white rounded-lg max-w-xl w-full my-8 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex justify-between"><h2 className="text-xl font-semibold">Report Incident</h2><button onClick={onClose}><X className="w-5 h-5" /></button></div>
            <div className="p-6 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm mb-1">Type</label>
                  <select value={type} onChange={(e) => setType(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {["NEAR_MISS", "FIRST_AID", "MEDICAL_TREATMENT", "LOST_TIME_INJURY", "FATALITY", "PROPERTY_DAMAGE", "ENVIRONMENTAL", "DANGEROUS_OCCURRENCE", "OCCUPATIONAL_DISEASE", "OTHER"].map((v) => <option key={v} value={v}>{v.replace(/_/g, " ")}</option>)}
                  </select>
                </div>
                <div><label className="block text-sm mb-1">Severity</label>
                  <select value={severity} onChange={(e) => setSeverity(e.target.value)} className="w-full border rounded-lg px-3 py-2">
                    {["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><label className="block text-sm mb-1">When</label>
                  <input type="datetime-local" value={occurredAt} onChange={(e) => setOccurredAt(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
                <div><label className="block text-sm mb-1">Location</label>
                  <input value={location} onChange={(e) => setLocation(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
                </div>
              </div>
              <div><label className="block text-sm mb-1">Description</label>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div><label className="block text-sm mb-1">Immediate actions</label>
                <textarea value={immediate} onChange={(e) => setImmediate(e.target.value)} rows={2} className="w-full border rounded-lg px-3 py-2" />
              </div>
              <div><label className="block text-sm mb-1">Witnesses</label>
                <input value={witnesses} onChange={(e) => setWitnesses(e.target.value)} className="w-full border rounded-lg px-3 py-2" />
              </div>
            </div>
            <div className="p-4 border-t flex justify-end gap-2">
              <button onClick={onClose} className="px-4 py-2 border rounded-lg">Cancel</button>
              <button disabled={submit.isPending}
                onClick={() => {
                  if (!location.trim() || description.trim().length < 10) { toast.error("Location & description (10+ chars) required"); return; }
                  submit.mutate({
                    token, type: type as any, severity: severity as any,
                    occurredAt: new Date(occurredAt).toISOString(),
                    location, description, immediateActions: immediate || undefined,
                    witnesses: witnesses || undefined, runAi: false,
                  });
                }}
                className="px-4 py-2 bg-red-600 text-white rounded-lg flex items-center gap-2">
                {submit.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <AlertCircle className="w-4 h-4" />} Submit
              </button>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </Transition>
  );
}
