import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import {
  ArrowLeft, Star, Calendar, FileText, MessageSquare, Shield, UserCheck,
  AlertCircle, CheckCircle2, Clock, Loader2, Send, Sparkles, Award,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/recruitment/applications/$appId")({
  component: ApplicationDetailPage,
});

type TabKey = "overview" | "scorecards" | "interviews" | "offers" | "checks" | "notes" | "history";

function ApplicationDetailPage() {
  const { appId: rawId } = Route.useParams();
  const applicationId = Number(rawId);
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [tab, setTab] = useState<TabKey>("overview");

  if (!token || !user) return null;

  const q = useQuery(trpc.getApplicationDetail.queryOptions({ token, applicationId }));
  const recomputeMut = useMutation(
    trpc.recomputeScore.mutationOptions({
      onSuccess: () => {
        toast.success("Score recomputed");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
    }),
  );
  const rejectMut = useMutation(
    trpc.rejectApplication.mutationOptions({
      onSuccess: () => {
        toast.success("Application rejected");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const addNoteMut = useMutation(
    trpc.addApplicationNote.mutationOptions({
      onSuccess: () => {
        toast.success("Note added");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
    }),
  );

  const app = q.data as any;
  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-teal-600" /></div>;
  }
  if (!app) return <div className="p-8 text-center text-gray-500">Not found</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/recruitment/jobs/$jobId"
              params={{ jobId: String(app.jobId) }}
              className="text-gray-500 hover:text-gray-700"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-semibold">{app.firstName} {app.lastName}</h1>
              <div className="text-xs text-gray-500">
                {app.email} · {app.phone ?? "—"} · applied for {app.job?.title}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {app.overallScore !== null && (
              <div className={`px-3 py-1.5 rounded-lg text-sm font-semibold ${
                app.overallScore >= 70 ? "bg-emerald-100 text-emerald-700" :
                app.overallScore >= 50 ? "bg-amber-100 text-amber-700" :
                "bg-red-100 text-red-700"
              }`}>
                Score {Math.round(app.overallScore)}
              </div>
            )}
            {app.aiMatchScore !== null && (
              <div className="px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-sm font-semibold flex items-center gap-1">
                <Sparkles className="w-4 h-4" /> AI {Math.round(app.aiMatchScore)}
              </div>
            )}
            <button
              onClick={() => recomputeMut.mutate({ token, applicationId })}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
            >
              Recompute
            </button>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {(["overview","scorecards","interviews","offers","checks","notes","history"] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
                tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "overview" && <OverviewTab app={app} onReject={(reasonId, notes) =>
          rejectMut.mutate({ token, applicationId, rejectionReasonId: reasonId, rejectionDetail: notes })
        } token={token} />}
        {tab === "scorecards" && <ScorecardsTab app={app} token={token} applicationId={applicationId} />}
        {tab === "interviews" && <InterviewsTab app={app} token={token} applicationId={applicationId} />}
        {tab === "offers" && <OffersTab app={app} token={token} applicationId={applicationId} />}
        {tab === "checks" && <ChecksTab app={app} token={token} applicationId={applicationId} />}
        {tab === "notes" && <NotesTab app={app} token={token} applicationId={applicationId}
          onAdd={(body, isPrivate) => addNoteMut.mutate({ token, applicationId, body, isPrivate })} />}
        {tab === "history" && <HistoryTab app={app} />}
      </div>
    </div>
  );
}

function Box({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-3 text-gray-800">{title}</h3>
      {children}
    </div>
  );
}

function OverviewTab({ app, onReject, token }: { app: any; onReject: (id: number, notes?: string) => void; token: string }) {
  const trpc = useTRPC();
  const reasonsQuery = useQuery(trpc.getRejectionReasons.queryOptions({ token }));
  const [showReject, setShowReject] = useState(false);
  const [reasonId, setReasonId] = useState<number | null>(null);
  const [notes, setNotes] = useState("");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        <Box title="Candidate">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Field label="Email" value={app.email} />
            <Field label="Phone" value={app.phone} />
            <Field label="Location" value={[app.city, app.province].filter(Boolean).join(", ") || null} />
            <Field label="Primary trade" value={app.primaryTrade} />
            <Field label="Experience" value={app.yearsExperience != null ? `${app.yearsExperience} years` : null} />
            <Field label="Expected salary" value={app.expectedSalary ? `R${app.expectedSalary.toLocaleString()}` : null} />
            <Field label="Current stage" value={app.currentStage?.name ?? app.stageBucket} />
            <Field label="Source" value={app.sourceChannel} />
            <Field label="Applied" value={new Date(app.createdAt).toLocaleDateString()} />
            <Field label="Assigned recruiter" value={app.assignedRecruiter ? `${app.assignedRecruiter.firstName} ${app.assignedRecruiter.lastName}` : "Unassigned"} />
          </div>
        </Box>
        <Box title="AI match summary">
          {app.aiMatchExplanation ? (
            <div className="text-sm whitespace-pre-wrap text-gray-700">{app.aiMatchExplanation}</div>
          ) : (
            <div className="text-sm text-gray-400">No AI summary yet. Click "Recompute" to generate.</div>
          )}
        </Box>
        <Box title="Assessments">
          {app.assessments?.length ? (
            <div className="space-y-2">
              {app.assessments.map((a: any, i: number) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="font-medium">{a.type}</span>
                  <span className="text-gray-600">
                    {a.score !== null ? `${Math.round(a.score)}/100` : "In progress"}
                    {a.completedAt && <span className="text-gray-400 ml-2">· {new Date(a.completedAt).toLocaleDateString()}</span>}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">No assessments yet</div>
          )}
        </Box>
      </div>
      <div className="space-y-4">
        <Box title="Actions">
          <div className="space-y-2">
            <button
              onClick={() => setShowReject(true)}
              className="w-full px-3 py-2 border border-red-200 text-red-700 rounded-lg text-sm hover:bg-red-50"
            >
              Reject
            </button>
          </div>
        </Box>
        {showReject && (
          <Box title="Reject — reason">
            <select
              value={reasonId ?? ""}
              onChange={(e) => setReasonId(Number(e.target.value))}
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
            >
              <option value="">Select reason…</option>
              {(reasonsQuery.data ?? []).map((r: any) => (
                <option key={r.id} value={r.id}>{r.category} — {r.label}</option>
              ))}
            </select>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional notes (visible to candidate if enabled)"
              className="w-full border rounded-lg px-3 py-2 text-sm mb-2"
              rows={3}
            />
            <div className="flex gap-2">
              <button
                disabled={!reasonId}
                onClick={() => { onReject(reasonId!, notes); setShowReject(false); }}
                className="flex-1 px-3 py-2 bg-red-600 text-white rounded-lg text-sm disabled:opacity-50"
              >
                Confirm
              </button>
              <button onClick={() => setShowReject(false)} className="px-3 py-2 border rounded-lg text-sm">Cancel</button>
            </div>
          </Box>
        )}
        <Box title="Consent & compliance">
          <div className="text-xs text-gray-600 space-y-1">
            <div>POPIA consent: {app.consentGivenAt ? `✓ Given (v${app.consentVersion ?? "?"})` : "✗ Not given"}</div>
            <div>Consent date: {app.consentGivenAt ? new Date(app.consentGivenAt).toLocaleDateString() : "—"}</div>
            <div>Retention until: {app.retainUntil ? new Date(app.retainUntil).toLocaleDateString() : "—"}</div>
            {app.utmSource && <div>UTM: {app.utmSource}/{app.utmMedium}/{app.utmCampaign}</div>}
          </div>
        </Box>
      </div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-sm font-medium text-gray-800">{value ?? "—"}</div>
    </div>
  );
}

function ScorecardsTab({ app, token, applicationId }: { app: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const scorecards = useQuery(trpc.getScorecards.queryOptions({ token }));
  const submitMut = useMutation(
    trpc.submitScorecard.mutationOptions({
      onSuccess: () => {
        toast.success("Scorecard submitted");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const [sel, setSel] = useState<number | null>(null);
  const [ratings, setRatings] = useState<Record<number, number>>({});
  const [decision, setDecision] = useState<"HIRE" | "NO_HIRE" | "STRONG_HIRE" | "STRONG_NO_HIRE">("HIRE");
  const [summary, setSummary] = useState("");
  const [overallRating, setOverallRating] = useState(3);

  const selected = (scorecards.data ?? []).find((s: any) => s.id === sel);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="Submitted scorecards">
        {app.scorecardSubmissions?.length ? (
          <div className="space-y-3">
            {app.scorecardSubmissions.map((s: any) => (
              <div key={s.id} className="border rounded-lg p-3">
                <div className="flex justify-between text-sm">
                  <span className="font-medium">{s.scorecard?.name}</span>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    s.recommendation?.startsWith("STRONG_HIRE") || s.recommendation === "HIRE" ? "bg-emerald-100 text-emerald-700" :
                    s.recommendation?.includes("NO_HIRE") ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                  }`}>{s.recommendation}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">
                  by {s.interviewer?.firstName} {s.interviewer?.lastName} · {new Date(s.createdAt).toLocaleDateString()} · rating {s.overallRating}/5
                </div>
                {s.notes && <div className="text-sm mt-2 text-gray-700">{s.notes}</div>}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-gray-400">No scorecards submitted yet</div>
        )}
      </Box>
      <Box title="Submit scorecard">
        <select value={sel ?? ""} onChange={(e) => setSel(Number(e.target.value))} className="w-full border rounded-lg px-3 py-2 text-sm mb-3">
          <option value="">Select scorecard template…</option>
          {(scorecards.data ?? []).map((s: any) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>
        {selected && (
          <div className="space-y-3">
            {selected.criteria.map((c: any) => (
              <div key={c.id}>
                <div className="text-sm font-medium">{c.name}</div>
                <div className="text-xs text-gray-500 mb-1">{c.description}</div>
                <div className="flex gap-1">
                  {[1,2,3,4,5].map((n) => (
                    <button key={n}
                      onClick={() => setRatings({ ...ratings, [c.id]: n })}
                      className={`w-9 h-9 rounded border text-sm ${ratings[c.id] === n ? "bg-teal-600 text-white" : "hover:bg-gray-50"}`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <div>
              <div className="text-xs text-gray-500 mb-1">Overall rating</div>
              <div className="flex gap-1">
                {[1,2,3,4,5].map(n => (
                  <button key={n} onClick={() => setOverallRating(n)}
                    className={`w-9 h-9 rounded border text-sm ${overallRating === n ? "bg-amber-500 text-white" : "hover:bg-gray-50"}`}>{n}</button>
                ))}
              </div>
            </div>
            <select value={decision} onChange={(e) => setDecision(e.target.value as any)} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="STRONG_HIRE">Strong hire</option>
              <option value="HIRE">Hire</option>
              <option value="NO_HIRE">No hire</option>
              <option value="STRONG_NO_HIRE">Strong no-hire</option>
            </select>
            <textarea value={summary} onChange={(e) => setSummary(e.target.value)} placeholder="Notes / rationale"
              className="w-full border rounded-lg px-3 py-2 text-sm" rows={3} />
            <button
              onClick={() => submitMut.mutate({
                token,
                applicationId,
                scorecardId: selected.id,
                overallRating,
                recommendation: decision,
                ratings: Object.fromEntries(Object.entries(ratings).map(([k, v]) => [k, v])),
                notes: summary,
              })}
              disabled={submitMut.isPending}
              className="w-full px-3 py-2 bg-teal-600 text-white rounded-lg text-sm disabled:opacity-50"
            >
              Submit
            </button>
          </div>
        )}
      </Box>
    </div>
  );
}

function InterviewsTab({ app, token, applicationId }: { app: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const slotsQ = useQuery(trpc.listAvailableSlots.queryOptions({ token }));
  const bookMut = useMutation(
    trpc.bookInterview.mutationOptions({
      onSuccess: () => {
        toast.success("Interview booked — invites sent");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="Scheduled interviews">
        {app.interviewBookings?.length ? (
          <div className="space-y-3">
            {app.interviewBookings.map((b: any) => (
              <div key={b.id} className="border rounded-lg p-3 text-sm">
                <div className="font-medium">{b.panel?.name}</div>
                <div className="text-xs text-gray-500">
                  {new Date(b.scheduledStart).toLocaleString()} → {new Date(b.scheduledEnd).toLocaleTimeString()}
                </div>
                <div className="text-xs mt-1">
                  {b.panel?.members?.map((m: any) => `${m.user.firstName} ${m.user.lastName}`).join(", ")}
                </div>
                <div className="mt-1">
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    b.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                    b.status === "CANCELLED" ? "bg-red-100 text-red-700" : "bg-blue-100 text-blue-700"
                  }`}>{b.status}</span>
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No interviews yet</div>}
      </Box>
      <Box title="Book an available slot">
        {(slotsQ.data ?? []).length ? (
          <div className="space-y-2">
            {(slotsQ.data ?? []).map((s: any) => (
              <div key={s.id} className="flex items-center justify-between border rounded-lg p-3 text-sm">
                <div>
                  <div className="font-medium">{s.interviewer ? `${s.interviewer.firstName} ${s.interviewer.lastName}` : "Slot"}</div>
                  <div className="text-xs text-gray-500">{new Date(s.startTime).toLocaleString()}</div>
                </div>
                <button
                  onClick={() => bookMut.mutate({
                    token,
                    slotId: s.id,
                    applicationId,
                    scheduledStart: new Date(s.startTime),
                    scheduledEnd: new Date(s.endTime),
                  })}
                  className="px-3 py-1 bg-teal-600 text-white rounded text-xs"
                >
                  Book
                </button>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No available slots — create an interview panel first</div>}
      </Box>
    </div>
  );
}

function OffersTab({ app, token, applicationId }: { app: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [show, setShow] = useState(false);
  const [form, setForm] = useState({
    title: app.job?.title ?? "",
    salaryAmount: 0,
    startDate: "",
    probationMonths: 3,
    letterContent: "",
  });
  const createMut = useMutation(
    trpc.createOffer.mutationOptions({
      onSuccess: () => {
        toast.success("Offer created");
        setShow(false);
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const sendMut = useMutation(
    trpc.sendOffer.mutationOptions({
      onSuccess: () => {
        toast.success("Offer sent to candidate");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
    }),
  );
  const approveMut = useMutation(
    trpc.approveOffer.mutationOptions({
      onSuccess: () => {
        toast.success("Offer approved");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
    }),
  );

  return (
    <div className="space-y-4">
      <Box title="Offers">
        {app.offers?.length ? (
          <div className="space-y-3">
            {app.offers.map((o: any) => (
              <div key={o.id} className="border rounded-lg p-3 text-sm">
                <div className="flex justify-between">
                  <div className="font-medium">{o.title} — R{o.baseSalary?.toLocaleString()}/{o.salaryPeriod}</div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    o.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-700" :
                    o.status === "DECLINED" || o.status === "WITHDRAWN" ? "bg-red-100 text-red-700" :
                    o.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                  }`}>{o.status}</span>
                </div>
                <div className="text-xs text-gray-500">Start: {o.startDate ? new Date(o.startDate).toLocaleDateString() : "—"}{o.expiresAt ? ` · expires ${new Date(o.expiresAt).toLocaleDateString()}` : ""}</div>
                <div className="flex gap-2 mt-2">
                  {o.status === "PENDING_APPROVAL" && (() => {
                    const myApproval = (o.approvals ?? []).find((a: any) => a.approverId === user.id && !a.decidedAt);
                    return myApproval ? (
                      <button onClick={() => approveMut.mutate({ token, approvalId: myApproval.id, decision: "APPROVED" })} className="text-xs bg-emerald-600 text-white rounded px-2 py-1">Approve</button>
                    ) : null;
                  })()}
                  {o.status === "APPROVED" && (
                    <button onClick={() => sendMut.mutate({ token, offerId: o.id })} className="text-xs bg-teal-600 text-white rounded px-2 py-1">Send to candidate</button>
                  )}
                  {o.signToken && (
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(`${window.location.origin}/offer/${o.signToken}`);
                        toast.success("Sign link copied");
                      }}
                      className="text-xs border rounded px-2 py-1"
                    >Copy sign link</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No offers yet</div>}
        <button onClick={() => setShow(!show)} className="mt-3 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm">New offer</button>
      </Box>

      {show && (
        <Box title="Create offer">
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="border rounded px-3 py-2 text-sm" />
            <input type="number" placeholder="Salary (R)" value={form.salaryAmount || ""} onChange={(e) => setForm({ ...form, salaryAmount: Number(e.target.value) })} className="border rounded px-3 py-2 text-sm" />
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="border rounded px-3 py-2 text-sm" />
            <input type="number" placeholder="Probation months" value={form.probationMonths} onChange={(e) => setForm({ ...form, probationMonths: Number(e.target.value) })} className="border rounded px-3 py-2 text-sm" />
          </div>
          <textarea value={form.letterContent} onChange={(e) => setForm({ ...form, letterContent: e.target.value })} placeholder="Offer letter content / key terms" className="w-full border rounded px-3 py-2 text-sm mt-2" rows={4} />
          <button
            onClick={() => createMut.mutate({
              token,
              applicationId,
              title: form.title,
              baseSalary: form.salaryAmount,
              salaryPeriod: "MONTHLY",
              currency: "ZAR",
              startDate: new Date(form.startDate || Date.now()),
              otherTerms: `Probation: ${form.probationMonths} months\n\n${form.letterContent}`,
              expiresInDays: 7,
            })}
            disabled={createMut.isPending}
            className="mt-3 px-3 py-2 bg-teal-600 text-white rounded-lg text-sm disabled:opacity-50"
          >
            Create
          </button>
        </Box>
      )}
    </div>
  );
}

function ChecksTab({ app, token, applicationId }: { app: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const bgMut = useMutation(
    trpc.requestBackgroundCheck.mutationOptions({
      onSuccess: () => { toast.success("Background check requested"); qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) }); },
    }),
  );
  const refMut = useMutation(
    trpc.requestReferenceCheck.mutationOptions({
      onSuccess: () => { toast.success("Reference request sent"); qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) }); },
    }),
  );
  const [refForm, setRefForm] = useState({ refName: "", refEmail: "", refRelation: "" });

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="Background checks">
        {app.backgroundChecks?.length ? app.backgroundChecks.map((b: any) => (
          <div key={b.id} className="border rounded-lg p-3 text-sm mb-2">
            <div className="flex justify-between">
              <span className="font-medium">{b.type}</span>
              <span className={`px-2 py-0.5 rounded text-xs ${
                b.status === "CLEAR" ? "bg-emerald-100 text-emerald-700" :
                b.status === "FLAGGED" ? "bg-red-100 text-red-700" :
                "bg-amber-100 text-amber-700"
              }`}>{b.status}</span>
            </div>
            {b.notes && <div className="text-xs text-gray-500 mt-1">{b.notes}</div>}
          </div>
        )) : <div className="text-sm text-gray-400 mb-2">None</div>}
        <div className="flex gap-2 mt-2">
          {["CRIMINAL","CREDIT","QUALIFICATION","REFERENCE"].map((t) => (
            <button key={t} onClick={() => bgMut.mutate({ token, applicationId, checkTypes: [t] })} className="text-xs px-2 py-1 border rounded hover:bg-gray-50">
              {t}
            </button>
          ))}
        </div>
      </Box>
      <Box title="Reference checks">
        {app.referenceChecks?.length ? app.referenceChecks.map((r: any) => (
          <div key={r.id} className="border rounded-lg p-3 text-sm mb-2">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{r.refereeName}</div>
                <div className="text-xs text-gray-500">{r.refereeEmail} · {r.relation}</div>
              </div>
              <span className={`px-2 py-0.5 rounded text-xs ${
                r.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                r.status === "DECLINED" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
              }`}>{r.status}</span>
            </div>
            {r.aiSummary && <div className="mt-2 text-xs bg-violet-50 p-2 rounded"><Sparkles className="w-3 h-3 inline mr-1" />{r.aiSummary}</div>}
          </div>
        )) : <div className="text-sm text-gray-400 mb-2">None</div>}
        <div className="space-y-2 mt-3">
          <input placeholder="Referee name" value={refForm.refName} onChange={(e) => setRefForm({ ...refForm, refName: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="Referee email" value={refForm.refEmail} onChange={(e) => setRefForm({ ...refForm, refEmail: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="Relation" value={refForm.refRelation} onChange={(e) => setRefForm({ ...refForm, refRelation: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <button
            onClick={() => {
              refMut.mutate({ token, applicationId, refereeName: refForm.refName, refereeEmail: refForm.refEmail, relationship: refForm.refRelation });
              setRefForm({ refName: "", refEmail: "", refRelation: "" });
            }}
            disabled={!refForm.refName || !refForm.refEmail}
            className="w-full px-3 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
          >Request reference</button>
        </div>
      </Box>
    </div>
  );
}

function NotesTab({ app, applicationId, token, onAdd }: { app: any; applicationId: number; token: string; onAdd: (body: string, isPrivate: boolean) => void }) {
  const [body, setBody] = useState("");
  const [isPrivate, setIsPrivate] = useState(true);
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="Notes">
        {app.notes?.length ? (
          <div className="space-y-3">
            {app.notes.map((n: any) => (
              <div key={n.id} className="border-l-2 border-teal-500 pl-3 text-sm">
                <div className="flex justify-between text-xs text-gray-500">
                  <span>{n.author?.firstName} {n.author?.lastName} · {n.isPrivate ? "Private" : "Shared"}</span>
                  <span>{new Date(n.createdAt).toLocaleString()}</span>
                </div>
                <div className="text-gray-700 whitespace-pre-wrap">{n.body}</div>
              </div>
            ))}
          </div>
        ) : <div className="text-sm text-gray-400">No notes</div>}
      </Box>
      <Box title="Add note">
        <textarea value={body} onChange={(e) => setBody(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" rows={4} placeholder="Write a note…" />
        <label className="flex items-center gap-2 text-sm mt-2">
          <input type="checkbox" checked={isPrivate} onChange={(e) => setIsPrivate(e.target.checked)} />
          Private (only hiring team)
        </label>
        <button
          onClick={() => { onAdd(body, isPrivate); setBody(""); }}
          disabled={!body.trim()}
          className="mt-2 w-full px-3 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
        >Add note</button>
      </Box>
    </div>
  );
}

function HistoryTab({ app }: { app: any }) {
  return (
    <Box title="Stage history">
      {app.stageHistory?.length ? (
        <div className="space-y-2">
          {app.stageHistory.map((h: any) => (
            <div key={h.id} className="text-sm flex items-start gap-2">
              <Clock className="w-3 h-3 text-gray-400 mt-1" />
              <div>
                <div className="font-medium">→ {h.toStage?.name ?? h.bucket}</div>
                <div className="text-xs text-gray-500">
                  by {h.movedBy ? `${h.movedBy.firstName} ${h.movedBy.lastName}` : "system"} · {new Date(h.createdAt).toLocaleString()}
                  {h.durationHours != null && <span className="ml-2">({Math.round(h.durationHours)}h)</span>}
                </div>
                {h.reason && <div className="text-xs text-gray-600 mt-1">{h.reason}</div>}
              </div>
            </div>
          ))}
        </div>
      ) : <div className="text-sm text-gray-400">No history</div>}
    </Box>
  );
}
