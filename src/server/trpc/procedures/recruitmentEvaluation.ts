/**
 * Recruitment 2.0 — Scorecards, Interviews, Background, Reference checks.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import {
  assertRecruiter,
  assertHiringManager,
  recomputeApplicationScore,
} from "~/server/services/recruitment/atsHelpers";
import { generateICS } from "~/server/services/recruitment/scheduling";

const gemini = google("gemini-2.0-flash");

// ═══════════════════════════════════════════════════════════════════════
// SCORECARDS
// ═══════════════════════════════════════════════════════════════════════

export const createScorecard = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
      description: z.string().optional(),
      isTemplate: z.boolean().default(false),
      jobId: z.number().optional(),
      criteria: z
        .array(
          z.object({
            name: z.string(),
            description: z.string().optional(),
            weight: z.number().default(1),
            order: z.number(),
          }),
        )
        .min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.scorecard.create({
      data: {
        name: input.name,
        description: input.description,
        isTemplate: input.isTemplate,
        jobId: input.jobId ?? null,
        criteria: { create: input.criteria },
      },
      include: { criteria: true },
    });
  });

export const getScorecards = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = {};
    if (input.jobId) where.OR = [{ jobId: input.jobId }, { isTemplate: true }];
    return db.scorecard.findMany({
      where,
      include: { criteria: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  });

export const submitScorecard = baseProcedure
  .input(
    z.object({
      token: z.string(),
      scorecardId: z.number(),
      applicationId: z.number(),
      stage: z.string().optional(),
      overallRating: z.number().min(1).max(5),
      recommendation: z.enum(["STRONG_HIRE", "HIRE", "NO_HIRE", "STRONG_NO_HIRE"]),
      strengths: z.string().optional(),
      concerns: z.string().optional(),
      notes: z.string().optional(),
      ratings: z.record(z.number()).optional(),
      blindMode: z.boolean().default(false),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const submission = await db.scorecardSubmission.create({
      data: {
        scorecardId: input.scorecardId,
        applicationId: input.applicationId,
        interviewerId: user.id,
        stage: input.stage,
        overallRating: input.overallRating,
        recommendation: input.recommendation,
        strengths: input.strengths,
        concerns: input.concerns,
        notes: input.notes,
        ratings: input.ratings,
        blindMode: input.blindMode,
        submittedAt: new Date(),
      },
    });
    await recomputeApplicationScore(input.applicationId);
    return submission;
  });

// ═══════════════════════════════════════════════════════════════════════
// INTERVIEW PANELS & SCHEDULING
// ═══════════════════════════════════════════════════════════════════════

export const createInterviewPanel = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
      jobId: z.number().optional(),
      memberIds: z.array(z.number()).min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.interviewPanel.create({
      data: {
        name: input.name,
        jobId: input.jobId,
        members: { create: input.memberIds.map((id) => ({ userId: id })) },
      },
      include: { members: { include: { user: true } } },
    });
  });

export const createInterviewSlot = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startTime: z.date(),
      endTime: z.date(),
      timezone: z.string().default("Africa/Johannesburg"),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    return db.interviewSlot.create({
      data: {
        interviewerId: user.id,
        startTime: input.startTime,
        endTime: input.endTime,
        timezone: input.timezone,
        available: true,
      },
    });
  });

export const getMyInterviewSlots = baseProcedure
  .input(z.object({ token: z.string(), from: z.date().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    return db.interviewSlot.findMany({
      where: {
        interviewerId: user.id,
        startTime: { gte: input.from ?? new Date() },
      },
      include: { booking: { select: { id: true, applicationId: true, status: true } } },
      orderBy: { startTime: "asc" },
    });
  });

export const listAvailableSlots = baseProcedure
  .input(
    z.object({
      token: z.string(),
      interviewerIds: z.array(z.number()).optional(),
      from: z.date().optional(),
      to: z.date().optional(),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = {
      available: true,
      booking: { is: null },
      startTime: { gte: input.from ?? new Date() },
    };
    if (input.to) where.startTime = { ...where.startTime, lte: input.to };
    if (input.interviewerIds?.length) where.interviewerId = { in: input.interviewerIds };
    return db.interviewSlot.findMany({
      where,
      include: {
        interviewer: { select: { id: true, firstName: true, lastName: true, email: true } },
      },
      orderBy: { startTime: "asc" },
      take: 500,
    });
  });

export const bookInterview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      slotId: z.number().optional(),
      panelId: z.number().optional(),
      scheduledStart: z.date(),
      scheduledEnd: z.date(),
      location: z.string().default("VIDEO"),
      meetingUrl: z.string().optional(),
      stage: z.string().optional(),
      agenda: z.string().optional(),
      notifyCandidate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    if (input.slotId) {
      const existing = await db.interviewBooking.findFirst({
        where: { slotId: input.slotId },
      });
      if (existing) throw new TRPCError({ code: "CONFLICT", message: "Slot already booked" });
    }

    const booking = await db.interviewBooking.create({
      data: {
        applicationId: input.applicationId,
        slotId: input.slotId,
        panelId: input.panelId,
        scheduledStart: input.scheduledStart,
        scheduledEnd: input.scheduledEnd,
        location: input.location,
        meetingUrl: input.meetingUrl,
        stage: input.stage,
        agenda: input.agenda,
        createdById: user.id,
        status: "SCHEDULED",
      },
      include: { application: true, panel: { include: { members: { include: { user: true } } } } },
    });

    if (input.slotId) {
      await db.interviewSlot.update({
        where: { id: input.slotId },
        data: { available: false },
      });
    }

    // Send notifications with .ics
    if (input.notifyCandidate) {
      const ics = generateICS({
        uid: `interview-${booking.id}@sqr15`,
        summary: `Interview for ${booking.application.firstName} ${booking.application.lastName}`,
        description: booking.agenda ?? "Interview",
        location: booking.meetingUrl || booking.location || "",
        start: booking.scheduledStart,
        end: booking.scheduledEnd,
        attendeeEmails: [booking.application.email],
      });

      sendEmail({
        to: booking.application.email,
        subject: "Your interview is scheduled",
        html: `<p>Hi ${booking.application.firstName},</p>
               <p>Your interview is scheduled for <b>${booking.scheduledStart.toLocaleString()}</b>.</p>
               ${booking.meetingUrl ? `<p>Meeting link: <a href="${booking.meetingUrl}">${booking.meetingUrl}</a></p>` : ""}
               <p>Agenda: ${booking.agenda ?? "General interview"}</p>
               <p>See the attached calendar invite.</p>`,
        attachments: [
          {
            filename: "interview.ics",
            content: Buffer.from(ics, "utf8"),
            contentType: "text/calendar",
          } as any,
        ],
      }).catch(() => {});

      await db.interviewBooking.update({
        where: { id: booking.id },
        data: { candidateNotifiedAt: new Date() },
      });
    }

    // Notify panel members
    const panelEmails =
      booking.panel?.members.map((m) => m.user.email).filter(Boolean) ?? [];
    if (panelEmails.length) {
      sendEmail({
        to: panelEmails,
        subject: `Interview scheduled: ${booking.application.firstName} ${booking.application.lastName}`,
        html: `<p>You are on the panel for this interview.</p>
               <p>Candidate: <b>${booking.application.firstName} ${booking.application.lastName}</b></p>
               <p>Time: ${booking.scheduledStart.toLocaleString()}</p>
               <p>Please submit a scorecard after the interview.</p>`,
      }).catch(() => {});
    }

    return booking;
  });

export const cancelInterview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bookingId: z.number(),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const b = await db.interviewBooking.update({
      where: { id: input.bookingId },
      data: { status: "CANCELLED", cancellationReason: input.reason },
      include: { application: true },
    });
    if (b.slotId) {
      await db.interviewSlot.update({ where: { id: b.slotId }, data: { available: true } });
    }
    sendEmail({
      to: b.application.email,
      subject: "Your interview has been cancelled",
      html: `<p>We regret to inform you that the interview scheduled for ${b.scheduledStart.toLocaleString()} has been cancelled. We will reach out to reschedule.</p>`,
    }).catch(() => {});
    return b;
  });

export const completeInterview = baseProcedure
  .input(z.object({ token: z.string(), bookingId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.interviewBooking.update({
      where: { id: input.bookingId },
      data: { status: "COMPLETED", completedAt: new Date() },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// BACKGROUND CHECKS (internal stub provider, pluggable)
// ═══════════════════════════════════════════════════════════════════════

export const requestBackgroundCheck = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      checkTypes: z.array(z.string()).min(1),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.backgroundCheck.create({
      data: {
        applicationId: input.applicationId,
        requestedById: user.id,
        checkTypes: input.checkTypes,
        status: "PENDING",
        provider: "INTERNAL",
      },
    });
  });

export const updateBackgroundCheck = baseProcedure
  .input(
    z.object({
      token: z.string(),
      checkId: z.number(),
      status: z.enum(["PENDING", "IN_PROGRESS", "COMPLETED", "FAILED"]),
      result: z.enum(["CLEAR", "FLAGGED", "FAILED"]).optional(),
      summary: z.string().optional(),
      reportUrl: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.backgroundCheck.update({
      where: { id: input.checkId },
      data: {
        status: input.status,
        result: input.result,
        summary: input.summary,
        reportUrl: input.reportUrl,
        completedAt: input.status === "COMPLETED" ? new Date() : undefined,
      },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// REFERENCE CHECKS — email-based workflow with token
// ═══════════════════════════════════════════════════════════════════════

export const requestReferenceCheck = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      refereeName: z.string(),
      refereeEmail: z.string().email(),
      refereePhone: z.string().optional(),
      relationship: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      select: { firstName: true, lastName: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    const ref = await db.referenceCheck.create({
      data: {
        applicationId: input.applicationId,
        refereeName: input.refereeName,
        refereeEmail: input.refereeEmail.toLowerCase(),
        refereePhone: input.refereePhone,
        relationship: input.relationship,
        status: "SENT",
        sentAt: new Date(),
      },
    });
    sendEmail({
      to: ref.refereeEmail,
      subject: `Reference request for ${app.firstName} ${app.lastName}`,
      html: `<p>Dear ${ref.refereeName},</p>
             <p>${app.firstName} ${app.lastName} has listed you as a professional reference. Please complete a short reference form:</p>
             <p><a href="${process.env.APP_URL ?? ""}/reference/${ref.token}">Complete reference form</a></p>
             <p>Thank you for your time.</p>`,
    }).catch(() => {});
    return ref;
  });

export const submitReferenceResponse = baseProcedure
  .input(
    z.object({
      token: z.string(),
      responses: z.object({
        strengths: z.string(),
        weaknesses: z.string(),
        reliability: z.number().min(1).max(5),
        recommendation: z.enum(["STRONG_YES", "YES", "NEUTRAL", "NO", "STRONG_NO"]),
        wouldRehire: z.boolean(),
        comments: z.string().optional(),
      }),
    }),
  )
  .mutation(async ({ input }) => {
    const ref = await db.referenceCheck.findUnique({ where: { token: input.token } });
    if (!ref) throw new TRPCError({ code: "NOT_FOUND" });
    if (ref.completedAt)
      throw new TRPCError({ code: "BAD_REQUEST", message: "Already submitted" });

    // AI summary
    let aiSummary: string | null = null;
    try {
      const { text } = await generateText({
        model: gemini,
        prompt: `Summarize this professional reference in 2 sentences and give a 1-5 rating:
Strengths: ${input.responses.strengths}
Weaknesses: ${input.responses.weaknesses}
Reliability: ${input.responses.reliability}/5
Recommendation: ${input.responses.recommendation}
Would rehire: ${input.responses.wouldRehire}
Comments: ${input.responses.comments ?? ""}
Output: {"summary": "...", "rating": <1-5>}`,
        maxTokens: 250,
      });
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        const parsed = JSON.parse(match[0]);
        aiSummary = parsed.summary;
      }
    } catch {}

    const rating =
      input.responses.recommendation === "STRONG_YES"
        ? 5
        : input.responses.recommendation === "YES"
        ? 4
        : input.responses.recommendation === "NEUTRAL"
        ? 3
        : input.responses.recommendation === "NO"
        ? 2
        : 1;

    return db.referenceCheck.update({
      where: { id: ref.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date(),
        responses: input.responses,
        aiSummary,
        rating,
      },
    });
  });
