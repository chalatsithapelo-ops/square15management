import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { assertOpenCandidate, candidateWorkSampleInstructions, openCandidate, publicQuestions, requireAssessmentCamera, shuffle, validateResponses } from "~/server/services/recruitment/portalAssessment";
import { scoreIQ, scoreEQ, scoreMBTI, scoreBigFive } from "~/server/services/recruitment/scoringEngine";
import { maybeCompleteCandidateStage } from "./recruitmentExtras";

const sectionType = z.enum(["BEHAVIOUR", "IQ", "EQ", "MBTI", "BIG_FIVE", "WORK_SAMPLE"]);
const draftType = (type: string) => ["BEHAVIOUR", "WORK_SAMPLE"].includes(type) ? `PORTAL_DRAFT_${type}` : type;

export const candidateAssessmentPortal = baseProcedure.input(z.object({ accessToken: z.string() })).query(async ({ input }) => {
  const app = await openCandidate(input.accessToken);
  const [job, rows, interview, tasks, submissions, session, oldSession] = await Promise.all([
    app.jobId ? db.job.findUnique({ where: { id: app.jobId } }) : null,
    db.applicationAssessment.findMany({ where: { applicationId: app.id } }),
    db.applicationInterviewResponse.findMany({ where: { applicationId: app.id }, select: { questionIndex: true } }),
    app.jobId ? db.workSampleTask.findMany({ where: { jobId: app.jobId, active: true }, orderBy: { id: "asc" }, select: { id: true, title: true, instructions: true } }) : [],
    db.workSampleSubmission.findMany({ where: { applicationId: app.id }, select: { taskId: true, submittedAt: true } }),
    db.assessmentSession.findFirst({ where: { applicationId: app.id, finishedAt: null }, orderBy: { id: "desc" } }),
    db.assessmentSession.findFirst({ where: { applicationId: app.id }, orderBy: { id: "asc" } }),
  ]);
  const legacySession = Boolean(oldSession && oldSession.currentStep !== "PORTAL_OVERVIEW");
  const required = [
    (job?.requireInterview ?? true) && "BEHAVIOUR", job?.requireIQ && "IQ", job?.requireEQ && "EQ",
    job?.requireMBTI && "MBTI", job?.requireBigFive && "BIG_FIVE", tasks.length > 0 && "WORK_SAMPLE",
  ].filter(Boolean) as string[];
  return {
    session,
    sections: required.map(type => {
      const row = rows.find(r => r.type === draftType(type));
      const metadata = row?.results as any;
      // Keep started legacy sections stable; untouched sections get candidate-specific ordering.
      const started = Boolean(row && (row.completedAt || Object.keys((row.responses ?? {}) as object).length)) ||
        (type === "BEHAVIOUR" && interview.length > 0) || (type === "WORK_SAMPLE" && submissions.length > 0);
      const legacy = metadata?.portalVersion ? Boolean(metadata.legacy) : legacySession && started;
      const workQuestions = tasks.map(t => ({ id: String(t.id), text: `${t.title}\n\n${candidateWorkSampleInstructions(input.accessToken, t)}` }));
      const questions = type === "WORK_SAMPLE"
        ? legacy ? workQuestions : shuffle(workQuestions, `${input.accessToken}:WORK_SAMPLE:questions:v1`)
        : publicQuestions(type, input.accessToken, legacy);
      const answered = type === "BEHAVIOUR" ? interview.map(r => String(r.questionIndex)) : type === "WORK_SAMPLE" ? submissions.filter(s => s.submittedAt).map(s => String(s.taskId)) : [];
      return { type, questions, answered, complete: type === "BEHAVIOUR" || type === "WORK_SAMPLE" ? questions.every(q => answered.includes(q.id)) : Boolean(row?.completedAt), responses: row?.responses ?? {}, revision: metadata?.revision ?? 0, legacy };
    }),
  };
});

export const candidateSaveAssessmentDraft = baseProcedure.input(z.object({
  accessToken: z.string(), type: sectionType, revision: z.number().int().min(0), legacy: z.boolean(),
  responses: z.record(z.string(), z.union([z.string().max(20000), z.number()])),
})).mutation(async ({ input }) => {
  const app = await openCandidate(input.accessToken);
  return db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${app.id} FOR UPDATE`;
    assertOpenCandidate(await tx.application.findUnique({ where: { id: app.id } }));
    const row = await tx.applicationAssessment.findUnique({ where: { applicationId_type: { applicationId: app.id, type: draftType(input.type) } } });
    if (row?.completedAt) throw new TRPCError({ code: "CONFLICT", message: "Section already submitted" });
    const revision = (row?.results as any)?.revision ?? 0;
    if (revision !== input.revision) throw new TRPCError({ code: "CONFLICT", message: "Draft changed on another device. Reload before continuing." });
    // Persist ordering mode once, never let a resume change it.
    const firstSession = await tx.assessmentSession.findFirst({ where: { applicationId: app.id }, orderBy: { id: "asc" } });
    const started = Boolean(row && (row.completedAt || Object.keys((row.responses ?? {}) as object).length));
    const legacy = (row?.results as any)?.portalVersion ? Boolean((row?.results as any).legacy) :
      Boolean(firstSession && firstSession.currentStep !== "PORTAL_OVERVIEW" && (started || input.legacy));
    const job = app.jobId ? await tx.job.findUnique({ where: { id: app.jobId } }) : null;
    const required = input.type === "BEHAVIOUR" ? job?.requireInterview ?? true : input.type === "IQ" ? job?.requireIQ : input.type === "EQ" ? job?.requireEQ : input.type === "MBTI" ? job?.requireMBTI : input.type === "BIG_FIVE" ? job?.requireBigFive : true;
    if (!required) throw new TRPCError({ code: "BAD_REQUEST", message: "Section is not required for this application" });
    if (input.type !== "WORK_SAMPLE") validateResponses(publicQuestions(input.type, input.accessToken, legacy), input.responses);
    else {
      const tasks = app.jobId ? await tx.workSampleTask.findMany({ where: { jobId: app.jobId, active: true }, select: { id: true } }) : [];
      validateResponses(tasks.map(t => ({ id: String(t.id), text: "" })), input.responses);
    }
    const results = { portalVersion: 1, legacy, revision: revision + 1 };
    await tx.applicationAssessment.upsert({ where: { applicationId_type: { applicationId: app.id, type: draftType(input.type) } }, create: { applicationId: app.id, type: draftType(input.type), responses: input.responses, results }, update: { responses: input.responses, results } });
    return { revision: revision + 1 };
  });
});

export const candidateSubmitPortalAssessment = baseProcedure.input(z.object({ accessToken: z.string(), type: z.enum(["IQ", "EQ", "MBTI", "BIG_FIVE"]), revision: z.number().int() })).mutation(async ({ input }) => {
  const app = await openCandidate(input.accessToken);
  await requireAssessmentCamera(app.id);
  await db.$transaction(async tx => {
    await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${app.id} FOR UPDATE`;
    assertOpenCandidate(await tx.application.findUnique({ where: { id: app.id } }));
    const row = await tx.applicationAssessment.findUnique({ where: { applicationId_type: { applicationId: app.id, type: input.type } } });
    if (!row || row.completedAt || (row.results as any)?.revision !== input.revision) throw new TRPCError({ code: "CONFLICT", message: "Draft changed or already submitted. Reload to continue." });
    const responses = row.responses as Record<string, any>;
    validateResponses(publicQuestions(input.type, input.accessToken, Boolean((row.results as any)?.legacy)), responses, true);
    const score = input.type === "IQ" ? scoreIQ(responses) : input.type === "EQ" ? scoreEQ(responses) : input.type === "MBTI" ? scoreMBTI(responses) : scoreBigFive(responses);
    await tx.applicationAssessment.update({ where: { id: row.id }, data: { completedAt: new Date(), score: score.score, results: { ...score.results, ...(row.results as object) } } });
  });
  void maybeCompleteCandidateStage({ applicationId: app.id, accessToken: input.accessToken }).catch(error => console.warn("[portal-completion]", error));
  return { success: true };
});