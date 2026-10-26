import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { ArrowLeft, Loader2, Star, Sparkles, AlertTriangle } from "lucide-react";

export const Route = createFileRoute("/admin/recruitment/compare")({
  validateSearch: (search: Record<string, unknown>) => ({
    ids: typeof search.ids === "string" ? search.ids : "",
  }),
  component: CompareCandidatesPage,
});

function parseIds(raw: string): number[] {
  return raw
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isFinite(n) && n > 0);
}

// aiStrengths / aiRedFlags are stored as a single string (semicolon / newline
// separated). Split into bullet items for display.
function splitLines(v: unknown): string[] {
  if (!v || typeof v !== "string") return [];
  return v
    .split(/\r?\n|\u2022|•|;|\|/)
    .map((s) => s.trim().replace(/^[-*]\s*/, ""))
    .filter((s) => s.length > 0);
}

function CompareCandidatesPage() {
  const { ids: raw } = Route.useSearch();
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const parsed = parseIds(raw);

  if (!token || !user) return null;

  const enabled = parsed.length >= 2 && parsed.length <= 6;
  const q = useQuery({
    ...trpc.compareApplications.queryOptions({ token, applicationIds: parsed }),
    enabled,
  });

  const data = q.data ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/admin/recruitment" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-lg font-semibold">Compare candidates</h1>
            <p className="text-xs text-gray-500">Side-by-side comparison of shortlisted applicants</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {!enabled && (
          <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">
            Select between 2 and 6 candidates to compare.
          </div>
        )}
        {enabled && q.isLoading && (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
          </div>
        )}
        {enabled && !q.isLoading && data.length === 0 && (
          <div className="bg-white rounded-xl border p-6 text-center text-sm text-gray-500">
            No matching applications found.
          </div>
        )}
        {enabled && data.length > 0 && (
          <div className="overflow-x-auto">
            <table className="w-full bg-white rounded-xl border overflow-hidden text-sm">
              <thead>
                <tr className="bg-gray-50 border-b">
                  <th className="p-3 text-left font-semibold text-gray-600 w-40 sticky left-0 bg-gray-50">Attribute</th>
                  {data.map((a) => (
                    <th key={a.id} className="p-3 text-left font-semibold text-gray-800 min-w-[220px]">
                      <Link
                        to="/admin/recruitment/applications/$appId"
                        params={{ appId: String(a.id) }}
                        className="hover:text-teal-600"
                      >
                        {a.firstName} {a.lastName}
                      </Link>
                      <div className="text-xs font-normal text-gray-500">
                        {a.job?.title} · {a.stageBucket.replace(/_/g, " ").toLowerCase()}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <Row label="Email">
                  {data.map((a) => <Cell key={a.id}>{a.email}</Cell>)}
                </Row>
                <Row label="Primary trade">
                  {data.map((a) => <Cell key={a.id}>{a.primaryTrade ?? "—"}</Cell>)}
                </Row>
                <Row label="Experience">
                  {data.map((a) => <Cell key={a.id}>{a.yearsExperience ? `${a.yearsExperience} yrs` : "—"}</Cell>)}
                </Row>
                <Row label="Qualifications">
                  {data.map((a) => <Cell key={a.id}>{a.qualifications ?? "—"}</Cell>)}
                </Row>
                <Row label="Expected salary">
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {a.expectedSalary != null ? `R${Number(a.expectedSalary).toLocaleString()}` : "—"}
                    </Cell>
                  ))}
                </Row>
                <Row label="Availability">
                  {data.map((a) => <Cell key={a.id}>{a.availability ?? "—"}</Cell>)}
                </Row>
                <Row label="AI match" highlight>
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {a.aiMatchScore != null ? (
                        <span
                          className={`inline-block px-2 py-0.5 rounded font-medium ${
                            a.aiMatchScore >= 70
                              ? "bg-emerald-100 text-emerald-700"
                              : a.aiMatchScore >= 50
                                ? "bg-amber-100 text-amber-700"
                                : "bg-red-100 text-red-700"
                          }`}
                        >
                          {Math.round(a.aiMatchScore)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Overall score" highlight>
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {a.overallScore != null ? Math.round(a.overallScore) : "—"}
                    </Cell>
                  ))}
                </Row>
                <Row label="Human score">
                  {data.map((a) => (
                    <Cell key={a.id}>{a.humanScore != null ? Math.round(a.humanScore) : "—"}</Cell>
                  ))}
                </Row>
                <Row label="Scorecard avg" highlight>
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {a.scorecardAverage != null ? (
                        <span className="flex items-center gap-1 font-medium">
                          <Star className="w-3 h-3 text-amber-500" />
                          {a.scorecardAverage.toFixed(1)}
                          <span className="text-xs text-gray-500">({a.scorecardCount})</span>
                        </span>
                      ) : (
                        <span className="text-gray-400">no scorecards</span>
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="Recommendations">
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {a.recommendations.length > 0 ? (
                        <div className="flex flex-wrap gap-1">
                          {a.recommendations.map((r, i) => (
                            <span
                              key={i}
                              className={`text-xs px-1.5 py-0.5 rounded ${
                                r === "STRONG_HIRE"
                                  ? "bg-emerald-100 text-emerald-700"
                                  : r === "HIRE"
                                    ? "bg-teal-100 text-teal-700"
                                    : r === "NO_HIRE"
                                      ? "bg-red-100 text-red-700"
                                      : "bg-gray-100 text-gray-700"
                              }`}
                            >
                              {r?.replace(/_/g, " ").toLowerCase()}
                            </span>
                          ))}
                        </div>
                      ) : (
                        "—"
                      )}
                    </Cell>
                  ))}
                </Row>
                <Row label="AI summary">
                  {data.map((a) => <Cell key={a.id}>{a.aiSummary ?? "—"}</Cell>)}
                </Row>
                <Row label="Strengths">
                  {data.map((a) => {
                    const items = splitLines(a.aiStrengths);
                    return (
                    <Cell key={a.id}>
                      {items.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          {items.map((s: string, i: number) => (
                            <li key={i} className="text-emerald-700">
                              <Sparkles className="w-3 h-3 inline mr-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </Cell>
                    );
                  })}
                </Row>
                <Row label="Red flags">
                  {data.map((a) => {
                    const items = splitLines(a.aiRedFlags);
                    return (
                    <Cell key={a.id}>
                      {items.length > 0 ? (
                        <ul className="list-disc list-inside space-y-0.5 text-xs">
                          {items.map((s: string, i: number) => (
                            <li key={i} className="text-red-700">
                              <AlertTriangle className="w-3 h-3 inline mr-0.5" />
                              {s}
                            </li>
                          ))}
                        </ul>
                      ) : (
                        "—"
                      )}
                    </Cell>
                    );
                  })}
                </Row>
                <Row label="Interviews / Attachments">
                  {data.map((a) => (
                    <Cell key={a.id}>
                      <span className="text-xs text-gray-500">
                        {a._count.interviewBookings} interviews · {a._count.attachments} files
                      </span>
                    </Cell>
                  ))}
                </Row>
                <Row label="Applied">
                  {data.map((a) => (
                    <Cell key={a.id}>
                      {new Date(a.createdAt).toLocaleDateString()}
                    </Cell>
                  ))}
                </Row>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({
  label, highlight = false, children,
}: { label: string; highlight?: boolean; children: React.ReactNode }) {
  return (
    <tr className={`border-b last:border-b-0 ${highlight ? "bg-teal-50/40" : ""}`}>
      <td className="p-3 font-medium text-gray-600 align-top sticky left-0 bg-inherit">{label}</td>
      {children}
    </tr>
  );
}

function Cell({ children }: { children: React.ReactNode }) {
  return <td className="p-3 align-top text-gray-800">{children}</td>;
}
