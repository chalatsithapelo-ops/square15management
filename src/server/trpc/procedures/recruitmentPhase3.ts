/**
 * Phase-3 continuous improvement procedures:
 *  3.1 Performance check-ins at day 30/60/90/180.
 *  3.2 Source-channel post-hire quality report.
 *  3.3 Employment-history verification requests + response handling.
 *  3.4 Candidate feedback aggregation per job / per interviewer.
 *  3.5 Recruiter SLA metrics (nudge cron lives elsewhere; this is the surface).
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

// ═══════════════════════════════════════════════════════════════════════
// 3.1 Performance check-ins
// ═══════════════════════════════════════════════════════════════════════

export const submitPerformanceCheckIn = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      dayMilestone: z.union([z.literal(30), z.literal(60), z.literal(90), z.literal(180)]),
      overallRating: z.number().min(1).max(5),
      meetingExpectations: z.boolean(),
      wouldRehire: z.boolean(),
      strengths: z.string().optional(),
      concerns: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      select: { onboardedUserId: true, hiredAt: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    const atRisk = input.overallRating <= 2 || !input.meetingExpectations || !input.wouldRehire;
    return db.performanceCheckIn.create({
      data: {
        applicationId: input.applicationId,
        hiredUserId: app.onboardedUserId ?? null,
        managerId: user.id,
        dayMilestone: input.dayMilestone,
        overallRating: input.overallRating,
        meetingExpectations: input.meetingExpectations,
        wouldRehire: input.wouldRehire,
        strengths: input.strengths,
        concerns: input.concerns,
        atRiskFlag: atRisk,
      },
    });
  });

export const listPerformanceCheckIns = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.performanceCheckIn.findMany({
      where: { applicationId: input.applicationId },
      include: { manager: { select: { firstName: true, lastName: true } } },
      orderBy: { dayMilestone: "asc" },
    });
  });

export const listDuePerformanceCheckIns = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    // For every HIRED application older than 30 days, report which milestones are still missing.
    const hired = await db.application.findMany({
      where: { stageBucket: "HIRED", hiredAt: { not: null } },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        hiredAt: true,
        job: { select: { title: true } },
        performanceCheckIns: { select: { dayMilestone: true } },
      },
      take: 200,
    });
    const now = Date.now();
    const rows = hired.map((h) => {
      const daysSince = h.hiredAt ? Math.floor((now - h.hiredAt.getTime()) / 86400000) : 0;
      const doneMilestones = new Set(h.performanceCheckIns.map((c) => c.dayMilestone));
      const due: number[] = [];
      for (const m of [30, 60, 90, 180]) {
        if (daysSince >= m && !doneMilestones.has(m)) due.push(m);
      }
      return {
        applicationId: h.id,
        candidate: `${h.firstName} ${h.lastName}`,
        jobTitle: h.job?.title ?? "",
        daysSinceHire: daysSince,
        dueMilestones: due,
      };
    }).filter((r) => r.dueMilestones.length > 0);
    return rows;
  });

// ═══════════════════════════════════════════════════════════════════════
// 3.2 Source-channel post-hire quality report
// ═══════════════════════════════════════════════════════════════════════

export const getSourceChannelReport = baseProcedure
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
    const where: any = {};
    if (input.fromDate) where.createdAt = { gte: input.fromDate };
    if (input.toDate) where.createdAt = { ...(where.createdAt ?? {}), lte: input.toDate };

    const apps = await db.application.findMany({
      where,
      select: {
        sourceChannel: true,
        stageBucket: true,
        hiredAt: true,
        onboardedUserId: true,
        performanceCheckIns: {
          orderBy: { dayMilestone: "asc" },
          select: { dayMilestone: true, overallRating: true, atRiskFlag: true, wouldRehire: true },
        },
      },
    });

    type Row = {
      source: string;
      applications: number;
      hired: number;
      passed90dChecks: number;
      avg90dRating: number | null;
      atRisk90d: number;
    };
    const bucket = new Map<string, Row>();
    for (const a of apps) {
      const src = a.sourceChannel ?? "UNKNOWN";
      const r = bucket.get(src) ?? {
        source: src,
        applications: 0,
        hired: 0,
        passed90dChecks: 0,
        avg90dRating: null,
        atRisk90d: 0,
      };
      r.applications++;
      if (a.stageBucket === "HIRED") r.hired++;
      const ninety = a.performanceCheckIns.find((c) => c.dayMilestone === 90);
      if (ninety) {
        r.passed90dChecks++;
        if (ninety.atRiskFlag) r.atRisk90d++;
        // running mean stored in field
        const prev = r.avg90dRating ?? 0;
        const n = r.passed90dChecks;
        r.avg90dRating = (prev * (n - 1) + ninety.overallRating) / n;
      }
      bucket.set(src, r);
    }

    return Array.from(bucket.values())
      .map((r) => ({
        ...r,
        hireRate: r.applications > 0 ? Math.round((r.hired / r.applications) * 100) : 0,
        atRiskRate: r.passed90dChecks > 0 ? Math.round((r.atRisk90d / r.passed90dChecks) * 100) : 0,
        avg90dRating: r.avg90dRating != null ? Math.round(r.avg90dRating * 100) / 100 : null,
      }))
      .sort((a, b) => b.applications - a.applications);
  });

// ═══════════════════════════════════════════════════════════════════════
// 3.3 Employment-history verification
// ═══════════════════════════════════════════════════════════════════════

export const createEmploymentVerification = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      employerName: z.string().min(2),
      claimedRole: z.string().optional(),
      claimedStart: z.date().optional(),
      claimedEnd: z.date().optional(),
      hrEmail: z.string().email().optional(),
      hrPhone: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.employmentVerification.create({
      data: {
        applicationId: input.applicationId,
        employerName: input.employerName,
        claimedRole: input.claimedRole,
        claimedStart: input.claimedStart,
        claimedEnd: input.claimedEnd,
        hrEmail: input.hrEmail,
        hrPhone: input.hrPhone,
      },
    });
  });

export const sendEmploymentVerificationEmail = baseProcedure
  .input(z.object({ token: z.string(), verificationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const v = await db.employmentVerification.findUnique({
      where: { id: input.verificationId },
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
    if (!v) throw new TRPCError({ code: "NOT_FOUND" });
    if (!v.hrEmail)
      throw new TRPCError({ code: "BAD_REQUEST", message: "No HR email captured" });
    const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(
      /\/+$/,
      "",
    );
    const link = `${origin}/verify-employment/${v.token}`;
    const candidateName = `${v.application.firstName} ${v.application.lastName}`;
    const html = `<!DOCTYPE html><html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:20px;color:#2D5016;">Employment verification for ${candidateName}</h1>
    <p style="margin:0 0 12px 0;color:#374151;">Hi HR team at ${v.employerName},</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">${candidateName} has applied for ${v.application.job?.title ?? "a role"} at Square 15 Facility Solutions and provided ${v.employerName} as a previous employer. With the candidate's POPIA-consent on file, we would appreciate a short confirmation of the following claimed employment details:</p>
    <ul style="margin:0 0 16px 20px;color:#374151;">
      ${v.claimedRole ? `<li>Role: ${v.claimedRole}</li>` : ""}
      ${v.claimedStart ? `<li>Start: ${new Date(v.claimedStart).toLocaleDateString()}</li>` : ""}
      ${v.claimedEnd ? `<li>End: ${new Date(v.claimedEnd).toLocaleDateString()}</li>` : ""}
    </ul>
    <div style="text-align:center;margin:24px 0;">
      <a href="${link}" style="display:inline-block;padding:12px 28px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:8px;font-weight:600;">Confirm employment &rarr;</a>
    </div>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;">Or paste this link: <a href="${link}" style="color:#2D5016;">${link}</a></p>
  </div>
</body></html>`;
    await sendCandidateEmail({
      applicationId: v.applicationId,
      to: v.hrEmail,
      subject: `Employment verification request for ${candidateName}`,
      templateKey: "EMPLOYMENT_VERIFICATION_REQUEST",
      sentById: user.id,
      html,
    });
    await db.employmentVerification.update({
      where: { id: v.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    return { success: true, link };
  });

export const getEmploymentVerificationByToken = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const v = await db.employmentVerification.findUnique({
      where: { token: input.token },
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
    if (!v) throw new TRPCError({ code: "NOT_FOUND" });
    return {
      candidateName: `${v.application.firstName} ${v.application.lastName}`,
      jobTitle: v.application.job?.title ?? "",
      employerName: v.employerName,
      claimedRole: v.claimedRole,
      claimedStart: v.claimedStart,
      claimedEnd: v.claimedEnd,
      status: v.status,
      responded: !!v.respondedAt,
    };
  });

export const submitEmploymentVerification = baseProcedure
  .input(
    z.object({
      token: z.string(),
      confirmedRole: z.string().optional(),
      confirmedStart: z.date().optional(),
      confirmedEnd: z.date().optional(),
      responseNotes: z.string().optional(),
      confirmClaimed: z.boolean(),
    }),
  )
  .mutation(async ({ input }) => {
    const v = await db.employmentVerification.findUnique({
      where: { token: input.token },
    });
    if (!v) throw new TRPCError({ code: "NOT_FOUND" });
    if (v.respondedAt)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Already responded" });

    // Discrepancy detection.
    let discrepancy = !input.confirmClaimed;
    if (
      input.confirmedRole &&
      v.claimedRole &&
      input.confirmedRole.trim().toLowerCase() !== v.claimedRole.trim().toLowerCase()
    ) {
      discrepancy = true;
    }
    if (
      input.confirmedStart &&
      v.claimedStart &&
      Math.abs(input.confirmedStart.getTime() - v.claimedStart.getTime()) > 45 * 86400000
    ) {
      discrepancy = true;
    }

    return db.employmentVerification.update({
      where: { id: v.id },
      data: {
        respondedAt: new Date(),
        confirmedRole: input.confirmedRole,
        confirmedStart: input.confirmedStart,
        confirmedEnd: input.confirmedEnd,
        responseNotes: input.responseNotes,
        discrepancy,
        status: discrepancy ? "DISPUTED" : "CONFIRMED",
      },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// 3.4 Candidate feedback aggregation
// ═══════════════════════════════════════════════════════════════════════

export const getCandidateFeedbackReport = baseProcedure
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
    // Rejection-feedback records are the closest existing signal — they live
    // on ApplicationMessage rows tagged REJECTION_FEEDBACK. Group them.
    const messages = await db.applicationMessage.findMany({
      where: {
        templateKey: "REJECTION_FEEDBACK",
        ...(input.fromDate ? { createdAt: { gte: input.fromDate } } : {}),
        ...(input.toDate ? { createdAt: { lte: input.toDate } } : {}),
        ...(input.jobId
          ? { application: { jobId: input.jobId } }
          : {}),
      },
      include: {
        application: { select: { jobId: true, job: { select: { title: true } } } },
      },
      take: 500,
    });
    return {
      total: messages.length,
      responses: messages.map((m) => ({
        id: m.id,
        jobId: m.application.jobId,
        jobTitle: m.application.job?.title ?? "",
        body: m.body,
        createdAt: m.createdAt,
      })),
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// 3.5 Recruiter SLA metrics
// ═══════════════════════════════════════════════════════════════════════

export const getRecruiterSlaReport = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const now = Date.now();

    // Applications sitting > threshold hours per bucket without a stage move.
    const SLA_HOURS: Record<string, number> = {
      APPLIED: 48,
      SCREENING: 72,
      ASSESSMENT: 168, // 7 days — assessments take real time
      INTERVIEW: 120,
      OFFER: 72,
      BACKGROUND_CHECK: 168,
    };
    const apps = await db.application.findMany({
      where: {
        deletedAt: null,
        stageBucket: {
          in: ["APPLIED", "SCREENING", "ASSESSMENT", "INTERVIEW", "OFFER", "BACKGROUND_CHECK"],
        },
      },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        stageBucket: true,
        stageEnteredAt: true,
        assignedRecruiter: { select: { id: true, firstName: true, lastName: true } },
        job: { select: { title: true } },
      },
      take: 500,
    });

    type Row = {
      applicationId: number;
      candidate: string;
      jobTitle: string;
      bucket: string;
      recruiter: string | null;
      recruiterId: number | null;
      hoursInStage: number;
      slaHours: number;
      overSla: boolean;
    };
    const rows: Row[] = apps.map((a) => {
      const enteredMs = a.stageEnteredAt?.getTime() ?? now;
      const hoursInStage = Math.round((now - enteredMs) / 3600000);
      const sla = SLA_HOURS[a.stageBucket] ?? 168;
      return {
        applicationId: a.id,
        candidate: `${a.firstName} ${a.lastName}`,
        jobTitle: a.job?.title ?? "",
        bucket: a.stageBucket,
        recruiter: a.assignedRecruiter
          ? `${a.assignedRecruiter.firstName} ${a.assignedRecruiter.lastName}`
          : null,
        recruiterId: a.assignedRecruiter?.id ?? null,
        hoursInStage,
        slaHours: sla,
        overSla: hoursInStage > sla,
      };
    });
    rows.sort((a, b) => b.hoursInStage - a.hoursInStage);

    // Aggregate per recruiter.
    type Agg = {
      recruiter: string;
      recruiterId: number | null;
      openApplications: number;
      overSla: number;
      medianHours: number | null;
    };
    const agg = new Map<string, Agg>();
    for (const r of rows) {
      const key = r.recruiter ?? "Unassigned";
      const a = agg.get(key) ?? { recruiter: key, recruiterId: r.recruiterId, openApplications: 0, overSla: 0, medianHours: null };
      a.openApplications++;
      if (r.overSla) a.overSla++;
      agg.set(key, a);
    }
    // Compute median hours in each recruiter row
    for (const [key, a] of agg) {
      const rowsForRec = rows.filter((r) => (r.recruiter ?? "Unassigned") === key).map((r) => r.hoursInStage);
      rowsForRec.sort((x, y) => x - y);
      const mid = Math.floor(rowsForRec.length / 2);
      a.medianHours =
        rowsForRec.length === 0
          ? null
          : rowsForRec.length % 2 === 0
            ? Math.round(((rowsForRec[mid - 1] ?? 0) + (rowsForRec[mid] ?? 0)) / 2)
            : (rowsForRec[mid] ?? null);
    }
    return {
      applications: rows,
      recruiters: Array.from(agg.values()).sort((a, b) => b.overSla - a.overSla),
    };
  });
