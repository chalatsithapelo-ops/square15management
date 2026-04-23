import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import {
  Users, Brain, Heart, BarChart3, MessageSquare, User,
  Search, Filter, ChevronDown, ChevronRight, ArrowLeft,
  Star, AlertTriangle, CheckCircle2, XCircle, Clock,
  Shield, Briefcase, Mail, Phone, Eye, UserPlus,
  Loader2, Copy, RefreshCw, TrendingUp,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/recruitment/")({
  component: RecruitmentDashboard,
});

type AppStatus = "NEW" | "ASSESSMENTS_PENDING" | "ASSESSMENTS_COMPLETE" | "INTERVIEW_PENDING" | "INTERVIEW_COMPLETE" | "UNDER_REVIEW" | "SHORTLISTED" | "APPROVED" | "REJECTED" | "ONBOARDED";

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: any }> = {
  NEW: { label: "New", color: "text-blue-700", bg: "bg-blue-100", icon: Clock },
  ASSESSMENTS_PENDING: { label: "Assessments Pending", color: "text-amber-700", bg: "bg-amber-100", icon: Clock },
  ASSESSMENTS_COMPLETE: { label: "Assessments Done", color: "text-indigo-700", bg: "bg-indigo-100", icon: CheckCircle2 },
  INTERVIEW_PENDING: { label: "Interview Pending", color: "text-orange-700", bg: "bg-orange-100", icon: MessageSquare },
  INTERVIEW_COMPLETE: { label: "Interview Done", color: "text-purple-700", bg: "bg-purple-100", icon: CheckCircle2 },
  UNDER_REVIEW: { label: "Under Review", color: "text-cyan-700", bg: "bg-cyan-100", icon: Eye },
  SHORTLISTED: { label: "Shortlisted", color: "text-emerald-700", bg: "bg-emerald-100", icon: Star },
  APPROVED: { label: "Approved", color: "text-green-700", bg: "bg-green-100", icon: CheckCircle2 },
  REJECTED: { label: "Rejected", color: "text-red-700", bg: "bg-red-100", icon: XCircle },
  ONBOARDED: { label: "Onboarded", color: "text-teal-700", bg: "bg-teal-100", icon: UserPlus },
};

function RecruitmentDashboard() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [statusFilter, setStatusFilter] = useState<string>("");
  const [tradeFilter, setTradeFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [showOnboard, setShowOnboard] = useState(false);
  const [onboardPassword, setOnboardPassword] = useState("");

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border border-gray-200 max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold text-gray-900">Access Denied</h1>
          <p className="mt-2 text-sm text-gray-600">You do not have permission to view this page.</p>
          <Link to="/admin/dashboard" className="mt-4 inline-block text-sm text-teal-600 hover:text-teal-700 font-medium">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const listQuery = useQuery(
    trpc.getRecruitmentApplications.queryOptions({
      token: token!,
      status: statusFilter || undefined,
      trade: tradeFilter || undefined,
      sortBy: "createdAt",
      sortOrder: "desc",
    })
  );

  const detailQuery = useQuery(
    trpc.getRecruitmentApplicationDetail.queryOptions(
      { token: token!, applicationId: selectedId! },
      { enabled: !!selectedId }
    )
  );

  const updateStatus = useMutation(
    trpc.updateApplicationStatus.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: trpc.getRecruitmentApplications.queryKey({ token: token! }) });
        if (selectedId) queryClient.invalidateQueries({ queryKey: trpc.getRecruitmentApplicationDetail.queryKey({ token: token!, applicationId: selectedId }) });
        toast.success("Status updated");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const onboard = useMutation(
    trpc.onboardApplicant.mutationOptions({
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: trpc.getRecruitmentApplications.queryKey({ token: token! }) });
        if (selectedId) queryClient.invalidateQueries({ queryKey: trpc.getRecruitmentApplicationDetail.queryKey({ token: token!, applicationId: selectedId }) });
        toast.success(`${data.name} onboarded as ${data.role}!`);
        setShowOnboard(false);
        setOnboardPassword("");
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const apps = listQuery.data?.applications ?? [];
  const statusCounts = listQuery.data?.statusCounts ?? {};
  const filteredApps = searchQuery
    ? apps.filter((a: any) =>
        `${a.firstName} ${a.lastName} ${a.email} ${a.primaryTrade}`.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : apps;

  const detail = detailQuery.data as any;
  const tradesSet = new Set<string>();
  for (const a of apps as any[]) {
    const t = a?.primaryTrade;
    if (typeof t === "string" && t.length > 0) tradesSet.add(t);
  }
  const trades: string[] = Array.from(tradesSet).sort();

  // ─── Detail View ───
  if (selectedId && detail) {
    const s = (STATUS_CONFIG[detail.status] ?? STATUS_CONFIG.NEW) as any;
    return (
      <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => setSelectedId(null)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" /> Back to Applications
          </button>

          {/* Candidate header */}
          <div className="bg-white border border-gray-200 rounded-xl p-6 mb-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center shrink-0">
                <span className="text-teal-700 font-bold text-lg">{detail.firstName[0]}{detail.lastName[0]}</span>
              </div>
              <div className="flex-1">
                <h1 className="text-xl font-bold text-gray-900">{detail.firstName} {detail.lastName}</h1>
                <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mt-1">
                  <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" />{detail.email}</span>
                  <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" />{detail.phone}</span>
                  <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5" />{detail.primaryTrade} • {detail.yearsExperience}y exp</span>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <span className={`px-3 py-1 rounded-full text-xs font-semibold ${s.color} ${s.bg}`}>{s.label}</span>
                {detail.overallScore !== null && (
                  <div className="text-2xl font-bold text-gray-900">{Math.round(detail.overallScore)}%<span className="text-sm font-normal text-gray-500 ml-1">overall</span></div>
                )}
              </div>
            </div>
          </div>

          {/* AI Summary */}
          {detail.aiSummary && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-2"><Brain className="w-4 h-4 text-purple-600" /> AI Summary</h3>
              <p className="text-sm text-gray-700 leading-relaxed">{detail.aiSummary}</p>
              {detail.aiStrengths && (
                <div className="mt-3">
                  <span className="text-xs font-semibold text-green-700">Strengths:</span>
                  <p className="text-sm text-green-700 mt-0.5">{detail.aiStrengths}</p>
                </div>
              )}
              {detail.aiRedFlags && (
                <div className="mt-2">
                  <span className="text-xs font-semibold text-red-700">Red Flags:</span>
                  <p className="text-sm text-red-600 mt-0.5">{detail.aiRedFlags}</p>
                </div>
              )}
            </div>
          )}

          {/* Assessment Scores Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            {detail.assessments.map((a: any) => {
              const meta: Record<string, { icon: any; color: string; bg: string }> = {
                IQ: { icon: Brain, color: "text-blue-600", bg: "bg-blue-50" },
                EQ: { icon: Heart, color: "text-rose-600", bg: "bg-rose-50" },
                MBTI: { icon: User, color: "text-purple-600", bg: "bg-purple-50" },
                BIG_FIVE: { icon: BarChart3, color: "text-amber-600", bg: "bg-amber-50" },
              };
              const m = (meta[a.type] || meta.IQ)!;
              const I = m.icon;
              return (
                <div key={a.type} className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`w-8 h-8 rounded-lg ${m.bg} flex items-center justify-center`}>
                      <I className={`w-4 h-4 ${m.color}`} />
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{a.type === "BIG_FIVE" ? "Big Five" : a.type}</span>
                  </div>
                  {a.type === "MBTI" && a.results?.mbtiType ? (
                    <div className="text-2xl font-bold text-purple-700">{a.results.mbtiType}</div>
                  ) : (
                    <div className="text-2xl font-bold text-gray-900">{a.score !== null ? `${Math.round(a.score)}%` : "—"}</div>
                  )}
                  {a.results?.classification && <p className="text-xs text-gray-500 mt-1">{a.results.classification}</p>}
                  {a.results?.description && a.type === "MBTI" && <p className="text-xs text-gray-500 mt-1">{a.results.description}</p>}

                  {/* Big Five factor bars */}
                  {a.type === "BIG_FIVE" && a.results?.factors && (
                    <div className="mt-2 space-y-1">
                      {Object.entries(a.results.factors as Record<string, { score: number; label: string }>).map(([k, f]) => (
                        <div key={k} className="flex items-center gap-1.5">
                          <span className="text-[10px] text-gray-500 w-6">{k}</span>
                          <div className="flex-1 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${f.score}%` }} />
                          </div>
                          <span className="text-[10px] text-gray-500">{Math.round(f.score)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Interview Responses */}
          {detail.interviewResponses.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-5 mb-4">
              <h3 className="text-sm font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-teal-600" /> AI Interview Responses
              </h3>
              <div className="space-y-4">
                {detail.interviewResponses.map((r: any) => (
                  <div key={r.questionIndex} className="border border-gray-100 rounded-lg p-4">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="text-sm font-medium text-gray-900">Q{r.questionIndex + 1}: {r.question}</p>
                      <span className={`shrink-0 px-2 py-0.5 rounded-full text-xs font-bold ${
                        r.aiScore >= 8 ? "bg-green-100 text-green-700" : r.aiScore >= 5 ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"
                      }`}>{r.aiScore}/10</span>
                    </div>
                    <p className="text-sm text-gray-600 bg-gray-50 rounded-lg p-3 italic">"{r.answer}"</p>
                    {r.aiAnalysis && <p className="text-xs text-gray-500 mt-2">{r.aiAnalysis}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-3">Actions</h3>
            <div className="flex flex-wrap gap-2">
              {(["UNDER_REVIEW", "SHORTLISTED", "APPROVED", "REJECTED"] as AppStatus[]).map((st) => {
                const cfg = STATUS_CONFIG[st] as any;
                if (detail.status === st) return null;
                return (
                  <button key={st}
                    onClick={() => updateStatus.mutate({ token: token!, applicationId: detail.id, status: st })}
                    disabled={updateStatus.isPending}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium border transition-colors ${cfg.bg} ${cfg.color} border-current/20 hover:opacity-80 disabled:opacity-50`}>
                    <cfg.icon className="w-3.5 h-3.5" /> {cfg.label}
                  </button>
                );
              })}

              {detail.status === "APPROVED" && (
                <button onClick={() => setShowOnboard(true)}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium bg-teal-600 text-white hover:bg-teal-700 transition-colors">
                  <UserPlus className="w-3.5 h-3.5" /> Onboard Artisan
                </button>
              )}
            </div>

            {/* Onboard dialog */}
            {showOnboard && (
              <div className="mt-4 bg-teal-50 border border-teal-200 rounded-xl p-4">
                <h4 className="text-sm font-semibold text-teal-800 mb-2">Onboard {detail.firstName} {detail.lastName}</h4>
                <p className="text-xs text-teal-700 mb-3">This will create a user account with ARTISAN role.</p>
                <div className="flex items-center gap-3">
                  <input type="text" value={onboardPassword} onChange={(e) => setOnboardPassword(e.target.value)}
                    placeholder="Set password (min 6 chars)"
                    className="flex-1 rounded-lg border border-teal-300 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500" />
                  <button onClick={() => {
                    if (onboardPassword.length < 6) { toast.error("Password must be at least 6 characters"); return; }
                    onboard.mutate({ token: token!, applicationId: detail.id, password: onboardPassword });
                  }}
                    disabled={onboard.isPending}
                    className="px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
                    {onboard.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirm"}
                  </button>
                  <button onClick={() => { setShowOnboard(false); setOnboardPassword(""); }}
                    className="px-3 py-2 text-sm text-gray-600 hover:text-gray-900">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Application meta */}
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-gray-500">City</span>
              <p className="font-medium text-gray-900">{detail.city || "—"}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-gray-500">Province</span>
              <p className="font-medium text-gray-900">{detail.province || "—"}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-gray-500">Transport</span>
              <p className="font-medium text-gray-900">{detail.hasOwnTransport ? "Yes" : "No"}</p>
            </div>
            <div className="bg-white border border-gray-200 rounded-lg p-3">
              <span className="text-gray-500">Tools</span>
              <p className="font-medium text-gray-900">{detail.hasOwnTools ? "Yes" : "No"}</p>
            </div>
          </div>

          {detail.motivationLetter && (
            <div className="mt-4 bg-white border border-gray-200 rounded-xl p-5">
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Motivation Letter</h3>
              <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{detail.motivationLetter}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── List View ───
  const total = Object.values(statusCounts).reduce((s: number, v: any) => s + (v || 0), 0);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <Link to="/admin/dashboard" className="text-sm text-gray-500 hover:text-gray-700 flex items-center gap-1 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Users className="w-6 h-6 text-teal-600" /> Artisan Recruitment
            </h1>
            <p className="text-sm text-gray-500 mt-1">{total} total applications</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => {
              const url = `${window.location.origin}/apply`;
              navigator.clipboard.writeText(url);
              toast.success("Application link copied!");
            }}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <Copy className="w-3.5 h-3.5" /> Copy Application Link
            </button>
            <button onClick={() => listQuery.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
              <RefreshCw className={`w-3.5 h-3.5 ${listQuery.isRefetching ? "animate-spin" : ""}`} /> Refresh
            </button>
          </div>
        </div>

        {/* Status pills */}
        <div className="flex flex-wrap gap-2 mb-4">
          <button onClick={() => setStatusFilter("")}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              !statusFilter ? "bg-teal-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}>
            All ({total})
          </button>
          {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
            const count = statusCounts[key] ?? 0;
            if (count === 0 && key !== statusFilter) return null;
            return (
              <button key={key} onClick={() => setStatusFilter(key === statusFilter ? "" : key)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  statusFilter === key ? `${cfg.bg} ${cfg.color}` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                }`}>
                {cfg.label} ({count})
              </button>
            );
          })}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by name, email, or trade..."
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 text-sm focus:border-teal-500 focus:ring-teal-500" />
          </div>
          <select value={tradeFilter} onChange={(e) => setTradeFilter(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-teal-500 focus:ring-teal-500">
            <option value="">All Trades</option>
            {trades.map((t: any) => <option key={String(t)} value={String(t)}>{String(t)}</option>)}
          </select>
        </div>

        {/* Application cards */}
        {listQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        ) : listQuery.isError ? (
          <div className="bg-white border border-red-200 rounded-xl p-8 text-center">
            <AlertTriangle className="w-10 h-10 text-red-400 mx-auto" />
            <p className="mt-3 text-red-700 font-medium">Could not load recruitment applications</p>
            <p className="mt-1 text-sm text-red-600">
              {(listQuery.error as any)?.message || "Please refresh or log in again."}
            </p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-12 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-gray-500">No applications found</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredApps.map((a: any) => {
              const st = (STATUS_CONFIG[a.status] ?? STATUS_CONFIG.NEW) as any;
              const StIcon = st.icon;
              return (
                <button key={a.id} onClick={() => setSelectedId(a.id)}
                  className="w-full bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-4 hover:shadow-md transition-all text-left">
                  {/* Avatar + score */}
                  <div className="relative shrink-0">
                    <div className="w-11 h-11 rounded-full bg-teal-100 flex items-center justify-center">
                      <span className="text-teal-700 font-bold text-sm">{a.firstName[0]}{a.lastName[0]}</span>
                    </div>
                    {a.overallScore !== null && (
                      <div className={`absolute -bottom-1 -right-1 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white ${
                        a.overallScore >= 70 ? "bg-green-500" : a.overallScore >= 50 ? "bg-amber-500" : "bg-red-500"
                      }`}>{Math.round(a.overallScore)}</div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-900">{a.firstName} {a.lastName}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${st.color} ${st.bg}`}>{st.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                      <span>{a.primaryTrade}</span>
                      <span>{a.yearsExperience}y exp</span>
                      <span>{a.email}</span>
                    </div>
                  </div>

                  {/* Score bars */}
                  <div className="hidden sm:flex items-center gap-3 shrink-0">
                    {[
                      { label: "IQ", val: a.assessmentScores.IQ, color: "bg-blue-500" },
                      { label: "EQ", val: a.assessmentScores.EQ, color: "bg-rose-500" },
                      { label: "B5", val: a.assessmentScores.BIG_FIVE, color: "bg-amber-500" },
                      { label: "IV", val: a.interviewScore, color: "bg-teal-500" },
                    ].map((s) => (
                      <div key={s.label} className="text-center w-10">
                        <p className="text-[10px] text-gray-400 mb-0.5">{s.label}</p>
                        {s.val !== null && s.val !== undefined ? (
                          <p className="text-xs font-semibold text-gray-900">{typeof s.val === "number" ? Math.round(s.val) : s.val}%</p>
                        ) : (
                          <p className="text-xs text-gray-300">—</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Progress */}
                  <div className="hidden md:flex items-center gap-1 shrink-0">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div key={i} className={`w-2 h-2 rounded-full ${i < a.completionProgress.total ? "bg-teal-500" : "bg-gray-200"}`} />
                    ))}
                  </div>

                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
