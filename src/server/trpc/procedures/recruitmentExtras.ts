/**
 * Recruitment 2.0 — Candidate portal, Talent pool, Compliance, Analytics.
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import {
  assertRecruiter,
  assertAdmin,
  assertHiringManager,
  logConsent,
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
