import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { BarChart3, Users, Clock, Target, TrendingUp, Shield, Sparkles, ArrowLeft } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/admin/recruitment/analytics")({
  component: AnalyticsPage,
});

const COLORS = ["#0d9488", "#6366f1", "#f59e0b", "#ef4444", "#10b981", "#8b5cf6", "#06b6d4"];

function AnalyticsPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  if (!token || !user) return null;

  const funnelQ = useQuery(trpc.analyticsFunnel.queryOptions({ token }));
  const timeInStageQ = useQuery(trpc.analyticsTimeInStage.queryOptions({ token }));
  const timeToFillQ = useQuery(trpc.analyticsTimeToFill.queryOptions({ token }));
  const sourcesQ = useQuery(trpc.analyticsSourceROI.queryOptions({ token }));
  const rejQ = useQuery(trpc.analyticsRejectionReasons.queryOptions({ token }));
  const adverseQ = useQuery(trpc.analyticsAdverseImpact.queryOptions({ token }));
  const eeaQ = useQuery(trpc.analyticsEEA.queryOptions({ token }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/admin/recruitment/jobs" className="text-gray-500 hover:text-gray-700"><ArrowLeft className="w-5 h-5" /></Link>
          <h1 className="text-lg font-semibold flex items-center gap-2"><BarChart3 className="w-5 h-5 text-teal-600" /> Recruitment analytics</h1>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Headline KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Kpi icon={<Users />} label="Applicants" value={funnelQ.data?.totalApplicants ?? 0} />
          <Kpi icon={<Target />} label="Hired" value={funnelQ.data?.hired ?? 0} color="emerald" />
          <Kpi icon={<Clock />} label="Avg time to fill" value={`${Math.round(timeToFillQ.data?.avgDays ?? 0)}d`} color="indigo" />
          <Kpi icon={<TrendingUp />} label="Hire rate" value={funnelQ.data?.totalApplicants ? `${Math.round(((funnelQ.data.hired ?? 0) / funnelQ.data.totalApplicants) * 100)}%` : "—"} color="amber" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card title="Funnel">
            {funnelQ.data?.funnel?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelQ.data.funnel}>
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0d9488" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
          <Card title="Time in stage (median hours)">
            {timeInStageQ.data?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={timeInStageQ.data}>
                  <XAxis dataKey="stage" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Bar dataKey="medianHours" fill="#6366f1" />
                </BarChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>

          <Card title="Sources (conversion to hire)">
            {sourcesQ.data?.length ? (
              <div className="space-y-2">
                {sourcesQ.data.map((s: any) => (
                  <div key={s.source} className="flex items-center justify-between text-sm border rounded-lg p-2">
                    <span className="font-medium">{s.source}</span>
                    <div className="text-right">
                      <div>{s.hired}/{s.applicants} hired</div>
                      <div className="text-xs text-gray-500">{Math.round(s.conversionRate * 100)}% conversion</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : <Empty />}
          </Card>

          <Card title="Rejection reasons">
            {rejQ.data?.length ? (
              <ResponsiveContainer width="100%" height={260}>
                <PieChart>
                  <Pie data={rejQ.data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={80} label>
                    {rejQ.data.map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            ) : <Empty />}
          </Card>
        </div>

        <Card title="Adverse impact analysis (4/5ths rule, by gender)" icon={<Shield className="w-4 h-4 text-amber-600" />}>
          {adverseQ.data?.groups?.length ? (
            <div>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="text-left p-2">Group</th>
                    <th className="text-right p-2">Applicants</th>
                    <th className="text-right p-2">Hired</th>
                    <th className="text-right p-2">Selection rate</th>
                    <th className="text-right p-2">Impact ratio</th>
                  </tr>
                </thead>
                <tbody>
                  {adverseQ.data.groups.map((g: any) => (
                    <tr key={g.group} className="border-t">
                      <td className="p-2 font-medium">{g.group}</td>
                      <td className="p-2 text-right">{g.total}</td>
                      <td className="p-2 text-right">{g.hired}</td>
                      <td className="p-2 text-right">{(g.rate * 100).toFixed(1)}%</td>
                      <td className={`p-2 text-right font-medium ${g.adverseImpact ? "text-red-600" : "text-emerald-600"}`}>
                        {(g.selectionRatio * 100).toFixed(0)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {adverseQ.data.flagged && adverseQ.data.flagged.length > 0 && (
                <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-800">
                  ⚠ Possible adverse impact detected (selection rate for one group less than 80% of the highest).
                </div>
              )}
            </div>
          ) : <Empty />}
        </Card>

        <Card title="EEA snapshot (South Africa)" icon={<Sparkles className="w-4 h-4 text-violet-600" />}>
          {eeaQ.data ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              {Object.entries(eeaQ.data.byRace ?? {}).map(([k, v]) => (
                <div key={k} className="border rounded-lg p-2">
                  <div className="text-xs text-gray-500">{k}</div>
                  <div className="font-semibold">{v as any}</div>
                </div>
              ))}
            </div>
          ) : <Empty />}
        </Card>
      </div>
    </div>
  );
}

function Kpi({ icon, label, value, color = "teal" }: any) {
  return (
    <div className="bg-white rounded-xl border p-4">
      <div className={`w-8 h-8 rounded-lg bg-${color}-50 text-${color}-600 flex items-center justify-center mb-2`}>
        {icon}
      </div>
      <div className="text-xs text-gray-500">{label}</div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  );
}

function Card({ title, children, icon }: any) {
  return (
    <div className="bg-white rounded-xl border p-5">
      <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">{icon}{title}</h3>
      {children}
    </div>
  );
}

function Empty() { return <div className="text-sm text-gray-400 py-8 text-center">No data yet</div>; }
