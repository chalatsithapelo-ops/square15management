/**
 * ATS Helpers â€” shared utilities for the Recruitment 2.0 module.
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

// Use "latest" alias so we don't break every time a specific Gemini version
// stops accepting new API keys. Override via env.RECRUITMENT_GEMINI_MODEL.
const model = google(process.env.RECRUITMENT_GEMINI_MODEL || "gemini-flash-latest");

// TECHNICAL_MANAGER is included because auto-recruiter assignment in
// createApplication picks from ADMIN/SENIOR_ADMIN/JUNIOR_ADMIN/MANAGER/
// TECHNICAL_MANAGER; without this a TECHNICAL_MANAGER auto-assigned as
// recruiter cannot action their own applications (moveStage, reject,
// assign, etc.) and the pipeline stalls.
export const RECRUITER_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "MANAGER",
  "JUNIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "HR",
  "RECRUITER",
];

export const HIRING_MANAGER_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "MANAGER",
  "JUNIOR_ADMIN",
  "TECHNICAL_MANAGER",
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Token expiry
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Stage transition with history + bucket mapping
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Composite score with configurable weights
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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

  // Refresh cached red-flag score (fire-and-forget, imported lazily to avoid
  // a circular ts-check between phase1 and helpers).
  try {
    const { computeRedFlagScore } = await import(
      "~/server/trpc/procedures/recruitmentPhase1"
    );
    await computeRedFlagScore(applicationId);
  } catch (err) {
    console.warn("[recomputeApplicationScore] Red-flag scoring failed:", err);
  }

  // Generate/refresh an AI-parsed summary so the recruiter sees narrative
  // strengths + red flags on the CV tab. Failure here is non-fatal.
  try {
    const iqScore = get("IQ");
    const eqScore = get("EQ");
    const bigFiveScore = get("BIG_FIVE");
    const interviewPart = parts.find((p) => p.key === "interview")?.value ?? null;
    const mbti =
      (app.assessments.find((a) => a.type === "MBTI")?.results as any)?.mbtiType ?? null;

    const promptBits = [
      `Candidate: ${app.firstName} ${app.lastName}`,
      app.primaryTrade ? `Primary trade / role interest: ${app.primaryTrade}` : "",
      app.yearsExperience != null ? `Years experience: ${app.yearsExperience}` : "",
      app.qualifications ? `Qualifications: ${app.qualifications}` : "",
      app.motivationLetter ? `Motivation letter: ${app.motivationLetter}` : "",
      app.aiMatchScore != null ? `AI job-match score: ${Math.round(app.aiMatchScore)}/100` : "",
      app.aiMatchExplanation ? `AI job-match rationale: ${app.aiMatchExplanation}` : "",
      iqScore != null ? `IQ score: ${Math.round(iqScore)}/100` : "",
      eqScore != null ? `EQ score: ${Math.round(eqScore)}/100` : "",
      bigFiveScore != null ? `Big Five composite: ${Math.round(bigFiveScore)}/100` : "",
      mbti ? `MBTI type: ${mbti}` : "",
      interviewPart != null ? `Behaviour interview average: ${Math.round(interviewPart)}/100` : "",
      overall != null ? `Overall composite score: ${overall}/100` : "",
    ]
      .filter(Boolean)
      .join("\n");

    const { text } = await generateText({
      model,
      system:
        "You are a South African recruitment assistant for Square 15 Facility Solutions. " +
        "Return ONLY a compact one-line JSON object with keys summary, strengths, redFlags. " +
        "summary: max 2 short sentences. strengths: max 3 semicolon-separated points (or 'None'). " +
        "redFlags: max 3 semicolon-separated points (or 'None identified'). " +
        "No markdown, no code fences, no line breaks inside string values.",
      prompt: promptBits,
      maxTokens: 2000,
    });

    // Tolerant JSON extraction — Gemini sometimes returns unbalanced JSON when
    // maxTokens is reached; retry adding a closing brace if the parser fails.
    const parsed = tolerantJsonExtract(text) as {
      summary?: string;
      strengths?: string | string[];
      redFlags?: string | string[];
    } | null;

    const asString = (v: unknown): string | null => {
      if (v == null) return null;
      if (Array.isArray(v)) return v.filter(Boolean).join("; ");
      return typeof v === "string" ? v : String(v);
    };

    if (parsed && parsed.summary) {
      await db.application.update({
        where: { id: applicationId },
        data: {
          aiSummary: asString(parsed.summary),
          aiStrengths: asString(parsed.strengths),
          aiRedFlags: asString(parsed.redFlags),
        },
      });
    } else {
      // Fallback: AI returned nothing usable. Instead of leaving the panel
      // stuck on "No AI summary yet", write a factual summary from the numbers
      // we already have. Recruiter sees an actionable narrative every time.
      console.warn(
        "[recomputeApplicationScore] AI summary JSON could not be parsed. Raw head:",
        text.slice(0, 400),
      );
      const bits: string[] = [];
      if (overall != null) bits.push(`Overall composite ${overall}/100.`);
      if (iqScore != null) bits.push(`IQ ${Math.round(iqScore)}`);
      if (eqScore != null) bits.push(`EQ ${Math.round(eqScore)}`);
      if (bigFiveScore != null) bits.push(`Big Five ${Math.round(bigFiveScore)}`);
      if (mbti) bits.push(`MBTI ${mbti}`);
      if (interviewPart != null) bits.push(`interview ${Math.round(interviewPart)}`);
      const factSummary =
        bits.length > 0
          ? bits.join(" · ") +
            ". AI narrative unavailable this round — see individual scores in the tabs below."
          : "AI narrative unavailable this round. Please retry Recompute in a few minutes.";
      await db.application.update({
        where: { id: applicationId },
        data: { aiSummary: factSummary },
      });
    }
  } catch (err) {
    console.warn("[recomputeApplicationScore] AI summary generation failed:", err);
    // Same fallback path so the recruiter always sees something after Recompute.
    try {
      const bits: string[] = [];
      if (overall != null) bits.push(`Overall composite ${overall}/100`);
      const factSummary =
        (bits.length ? bits.join(" · ") + ". " : "") +
        "AI narrative unavailable (temporary provider error). Please retry Recompute shortly.";
      await db.application.update({
        where: { id: applicationId },
        data: { aiSummary: factSummary },
      });
    } catch {
      /* swallow — DB update is best-effort */
    }
  }

  return overall;
}

// Attempt to parse a JSON object out of an LLM response even when it is
// truncated, wrapped in markdown fences, or has a trailing comma.
function tolerantJsonExtract(text: string): unknown | null {
  if (!text) return null;
  let s = text.trim();
  s = s.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```\s*$/i, "");
  const first = s.indexOf("{");
  if (first < 0) return null;
  s = s.slice(first);
  // Balance unclosed strings + braces if truncated.
  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  if (openBraces > closeBraces) {
    // Close any open string first.
    const quotes = (s.match(/(?<!\\)"/g) || []).length;
    if (quotes % 2 === 1) s += '"';
    s += "}".repeat(openBraces - closeBraces);
  }
  s = s.replace(/,(\s*[}\]])/g, "$1");
  try {
    return JSON.parse(s);
  } catch {
    return null;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AI match score â€” compares candidate profile to job description
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
    // Silent fail â€” AI is advisory
    console.warn("AI match scoring failed:", err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Consent logging
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
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
// Role-based decision gating — prevents rash APPROVED/REJECTED without scorecard.
// Early-funnel rejections (APPLIED / SCREENING) are exempt because the
// candidate hasn't been interviewed yet — requiring a scorecard for a spam
// or clearly-off-brief application is unreasonable and blocks recruiters
// from clearing the queue. A concrete rejection reason is always logged.
//
// For later-stage decisions (ASSESSMENT+), we additionally require that
// the scorecard was submitted by someone with legitimate visibility of the
// candidate — the assigned recruiter, the job's hiring manager, or a
// member of an interview panel booked for this application. A "buddy
// scorecard" from an unrelated recruiter should not satisfy the gate.
// ═══════════════════════════════════════════════════════════════════════
export async function assertScorecardExistsForDecision(
  applicationId: number,
  opts?: {
    currentBucket?: string | null;
    /** Set true for HIRED decisions — enforces >= 2 distinct interviewer signatures. */
    requireDualReview?: boolean;
  },
) {
  const earlyBuckets = new Set(["APPLIED", "SCREENING"]);
  if (opts?.currentBucket && earlyBuckets.has(opts.currentBucket)) {
    return; // early-funnel reject — no scorecard required
  }

  // Fetch submissions with interviewer + scorecard.stage so we can enforce
  // (a) stage-matched scorecard, (b) dual reviewer count, (c) eligibility.
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      assignedRecruiterId: true,
      stageBucket: true,
      job: { select: { recruiterId: true, hiringManagerId: true } },
      interviewBookings: {
        select: {
          panel: {
            select: {
              members: {
                select: {
                  userId: true,
                  user: { select: { firstName: true, lastName: true, email: true } },
                },
              },
            },
          },
        },
      },
      scorecardSubmissions: {
        where: { submittedAt: { not: null } },
        select: {
          interviewerId: true,
          submittedAt: true,
          recommendation: true,
          stage: true,
          scorecard: { select: { stage: true } },
          interviewer: { select: { firstName: true, lastName: true, email: true } },
        },
      },
    },
  });
  if (!app) return;

  const subs = app.scorecardSubmissions;
  if (subs.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "At least one submitted scorecard is required before a hire/reject decision at this stage.",
    });
  }

  // Stage matching: if any scorecard template has a stage set, prefer those
  // that match the current bucket. If none match, warn but do not block —
  // legacy templates without a stage still count.
  const bucket = opts?.currentBucket ?? app.stageBucket ?? null;
  const stageMatched = subs.filter((s) => {
    const stage = s.stage ?? s.scorecard?.stage ?? null;
    return stage === null || stage === bucket;
  });
  const usableSubs = stageMatched.length > 0 ? stageMatched : subs;

  // Identity-tighten: submitter must be the assigned recruiter, job recruiter,
  // hiring manager, or a booked interview panel member.
  const eligible = new Set<number>();
  if (app.assignedRecruiterId) eligible.add(app.assignedRecruiterId);
  if (app.job?.recruiterId) eligible.add(app.job.recruiterId);
  if (app.job?.hiringManagerId) eligible.add(app.job.hiringManagerId);
  const panelInfo = new Map<number, { firstName: string; lastName: string; email: string }>();
  for (const b of app.interviewBookings) {
    for (const m of b.panel?.members ?? []) {
      if (m.userId) {
        eligible.add(m.userId);
        if (m.user) panelInfo.set(m.userId, m.user);
      }
    }
  }

  const eligibleSubs = eligible.size === 0
    ? usableSubs
    : usableSubs.filter((s) => eligible.has(s.interviewerId));

  if (eligibleSubs.length === 0) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "A scorecard from the assigned recruiter, hiring manager, or a booked interview panellist is required before this decision.",
    });
  }

  // Phase 2 two-reviewer gate for HIRED: require >= 2 distinct interviewers.
  if (opts?.requireDualReview) {
    const distinctInterviewers = new Set(eligibleSubs.map((s) => s.interviewerId));
    if (distinctInterviewers.size < 2) {
      const submitted = eligibleSubs
        .map((s) => {
          const name = s.interviewer ? `${s.interviewer.firstName} ${s.interviewer.lastName}` : `User #${s.interviewerId}`;
          const when = s.submittedAt ? new Date(s.submittedAt).toISOString().slice(0, 10) : "?";
          return `${name} submitted a ${s.recommendation} recommendation on ${when}`;
        })
        .join("; ");
      const missing = [...panelInfo.entries()]
        .filter(([uid]) => !distinctInterviewers.has(uid))
        .slice(0, 3)
        .map(([, u]) => `${u.firstName} ${u.lastName}`);
      const hint = missing.length
        ? `Ask another panellist to submit theirs — try ${missing.join(", ")}.`
        : "Ask another recruiter, hiring manager or panellist to submit their independent scorecard first.";
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `A HIRED decision needs scorecards from at least 2 different reviewers. ${submitted}. ${hint}`,
      });
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Hard-gate for HIRED: work sample scored + HR-line reference on file +
// 24-hour cool-off after last scorecard. Each can be waived with an
// audited HiringOverride row.
// ═══════════════════════════════════════════════════════════════════════
export async function assertHiringPreconditions(applicationId: number) {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      workSampleSubmissions: {
        where: { OR: [{ humanScore: { not: null } }, { aiScore: { not: null } }] },
        select: { id: true },
      },
      referenceChecks: {
        where: { isHrLine: true },
        select: { id: true },
      },
      scorecardSubmissions: {
        where: { submittedAt: { not: null } },
        orderBy: { submittedAt: "desc" },
        select: { submittedAt: true },
        take: 1,
      },
      hiringOverrides: {
        select: { type: true },
      },
    },
  });
  if (!app) return;

  const waived = new Set(app.hiringOverrides.map((o) => o.type));

  if (app.workSampleSubmissions.length === 0 && !waived.has("WORK_SAMPLE_WAIVED")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "HIRED is blocked: no scored work sample on file. Ask the candidate to complete a work-sample task or record a Work Sample override with a written reason before proceeding.",
    });
  }
  if (app.referenceChecks.length === 0 && !waived.has("HR_LINE_REF_WAIVED")) {
    throw new TRPCError({
      code: "PRECONDITION_FAILED",
      message:
        "HIRED is blocked: no HR-line reference on file. Add a reference from a previous employer's HR/line manager (tick the HR-line box), or record an HR-line reference override with a written reason before proceeding.",
    });
  }
  const last = app.scorecardSubmissions[0];
  if (last?.submittedAt && !waived.has("COOLOFF_WAIVED")) {
    const hoursSince = (Date.now() - new Date(last.submittedAt).getTime()) / 3_600_000;
    if (hoursSince < 24) {
      const hoursLeft = Math.ceil(24 - hoursSince);
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `HIRED is blocked: 24-hour cooling-off has not elapsed since the last scorecard (about ${hoursLeft}h to go). This prevents day-of-interview snap decisions. Record a Cool-off override with a reason to bypass.`,
      });
    }
  }
}
