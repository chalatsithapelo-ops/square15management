/**
 * ATS Helpers — shared utilities for the Recruitment 2.0 module.
 *
 * - Role guards for recruiters / hiring managers / admins
 * - Stage transition + history logging
 * - AI match scoring (Gemini)
 * - Composite score with configurable weights
 * - Consent logging + token expiry helpers
 */

import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import type { AuthenticatedUser } from "~/server/utils/auth";

const model = google("gemini-2.0-flash");

export const RECRUITER_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "MANAGER",
  "JUNIOR_ADMIN",
  "HR",
  "RECRUITER",
];

export const HIRING_MANAGER_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "MANAGER",
  "HR",
];

export function assertRecruiter(user: AuthenticatedUser) {
  if (!RECRUITER_ROLES.includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Recruiter access required" });
  }
}

export function assertHiringManager(user: AuthenticatedUser) {
  if (!HIRING_MANAGER_ROLES.includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Hiring manager access required" });
  }
}

export function assertAdmin(user: AuthenticatedUser) {
  if (!["ADMIN", "SENIOR_ADMIN"].includes(user.role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin access required" });
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Token expiry
// ═══════════════════════════════════════════════════════════════════════
export function tokenExpiryDate(daysValid = 21): Date {
  const d = new Date();
  d.setDate(d.getDate() + daysValid);
  return d;
}

export function retentionCutoff(monthsFromNow = 24): Date {
  const d = new Date();
  d.setMonth(d.getMonth() + monthsFromNow);
  return d;
}

// ═══════════════════════════════════════════════════════════════════════
// Stage transition with history + bucket mapping
// ═══════════════════════════════════════════════════════════════════════
export async function transitionApplication(params: {
  applicationId: number;
  toStageId?: number | null;
  toBucket?: "APPLIED" | "SCREENING" | "ASSESSMENT" | "INTERVIEW" | "OFFER" | "BACKGROUND_CHECK" | "HIRED" | "REJECTED" | "WITHDRAWN" | "ON_HOLD";
  movedById?: number | null;
  reason?: string;
}) {
  const app = await db.application.findUnique({
    where: { id: params.applicationId },
    select: { id: true, currentStageId: true, stageBucket: true, stageEnteredAt: true },
  });
  if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });

  let toStage: { id: number; bucket: string } | null = null;
  if (params.toStageId) {
    const s = await db.jobPipelineStage.findUnique({
      where: { id: params.toStageId },
      select: { id: true, bucket: true },
    });
    if (!s) throw new TRPCError({ code: "NOT_FOUND", message: "Stage not found" });
    toStage = s;
  }

  const bucket = (params.toBucket ?? toStage?.bucket ?? app.stageBucket) as any;
  const durationHours = app.stageEnteredAt
    ? (Date.now() - new Date(app.stageEnteredAt).getTime()) / 36e5
    : null;

  await db.$transaction([
    db.application.update({
      where: { id: params.applicationId },
      data: {
        currentStageId: params.toStageId ?? null,
        stageBucket: bucket,
        stageEnteredAt: new Date(),
      },
    }),
    db.applicationStageHistory.create({
      data: {
        applicationId: params.applicationId,
        fromStageId: app.currentStageId,
        toStageId: params.toStageId ?? null,
        bucket,
        movedById: params.movedById ?? null,
        reason: params.reason,
        durationHours: durationHours ?? null,
      },
    }),
  ]);
}

// ═══════════════════════════════════════════════════════════════════════
// Composite score with configurable weights
// ═══════════════════════════════════════════════════════════════════════
export type ScoreWeights = {
  iq?: number;
  eq?: number;
  bigFive?: number;
  sjt?: number;
  workSample?: number;
  interview?: number;
  humanScorecard?: number;
  aiMatch?: number;
};

const DEFAULT_WEIGHTS: ScoreWeights = {
  iq: 0.10,
  eq: 0.15,
  bigFive: 0.15,
  sjt: 0.10,
  workSample: 0.15,
  interview: 0.20,
  humanScorecard: 0.10,
  aiMatch: 0.05,
};

export async function recomputeApplicationScore(applicationId: number, weights?: ScoreWeights) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      assessments: true,
      interviewResponses: true,
      scorecardSubmissions: { where: { submittedAt: { not: null } } },
      job: { select: { scoringWeights: true } },
    },
  });
  if (!app) return null;

  const w: ScoreWeights = {
    ...DEFAULT_WEIGHTS,
    ...(app.job?.scoringWeights as ScoreWeights | null),
    ...(weights ?? {}),
  };

  const get = (type: string) => app.assessments.find((a) => a.type === type)?.score ?? null;
  const parts: { key: keyof ScoreWeights; value: number | null }[] = [
    { key: "iq", value: get("IQ") },
    { key: "eq", value: get("EQ") },
    { key: "bigFive", value: get("BIG_FIVE") },
    { key: "sjt", value: get("SJT") },
    { key: "workSample", value: get("WORK_SAMPLE") },
  ];

  if (app.interviewResponses.length) {
    const avg =
      app.interviewResponses.reduce((s, r) => s + (r.aiScore ?? 0), 0) /
      app.interviewResponses.length;
    parts.push({ key: "interview", value: avg * 10 });
  } else {
    parts.push({ key: "interview", value: null });
  }

  if (app.scorecardSubmissions.length) {
    const avg =
      app.scorecardSubmissions.reduce((s, r) => s + (r.overallRating ?? 0), 0) /
      app.scorecardSubmissions.length;
    parts.push({ key: "humanScorecard", value: (avg / 5) * 100 });
  } else {
    parts.push({ key: "humanScorecard", value: null });
  }

  parts.push({ key: "aiMatch", value: app.aiMatchScore ?? null });

  let totalWeight = 0;
  let weighted = 0;
  for (const p of parts) {
    const weight = w[p.key] ?? 0;
    if (p.value !== null && weight > 0) {
      weighted += p.value * weight;
      totalWeight += weight;
    }
  }
  const overall = totalWeight > 0 ? Math.round(weighted / totalWeight) : null;

  // Human score (excluding AI-heavy components)
  const humanOnly = parts.find((p) => p.key === "humanScorecard")?.value ?? null;

  await db.application.update({
    where: { id: applicationId },
    data: {
      overallScore: overall,
      humanScore: humanOnly,
    },
  });

  return overall;
}

// ═══════════════════════════════════════════════════════════════════════
// AI match score — compares candidate profile to job description
// ═══════════════════════════════════════════════════════════════════════
export async function computeAIMatchScore(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      job: { select: { title: true, description: true, requirements: true, competencies: true } },
    },
  });
  if (!app || !app.job) return;

  const prompt = `You are an expert recruiter. Assess how well the candidate matches the job.

JOB: ${app.job.title}
REQUIREMENTS: ${app.job.requirements ?? ""}
DESCRIPTION: ${app.job.description}
COMPETENCIES: ${(app.job.competencies ?? []).join(", ")}

CANDIDATE:
- Primary trade: ${app.primaryTrade ?? "N/A"}
- Years experience: ${app.yearsExperience ?? "N/A"}
- Qualifications: ${app.qualifications ?? "N/A"}
- Motivation: ${app.motivationLetter ?? "N/A"}

Return ONLY valid JSON: {"score": <0-100>, "explanation": "<2-3 sentences>"}`;

  try {
    const { text } = await generateText({ model, prompt, maxTokens: 300 });
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) return;
    const parsed = JSON.parse(match[0]) as { score: number; explanation: string };
    await db.application.update({
      where: { id: applicationId },
      data: {
        aiMatchScore: Math.max(0, Math.min(100, parsed.score)),
        aiMatchExplanation: parsed.explanation,
      },
    });
  } catch (err) {
    // Silent fail — AI is advisory
    console.warn("AI match scoring failed:", err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Consent logging
// ═══════════════════════════════════════════════════════════════════════
export async function logConsent(params: {
  applicationId: number;
  action: "GRANTED" | "WITHDRAWN" | "DSAR_REQUEST" | "DELETION_REQUEST" | "POLICY_VIEW";
  version: string;
  ip?: string;
  userAgent?: string;
  notes?: string;
}) {
  await db.consentEvent.create({ data: params });
}

// ═══════════════════════════════════════════════════════════════════════
// Role-based decision gating — prevents rash APPROVED/REJECTED without scorecard
// ═══════════════════════════════════════════════════════════════════════
export async function assertScorecardExistsForDecision(applicationId: number) {
  const count = await db.scorecardSubmission.count({
    where: { applicationId, submittedAt: { not: null } },
  });
  if (count === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message: "At least one submitted scorecard is required before a hire/reject decision.",
    });
  }
}
