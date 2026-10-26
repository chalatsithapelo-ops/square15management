import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import { ArrowLeft, Star, Calendar, FileText, MessageSquare, Shield, UserCheck,
  AlertCircle, CheckCircle2, Clock, Loader2, Send, Sparkles, Award,
  Download, ExternalLink, Briefcase, GraduationCap, AlertTriangle, Link2, Zap, CheckCircle,
  LayoutGrid , Wrench} from "lucide-react";
import toast from "react-hot-toast";
import { AssessmentSessionSnapshots } from "~/components/AssessmentSessionSnapshots";
import { RecruitmentAssessmentResults } from "~/components/RecruitmentAssessmentResults";

export const Route = createFileRoute("/admin/recruitment/applications/$appId")({
  component: ApplicationDetailPage,
});

type TabKey = "overview" | "captures" | "cv" | "interviews" | "interview-kit" | "checks" | "decision" | "offer" | "notes" | "messages" | "history";

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
            {app.jobId ? (
              <Link
                to="/admin/recruitment/jobs/$jobId"
                params={{ jobId: String(app.jobId) }}
                className="text-gray-500 hover:text-gray-700"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
            ) : (
              <Link to="/admin/recruitment" className="text-gray-500 hover:text-gray-700">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            )}
            <div>
              <h1 className="text-lg font-semibold flex items-center gap-2">
                {app.firstName} {app.lastName}
                {app.blinded && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-teal-100 text-teal-700 uppercase">
                    Blind
                  </span>
                )}
              </h1>
              <div className="text-xs text-gray-500">
                {app.email} · {app.phone ?? "—"} · applied for {app.job?.title}
              </div>
              {app.blinded && (
                <BlindRevealButton token={token} applicationId={applicationId} />
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {app.jobId && (
              <Link
                to="/admin/recruitment/jobs/$jobId"
                params={{ jobId: String(app.jobId) }}
                title="Open Kanban board for this job"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 font-medium"
              >
                <LayoutGrid className="w-4 h-4" /> Kanban
              </Link>
            )}
            {/* MAINTENANCE_APP_BADGE */}
            {app.job?.jobType === "MAINTENANCE_APP" ? (
              <div className="px-3 py-1.5 rounded-lg bg-orange-100 text-orange-800 text-sm font-semibold flex items-center gap-1">
                <Wrench className="w-4 h-4" /> Maintenance App
              </div>
            ) : (
              <div className="px-3 py-1.5 rounded-lg bg-blue-100 text-blue-800 text-sm font-semibold flex items-center gap-1">
                <Briefcase className="w-4 h-4" /> Commercial
              </div>
            )}
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
            <HiringOverrideMenu token={token} applicationId={applicationId} />
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-6 flex gap-1 overflow-x-auto">
          {(["overview","captures","cv","interviews","interview-kit","checks","decision","offer","notes","messages","history"] as TabKey[]).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
                tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {k === "captures" ? "Camera captures" : k}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6">
        {tab === "captures" && <AssessmentSessionSnapshots token={token} applicationId={applicationId} />}
        {tab === "overview" && <OverviewTab app={app} onReject={(reasonId, notes) =>
          rejectMut.mutate({ token, applicationId, rejectionReasonId: reasonId, rejectionDetail: notes })
        } token={token} />}
        {tab === "cv" && <ParsedCvTab app={app} />}
        {tab === "interview-kit" && <InterviewKitTab token={token} applicationId={applicationId} jobId={app.jobId} onSaved={() =>
          qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) })
        } />}
        {tab === "interviews" && <InterviewsTab app={app} token={token} applicationId={applicationId} />}
        {tab === "offer" && <OffersTab app={app} token={token} applicationId={applicationId} currentUserId={user.id} />}
        {tab === "checks" && <ChecksTab app={app} token={token} applicationId={applicationId} />}
        {tab === "decision" && <DecisionTab token={token} applicationId={applicationId} />}
        {tab === "notes" && <NotesTab app={app} token={token} applicationId={applicationId}
          onAdd={(body, isPrivate) => addNoteMut.mutate({ token, applicationId, body, isPrivate })} />}
        {tab === "messages" && <MessagesTab app={app} token={token} applicationId={applicationId} onSent={() =>
          qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) })
        } />}
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

function RedFlagPanel({ score, signals }: { score: number; signals: Array<{ code?: string; label?: string; weight?: number; evidence?: string }> }) {
  const band = score >= 50 ? { color: "text-red-700", bg: "bg-red-50", border: "border-red-300", label: "HIGH RISK" }
    : score >= 20 ? { color: "text-amber-700", bg: "bg-amber-50", border: "border-amber-300", label: "CAUTION" }
    : { color: "text-emerald-700", bg: "bg-emerald-50", border: "border-emerald-300", label: "CLEAN" };
  return (
    <div className={`rounded-xl border-2 ${band.border} ${band.bg} p-5`}>
      <div className="flex items-center justify-between mb-3">
        <h3 className={`text-sm font-semibold ${band.color} flex items-center gap-2`}>
          <AlertTriangle className="w-4 h-4" /> Red-flag score
        </h3>
        <div className="flex items-center gap-2">
          <span className={`text-2xl font-bold ${band.color}`}>{score}</span>
          <span className={`text-xs font-semibold ${band.color}`}>/ 100</span>
          <span className={`ml-2 px-2 py-0.5 rounded-full text-[10px] font-bold ${band.color} ${band.bg} border ${band.border}`}>
            {band.label}
          </span>
        </div>
      </div>
      {signals.length === 0 ? (
        <div className="text-sm text-gray-500">No triggers detected.</div>
      ) : (
        <ul className="space-y-1.5">
          {signals.map((s, i) => (
            <li key={i} className="text-sm text-gray-800 flex items-start gap-2">
              <AlertCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <div className="flex-1">
                <div className="font-medium">{s.label ?? s.code}</div>
                {s.evidence && <div className="text-xs text-gray-500 mt-0.5">{s.evidence}</div>}
              </div>
              <span className="text-xs text-gray-500 shrink-0">+{s.weight ?? 0}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-[11px] text-gray-500 mt-3">
        Weighted flags from Big Five, interview, work sample, references, AI match, CV completeness. Refreshed on Recompute.
      </p>
    </div>
  );
}

function splitLines(v: unknown): string[] {
  if (!v || typeof v !== "string") return [];
  return v
    .split(/\r?\n|\u2022|•|;|\|/)
    .map((s) => s.trim().replace(/^[-*]\s*/, ""))
    .filter((s) => s.length > 0);
}

function ParsedCvTab({ app }: { app: any }) {
  const strengths = splitLines(app.aiStrengths);
  const redFlags = splitLines(app.aiRedFlags);
  const quals = splitLines(app.qualifications);
  const portfolioUrls: string[] = Array.isArray(app.portfolioUrls) ? app.portfolioUrls : [];
  const hasAnyParsed =
    app.aiSummary || strengths.length > 0 || redFlags.length > 0 || quals.length > 0 || app.motivationLetter || app.resumeUrl || portfolioUrls.length > 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-2 space-y-4">
        {app.resumeUrl && (
          <Box title="Resume">
            <a
              href={app.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-teal-700 hover:text-teal-800 border rounded-lg px-3 py-2 bg-teal-50"
            >
              <Download className="w-4 h-4" /> Download / view CV
              <ExternalLink className="w-3 h-3" />
            </a>
          </Box>
        )}
        <Box title="AI-parsed summary">
          {app.aiSummary ? (
            <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{app.aiSummary}</div>
          ) : (
            <div className="text-sm text-gray-400">No AI-parsed summary yet. Try "Recompute" from the header.</div>
          )}
        </Box>
        {typeof app.redFlagScore === "number" && (
          <RedFlagPanel score={app.redFlagScore} signals={(app.redFlagSignals ?? []) as any[]} />
        )}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Box title="Strengths">
            {strengths.length > 0 ? (
              <ul className="space-y-1.5">
                {strengths.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-600 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-400">None extracted.</div>
            )}
          </Box>
          <Box title="Red flags">
            {redFlags.length > 0 ? (
              <ul className="space-y-1.5">
                {redFlags.map((s, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="text-sm text-gray-400">None extracted.</div>
            )}
          </Box>
        </div>
        <Box title="Qualifications">
          {quals.length > 0 ? (
            <ul className="space-y-1.5">
              {quals.map((s, i) => (
                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 mt-0.5 shrink-0" />
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-400">No qualifications provided.</div>
          )}
        </Box>
        <QualificationDocuments attachments={Array.isArray(app.attachments) ? app.attachments : []} />
        {app.motivationLetter && (
          <Box title="Motivation letter">
            <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{app.motivationLetter}</div>
          </Box>
        )}
        {!hasAnyParsed && (
          <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">
            Nothing parsed for this application yet.
          </div>
        )}
      </div>
      <div className="space-y-4">
        <Box title="Quick facts">
          <div className="text-sm space-y-2">
            <Field label="Primary trade" value={app.primaryTrade} />
            <Field label="Experience" value={app.yearsExperience != null ? `${app.yearsExperience} years` : null} />
            <Field label="Expected salary" value={app.expectedSalary ? `R${app.expectedSalary.toLocaleString?.() ?? app.expectedSalary}` : null} />
            <Field label="Availability" value={app.availability} />
            <Field label="LinkedIn" value={app.linkedInUrl} />
          </div>
        </Box>
        <Box title="Portfolio">
          {portfolioUrls.length > 0 ? (
            <ul className="space-y-1.5">
              {portfolioUrls.map((u, i) => (
                <li key={i} className="text-sm truncate">
                  <a
                    href={u}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal-700 hover:text-teal-800 flex items-center gap-1"
                  >
                    <Link2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">{u}</span>
                  </a>
                </li>
              ))}
            </ul>
          ) : (
            <div className="text-sm text-gray-400">None provided.</div>
          )}
        </Box>
        {app.portfolioReview && (
          <Box title="Portfolio review (AI)">
            <div className="text-sm whitespace-pre-wrap text-gray-700 leading-relaxed">{app.portfolioReview}</div>
          </Box>
        )}
      </div>
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
          <RecruitmentAssessmentResults assessments={app.assessmentSummary ?? []} />
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
      <AssessorBookingCard token={token} applicationId={applicationId} />
      <AssessmentResponsesCard app={app} />
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

      {/* AI behaviour interview responses — spans both columns */}
      <div className="lg:col-span-2">
        <Box title="AI behaviour interview responses">
          {app.interviewResponses?.length ? (
            <div className="space-y-3">
              {[...app.interviewResponses]
                .sort((a: any, b: any) => a.questionIndex - b.questionIndex)
                .map((r: any) => (
                  <div key={r.id} className="border rounded-lg p-3">
                    <div className="flex items-start justify-between gap-3 mb-1">
                      <div className="text-sm font-medium text-gray-800">
                        Q{r.questionIndex + 1}. {r.question}
                      </div>
                      {typeof r.aiScore === "number" && (
                        <span className={`shrink-0 px-2 py-0.5 rounded text-xs font-medium ${
                          r.aiScore >= 7 ? "bg-emerald-100 text-emerald-700"
                          : r.aiScore >= 5 ? "bg-amber-100 text-amber-700"
                          : "bg-red-100 text-red-700"
                        }`}>
                          AI {r.aiScore.toFixed(1)}/10
                        </span>
                      )}
                    </div>
                    <IntegrityBadges
                      signals={r.integritySignals}
                      aiWritingScore={r.aiWritingScore}
                      aiWritingSignals={r.aiWritingSignals}
                    />
                    <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-2 mb-2">
                      {r.answer}
                    </div>
                    {r.aiAnalysis && (
                      <div className="text-xs text-gray-600 italic mb-2">
                        <span className="font-semibold not-italic text-gray-700">AI analysis: </span>
                        {r.aiAnalysis}
                      </div>
                    )}
                    {r.dimensions && typeof r.dimensions === "object" && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(r.dimensions as Record<string, any>).map(([k, v]) => (
                          <span key={k} className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-xs">
                            {k}: {typeof v === "number" ? v.toFixed(1) : String(v)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-400 mt-1">
                      Submitted {new Date(r.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <div className="text-sm text-gray-400">
              Candidate has not yet submitted AI behaviour interview answers.
            </div>
          )}
        </Box>
      </div>

      {/* Work sample submissions — spans both columns */}
      <div className="lg:col-span-2">
        <WorkSampleSubmissionsBox submissions={Array.isArray(app.workSampleSubmissions) ? app.workSampleSubmissions : []} />
      </div>
    </div>
  );
}

function OffersTab({ app, token, applicationId, currentUserId }: { app: any; token: string; applicationId: number; currentUserId: number }) {
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
                  <div className="font-medium">
                    {o.title} — {[
                      o.monthlySalary ? `R${o.monthlySalary.toLocaleString()}/month` : null,
                      o.dailyRate ? `R${o.dailyRate.toLocaleString()}/day` : null,
                      o.hourlyRate ? `R${o.hourlyRate.toLocaleString()}/hr` : null,
                      !o.monthlySalary && !o.dailyRate && !o.hourlyRate && o.baseSalary ? `R${o.baseSalary.toLocaleString()}/${(o.salaryPeriod ?? "").toLowerCase()}` : null,
                    ].filter(Boolean).join(" + ")}
                  </div>
                  <span className={`px-2 py-0.5 rounded text-xs ${
                    o.status === "ACCEPTED" ? "bg-emerald-100 text-emerald-700" :
                    o.status === "DECLINED" || o.status === "WITHDRAWN" ? "bg-red-100 text-red-700" :
                    o.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-700"
                  }`}>{o.status}</span>
                </div>
                <div className="text-xs text-gray-500">Start: {o.startDate ? new Date(o.startDate).toLocaleDateString() : "—"}{o.expiresAt ? ` · expires ${new Date(o.expiresAt).toLocaleDateString()}` : ""}</div>
                <div className="flex gap-2 mt-2">
                  {o.status === "PENDING_APPROVAL" && (() => {
                    const myApproval = (o.approvals ?? []).find((a: any) => a.approverId === currentUserId && !a.decidedAt);
                    return myApproval ? (
                      <button onClick={() => approveMut.mutate({ token, approvalId: myApproval.id, decision: "APPROVED" })} className="text-xs bg-emerald-600 text-white rounded px-2 py-1">Approve</button>
                    ) : null;
                  })()}
                  {(o.status === "APPROVED" || o.status === "DRAFT") && (
                    <button onClick={() => sendMut.mutate({ token, offerId: o.id })} disabled={sendMut.isPending} className="text-xs bg-teal-600 text-white rounded px-2 py-1 disabled:opacity-50">{sendMut.isPending ? "Sending…" : "Send to candidate"}</button>
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
          <div className="space-y-2">
            <input
              placeholder="Role title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full border rounded px-3 py-2 text-sm"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-xs font-semibold text-gray-700">Compensation type</label>
                <select
                  value={form.compensationType}
                  onChange={(e) => setForm({ ...form, compensationType: e.target.value as any })}
                  className="w-full border rounded px-3 py-2 text-sm"
                >
                  <option value="MONTHLY">Monthly salary</option>
                  <option value="DAILY">Daily rate</option>
                  <option value="HOURLY">Hourly rate</option>
                  <option value="HOURLY_PLUS_DAILY">Hourly + Daily rate (client-dependent)</option>
                  <option value="ANNUAL">Annual salary</option>
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Start date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              </div>
            </div>
            {form.compensationType === "MONTHLY" && (
              <div>
                <label className="text-xs font-semibold text-gray-700">Monthly salary (R)</label>
                <input
                  type="number" min="0" step="100"
                  value={form.monthlySalary || ""}
                  onChange={(e) => setForm({ ...form, monthlySalary: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. 12000"
                />
              </div>
            )}
            {form.compensationType === "ANNUAL" && (
              <div>
                <label className="text-xs font-semibold text-gray-700">Annual salary (R)</label>
                <input
                  type="number" min="0" step="1000"
                  value={form.annualSalary || ""}
                  onChange={(e) => setForm({ ...form, annualSalary: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. 240000"
                />
              </div>
            )}
            {(form.compensationType === "DAILY" || form.compensationType === "HOURLY_PLUS_DAILY") && (
              <div>
                <label className="text-xs font-semibold text-gray-700">Daily rate (R)</label>
                <input
                  type="number" min="0" step="10"
                  value={form.dailyRate || ""}
                  onChange={(e) => setForm({ ...form, dailyRate: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. 400"
                />
              </div>
            )}
            {(form.compensationType === "HOURLY" || form.compensationType === "HOURLY_PLUS_DAILY") && (
              <div>
                <label className="text-xs font-semibold text-gray-700">Hourly rate (R)</label>
                <input
                  type="number" min="0" step="5"
                  value={form.hourlyRate || ""}
                  onChange={(e) => setForm({ ...form, hourlyRate: Number(e.target.value) })}
                  className="w-full border rounded px-3 py-2 text-sm"
                  placeholder="e.g. 130"
                />
              </div>
            )}
            <div>
              <label className="text-xs font-semibold text-gray-700">Offer valid for (days)</label>
              <input
                type="number" min="1" max="60"
                value={form.expiresInDays}
                onChange={(e) => setForm({ ...form, expiresInDays: Number(e.target.value) })}
                className="w-full border rounded px-3 py-2 text-sm"
              />
            </div>
            <textarea
              value={form.letterContent}
              onChange={(e) => setForm({ ...form, letterContent: e.target.value })}
              placeholder="Offer letter content / key terms (role summary, benefits, PPE, working hours)"
              className="w-full border rounded px-3 py-2 text-sm"
              rows={4}
            />
          </div>
          <button
            onClick={() => {
              const t = form.compensationType;
              const monthly = t === "MONTHLY" ? form.monthlySalary : undefined;
              const daily = (t === "DAILY" || t === "HOURLY_PLUS_DAILY") ? form.dailyRate : undefined;
              const hourly = (t === "HOURLY" || t === "HOURLY_PLUS_DAILY") ? form.hourlyRate : undefined;
              const annual = t === "ANNUAL" ? form.annualSalary : undefined;
              const baseSalary = monthly ?? annual ?? daily ?? hourly ?? 0;
              if (!form.title) { toast.error("Enter a role title"); return; }
              if (!form.startDate) { toast.error("Pick a start date"); return; }
              if (baseSalary <= 0 && !hourly && !daily) { toast.error("Enter a rate/salary"); return; }
              createMut.mutate({
                token,
                applicationId,
                title: form.title,
                baseSalary,
                salaryPeriod: t,
                monthlySalary: monthly,
                dailyRate: daily,
                hourlyRate: hourly,
                currency: "ZAR",
                startDate: new Date(form.startDate),
                otherTerms: form.letterContent || undefined,
                expiresInDays: form.expiresInDays,
              });
            }}
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
    trpc.createReferenceCheck.mutationOptions({
      onSuccess: () => { toast.success("Reference added"); qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) }); },
    }),
  );
  const refSendMut = useMutation(
    trpc.sendReferenceQuestionnaire.mutationOptions({
      onSuccess: () => { toast.success("Questionnaire sent"); qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) }); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const resendRefMut = useMutation(
    trpc.resendReferenceQuestionnaire.mutationOptions({
      onSuccess: () => toast.success("Reminder sent"),
      onError: (e) => toast.error(e.message),
    }),
  );
  const refWaMut = useMutation(
    trpc.sendReferenceLinkWhatsApp.mutationOptions({
      onSuccess: (r: any) => r.ok ? toast.success("Sent via WhatsApp") : toast.error(r.error ?? "Failed"),
      onError: (e) => toast.error(e.message),
    }),
  );
  const hrLineQ = useQuery(trpc.assertHrLineReferenceOnFile.queryOptions({ token, applicationId }));
  const [refForm, setRefForm] = useState({ refName: "", refEmail: "", refRelation: "", isHrLine: false });

  // Employment verification form
  const empMut = useMutation(
    trpc.createEmploymentVerification.mutationOptions({
      onSuccess: () => { toast.success("Verification created"); qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) }); },
    }),
  );
  const empSendMut = useMutation(
    trpc.sendEmploymentVerificationEmail.mutationOptions({
      onSuccess: () => toast.success("Verification email sent"),
      onError: (e) => toast.error(e.message),
    }),
  );
  const [empForm, setEmpForm] = useState({ employer: "", role: "", hrEmail: "" });

  const hasHrLine = (hrLineQ.data as any)?.hasHrLine;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Box title="Background checks">
        {(app.backgroundChecks ?? []).length === 0 ? (
          <div className="text-sm text-gray-400 mb-3">No background check requested yet</div>
        ) : (
          <div className="space-y-3">
            {(app.backgroundChecks ?? []).map((bg: any) => (
              <div key={bg.id} className="border rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <div className="text-sm font-medium">
                    {bg.checkTypes.join(" · ") || "No types"}
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded ${
                    bg.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                    bg.status === "IN_PROGRESS" ? "bg-blue-100 text-blue-700" :
                    bg.status === "FAILED" ? "bg-red-100 text-red-700" :
                    "bg-gray-100 text-gray-700"
                  }`}>{bg.status}</span>
                </div>
                <BackgroundCheckControls bg={bg} token={token} applicationId={applicationId} />
                <BackgroundDocumentsList bg={bg} token={token} applicationId={applicationId} />
              </div>
            ))}
          </div>
        )}
        <div className="flex flex-wrap gap-2 mt-3">
          {["CRIMINAL","CREDIT","QUALIFICATION","REFERENCE"].map((t) => (
            <button
              key={t}
              onClick={() => bgMut.mutate({ token, applicationId, checkTypes: [t], notifyCandidate: true })}
              className="text-xs px-2 py-1 border rounded hover:bg-gray-50"
            >Request {t}</button>
          ))}
          <button
            onClick={() => bgMut.mutate({ token, applicationId, checkTypes: ["CRIMINAL","CREDIT","QUALIFICATION","REFERENCE"], notifyCandidate: true })}
            className="text-xs px-2 py-1 bg-teal-600 text-white rounded"
          >Request ALL & notify candidate</button>
        </div>
      </Box>

      <Box title="Reference checks">
        {hrLineQ.data && !hasHrLine && app.referenceChecks?.length > 0 && (
          <div className="mb-3 p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 font-medium">
            No HR-line reference on file — please add the HR contact of a previous employer, not just a candidate-picked referee.
          </div>
        )}
        {app.referenceChecks?.length ? app.referenceChecks.map((r: any) => (
          <div key={r.id} className="border rounded-lg p-3 text-sm mb-2">
            <div className="flex justify-between">
              <div>
                <div className="font-medium flex items-center gap-1">
                  {r.refereeName}
                  {r.isHrLine && <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 text-green-800 font-bold">HR</span>}
                </div>
                <div className="text-xs text-gray-500">{r.refereeEmail} · {r.relationship}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  r.status === "COMPLETED" ? "bg-emerald-100 text-emerald-700" :
                  r.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                }`}>{r.status}</span>
                {r.status === "PENDING" && (
                  <button
                    onClick={() => refSendMut.mutate({ token, referenceCheckId: r.id })}
                    className="text-[10px] px-2 py-0.5 bg-teal-600 text-white rounded"
                  >
                    Send questionnaire
                  </button>
                )}
                {r.status === "SENT" && (
                  <button
                    onClick={() => resendRefMut.mutate({ token, referenceCheckId: r.id })}
                    className="text-[10px] px-2 py-0.5 border rounded"
                  >
                    Resend email
                  </button>
                )}
                <button
                  onClick={() => {
                    const phone = window.prompt("WhatsApp number for referee (e.g. 0821234567):")?.trim();
                    if (!phone) return;
                    refWaMut.mutate({ token, referenceCheckId: r.id, toPhone: phone });
                  }}
                  className="text-[10px] px-2 py-0.5 bg-green-600 text-white rounded"
                >
                  Send via WhatsApp
                </button>
              </div>
            </div>
            {r.questionnaire?.rehireRating != null && (
              <div className="mt-2 text-xs">
                Rehire: <strong>{r.questionnaire.rehireRating}/10</strong>
                {r.questionnaire.concernFlagged && <span className="ml-2 text-red-600">⚠ concern</span>}
              </div>
            )}
          </div>
        )) : <div className="text-sm text-gray-400 mb-2">None</div>}
        <div className="space-y-2 mt-3">
          <input placeholder="Referee name" value={refForm.refName} onChange={(e) => setRefForm({ ...refForm, refName: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="Referee email" value={refForm.refEmail} onChange={(e) => setRefForm({ ...refForm, refEmail: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="Relationship (e.g. Line manager)" value={refForm.refRelation} onChange={(e) => setRefForm({ ...refForm, refRelation: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={refForm.isHrLine} onChange={(e) => setRefForm({ ...refForm, isHrLine: e.target.checked })} />
            This is an HR-line contact (not the candidate's line manager)
          </label>
          <button
            onClick={() => {
              refMut.mutate({ token, applicationId, refereeName: refForm.refName, refereeEmail: refForm.refEmail, relationship: refForm.refRelation, isHrLine: refForm.isHrLine });
              setRefForm({ refName: "", refEmail: "", refRelation: "", isHrLine: false });
            }}
            disabled={!refForm.refName || !refForm.refEmail}
            className="w-full px-3 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
          >Add reference</button>
        </div>
      </Box>

      <Box title="Employment verification">
        {app.employmentVerifications?.length ? app.employmentVerifications.map((v: any) => (
          <div key={v.id} className="border rounded-lg p-3 text-sm mb-2">
            <div className="flex justify-between">
              <div>
                <div className="font-medium">{v.employerName}</div>
                <div className="text-xs text-gray-500">{v.claimedRole ?? "—"}</div>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  v.status === "CONFIRMED" ? "bg-emerald-100 text-emerald-700" :
                  v.status === "DISPUTED" ? "bg-red-100 text-red-700" :
                  v.status === "SENT" ? "bg-blue-100 text-blue-700" : "bg-amber-100 text-amber-700"
                }`}>{v.status}</span>
                {v.status === "PENDING" && v.hrEmail && (
                  <button
                    onClick={() => empSendMut.mutate({ token, verificationId: v.id })}
                    className="text-[10px] px-2 py-0.5 bg-teal-600 text-white rounded"
                  >
                    Send to HR
                  </button>
                )}
              </div>
            </div>
            {v.discrepancy && (
              <div className="mt-2 text-xs text-red-700">⚠ Discrepancy: {v.responseNotes ?? "(no notes)"}</div>
            )}
          </div>
        )) : <div className="text-sm text-gray-400 mb-2">No verifications requested</div>}
        <div className="space-y-2 mt-3">
          <input placeholder="Previous employer name" value={empForm.employer} onChange={(e) => setEmpForm({ ...empForm, employer: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="Claimed role" value={empForm.role} onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <input placeholder="HR email at previous employer" value={empForm.hrEmail} onChange={(e) => setEmpForm({ ...empForm, hrEmail: e.target.value })} className="w-full border rounded px-2 py-1 text-sm" />
          <button
            onClick={() => {
              empMut.mutate({ token, applicationId, employerName: empForm.employer, claimedRole: empForm.role || undefined, hrEmail: empForm.hrEmail || undefined });
              setEmpForm({ employer: "", role: "", hrEmail: "" });
            }}
            disabled={!empForm.employer || empForm.employer.length < 2}
            className="w-full px-3 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
          >Create verification</button>
        </div>
      </Box>

      <PerformanceCheckInBox token={token} applicationId={applicationId} />
    </div>
  );
}

function PerformanceCheckInBox({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const listQ = useQuery(trpc.listPerformanceCheckIns.queryOptions({ token, applicationId }));
  const submitMut = useMutation(
    trpc.submitPerformanceCheckIn.mutationOptions({
      onSuccess: () => { toast.success("Check-in submitted"); listQ.refetch(); reset(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const [milestone, setMilestone] = useState<30 | 60 | 90 | 180>(30);
  const [rating, setRating] = useState<number | null>(null);
  const [meets, setMeets] = useState<boolean | null>(null);
  const [rehire, setRehire] = useState<boolean | null>(null);
  const [strengths, setStrengths] = useState("");
  const [concerns, setConcerns] = useState("");
  const reset = () => { setRating(null); setMeets(null); setRehire(null); setStrengths(""); setConcerns(""); };
  const canSubmit = rating !== null && meets !== null && rehire !== null;

  return (
    <Box title="Performance check-ins (post-hire)">
      {(listQ.data ?? []).length > 0 ? (
        <div className="space-y-2 mb-3">
          {(listQ.data as any[]).map((c) => (
            <div key={c.id} className="border rounded-lg p-3 text-sm">
              <div className="flex justify-between">
                <span className="font-medium">Day {c.dayMilestone}</span>
                <span className={`px-2 py-0.5 rounded text-xs ${c.atRiskFlag ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}>
                  {c.atRiskFlag ? "At risk" : "OK"}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                Rating {c.overallRating}/5 · meets {c.meetingExpectations ? "Yes" : "No"} · rehire {c.wouldRehire ? "Yes" : "No"} · by {c.manager?.firstName} {c.manager?.lastName}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-gray-400 mb-2">No check-ins yet.</div>
      )}
      <div className="space-y-2 border-t pt-3">
        <div className="text-xs font-semibold">New check-in</div>
        <div className="flex gap-2">
          {[30, 60, 90, 180].map((m) => (
            <button
              key={m}
              onClick={() => setMilestone(m as any)}
              className={`px-3 py-1 rounded text-xs ${milestone === m ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-700"}`}
            >
              Day {m}
            </button>
          ))}
        </div>
        <div>
          <div className="text-xs mb-1">Overall rating (1-5)</div>
          <div className="flex gap-1">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setRating(n)} className={`w-8 h-8 rounded border ${rating === n ? "bg-teal-600 text-white" : ""}`}>{n}</button>
            ))}
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <label className="flex gap-1 items-center"><input type="checkbox" checked={meets === true} onChange={(e) => setMeets(e.target.checked ? true : false)} /> Meeting expectations</label>
          <label className="flex gap-1 items-center"><input type="checkbox" checked={rehire === true} onChange={(e) => setRehire(e.target.checked ? true : false)} /> Would rehire</label>
        </div>
        <textarea value={strengths} onChange={(e) => setStrengths(e.target.value)} rows={2} placeholder="Strengths" className="w-full border rounded px-2 py-1 text-sm" />
        <textarea value={concerns} onChange={(e) => setConcerns(e.target.value)} rows={2} placeholder="Concerns" className="w-full border rounded px-2 py-1 text-sm" />
        <button
          disabled={!canSubmit || submitMut.isPending}
          onClick={() =>
            submitMut.mutate({
              token,
              applicationId,
              dayMilestone: milestone,
              overallRating: rating!,
              meetingExpectations: meets!,
              wouldRehire: rehire!,
              strengths: strengths || undefined,
              concerns: concerns || undefined,
            })
          }
          className="w-full px-3 py-2 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
        >Submit check-in</button>
      </div>
    </Box>
  );
}

function AssessmentSessionsBox({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.listAssessmentSessions.queryOptions({ token, applicationId }));
  const sessions = (q.data ?? []) as any[];
  const [openSnapshot, setOpenSnapshot] = useState<{ src: string; step?: string; at: string } | null>(null);
  if (sessions.length === 0) return null;
  return (
    <>
      <Box title="Assessment session integrity">
        {sessions.map((s) => (
          <div key={s.id} className="border rounded-lg p-3 text-sm mb-3">
            <div className="flex justify-between mb-2">
              <div>
                <div className="font-medium">Session #{s.id}</div>
                <div className="text-xs text-gray-500">
                  Started {new Date(s.startedAt).toLocaleString()} · {s.finishedAt ? `Finished ${new Date(s.finishedAt).toLocaleString()}` : "In progress"}
                </div>
              </div>
              <div className="flex flex-col items-end gap-1">
                {s.webcamGranted
                  ? <span className="px-2 py-0.5 rounded text-xs bg-emerald-100 text-emerald-700">Camera OK</span>
                  : <span className="px-2 py-0.5 rounded text-xs bg-amber-100 text-amber-700">Camera declined</span>}
                <span className="text-[10px] text-gray-500">Snapshots: {s.snapshots?.length ?? 0}</span>
                <span className="text-[10px] text-gray-500">Pauses: {s.pauseCount}</span>
              </div>
            </div>
            {Array.isArray(s.snapshots) && s.snapshots.length > 0 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-1.5 mt-2">
                {s.snapshots.map((snap: any) => (
                  <button
                    key={snap.id}
                    onClick={() => setOpenSnapshot({ src: snap.imageDataUrl, step: snap.step, at: snap.createdAt })}
                    className="relative aspect-[4/3] rounded overflow-hidden border border-gray-200 hover:border-teal-500 hover:shadow-sm transition"
                    title={`${snap.step || "snapshot"} · ${new Date(snap.createdAt).toLocaleTimeString()}`}
                  >
                    {snap.imageDataUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={snap.imageDataUrl} alt="snapshot" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-gray-100 flex items-center justify-center text-[9px] text-gray-400">no img</div>
                    )}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 text-[8px] text-white truncate">
                      {snap.step || "—"} · {new Date(snap.createdAt).toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </Box>
      {openSnapshot && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setOpenSnapshot(null)}
        >
          <div className="bg-white rounded-xl overflow-hidden max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={openSnapshot.src} alt="snapshot" className="w-full h-auto" />
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 text-sm">
              <div className="text-gray-700">
                <span className="font-medium">{openSnapshot.step || "snapshot"}</span>
                <span className="text-gray-500 ml-2">· {new Date(openSnapshot.at).toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={openSnapshot.src}
                  download={`snapshot-${openSnapshot.step || "session"}-${new Date(openSnapshot.at).getTime()}.jpg`}
                  className="px-3 py-1 text-xs bg-teal-600 text-white rounded"
                >
                  Download
                </a>
                <button onClick={() => setOpenSnapshot(null)} className="px-3 py-1 text-xs bg-gray-200 rounded">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
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

function messageBodyToPlain(input: string): string {
  if (!input) return "";
  let s = String(input);
  if (!/<[^>]+>/.test(s)) return s;
  s = s.replace(/<!DOCTYPE[^>]*>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<head[\s\S]*?<\/head>/gi, "");
  s = s.replace(/<br\s*\/?>(\s*)/gi, "\n");
  s = s.replace(/<\/(p|div|h[1-6]|li|tr)>/gi, "\n");
  s = s.replace(/<[^>]+>/g, "");
  s = s
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&rarr;/g, "→")
    .replace(/&larr;/g, "←")
    .replace(/&#10003;/g, "✓");
  return s.replace(/\n{3,}/g, "\n\n").trim();
}

function InterviewKitTab({
  token, applicationId, jobId, onSaved,
}: {
  token: string;
  applicationId: number;
  jobId: number | null;
  onSaved: () => void;
}) {
  const trpc = useTRPC();
  const currentUserId = useAuthStore((s: any) => s.user?.id) as number | undefined;
  const bankQ = useQuery(
    trpc.getInterviewQuestionBank.queryOptions(
      { token, jobId: jobId ?? 0 },
      { enabled: !!jobId },
    ),
  );
  const scoresQ = useQuery(
    trpc.listInterviewQuestionScores.queryOptions({ token, applicationId }),
  );
  const scoreMut = useMutation(
    trpc.scoreInterviewQuestion.mutationOptions({
      onSuccess: () => {
        toast.success("Question scored");
        scoresQ.refetch();
        onSaved();
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (!jobId) return <div className="text-sm text-gray-500">Application is not linked to a job.</div>;
  if (bankQ.isLoading) return <div className="text-sm text-gray-500">Loading kit…</div>;

  const bank = bankQ.data as any;
  const questions = (bank?.questions ?? []) as Array<{
    id: number; competency: string; question: string; rubric: Record<string,string>; weight: number; requireEvidence: boolean;
  }>;
  const scores = (scoresQ.data ?? []) as Array<{
    questionId: number; score: number; specificExample: boolean; personalRole: boolean; measurableOutcome: boolean;
    evidence: string; interviewer: { id: number; firstName: string; lastName: string };
  }>;
  const scoredByMe: Record<number, boolean> = {};
  scores.forEach((s) => {
    if (currentUserId != null && s.interviewer?.id === currentUserId) {
      scoredByMe[s.questionId] = true;
    }
  });

  if (questions.length === 0) {
    return (
      <div className="bg-white rounded-xl border p-6 text-center">
        <div className="text-sm text-gray-600 mb-2">
          No structured interview kit has been created for this job yet.
        </div>
        <div className="text-xs text-gray-500">
          Contact your hiring manager to create the question bank via the tRPC procedure <code>upsertInterviewQuestionBank</code>.
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border p-4">
        <h3 className="text-sm font-semibold mb-1">Structured Interview Kit</h3>
        <p className="text-xs text-gray-600">
          Score each question on the 1–5 rubric. Each answer requires a written
          evidence note AND ticking of the three STAR probes — this is your defence
          against fabricated answers.
        </p>
      </div>
      {questions.map((q, idx) => {
        const done = scoredByMe[q.id];
        const priorScores = scores.filter((s) => s.questionId === q.id);
        return (
          <QuestionScorer
            key={q.id}
            index={idx}
            q={q}
            done={done}
            priorScores={priorScores}
            onSubmit={(payload) =>
              scoreMut.mutate({ token, applicationId, questionId: q.id, ...payload })
            }
            saving={scoreMut.isPending}
          />
        );
      })}
    </div>
  );
}

function QuestionScorer({
  index, q, done, priorScores, onSubmit, saving,
}: {
  index: number;
  q: { id: number; competency: string; question: string; rubric: Record<string,string>; weight: number; requireEvidence: boolean };
  done: boolean;
  priorScores: Array<{ score: number; evidence: string; specificExample: boolean; personalRole: boolean; measurableOutcome: boolean; interviewer: { id: number; firstName: string; lastName: string } }>;
  onSubmit: (payload: { score: number; evidence: string; specificExample: boolean; personalRole: boolean; measurableOutcome: boolean; probeNotes?: string }) => void;
  saving: boolean;
}) {
  const [score, setScore] = useState<number | null>(null);
  const [evidence, setEvidence] = useState("");
  const [specific, setSpecific] = useState(false);
  const [role, setRole] = useState(false);
  const [outcome, setOutcome] = useState(false);
  const [probes, setProbes] = useState("");

  const canSubmit = score !== null && evidence.trim().length >= 20;

  return (
    <div className="bg-white rounded-xl border p-4">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-[11px] text-gray-500 uppercase tracking-wide">
            Q{index + 1} · {q.competency} · weight {q.weight}
          </div>
          <div className="text-sm font-medium text-gray-900">{q.question}</div>
        </div>
      </div>

      {priorScores.length > 0 && (
        <div className="mb-3 p-2 bg-gray-50 rounded text-xs">
          <div className="font-semibold text-gray-700 mb-1">Prior scores:</div>
          {priorScores.map((s, i) => (
            <div key={i} className="flex items-center gap-2 text-gray-700">
              <span className="font-bold">{s.score}/5</span>
              <span className="text-gray-500">by {s.interviewer.firstName} {s.interviewer.lastName}</span>
              <span className="ml-auto text-[10px]">
                {s.specificExample ? "✓" : "✗"} specific  ·  {s.personalRole ? "✓" : "✗"} role  ·  {s.measurableOutcome ? "✓" : "✗"} outcome
              </span>
            </div>
          ))}
        </div>
      )}

      {!done && (
        <>
          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Score (1–5)</div>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  onClick={() => setScore(n)}
                  className={`w-10 h-10 rounded-full border font-semibold ${score === n ? "bg-teal-600 text-white" : "bg-white text-gray-700"}`}
                >
                  {n}
                </button>
              ))}
            </div>
            {score !== null && q.rubric?.[String(score)] && (
              <div className="text-[11px] text-gray-500 mt-1">Rubric anchor: {q.rubric[String(score)]}</div>
            )}
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">
              Evidence (min 20 chars — quote what the candidate actually said)
            </div>
            <textarea
              value={evidence}
              onChange={(e) => setEvidence(e.target.value)}
              rows={3}
              className="w-full border rounded-lg px-3 py-2 text-sm"
            />
            <div className="text-[11px] text-gray-400 mt-0.5">
              {evidence.trim().length} chars
            </div>
          </div>

          <div className="mb-3 bg-amber-50 border border-amber-200 rounded p-3">
            <div className="text-xs font-semibold text-amber-800 mb-1">STAR probes — tick honestly:</div>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={specific} onChange={(e) => setSpecific(e.target.checked)} />
              Candidate gave a specific example (not "we usually…")
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={role} onChange={(e) => setRole(e.target.checked)} />
              Candidate stated their personal role, not the team's
            </label>
            <label className="flex items-center gap-2 text-sm text-gray-800">
              <input type="checkbox" checked={outcome} onChange={(e) => setOutcome(e.target.checked)} />
              Candidate gave a measurable outcome (numbers, timeframe, result)
            </label>
          </div>

          <div className="mb-3">
            <div className="text-xs font-semibold text-gray-700 mb-1">Probe notes (optional)</div>
            <input
              type="text"
              value={probes}
              onChange={(e) => setProbes(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 text-sm"
              placeholder="What did you probe on? Any inconsistencies?"
            />
          </div>

          <div className="flex justify-end">
            <button
              disabled={!canSubmit || saving}
              onClick={() =>
                onSubmit({
                  score: score!,
                  evidence,
                  specificExample: specific,
                  personalRole: role,
                  measurableOutcome: outcome,
                  probeNotes: probes || undefined,
                })
              }
              className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50"
            >
              Submit score
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function MessagesTab({
  app, token, applicationId, onSent,
}: {
  app: any;
  token: string;
  applicationId: number;
  onSent: () => void;
}) {
  const trpc = useTRPC();
  const [body, setBody] = useState("");
  const [subject, setSubject] = useState("");
  const [alsoEmail, setAlsoEmail] = useState(true);
  const sendMut = useMutation(
    trpc.recruiterSendMessage.mutationOptions({
      onSuccess: () => {
        toast.success(alsoEmail ? "Message sent to candidate + emailed" : "Message posted");
        setBody("");
        setSubject("");
        onSent();
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const messages: any[] = Array.isArray(app.messages) ? [...app.messages] : [];
  messages.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  return (
    <Box title={`Messages with ${app.firstName} ${app.lastName}`}>
      <div className="space-y-2 max-h-[420px] overflow-y-auto mb-4 pr-1">
        {messages.length === 0 && (
          <div className="text-sm text-gray-400">No messages yet.</div>
        )}
        {messages.map((m) => {
          const outgoing = m.direction === "OUTBOUND";
          return (
            <div key={m.id} className={`text-sm p-3 rounded-lg border ${outgoing ? "bg-teal-50 border-teal-100" : "bg-gray-50 border-gray-200"}`}>
              <div className="text-xs text-gray-500 mb-1 flex items-center justify-between">
                <span>
                  {outgoing ? "You (recruiter)" : "Candidate"} · {new Date(m.createdAt).toLocaleString()}
                </span>
                {m.templateKey && (
                  <span className="px-1.5 py-0.5 rounded bg-white border text-[10px] text-gray-500">
                    {m.templateKey}
                  </span>
                )}
              </div>
              {m.subject && <div className="font-medium">{m.subject}</div>}
              <div className="whitespace-pre-wrap text-gray-800">{messageBodyToPlain(m.body)}</div>
            </div>
          );
        })}
      </div>
      <div className="border-t pt-4 space-y-2">
        <input
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Subject (optional)"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Type your reply to the candidate…"
          className="w-full border rounded-lg px-3 py-2 text-sm"
        />
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <input
              type="checkbox"
              checked={alsoEmail}
              onChange={(e) => setAlsoEmail(e.target.checked)}
            />
            Also email this message to {app.email}
          </label>
          <button
            disabled={!body.trim() || sendMut.isPending}
            onClick={() =>
              sendMut.mutate({
                token,
                applicationId,
                subject: subject || undefined,
                body,
                alsoEmail,
              })
            }
            className="px-4 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium disabled:opacity-50 flex items-center gap-1.5"
          >
            {sendMut.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            Send message
          </button>
        </div>
      </div>
    </Box>
  );
}


function BlindRevealButton({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const mut = useMutation(trpc.revealBlindCandidate.mutationOptions({
    onSuccess: () => {
      toast.success("Reveal audited � refresh with ?unblind=1 to see PII for 60 minutes");
      qc.invalidateQueries();
      const url = new URL(window.location.href);
      url.searchParams.set("unblind", "1");
      window.location.href = url.toString();
    },
    onError: (e) => toast.error(e.message),
  }));
  return (
    <button
      onClick={() => {
        const reason = window.prompt("Reason for revealing this candidate (audit trail):")?.trim();
        if (!reason || reason.length < 10) { toast.error("Give at least 10 chars of reason"); return; }
        mut.mutate({ token, applicationId, reason });
      }}
      className="mt-1 text-[11px] text-teal-700 hover:underline"
    >
      Reveal candidate details (audited)
    </button>
  );
}

function HiringOverrideMenu({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const listQ = useQuery(trpc.listHiringOverrides.queryOptions({ token, applicationId }));
  const mut = useMutation(trpc.createHiringOverride.mutationOptions({
    onSuccess: () => { toast.success("Override recorded"); qc.invalidateQueries(); listQ.refetch(); setOpen(false); },
    onError: (e) => toast.error(e.message),
  }));
  const record = (type: "WORK_SAMPLE_WAIVED" | "HR_LINE_REF_WAIVED" | "COOLOFF_WAIVED", label: string) => {
    const reason = window.prompt(`Reason for waiving "${label}" (min 20 characters):`)?.trim();
    if (!reason || reason.length < 20) { toast.error("Reason must be at least 20 characters"); return; }
    mut.mutate({ token, applicationId, type, reason });
  };
  return (
    <div className="relative">
      <button onClick={() => setOpen((v) => !v)} className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50 flex items-center gap-1">
        <Shield className="w-3.5 h-3.5" /> Overrides ({(listQ.data as any[] ?? []).length})
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg z-10 w-72 p-2">
          <div className="text-[11px] text-gray-500 px-2 pb-1">Bypass a hard gate � always audited</div>
          <button onClick={() => record("WORK_SAMPLE_WAIVED", "Work sample")} className="w-full text-left text-sm px-2 py-1.5 hover:bg-gray-50 rounded">Waive work-sample requirement</button>
          <button onClick={() => record("HR_LINE_REF_WAIVED", "HR-line reference")} className="w-full text-left text-sm px-2 py-1.5 hover:bg-gray-50 rounded">Waive HR-line reference</button>
          <button onClick={() => record("COOLOFF_WAIVED", "24h cool-off")} className="w-full text-left text-sm px-2 py-1.5 hover:bg-gray-50 rounded">Waive 24-hour cool-off</button>
          {(listQ.data as any[] ?? []).length > 0 && (
            <div className="mt-2 border-t pt-2 text-[11px] text-gray-600 max-h-40 overflow-y-auto">
              {(listQ.data as any[]).map((o) => (
                <div key={o.id} className="px-2 py-1">
                  <div className="font-semibold text-gray-800">{o.type}</div>
                  <div className="text-gray-500">{o.reason}</div>
                  <div className="text-[10px] text-gray-400">by {o.waivedBy?.firstName} {o.waivedBy?.lastName} � {new Date(o.createdAt).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DecisionTab({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const q = useQuery(trpc.getApplicationDecisionSnapshot.queryOptions({ token, applicationId }));
  const d = q.data as any;
  if (q.isLoading || !d) return <div className="text-sm text-gray-500">Loading decision snapshot�</div>;
  const app = d.application;
  return (
    <div className="space-y-4">
      
      <FastTrackBanner token={token} applicationId={applicationId} />
      <DecisionActionsPanel token={token} applicationId={applicationId} />
      <div className="bg-white rounded-xl border p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold flex items-center gap-1.5"><Award className="w-4 h-4 text-teal-600" /> Decision one-pager</h3>
          <button onClick={() => window.print()} className="text-xs px-3 py-1 bg-teal-600 text-white rounded">Print / Save PDF</button>
        </div>
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div><strong>Candidate:</strong> {app.candidate}</div>
          <div><strong>Role:</strong> {app.job?.title}</div>
          <div><strong>Stage:</strong> {app.stageBucket}</div>
          <div><strong>Overall score:</strong> {app.overallScore ?? "—"}</div>
          <div><strong>Red flag:</strong> {app.redFlagScore ?? "—"}/100</div>
          <div><strong>Work sample:</strong> {app.workSampleScore ?? "—"}</div>
        </div>
      </div>

      <div className="bg-white rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-2">Scorecards heat-map</h4>
        <table className="w-full text-xs">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-2 py-1">Interviewer</th>
              <th className="px-2 py-1">Recommendation</th>
              <th className="px-2 py-1">Overall</th>
              {(d.scorecards.criteria ?? []).map((c: string) => (
                <th key={c} className="px-2 py-1">{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(d.scorecards.rows ?? []).map((r: any, i: number) => (
              <tr key={i} className="border-t">
                <td className="px-2 py-1 font-medium">{r.interviewer}</td>
                <td className="px-2 py-1 text-center">{r.recommendation}</td>
                <td className="px-2 py-1 text-center">{r.overallRating}</td>
                {r.ratings.map((rt: any, j: number) => (
                  <td key={j} className={`px-2 py-1 text-center font-semibold ${rt.value === null ? "text-gray-300" : rt.value >= 4 ? "text-emerald-700" : rt.value >= 3 ? "text-amber-700" : "text-red-700"}`}>
                    {rt.value ?? "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-2">Work samples</h4>
          {d.workSamples.length === 0 ? <div className="text-xs text-gray-400">None</div> : d.workSamples.map((w: any, i: number) => (
            <div key={i} className="text-xs mb-2">
              <div className="font-semibold">{w.title}</div>
              <div>AI {w.aiScore ?? "—"} / Human {w.humanScore ?? "—"} / Pass ≥ {w.passingScore}</div>
              {w.aiFeedback && <div className="text-gray-500 mt-1">{w.aiFeedback.slice(0, 200)}</div>}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-2">References</h4>
          {d.references.length === 0 ? <div className="text-xs text-gray-400">None</div> : d.references.map((r: any, i: number) => (
            <div key={i} className="text-xs mb-1">
              <span className="font-semibold">{r.name}</span> ({r.relationship}) — {r.status}{r.isHrLine ? " · HR-line" : ""} · rating {r.rating ?? "—"}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-2">Employment verifications</h4>
          {d.verifications.length === 0 ? <div className="text-xs text-gray-400">None</div> : d.verifications.map((v: any, i: number) => (
            <div key={i} className="text-xs mb-1">
              {v.employer} — {v.status}{v.discrepancy ? " · discrepancy" : ""}
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border p-4">
          <h4 className="text-sm font-semibold mb-2">Assessment sessions</h4>
          {d.assessments.length === 0 ? <div className="text-xs text-gray-400">None</div> : d.assessments.map((s: any) => (
            <div key={s.id} className="text-xs mb-1">
              #{s.id} · {s.snapshotCount} snapshots · pause {s.pauseCount} · camera {s.webcamGranted ? "granted" : "declined"}
            </div>
          ))}
        </div>
      </div>

      {d.overrides.length > 0 && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
          <h4 className="text-sm font-semibold mb-2 text-amber-900">Audited overrides</h4>
          {d.overrides.map((o: any, i: number) => (
            <div key={i} className="text-xs text-amber-900 mb-1">
              <strong>{o.type}</strong> — by {o.waivedBy} on {new Date(o.waivedAt).toLocaleDateString()} · {o.reason}
            </div>
          ))}
        </div>
      )}

      <div className="bg-white rounded-xl border p-4">
        <h4 className="text-sm font-semibold mb-2">Timeline</h4>
        <ol className="space-y-1 text-xs">
          {d.timeline.map((e: any, i: number) => (
            <li key={i} className="text-gray-600">
              {new Date(e.at).toLocaleDateString()} — {e.fromBucket ?? "APPLIED"} → {e.toBucket ?? e.reason ?? "(stage)"}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Qualification documents (uploaded by candidate on the careers form)
// ═══════════════════════════════════════════════════════════════════════════
function QualificationDocuments({ attachments }: { attachments: any[] }) {
  const quals = attachments.filter((a) => a?.label === "Qualification");
  if (quals.length === 0) return null;
  return (
    <Box title="Qualification documents">
      <ul className="space-y-2">
        {quals.map((a) => {
          const isImage = /^image\//i.test(a.fileType || "") || /\.(png|jpe?g|gif|webp)$/i.test(a.fileName || "");
          const isPdf = /pdf/i.test(a.fileType || "") || /\.pdf$/i.test(a.fileName || "");
          return (
            <li key={a.id} className="flex items-center justify-between border rounded-lg p-2">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-indigo-600 shrink-0" />
                <span className="text-sm text-gray-700 truncate" title={a.fileName}>{a.fileName || "file"}</span>
                {isPdf && <span className="text-[10px] px-1.5 py-0.5 bg-red-50 text-red-700 rounded">PDF</span>}
                {isImage && <span className="text-[10px] px-1.5 py-0.5 bg-blue-50 text-blue-700 rounded">IMG</span>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <a href={a.fileUrl} target="_blank" rel="noopener noreferrer" className="text-xs text-teal-700 hover:text-teal-800 inline-flex items-center gap-1">
                  <ExternalLink className="w-3 h-3" /> View
                </a>
                <a href={a.fileUrl} download={a.fileName} className="text-xs text-gray-700 hover:text-black inline-flex items-center gap-1">
                  <Download className="w-3 h-3" /> Download
                </a>
              </div>
            </li>
          );
        })}
      </ul>
    </Box>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Work sample submissions — full answer text, AI + human scores, feedback
// ═══════════════════════════════════════════════════════════════════════════
function WorkSampleSubmissionsBox({ submissions }: { submissions: any[] }) {
  if (submissions.length === 0) {
    return (
      <Box title="Work sample submissions">
        <div className="text-sm text-gray-400">Candidate has not submitted any work sample tasks yet.</div>
      </Box>
    );
  }
  return (
    <Box title="Work sample submissions">
      <div className="space-y-3">
        {submissions.map((sub: any) => {
          const rubric = sub.task?.rubric as any;
          const dims: any[] = Array.isArray(rubric?.dimensions) ? rubric.dimensions : [];
          const attachments: any[] = Array.isArray(sub.attachments) ? sub.attachments : [];
          return (
            <div key={sub.id} className="border rounded-lg p-3">
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-gray-800 truncate" title={sub.task?.title}>
                    {sub.task?.title || "Untitled task"}
                  </div>
                  <div className="text-[11px] text-gray-500">
                    {sub.submittedAt ? `Submitted ${new Date(sub.submittedAt).toLocaleString()}` : "Not submitted yet"}
                    {typeof sub.timeTakenSec === "number" && sub.timeTakenSec > 0 && (
                      <> · took {Math.round(sub.timeTakenSec / 60)} min</>
                    )}
                    {sub.task?.passingScore != null && <> · Pass ≥ {sub.task.passingScore}</>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1 shrink-0">
                  {typeof sub.aiScore === "number" && (
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                      sub.aiScore >= (sub.task?.passingScore ?? 60) ? "bg-emerald-100 text-emerald-700"
                      : sub.aiScore >= (sub.task?.passingScore ?? 60) * 0.7 ? "bg-amber-100 text-amber-700"
                      : "bg-red-100 text-red-700"
                    }`}>
                      AI {sub.aiScore.toFixed(1)}/100
                    </span>
                  )}
                  {typeof sub.humanScore === "number" && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-700">
                      Human {sub.humanScore.toFixed(1)}/100
                    </span>
                  )}
                </div>
              </div>

              <IntegrityBadges
                signals={sub.integritySignals}
                aiWritingScore={sub.aiWritingScore}
                aiWritingSignals={sub.aiWritingSignals}
              />

              {sub.task?.instructions && (
                <details className="mb-2">
                  <summary className="text-xs text-gray-500 cursor-pointer hover:text-gray-700">Task instructions</summary>
                  <div className="text-xs text-gray-600 whitespace-pre-wrap bg-gray-50 rounded p-2 mt-1">
                    {sub.task.instructions}
                  </div>
                </details>
              )}

              <div className="text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-2 mb-2">
                {sub.answerText || <span className="text-gray-400 italic">No answer text submitted.</span>}
              </div>

              {sub.aiFeedback && (
                <div className="text-xs text-gray-600 italic mb-2">
                  <span className="font-semibold not-italic text-gray-700">AI feedback: </span>
                  {sub.aiFeedback}
                </div>
              )}

              {sub.humanFeedback && (
                <div className="text-xs text-blue-800 mb-2 bg-blue-50 rounded p-2">
                  <span className="font-semibold">Human feedback: </span>
                  {sub.humanFeedback}
                </div>
              )}

              {dims.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {dims.map((d, i) => (
                    <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[11px]">
                      {d.label || d.code} × {d.weight ?? 1}
                    </span>
                  ))}
                </div>
              )}

              {attachments.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {attachments.map((att, i) => (
                    <a
                      key={i}
                      href={att.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-xs text-teal-700 hover:text-teal-800 border border-teal-200 rounded px-2 py-0.5"
                    >
                      <ExternalLink className="w-3 h-3" />
                      {att.fileName || att.label}
                    </a>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </Box>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// Cheating-defense badges (Tier 1)
// ═══════════════════════════════════════════════════════════════════════════
function IntegrityBadges({ signals, aiWritingScore, aiWritingSignals }: {
  signals: any;
  aiWritingScore?: number | null;
  aiWritingSignals?: any;
}) {
  const s = signals && typeof signals === "object" ? signals : null;
  const pasteRatio: number | null = s && typeof s.pasteRatio === "number" ? s.pasteRatio : null;
  const tabSwitches: number = s && typeof s.tabSwitchCount === "number" ? s.tabSwitchCount : 0;
  const focusOutSec: number = s && typeof s.focusOutSeconds === "number" ? s.focusOutSeconds : 0;
  const composeSec: number | null = s && typeof s.composeSeconds === "number" ? s.composeSeconds : null;

  const integrity =
    pasteRatio == null ? null
    : pasteRatio < 0.2 ? { label: "Typed live", color: "bg-emerald-100 text-emerald-700" }
    : pasteRatio < 0.6 ? { label: `Partial paste (${Math.round(pasteRatio*100)}%)`, color: "bg-amber-100 text-amber-700" }
    : { label: `Mostly pasted (${Math.round(pasteRatio*100)}%)`, color: "bg-red-100 text-red-700" };

  const tabFlag = tabSwitches >= 5 || focusOutSec >= 60
    ? { label: `Tab-switched × ${tabSwitches} · ${focusOutSec}s away`, color: "bg-red-100 text-red-700" }
    : tabSwitches > 0
    ? { label: `Tab-switched × ${tabSwitches}`, color: "bg-amber-100 text-amber-700" }
    : null;

  const aiRisk = typeof aiWritingScore === "number"
    ? aiWritingScore >= 70 ? { label: `AI-written risk ${Math.round(aiWritingScore)}`, color: "bg-red-100 text-red-700" }
      : aiWritingScore >= 40 ? { label: `AI-written risk ${Math.round(aiWritingScore)}`, color: "bg-amber-100 text-amber-700" }
      : { label: `AI-written risk ${Math.round(aiWritingScore)}`, color: "bg-emerald-100 text-emerald-700" }
    : null;

  if (!integrity && !tabFlag && !aiRisk && composeSec == null) return null;
  const aiSigs: string[] = aiWritingSignals?.signals && Array.isArray(aiWritingSignals.signals) ? aiWritingSignals.signals : [];

  return (
    <div className="flex flex-wrap items-center gap-1.5 mt-1 mb-2">
      {integrity && <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${integrity.color}`}>{integrity.label}</span>}
      {tabFlag && <span className={`px-2 py-0.5 rounded text-[11px] font-medium ${tabFlag.color}`}>{tabFlag.label}</span>}
      {aiRisk && (
        <span
          className={`px-2 py-0.5 rounded text-[11px] font-medium ${aiRisk.color}`}
          title={aiSigs.length > 0 ? aiSigs.join(" · ") : undefined}
        >{aiRisk.label}</span>
      )}
      {composeSec != null && composeSec < 30 && (
        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-red-100 text-red-700"
          title="Answer composed in under 30 seconds — unusually fast.">
          Composed {composeSec}s
        </span>
      )}
    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// FastTrackBanner — shows a one-click "Confirm fast-track hire" button when
// the application is a Maintenance App role AND the candidate has passed the
// auto-flag threshold (fastTrackReady=true).
// ═══════════════════════════════════════════════════════════════════════════
function FastTrackBanner({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const q = useQuery(trpc.getApplicationDetail.queryOptions({ token, applicationId }));
  const mut = useMutation(
    trpc.confirmFastTrackHire.mutationOptions({
      onSuccess: () => {
        toast.success("Fast-track hire confirmed — application moved to Offer stage.");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const app = q.data as any;
  if (!app) return null;
  const isMaintenance = app.job?.jobType === "MAINTENANCE_APP";
  if (!isMaintenance) return null;
  if (app.fastTrackApprovedAt) {
    return (
      <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
        <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
        <div className="text-sm text-emerald-900">
          <div className="font-semibold">Fast-track hire confirmed</div>
          <div className="text-xs">Approved {new Date(app.fastTrackApprovedAt).toLocaleString()} · Moved to Offer stage.</div>
        </div>
      </div>
    );
  }
  if (!app.fastTrackReady) return null;
  return (
    <div className="bg-teal-50 border border-teal-300 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <Zap className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
        <div className="flex-1 text-sm text-teal-900">
          <div className="font-semibold mb-1">Fast-track hire ready</div>
          <p className="mb-2">
            This Maintenance App candidate has passed the auto-flag threshold:
            overall score ≥ 75, red-flag score &lt; 30, and low AI-writing risk.
            Confirm to skip the onsite interview and advance directly to the Offer stage.
          </p>
          <button
            disabled={mut.isPending}
            onClick={() => mut.mutate({ token, applicationId })}
            className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-50"
          >
            {mut.isPending ? "Confirming…" : "Confirm fast-track hire →"}
          </button>
        </div>
      </div>
    </div>
  );
}

function AssessorBookingCard({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);
  const [start, setStart] = useState<string>("");
  const [end, setEnd] = useState<string>("");
  const [location, setLocation] = useState<string>("VIDEO");
  const [meetingUrl, setMeetingUrl] = useState<string>("");
  const [agenda, setAgenda] = useState<string>("");

  const assessorsQ = useQuery(trpc.getPotentialAssessors.queryOptions({ token, search }));
  const bookMut = useMutation({
    ...trpc.bookInterviewWithAssessors.mutationOptions(),
    onSuccess: () => {
      toast.success("Interview booked â€” assessors notified");
      setSelected([]); setStart(""); setEnd(""); setMeetingUrl(""); setAgenda("");
      qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggle = (id: number) => setSelected((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  const canSubmit = selected.length > 0 && start && end && new Date(end).getTime() > new Date(start).getTime();

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-gray-900">Book interview with your own assessors</h3>
        <p className="text-xs text-gray-500">Pick 1+ internal assessors (e.g. Themba the Technical Manager) â€” they will be added to an ad-hoc panel and receive an invite.</p>
      </div>

      <div>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search assessors by name or emailâ€¦"
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
        />
        <div className="mt-2 max-h-48 overflow-y-auto border border-gray-200 rounded-lg divide-y">
          {(assessorsQ.data ?? []).map((u: any) => (
            <label key={u.id} className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer text-sm">
              <input type="checkbox" checked={selected.includes(u.id)} onChange={() => toggle(u.id)} />
              <span className="flex-1">{u.firstName} {u.lastName}</span>
              <span className="text-xs text-gray-500">{u.role.replace(/_/g, " ")}</span>
            </label>
          ))}
          {(assessorsQ.data ?? []).length === 0 && (
            <div className="text-xs text-gray-400 italic p-3">No matches</div>
          )}
        </div>
        {selected.length > 0 && (
          <div className="mt-1 text-xs text-teal-700">{selected.length} assessor(s) selected</div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-700">
          Start
          <input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded text-sm" />
        </label>
        <label className="text-xs text-gray-700">
          End
          <input type="datetime-local" value={end} onChange={(e) => setEnd(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded text-sm" />
        </label>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-gray-700">
          Location
          <select value={location} onChange={(e) => setLocation(e.target.value)} className="mt-1 w-full px-2 py-1.5 border rounded text-sm">
            <option value="VIDEO">Video call</option>
            <option value="OFFICE">Head office</option>
            <option value="ONSITE">On-site</option>
            <option value="PHONE">Phone call</option>
          </select>
        </label>
        {location === "VIDEO" && (
          <label className="text-xs text-gray-700">
            Meeting URL
            <input value={meetingUrl} onChange={(e) => setMeetingUrl(e.target.value)} placeholder="https://â€¦" className="mt-1 w-full px-2 py-1.5 border rounded text-sm" />
          </label>
        )}
      </div>

      <label className="text-xs text-gray-700 block">
        Agenda / notes for assessors
        <textarea value={agenda} onChange={(e) => setAgenda(e.target.value)} rows={2} className="mt-1 w-full px-2 py-1.5 border rounded text-sm" placeholder="Focus areas, questions to cover, etc." />
      </label>

      <button
        disabled={!canSubmit || bookMut.isPending}
        onClick={() => bookMut.mutate({
          token, applicationId,
          assessorUserIds: selected,
          scheduledStart: new Date(start).toISOString(),
          scheduledEnd: new Date(end).toISOString(),
          location, meetingUrl: meetingUrl || undefined, agenda: agenda || undefined,
        })}
        className="w-full px-3 py-2 bg-teal-600 text-white rounded-lg text-sm font-semibold hover:bg-teal-700 disabled:opacity-40"
      >
        {bookMut.isPending ? "Bookingâ€¦" : "Book interview & notify assessors"}
      </button>
    </div>
  );
}

function BackgroundDocumentsList({ bg, token, applicationId }: { bg: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const decideMut = useMutation(
    trpc.decideBackgroundCheckDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Decision recorded");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );
  const docs = (bg.documents ?? []) as any[];
  if (docs.length === 0) {
    return <div className="mt-2 text-xs text-gray-500">Waiting for candidate to upload documents.</div>;
  }
  const downloadDoc = async (docId: number, fileName: string) => {
    const r = await fetch(`/trpc/getBackgroundCheckDocument?input=${encodeURIComponent(JSON.stringify({ json: { token, documentId: docId } }))}`);
    const d = await r.json();
    const b64 = d?.result?.data?.json?.fileBase64;
    const mime = d?.result?.data?.json?.mimeType ?? "application/octet-stream";
    if (!b64) { toast.error("Download failed"); return; }
    const link = document.createElement("a");
    link.href = `data:${mime};base64,${b64}`;
    link.download = fileName;
    link.click();
  };
  return (
    <div className="mt-2 space-y-1">
      {docs.map((d: any) => (
        <div key={d.id} className="flex items-center justify-between bg-gray-50 rounded p-2 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[10px] bg-gray-200 rounded px-1">{d.checkType}</span>
            <button onClick={() => downloadDoc(d.id, d.fileName)} className="text-blue-600 hover:underline">{d.fileName}</button>
          </div>
          {d.decision === "APPROVED" ? (
            <span className="text-emerald-700">✓ Approved</span>
          ) : d.decision === "REJECTED" ? (
            <span className="text-red-700">✗ Rejected {d.decisionNotes ? `· ${d.decisionNotes}` : ""}</span>
          ) : (
            <div className="flex gap-1">
              <button
                onClick={() => decideMut.mutate({ token, documentId: d.id, decision: "APPROVED" })}
                className="px-2 py-0.5 bg-emerald-600 text-white rounded text-[10px]"
              >Approve</button>
              <button
                onClick={() => {
                  const reason = prompt("Reason for rejecting?");
                  if (reason) decideMut.mutate({ token, documentId: d.id, decision: "REJECTED", notes: reason });
                }}
                className="px-2 py-0.5 bg-red-600 text-white rounded text-[10px]"
              >Reject</button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function DecisionActionsPanel({ token, applicationId }: { token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const reasonsQ = useQuery(trpc.getRejectionReasons.queryOptions({ token }));
  const [showReject, setShowReject] = useState(false);
  const [reasonId, setReasonId] = useState<number | "">("");
  const [rejectNotes, setRejectNotes] = useState("");
  const [hireNotes, setHireNotes] = useState("");
  const [showHire, setShowHire] = useState(false);

  const hireMut = useMutation(
    trpc.hireApplication.mutationOptions({
      onSuccess: () => {
        toast.success("Candidate hired — moved to HIRED bucket");
        setShowHire(false);
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
        qc.invalidateQueries({ queryKey: trpc.getApplicationDecisionSnapshot.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const rejectMut = useMutation(
    trpc.rejectApplication.mutationOptions({
      onSuccess: () => {
        toast.success("Candidate rejected");
        setShowReject(false);
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
        qc.invalidateQueries({ queryKey: trpc.getApplicationDecisionSnapshot.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const reasons = (reasonsQ.data ?? []) as any[];

  return (
    <div className="bg-white rounded-xl border p-4">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-1.5">
        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> Final decision
      </h3>

      {!showHire && !showReject && (
        <div className="flex gap-3">
          <button
            onClick={() => setShowHire(true)}
            className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold text-sm"
          >Hire candidate</button>
          <button
            onClick={() => setShowReject(true)}
            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm"
          >Reject candidate</button>
        </div>
      )}

      {showHire && (
        <div className="border border-emerald-300 rounded-lg bg-emerald-50 p-3">
          <label className="text-xs font-semibold text-emerald-900">Confirm hire</label>
          <textarea
            value={hireNotes}
            onChange={(e) => setHireNotes(e.target.value)}
            placeholder="Optional notes for the hire decision (visible in history)"
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white"
            rows={2}
          />
          <div className="flex gap-2 mt-3">
            <button
              disabled={hireMut.isPending}
              onClick={() => hireMut.mutate({ token, applicationId, notes: hireNotes.trim() || undefined })}
              className="px-4 py-2 bg-emerald-600 text-white rounded text-sm font-semibold disabled:opacity-50"
            >{hireMut.isPending ? "Recording…" : "Confirm hire"}</button>
            <button onClick={() => { setShowHire(false); setHireNotes(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
          </div>
        </div>
      )}

      {showReject && (
        <div className="border border-red-300 rounded-lg bg-red-50 p-3">
          <label className="text-xs font-semibold text-red-900">Reason for rejection <span className="text-red-600">*</span></label>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value ? Number(e.target.value) : "")}
            className="w-full border rounded px-2 py-2 text-sm mt-1 bg-white"
          >
            <option value="">Select a reason…</option>
            {reasons.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
          <textarea
            value={rejectNotes}
            onChange={(e) => setRejectNotes(e.target.value)}
            placeholder="Detail / notes (optional, sent to candidate)"
            className="w-full border rounded px-2 py-2 text-sm mt-2 bg-white"
            rows={3}
          />
          <div className="flex gap-2 mt-3">
            <button
              disabled={!reasonId || rejectMut.isPending}
              onClick={() => reasonId && rejectMut.mutate({ token, applicationId, rejectionReasonId: reasonId, rejectionDetail: rejectNotes.trim() || undefined })}
              className="px-4 py-2 bg-red-600 text-white rounded text-sm font-semibold disabled:opacity-50"
            >{rejectMut.isPending ? "Recording…" : "Confirm rejection"}</button>
            <button onClick={() => { setShowReject(false); setReasonId(""); setRejectNotes(""); }} className="px-4 py-2 border rounded text-sm">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function AssessmentResponsesCard({ app }: { app: any }) {
  const sessions = (app.assessments ?? []) as any[];
  return (
    <Box title="Online assessment responses">
      {sessions.length === 0 ? (
        <div className="text-sm text-gray-400">Candidate has not completed any online assessments yet.</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((s: any, i: number) => (
            <div key={i} className="border rounded-lg p-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium">{s.type ?? "Assessment"}</div>
                <span className={`text-xs px-2 py-0.5 rounded ${
                  s.score >= 70 ? "bg-emerald-100 text-emerald-700" :
                  s.score >= 50 ? "bg-amber-100 text-amber-700" :
                  s.score !== null && s.score !== undefined ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500"
                }`}>{s.score ?? "—"}</span>
              </div>
              {s.completedAt && (
                <div className="text-xs text-gray-500 mt-1">
                  Completed {new Date(s.completedAt).toLocaleString()}
                </div>
              )}
              {s.results ? (
                <details className="mt-2">
                  <summary className="text-xs text-teal-700 cursor-pointer hover:underline">View responses</summary>
                  <pre className="mt-2 bg-gray-50 rounded p-2 text-[11px] whitespace-pre-wrap overflow-x-auto">
                    {typeof s.results === "string" ? s.results : JSON.stringify(s.results, null, 2)}
                  </pre>
                </details>
              ) : (
                <div className="text-xs text-gray-400 mt-1">No responses recorded</div>
              )}
            </div>
          ))}
        </div>
      )}
    </Box>
  );
}

function BackgroundCheckControls({ bg, token, applicationId }: { bg: any; token: string; applicationId: number }) {
  const trpc = useTRPC();
  const qc = useQueryClient();
  const employeesQ = useQuery(trpc.getEmployees.queryOptions({ token }));

  const assignMut = useMutation(
    trpc.assignBackgroundCheckAssessor.mutationOptions({
      onSuccess: () => {
        toast.success("Assessor updated");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const uploadMut = useMutation(
    trpc.adminUploadBackgroundCheckDocument.mutationOptions({
      onSuccess: () => {
        toast.success("Uploaded");
        qc.invalidateQueries({ queryKey: trpc.getApplicationDetail.queryKey({ token, applicationId }) });
      },
      onError: (e) => toast.error(e.message),
    }),
  );

  const [uploadType, setUploadType] = useState<string>(bg.checkTypes?.[0] ?? "OTHER");
  const employees = (employeesQ.data ?? []) as any[];

  const handleFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error("File exceeds 10MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1] ?? "";
      uploadMut.mutate({
        token,
        backgroundCheckId: bg.id,
        checkType: uploadType,
        fileName: file.name,
        mimeType: file.type || "application/octet-stream",
        fileBase64: base64,
      });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="mt-2 space-y-2 border-t pt-2">
      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[11px] font-semibold text-gray-600">Assign reviewer</label>
          <select
            value={bg.assignedAssessorId ?? ""}
            onChange={(e) => assignMut.mutate({ token, backgroundCheckId: bg.id, assessorUserId: e.target.value ? Number(e.target.value) : null })}
            className="w-full border rounded px-2 py-1 text-xs mt-0.5"
          >
            <option value="">— unassigned —</option>
            {employees.map((u: any) => (
              <option key={u.id} value={u.id}>{u.firstName} {u.lastName} · {u.role}</option>
            ))}
          </select>
          {bg.assessorNotifiedAt && (
            <div className="text-[10px] text-emerald-700 mt-0.5">Assessor notified {new Date(bg.assessorNotifiedAt).toLocaleDateString()}</div>
          )}
        </div>
        <div>
          <label className="text-[11px] font-semibold text-gray-600">Upload on behalf of candidate</label>
          <div className="flex gap-1 mt-0.5">
            <select
              value={uploadType}
              onChange={(e) => setUploadType(e.target.value)}
              className="border rounded px-2 py-1 text-xs"
            >
              {(bg.checkTypes ?? []).map((t: string) => <option key={t} value={t}>{t}</option>)}
              <option value="OTHER">OTHER</option>
            </select>
            <label className="inline-flex items-center gap-1 px-2 py-1 border border-teal-300 text-teal-700 rounded cursor-pointer hover:bg-teal-50 text-xs">
              Upload
              <input
                type="file"
                className="hidden"
                accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleFile(f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-2 text-[10px] text-gray-500">
        <span>Candidate portal:</span>
        <button
          onClick={() => {
            navigator.clipboard.writeText(`${window.location.origin}/background/${bg.candidateUploadToken}`);
            toast.success("Link copied");
          }}
          className="text-teal-600 hover:underline"
        >copy link</button>
        <span>·</span>
        <span>{bg.candidateNotifiedAt ? `notified ${new Date(bg.candidateNotifiedAt).toLocaleDateString()}` : "not notified"}</span>
      </div>
    </div>
  );
}

