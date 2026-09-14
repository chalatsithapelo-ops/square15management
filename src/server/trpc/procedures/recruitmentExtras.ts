/**
 * Recruitment 2.0 — Candidate portal, Talent pool, Compliance, Analytics.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";
import {
  assertRecruiter,
  assertAdmin,
  assertHiringManager,
  logConsent,
  recomputeApplicationScore,
  transitionApplication,
} from "~/server/services/recruitment/atsHelpers";
import {
  getFunnelReport,
  getTimeInStageReport,
  getTimeToFill,
  getSourceROI,
  getRejectionReasonBreakdown,
  getAdverseImpactReport,
  getEEAReport,
  getRecruiterDashboard,
} from "~/server/services/recruitment/analytics";
import {
  IQ_QUESTIONS,
  EQ_QUESTIONS,
  MBTI_QUESTIONS,
  BIG_FIVE_QUESTIONS,
  INTERVIEW_QUESTIONS_TEMPLATE,
} from "~/server/services/recruitment/assessmentQuestions";
import {
  scoreIQ,
  scoreEQ,
  scoreMBTI,
  scoreBigFive,
  scoreInterviewAnswer,
} from "~/server/services/recruitment/scoringEngine";
import {
  autoRequestReferences,
  notifyReferrerOnHired,
  logAiDecision,
} from "~/server/services/recruitment/atsAutomation";

// ═══════════════════════════════════════════════════════════════════════
// CANDIDATE PORTAL (public — token)
// ═══════════════════════════════════════════════════════════════════════

export const candidateDashboard = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        job: { select: { title: true, department: true, location: true } },
        stageHistory: {
          orderBy: { createdAt: "asc" },
          include: { toStage: { select: { name: true } } },
        },
        interviewBookings: {
          where: { status: { in: ["SCHEDULED", "COMPLETED"] } },
          orderBy: { scheduledStart: "desc" },
        },
        offers: {
          where: { status: { in: ["SENT", "VIEWED", "ACCEPTED", "DECLINED"] } },
          select: { id: true, title: true, status: true, signToken: true, expiresAt: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date()) {
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    }
    return {
      firstName: app.firstName,
      lastName: app.lastName,
      email: app.email,
      job: app.job,
      stageBucket: app.stageBucket,
      overallScore: app.overallScore,
      createdAt: app.createdAt,
      timeline: app.stageHistory,
      upcomingInterviews: app.interviewBookings,
      offers: app.offers,
      messages: app.messages,
    };
  });

export const candidateSendMessage = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      subject: z.string().optional(),
      body: z.string().min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true, assignedRecruiterId: true, deletedAt: true, accessTokenExpiresAt: true },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED" });
    return db.applicationMessage.create({
      data: {
        applicationId: app.id,
        channel: "PORTAL",
        direction: "INBOUND",
        subject: input.subject,
        body: input.body,
      },
    });
  });

export const candidateWithdraw = baseProcedure
  .input(z.object({ accessToken: z.string(), reason: z.string().optional() }))
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    await db.application.update({
      where: { id: app.id },
      data: {
        withdrawnAt: new Date(),
        withdrawnReason: input.reason,
        stageBucket: "WITHDRAWN",
      },
    });
    await db.applicationStageHistory.create({
      data: {
        applicationId: app.id,
        bucket: "WITHDRAWN",
        reason: input.reason ?? "Candidate withdrew",
      },
    });
    return { success: true };
  });

// ═══════════════════════════════════════════════════════════════════════
// TALENT POOL
// ═══════════════════════════════════════════════════════════════════════

export const createTalentPool = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
      description: z.string().optional(),
      tags: z.array(z.string()).default([]),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.talentPool.create({
      data: {
        name: input.name,
        description: input.description,
        tags: input.tags,
        createdById: user.id,
      },
    });
  });

export const listTalentPools = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.talentPool.findMany({
      include: { _count: { select: { members: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

export const addToTalentPool = baseProcedure
  .input(
    z.object({
      token: z.string(),
      poolId: z.number(),
      applicationId: z.number(),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.talentPoolMembership.upsert({
      where: { poolId_applicationId: { poolId: input.poolId, applicationId: input.applicationId } },
      create: {
        poolId: input.poolId,
        applicationId: input.applicationId,
        addedById: user.id,
        notes: input.notes,
      },
      update: { notes: input.notes },
    });
  });

export const rediscoverCandidates = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number(),
      minScore: z.number().default(60),
      daysBack: z.number().default(365),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: { category: true },
    });
    const since = new Date();
    since.setDate(since.getDate() - input.daysBack);
    const where: any = {
      deletedAt: null,
      overallScore: { gte: input.minScore },
      createdAt: { gte: since },
      stageBucket: { in: ["REJECTED", "WITHDRAWN"] },
    };
    if (job?.category) where.primaryTrade = job.category;
    return db.application.findMany({
      where: where as any,
      orderBy: { overallScore: "desc" },
      take: 50,
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        primaryTrade: true,
        overallScore: true,
        stageBucket: true,
        createdAt: true,
      },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// COMPLIANCE — DSAR, deletion, demographics, adverse impact, EEA
// ═══════════════════════════════════════════════════════════════════════

export const setDemographicProfile = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      race: z.string().optional(),
      gender: z.string().optional(),
      disability: z.string().optional(),
      nationality: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    return db.demographicProfile.upsert({
      where: { applicationId: app.id },
      create: { applicationId: app.id, ...input },
      update: { ...input },
    });
  });

export const requestDataDeletion = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true, email: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    await logConsent({
      applicationId: app.id,
      action: "DELETION_REQUEST",
      version: "1.0",
    });
    // Soft delete — admin will hard-delete after verification
    await db.application.update({
      where: { id: app.id },
      data: { deletedAt: new Date() },
    });
    return { success: true };
  });

export const exportMyData = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        assessments: true,
        interviewResponses: true,
        stageHistory: true,
        offers: true,
        messages: true,
        consentEvents: true,
        demographicProfile: true,
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    await logConsent({
      applicationId: app.id,
      action: "DSAR_REQUEST",
      version: "1.0",
    });
    return app;
  });

export const hardDeleteApplication = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertAdmin(user);
    await db.application.delete({ where: { id: input.applicationId } });
    return { success: true };
  });

export const complianceAuditLog = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = {};
    if (input.applicationId) where.applicationId = input.applicationId;
    return db.consentEvent.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        application: { select: { firstName: true, lastName: true, email: true } },
      },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// ANALYTICS
// ═══════════════════════════════════════════════════════════════════════

export const analyticsFunnel = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number().optional(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getFunnelReport(input);
  });

export const analyticsTimeInStage = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getTimeInStageReport(input);
  });

export const analyticsTimeToFill = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getTimeToFill(input.jobId);
  });

export const analyticsSourceROI = baseProcedure
  .input(
    z.object({
      token: z.string(),
      fromDate: z.date().optional(),
      toDate: z.date().optional(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getSourceROI(input);
  });

export const analyticsRejectionReasons = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getRejectionReasonBreakdown(input.jobId);
  });

export const analyticsAdverseImpact = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return getAdverseImpactReport({ jobId: input.jobId });
  });

export const analyticsEEA = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return getEEAReport({ jobId: input.jobId });
  });

export const analyticsRecruiterDashboard = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return getRecruiterDashboard(user.id);
  });

// ═══════════════════════════════════════════════════════════════════════
// CANDIDATE AI BEHAVIOUR INTERVIEW (public — token-based, ATS 2.0)
// ═══════════════════════════════════════════════════════════════════════

export const candidateGetInterviewQuestions = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: {
        id: true,
        firstName: true,
        primaryTrade: true,
        deletedAt: true,
        stageBucket: true,
        accessTokenExpiresAt: true,
        job: { select: { requireInterview: true, title: true } },
        interviewResponses: {
          select: { questionIndex: true, aiScore: true, createdAt: true },
        },
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });

    const required = app.job?.requireInterview ?? true;
    const answeredIndices = new Set(app.interviewResponses.map((r) => r.questionIndex));
    return {
      required,
      jobTitle: app.job?.title ?? null,
      total: INTERVIEW_QUESTIONS_TEMPLATE.length,
      answeredCount: answeredIndices.size,
      complete: answeredIndices.size >= INTERVIEW_QUESTIONS_TEMPLATE.length,
      questions: INTERVIEW_QUESTIONS_TEMPLATE.map((q, i) => ({
        index: i,
        dimension: q.dimension,
        question: q.question,
        answered: answeredIndices.has(i),
      })),
    };
  });

export const candidateSubmitInterviewAnswer = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      questionIndex: z.number().int().min(0).max(INTERVIEW_QUESTIONS_TEMPLATE.length - 1),
      answer: z
        .string()
        .min(20, "Please provide a more detailed answer (at least 20 characters)")
        .max(4000),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: {
        id: true,
        primaryTrade: true,
        deletedAt: true,
        stageBucket: true,
        accessTokenExpiresAt: true,
        interviewResponses: { select: { questionIndex: true } },
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    if (app.stageBucket === "WITHDRAWN" || app.stageBucket === "REJECTED")
      throw new TRPCError({ code: "BAD_REQUEST", message: "Application is closed" });
    if (app.interviewResponses.some((r) => r.questionIndex === input.questionIndex))
      throw new TRPCError({ code: "BAD_REQUEST", message: "This question has already been answered" });

    const template = INTERVIEW_QUESTIONS_TEMPLATE[input.questionIndex];
    if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid question index" });

    const ai = await scoreInterviewAnswer(
      template.question,
      input.answer,
      template.dimension,
      app.primaryTrade ?? "general",
    );

    await db.applicationInterviewResponse.create({
      data: {
        applicationId: app.id,
        questionIndex: input.questionIndex,
        question: template.question,
        answer: input.answer,
        aiScore: ai.score,
        aiAnalysis: ai.analysis,
        dimensions: ai.dimensions,
      },
    });

    const answeredCount = app.interviewResponses.length + 1;
    const isComplete = answeredCount >= INTERVIEW_QUESTIONS_TEMPLATE.length;

    // When last answer submitted, recompute the overall score and advance
    // the pipeline stage. Fire-and-forget so the candidate isn't blocked.
    if (isComplete) {
      (async () => {
        try {
          await recomputeApplicationScore(app.id);
          const scored = await db.application.findUnique({
            where: { id: app.id },
            select: { overallScore: true, aiMatchScore: true, stageBucket: true },
          });
          const overall = scored?.overallScore ?? 0;
          logAiDecision({
            applicationId: app.id,
            action: "INTERVIEW_COMPLETE_RECOMPUTED",
            score: overall,
            reason: `Interview complete, overall score ${Math.round(overall)}`,
          });
          // Only advance if candidate hasn't been rejected/withdrawn/hired
          if (
            scored &&
            ["APPLIED", "SCREENING", "ASSESSMENT"].includes(scored.stageBucket)
          ) {
            const nextBucket = overall >= 70 ? "INTERVIEW" : overall >= 40 ? "SCREENING" : "SCREENING";
            await transitionApplication({
              applicationId: app.id,
              toBucket: nextBucket as any,
              reason: `Auto-advance after interview (overall ${Math.round(overall)})`,
            });
          }
        } catch (e) {
          console.warn("[interview-complete] recompute failed", e);
        }
      })();
    }

    return {
      success: true,
      questionIndex: input.questionIndex,
      score: ai.score,
      analysis: ai.analysis,
      dimensions: ai.dimensions,
      remaining: INTERVIEW_QUESTIONS_TEMPLATE.length - answeredCount,
      complete: isComplete,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// CANDIDATE PSYCHOMETRIC ASSESSMENTS (ATS 2.0 — new Application model)
// ═══════════════════════════════════════════════════════════════════════

function seededShuffle<T>(items: T[], seedInput: string): T[] {
  const arr = [...items];
  let seed = 0;
  for (let i = 0; i < seedInput.length; i++) {
    seed = (seed * 31 + seedInput.charCodeAt(i)) >>> 0;
  }
  const rand = () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 0x100000000;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    const tmp = arr[i] as T;
    arr[i] = arr[j] as T;
    arr[j] = tmp;
  }
  return arr;
}

export const candidateGetAssessmentQuestions = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      type: z.enum(["IQ", "EQ", "MBTI", "BIG_FIVE"]),
    }),
  )
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        job: {
          select: {
            requireIQ: true,
            requireEQ: true,
            requireBigFive: true,
            requireMBTI: true,
            requireSJT: true,
          },
        },
        assessments: { where: { type: input.type } },
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    if (app.assessments.some((a) => a.completedAt))
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `${input.type} assessment already completed`,
      });

    switch (input.type) {
      case "IQ":
        return {
          type: "IQ" as const,
          title: "Cognitive Aptitude Test",
          description:
            "20 questions testing pattern recognition, numerical reasoning, spatial awareness, and verbal logic.",
          timeLimit: 30,
          questions: IQ_QUESTIONS.map((q) => ({
            id: q.id,
            question: q.question,
            options: q.options,
            category: q.category,
            difficulty: q.difficulty,
          })),
        };
      case "EQ":
        return {
          type: "EQ" as const,
          title: "Emotional Intelligence Assessment",
          description:
            "20 workplace scenarios measuring self-awareness, self-management, social awareness, and relationship management.",
          timeLimit: 25,
          questions: EQ_QUESTIONS.map((q) => ({
            id: q.id,
            scenario: q.scenario,
            question: q.scenario,
            options: seededShuffle(
              q.options.map((o, idx) => ({ id: idx, text: o.text })),
              `${input.accessToken}:${q.id}:eq`,
            ),
            category: q.category,
          })),
        };
      case "MBTI":
        return {
          type: "MBTI" as const,
          title: "Personality Type Indicator",
          description:
            "20 forced-choice questions to determine your personality type across 4 dimensions.",
          timeLimit: 15,
          questions: MBTI_QUESTIONS.map((q) => ({
            id: q.id,
            question: q.question,
            optionA: q.optionA.text,
            optionB: q.optionB.text,
          })),
        };
      case "BIG_FIVE":
        return {
          type: "BIG_FIVE" as const,
          title: "Big Five Personality Assessment (OCEAN)",
          description:
            "25 statements rated on a 5-point scale measuring the OCEAN traits.",
          timeLimit: 15,
          questions: BIG_FIVE_QUESTIONS.map((q) => ({
            id: q.id,
            statement: q.statement,
          })),
        };
    }
  });

export const candidateGetAssessmentStatus = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        job: {
          select: {
            requireIQ: true,
            requireEQ: true,
            requireBigFive: true,
            requireMBTI: true,
            requireSJT: true,
          },
        },
        assessments: { select: { type: true, completedAt: true, score: true } },
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    // Only surface the assessments the candidate can actually submit through
    // the portal. SJT and Work Sample are configured on jobs but don't yet
    // have a question bank / UI — leaving them in "required" traps the
    // candidate in ASSESSMENT stage forever because the "all done" gate
    // in candidateSubmitAssessment can never satisfy.
    const required = [
      app.job?.requireIQ && "IQ",
      app.job?.requireEQ && "EQ",
      app.job?.requireBigFive && "BIG_FIVE",
      app.job?.requireMBTI && "MBTI",
    ].filter(Boolean) as string[];
    return {
      required,
      completed: app.assessments.filter((a) => a.completedAt).map((a) => a.type),
    };
  });

export const candidateSubmitAssessment = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      type: z.enum(["IQ", "EQ", "MBTI", "BIG_FIVE"]),
      responses: z.record(z.string(), z.any()),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      include: {
        assessments: true,
        job: {
          select: {
            requireIQ: true,
            requireEQ: true,
            requireBigFive: true,
            requireMBTI: true,
            requireSJT: true,
          },
        },
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    if (app.stageBucket === "WITHDRAWN" || app.stageBucket === "REJECTED")
      throw new TRPCError({ code: "BAD_REQUEST", message: "Application is closed" });
    if (app.assessments.some((a) => a.type === input.type && a.completedAt))
      throw new TRPCError({ code: "BAD_REQUEST", message: `${input.type} already completed` });

    const numericResponses: Record<number, any> = {};
    for (const [key, val] of Object.entries(input.responses)) {
      numericResponses[parseInt(key)] = val;
    }

    let scored: { score: number; results: Record<string, any> };
    switch (input.type) {
      case "IQ":
        scored = scoreIQ(numericResponses);
        break;
      case "EQ":
        scored = scoreEQ(numericResponses);
        break;
      case "MBTI":
        scored = scoreMBTI(numericResponses as Record<number, "A" | "B">);
        break;
      case "BIG_FIVE":
        scored = scoreBigFive(numericResponses);
        break;
    }

    await db.applicationAssessment.upsert({
      where: {
        applicationId_type: { applicationId: app.id, type: input.type },
      },
      create: {
        applicationId: app.id,
        type: input.type,
        responses: input.responses,
        score: scored!.score,
        results: scored!.results,
        completedAt: new Date(),
      },
      update: {
        responses: input.responses,
        score: scored!.score,
        results: scored!.results,
        completedAt: new Date(),
      },
    });

    // Once all required assessments are done, recompute overall score
    // and advance the pipeline stage. Only count assessments the candidate
    // can actually take through the portal (SJT / Work Sample are not
    // wired yet — including them would prevent auto-advance).
    const required = [
      app.job?.requireIQ && "IQ",
      app.job?.requireEQ && "EQ",
      app.job?.requireBigFive && "BIG_FIVE",
      app.job?.requireMBTI && "MBTI",
    ].filter(Boolean) as string[];
    const doneCount =
      app.assessments.filter((a) => a.completedAt).length + 1;
    const allDone = doneCount >= required.length;

    if (allDone) {
      // Fire-and-forget confirmation email to the candidate. Uses
      // sendCandidateEmail so the ApplicationMessage timeline records the
      // send (or the delivery failure), keeping the audit trail complete.
      const brandAccent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
      const brandName = process.env.BRAND_NAME || "Square 15";
      const baseOrigin = (
        process.env.BASE_URL ||
        process.env.APP_URL ||
        ""
      ).replace(/\/+$/, "");
      const portalLink = `${baseOrigin}/candidate/${input.accessToken}`;
      void sendCandidateEmail({
        applicationId: app.id,
        to: app.email,
        subject: "We received your assessments — thank you",
        templateKey: "ASSESSMENT_COMPLETE",
        html: `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:24px;background:${brandAccent}22;color:${brandAccent};font-size:28px;line-height:48px;">&#10003;</div>
    </div>
    <h1 style="margin:0 0 12px 0;font-size:20px;text-align:center;">Thanks ${app.firstName} — assessments received</h1>
    <p style="margin:0 0 12px 0;line-height:1.55;">We have received your responses to all the required assessments. Our team is now reviewing them along with the rest of your application.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">You do not need to do anything else for now. We will be in touch with next steps — usually within a few business days.</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalLink}" style="display:inline-block;padding:11px 24px;background:${brandAccent};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Open my candidate portal</a>
    </div>
    <p style="margin:16px 0 0 0;line-height:1.55;">Warm regards,<br/><strong>The ${brandName} Recruitment Team</strong></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">If you have any questions, simply reply to this email.</p>
  </div>
</body></html>`,
      });

      (async () => {
        try {
          await recomputeApplicationScore(app.id);
          const scored2 = await db.application.findUnique({
            where: { id: app.id },
            select: { overallScore: true, stageBucket: true },
          });
          const overall = scored2?.overallScore ?? 0;
          logAiDecision({
            applicationId: app.id,
            action: "ASSESSMENTS_COMPLETE",
            score: overall,
            reason: `All required assessments done; overall ${Math.round(overall)}`,
          });
          if (
            scored2 &&
            ["APPLIED", "SCREENING", "ASSESSMENT"].includes(scored2.stageBucket)
          ) {
            const nextBucket = overall >= 70 ? "INTERVIEW" : "ASSESSMENT";
            await transitionApplication({
              applicationId: app.id,
              toBucket: nextBucket as any,
              reason: `Auto-advance after assessments (overall ${Math.round(overall)})`,
            });
          }
        } catch (e) {
          console.warn("[assessments-complete] recompute failed", e);
        }
      })();
    }

    return {
      success: true,
      type: input.type,
      score: scored!.score,
      results: scored!.results,
      remaining: Math.max(0, required.length - doneCount),
      complete: allDone,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// CANDIDATE INTERVIEW SELF-SCHEDULING
// ═══════════════════════════════════════════════════════════════════════

export const candidateListInterviewSlots = baseProcedure
  .input(z.object({ accessToken: z.string() }))
  .query(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: {
        id: true,
        deletedAt: true,
        stageBucket: true,
        accessTokenExpiresAt: true,
        jobId: true,
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });

    // Interview self-scheduling is offered ONLY once the recruiter has
    // moved the candidate into INTERVIEW stage. Any earlier stage returns
    // an empty list with reason="stage" so the UI hides the section.
    if (app.stageBucket !== "INTERVIEW") {
      return { available: false as const, slots: [], reason: "stage" as const };
    }

    // Generate the next 12 working-day slots (09:00 & 14:00 SAST) that are not
    // already booked for this candidate. Interviewer/panel matching happens at
    // the recruiter side when they confirm the booking, so candidates always
    // see options even before a panel is formally attached to the job.
    const slots: { id: string; start: Date; end: Date; label: string }[] = [];
    const now = new Date();
    for (let d = 1; d <= 14 && slots.length < 12; d++) {
      const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + d);
      const dow = day.getDay();
      if (dow === 0 || dow === 6) continue;
      for (const hour of [9, 14]) {
        const start = new Date(day.getFullYear(), day.getMonth(), day.getDate(), hour, 0, 0);
        const end = new Date(start.getTime() + 60 * 60 * 1000);
        const clash = await db.interviewBooking.count({
          where: {
            applicationId: app.id,
            scheduledStart: { gte: start, lt: end },
          },
        });
        if (clash > 0) continue;
        slots.push({
          id: `${start.toISOString()}`,
          start,
          end,
          label: start.toLocaleString("en-ZA", {
            weekday: "short",
            day: "numeric",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          }),
        });
      }
    }
    return { available: true as const, slots };
  });

export const candidateBookInterviewSlot = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      startISO: z.string(),
      endISO: z.string(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        deletedAt: true,
        stageBucket: true,
        accessTokenExpiresAt: true,
        jobId: true,
        assignedRecruiterId: true,
      },
    });
    if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.accessTokenExpiresAt && app.accessTokenExpiresAt < new Date())
      throw new TRPCError({ code: "UNAUTHORIZED", message: "Portal link has expired" });
    if (app.stageBucket !== "INTERVIEW")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Interviews can only be booked once the recruiter has advanced you to the Interview stage.",
      });
    const start = new Date(input.startISO);
    const end = new Date(input.endISO);
    if (!(start.getTime() > Date.now()))
      throw new TRPCError({ code: "BAD_REQUEST", message: "Slot must be in the future" });
    if (end.getTime() - start.getTime() < 30 * 60 * 1000)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Slot too short" });

    // Find panel (any) for this job
    const panel = await db.interviewPanel.findFirst({
      where: { jobId: app.jobId ?? undefined },
      include: { members: { select: { userId: true, role: true } } },
    });

    // InterviewBooking requires createdById (audit).
    // Use assigned recruiter, or fall back to the first admin.
    let createdById = app.assignedRecruiterId;
    if (!createdById) {
      const admin = await db.user.findFirst({
        where: { role: { in: ["ADMIN", "SENIOR_ADMIN", "HR", "RECRUITER"] } },
        select: { id: true },
        orderBy: { id: "asc" },
      });
      createdById = admin?.id ?? null;
    }
    if (!createdById) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: "No recruiter available to confirm this slot yet — please email us.",
      });
    }

    const booking = await db.interviewBooking.create({
      data: {
        applicationId: app.id,
        panelId: panel?.id,
        scheduledStart: start,
        scheduledEnd: end,
        status: "SCHEDULED",
        location: "To be confirmed by recruiter",
        agenda: "Booked by candidate through the portal",
        createdById,
      },
    });

    logAiDecision({
      applicationId: app.id,
      action: "INTERVIEW_SELF_BOOKED",
      reason: `Candidate booked ${start.toISOString()}`,
    });

    // Confirmation email
    sendEmail({
      to: app.email,
      subject: "Interview booked",
      html: `<p>Hi ${app.firstName},</p>
        <p>Your interview is booked for <b>${start.toLocaleString("en-ZA")}</b>.</p>
        <p>We'll send you the meeting details (location or video link) closer to the date.</p>
        <p>Square15 Recruitment Team</p>`,
    }).catch(() => {});

    return { success: true, bookingId: booking.id };
  });

// ═══════════════════════════════════════════════════════════════════════
// Admin: manually re-run reference outreach or referral notification
// ═══════════════════════════════════════════════════════════════════════

export const adminTriggerReferenceRequest = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    await autoRequestReferences(input.applicationId);
    return { success: true };
  });

export const adminTriggerReferralReward = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    await notifyReferrerOnHired(input.applicationId);
    return { success: true };
  });
