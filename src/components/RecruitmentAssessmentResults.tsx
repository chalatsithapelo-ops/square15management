import type { AssessmentSummary } from "~/utils/recruitmentAssessmentSummary";

const traits = [
  ["Openness", "Interest in new ideas and approaches"],
  ["Conscientiousness", "Organisation, care and follow-through"],
  ["Extraversion", "Social energy and assertiveness"],
  ["Agreeableness", "Cooperation and consideration"],
  ["Neuroticism", "Self-reported sensitivity to stress; not a diagnosis"],
] as const;
const dimensions = [
  ["E", "I", "Extraversion", "Introversion"],
  ["S", "N", "Sensing", "Intuition"],
  ["T", "F", "Thinking", "Feeling"],
  ["J", "P", "Judging", "Perceiving"],
] as const;

export function RecruitmentAssessmentResults({ assessments }: { assessments: AssessmentSummary[] }) {
  if (!assessments.length) return <p className="text-sm text-gray-400">No assessments yet</p>;
  return <div className="space-y-4">
    {assessments.map(a => {
      const results = (a.results ?? {}) as Record<string, any>;
      const personality = a.type === "MBTI" || a.type === "BIG_FIVE";
      const mbtiType = results.type ?? results.mbtiType;
      return <section key={a.type} className="border rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap justify-between gap-2 text-sm">
          <h4 className="font-semibold">{a.label}</h4>
          <span className={a.status === "Completed" ? "text-emerald-700" : "text-gray-600"}>{a.status}</span>
        </div>
        <div className="text-xs text-gray-500 flex flex-wrap gap-3">
          {a.total !== undefined && <span>{a.submitted}/{a.total} answers submitted</span>}
          {!personality && a.completedAt && a.score != null && <span className="font-semibold text-gray-800">{Math.round(a.score)}/100</span>}
          {a.completedAt && <span>Submitted {new Date(a.completedAt).toLocaleDateString()}</span>}
        </div>
        {a.completedAt && a.type === "BIG_FIVE" && <>
          <div className="space-y-3">{traits.map(([name, hint]) => {
            const value = results.factorPercentages?.[name] ?? results.factors?.[name]?.score;
            const available = typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100;
            return <div key={name}>
              <div className="flex justify-between text-sm"><span>{name}</span><span>{available ? `${Math.round(value)}/100` : "Unavailable"}</span></div>
              {available && <progress aria-label={name} value={value} max={100} className="w-full h-2 accent-teal-700" />}
              <p className="text-xs text-gray-500">{hint}</p>
            </div>;
          })}</div>
          <p className="text-xs text-gray-500">Trait scores reflect this questionnaire, not population percentiles or pass/fail grades. Higher is not always better.</p>
        </>}
        {a.completedAt && a.type === "MBTI" && <>
          <p className="text-lg font-semibold text-violet-700">{mbtiType ?? "Type unavailable"}</p>
          {results.description && <p className="text-sm text-gray-600">{results.description}</p>}
          {dimensions.map(([left, right, leftLabel, rightLabel]) => {
            const l = results.tallies?.[left]; const r = results.tallies?.[right];
            if (typeof l !== "number" || typeof r !== "number" || l < 0 || r < 0 || !Number.isFinite(l + r) || l + r === 0) return null;
            const pct = Math.round(l / (l + r) * 100);
            return <div key={left} className="text-xs text-gray-600"><div className="flex justify-between gap-2"><span>{leftLabel} {pct}%</span><span>{rightLabel} {100 - pct}%</span></div><progress aria-label={`${leftLabel} preference`} value={pct} max={100} className="w-full h-2 accent-violet-600" /></div>;
          })}
          <p className="text-xs text-gray-500">Preference indicators, not ability scores or a validated hiring recommendation.</p>
        </>}
      </section>;
    })}
    <p className="text-xs text-gray-500">Use personality responses to guide consistent, job-relevant interview questions. Confirm suitability through work samples, experience and structured human review; do not rank or reject candidates on personality alone.</p>
  </div>;
}