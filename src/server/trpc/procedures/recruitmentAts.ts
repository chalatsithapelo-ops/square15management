/**
 * Recruitment 2.0 — Jobs, Pipelines, Applications (core ATS procedures).
 */

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
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
} from "~/server/services/recruitment/atsHelpers";

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
      currency: z.string().default("ZAR"),
      headcount: z.number().min(1).default(1),
      visibility: z.enum(["PUBLIC", "INTERNAL", "PRIVATE"]).default("PUBLIC"),
      category: z.string().optional(),
      hiringManagerId: z.number().optional(),
      recruiterId: z.number().optional(),
      pipelineId: z.number().optional(),
      requireIQ: z.boolean().default(false),
      requireEQ: z.boolean().default(false),
      requireBigFive: z.boolean().default(false),
      requireSJT: z.boolean().default(false),
      requireWorkSample: z.boolean().default(false),
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
    }),
  )
  .mutation(async ({ input }) => {
    let job: { id: number; status: string; visibility: string } | null = null;
    if (input.jobSlug) {
      job = await db.job.findUnique({
        where: { slug: input.jobSlug },
        select: { id: true, status: true, visibility: true },
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

    await logConsent({
      applicationId: app.id,
      action: "GRANTED",
      version: input.consent.version,
      ip: input.consent.ip,
      userAgent: input.consent.userAgent,
    });

    // Fire AI match scoring in background
    if (job) {
      computeAIMatchScore(app.id).catch(() => {});
    }

    // Candidate email
    sendEmail({
      to: app.email,
      subject: "We received your application",
      html: `<p>Hi ${app.firstName},</p>
             <p>Thanks for applying. You can track your application status here:</p>
             <p><a href="${process.env.APP_URL ?? ""}/candidate/${app.accessToken}">Candidate portal</a></p>
             <p>This link is valid for 21 days.</p>`,
    }).catch(() => {});

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
    return apps;
  });

export const getApplicationDetail = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
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
        referenceChecks: { orderBy: { createdAt: "desc" } },
        notes: {
          orderBy: { createdAt: "desc" },
          include: { author: { select: { firstName: true, lastName: true } } },
        },
        attachments: true,
        rejectionReason: true,
        assignedRecruiter: { select: { firstName: true, lastName: true, email: true } },
        reviewedBy: { select: { firstName: true, lastName: true } },
        referrer: { select: { firstName: true, lastName: true, email: true } },
        demographicProfile: true, // note: UI should gate who can see this
        messages: { orderBy: { createdAt: "desc" }, take: 20 },
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    return app;
  });

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
      await assertScorecardExistsForDecision(input.applicationId);
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
    }

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
    await assertScorecardExistsForDecision(input.applicationId);

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
        reason: input.rejectionDetail ?? "Rejected",
      },
    });

    if (input.sendEmailToCandidate) {
      sendEmail({
        to: app.email,
        subject: "Update on your application",
        html: `<p>Hi ${app.firstName},</p>
               <p>Thank you for your interest. After careful consideration we will not be moving forward at this time. We wish you the best.</p>`,
      }).catch(() => {});
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

export const setupRejectionReasons = baseProcedure
  .input(
    z.object({
      token: z.string(),
      reasons: z.array(
        z.object({
          code: z.string(),
          label: z.string(),
          category: z.string(),
          description: z.string().optional(),
        }),
      ),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    for (const r of input.reasons) {
      await db.rejectionReason.upsert({
        where: { code: r.code },
        create: r,
        update: { label: r.label, category: r.category, description: r.description },
      });
    }
    return { count: input.reasons.length };
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
