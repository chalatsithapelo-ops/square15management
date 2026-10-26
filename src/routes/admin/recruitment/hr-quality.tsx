import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ArrowLeft, TrendingUp, Clock, AlertTriangle, Shield, MessageSquare } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/recruitment/hr-quality")({
  component: HrQualityPage,
});

function HrQualityPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const [tab, setTab] = useState<"source" | "sla" | "checkins" | "feedback">("source");

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "MANAGER", "HR", "TECHNICAL_MANAGER", "JUNIOR_ADMIN", "RECRUITER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold">Access Denied</h1>
        </div>
      </div>
    );
  }

  const sourceQ = useQuery(trpc.getSourceChannelReport.queryOptions({ token }));
  const slaQ = useQuery(trpc.getRecruiterSlaReport.queryOptions({ token }));
  const checkinsQ = useQuery(trpc.listDuePerformanceCheckIns.queryOptions({ token }));
  const feedbackQ = useQuery(trpc.getCandidateFeedbackReport.queryOptions({ token }));

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <Link to="/admin/recruitment" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2">
          <ArrowLeft className="w-4 h-4" /> Recruitment
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-4">
          <TrendingUp className="w-6 h-6 text-teal-600" /> HR Quality (Phase 3)
        </h1>

        <div className="flex gap-1 border-b mb-6">
          {(["source","sla","checkins","feedback"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 capitalize ${
                tab === k ? "border-teal-600 text-teal-700" : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {k === "source" ? "Source channel" : k === "sla" ? "SLA" : k === "checkins" ? "Check-ins due" : "Candidate feedback"}
            </button>
          ))}
        </div>

        {tab === "source" && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-teal-600" /> Post-hire quality by source channel
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Which channel produces the best hires? Rate at 90-day check-ins tells you which channels are actually giving you people who stay and perform.
            </p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Channel</th>
                  <th className="text-right px-3 py-2">Applications</th>
                  <th className="text-right px-3 py-2">Hired</th>
                  <th className="text-right px-3 py-2">Hire rate</th>
                  <th className="text-right px-3 py-2">90d check-ins</th>
                  <th className="text-right px-3 py-2">Avg 90d rating</th>
                  <th className="text-right px-3 py-2">At-risk rate</th>
                </tr>
              </thead>
              <tbody>
                {(sourceQ.data ?? []).map((r: any) => (
                  <tr key={r.source} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.source}</td>
                    <td className="px-3 py-2 text-right">{r.applications}</td>
                    <td className="px-3 py-2 text-right">{r.hired}</td>
                    <td className="px-3 py-2 text-right">{r.hireRate}%</td>
                    <td className="px-3 py-2 text-right">{r.passed90dChecks}</td>
                    <td className="px-3 py-2 text-right font-semibold">{r.avg90dRating ?? "—"}</td>
                    <td className={`px-3 py-2 text-right ${r.atRiskRate > 20 ? "text-red-600 font-semibold" : ""}`}>{r.atRiskRate}%</td>
                  </tr>
                ))}
                {(sourceQ.data ?? []).length === 0 && (
                  <tr><td colSpan={7} className="px-3 py-6 text-center text-gray-400 text-sm">No data yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "sla" && (
          <>
            <div className="bg-white rounded-xl border p-4 mb-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                <Clock className="w-4 h-4 text-teal-600" /> Per-recruiter SLA breach counts
              </h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Recruiter</th>
                    <th className="text-right px-3 py-2">Open</th>
                    <th className="text-right px-3 py-2">Over SLA</th>
                    <th className="text-right px-3 py-2">Median hrs in stage</th>
                  </tr>
                </thead>
                <tbody>
                  {(slaQ.data?.recruiters ?? []).map((r: any) => (
                    <tr key={r.recruiter} className="border-t">
                      <td className="px-3 py-2 font-medium">{r.recruiter}</td>
                      <td className="px-3 py-2 text-right">{r.openApplications}</td>
                      <td className={`px-3 py-2 text-right ${r.overSla > 0 ? "text-red-600 font-semibold" : ""}`}>{r.overSla}</td>
                      <td className="px-3 py-2 text-right">{r.medianHours ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <h3 className="text-sm font-semibold mb-2">Applications over SLA</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                  <tr>
                    <th className="text-left px-3 py-2">Candidate</th>
                    <th className="text-left px-3 py-2">Job</th>
                    <th className="text-left px-3 py-2">Bucket</th>
                    <th className="text-left px-3 py-2">Recruiter</th>
                    <th className="text-right px-3 py-2">Hrs in stage</th>
                    <th className="text-right px-3 py-2">SLA</th>
                  </tr>
                </thead>
                <tbody>
                  {(slaQ.data?.applications ?? []).filter((a: any) => a.overSla).map((a: any) => (
                    <tr key={a.applicationId} className="border-t bg-red-50/30">
                      <td className="px-3 py-2 font-medium">{a.candidate}</td>
                      <td className="px-3 py-2">{a.jobTitle}</td>
                      <td className="px-3 py-2">{a.bucket}</td>
                      <td className="px-3 py-2">{a.recruiter ?? "—"}</td>
                      <td className="px-3 py-2 text-right font-semibold text-red-700">{a.hoursInStage}</td>
                      <td className="px-3 py-2 text-right">{a.slaHours}</td>
                    </tr>
                  ))}
                  {(slaQ.data?.applications ?? []).filter((a: any) => a.overSla).length === 0 && (
                    <tr><td colSpan={6} className="px-3 py-6 text-center text-emerald-600 font-medium text-sm">No SLA breaches — good work.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "checkins" && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600" /> Performance check-ins due
            </h3>
            <p className="text-xs text-gray-500 mb-4">
              Hired employees are due for 30/60/90/180-day performance check-ins by their line manager. Submit at the application detail page.
            </p>
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="text-left px-3 py-2">Candidate</th>
                  <th className="text-left px-3 py-2">Job</th>
                  <th className="text-right px-3 py-2">Days since hire</th>
                  <th className="text-right px-3 py-2">Milestones due</th>
                </tr>
              </thead>
              <tbody>
                {(checkinsQ.data ?? []).map((r: any) => (
                  <tr key={r.applicationId} className="border-t">
                    <td className="px-3 py-2 font-medium">{r.candidate}</td>
                    <td className="px-3 py-2">{r.jobTitle}</td>
                    <td className="px-3 py-2 text-right">{r.daysSinceHire}</td>
                    <td className="px-3 py-2 text-right font-semibold text-amber-700">
                      {r.dueMilestones.map((m: number) => `day ${m}`).join(", ")}
                    </td>
                  </tr>
                ))}
                {(checkinsQ.data ?? []).length === 0 && (
                  <tr><td colSpan={4} className="px-3 py-6 text-center text-emerald-600 font-medium text-sm">All check-ins up to date.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {tab === "feedback" && (
          <div className="bg-white rounded-xl border p-4">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-teal-600" /> Rejected-candidate feedback
            </h3>
            <p className="text-xs text-gray-500 mb-4">Every rejected candidate is asked how their application experience was — {feedbackQ.data?.total ?? 0} responses collected.</p>
            <div className="space-y-2 max-h-[600px] overflow-y-auto">
              {(feedbackQ.data?.responses ?? []).map((f: any) => (
                <div key={f.id} className="border rounded-lg p-3 text-sm">
                  <div className="text-xs text-gray-500 mb-1">{f.jobTitle} · {new Date(f.createdAt).toLocaleDateString()}</div>
                  <div className="whitespace-pre-wrap text-gray-800">{f.body.slice(0, 400)}</div>
                </div>
              ))}
              {(feedbackQ.data?.responses ?? []).length === 0 && (
                <div className="text-center text-sm text-gray-400 py-8">No feedback yet.</div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
