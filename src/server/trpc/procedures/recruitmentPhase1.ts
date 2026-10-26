/**
 * Phase-1 anti-fabrication: Work-sample tasks, structured interview kit,
 * red-flag scoring, and structured reference questionnaires.
 *
 * All procedures live here to keep the Phase-1 surface discoverable; they
 * are re-exported from root.ts.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import {
  assertRecruiter,
  assertHiringManager,
} from "~/server/services/recruitment/atsHelpers";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";
import { generateText } from "~/server/services/ai/controlledGeneration";
import { google } from "@ai-sdk/google";
import { candidateWorkSampleInstructions, openCandidate, requireAssessmentCamera } from "~/server/services/recruitment/portalAssessment";
import { maybeCompleteCandidateStage } from "./recruitmentExtras";

const model = google(process.env.RECRUITMENT_GEMINI_MODEL || "gemini-flash-latest");

// ═══════════════════════════════════════════════════════════════════════
// Work-sample tasks (admin CRUD)
// ═══════════════════════════════════════════════════════════════════════

const rubricSchema = z.object({
  scale: z.number().default(5),
  dimensions: z.array(
    z.object({
      code: z.string(),
      label: z.string(),
      weight: z.number().default(1),
      description: z.string().optional(),
    }),
  ),
});

export const createWorkSampleTask = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number(),
      title: z.string().min(3),
      instructions: z.string().min(10),
      timeLimitMinutes: z.number().min(5).max(240).default(60),
      rubric: rubricSchema,
      passingScore: z.number().min(0).max(100).default(60),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.workSampleTask.create({
      data: {
        jobId: input.jobId,
        title: input.title,
        instructions: input.instructions,
        timeLimitMinutes: input.timeLimitMinutes,
        rubric: input.rubric,
        passingScore: input.passingScore,
        createdById: user.id,
      },
    });
  });

export const updateWorkSampleTask = baseProcedure
  .input(
    z.object({
      token: z.string(),
      taskId: z.number(),
      title: z.string().min(3).optional(),
      instructions: z.string().min(10).optional(),
      timeLimitMinutes: z.number().min(5).max(240).optional(),
      rubric: rubricSchema.optional(),
      passingScore: z.number().min(0).max(100).optional(),
      active: z.boolean().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const { token, taskId, ...data } = input;
    return db.workSampleTask.update({ where: { id: taskId }, data });
  });

export const listWorkSampleTasks = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.workSampleTask.findMany({
      where: { jobId: input.jobId },
      orderBy: { createdAt: "desc" },
    });
  });

export const scoreWorkSampleSubmission = baseProcedure
  .input(
    z.object({
      token: z.string(),
      submissionId: z.number(),
      humanScore: z.number().min(0).max(100),
      humanFeedback: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const updated = await db.workSampleSubmission.update({
      where: { id: input.submissionId },
      data: {
        humanScore: input.humanScore,
        humanFeedback: input.humanFeedback,
        scoredById: user.id,
      },
    });
    // Refresh cached workSampleScore on Application.
    const subs = await db.workSampleSubmission.findMany({
      where: { applicationId: updated.applicationId, humanScore: { not: null } },
      select: { humanScore: true },
    });
    if (subs.length > 0) {
      const avg =
        subs.reduce((s, r) => s + (r.humanScore ?? 0), 0) / subs.length;
      await db.application.update({
        where: { id: updated.applicationId },
        data: { workSampleScore: avg },
      });
    }
    return updated;
  });

// ═══════════════════════════════════════════════════════════════════════
// Work-sample tasks (candidate portal)
// ═══════════════════════════════════════════════════════════════════════

export const candidateGetWorkSampleTasks = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: {
        id: true,
        jobId: true,
        deletedAt: true,
        accessTokenExpiresAt: true,
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED" });
    if (!app.jobId) return { tasks: [] };

    const tasks = await db.workSampleTask.findMany({
      where: { jobId: app.jobId, active: true },
      include: {
        submissions: {
          where: { applicationId: app.id },
          select: {
            id: true,
            submittedAt: true,
            startedAt: true,
            aiScore: true,
            humanScore: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    });
    return {
      tasks: tasks.map((t) => ({
        id: t.id,
        title: t.title,
        instructions: candidateWorkSampleInstructions(input.accessToken, t),
        timeLimitMinutes: t.timeLimitMinutes,
        submission: t.submissions[0] ?? null,
      })),
    };
  });

export const candidateStartWorkSample = baseProcedure
  .input(z.object({ accessToken: z.string(), taskId: z.number() }))
  .mutation(async ({ input }) => {
    const app = await openCandidate(input.accessToken);
    await requireAssessmentCamera(app.id);
    const task = await db.workSampleTask.findFirst({ where: { id: input.taskId, jobId: app.jobId ?? -1, active: true } });
    if (!task) throw new TRPCError({ code: "NOT_FOUND" });
    return db.workSampleSubmission.upsert({
      where: {
        taskId_applicationId: { taskId: input.taskId, applicationId: app.id },
      },
      create: {
        taskId: input.taskId,
        applicationId: app.id,
        startedAt: new Date(),
      },
      update: {},
    });
  });

export const candidateSubmitWorkSample = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      taskId: z.number(),
      answerText: z.string().min(1),
      attachments: z
        .array(
          z.object({
            label: z.string(),
            fileName: z.string(),
            fileUrl: z.string(),
            fileType: z.string().optional(),
          }),
        )
        .default([]),
      integritySignals: z.any().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await openCandidate(input.accessToken);
    await requireAssessmentCamera(app.id);

    const task = await db.workSampleTask.findUnique({
      where: { id: input.taskId },
      select: { id: true, title: true, instructions: true, rubric: true, jobId: true, active: true },
    });
    if (!task || task.jobId !== app.jobId || !task.active) throw new TRPCError({ code: "NOT_FOUND" });

    const existing = await db.workSampleSubmission.findUnique({
      where: {
        taskId_applicationId: { taskId: input.taskId, applicationId: app.id },
      },
      select: { startedAt: true, submittedAt: true },
    });
    if (existing?.submittedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This task has already been submitted.",
      });
    }
    const timeTakenSec = existing?.startedAt
      ? Math.round((Date.now() - existing.startedAt.getTime()) / 1000)
      : null;

    const created = await db.workSampleSubmission.upsert({
      where: {
        taskId_applicationId: { taskId: input.taskId, applicationId: app.id },
      },
      create: {
        taskId: input.taskId,
        applicationId: app.id,
        answerText: input.answerText,
        attachments: input.attachments,
        submittedAt: new Date(),
        timeTakenSec: timeTakenSec ?? undefined,
        integritySignals: input.integritySignals ?? undefined,
      },
      update: {
        answerText: input.answerText,
        attachments: input.attachments,
        submittedAt: new Date(),
        timeTakenSec: timeTakenSec ?? undefined,
        integritySignals: input.integritySignals ?? undefined,
      },
    });

    // AI-writing detection (Tier 1 #3 cheating defense). Fire-and-forget.
    void (async () => {
      try {
        const detectPrompt = `Rate 0-100 the likelihood the following text was written by an AI language model (like ChatGPT). Look for: formal textbook register with no colloquialisms; no typos; uniform paragraph structure; generic examples without specific details (dates, names, brands, tools); absence of South African trade jargon or slang; no hedging words like "I think" / "usually"; overly smooth transitions.\n\nText:\n${input.answerText.slice(0, 4000)}\n\nReturn ONLY compact JSON: {"aiLikelihood": <0-100>, "signals": ["<short list of specific signals>"]}`;
        const { text: detText } = await generateText({
          aiFeature: "recruitment.workSampleIntegrity",
          model,
          system: "You are a strict AI-generated text detector. Be conservative — only rate high if strongly confident.",
          prompt: detectPrompt,
          maxTokens: 400,
        });
        const dm = detText.match(/\{[\s\S]*\}/);
        if (dm) {
          const parsed = JSON.parse(dm[0]) as { aiLikelihood?: number; signals?: string[] };
          await db.workSampleSubmission.update({
            where: { id: created.id },
            data: {
              aiWritingScore: typeof parsed.aiLikelihood === "number"
                ? Math.max(0, Math.min(100, parsed.aiLikelihood))
                : null,
              aiWritingSignals: parsed.signals ? { signals: parsed.signals } : undefined,
            },
          });
        }
      } catch (e) {
        console.warn("[workSample] AI-writing detection failed:", e);
      }
    })();

    void (async () => {
      try {
        const rubric = task.rubric as any;
        const dims = (rubric?.dimensions ?? [])
          .map((d: any) => `- ${d.label} (${d.weight ?? 1}x): ${d.description ?? ""}`)
          .join("\n");
        const prompt = [
          `Task: ${task.title}`,
          `Instructions: ${candidateWorkSampleInstructions(input.accessToken, task)}`,
          `Rubric dimensions:\n${dims}`,
          `Candidate answer: ${input.answerText.slice(0, 4000)}`,
        ].join("\n\n");
        const { text } = await generateText({
          aiFeature: "recruitment.workSampleScoring",
          model,
          system:
            "You are an expert South African recruiter for Square 15 Facility Solutions " +
            "evaluating a candidate's work-sample submission. Return ONLY a compact JSON " +
            'object {"score": <0-100>, "feedback": "<2-3 short sentences>"}. Be honest and rigorous.',
          prompt,
          maxTokens: 800,
        });
        const m = text.match(/\{[\s\S]*\}/);
        if (m) {
          const parsed = JSON.parse(m[0]) as { score?: number; feedback?: string };
          await db.workSampleSubmission.update({
            where: { id: created.id },
            data: {
              aiScore:
                typeof parsed.score === "number"
                  ? Math.max(0, Math.min(100, parsed.score))
                  : null,
              aiFeedback: parsed.feedback ?? null,
            },
          });
        }
      } catch (e) {
        console.warn("[workSample] AI scoring failed:", e);
      }
    })();

    // Fire the shared "everything done?" gate. If this was the last thing
    // pending (all psychometrics + all active work samples), the candidate
    // gets the ASSESSMENT_COMPLETE email and the pipeline auto-advances.
    try {
      void maybeCompleteCandidateStage({
        applicationId: app.id,
        accessToken: input.accessToken,
      });
    } catch {}

return { success: true, submissionId: created.id };
  });

// ═══════════════════════════════════════════════════════════════════════
// Structured interview kit
// ═══════════════════════════════════════════════════════════════════════

export const upsertInterviewQuestionBank = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number(),
      description: z.string().optional(),
      questions: z.array(
        z.object({
          id: z.number().optional(),
          order: z.number().default(0),
          competency: z.string(),
          question: z.string().min(10),
          rubric: z.record(z.string(), z.string()),
          weight: z.number().default(1),
          requireEvidence: z.boolean().default(true),
        }),
      ),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const bank = await db.interviewQuestionBank.upsert({
      where: { jobId: input.jobId },
      create: { jobId: input.jobId, description: input.description },
      update: { description: input.description },
    });
    // Naive replace strategy for MVP.
    await db.interviewQuestion.deleteMany({ where: { bankId: bank.id } });
    for (const q of input.questions) {
      await db.interviewQuestion.create({
        data: {
          bankId: bank.id,
          order: q.order,
          competency: q.competency,
          question: q.question,
          rubric: q.rubric,
          weight: q.weight,
          requireEvidence: q.requireEvidence,
        },
      });
    }
    return db.interviewQuestionBank.findUnique({
      where: { id: bank.id },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  });

export const getInterviewQuestionBank = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.interviewQuestionBank.findUnique({
      where: { jobId: input.jobId },
      include: { questions: { orderBy: { order: "asc" } } },
    });
  });

export const scoreInterviewQuestion = baseProcedure
  .input(
    z.object({
      token: z.string(),
      questionId: z.number(),
      applicationId: z.number(),
      score: z.number().min(1).max(5),
      evidence: z.string().min(20),
      specificExample: z.boolean(),
      personalRole: z.boolean(),
      measurableOutcome: z.boolean(),
      probeNotes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const question = await db.interviewQuestion.findUnique({
      where: { id: input.questionId },
      select: { requireEvidence: true },
    });
    if (question?.requireEvidence && input.evidence.trim().length < 20) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Please provide at least 20 characters of evidence for this rating.",
      });
    }
    return db.interviewQuestionScore.create({
      data: {
        questionId: input.questionId,
        applicationId: input.applicationId,
        interviewerId: user.id,
        score: input.score,
        evidence: input.evidence,
        specificExample: input.specificExample,
        personalRole: input.personalRole,
        measurableOutcome: input.measurableOutcome,
        probeNotes: input.probeNotes,
      },
    });
  });

export const listInterviewQuestionScores = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.interviewQuestionScore.findMany({
      where: { applicationId: input.applicationId },
      include: {
        question: { select: { competency: true, question: true, weight: true } },
        interviewer: { select: { id: true, firstName: true, lastName: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// Red-flag scoring
// ═══════════════════════════════════════════════════════════════════════

export type RedFlagSignal = {
  code: string;
  label: string;
  weight: number;
  evidence?: string;
};

export async function computeRedFlagScore(applicationId: number): Promise<{
  score: number;
  signals: RedFlagSignal[];
}> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      assessments: true,
      interviewResponses: true,
      referenceChecks: { include: { questionnaire: true } },
      workSampleSubmissions: {
        include: { task: { select: { passingScore: true } } },
      },
    },
  });
  if (!app) return { score: 0, signals: [] };

  const signals: RedFlagSignal[] = [];
  const push = (code: string, label: string, weight: number, evidence?: string) => {
    signals.push({ code, label, weight, evidence });
  };

  const bigFive = app.assessments.find((a) => a.type === "BIG_FIVE");
  const bfResults = bigFive?.results as any;
  const conscientiousness = bfResults?.factorPercentages?.Conscientiousness;
  if (typeof conscientiousness === "number" && conscientiousness < 55) {
    push(
      "LOW_CONSCIENTIOUSNESS",
      "Big Five Conscientiousness below 55",
      15,
      `Score: ${conscientiousness}/100`,
    );
  }

  const scoredInterview = app.interviewResponses.filter(r => r.aiScore != null);
  const interviewAvg = scoredInterview.length
    ? (scoredInterview.reduce((s, r) => s + r.aiScore!, 0) /
        scoredInterview.length) *
      10
    : null;
  if (interviewAvg != null && interviewAvg < 40) {
    push(
      "WEAK_INTERVIEW",
      "AI behaviour interview average below 40",
      20,
      `Average: ${Math.round(interviewAvg)}/100`,
    );
  }

  for (const sub of app.workSampleSubmissions) {
    const s = sub.humanScore ?? sub.aiScore ?? null;
    const pass = sub.task?.passingScore ?? 60;
    if (s != null && s < pass) {
      push(
        "FAILED_WORK_SAMPLE",
        `Work sample scored below role threshold (${Math.round(s)}/${pass})`,
        25,
      );
    }
  }

  const rehireIssues = app.referenceChecks.filter(
    (rc) =>
      rc.questionnaire?.rehireRating != null && rc.questionnaire.rehireRating < 8,
  );
  for (const rc of rehireIssues) {
    push(
      "REFERENCE_CONCERN",
      `Referee ${rc.refereeName} would-rehire below 8`,
      20,
      `Rating: ${rc.questionnaire?.rehireRating}/10`,
    );
  }

  if (app.aiMatchScore != null && app.aiMatchScore < 40) {
    push(
      "LOW_AI_MATCH",
      "AI job-match score below 40",
      10,
      `Score: ${Math.round(app.aiMatchScore)}/100`,
    );
  }

  if (!app.qualifications || app.qualifications.trim().length < 20) {
    push(
      "SPARSE_QUALIFICATIONS",
      "Qualifications field is missing or very short",
      5,
    );
  }

  const totalWeight = signals.reduce((s, x) => s + x.weight, 0);
  const score = Math.min(100, totalWeight);

  await db.application.update({
    where: { id: applicationId },
    data: {
      redFlagScore: score,
      redFlagSignals: signals as any,
    },
  });
  return { score, signals };
}

export const recomputeRedFlagScore = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return computeRedFlagScore(input.applicationId);
  });

// ═══════════════════════════════════════════════════════════════════════
// Structured reference-check questionnaire
// ═══════════════════════════════════════════════════════════════════════

export const sendReferenceQuestionnaire = baseProcedure
  .input(
    z.object({
      token: z.string(),
      referenceCheckId: z.number(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const rc = await db.referenceCheck.findUnique({
      where: { id: input.referenceCheckId },
      include: {
        application: {
          select: {
            firstName: true,
            lastName: true,
            job: { select: { title: true } },
          },
        },
      },
    });
    if (!rc) throw new TRPCError({ code: "NOT_FOUND" });

    await db.referenceQuestionnaire.upsert({
      where: { referenceCheckId: rc.id },
      create: { referenceCheckId: rc.id, sentAt: new Date() },
      update: { sentAt: new Date() },
    });

    const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(
      /\/+$/,
      "",
    );
    const link = `${origin}/reference/${rc.token}`;
    const candidateName = `${rc.application.firstName} ${rc.application.lastName}`;
    const jobTitle = rc.application.job?.title ?? "a role";

    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#2D5016;">Reference request for ${candidateName}</h1>
    <p style="margin:0 0 12px 0;color:#374151;">Hi ${rc.refereeName},</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">${candidateName} has applied for ${jobTitle} at Square 15 Facility Solutions and provided you as a referee. We'd greatly appreciate you completing a short 5-question form. It takes about 3 minutes.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">Your responses are confidential and used only for hiring purposes in accordance with POPIA.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:8px;font-weight:600;">Provide reference &rarr;</a>
    </div>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">Or paste this link: <a href="${link}" style="color:#2D5016;">${link}</a></p>
  </div>
</body></html>`;

    await sendCandidateEmail({
      applicationId: 0,
      to: rc.refereeEmail,
      subject: `Reference request for ${candidateName} — Square 15 Facility Solutions`,
      templateKey: "REFERENCE_REQUEST",
      sentById: user.id,
      html,
    });
    await db.referenceCheck.update({
      where: { id: rc.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { success: true, link };
  });

export const getReferenceQuestionnaireByToken = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const rc = await db.referenceCheck.findUnique({
      where: { token: input.token },
      include: {
        application: {
          select: {
            firstName: true,
            lastName: true,
            job: { select: { title: true } },
          },
        },
        questionnaire: true,
      },
    });
    if (!rc) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      refereeName: rc.refereeName,
      candidateName: `${rc.application.firstName} ${rc.application.lastName}`,
      jobTitle: rc.application.job?.title ?? "",
      completed: !!rc.questionnaire?.completedAt,
    };
  });

export const submitReferenceQuestionnaire = baseProcedure
  .input(
    z.object({
      token: z.string(),
      rehireRating: z.number().min(1).max(10),
      topStrength: z.string().min(3),
      developmentArea: z.string().min(3),
      attendanceRating: z.number().min(1).max(5),
      conflictHandlingRating: z.number().min(1).max(5),
      additionalComments: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const rc = await db.referenceCheck.findUnique({
      where: { token: input.token },
      include: { questionnaire: true },
    });
    if (!rc) throw new TRPCError({ code: "NOT_FOUND" });
    if (rc.questionnaire?.completedAt) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This questionnaire has already been submitted.",
      });
    }
    const concernFlagged = input.rehireRating < 8;
    await db.referenceQuestionnaire.upsert({
      where: { referenceCheckId: rc.id },
      create: {
        referenceCheckId: rc.id,
        completedAt: new Date(),
        rehireRating: input.rehireRating,
        topStrength: input.topStrength,
        developmentArea: input.developmentArea,
        attendanceRating: input.attendanceRating,
        conflictHandlingRating: input.conflictHandlingRating,
        additionalComments: input.additionalComments,
        concernFlagged,
      },
      update: {
        completedAt: new Date(),
        rehireRating: input.rehireRating,
        topStrength: input.topStrength,
        developmentArea: input.developmentArea,
        attendanceRating: input.attendanceRating,
        conflictHandlingRating: input.conflictHandlingRating,
        additionalComments: input.additionalComments,
        concernFlagged,
      },
    });
    await db.referenceCheck.update({
      where: { id: rc.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        rating: input.rehireRating,
      },
    });
    void computeRedFlagScore(rc.applicationId).catch(() => {});
    return { success: true, concernFlagged };
  });
