import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ArrowLeft, TrendingUp, AlertTriangle, Users, Shield } from "lucide-react";

export const Route = createFileRoute("/admin/recruitment/calibration")({
  component: CalibrationPage,
});

function CalibrationPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "MANAGER", "HR", "TECHNICAL_MANAGER", "JUNIOR_ADMIN", "RECRUITER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border max-w-md">
          <Shield className="w-12 h-12 text-red-400 mx-auto" />
          <h1 className="mt-3 text-lg font-semibold">Access Denied</h1>
          <Link to="/admin/dashboard" className="mt-4 inline-block text-sm text-teal-600 font-medium">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const q = useQuery(trpc.getInterviewerCalibration.queryOptions({ token }));
  const corrQ = useQuery(trpc.getCalibrationCorrelation.queryOptions({ token }));
  const data = q.data as any;
  const rows: any[] = data?.rows ?? [];
  const teamAvgQ = data?.teamAvgQuestion;
  const teamAvgSc = data?.teamAvgScorecard;
  const corr: any[] = corrQ.data ?? [];
  const corrByUser = new Map(corr.map((c) => [c.interviewerId, c]));

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-8">
      <div className="max-w-6xl mx-auto">
        <Link to="/admin/recruitment" className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 mb-2">
          <ArrowLeft className="w-4 h-4" /> Recruitment
        </Link>
        <h1 className="text-2xl font-bold flex items-center gap-2 mb-1">
          <TrendingUp className="w-6 h-6 text-teal-600" /> Interviewer calibration
        </h1>
        <p className="text-sm text-gray-500 mb-6">
          Per-interviewer scoring behaviour vs the team benchmark. Interviewers whose average sits &gt; 0.8 away from the team mean
          are flagged as outliers — retrain to reduce halo and severity bias.
        </p>

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Team avg question score (1–5)</div>
            <div className="text-2xl font-bold text-gray-900">{teamAvgQ ?? "—"}</div>
          </div>
          <div className="bg-white border rounded-xl p-4">
            <div className="text-xs text-gray-500 mb-1">Team avg scorecard rating (0–5)</div>
            <div className="text-2xl font-bold text-gray-900">{teamAvgSc ?? "—"}</div>
          </div>
        </div>

        {q.isLoading ? (
          <div className="bg-white border rounded-xl p-8 text-center text-gray-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="bg-white border rounded-xl p-10 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="mt-3 text-sm text-gray-600">No interviewer scores yet. Once recruiters start scoring interviews the calibration table will populate.</p>
          </div>
        ) : (
          <div className="bg-white border rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs uppercase">
                <tr>
                  <th className="text-left px-4 py-3">Interviewer</th>
                  <th className="text-right px-3 py-3">Candidates</th>
                  <th className="text-right px-3 py-3"># Q scores</th>
                  <th className="text-right px-3 py-3">Avg Q</th>
                  <th className="text-right px-3 py-3">Std Q</th>
                  <th className="text-right px-3 py-3">Avg SC</th>
                  <th className="text-right px-3 py-3">Std SC</th>
                  <th className="text-right px-3 py-3">Strong H / NH</th>
                  <th className="text-right px-3 py-3">Corr vs 90d</th>
                  <th className="text-center px-3 py-3">Flag</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const c = corrByUser.get(r.interviewerId) as any;
                  return (
                  <tr key={r.interviewerId} className="border-t">
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-3 py-3 text-right">{r.candidatesReviewed}</td>
                    <td className="px-3 py-3 text-right">{r.questionScoresCount}</td>
                    <td className="px-3 py-3 text-right font-semibold">{r.avgQuestionScore ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{r.stdevQuestionScore ?? "—"}</td>
                    <td className="px-3 py-3 text-right font-semibold">{r.avgScorecardRating ?? "—"}</td>
                    <td className="px-3 py-3 text-right">{r.stdevScorecardRating ?? "—"}</td>
                    <td className="px-3 py-3 text-right">
                      <span className="text-emerald-700 font-semibold">{r.strongHires}</span>
                      <span className="text-gray-400"> / </span>
                      <span className="text-red-700 font-semibold">{r.strongNoHires}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      {c?.correlation != null ? (
                        <span className={`font-semibold ${c.correlation >= 0.4 ? "text-emerald-700" : c.correlation >= 0.1 ? "text-amber-700" : "text-red-700"}`}>
                          {c.correlation}
                        </span>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                      <div className="text-[10px] text-gray-400">n={c?.pairsCount ?? 0}</div>
                    </td>
                    <td className="px-3 py-3 text-center">
                      {(r.outlierQuestion || r.outlierScorecard) ? (
                        <span className="inline-flex items-center gap-1 text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full font-semibold">
                          <AlertTriangle className="w-3 h-3" /> Outlier
                        </span>
                      ) : (
                        <span className="text-xs text-emerald-700">In band</span>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
