import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import {
  Briefcase, ArrowLeft, Users, Send, CheckCircle2, Loader2, Star,
  Clock, XCircle, Award, FileText, MapPin, Shield, Edit2, Copy,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/recruitment/jobs/$jobId")({
  component: JobDetailPage,
});

const BUCKETS = [
  { key: "APPLIED", label: "Applied", color: "bg-blue-50 border-blue-200" },
  { key: "SCREENING", label: "Screening", color: "bg-indigo-50 border-indigo-200" },
  { key: "ASSESSMENT", label: "Assessment", color: "bg-purple-50 border-purple-200" },
  { key: "INTERVIEW", label: "Interview", color: "bg-orange-50 border-orange-200" },
  { key: "OFFER", label: "Offer", color: "bg-amber-50 border-amber-200" },
  { key: "BACKGROUND_CHECK", label: "Background", color: "bg-cyan-50 border-cyan-200" },
  { key: "HIRED", label: "Hired", color: "bg-emerald-50 border-emerald-200" },
];

function JobDetailPage() {
  const { jobId: rawId } = Route.useParams();
  const jobId = Number(rawId);
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  if (!token || !user) return null;

  const jobQuery = useQuery(trpc.getJobDetail.queryOptions({ token, jobId }));
  const appsQuery = useQuery(trpc.getApplications.queryOptions({ token, jobId, take: 500 }));
  const publishMut = useMutation(
    trpc.publishJob.mutationOptions({
      onSuccess: () => {
        toast.success("Job published");
        queryClient.invalidateQueries({ queryKey: trpc.getJobDetail.queryKey({ token, jobId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const closeMut = useMutation(
    trpc.closeJob.mutationOptions({
      onSuccess: () => {
        toast.success("Job closed");
        queryClient.invalidateQueries({ queryKey: trpc.getJobDetail.queryKey({ token, jobId }) });
      },
    }),
  );
  const moveMut = useMutation(
    trpc.moveApplicationStage.mutationOptions({
      onSuccess: () => {
        toast.success("Moved");
        queryClient.invalidateQueries({ queryKey: trpc.getApplications.queryKey({ token, jobId, take: 500 }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const [editOpen, setEditOpen] = useState(false);
  const updateMut = useMutation(
    trpc.updateJob.mutationOptions({
      onSuccess: () => {
        toast.success("Job updated");
        queryClient.invalidateQueries({ queryKey: trpc.getJobDetail.queryKey({ token, jobId }) });
        setEditOpen(false);
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const job = jobQuery.data;
  const apps = appsQuery.data ?? [];
  const grouped: Record<string, any[]> = {};
  for (const b of BUCKETS) grouped[b.key] = [];
  grouped["REJECTED"] = [];
  grouped["WITHDRAWN"] = [];
  for (const a of apps) {
    if (!grouped[a.stageBucket]) grouped[a.stageBucket] = [];
    grouped[a.stageBucket]!.push(a);
  }

  const publicUrl = job?.slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/careers/${job.slug}` : "";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/recruitment/jobs" className="text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{job?.title ?? "…"}</h1>
              <div className="text-xs text-gray-500 flex items-center gap-3">
                <span>{job?.status}</span>
                {job?.location && <span className="flex items-center gap-1"><MapPin className="w-3 h-3" />{job.location}</span>}
                <span>{apps.length} applicants</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {job?.slug && (
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicUrl);
                  toast.success("Public link copied");
                }}
                className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50"
              >
                <Copy className="w-4 h-4" /> Copy link
              </button>
            )}
            <button
              onClick={() => setEditOpen(true)}
              className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50"
            >
              <Edit2 className="w-4 h-4" /> Edit
            </button>
            {job?.status === "DRAFT" || job?.status === "PENDING_APPROVAL" ? (
              <button
                onClick={() => publishMut.mutate({ token, jobId })}
                disabled={publishMut.isPending}
                className="px-3 py-2 rounded-lg bg-teal-600 text-white text-sm flex items-center gap-1.5 disabled:opacity-50"
              >
                <Send className="w-4 h-4" /> Publish
              </button>
            ) : job?.status === "OPEN" ? (
              <button
                onClick={() => closeMut.mutate({ token, jobId })}
                className="px-3 py-2 rounded-lg border text-sm hover:bg-gray-50 flex items-center gap-1.5"
              >
                <XCircle className="w-4 h-4" /> Close job
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {jobQuery.isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : (
          <>
            {/* Summary strip */}
            <div className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-6">
              {BUCKETS.map((b) => (
                <div key={b.key} className={`rounded-lg border p-3 ${b.color}`}>
                  <div className="text-xs font-medium text-gray-600">{b.label}</div>
                  <div className="text-2xl font-semibold">{grouped[b.key]?.length ?? 0}</div>
                </div>
              ))}
            </div>

            {/* Pipeline kanban */}
            <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {BUCKETS.map((b) => (
                <div key={b.key} className={`rounded-xl border ${b.color} p-3 min-h-[300px]`}>
                  <div className="text-sm font-semibold mb-3 flex items-center justify-between">
                    <span>{b.label}</span>
                    <span className="bg-white/70 rounded-full px-2 text-xs">{grouped[b.key]?.length ?? 0}</span>
                  </div>
                  <div className="space-y-2">
                    {(grouped[b.key] ?? []).slice(0, 50).map((a: any) => (
                      <div key={a.id} className="bg-white rounded-lg p-3 shadow-sm">
                        <Link
                          to="/admin/recruitment/applications/$appId"
                          params={{ appId: String(a.id) }}
                          className="font-medium text-sm hover:text-teal-600"
                        >
                          {a.firstName} {a.lastName}
                        </Link>
                        <div className="text-xs text-gray-500 mt-0.5">{a.primaryTrade ?? ""}</div>
                        <div className="flex items-center gap-1.5 mt-2">
                          {a.overallScore !== null && (
                            <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${
                              a.overallScore >= 70 ? "bg-emerald-100 text-emerald-700" :
                              a.overallScore >= 50 ? "bg-amber-100 text-amber-700" :
                              "bg-red-100 text-red-700"
                            }`}>
                              {Math.round(a.overallScore)}
                            </span>
                          )}
                          {a._count?.scorecardSubmissions > 0 && (
                            <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                              <Star className="w-3 h-3" />{a._count.scorecardSubmissions}
                            </span>
                          )}
                        </div>
                        <StageAdvanceButton
                          currentBucket={b.key}
                          onMove={(to) => moveMut.mutate({ token, applicationId: a.id, toBucket: to as any })}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Rejected / Withdrawn */}
            {(grouped["REJECTED"]?.length || grouped["WITHDRAWN"]?.length) ? (
              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5 text-red-700">
                    <XCircle className="w-4 h-4" /> Rejected ({grouped["REJECTED"]?.length ?? 0})
                  </h3>
                  <div className="space-y-1 text-sm">
                    {(grouped["REJECTED"] ?? []).slice(0, 10).map((a: any) => (
                      <Link key={a.id} to="/admin/recruitment/applications/$appId" params={{ appId: String(a.id) }} className="block hover:text-teal-600">
                        {a.firstName} {a.lastName} — {a.rejectionReason?.label ?? "—"}
                      </Link>
                    ))}
                  </div>
                </div>
                <div className="bg-white rounded-xl border p-4">
                  <h3 className="text-sm font-semibold mb-3 text-slate-700">Withdrawn ({grouped["WITHDRAWN"]?.length ?? 0})</h3>
                  <div className="space-y-1 text-sm">
                    {(grouped["WITHDRAWN"] ?? []).slice(0, 10).map((a: any) => (
                      <Link key={a.id} to="/admin/recruitment/applications/$appId" params={{ appId: String(a.id) }} className="block hover:text-teal-600">
                        {a.firstName} {a.lastName}
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      {editOpen && job && (
        <EditJobModal
          job={job}
          submitting={updateMut.isPending}
          onClose={() => setEditOpen(false)}
          onSave={(data) => updateMut.mutate({ token, jobId, ...data })}
        />
      )}
    </div>
  );
}

function EditJobModal({
  job, submitting, onClose, onSave,
}: {
  job: any;
  submitting: boolean;
  onClose: () => void;
  onSave: (data: {
    title?: string;
    department?: string;
    location?: string;
    description?: string;
    requirements?: string;
    responsibilities?: string;
    niceToHaves?: string;
    minSalary?: number;
    maxSalary?: number;
    headcount?: number;
  }) => void;
}) {
  const [form, setForm] = useState({
    title: job.title ?? "",
    department: job.department ?? "",
    location: job.location ?? "",
    description: job.description ?? "",
    requirements: job.requirements ?? "",
    responsibilities: job.responsibilities ?? "",
    niceToHaves: job.niceToHaves ?? "",
    minSalary: job.minSalary ? String(job.minSalary) : "",
    maxSalary: job.maxSalary ? String(job.maxSalary) : "",
    headcount: String(job.headcount ?? job.openings ?? 1),
  });
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-2xl max-h-[90vh] overflow-auto">
        <div className="p-5 border-b flex items-center justify-between sticky top-0 bg-white">
          <h2 className="text-lg font-semibold">Edit job</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <EditField label="Title" value={form.title} onChange={(v) => setForm({ ...form, title: v })} />
          <div className="grid grid-cols-2 gap-3">
            <EditField label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
            <EditField label="Location" value={form.location} onChange={(v) => setForm({ ...form, location: v })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <EditField label="Min salary (ZAR)" type="number" value={form.minSalary} onChange={(v) => setForm({ ...form, minSalary: v })} />
            <EditField label="Max salary (ZAR)" type="number" value={form.maxSalary} onChange={(v) => setForm({ ...form, maxSalary: v })} />
            <EditField label="Headcount" type="number" value={form.headcount} onChange={(v) => setForm({ ...form, headcount: v })} />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Description</label>
            <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
              rows={4} className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Responsibilities</label>
            <textarea value={form.responsibilities} onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              rows={3} className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Requirements</label>
            <textarea value={form.requirements} onChange={(e) => setForm({ ...form, requirements: e.target.value })}
              rows={3} className="w-full rounded-lg border px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Nice to haves</label>
            <textarea value={form.niceToHaves} onChange={(e) => setForm({ ...form, niceToHaves: e.target.value })}
              rows={2} className="w-full rounded-lg border px-3 py-2" />
          </div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2 sticky bottom-0 bg-white">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button
            disabled={!form.title || submitting}
            onClick={() =>
              onSave({
                title: form.title,
                department: form.department || undefined,
                location: form.location || undefined,
                description: form.description || undefined,
                responsibilities: form.responsibilities || undefined,
                requirements: form.requirements || undefined,
                niceToHaves: form.niceToHaves || undefined,
                minSalary: form.minSalary ? Number(form.minSalary) : undefined,
                maxSalary: form.maxSalary ? Number(form.maxSalary) : undefined,
                headcount: form.headcount ? Number(form.headcount) : undefined,
              })
            }
            className="px-4 py-2 rounded-lg bg-teal-600 text-white disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Save changes
          </button>
        </div>
      </div>
    </div>
  );
}

function EditField({
  label, value, onChange, type = "text",
}: { label: string; value: string; onChange: (v: string) => void; type?: string }) {
  return (
    <div>
      <label className="block text-sm font-medium mb-1">{label}</label>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg border px-3 py-2" />
    </div>
  );
}

function StageAdvanceButton({ currentBucket, onMove }: { currentBucket: string; onMove: (to: string) => void }) {
  const next: Record<string, string> = {
    APPLIED: "SCREENING",
    SCREENING: "ASSESSMENT",
    ASSESSMENT: "INTERVIEW",
    INTERVIEW: "OFFER",
    OFFER: "BACKGROUND_CHECK",
    BACKGROUND_CHECK: "HIRED",
  };
  const n = next[currentBucket];
  if (!n) return null;
  return (
    <div className="mt-2 flex gap-1">
      <button onClick={() => onMove(n)} className="text-xs bg-teal-50 text-teal-700 px-2 py-0.5 rounded hover:bg-teal-100">
        → {n.replace(/_/g, " ").toLowerCase()}
      </button>
      <button onClick={() => onMove("REJECTED")} className="text-xs text-red-600 px-2 py-0.5 rounded hover:bg-red-50">Reject</button>
    </div>
  );
}
