import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Download, FileText, GraduationCap, Megaphone, PenLine, CheckCircle2, Loader2, Award } from "lucide-react";
import { useTRPC } from "~/trpc/react";
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

/**
 * Documentation tab for the artisan portal.
 * Surfaces every document the artisan is on record for, grouped by type:
 *   - Toolbox talks (with sign-to-acknowledge)
 *   - Policies / procedures / SOPs (with sign-to-acknowledge when required)
 *   - Training records & certificates
 */
export function ArtisanDocumentationTab({ token }: { token: string }) {
  const trpc = useTRPC();
  const qc = useQueryClient();

  const talks = useQuery(trpc.ohsListToolboxTalks.queryOptions({ token, forMe: true }));
  const docs = useQuery(trpc.ohsListDocuments.queryOptions({ token }));
  const training = useQuery(trpc.ohsListTraining.queryOptions({ token }));

  const [signTarget, setSignTarget] = useState<{ kind: "talk" | "doc"; id: number; title: string } | null>(null);

  const downloadTalk = useMutation(trpc.ohsExportToolboxTalkPdf.mutationOptions({
    onSuccess: (res: any) => downloadBase64Pdf(res.pdf, res.filename),
    onError: (e: any) => toast.error(e.message),
  }));
  const downloadDoc = useMutation(trpc.ohsExportDocumentPdf.mutationOptions({
    onSuccess: (res: any) => downloadBase64Pdf(res.pdf, res.filename),
    onError: (e: any) => toast.error(e.message),
  }));

  function refresh() {
    qc.invalidateQueries({ queryKey: trpc.ohsListToolboxTalks.queryKey({ token, forMe: true }) });
    qc.invalidateQueries({ queryKey: trpc.ohsListDocuments.queryKey({ token }) });
  }

  return (
    <div className="space-y-6">
      <SectionCard
        icon={<Megaphone className="w-5 h-5 text-amber-600" />}
        title="Toolbox Talks"
        subtitle="Safety talks you must read and sign"
      >
        {talks.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : !talks.data || talks.data.length === 0 ? (
          <Empty text="No toolbox talks assigned to you yet." />
        ) : (
          <ul className="divide-y">
            {talks.data.map((t: any) => (
              <li key={t.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="text-xs text-gray-500 font-mono">{t.reference}</div>
                  <div className="font-medium">{t.title}</div>
                  <div className="text-xs text-gray-500">Topic: {t.topic}</div>
                </div>
                <div className="flex items-center gap-2">
                  {t.myAck ? (
                    <>
                      <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Signed {new Date(t.myAck.ackedAt).toLocaleDateString()}</span>
                      <button
                        onClick={() => downloadTalk.mutate({ token, toolboxTalkId: t.id })}
                        className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1"
                      >
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => setSignTarget({ kind: "talk", id: t.id, title: t.title })}
                      className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1"
                    >
                      <PenLine className="w-3 h-3" /> Sign & acknowledge
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={<FileText className="w-5 h-5 text-amber-600" />}
        title="Policies, Procedures & SOPs"
        subtitle="OHS and operational documents you have access to"
      >
        {docs.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : !docs.data || docs.data.length === 0 ? (
          <Empty text="No documents available." />
        ) : (
          <ul className="divide-y">
            {docs.data.map((d: any) => {
              const signed = d.acks && d.acks[0];
              return (
                <li key={d.id} className="py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs text-gray-500 font-mono">{d.reference} · v{d.version}</div>
                    <div className="font-medium">{d.title}</div>
                    <div className="text-xs text-gray-500">{String(d.type).replace(/_/g, " ")}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    {d.requiresAck ? (
                      signed ? (
                        <>
                          <span className="text-xs text-green-700 flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Signed</span>
                          <button onClick={() => downloadDoc.mutate({ token, documentId: d.id })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1">
                            <Download className="w-3 h-3" /> PDF
                          </button>
                        </>
                      ) : (
                        <button onClick={() => setSignTarget({ kind: "doc", id: d.id, title: d.title })} className="text-xs px-3 py-1 bg-amber-600 text-white rounded hover:bg-amber-700 flex items-center gap-1">
                          <PenLine className="w-3 h-3" /> Sign & acknowledge
                        </button>
                      )
                    ) : (
                      <button onClick={() => downloadDoc.mutate({ token, documentId: d.id })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50 flex items-center gap-1">
                        <Download className="w-3 h-3" /> PDF
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </SectionCard>

      <SectionCard
        icon={<GraduationCap className="w-5 h-5 text-amber-600" />}
        title="Training Records"
        subtitle="Courses, competencies and certificates on file"
      >
        {training.isLoading ? (
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        ) : !training.data || training.data.length === 0 ? (
          <Empty text="No training records yet." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-gray-500 border-b">
                  <th className="py-2">Course</th>
                  <th>Provider</th>
                  <th>Status</th>
                  <th>Completed</th>
                  <th>Expires</th>
                  <th>Certificate</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {training.data.map((r: any) => (
                  <tr key={r.id}>
                    <td className="py-2 font-medium">{r.course}</td>
                    <td className="text-gray-700">{r.provider || "—"}</td>
                    <td>
                      <span className={`text-xs px-2 py-0.5 rounded ${
                        r.status === "COMPLETED" || r.status === "VALID" ? "bg-green-100 text-green-800"
                        : r.status === "EXPIRED" ? "bg-red-100 text-red-800"
                        : r.status === "REQUIRED" ? "bg-amber-100 text-amber-800"
                        : "bg-gray-100 text-gray-700"
                      }`}>{r.status}</span>
                    </td>
                    <td>{r.completedAt ? new Date(r.completedAt).toLocaleDateString() : "—"}</td>
                    <td>{r.expiresAt ? new Date(r.expiresAt).toLocaleDateString() : "—"}</td>
                    <td>
                      {r.certificateUrl ? (
                        <a href={r.certificateUrl} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-xs inline-flex items-center gap-1">
                          <Award className="w-3 h-3" /> View
                        </a>
                      ) : (
                        <span className="text-xs text-gray-400">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </SectionCard>

      {signTarget && (
        <SignModal
          token={token}
          target={signTarget}
          onClose={() => setSignTarget(null)}
          onSigned={() => { setSignTarget(null); refresh(); }}
        />
      )}
    </div>
  );
}

function SectionCard({ icon, title, subtitle, children }: { icon: React.ReactNode; title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div>{icon}</div>
        <div>
          <h2 className="font-semibold">{title}</h2>
          {subtitle && <p className="text-xs text-gray-500">{subtitle}</p>}
        </div>
      </div>
      {children}
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-gray-500 py-3">{text}</p>;
}

function SignModal({
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
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4 overflow-y-auto">
      <div className="bg-white rounded-lg max-w-lg w-full my-8 max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center">
          <h2 className="text-lg font-semibold">Sign to acknowledge</h2>
          <button onClick={onClose} className="text-gray-500">✕</button>
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
      </div>
    </div>
  );
}
