/**
 * Recruitment tRPC Procedures
 *
 * Public (token-based, no auth):
 *   - getApplicationByToken
 *   - getAssessmentQuestions
 *   - submitAssessment
 *   - submitInterviewAnswer
 *
 * Admin (authenticated):
 *   - getRecruitmentApplications
 *   - getRecruitmentApplicationDetail
 *   - updateApplicationStatus
 *   - onboardApplicant
 */

import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
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
  computeOverallScore,
} from "~/server/services/recruitment/scoringEngine";
import { TRPCError } from "@trpc/server";

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

// ═══════════════════════════════════════════════════════════════════════
// Public: Get application by access token
// ═══════════════════════════════════════════════════════════════════════

export const getApplicationByToken = baseProcedure
  .input(z.object({ token: z.string().min(10) }))
  .query(async ({ input }) => {
    const app = await db.artisanApplication.findUnique({
      where: { accessToken: input.token },
      include: {
        assessments: { select: { type: true, completedAt: true, score: true } },
        interviewResponses: { select: { questionIndex: true, createdAt: true } },
      },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    const assessmentTypes = ["IQ", "EQ", "MBTI", "BIG_FIVE"];
    const completedTypes = app.assessments.filter(a => a.completedAt).map(a => a.type);
    const pendingTypes = assessmentTypes.filter(t => !completedTypes.includes(t));

    return {
      id: app.id,
      firstName: app.firstName,
      lastName: app.lastName,
      email: app.email,
      primaryTrade: app.primaryTrade,
      status: app.status,
      completedAssessments: completedTypes,
      pendingAssessments: pendingTypes,
      completedInterviewQuestions: app.interviewResponses.map(r => r.questionIndex),
      totalInterviewQuestions: INTERVIEW_QUESTIONS_TEMPLATE.length,
      overallScore: app.overallScore,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// Public: Get assessment questions
// ═══════════════════════════════════════════════════════════════════════

export const getAssessmentQuestions = baseProcedure
  .input(
    z.object({
      token: z.string().min(10),
      type: z.enum(["IQ", "EQ", "MBTI", "BIG_FIVE", "INTERVIEW"]),
    })
  )
  .query(async ({ input }) => {
    const app = await db.artisanApplication.findUnique({
      where: { accessToken: input.token },
      include: { assessments: { where: { type: input.type } } },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    // Check if already completed
    if (input.type !== "INTERVIEW" && app.assessments.some(a => a.completedAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${input.type} assessment already completed` });
    }

    switch (input.type) {
      case "IQ":
        return {
          type: "IQ",
          title: "Cognitive Aptitude Test",
          description: "20 questions testing pattern recognition, numerical reasoning, spatial awareness, and verbal logic. Trade-relevant scenarios.",
          timeLimit: 30, // minutes
          questions: IQ_QUESTIONS.map(q => ({
            id: q.id,
            question: q.question,
            options: q.options,
            category: q.category,
            difficulty: q.difficulty,
            // correctIndex is NOT sent to frontend
          })),
        };

      case "EQ":
        return {
          type: "EQ",
          title: "Emotional Intelligence Assessment",
          description: "20 workplace scenarios measuring self-awareness, self-management, social awareness, and relationship management.",
          timeLimit: 25,
          questions: EQ_QUESTIONS.map(q => ({
            id: q.id,
            scenario: q.scenario,
            question: q.question,
            // Deterministically shuffle options per candidate to avoid answer-position patterns.
            options: seededShuffle(
              q.options.map((o, idx) => ({ id: idx, text: o.text })),
              `${input.token}:${q.id}:eq`
            ),
            category: q.category,
          })),
        };

      case "MBTI":
        return {
          type: "MBTI",
          title: "Personality Type Indicator",
          description: "20 forced-choice questions to determine your personality type across 4 dimensions.",
          timeLimit: 15,
          questions: MBTI_QUESTIONS.map(q => ({
            id: q.id,
            question: q.question,
            optionA: q.optionA.text,
            optionB: q.optionB.text,
          })),
        };

      case "BIG_FIVE":
        return {
          type: "BIG_FIVE",
          title: "Big Five Personality Assessment (OCEAN)",
          description: "25 statements rated on a 5-point scale measuring Openness, Conscientiousness, Extraversion, Agreeableness, and emotional stability.",
          timeLimit: 15,
          questions: BIG_FIVE_QUESTIONS.map(q => ({
            id: q.id,
            statement: q.statement,
            // reversed flag is NOT sent to frontend
          })),
        };

      case "INTERVIEW":
        return {
          type: "INTERVIEW",
          title: "AI Behavioural Interview",
          description: "5 scenario-based questions. Take your time to provide thoughtful, detailed answers.",
          timeLimit: 45,
          questions: INTERVIEW_QUESTIONS_TEMPLATE.map((q, i) => ({
            index: i,
            question: q.question,
            dimension: q.dimension,
          })),
        };
    }
  });

// ═══════════════════════════════════════════════════════════════════════
// Public: Submit assessment answers
// ═══════════════════════════════════════════════════════════════════════

export const submitAssessment = baseProcedure
  .input(
    z.object({
      token: z.string().min(10),
      type: z.enum(["IQ", "EQ", "MBTI", "BIG_FIVE"]),
      responses: z.record(z.string(), z.any()), // { questionId: chosenIndex }
    })
  )
  .mutation(async ({ input }) => {
    const app = await db.artisanApplication.findUnique({
      where: { accessToken: input.token },
      include: { assessments: true },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    // Check if already completed
    if (app.assessments.some(a => a.type === input.type && a.completedAt)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: `${input.type} already completed` });
    }

    // Parse responses: keys are string question IDs
    const numericResponses: Record<number, any> = {};
    for (const [key, val] of Object.entries(input.responses)) {
      numericResponses[parseInt(key)] = val;
    }

    // Score
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

    // Upsert assessment
    await db.artisanAssessment.upsert({
      where: {
        applicationId_type: { applicationId: app.id, type: input.type },
      },
      create: {
        applicationId: app.id,
        type: input.type,
        responses: input.responses,
        score: scored.score,
        results: scored.results,
        completedAt: new Date(),
      },
      update: {
        responses: input.responses,
        score: scored.score,
        results: scored.results,
        completedAt: new Date(),
      },
    });

    // Check if all 4 assessments completed
    const completedCount = app.assessments.filter(a => a.completedAt).length + 1;
    if (completedCount >= 4) {
      await db.artisanApplication.update({
        where: { id: app.id },
        data: { status: "INTERVIEW_PENDING" },
      });
    }

    return {
      success: true,
      type: input.type,
      score: scored.score,
      results: scored.results,
      assessmentsRemaining: 4 - completedCount,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// Public: Submit interview answer (one at a time)
// ═══════════════════════════════════════════════════════════════════════

export const submitInterviewAnswer = baseProcedure
  .input(
    z.object({
      token: z.string().min(10),
      questionIndex: z.number().min(0).max(4),
      answer: z.string().min(20, "Please provide a more detailed answer (at least 20 characters)"),
    })
  )
  .mutation(async ({ input }) => {
    const app = await db.artisanApplication.findUnique({
      where: { accessToken: input.token },
      include: { interviewResponses: true },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    // Check if already answered
    if (app.interviewResponses.some(r => r.questionIndex === input.questionIndex)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This question has already been answered" });
    }

    const template = INTERVIEW_QUESTIONS_TEMPLATE[input.questionIndex];
    if (!template) throw new TRPCError({ code: "BAD_REQUEST", message: "Invalid question index" });

    // AI score the answer
    const aiResult = await scoreInterviewAnswer(
      template.question,
      input.answer,
      template.dimension,
      app.primaryTrade
    );

    // Save
    await db.artisanInterviewResponse.create({
      data: {
        applicationId: app.id,
        questionIndex: input.questionIndex,
        question: template.question,
        answer: input.answer,
        aiScore: aiResult.score,
        aiAnalysis: aiResult.analysis,
        dimensions: aiResult.dimensions,
      },
    });

    // Check if all 5 interview questions answered
    const answeredCount = app.interviewResponses.length + 1;
    if (answeredCount >= INTERVIEW_QUESTIONS_TEMPLATE.length) {
      // All done — compute overall score
      await db.artisanApplication.update({
        where: { id: app.id },
        data: { status: "UNDER_REVIEW" },
      });
      await computeOverallScore(app.id);

      // Candidate notification email (non-blocking)
      sendEmail({
        to: app.email,
        subject: "Square15 — Assessment Completion Confirmed",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2D5016;">Assessments Completed Successfully</h2>
            <p>Hi ${app.firstName},</p>
            <p>Thank you for completing all psychometric assessments and the AI interview.</p>
            <p>Your application is now <strong>under review</strong> by our recruitment team.</p>
            <p>We will contact you at this email address with the outcome and next steps.</p>
            <p style="margin-top: 24px; color: #666; font-size: 13px;">Square15 Management Recruitment Team</p>
          </div>
        `,
      }).catch((err) => console.error("[recruitment] completion email error:", err));
    }

    return {
      success: true,
      questionIndex: input.questionIndex,
      score: aiResult.score,
      feedback: aiResult.analysis,
      questionsRemaining: INTERVIEW_QUESTIONS_TEMPLATE.length - answeredCount,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// Admin: List all applications
// ═══════════════════════════════════════════════════════════════════════

export const getRecruitmentApplications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
      trade: z.string().optional(),
      minScore: z.number().optional(),
      sortBy: z.enum(["createdAt", "overallScore", "status"]).optional(),
      sortOrder: z.enum(["asc", "desc"]).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    const where: any = {};
    if (input.status) where.status = input.status;
    if (input.trade) where.primaryTrade = input.trade;
    if (input.minScore) where.overallScore = { gte: input.minScore };

    const apps = await db.artisanApplication.findMany({
      where,
      include: {
        assessments: { select: { type: true, score: true, completedAt: true } },
        interviewResponses: { select: { questionIndex: true, aiScore: true } },
        reviewedBy: { select: { id: true, name: true } },
      },
      orderBy: { [input.sortBy || "createdAt"]: input.sortOrder || "desc" },
    });

    const statusCounts = await db.artisanApplication.groupBy({
      by: ["status"],
      _count: { id: true },
    });

    return {
      applications: apps.map(a => ({
        id: a.id,
        firstName: a.firstName,
        lastName: a.lastName,
        email: a.email,
        phone: a.phone,
        primaryTrade: a.primaryTrade,
        yearsExperience: a.yearsExperience,
        status: a.status,
        overallScore: a.overallScore,
        aiSummary: a.aiSummary,
        aiStrengths: a.aiStrengths,
        aiRedFlags: a.aiRedFlags,
        createdAt: a.createdAt,
        reviewedBy: a.reviewedBy?.name || null,
        assessmentScores: {
          IQ: a.assessments.find(x => x.type === "IQ")?.score ?? null,
          EQ: a.assessments.find(x => x.type === "EQ")?.score ?? null,
          MBTI: a.assessments.find(x => x.type === "MBTI")?.completedAt ? "Done" : null,
          BIG_FIVE: a.assessments.find(x => x.type === "BIG_FIVE")?.score ?? null,
        },
        interviewScore: a.interviewResponses.length > 0
          ? Math.round(
              a.interviewResponses.reduce((sum, r) => sum + (r.aiScore || 0), 0) /
              a.interviewResponses.length * 10
            )
          : null,
        completionProgress: {
          assessments: a.assessments.filter(x => x.completedAt).length,
          interviewQuestions: a.interviewResponses.length,
          total: a.assessments.filter(x => x.completedAt).length + (a.interviewResponses.length >= 5 ? 1 : 0),
          max: 5, // 4 assessments + 1 interview
        },
      })),
      statusCounts: Object.fromEntries(statusCounts.map(s => [s.status, s._count.id])),
      totalCount: apps.length,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// Admin: Get full application detail
// ═══════════════════════════════════════════════════════════════════════

export const getRecruitmentApplicationDetail = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    const app = await db.artisanApplication.findUnique({
      where: { id: input.applicationId },
      include: {
        assessments: true,
        interviewResponses: { orderBy: { questionIndex: "asc" } },
        reviewedBy: { select: { id: true, name: true } },
      },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

    return {
      ...app,
      assessments: app.assessments.map(a => ({
        ...a,
        results: a.results as Record<string, any>,
        responses: undefined, // don't expose raw answers to admin
      })),
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// Admin: Update application status (approve/reject/shortlist)
// ═══════════════════════════════════════════════════════════════════════

export const updateApplicationStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      status: z.enum([
        "NEW", "ASSESSMENTS_PENDING", "ASSESSMENTS_COMPLETE",
        "INTERVIEW_PENDING", "INTERVIEW_COMPLETE", "UNDER_REVIEW",
        "SHORTLISTED", "APPROVED", "REJECTED", "ONBOARDED",
      ]),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["ADMIN", "SENIOR_ADMIN", "MANAGER"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Not authorized" });
    }

    const updated = await db.artisanApplication.update({
      where: { id: input.applicationId },
      data: {
        status: input.status,
        reviewedById: user.id,
        reviewedAt: new Date(),
        reviewNotes: input.notes || undefined,
      },
    });

    return { success: true, id: updated.id, status: updated.status };
  });

// ═══════════════════════════════════════════════════════════════════════
// Admin: Onboard applicant → Create user account
// ═══════════════════════════════════════════════════════════════════════

export const onboardApplicant = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      role: z.string().default("ARTISAN"),
      password: z.string().min(6),
      employerId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!["ADMIN", "SENIOR_ADMIN"].includes(user.role)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only admins can onboard applicants" });
    }

    const app = await db.artisanApplication.findUnique({
      where: { id: input.applicationId },
    });

    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    if (app.status === "ONBOARDED") {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Already onboarded" });
    }

    // Check for existing user with same email
    const existing = await db.user.findUnique({ where: { email: app.email } });
    if (existing) {
      throw new TRPCError({ code: "CONFLICT", message: `User with email ${app.email} already exists` });
    }

    // Import bcrypt for password hashing
    const bcrypt = await import("bcryptjs");
    const hashedPassword = await bcrypt.hash(input.password, 10);

    // Create user account
    const newUser = await db.user.create({
      data: {
        name: `${app.firstName} ${app.lastName}`,
        email: app.email,
        password: hashedPassword,
        role: input.role,
        phone: app.phone,
        employerId: input.employerId || user.id,
        isActive: true,
      },
    });

    // Update application
    await db.artisanApplication.update({
      where: { id: app.id },
      data: {
        status: "ONBOARDED",
        onboardedUserId: newUser.id,
        reviewedById: user.id,
        reviewedAt: new Date(),
      },
    });

    return {
      success: true,
      userId: newUser.id,
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
    };
  });
