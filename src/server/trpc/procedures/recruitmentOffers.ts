/**
 * Recruitment 2.0 — Offer management with approval chain + internal e-signature.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";
import { assertHiringManager, assertRecruiter, transitionApplication } from "~/server/services/recruitment/atsHelpers";


function compensationHtml(o: {
  currency: string; baseSalary: number; salaryPeriod: string;
  hourlyRate: number | null; dailyRate: number | null; monthlySalary: number | null;
}): string {
  const lines: string[] = [];
  if (o.monthlySalary != null && o.monthlySalary > 0)
    lines.push(`Monthly salary: <b>${o.currency} ${o.monthlySalary.toLocaleString()}</b>`);
  if (o.dailyRate != null && o.dailyRate > 0)
    lines.push(`Daily rate: <b>${o.currency} ${o.dailyRate.toLocaleString()}/day</b>`);
  if (o.hourlyRate != null && o.hourlyRate > 0)
    lines.push(`Hourly rate: <b>${o.currency} ${o.hourlyRate.toLocaleString()}/hr</b>`);
  if (lines.length === 0 && o.baseSalary > 0)
    lines.push(`Base: <b>${o.currency} ${o.baseSalary.toLocaleString()} / ${o.salaryPeriod.toLowerCase()}</b>`);
  return lines.map((l) => `<p>${l}</p>`).join("");
}

export const createOffer = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      title: z.string(),
      startDate: z.date(),
      baseSalary: z.number().default(0),
      currency: z.string().default("ZAR"),
      salaryPeriod: z.enum(["MONTHLY", "ANNUAL", "HOURLY", "DAILY", "HOURLY_PLUS_DAILY", "NONE"]).default("MONTHLY"),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      monthlySalary: z.number().optional(),
      bonus: z.number().optional(),
      benefits: z.string().optional(),
      otherTerms: z.string().optional(),
      expiresInDays: z.number().min(1).max(60).default(7),
      approverIds: z.array(z.number()).default([]),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + input.expiresInDays);

    const offer = await db.offer.create({
      data: {
        applicationId: input.applicationId,
        title: input.title,
        startDate: input.startDate,
        baseSalary: input.baseSalary,
        currency: input.currency,
        salaryPeriod: input.salaryPeriod,
        hourlyRate: input.hourlyRate ?? null,
        dailyRate: input.dailyRate ?? null,
        monthlySalary: input.monthlySalary ?? null,
        bonus: input.bonus,
        benefits: input.benefits,
        otherTerms: input.otherTerms,
        expiresAt,
        status: input.approverIds.length > 0 ? "PENDING_APPROVAL" : "DRAFT",
        createdById: user.id,
      },
    });

    if (input.approverIds.length > 0) {
      await db.offerApproval.createMany({
        data: input.approverIds.map((approverId, i) => ({
          offerId: offer.id,
          approverId,
          order: i + 1,
        })),
      });

      const approvers = await db.user.findMany({
        where: { id: { in: input.approverIds } },
        select: { email: true, firstName: true },
      });
      for (const a of approvers) {
        sendEmail({
          to: a.email,
          subject: "Offer pending your approval",
          html: `<p>Hi ${a.firstName},</p>
                 <p>An offer for <b>${input.title}</b> requires your approval.</p>
                 <p>Please review in the recruitment portal.</p>`,
        }).catch(() => {});
      }
    }

    await transitionApplication({
      applicationId: input.applicationId,
      toBucket: "OFFER",
      movedById: user.id,
      reason: "Offer created",
    });

    return offer;
  });

export const approveOffer = baseProcedure
  .input(
    z.object({
      token: z.string(),
      approvalId: z.number(),
      decision: z.enum(["APPROVED", "REJECTED"]),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const approval = await db.offerApproval.findUnique({ where: { id: input.approvalId } });
    if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
    if (approval.approverId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your approval" });

    await db.offerApproval.update({
      where: { id: input.approvalId },
      data: { decision: input.decision, notes: input.notes, decidedAt: new Date() },
    });

    // If all approved, move offer to APPROVED
    const remaining = await db.offerApproval.count({
      where: { offerId: approval.offerId, decision: { not: "APPROVED" } },
    });
    if (remaining === 0) {
      await db.offer.update({ where: { id: approval.offerId }, data: { status: "APPROVED" } });
    } else if (input.decision === "REJECTED") {
      await db.offer.update({ where: { id: approval.offerId }, data: { status: "WITHDRAWN" } });
    }
    return { success: true };
  });

export const sendOffer = baseProcedure
  .input(z.object({ token: z.string(), offerId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const offer = await db.offer.findUnique({
      where: { id: input.offerId },
      include: { application: true },
    });
    if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
    // Allow send from DRAFT (fast-track, no approval chain) or APPROVED
    if (offer.status !== "APPROVED" && offer.status !== "DRAFT" && offer.status !== "PENDING_APPROVAL") {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `Cannot send an offer in ${offer.status} state`,
      });
    }
    const updated = await db.offer.update({
      where: { id: offer.id },
      data: { status: "SENT", sentAt: new Date() },
    });
    void sendCandidateEmail({
      applicationId: offer.applicationId,
      to: offer.application.email,
      subject: `Offer: ${offer.title}`,
      templateKey: "OFFER_SENT",
      sentById: user.id,
      html: `<p>Hi ${offer.application.firstName},</p>
             <p>We are delighted to offer you the role of <b>${offer.title}</b>.</p>
             ${compensationHtml(offer)}
             <p>Start date: ${offer.startDate.toLocaleDateString()}</p>
             <p>Please review and respond before <b>${offer.expiresAt?.toLocaleString() ?? ""}</b>:</p>
             <p><a href="${process.env.APP_URL ?? ""}/offer/${offer.signToken}">Review &amp; sign offer</a></p>`,
      companionMessage: `Your offer for ${offer.title} is ready. Base ${offer.currency} ${offer.baseSalary}/${offer.salaryPeriod.toLowerCase()}, start ${offer.startDate.toLocaleDateString()}. Review & sign on your portal.`,
    });
    return updated;
  });

export const withdrawOffer = baseProcedure
  .input(z.object({ token: z.string(), offerId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.offer.update({
      where: { id: input.offerId },
      data: { status: "WITHDRAWN", withdrawnAt: new Date() },
    });
  });

// Candidate-side public endpoints (token)
export const getOfferByToken = baseProcedure
  .input(z.object({ signToken: z.string() }))
  .query(async ({ input }) => {
    const offer = await db.offer.findUnique({
      where: { signToken: input.signToken },
      include: {
        application: {
          select: { firstName: true, lastName: true, email: true, job: { select: { title: true, department: true, location: true } } },
        },
      },
    });
    if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
    // Mark viewed
    if (!offer.viewedAt && (offer.status === "SENT" || offer.status === "APPROVED")) {
      await db.offer.update({
        where: { id: offer.id },
        data: { viewedAt: new Date(), status: "VIEWED" },
      });
    }
    return offer;
  });

export const acceptOffer = baseProcedure
  .input(
    z.object({
      signToken: z.string(),
      signatureName: z.string().optional(), // captured but not required — full signing happens at contract stage
      initials: z.string().optional(),
      ip: z.string().optional(),
      userAgent: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const offer = await db.offer.findUnique({
      where: { signToken: input.signToken },
      include: { application: true },
    });
    if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
    if (!["SENT", "VIEWED"].includes(offer.status))
      throw new TRPCError({ code: "BAD_REQUEST", message: `Cannot accept from ${offer.status}` });
    if (offer.expiresAt && offer.expiresAt < new Date())
      throw new TRPCError({ code: "BAD_REQUEST", message: "Offer has expired" });

    const updated = await db.offer.update({
      where: { id: offer.id },
      data: {
        status: "ACCEPTED",
        acceptedAt: new Date(),
        respondedAt: new Date(),
        candidateSignature: input.signatureName ?? null,
        candidateInitials: input.initials ?? null,
        candidateSignedAt: input.signatureName ? new Date() : null,
        candidateSignIp: input.ip ?? null,
        candidateSignUserAgent: input.userAgent ?? null,
      },
    });

    // Auto-move to HIRED bucket
    await transitionApplication({
      applicationId: offer.applicationId,
      toBucket: "HIRED",
      reason: "Offer accepted",
    });
    await db.application.update({
      where: { id: offer.applicationId },
      data: { hiredAt: new Date() },
    });
    return updated;
  });

export const declineOffer = baseProcedure
  .input(
    z.object({
      signToken: z.string(),
      reason: z.string().min(10, "Please give a reason of at least 10 characters"),
    }),
  )
  .mutation(async ({ input }) => {
    const offer = await db.offer.findUnique({ where: { signToken: input.signToken } });
    if (!offer) throw new TRPCError({ code: "NOT_FOUND" });
    return db.offer.update({
      where: { id: offer.id },
      data: {
        status: "DECLINED",
        declinedAt: new Date(),
        respondedAt: new Date(),
        declineReason: input.reason,
      },
    });
  });

export const listOffers = baseProcedure
  .input(z.object({ token: z.string(), status: z.string().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = {};
    if (input.status) where.status = input.status;
    return db.offer.findMany({
      where,
      include: {
        application: { select: { firstName: true, lastName: true, email: true } },
        approvals: { include: { approver: { select: { firstName: true, lastName: true } } } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

export const getAcceptedOfferForApplication = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);
    const offer = await db.offer.findFirst({
      where: { applicationId: input.applicationId, status: "ACCEPTED" },
      orderBy: { acceptedAt: "desc" },
    });
    return offer;
  });
