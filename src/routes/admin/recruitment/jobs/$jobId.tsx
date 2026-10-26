import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  Briefcase, ArrowLeft, Users, Send, CheckCircle2, Loader2, Star,
  Clock, XCircle, Award, FileText, MapPin, Shield, Edit2, Copy,
  Sparkles, GitCompare, Trash2,
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
  const navigate = useNavigate();

  if (!token || !user) return null;

  const jobQuery = useQuery(trpc.getJobDetail.queryOptions({ token, jobId }));
  const appsQuery = useQuery(trpc.getApplications.queryOptions({ token, jobId, take: 500 }));
  const rejectionReasonsQ = useQuery(trpc.getRejectionReasons.queryOptions({ token }));
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
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [rejectOpen, setRejectOpen] = useState(false);
  const [shortlistCount, setShortlistCount] = useState<number>(5);

  const bulkRejectMut = useMutation(
    trpc.bulkRejectApplications.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Rejected ${res.rejected} application${res.rejected === 1 ? "" : "s"}`);
        setSelectedIds(new Set());
        setRejectOpen(false);
        queryClient.invalidateQueries({ queryKey: trpc.getApplications.queryKey({ token, jobId, take: 500 }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const shortlistMut = useMutation(
    trpc.shortlistTopApplications.mutationOptions({
      onSuccess: (res) => {
        toast.success(`Shortlisted ${res.shortlisted} candidate${res.shortlisted === 1 ? "" : "s"} to SCREENING`);
        queryClient.invalidateQueries({ queryKey: trpc.getApplications.queryKey({ token, jobId, take: 500 }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
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
            <Link
              to="/admin/recruitment/jobs/$jobId/setup"
              params={{ jobId: String(jobId) }}
              className="px-3 py-2 border rounded-lg text-sm flex items-center gap-1.5 hover:bg-gray-50"
            >
              <FileText className="w-4 h-4" /> Setup (work samples, questions)
            </Link>
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
                  {b.key === "APPLIED" && (grouped["APPLIED"]?.length ?? 0) > 0 && (
                    <div className="mb-2 flex items-center gap-1">
                      <input
                        type="number"
                        min={1}
                        max={50}
                        value={shortlistCount}
                        onChange={(e) => setShortlistCount(Math.max(1, Math.min(50, Number(e.target.value) || 5)))}
                        className="w-12 rounded border px-1.5 py-0.5 text-xs"
                        title="How many top-ranked applicants to move to SCREENING"
                      />
                      <button
                        onClick={() => shortlistMut.mutate({ token, jobId, count: shortlistCount })}
                        disabled={shortlistMut.isPending}
                        className="flex-1 text-xs bg-teal-600 text-white px-2 py-1 rounded hover:bg-teal-700 disabled:opacity-50 flex items-center justify-center gap-1"
                        title="Shortlist top N candidates by overall / AI match score"
                      >
                        <Sparkles className="w-3 h-3" /> Shortlist top {shortlistCount}
                      </button>
                    </div>
                  )}
                  <div className="space-y-2">
                    {(grouped[b.key] ?? []).slice(0, 50).map((a: any) => {
                      const isSelectable = b.key === "APPLIED" || b.key === "SCREENING";
                      const isSelected = selectedIds.has(a.id);
                      return (
                      <div key={a.id} className={`bg-white rounded-lg p-3 shadow-sm ${isSelected ? "ring-2 ring-teal-500" : ""}`}>
                        <div className="flex items-start gap-2">
                          {isSelectable && (
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                setSelectedIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(a.id);
                                  else next.delete(a.id);
                                  return next;
                                });
                              }}
                              className="mt-1"
                              title="Select for bulk action or compare"
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <Link
                              to="/admin/recruitment/applications/$appId"
                              params={{ appId: String(a.id) }}
                              className="font-medium text-sm hover:text-teal-600 truncate block"
                            >
                              {a.firstName} {a.lastName}
                            </Link>
                            <div className="text-xs text-gray-500 mt-0.5 truncate">{a.primaryTrade ?? ""}</div>
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
                          </div>
                        </div>
                        <StageAdvanceButton
                          currentBucket={b.key}
                          onMove={(to) => moveMut.mutate({ token, applicationId: a.id, toBucket: to as any })}
                        />
                      </div>
                      );
                    })}
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

      {/* Floating action bar for bulk selections */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 bg-white rounded-full shadow-lg border px-4 py-2 flex items-center gap-3">
          <span className="text-sm font-medium text-gray-700">{selectedIds.size} selected</span>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700"
          >
            Clear
          </button>
          <div className="h-5 w-px bg-gray-200" />
          <button
            disabled={selectedIds.size < 2 || selectedIds.size > 6}
            onClick={() =>
              navigate({
                to: "/admin/recruitment/compare",
                search: { ids: Array.from(selectedIds).join(",") },
              })
            }
            title={selectedIds.size < 2 ? "Select 2-6 to compare" : selectedIds.size > 6 ? "Compare at most 6" : "Compare side-by-side"}
            className="text-sm bg-blue-600 text-white px-3 py-1.5 rounded-full hover:bg-blue-700 disabled:opacity-40 flex items-center gap-1.5"
          >
            <GitCompare className="w-4 h-4" /> Compare
          </button>
          <button
            onClick={() => setRejectOpen(true)}
            className="text-sm bg-red-600 text-white px-3 py-1.5 rounded-full hover:bg-red-700 flex items-center gap-1.5"
          >
            <Trash2 className="w-4 h-4" /> Bulk reject
          </button>
        </div>
      )}

      {rejectOpen && (
        <BulkRejectModal
          count={selectedIds.size}
          reasons={rejectionReasonsQ.data ?? []}
          submitting={bulkRejectMut.isPending}
          onClose={() => setRejectOpen(false)}
          onConfirm={(rejectionReasonId, rejectionDetail, sendEmailToCandidate) =>
            bulkRejectMut.mutate({
              token,
              applicationIds: Array.from(selectedIds),
              rejectionReasonId,
              rejectionDetail: rejectionDetail || undefined,
              sendEmailToCandidate,
            })
          }
        />
      )}
    </div>
  );
}

function BulkRejectModal({
  count, reasons, submitting, onClose, onConfirm,
}: {
  count: number;
  reasons: Array<{ id: number; label: string; category?: string | null }>;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (rejectionReasonId: number, rejectionDetail: string, sendEmailToCandidate: boolean) => void;
}) {
  const [reasonId, setReasonId] = useState<number | "">("");
  const [detail, setDetail] = useState("");
  const [sendEmail, setSendEmail] = useState(true);
  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="p-5 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold flex items-center gap-2 text-red-700">
            <Trash2 className="w-5 h-5" /> Reject {count} application{count === 1 ? "" : "s"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Rejection reason</label>
            <select
              value={reasonId}
              onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : "")}
              className="w-full rounded-lg border px-3 py-2"
            >
              <option value="">Select a reason…</option>
              {reasons.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.category ? `[${r.category}] ` : ""}{r.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Additional notes (optional, internal)</label>
            <textarea
              value={detail}
              onChange={(e) => setDetail(e.target.value)}
              rows={3}
              placeholder="Extra context recorded on each application"
              className="w-full rounded-lg border px-3 py-2"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={sendEmail}
              onChange={(e) => setSendEmail(e.target.checked)}
            />
            Send rejection email to each candidate
          </label>
        </div>
        <div className="p-5 border-t flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg border">Cancel</button>
          <button
            disabled={!reasonId || submitting}
            onClick={() => reasonId && onConfirm(reasonId as number, detail, sendEmail)}
            className="px-4 py-2 rounded-lg bg-red-600 text-white disabled:opacity-50 flex items-center gap-1.5"
          >
            {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
            Reject {count} application{count === 1 ? "" : "s"}
          </button>
        </div>
      </div>
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
    salaryPeriod?: "MONTHLY" | "DAILY" | "HOURLY" | "WEEKLY" | "ANNUAL";
    marketRelated?: boolean;
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
    salaryPeriod: (job.salaryPeriod as "MONTHLY" | "DAILY" | "HOURLY" | "WEEKLY" | "ANNUAL") ?? "MONTHLY",
    marketRelated: Boolean(job.marketRelated),
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
            <EditField
              label={`Min salary (${form.salaryPeriod === "HOURLY" ? "R/hour" : form.salaryPeriod === "DAILY" ? "R/day" : form.salaryPeriod === "WEEKLY" ? "R/week" : form.salaryPeriod === "ANNUAL" ? "R/year" : "R/month"})`}
              type="number"
              value={form.marketRelated ? "" : form.minSalary}
              onChange={(v) => setForm({ ...form, minSalary: v })}
            />
            <EditField
              label={`Max salary (${form.salaryPeriod === "HOURLY" ? "R/hour" : form.salaryPeriod === "DAILY" ? "R/day" : form.salaryPeriod === "WEEKLY" ? "R/week" : form.salaryPeriod === "ANNUAL" ? "R/year" : "R/month"})`}
              type="number"
              value={form.marketRelated ? "" : form.maxSalary}
              onChange={(v) => setForm({ ...form, maxSalary: v })}
            />
            <EditField label="Headcount" type="number" value={form.headcount} onChange={(v) => setForm({ ...form, headcount: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="block text-sm font-medium mb-1">Pay period</label>
              <select
                value={form.salaryPeriod}
                onChange={(e) => setForm({ ...form, salaryPeriod: e.target.value as any })}
                className="w-full rounded-lg border px-3 py-2"
                disabled={form.marketRelated}
              >
                <option value="HOURLY">Per hour</option>
                <option value="DAILY">Per day</option>
                <option value="WEEKLY">Per week</option>
                <option value="MONTHLY">Per month</option>
                <option value="ANNUAL">Per year</option>
              </select>
            </div>
            <label className="flex items-center gap-2 h-10 px-3">
              <input
                type="checkbox"
                checked={form.marketRelated}
                onChange={(e) => setForm({ ...form, marketRelated: e.target.checked })}
              />
              <span className="text-sm">Market related (no fixed range)</span>
            </label>
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
                minSalary: form.marketRelated ? undefined : (form.minSalary ? Number(form.minSalary) : undefined),
                maxSalary: form.marketRelated ? undefined : (form.maxSalary ? Number(form.maxSalary) : undefined),
                salaryPeriod: form.salaryPeriod,
                marketRelated: form.marketRelated,
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
