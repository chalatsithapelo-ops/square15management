/**
 * Recruitment 2.0 — Jobs, Pipelines, Applications (core ATS procedures).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import {
  assertRecruiter,
  assertHiringManager,
  tokenExpiryDate,
  retentionCutoff,
  transitionApplication,
  computeAIMatchScore,
  recomputeApplicationScore,
  logConsent,
  assertScorecardExistsForDecision,
  assertHiringPreconditions,
} from "~/server/services/recruitment/atsHelpers";
import {
  kickoffApplicationAI,
  autoRequestReferences,
  notifyReferrerOnHired,
  logAiDecision,
} from "~/server/services/recruitment/atsAutomation";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";

// ═══════════════════════════════════════════════════════════════════════
// JOBS
// ═══════════════════════════════════════════════════════════════════════

export const createJob = baseProcedure
  .input(
    z.object({
      token: z.string(),
      title: z.string().min(3),
      department: z.string().optional(),
      location: z.string().optional(),
      province: z.string().optional(),
      employmentType: z
        .enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "APPRENTICESHIP"])
        .default("FULL_TIME"),
      experienceLevel: z.string().optional(),
      description: z.string().min(10),
      responsibilities: z.string().optional(),
      requirements: z.string().optional(),
      niceToHaves: z.string().optional(),
      minSalary: z.number().optional(),
      maxSalary: z.number().optional(),
      salaryPeriod: z
        .enum(["MONTHLY", "DAILY", "HOURLY", "WEEKLY", "ANNUAL"])
        .default("MONTHLY"),
      marketRelated: z.boolean().default(false),
      currency: z.string().default("ZAR"),
      headcount: z.number().min(1).default(1),
      visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).default("PUBLIC"),
      category: z.string().optional(),
      hiringManagerId: z.number().optional(),
      recruiterId: z.number().optional(),
      pipelineId: z.number().optional(),
      requireIQ: z.boolean().default(true),
      requireEQ: z.boolean().default(true),
      requireBigFive: z.boolean().default(true),
      requireMBTI: z.boolean().default(true),
      requireSJT: z.boolean().default(false),
      requireWorkSample: z.boolean().default(true),
      requireInterview: z.boolean().default(true),
      scoringWeights: z.record(z.number()).optional(),
      competencies: z.array(z.string()).default([]),
      targetCloseDate: z.date().optional(),
      approverIds: z.array(z.number()).default([]),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const { token, approverIds, ...jobData } = input;

    const job = await db.job.create({
      data: {
        ...jobData,
        createdById: user.id,
        openings: jobData.headcount,
        status: approverIds.length > 0 ? "PENDING_APPROVAL" : "DRAFT",
      },
    });

    if (approverIds.length > 0) {
      await db.jobApproval.createMany({
        data: approverIds.map((approverId, i) => ({
          jobId: job.id,
          approverId,
          order: i + 1,
        })),
      });
    }
    return job;
  });

export const updateJob = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number(),
      title: z.string().optional(),
      department: z.string().optional(),
      location: z.string().optional(),
      description: z.string().optional(),
      responsibilities: z.string().optional(),
      requirements: z.string().optional(),
      niceToHaves: z.string().optional(),
      minSalary: z.number().optional(),
      maxSalary: z.number().optional(),
      salaryPeriod: z
        .enum(["MONTHLY", "DAILY", "HOURLY", "WEEKLY", "ANNUAL"])
        .optional(),
      marketRelated: z.boolean().optional(),
      headcount: z.number().optional(),
      hiringManagerId: z.number().optional(),
      recruiterId: z.number().optional(),
      competencies: z.array(z.string()).optional(),
      scoringWeights: z.record(z.number()).optional(),
      targetCloseDate: z.date().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const { token, jobId, ...data } = input;
    return db.job.update({ where: { id: jobId }, data });
  });

export const publishJob = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: { approvals: true },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    const pending = job.approvals.filter((a) => a.decision !== "APPROVED");
    if (pending.length > 0) {
      throw new TRPCError({
        code: "PRECONDITION_FAILED",
        message: `${pending.length} approval(s) pending`,
      });
    }
    return db.job.update({
      where: { id: input.jobId },
      data: { status: "OPEN", openedAt: new Date() },
    });
  });

export const closeJob = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number(), reason: z.string().optional() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.job.update({
      where: { id: input.jobId },
      data: { status: "CLOSED", closedAt: new Date() },
    });
  });

export const approveJobApproval = baseProcedure
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
    const approval = await db.jobApproval.findUnique({ where: { id: input.approvalId } });
    if (!approval) throw new TRPCError({ code: "NOT_FOUND" });
    if (approval.approverId !== user.id)
      throw new TRPCError({ code: "FORBIDDEN", message: "Not your approval" });
    return db.jobApproval.update({
      where: { id: input.approvalId },
      data: { decision: input.decision, notes: input.notes, decidedAt: new Date() },
    });
  });

export const getJobs = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
      search: z.string().optional(),
      mineOnly: z.boolean().default(false),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = {};
    if (input.status) where.status = input.status;
    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: "insensitive" } },
        { department: { contains: input.search, mode: "insensitive" } },
        { category: { contains: input.search, mode: "insensitive" } },
      ];
    }
    if (input.mineOnly) {
      where.OR = [
        ...(where.OR ?? []),
        { hiringManagerId: user.id },
        { recruiterId: user.id },
        { createdById: user.id },
      ];
    }
    const jobs = await db.job.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { applications: true } },
        hiringManager: { select: { id: true, firstName: true, lastName: true } },
        recruiter: { select: { id: true, firstName: true, lastName: true } },
      },
      take: 200,
    });
    return jobs;
  });

export const getJobDetail = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const job = await db.job.findUnique({
      where: { id: input.jobId },
      include: {
        pipeline: { include: { stages: { orderBy: { order: "asc" } } } },
        customStages: { orderBy: { order: "asc" } },
        approvals: {
          include: { approver: { select: { firstName: true, lastName: true, email: true } } },
          orderBy: { order: "asc" },
        },
        hiringManager: { select: { id: true, firstName: true, lastName: true, email: true } },
        recruiter: { select: { id: true, firstName: true, lastName: true, email: true } },
        scorecards: { include: { criteria: true } },
        interviewPanels: {
          include: {
            members: {
              include: { user: { select: { id: true, firstName: true, lastName: true } } },
            },
          },
        },
        _count: { select: { applications: true } },
      },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  });

// Public: listing open jobs (career site)
export const listPublicJobs = baseProcedure
  .input(z.object({ category: z.string().optional(), search: z.string().optional() }))
  .query(async ({ input }) => {
    const where: any = { status: "OPEN", visibility: { in: ["PUBLIC"] } };
    if (input.category) where.category = input.category;
    if (input.search) {
      where.OR = [
        { title: { contains: input.search, mode: "insensitive" } },
        { description: { contains: input.search, mode: "insensitive" } },
      ];
    }
    return db.job.findMany({
      where,
      orderBy: { openedAt: "desc" },
      select: {
        id: true,
        slug: true,
        title: true,
        department: true,
        location: true,
        province: true,
        employmentType: true,
        experienceLevel: true,
        category: true,
        description: true,
        minSalary: true,
        maxSalary: true,
        salaryPeriod: true,
        marketRelated: true,
        currency: true,
        openedAt: true,
      },
      take: 100,
    });
  });

export const getPublicJob = baseProcedure
  .input(z.object({ slug: z.string() }))
  .query(async ({ input }) => {
    const job = await db.job.findUnique({
      where: { slug: input.slug },
      select: {
        id: true,
        slug: true,
        title: true,
        department: true,
        location: true,
        province: true,
        employmentType: true,
        experienceLevel: true,
        category: true,
        description: true,
        responsibilities: true,
        requirements: true,
        niceToHaves: true,
        minSalary: true,
        maxSalary: true,
        salaryPeriod: true,
        marketRelated: true,
        currency: true,
        openedAt: true,
        status: true,
        visibility: true,
      },
    });
    if (!job || job.status !== "OPEN" || job.visibility === "PRIVATE")
      throw new TRPCError({ code: "NOT_FOUND" });
    return job;
  });

// ═══════════════════════════════════════════════════════════════════════
// PIPELINES
// ═══════════════════════════════════════════════════════════════════════

export const createPipeline = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
      description: z.string().optional(),
      isDefault: z.boolean().default(false),
      stages: z.array(
        z.object({
          name: z.string(),
          order: z.number(),
          bucket: z.enum([
            "APPLIED",
            "SCREENING",
            "ASSESSMENT",
            "INTERVIEW",
            "OFFER",
            "BACKGROUND_CHECK",
            "HIRED",
            "REJECTED",
            "WITHDRAWN",
            "ON_HOLD",
          ]),
          slaHours: z.number().optional(),
          autoAdvance: z.boolean().default(false),
          requiresScorecard: z.boolean().default(false),
        }),
      ),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    if (input.isDefault) {
      await db.jobPipeline.updateMany({ where: {}, data: { isDefault: false } });
    }
    return db.jobPipeline.create({
      data: {
        name: input.name,
        description: input.description,
        isDefault: input.isDefault,
        stages: {
          create: input.stages.map((s) => ({
            name: s.name,
            order: s.order,
            bucket: s.bucket,
            slaHours: s.slaHours,
            autoAdvance: s.autoAdvance,
            requiresScorecard: s.requiresScorecard,
          })),
        },
      },
      include: { stages: { orderBy: { order: "asc" } } },
    });
  });

export const getPipelines = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.jobPipeline.findMany({
      include: { stages: { orderBy: { order: "asc" } } },
      orderBy: { createdAt: "desc" },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// APPLICATIONS — public submit
// ═══════════════════════════════════════════════════════════════════════

export const createApplication = baseProcedure
  .input(
    z.object({
      jobSlug: z.string().optional(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().optional(),
      primaryTrade: z.string().optional(),
      yearsExperience: z.number().optional(),
      qualifications: z.string().optional(),
      motivationLetter: z.string().optional(),
      linkedInUrl: z.string().optional(),
      resumeUrl: z.string().optional(),
      portfolioUrls: z.array(z.string()).default([]),
      expectedSalary: z.string().optional(),
      availability: z.string().optional(),
      idNumber: z.string().optional(),
      city: z.string().optional(),
      province: z.string().optional(),
      // Source + UTM
      sourceChannel: z
        .enum([
          "CAREER_SITE",
          "REFERRAL",
          "LINKEDIN",
          "INDEED",
          "FACEBOOK",
          "WHATSAPP",
          "WALK_IN",
          "AGENCY",
          "INTERNAL",
          "REDISCOVERY",
          "OTHER",
        ])
        .default("CAREER_SITE"),
      sourceDetail: z.string().optional(),
      referrerEmail: z.string().email().optional(),
      utm: z
        .object({
          source: z.string().optional(),
          medium: z.string().optional(),
          campaign: z.string().optional(),
          content: z.string().optional(),
          term: z.string().optional(),
        })
        .optional(),
      landingUrl: z.string().optional(),
      // Consent
      consent: z.object({
        granted: z.literal(true),
        version: z.string(),
        privacyPolicyVersion: z.string(),
        ip: z.string().optional(),
        userAgent: z.string().optional(),
      }),
      // Optional EEA (voluntary)
      demographic: z
        .object({
          race: z.string().optional(),
          gender: z.string().optional(),
          disability: z.string().optional(),
          nationality: z.string().optional(),
        })
        .optional(),
      // Uploaded documents (CV + qualification certificates)
      attachments: z
        .array(
          z.object({
            label: z.string().min(1).max(120),
            fileName: z.string().min(1).max(240),
            fileUrl: z.string().min(1),
            fileType: z.string().optional(),
          }),
        )
        .max(20)
        .default([]),
    }),
  )
  .mutation(async ({ input }) => {
    let job: {
      id: number;
      title: string;
      status: string;
      visibility: string;
      recruiterId: number | null;
      hiringManagerId: number | null;
      pipelineId: number | null;
    } | null = null;
    if (input.jobSlug) {
      job = await db.job.findUnique({
        where: { slug: input.jobSlug },
        select: {
          id: true,
          title: true,
          status: true,
          visibility: true,
          recruiterId: true,
          hiringManagerId: true,
          pipelineId: true,
        },
      });
      if (!job || job.status !== "OPEN")
        throw new TRPCError({ code: "BAD_REQUEST", message: "Job not open" });
    }

    // Rate limit
    const dup = await db.application.findFirst({
      where: {
        email: input.email.toLowerCase(),
        jobId: job?.id ?? null,
        createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
      },
      select: { id: true },
    });
    if (dup)
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You already applied for this role in the last 24 hours.",
      });

    let referrerUserId: number | null = null;
    if (input.referrerEmail) {
      const r = await db.user.findFirst({
        where: { email: input.referrerEmail.toLowerCase() },
        select: { id: true },
      });
      referrerUserId = r?.id ?? null;
    }

    // Resolve the first pipeline stage (bucket=APPLIED) so the candidate
    // lands on a real stage and the recruiter kanban shows them immediately.
    let firstStage: { id: number } | null = null;
    if (job?.pipelineId) {
      firstStage = await db.jobPipelineStage.findFirst({
        where: { pipelineId: job.pipelineId, bucket: "APPLIED" },
        orderBy: { order: "asc" },
        select: { id: true },
      });
    }
    if (!firstStage) {
      // Fall back to the default pipeline's APPLIED stage
      firstStage = await db.jobPipelineStage.findFirst({
        where: { bucket: "APPLIED", pipeline: { isDefault: true } },
        orderBy: { order: "asc" },
        select: { id: true },
      });
    }

    // Auto-assign a recruiter so applications don't sit orphaned:
    //   1) The job's designated recruiter, if set.
    //   2) Otherwise round-robin the recruiter with the fewest open applications.
    let assignedRecruiterId: number | null = job?.recruiterId ?? null;
    if (!assignedRecruiterId) {
      // NOTE: User has no `isActive` column — filter by role only.
      const eligible = await db.user.findMany({
        where: {
          role: { in: ["ADMIN", "SENIOR_ADMIN", "MANAGER", "HR", "RECRUITER"] },
        },
        select: { id: true },
      });
      if (eligible.length > 0) {
        const counts = await db.application.groupBy({
          by: ["assignedRecruiterId"],
          where: {
            assignedRecruiterId: { in: eligible.map((e) => e.id) },
            stageBucket: { notIn: ["HIRED", "REJECTED", "WITHDRAWN"] },
          },
          _count: { _all: true },
        });
        const loadMap = new Map(counts.map((c) => [c.assignedRecruiterId!, c._count._all]));
        eligible.sort(
          (a, b) => (loadMap.get(a.id) ?? 0) - (loadMap.get(b.id) ?? 0) || a.id - b.id,
        );
        assignedRecruiterId = eligible[0]?.id ?? null;
      }
    }

    const app = await db.application.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone,
        primaryTrade: input.primaryTrade,
        yearsExperience: input.yearsExperience,
        qualifications: input.qualifications,
        motivationLetter: input.motivationLetter,
        linkedInUrl: input.linkedInUrl,
        resumeUrl: input.resumeUrl,
        portfolioUrls: input.portfolioUrls,
        expectedSalary: input.expectedSalary,
        availability: input.availability,
        idNumber: input.idNumber,
        city: input.city,
        province: input.province,
        jobId: job?.id ?? null,
        currentStageId: firstStage?.id ?? null,
        assignedRecruiterId,
        sourceChannel: input.sourceChannel,
        sourceDetail: input.sourceDetail,
        referrerUserId,
        utmSource: input.utm?.source,
        utmMedium: input.utm?.medium,
        utmCampaign: input.utm?.campaign,
        utmContent: input.utm?.content,
        utmTerm: input.utm?.term,
        landingUrl: input.landingUrl,
        consentGivenAt: new Date(),
        consentVersion: input.consent.version,
        consentIp: input.consent.ip,
        consentUserAgent: input.consent.userAgent,
        privacyPolicyVersion: input.consent.privacyPolicyVersion,
        accessTokenExpiresAt: tokenExpiryDate(21),
        retainUntil: retentionCutoff(24),
        stageBucket: "APPLIED",
      },
    });

    // Seed the timeline with an "Application received" entry so the candidate
    // portal shows something meaningful from the moment they land there.
    await db.applicationStageHistory.create({
      data: {
        applicationId: app.id,
        toStageId: firstStage?.id ?? null,
        bucket: "APPLIED",
        reason: "Application received",
      },
    });

    if (input.demographic) {
      await db.demographicProfile.create({
        data: {
          applicationId: app.id,
          race: input.demographic.race,
          gender: input.demographic.gender,
          disability: input.demographic.disability,
          nationality: input.demographic.nationality,
          employmentEquityDesignated:
            input.demographic.race === "BLACK_AFRICAN" ||
            input.demographic.race === "COLOURED" ||
            input.demographic.race === "INDIAN_ASIAN" ||
            input.demographic.gender === "FEMALE" ||
            input.demographic.disability === "YES" ||
            undefined,
        },
      });
    }

    if (input.attachments.length > 0) {
      await db.applicationAttachment.createMany({
        data: input.attachments.map((a) => ({
          applicationId: app.id,
          label: a.label,
          fileName: a.fileName,
          fileUrl: a.fileUrl,
          fileType: a.fileType,
        })),
      });
    }

    await logConsent({
      applicationId: app.id,
      action: "GRANTED",
      version: input.consent.version,
      ip: input.consent.ip,
      userAgent: input.consent.userAgent,
    });

    // Fire AI match scoring, CV parsing, portfolio review, assessment invite (all background)
    if (job) {
      kickoffApplicationAI(app.id);
    }

    // Candidate email — must actually reach the applicant and drive them
    // back to the candidate portal to complete the AI behaviour interview.
    // Use BASE_URL (canonical) with APP_URL as legacy fallback.
    const appOrigin = (
      process.env.BASE_URL ||
      process.env.APP_URL ||
      ""
    ).replace(/\/+$/, "");
    const portalLink = `${appOrigin}/candidate/${app.accessToken}`;
    const jobTitleLine = job
      ? `<p style="margin:0 0 12px 0;color:#374151;">Role applied for: <strong>${job.title}</strong></p>`
      : "";
    const accent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
    // Fire-and-forget: sendCandidateEmail never throws; it records both
    // successful and failed attempts to ApplicationMessage so the audit
    // trail is complete regardless of SMTP outcome.
    void sendCandidateEmail({
      applicationId: app.id,
      to: app.email,
      subject: "Action needed — finish your Square 15 application",
      templateKey: "APPLICATION_CONFIRMATION",
      html: `<!DOCTYPE html>
<html><body style="font-family: -apple-system, Segoe UI, Roboto, Arial, sans-serif; background:#f9fafb; padding:24px; color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="display:inline-block;width:48px;height:48px;border-radius:24px;background:${accent}22;color:${accent};font-size:28px;line-height:48px;">&#10003;</div>
    </div>
    <h1 style="margin:0 0 12px 0;font-size:20px;text-align:center;">We received your application, ${app.firstName}</h1>
    ${jobTitleLine}
    <div style="background:#fff7ed;border:1px solid #fed7aa;border-radius:8px;padding:16px;margin:16px 0;">
      <p style="margin:0;font-weight:600;color:#9a3412;">Your application is NOT complete yet.</p>
      <p style="margin:8px 0 0 0;color:#7c2d12;font-size:14px;">Please open the candidate portal to answer a short set of AI behaviour interview questions. Only once you have submitted your answers will our hiring team be able to review your application.</p>
    </div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalLink}" style="display:inline-block;padding:12px 28px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">Continue my application &rarr;</a>
    </div>
    <p style="margin:16px 0 0 0;font-size:13px;color:#6b7280;text-align:center;">Or paste this link into your browser:<br/><a href="${portalLink}" style="color:${accent};word-break:break-all;">${portalLink}</a></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">This link is valid for 21 days. If you did not apply, please ignore this email.</p>
  </div>
</body></html>`,
    });

    void import("~/server/trpc/procedures/recruitmentPhase4")
      .then((m) => m.sendCandidateConfirmationCompanions(app.id))
      .catch(() => {});

    return {
      id: app.id,
      accessToken: app.accessToken,
      portalUrl: `/candidate/${app.accessToken}`,
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// APPLICATIONS — admin
// ═══════════════════════════════════════════════════════════════════════

export const getApplications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      jobId: z.number().optional(),
      bucket: z.string().optional(),
      assignedRecruiterId: z.number().optional(),
      search: z.string().optional(),
      minScore: z.number().optional(),
      source: z.string().optional(),
      sortBy: z.enum(["createdAt", "overallScore", "aiMatchScore"]).default("createdAt"),
      sortOrder: z.enum(["asc", "desc"]).default("desc"),
      take: z.number().default(100),
      /** Set true to disable blind-mode redaction at SCREENING bucket. */
      unblind: z.boolean().default(false),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const where: any = { deletedAt: null };
    if (input.jobId) where.jobId = input.jobId;
    if (input.bucket) where.stageBucket = input.bucket;
    if (input.assignedRecruiterId) where.assignedRecruiterId = input.assignedRecruiterId;
    if (input.minScore !== undefined) where.overallScore = { gte: input.minScore };
    if (input.source) where.sourceChannel = input.source;
    if (input.search) {
      where.OR = [
        { firstName: { contains: input.search, mode: "insensitive" } },
        { lastName: { contains: input.search, mode: "insensitive" } },
        { email: { contains: input.search, mode: "insensitive" } },
        { primaryTrade: { contains: input.search, mode: "insensitive" } },
      ];
    }
    const apps = await db.application.findMany({
      where,
      orderBy: { [input.sortBy]: input.sortOrder },
      take: input.take,
      include: {
        job: { select: { id: true, title: true } },
        currentStage: { select: { id: true, name: true } },
        rejectionReason: { select: { label: true, category: true } },
        assignedRecruiter: { select: { id: true, firstName: true, lastName: true } },
        _count: { select: { scorecardSubmissions: true, interviewBookings: true } },
      },
    });
    return apps.map((a) => maybeBlindApplication(a, input.unblind));
  });

export const getApplicationDetail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      unblind: z.boolean().default(false),
    }),
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const canSeeDemographics = ["ADMIN", "SENIOR_ADMIN", "HR"].includes(user.role);
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      include: {
        job: true,
        currentStage: true,
        assessments: { select: { type: true, score: true, results: true, completedAt: true } },
        interviewResponses: true,
        scorecardSubmissions: {
          include: {
            scorecard: { include: { criteria: true } },
            interviewer: { select: { firstName: true, lastName: true } },
          },
        },
        interviewBookings: {
          orderBy: { scheduledStart: "desc" },
          include: {
            panel: { include: { members: { include: { user: true } } } },
            createdBy: { select: { firstName: true, lastName: true } },
          },
        },
        stageHistory: {
          orderBy: { createdAt: "desc" },
          include: {
            toStage: { select: { name: true } },
            movedBy: { select: { firstName: true, lastName: true } },
          },
          take: 50,
        },
        offers: { orderBy: { createdAt: "desc" } },
        backgroundChecks: { orderBy: { createdAt: "desc" } },
        referenceChecks: { orderBy: { createdAt: "desc" }, include: { questionnaire: true } },
        employmentVerifications: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } },
        },
        attachments: true,
        rejectionReason: true,
        assignedRecruiter: { select: { firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        referrer: { select: { firstName: true, lastName: true, email: true } },
        demographicProfile: canSeeDemographics,
        messages: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    return maybeBlindApplication(app, input.unblind);
  });

// Redact PII on applications sitting in SCREENING bucket unless viewer
// explicitly requests unblinded data. Reduces halo/name/demographic bias
// during the initial screen.
function maybeBlindApplication<T extends { stageBucket?: string | null; id: number; firstName: string; lastName: string; email: string; phone?: string | null; city?: string | null; address?: string | null; idNumber?: string | null; demographicProfile?: any; assignedRecruiter?: any }>(
  a: T,
  unblind: boolean,
): T & { blinded: boolean } {
  const shouldBlind = !unblind && a.stageBucket === "SCREENING";
  if (!shouldBlind) return Object.assign({}, a, { blinded: false });
  const paddedId = String(a.id).padStart(4, "0");
  return Object.assign({}, a, {
    blinded: true,
    firstName: "Candidate",
    lastName: paddedId,
    email: "\u2022\u2022\u2022@\u2022\u2022\u2022.\u2022\u2022\u2022",
    phone: a.phone ? "\u2022\u2022\u2022" : a.phone,
    city: a.city ? "\u2022\u2022\u2022" : a.city,
    address: a.address ? "\u2022\u2022\u2022" : a.address,
    idNumber: a.idNumber ? "\u2022\u2022\u2022" : a.idNumber,
    demographicProfile: null,
  }) as T & { blinded: boolean };
}

export const moveApplicationStage = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      toStageId: z.number().optional(),
      toBucket: z
        .enum([
          "APPLIED",
          "SCREENING",
          "ASSESSMENT",
          "INTERVIEW",
          "OFFER",
          "BACKGROUND_CHECK",
          "HIRED",
          "REJECTED",
          "WITHDRAWN",
          "ON_HOLD",
        ])
        .optional(),
      reason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    if (input.toBucket === "HIRED" || input.toBucket === "REJECTED") {
      const current = await db.application.findUnique({
        where: { id: input.applicationId },
        select: { stageBucket: true },
      });
      await assertScorecardExistsForDecision(input.applicationId, {
        currentBucket: current?.stageBucket ?? null,
        requireDualReview: input.toBucket === "HIRED",
      });
      if (input.toBucket === "HIRED") {
        await assertHiringPreconditions(input.applicationId);
      }
    }

    await transitionApplication({
      applicationId: input.applicationId,
      toStageId: input.toStageId,
      toBucket: input.toBucket,
      movedById: user.id,
      reason: input.reason,
    });

    if (input.toBucket === "HIRED") {
      await db.application.update({
        where: { id: input.applicationId },
        data: { hiredAt: new Date(), reviewedById: user.id, reviewedAt: new Date() },
      });
      notifyReferrerOnHired(input.applicationId).catch(() => {});
      logAiDecision({
        applicationId: input.applicationId,
        action: "HIRED",
        reason: input.reason ?? "Manual hire decision",
      });
    }

    if (input.toBucket === "OFFER") {
      autoRequestReferences(input.applicationId).catch(() => {});
    }

    // Fire-and-forget candidate email announcing the stage change.
    if (input.toBucket) {
      void sendStageMoveEmail(input.applicationId, input.toBucket, user.id).catch(
        () => {},
      );
    }

    return { success: true };
  });

async function sendStageMoveEmail(
  applicationId: number,
  bucket: string,
  movedById: number,
): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      email: true,
      firstName: true,
      accessToken: true,
      job: { select: { title: true } },
    },
  });
  if (!app || !app.email) return;

  const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  const portalLink = `${origin}/candidate/${app.accessToken}`;
  const jobLine = app.job?.title ? ` for the ${app.job.title} role` : "";
  const brandGreen = "#2D5016";
  const brandGold = "#F4C430";

  const templates: Record<string, { subject: string; heading: string; body: string; cta: string; wa: string }> = {
    SCREENING: {
      subject: `Your application is under review${jobLine ? ` — ${app.job?.title}` : ""}`,
      heading: "Your application is being screened",
      body:
        "Our recruitment team has picked up your application and is currently screening " +
        "your CV, motivation letter and initial responses. There is nothing you need to do " +
        "at this moment — we will contact you as soon as we have an update.",
      cta: "View my application",
      wa: "Your application is being screened by our team. We'll be in touch shortly.",
    },
    ASSESSMENT: {
      subject: `Action required: complete your assessments${jobLine}`,
      heading: "Time to complete your assessments",
      body:
        "You have progressed to the assessment stage. Please open your candidate portal " +
        "and complete ALL the assessments (IQ, EQ, Personality Type / MBTI, Big Five and " +
        "the AI Behaviour Interview) in ONE sitting. This helps us shortlist fairly.",
      cta: "Open my portal",
      wa: "You've progressed to the assessment stage. Please complete all assessments on your portal.",
    },
    INTERVIEW: {
      subject: `Interview stage${jobLine ? ` — ${app.job?.title}` : ""}`,
      heading: "You've been shortlisted for interview",
      body:
        "Congratulations — you have progressed to the interview stage. Please open " +
        "your candidate portal to view the interview schedule slots and pick a time " +
        "that suits you. If a specific interviewer has been assigned they will contact " +
        "you separately.",
      cta: "Book my interview slot",
      wa: "Congratulations — you've been shortlisted for interview. Pick a slot on your portal.",
    },
    OFFER: {
      subject: `Great news — offer being prepared${jobLine ? ` for ${app.job?.title}` : ""}`,
      heading: "An offer is being prepared",
      body:
        "We are pleased to inform you that we intend to make you an offer. Our team " +
        "is finalising the details and will send you a formal offer document to " +
        "review and sign shortly. Please keep an eye on your portal.",
      cta: "View my application",
      wa: "Great news — we're preparing an offer for you. It will land in your portal shortly.",
    },
    BACKGROUND_CHECK: {
      subject: `Background check in progress${jobLine ? ` — ${app.job?.title}` : ""}`,
      heading: "Background check underway",
      body:
        "As part of our standard hiring process we are running background and " +
        "reference checks. You may receive follow-up calls from the referees you " +
        "provided. There is nothing further you need to do at this stage.",
      cta: "View my application",
      wa: "Background and reference checks are underway. Your referees may be contacted.",
    },
    HIRED: {
      subject: `Welcome to Square 15 Facility Solutions${jobLine ? ` — ${app.job?.title}` : ""}`,
      heading: "You're hired! 🎉",
      body:
        "Congratulations — we're delighted to welcome you to Square 15 Facility " +
        "Solutions. HR and your line manager will be in touch shortly with your " +
        "start-date paperwork and onboarding pack.",
      cta: "View my portal",
      wa: "Congratulations — you're hired! HR and your line manager will contact you with next steps.",
    },
    ON_HOLD: {
      subject: `Your application is on hold${jobLine ? ` — ${app.job?.title}` : ""}`,
      heading: "Application paused",
      body:
        "Your application has been placed on hold. This is often because the role " +
        "has been paused or because we need additional information. We will contact " +
        "you as soon as there is an update.",
      cta: "View my application",
      wa: "Your application has been placed on hold. We'll be in touch when there's an update.",
    },
  };

  const t = templates[bucket];
  if (!t) return;

  const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 12px 0;font-size:20px;color:${brandGreen};">${t.heading}</h1>
    <p style="margin:0 0 12px 0;color:#374151;">Hi ${app.firstName},</p>
    <p style="margin:0 0 16px 0;line-height:1.55;color:#111827;">${t.body}</p>
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalLink}" style="display:inline-block;padding:12px 28px;background:${brandGreen};color:${brandGold};text-decoration:none;border-radius:8px;font-weight:600;">${t.cta} →</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Square 15 Facility Solutions Recruitment Team</p>
  </div>
</body></html>`;

  await sendCandidateEmail({
    applicationId,
    to: app.email,
    subject: t.subject,
    templateKey: `STAGE_${bucket}`,
    sentById: movedById,
    html,
    companionMessage: t.wa,
  });
}

export const recruiterSendMessage = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      subject: z.string().optional(),
      body: z.string().min(1),
      alsoEmail: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      select: { id: true, email: true, firstName: true, accessToken: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });

    if (input.alsoEmail && app.email) {
      const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
      const portalLink = `${origin}/candidate/${app.accessToken}`;
      const html = `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <p style="margin:0 0 12px 0;color:#374151;">Hi ${app.firstName},</p>
    <div style="white-space:pre-wrap;margin:0 0 20px 0;line-height:1.55;color:#111827;">${input.body
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")}</div>
    <div style="text-align:center;margin:24px 0;">
      <a href="${portalLink}" style="display:inline-block;padding:10px 22px;background:#2D5016;color:#F4C430;text-decoration:none;border-radius:8px;font-weight:600;">Reply in your portal →</a>
    </div>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">Square 15 Facility Solutions Recruitment Team</p>
  </div>
</body></html>`;

      return sendCandidateEmail({
        applicationId: app.id,
        to: app.email,
        subject: input.subject || "Message from Square 15 Facility Solutions",
        templateKey: "RECRUITER_MESSAGE",
        sentById: user.id,
        html,
        companionMessage: `New message from Square 15 Recruitment: ${input.body.slice(0, 120)}${input.body.length > 120 ? "…" : ""}`,
      }).then(() => ({ success: true }));
    }

    await db.applicationMessage.create({
      data: {
        applicationId: app.id,
        channel: "PORTAL",
        direction: "OUTBOUND",
        subject: input.subject,
        body: input.body,
        sentById: user.id,
        templateKey: "RECRUITER_MESSAGE",
        deliveredAt: new Date(),
      },
    });
    return { success: true };
  });

export const rejectApplication = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      rejectionReasonId: z.number(),
      rejectionDetail: z.string().optional(),
      sendEmailToCandidate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);

    // Fetch current stage + candidate + job info in one round-trip so we can
    // (a) allow early-funnel rejection without a scorecard, and
    // (b) personalise the rejection email with job title + reason.
    const existing = await db.application.findUnique({
      where: { id: input.applicationId },
      select: {
        stageBucket: true,
        firstName: true,
        email: true,
        accessToken: true,
        job: { select: { title: true } },
      },
    });
    if (!existing) throw new TRPCError({ code: "NOT_FOUND" });
    await assertScorecardExistsForDecision(input.applicationId, {
      currentBucket: existing.stageBucket,
    });

    const reason = await db.rejectionReason.findUnique({
      where: { id: input.rejectionReasonId },
      select: { label: true, category: true },
    });

    const app = await db.application.update({
      where: { id: input.applicationId },
      data: {
        rejectionReasonId: input.rejectionReasonId,
        rejectionDetail: input.rejectionDetail,
        reviewedById: user.id,
        reviewedAt: new Date(),
        stageBucket: "REJECTED",
        stageEnteredAt: new Date(),
      },
    });

    await db.applicationStageHistory.create({
      data: {
        applicationId: app.id,
        toStageId: null,
        bucket: "REJECTED",
        movedById: user.id,
        reason: input.rejectionDetail ?? reason?.label ?? "Rejected",
      },
    });

    if (input.sendEmailToCandidate) {
      const accent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
      const brand = process.env.BRAND_NAME || "Square 15";
      const jobTitle = existing.job?.title ? ` for the ${existing.job.title} role` : "";
      const appUrl = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
      const careersUrl = `${appUrl}/careers`;
      const feedbackUrl = existing.accessToken
        ? `${appUrl}/careers/feedback/${existing.accessToken}`
        : "";
      void sendCandidateEmail({
        applicationId: app.id,
        to: existing.email,
        subject: `Update on your application${existing.job?.title ? ` — ${existing.job.title}` : ""}`,
        templateKey: "REJECTION",
        sentById: user.id,
        html: `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <h1 style="margin:0 0 16px 0;font-size:20px;">Thank you, ${existing.firstName}</h1>
    <p style="margin:0 0 12px 0;line-height:1.55;">Thank you for taking the time to apply${jobTitle}. We know how much effort goes into an application and we appreciate you sharing your background with us.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">After careful consideration of the applications received, we will not be moving forward with your application at this time. This decision doesn't diminish your skills or experience — competition for this role was strong.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">We would love to keep you in mind for future openings. New roles are posted regularly on our careers page:</p>
    <div style="text-align:center;margin:20px 0;">
      <a href="${careersUrl}" style="display:inline-block;padding:11px 24px;background:${accent};color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;">See open roles →</a>
    </div>
    ${
      feedbackUrl
        ? `<p style="margin:20px 0 8px 0;line-height:1.55;font-size:14px;color:#4b5563;">Would you take 30 seconds to share how your application experience was? Your feedback helps us improve.</p>
    <div style="text-align:center;margin:8px 0 20px 0;">
      <a href="${feedbackUrl}" style="display:inline-block;padding:8px 18px;background:#ffffff;border:1px solid ${accent};color:${accent};text-decoration:none;border-radius:6px;font-weight:500;font-size:13px;">Share feedback</a>
    </div>`
        : ""
    }
    <p style="margin:16px 0 0 0;line-height:1.55;">We wish you every success in your job search.</p>
    <p style="margin:20px 0 0 0;line-height:1.55;">Warm regards,<br/><strong>The ${brand} Recruitment Team</strong></p>
    <hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />
    <p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.5;">Your personal information will be retained in accordance with our privacy policy and applicable data-protection laws (POPIA). You may request deletion at any time by replying to this email.</p>
  </div>
</body></html>`,
        companionMessage: `Thank you for your ${existing.job?.title ?? "Square 15"} application. We won't be moving forward this time, but we've kept you on file for future roles.${feedbackUrl ? " Feedback link on the portal." : ""}`,
      });
    }

    return { success: true };
  });

export const assignRecruiter = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      recruiterId: z.number(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.application.update({
      where: { id: input.applicationId },
      data: { assignedRecruiterId: input.recruiterId },
    });
  });

export const addApplicationNote = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      body: z.string().min(1),
      mentions: z.array(z.number()).default([]),
      isPrivate: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.applicationNote.create({
      data: {
        applicationId: input.applicationId,
        authorId: user.id,
        body: input.body,
        mentions: input.mentions,
        isPrivate: input.isPrivate,
      },
    });
  });

export const getRejectionReasons = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);
    return db.rejectionReason.findMany({ where: { active: true }, orderBy: { label: "asc" } });
  });

/**
 * Canonical default rejection reasons. Used both by
 * `bootstrapRejectionReasons()` (server-boot idempotent seed) and by
 * `setupRejectionReasons` when the caller does not supply any reasons.
 *
 * Categories: SCREENING (early-funnel), QUALIFICATIONS, ASSESSMENT,
 * INTERVIEW, OFFER, ADMIN.
 */
export const DEFAULT_REJECTION_REASONS: {
  code: string;
  label: string;
  category: string;
  description?: string;
}[] = [
  { code: "NOT_QUALIFIED", label: "Does not meet minimum qualifications", category: "QUALIFICATIONS", description: "Candidate is missing a hard requirement (certification, licence, minimum years)." },
  { code: "LACKS_EXPERIENCE", label: "Insufficient relevant experience", category: "QUALIFICATIONS", description: "Experience level does not match what the role requires." },
  { code: "OVERQUALIFIED", label: "Overqualified for this role", category: "QUALIFICATIONS", description: "Candidate's seniority or expectations exceed the role scope." },
  { code: "POOR_CULTURE_FIT", label: "Not a strong culture fit", category: "INTERVIEW", description: "Values or working-style misalignment identified during interview." },
  { code: "FAILED_ASSESSMENT", label: "Did not pass required assessment", category: "ASSESSMENT", description: "Assessment score below the threshold for the role." },
  { code: "FAILED_INTERVIEW", label: "Did not pass interview stage", category: "INTERVIEW", description: "Interview panel recommendation was NO_HIRE." },
  { code: "COMPENSATION_MISMATCH", label: "Compensation expectations mismatch", category: "OFFER", description: "Salary or benefits expectations outside the band." },
  { code: "COUNTER_OFFER", label: "Candidate accepted a counter-offer", category: "OFFER", description: "Candidate withdrew after receiving a counter-offer from their current employer." },
  { code: "WITHDREW", label: "Candidate withdrew", category: "ADMIN", description: "Candidate is no longer pursuing this opportunity." },
  { code: "POSITION_FILLED", label: "Position filled by another candidate", category: "ADMIN", description: "Role has been closed after another candidate accepted the offer." },
  { code: "POSITION_CLOSED", label: "Position closed / cancelled", category: "ADMIN", description: "Requisition was cancelled before hire." },
  { code: "DUPLICATE", label: "Duplicate application", category: "SCREENING", description: "Candidate already exists in the pipeline for this or a related role." },
  { code: "SPAM", label: "Spam or unrelated submission", category: "SCREENING", description: "Application is spam, off-topic, or automated bot submission." },
  { code: "INCOMPLETE_APPLICATION", label: "Application incomplete after follow-up", category: "SCREENING", description: "Candidate did not respond to requests for missing information within the deadline." },
  { code: "REFERENCE_CHECK_FAILED", label: "Reference or background check failed", category: "OFFER", description: "Reference or background verification returned adverse findings." },
];

/**
 * Idempotent upsert of the canonical rejection-reason set.
 * Safe to call on server boot and whenever a hiring manager clicks
 * "seed defaults" in the admin UI.
 */
export async function bootstrapRejectionReasons(): Promise<{ inserted: number; updated: number }> {
  let inserted = 0;
  let updated = 0;
  for (const r of DEFAULT_REJECTION_REASONS) {
    const existing = await db.rejectionReason.findUnique({
      where: { code: r.code },
      select: { id: true },
    });
    await db.rejectionReason.upsert({
      where: { code: r.code },
      create: r,
      update: { label: r.label, category: r.category, description: r.description, active: true },
    });
    if (existing) updated++;
    else inserted++;
  }
  return { inserted, updated };
}

export const setupRejectionReasons = baseProcedure
  .input(
    z.object({
      token: z.string(),
      // Callers may omit `reasons` to seed the canonical defaults.
      reasons: z
        .array(
          z.object({
            code: z.string(),
            label: z.string(),
            category: z.string(),
            description: z.string().optional(),
          }),
        )
        .optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const rows = input.reasons && input.reasons.length > 0 ? input.reasons : DEFAULT_REJECTION_REASONS;
    for (const r of rows) {
      await db.rejectionReason.upsert({
        where: { code: r.code },
        create: r,
        update: { label: r.label, category: r.category, description: r.description, active: true },
      });
    }
    return { count: rows.length };
  });

// ═══════════════════════════════════════════════════════════════════════
// RECOMPUTE SCORE
// ═══════════════════════════════════════════════════════════════════════
export const recomputeScore = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const score = await recomputeApplicationScore(input.applicationId);
    return { score };
  });
