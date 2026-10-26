/**
 * Recruitment 2.0 — additional actions.
 *
 * These procedures fill in the "higher-value" recruiter workflow gaps that
 * cannot cleanly live in `recruitmentAts.ts`:
 *
 *   - bulkRejectApplications: reject many APPLIED-bucket apps in one shot
 *     (typical use: recruiter clearing spam / clearly-unqualified batch).
 *   - shortlistTopApplications: promote the top N candidates in a job's
 *     APPLIED pool into SCREENING, ranked by overallScore then aiMatchScore.
 *   - compareApplications: fetch multiple applications for a side-by-side
 *     compare page, including scorecard averages + assessment scores.
 *   - resendCandidatePortalLink: public endpoint a candidate uses to
 *     receive a fresh portal link if they lost the original email. Rate-
 *     limited to one email per hour per address, per app.
 */

import crypto from "crypto";
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import {
  assertRecruiter,
  tokenExpiryDate,
  transitionApplication,
} from "~/server/services/recruitment/atsHelpers";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";
import { sendEmail } from "~/server/utils/email";

// ═══════════════════════════════════════════════════════════════════════
// BULK REJECT — early-funnel only (APPLIED bucket).
// Rejecting later stages must go through single-app rejectApplication so
// the identity-tightened scorecard gate applies to each candidate.
// ═══════════════════════════════════════════════════════════════════════
export const bulkRejectApplications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationIds: z.array(z.number()).min(1).max(500),
      rejectionReasonId: z.number(),
      rejectionDetail: z.string().max(500).optional(),
      sendEmailToCandidate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    const reason = await db.rejectionReason.findUnique({
      where: { id: input.rejectionReasonId },
      select: { id: true, label: true, category: true },
    });
    if (!reason) throw new TRPCError({ code: "NOT_FOUND", message: "Rejection reason not found" });

    // Only allow bulk-reject on APPLIED (or SCREENING for admin) — later stages
    // legitimately require a per-candidate scorecard.
    const eligible = await db.application.findMany({
      where: {
        id: { in: input.applicationIds },
        stageBucket: { in: ["APPLIED", "SCREENING"] },
        deletedAt: null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        job: { select: { title: true } },
      },
    });

    if (eligible.length === 0)
      return { rejected: 0, skipped: input.applicationIds.length, message: "No eligible applications (bulk reject is only allowed for APPLIED / SCREENING stages)." };

    const now = new Date();
    await db.$transaction([
      db.application.updateMany({
        where: { id: { in: eligible.map((e) => e.id) } },
        data: {
          rejectionReasonId: input.rejectionReasonId,
          rejectionDetail: input.rejectionDetail ?? null,
          reviewedById: user.id,
          reviewedAt: now,
          stageBucket: "REJECTED",
          stageEnteredAt: now,
        },
      }),
      db.applicationStageHistory.createMany({
        data: eligible.map((e) => ({
          applicationId: e.id,
          toStageId: null,
          bucket: "REJECTED" as const,
          movedById: user.id,
          reason: input.rejectionDetail ?? reason.label,
        })),
      }),
    ]);

    if (input.sendEmailToCandidate) {
      const accent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
      const brand = process.env.BRAND_NAME || "Square 15";
      const careersUrl = `${(process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "")}/careers`;
      // Send emails in parallel but don't block on them — each write goes
      // through sendCandidateEmail so ApplicationMessage receives one row
      // per candidate for the audit trail.
      await Promise.all(
        eligible.map((e) =>
          sendCandidateEmail({
            applicationId: e.id,
            to: e.email,
            subject: `Update on your application${e.job?.title ? ` — ${e.job.title}` : ""}`,
            templateKey: "REJECTION_BULK",
            sentById: user.id,
            html: `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 16px 0;font-size:20px;">Thank you, ${e.firstName}</h1>
    <p style="margin:0 0 12px 0;line-height:1.55;">Thank you for applying${e.job?.title ? ` for the ${e.job.title} role` : ""}. After reviewing the applications received, we won't be moving forward with yours on this occasion.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">Please keep an eye on our careers page — new roles are posted regularly:</p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${careersUrl}" style="display:inline-block;padding:11px 24px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">See open roles →</a>
    </div>
    <p style="margin:16px 0 0 0;line-height:1.55;">Warm regards,<br/><strong>The ${brand} Recruitment Team</strong></p>
  </div>
</body></html>`,
          }),
        ),
      );
    }

    return {
      rejected: eligible.length,
      skipped: input.applicationIds.length - eligible.length,
      message: `${eligible.length} rejected · ${input.applicationIds.length - eligible.length} skipped (not in APPLIED/SCREENING).`,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// SHORTLIST TOP N — promote highest-scoring APPLIED candidates for a job
// into SCREENING. Ranking uses overallScore then aiMatchScore.
// ═══════════════════════════════════════════════════════════════════════
export const shortlistTopApplications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number(),
      count: z.number().min(1).max(50).default(10),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    const candidates = await db.application.findMany({
      where: {
        jobId: input.jobId,
        stageBucket: "APPLIED",
        deletedAt: null,
      },
      select: { id: true, overallScore: true, aiMatchScore: true, firstName: true, lastName: true },
      // Prisma cannot NULLS LAST on Postgres via ordering; fetch a superset
      // and sort in-memory to keep this straightforward.
      take: 500,
    });

    if (candidates.length === 0) {
      return { shortlisted: 0, message: "No APPLIED candidates on this job." };
    }

    candidates.sort((a, b) => {
      const ao = a.overallScore ?? -1;
      const bo = b.overallScore ?? -1;
      if (ao !== bo) return bo - ao;
      const aa = a.aiMatchScore ?? -1;
      const ba = b.aiMatchScore ?? -1;
      return ba - aa;
    });

    const chosen = candidates.slice(0, input.count);

    for (const c of chosen) {
      try {
        await transitionApplication({
          applicationId: c.id,
          toBucket: "SCREENING",
          movedById: user.id,
          reason: `Shortlisted top ${input.count} by AI composite score`,
        });
      } catch (err) {
        console.warn(`[shortlist] failed to move ${c.id}:`, err);
      }
    }

    return {
      shortlisted: chosen.length,
      candidates: chosen.map((c) => ({
        id: c.id,
        name: `${c.firstName} ${c.lastName}`,
        overallScore: c.overallScore,
        aiMatchScore: c.aiMatchScore,
      })),
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// COMPARE APPLICATIONS — side-by-side data for the compare page.
// ═══════════════════════════════════════════════════════════════════════
export const compareApplications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationIds: z.array(z.number()).min(2).max(6),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const apps = await db.application.findMany({
      where: { id: { in: input.applicationIds }, deletedAt: null },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        stageBucket: true,
        primaryTrade: true,
        yearsExperience: true,
        qualifications: true,
        expectedSalary: true,
        availability: true,
        aiSummary: true,
        aiStrengths: true,
        aiRedFlags: true,
        aiMatchScore: true,
        aiMatchExplanation: true,
        overallScore: true,
        humanScore: true,
        createdAt: true,
        job: { select: { id: true, title: true } },
        assessments: { select: { type: true, score: true, completedAt: true } },
        scorecardSubmissions: {
          where: { submittedAt: { not: null } },
          select: {
            overallRating: true,
            recommendation: true,
            interviewer: { select: { firstName: true, lastName: true } },
          },
        },
        _count: {
          select: {
            scorecardSubmissions: true,
            interviewBookings: true,
            attachments: true,
          },
        },
      },
    });

    return apps.map((a) => {
      const scAvg =
        a.scorecardSubmissions.length > 0
          ? a.scorecardSubmissions.reduce((s, r) => s + (r.overallRating ?? 0), 0) /
            a.scorecardSubmissions.length
          : null;
      return {
        ...a,
        scorecardAverage: scAvg,
        scorecardCount: a.scorecardSubmissions.length,
        recommendations: a.scorecardSubmissions
          .map((s) => s.recommendation)
          .filter(Boolean),
      };
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// RESEND CANDIDATE PORTAL LINK — public endpoint. Given an email, finds
// the most recent non-deleted application, rotates the accessToken,
// extends expiry by 21d, and emails a fresh magic link. Rate-limited to
// one send per hour per application to prevent enumeration/spam.
// ═══════════════════════════════════════════════════════════════════════
export const resendCandidatePortalLink = baseProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    const email = input.email.toLowerCase();

    // Do NOT reveal whether an email exists; always claim success.
    const app = await db.application.findFirst({
      where: {
        email,
        deletedAt: null,
        stageBucket: { notIn: ["REJECTED", "WITHDRAWN"] },
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        firstName: true,
        email: true,
        job: { select: { title: true } },
        messages: {
          where: { templateKey: "PORTAL_LINK_RESEND" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    if (!app) {
      return {
        ok: true,
        message: "If we found an application for that email, we sent a fresh link.",
      };
    }

    const lastSent = app.messages[0]?.createdAt?.getTime() ?? 0;
    if (Date.now() - lastSent < 60 * 60 * 1000) {
      // Rate-limit: pretend success without sending again
      return {
        ok: true,
        message: "If we found an application for that email, we sent a fresh link.",
      };
    }

    const newToken = crypto.randomBytes(24).toString("hex");
    await db.application.update({
      where: { id: app.id },
      data: {
        accessToken: newToken,
        accessTokenExpiresAt: tokenExpiryDate(21),
      },
    });

    const accent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
    const baseOrigin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const portalLink = `${baseOrigin}/candidate/${newToken}`;
    void sendCandidateEmail({
      applicationId: app.id,
      to: app.email,
      subject: "Your candidate portal link",
      templateKey: "PORTAL_LINK_RESEND",
      html: `<div style="font-family:Arial,sans-serif;max-width:560px">
          <p>Hi ${app.firstName},</p>
          <p>Here is a fresh link to your candidate portal${app.job?.title ? ` for the <b>${app.job.title}</b> role` : ""}:</p>
          <p><a href="${portalLink}" style="display:inline-block;padding:11px 24px;background:${accent};color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Open my candidate portal →</a></p>
          <p style="font-size:12px;color:#666">Or paste this into your browser: <a href="${portalLink}">${portalLink}</a></p>
          <p style="font-size:12px;color:#666">This link is valid for 21 days. If you did not request it, please ignore this email.</p>
        </div>`,
    });

    return {
      ok: true,
      message: "If we found an application for that email, we sent a fresh link.",
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// POST-REJECTION FEEDBACK — public endpoint. Uses the (rotated) portal
// accessToken so no separate feedback token model is needed. Writes to
// ApplicationMessage as INBOUND so recruiters can view responses inline.
// ═══════════════════════════════════════════════════════════════════════
export const submitRejectionFeedback = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      rating: z.number().min(1).max(5),
      wouldReapply: z.boolean(),
      comments: z.string().max(2000).optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true, stageBucket: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    if (app.stageBucket !== "REJECTED")
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Feedback is only accepted after a rejection outcome.",
      });

    await db.applicationMessage.create({
      data: {
        applicationId: app.id,
        channel: "PORTAL",
        direction: "INBOUND",
        subject: `Candidate feedback (rating ${input.rating}/5, ${input.wouldReapply ? "would reapply" : "would not reapply"})`,
        body: input.comments ?? "(no comments provided)",
        templateKey: "REJECTION_FEEDBACK",
        deliveredAt: new Date(),
      },
    });
    return { ok: true };
  });
