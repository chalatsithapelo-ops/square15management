type Assessment = { type: string; score: number | null; results: unknown; completedAt: Date | string | null };
type Submission = { taskId: number; submittedAt: Date | string | null; aiScore?: number | null; humanScore?: number | null };
type InterviewAnswer = { questionIndex: number; aiScore?: number | null; createdAt: Date | string };

export type AssessmentSummary = Assessment & {
  label: string;
  status: "Not started" | "In progress" | "Submitted — awaiting review" | "Completed";
  submitted?: number;
  total?: number;
};

/** Draft rows are autosaves, not completion evidence. Derive progress from submissions. */
export function recruitmentAssessmentSummary(input: {
  assessments: Assessment[];
  interviewResponses: InterviewAnswer[];
  workSampleSubmissions: Submission[];
  activeTaskIds: number[];
  interviewQuestionCount: number;
  requireInterview: boolean;
}): AssessmentSummary[] {
  const labels: Record<string, string> = { IQ: "Cognitive aptitude", EQ: "Emotional intelligence", MBTI: "Personality preferences (MBTI-style)", BIG_FIVE: "Big Five personality" };
  const rows: AssessmentSummary[] = input.assessments.filter(a => !a.type.startsWith("PORTAL_DRAFT_") && !["WORK_SAMPLE", "BEHAVIOUR"].includes(a.type)).map(a => ({
    ...a, label: labels[a.type] ?? a.type,
    status: a.completedAt ? "Completed" : "In progress",
  }));
  const latest = (dates: (Date | string | null)[]) => dates.filter((d): d is Date | string => d != null).sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] ?? null;
  const aggregate = (type: string, label: string, scores: (number | null | undefined)[], total: number, completedAt: Date | string | null) => {
    const submitted = scores.length;
    const complete = total > 0 && submitted === total;
    const scored = scores.filter((s): s is number => typeof s === "number" && Number.isFinite(s));
    const hasDraft = input.assessments.some(a => a.type === `PORTAL_DRAFT_${type}`);
    rows.push({ type, label, results: null, submitted, total,
      completedAt: complete ? completedAt : null,
      score: complete && scored.length === total ? Math.round(scored.reduce((sum, s) => sum + s, 0) / total) : null,
      status: complete ? scored.length === total ? "Completed" : "Submitted — awaiting review" : submitted || hasDraft ? "In progress" : "Not started",
    });
  };
  if (input.activeTaskIds.length) {
    const tasks = [...new Set(input.activeTaskIds)];
    const submitted = tasks.flatMap(id => {
      const row = input.workSampleSubmissions.find(s => s.taskId === id && s.submittedAt);
      return row ? [row] : [];
    });
    aggregate("WORK_SAMPLE", "Work samples", submitted.map(s => s.humanScore ?? s.aiScore), tasks.length, latest(submitted.map(s => s.submittedAt)));
  }
  if (input.requireInterview || input.interviewResponses.length || input.assessments.some(a => a.type === "PORTAL_DRAFT_BEHAVIOUR")) {
    const answers = Array.from({ length: input.interviewQuestionCount }, (_, i) => input.interviewResponses.find(r => r.questionIndex === i)).filter((r): r is InterviewAnswer => Boolean(r));
    aggregate("BEHAVIOUR", "Behaviour interview", answers.map(r => r.aiScore), input.interviewQuestionCount, latest(answers.map(r => r.createdAt)));
  }
  return rows;
}