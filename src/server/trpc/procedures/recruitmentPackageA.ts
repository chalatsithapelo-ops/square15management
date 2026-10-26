/**
 * Package-A completion: admin editors, session snapshots, SLA nudger, HR-line,
 * calibration-vs-performance correlation.
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
import { openCandidate } from "~/server/services/recruitment/portalAssessment";

async function ownedSession(accessToken: string, sessionId: number) {
  const app = await openCandidate(accessToken);
  const session = await db.assessmentSession.findUnique({ where: { id: sessionId } });
  if (!session || session.applicationId !== app.id) throw new TRPCError({ code: "NOT_FOUND" });
  if (session.finishedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Session has finished" });
  return session;
}

async function snapshotViewer(token: string, applicationId: number) {
  const user = await authenticateUser(token);
  assertRecruiter(user);
  const app = await db.application.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app || app.deletedAt) throw new TRPCError({ code: "NOT_FOUND" });
  if (["ADMIN", "SENIOR_ADMIN"].includes(user.role) || app.assignedRecruiterId === user.id || app.job?.recruiterId === user.id || app.job?.hiringManagerId === user.id) return;
  const panel = await db.interviewPanelMember.findFirst({ where: { userId: user.id, panel: { OR: [{ jobId: app.jobId ?? -1 }, { bookings: { some: { applicationId } } }] } } });
  if (!panel) throw new TRPCError({ code: "FORBIDDEN", message: "Hiring panel or application owner access required" });
}

// ═══════════════════════════════════════════════════════════════════════
// Admin editor helpers — delete work-sample task (create/update lived in
// recruitmentPhase1.ts). Keep this module focused on the gaps.
// ═══════════════════════════════════════════════════════════════════════

export const deleteWorkSampleTask = baseProcedure
  .input(z.object({ token: z.string(), taskId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.workSampleTask.delete({ where: { id: input.taskId } });
  });

// ═══════════════════════════════════════════════════════════════════════
// HR-line ReferenceCheck gate
// ═══════════════════════════════════════════════════════════════════════

export const createReferenceCheck = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      refereeName: z.string().min(2),
      refereeEmail: z.string().email(),
      refereePhone: z.string().optional(),
      relationship: z.string().optional(),
      isHrLine: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.referenceCheck.create({
      data: {
        applicationId: input.applicationId,
        refereeName: input.refereeName,
        refereeEmail: input.refereeEmail,
        refereePhone: input.refereePhone,
        relationship: input.relationship,
        isHrLine: input.isHrLine,
      },
    });
  });

export const assertHrLineReferenceOnFile = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const hrCount = await db.referenceCheck.count({
      where: { applicationId: input.applicationId, isHrLine: true },
    });
    return { hasHrLine: hrCount > 0 };
  });

// ═══════════════════════════════════════════════════════════════════════
// Assessment session (candidate portal + admin visibility)
// ═══════════════════════════════════════════════════════════════════════

export const candidateStartSession = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      webcamGranted: z.boolean(),
      webcamDeclineReason: z.string().optional(),
      portal: z.boolean().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await openCandidate(input.accessToken);
    return db.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "Application" WHERE id = ${app.id} FOR UPDATE`;
      const active = await tx.assessmentSession.findFirst({ where: { applicationId: app.id, finishedAt: null }, orderBy: { id: "desc" } });
      if (active) return tx.assessmentSession.update({ where: { id: active.id }, data: { webcamGranted: input.webcamGranted, webcamDeclineReason: input.webcamDeclineReason ?? null } });
      return tx.assessmentSession.create({ data: { applicationId: app.id, webcamGranted: input.webcamGranted, webcamDeclineReason: input.webcamDeclineReason, currentStep: input.portal ? "PORTAL_OVERVIEW" : "BEHAVIOUR" } });
    });
  });

export const candidatePauseSession = baseProcedure
  .input(z.object({ accessToken: z.string(), sessionId: z.number() }))
  .mutation(async ({ input }) => {
    const session = await ownedSession(input.accessToken, input.sessionId);
    if (session.pausedAt) return session;
    return db.assessmentSession.update({
      where: { id: input.sessionId },
      data: { pausedAt: new Date(), pauseCount: session.pauseCount + 1 },
    });
  });

export const candidateResumeSession = baseProcedure
  .input(z.object({ accessToken: z.string(), sessionId: z.number() }))
  .mutation(async ({ input }) => {
    await ownedSession(input.accessToken, input.sessionId);
    return db.assessmentSession.update({
      where: { id: input.sessionId },
      data: { resumedAt: new Date(), pausedAt: null },
    });
  });

export const candidateFinishSession = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      sessionId: z.number(),
      timings: z.record(z.string(), z.number()).optional(),
      currentStep: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    await ownedSession(input.accessToken, input.sessionId);
    return db.assessmentSession.update({
      where: { id: input.sessionId },
      data: {
        finishedAt: new Date(),
        timings: input.timings ?? undefined,
        currentStep: input.currentStep ?? undefined,
      },
    });
  });

export const candidateCaptureSnapshot = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      sessionId: z.number(),
      imageDataUrl: z.string().min(100).max(200_000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/),
      step: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const session = await ownedSession(input.accessToken, input.sessionId);
    if (!session.webcamGranted || session.pausedAt) throw new TRPCError({ code: "FORBIDDEN", message: "Camera consent and active session required" });
    return db.assessmentSnapshot.create({
      data: {
        sessionId: input.sessionId,
        imageDataUrl: input.imageDataUrl,
        step: input.step,
      },
    });
  });

export const listAssessmentSessions = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    await snapshotViewer(input.token, input.applicationId);
    return db.assessmentSession.findMany({
      where: { applicationId: input.applicationId },
      include: {
        snapshots: {
          orderBy: { createdAt: "asc" },
          select: { id: true, createdAt: true, step: true },
        },
      },
      orderBy: { startedAt: "desc" },
    });
  });

export const getSessionSnapshot = baseProcedure
  .input(z.object({ token: z.string(), snapshotId: z.number(), applicationId: z.number().optional() }))
  .query(async ({ input }) => {
    const snapshot = await db.assessmentSnapshot.findUnique({ where: { id: input.snapshotId }, include: { session: { select: { applicationId: true } } } });
    if (!snapshot || (input.applicationId !== undefined && snapshot.session.applicationId !== input.applicationId)) throw new TRPCError({ code: "NOT_FOUND" });
    await snapshotViewer(input.token, snapshot.session.applicationId);
    return snapshot;
  });

export const candidateSnapshotFailure = baseProcedure.input(z.object({ accessToken: z.string(), sessionId: z.number(), reason: z.string().max(500) })).mutation(async ({ input }) => {
  await ownedSession(input.accessToken, input.sessionId);
  return db.assessmentSession.update({ where: { id: input.sessionId }, data: { webcamGranted: false, webcamDeclineReason: `Capture failure: ${input.reason}` } });
});

// ═══════════════════════════════════════════════════════════════════════
// Calibration correlation vs 90-day performance
// ═══════════════════════════════════════════════════════════════════════

export const getCalibrationCorrelation = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    // For every application with BOTH a scorecard submission AND a 90-day
    // performance check-in, correlate submission.overallRating with check-in.overallRating.
    // Grouped per interviewer.
    const subs = await db.scorecardSubmission.findMany({
      where: { submittedAt: { not: null } },
      select: {
        interviewerId: true,
        applicationId: true,
        overallRating: true,
        interviewer: { select: { firstName: true, lastName: true } },
      },
    });
    const checkins = await db.performanceCheckIn.findMany({
      where: { dayMilestone: 90 },
      select: { applicationId: true, overallRating: true },
    });
    const perApp = new Map(checkins.map((c) => [c.applicationId, c.overallRating]));

    type Bucket = { interviewerId: number; name: string; pairs: Array<[number, number]> };
    const bucket = new Map<number, Bucket>();
    for (const s of subs) {
      const perf = perApp.get(s.applicationId);
      if (perf == null || s.overallRating == null) continue;
      const key = s.interviewerId;
      const b = bucket.get(key) ?? {
        interviewerId: key,
        name: s.interviewer ? `${s.interviewer.firstName} ${s.interviewer.lastName}` : `User ${key}`,
        pairs: [],
      };
      b.pairs.push([s.overallRating, perf]);
      bucket.set(key, b);
    }

    const pearson = (arr: Array<[number, number]>) => {
      if (arr.length < 3) return null;
      const n = arr.length;
      const meanX = arr.reduce((s, p) => s + p[0], 0) / n;
      const meanY = arr.reduce((s, p) => s + p[1], 0) / n;
      let num = 0, dx = 0, dy = 0;
      for (const [x, y] of arr) {
        num += (x - meanX) * (y - meanY);
        dx += (x - meanX) ** 2;
        dy += (y - meanY) ** 2;
      }
      const denom = Math.sqrt(dx * dy);
      return denom === 0 ? 0 : Math.round((num / denom) * 100) / 100;
    };

    return Array.from(bucket.values()).map((b) => ({
      interviewerId: b.interviewerId,
      name: b.name,
      pairsCount: b.pairs.length,
      correlation: pearson(b.pairs),
    })).sort((a, b) => b.pairsCount - a.pairsCount);
  });

// ═══════════════════════════════════════════════════════════════════════
// SLA nudger — called by cron (existing sendSlaNudges or fresh cron)
// ═══════════════════════════════════════════════════════════════════════

const SLA_HOURS: Record<string, number> = {
  APPLIED: 48,
  SCREENING: 72,
  ASSESSMENT: 168,
  INTERVIEW: 120,
  OFFER: 72,
  BACKGROUND_CHECK: 168,
};

export async function runRecruiterSlaNudges(): Promise<{ nudged: number; skipped: number }> {
  const now = Date.now();
  const apps = await db.application.findMany({
    where: {
      deletedAt: null,
      stageBucket: { in: Object.keys(SLA_HOURS) as any },
      assignedRecruiterId: { not: null },
    },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      stageBucket: true,
      stageEnteredAt: true,
      assignedRecruiterId: true,
      assignedRecruiter: { select: { email: true, firstName: true } },
      job: { select: { title: true } },
    },
    take: 500,
  });
  let nudged = 0;
  let skipped = 0;
  for (const a of apps) {
    const sla = SLA_HOURS[a.stageBucket] ?? 168;
    const hrs = a.stageEnteredAt
      ? (now - a.stageEnteredAt.getTime()) / 3600000
      : 0;
    if (hrs <= sla) {
      skipped++;
      continue;
    }
    // Idempotency: skip if a nudge for this stage entered date already went out today.
    const recent = await db.applicationMessage.findFirst({
      where: {
        applicationId: a.id,
        templateKey: "SLA_NUDGE",
        createdAt: { gte: new Date(now - 20 * 3600 * 1000) },
      },
      select: { id: true },
    });
    if (recent) {
      skipped++;
      continue;
    }
    const email = a.assignedRecruiter?.email;
    if (!email) {
      skipped++;
      continue;
    }
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;color:#111827;">
  <h2 style="color:#c53030;">SLA breach: ${a.firstName} ${a.lastName}</h2>
  <p>Hi ${a.assignedRecruiter?.firstName ?? "there"},</p>
  <p>Application <strong>#${a.id}</strong> (${a.job?.title ?? ""}) has been in <strong>${a.stageBucket}</strong> for ${Math.round(hrs)} hours (SLA ${sla}h).</p>
  <p>Please action or reassign this candidate today.</p>
  <p><a href="https://square15management.co.za/admin/recruitment/applications/${a.id}" style="display:inline-block;padding:10px 18px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:6px;font-weight:600;">Open application</a></p>
  <p style="font-size:12px;color:#6b7280;">Square 15 Facility Solutions Recruitment SLA nudge</p>
</div>`;
    await sendCandidateEmail({
      applicationId: a.id,
      to: email,
      subject: `SLA nudge: ${a.firstName} ${a.lastName} has been in ${a.stageBucket} for ${Math.round(hrs)}h`,
      templateKey: "SLA_NUDGE",
      html,
    });
    nudged++;
  }
  return { nudged, skipped };
}

export const triggerRecruiterSlaNudges = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return runRecruiterSlaNudges();
  });

// ═══════════════════════════════════════════════════════════════════════
// Email delivery health — surfaces silent outages (quota, blocked SMTP)
// ═══════════════════════════════════════════════════════════════════════

export const getEmailDeliveryHealth = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const [delivered, failed, recent] = await Promise.all([
      db.applicationMessage.count({
        where: { createdAt: { gte: since }, deliveredAt: { not: null }, direction: "OUTBOUND" },
      }),
      db.applicationMessage.count({
        where: { createdAt: { gte: since }, deliveredAt: null, direction: "OUTBOUND" },
      }),
      db.applicationMessage.findFirst({
        where: { createdAt: { gte: since }, deliveredAt: null, direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        select: { body: true, createdAt: true, templateKey: true },
      }),
    ]);
    const total = delivered + failed;
    const failedPct = total > 0 ? Math.round((failed / total) * 100) : 0;
    const lastErr = recent?.body?.match(/^\[Delivery failed: ([^\]]+)\]/)?.[1] ?? null;
    let severity: "OK" | "WARN" | "OUTAGE" = "OK";
    if (total >= 3 && failedPct >= 70) severity = "OUTAGE";
    else if (failed > 0) severity = "WARN";
    let hint: string | null = null;
    if (lastErr?.toLowerCase().includes("quota")) hint = "Resend monthly quota exhausted — top up or plug in a backup provider.";
    else if (lastErr?.toLowerCase().includes("timeout")) hint = "SMTP fallback timed out — port 587 may be blocked by the host. Use a HTTP provider (Resend / Postmark / SendGrid).";
    else if (lastErr?.toLowerCase().includes("not verified")) hint = "Sender domain not verified in Resend.";
    return {
      severity,
      delivered24h: delivered,
      failed24h: failed,
      failedPct,
      lastError: lastErr,
      lastErrorAt: recent?.createdAt ?? null,
      lastTemplate: recent?.templateKey ?? null,
      hint,
    };
  });
