/**
 * Phase 1-3 HR remediation procedures.
 * See /memories/session/frustration-remediation-plan.md.
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
// R6 · Hiring overrides (work-sample waiver, HR-line ref waiver, cool-off waiver)
// ═══════════════════════════════════════════════════════════════════════

const OVERRIDE_TYPES = ["WORK_SAMPLE_WAIVED", "HR_LINE_REF_WAIVED", "COOLOFF_WAIVED"] as const;

export const createHiringOverride = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      type: z.enum(OVERRIDE_TYPES),
      reason: z.string().min(20, "Please give at least 20 characters of reason for the audit trail."),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.hiringOverride.create({
      data: {
        applicationId: input.applicationId,
        type: input.type,
        reason: input.reason,
        waivedById: user.id,
      },
    });
  });

export const listHiringOverrides = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.hiringOverride.findMany({
      where: { applicationId: input.applicationId },
      include: { waivedBy: { select: { firstName: true, lastName: true, email: true } } },
      orderBy: { createdAt: "desc" },
    });
  });

// ═══════════════════════════════════════════════════════════════════════
// R2 · Blind-mode audited reveal
// ═══════════════════════════════════════════════════════════════════════

export const revealBlindCandidate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      reason: z.string().min(10, "Provide a short reason for the audit trail."),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    return db.blindRevealAudit.create({
      data: {
        userId: user.id,
        applicationId: input.applicationId,
        reason: input.reason,
      },
    });
  });

export const listBlindReveals = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.blindRevealAudit.findMany({
      where: input.applicationId ? { applicationId: input.applicationId } : {},
      include: {
        user: { select: { firstName: true, lastName: true, email: true } },
        application: { select: { id: true, firstName: true, lastName: true, jobId: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
  });

// Called from the UI right after a reveal; returns whether the current user
// has an active reveal (60 minutes) so the front-end can lift redaction.
export const hasActiveBlindReveal = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const since = new Date(Date.now() - 60 * 60 * 1000);
    const row = await db.blindRevealAudit.findFirst({
      where: { userId: user.id, applicationId: input.applicationId, createdAt: { gte: since } },
      orderBy: { createdAt: "desc" },
    });
    return { active: !!row, since: row?.createdAt ?? null };
  });

// ═══════════════════════════════════════════════════════════════════════
// C6 · Cross-device assessment transfer
// ═══════════════════════════════════════════════════════════════════════

function generateSixDigitCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export const createDeviceTransferCode = baseProcedure
  .input(z.object({ accessToken: z.string(), sessionId: z.number() }))
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    const session = await db.assessmentSession.findUnique({
      where: { id: input.sessionId },
      select: { applicationId: true, finishedAt: true },
    });
    if (!session || session.applicationId !== app.id) throw new TRPCError({ code: "NOT_FOUND" });
    if (session.finishedAt) throw new TRPCError({ code: "BAD_REQUEST", message: "Session already finished." });
    const code = generateSixDigitCode();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
    return db.assessmentDeviceTransfer.create({
      data: { sessionId: input.sessionId, code, expiresAt },
      select: { code: true, expiresAt: true },
    });
  });

export const claimDeviceTransferCode = baseProcedure
  .input(z.object({ accessToken: z.string(), code: z.string().length(6) }))
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    const transfer = await db.assessmentDeviceTransfer.findFirst({
      where: {
        code: input.code,
        used: false,
        expiresAt: { gte: new Date() },
        session: { applicationId: app.id },
      },
      include: { session: true },
    });
    if (!transfer) throw new TRPCError({ code: "NOT_FOUND", message: "Code invalid, expired, or already used." });
    await db.assessmentDeviceTransfer.update({
      where: { id: transfer.id },
      data: { used: true, usedAt: new Date() },
    });
    return { sessionId: transfer.sessionId, currentStep: transfer.session.currentStep };
  });

// ═══════════════════════════════════════════════════════════════════════
// R4 · Copy from another job (work samples + interview banks)
// ═══════════════════════════════════════════════════════════════════════

export const listJobsWithWorkSamples = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.job.findMany({
      where: { workSampleTasks: { some: { active: true } } },
      select: {
        id: true,
        title: true,
        _count: { select: { workSampleTasks: { where: { active: true } } } },
      },
      orderBy: { title: "asc" },
      take: 200,
    });
  });

export const copyWorkSamplesFromJob = baseProcedure
  .input(z.object({ token: z.string(), toJobId: z.number(), fromJobId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const source = await db.workSampleTask.findMany({
      where: { jobId: input.fromJobId, active: true },
    });
    if (source.length === 0) throw new TRPCError({ code: "NOT_FOUND", message: "Source job has no active work-sample tasks." });
    const created = await Promise.all(
      source.map((s) =>
        db.workSampleTask.create({
          data: {
            jobId: input.toJobId,
            title: s.title,
            instructions: s.instructions,
            timeLimitMinutes: s.timeLimitMinutes,
            rubric: s.rubric ?? undefined,
            passingScore: s.passingScore,
            active: true,
            isTemplate: false,
            createdById: user.id,
          },
        }),
      ),
    );
    return { copied: created.length };
  });

export const listJobsWithInterviewBank = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    return db.job.findMany({
      where: { interviewQuestionBank: { isNot: null } },
      select: {
        id: true,
        title: true,
        interviewQuestionBank: {
          select: { _count: { select: { questions: true } } },
        },
      },
      orderBy: { title: "asc" },
      take: 200,
    });
  });

export const copyInterviewBankFromJob = baseProcedure
  .input(z.object({ token: z.string(), toJobId: z.number(), fromJobId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const source = await db.interviewQuestionBank.findUnique({
      where: { jobId: input.fromJobId },
      include: { questions: true },
    });
    if (!source) throw new TRPCError({ code: "NOT_FOUND", message: "Source job has no question bank." });
    const existing = await db.interviewQuestionBank.findUnique({ where: { jobId: input.toJobId } });
    if (existing) {
      await db.interviewQuestion.deleteMany({ where: { bankId: existing.id } });
      await db.interviewQuestion.createMany({
        data: source.questions.map((q) => ({
          bankId: existing.id,
          order: q.order,
          competency: q.competency,
          question: q.question,
          rubric: q.rubric ?? undefined,
          weight: q.weight,
          requireEvidence: q.requireEvidence,
        })),
      });
      return { copied: source.questions.length, mode: "REPLACED" as const };
    }
    const bank = await db.interviewQuestionBank.create({
      data: {
        jobId: input.toJobId,
        description: source.description,
        questions: {
          create: source.questions.map((q) => ({
            order: q.order,
            competency: q.competency,
            question: q.question,
            rubric: q.rubric ?? undefined,
            weight: q.weight,
            requireEvidence: q.requireEvidence,
          })),
        },
      },
      include: { questions: true },
    });
    return { copied: bank.questions.length, mode: "CREATED" as const };
  });

// AI-assist: generate 5 question drafts from a job description via Gemini.
export const aiSuggestInterviewQuestions = baseProcedure
  .input(z.object({ token: z.string(), jobId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHiringManager(user);
    const job = await db.job.findUnique({
      where: { id: input.jobId },
      select: { title: true, description: true, requirements: true, competencies: true },
    });
    if (!job) throw new TRPCError({ code: "NOT_FOUND" });
    const { generateText } = await import("~/server/services/ai/controlledGeneration");
    const { google } = await import("@ai-sdk/google");
    const prompt = `Role: ${job.title}
Competencies: ${(job.competencies ?? []).join(", ") || "(unspecified)"}
Requirements: ${(job.requirements ?? "").slice(0, 1200)}

Return ONLY a compact one-line JSON array of exactly 5 objects with keys:
{ competency:string, question:string, rubric:{"1":string,"2":string,"3":string,"4":string,"5":string}, weight:number }
Question style: behavioural STAR (past behaviour, specific example). Rubric level 1 = "no example given"; level 5 = "specific outcome with measurable impact". Weight 1.0 default.`;
    let text = "";
    try {
      const r = await generateText({
        aiFeature: "recruitment.report",
        aiUserId: user.id,
        model: google("gemini-flash-latest"),
        prompt,
        maxTokens: 2000,
      });
      text = r.text ?? "";
    } catch (e: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI suggest failed: ${e?.message ?? e}` });
    }
    const cleaned = text.replace(/```json\n?|```/g, "").trim();
    const match = cleaned.match(/\[[\s\S]*\]/);
    if (!match) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI response could not be parsed." });
    try {
      const parsed = JSON.parse(match[0]);
      if (!Array.isArray(parsed) || parsed.length === 0) throw new Error("empty");
      return { suggestions: parsed.slice(0, 5) };
    } catch (e: any) {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: `AI response invalid JSON: ${e?.message ?? e}` });
    }
  });

// ═══════════════════════════════════════════════════════════════════════
// R7 · Decision one-pager
// ═══════════════════════════════════════════════════════════════════════

export const getApplicationDecisionSnapshot = baseProcedure
  .input(z.object({ token: z.string(), applicationId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      include: {
        job: { select: { id: true, title: true } },
        workSampleSubmissions: {
          include: {
            task: { select: { title: true, passingScore: true } },
            scoredBy: { select: { firstName: true, lastName: true } },
          },
        },
        scorecardSubmissions: {
          orderBy: { submittedAt: "desc" },
          include: {
            scorecard: { include: { criteria: { orderBy: { order: "asc" } } } },
            interviewer: { select: { firstName: true, lastName: true, email: true } },
          },
        },
        referenceChecks: {
          include: { questionnaire: true },
          orderBy: { createdAt: "asc" },
        },
        employmentVerifications: { orderBy: { createdAt: "asc" } },
        assessmentSessions: {
          include: { _count: { select: { snapshots: true } } },
          orderBy: { startedAt: "desc" },
        },
        interviewBookings: {
          include: {
            panel: { include: { members: { include: { user: true } } } },
          },
          orderBy: { scheduledStart: "asc" },
        },
        hiringOverrides: {
          include: { waivedBy: { select: { firstName: true, lastName: true } } },
        },
        stageHistory: { orderBy: { createdAt: "asc" }, take: 50 },
        interviewQuestionScores: {
          include: {
            question: { select: { competency: true, question: true, weight: true } },
            interviewer: { select: { firstName: true, lastName: true } },
          },
        },
      },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });

    const criteriaSet = new Set<string>();
    for (const s of app.scorecardSubmissions) {
      for (const c of s.scorecard.criteria) criteriaSet.add(c.name);
    }
    const criteriaList = Array.from(criteriaSet);
    const heatmap = app.scorecardSubmissions.map((s) => ({
      interviewer: `${s.interviewer?.firstName ?? ""} ${s.interviewer?.lastName ?? ""}`.trim(),
      recommendation: s.recommendation,
      overallRating: s.overallRating,
      submittedAt: s.submittedAt,
      ratings: criteriaList.map((crit) => {
        const key = s.scorecard.criteria.find((c) => c.name === crit)?.id;
        const val = key && s.ratings && typeof s.ratings === "object" ? (s.ratings as any)[String(key)] : null;
        return { criterion: crit, value: val == null ? null : Number(val) };
      }),
    }));

    return {
      application: {
        id: app.id,
        candidate: `${app.firstName} ${app.lastName}`,
        email: app.email,
        job: app.job,
        stageBucket: app.stageBucket,
        hiredAt: app.hiredAt,
        redFlagScore: app.redFlagScore,
        redFlagSignals: app.redFlagSignals,
        workSampleScore: app.workSampleScore,
        overallScore: app.overallScore,
      },
      workSamples: app.workSampleSubmissions.map((w) => ({
        title: w.task.title,
        passingScore: w.task.passingScore,
        aiScore: w.aiScore,
        humanScore: w.humanScore,
        aiFeedback: w.aiFeedback,
        humanFeedback: w.humanFeedback,
        scoredBy: w.scoredBy ? `${w.scoredBy.firstName} ${w.scoredBy.lastName}` : null,
        submittedAt: w.submittedAt,
      })),
      scorecards: {
        criteria: criteriaList,
        rows: heatmap,
      },
      questionScores: app.interviewQuestionScores.map((qs) => ({
        competency: qs.question.competency,
        question: qs.question.question,
        weight: qs.question.weight,
        score: qs.score,
        evidence: qs.evidence,
        starOk: qs.specificExample && qs.personalRole && qs.measurableOutcome,
        interviewer: `${qs.interviewer.firstName} ${qs.interviewer.lastName}`,
      })),
      references: app.referenceChecks.map((r) => ({
        name: r.refereeName,
        relationship: r.relationship,
        isHrLine: r.isHrLine,
        status: r.status,
        rating: r.rating,
        aiSummary: r.aiSummary,
      })),
      verifications: app.employmentVerifications.map((v) => ({
        employer: v.employerName,
        claimedRole: v.claimedRole,
        status: v.status,
        confirmedRole: v.confirmedRole,
        discrepancy: v.discrepancy,
      })),
      assessments: app.assessmentSessions.map((s) => ({
        id: s.id,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        pauseCount: s.pauseCount,
        snapshotCount: s._count.snapshots,
        webcamGranted: s.webcamGranted,
      })),
      interviews: app.interviewBookings.map((b) => ({
        scheduledStart: b.scheduledStart,
        stage: b.stage,
        status: b.status,
        panel: (b.panel?.members ?? []).map((m) => `${m.user.firstName} ${m.user.lastName}`),
      })),
      overrides: app.hiringOverrides.map((o) => ({
        type: o.type,
        reason: o.reason,
        waivedBy: `${o.waivedBy.firstName} ${o.waivedBy.lastName}`,
        waivedAt: o.createdAt,
      })),
      timeline: app.stageHistory.map((h) => ({
        at: h.createdAt,
        fromBucket: h.fromBucket,
        toBucket: h.toBucket,
        reason: h.reason,
      })),
    };
  });

// ═══════════════════════════════════════════════════════════════════════
// R5 · Check-ins-due tile (uses existing listDuePerformanceCheckIns)
// C1 · SMS/WhatsApp companion send (opt-in via SystemSettings)
// C5 · Resend referee questionnaire button
// ═══════════════════════════════════════════════════════════════════════

async function getSetting(key: string): Promise<string | null> {
  const row = await db.systemSettings.findUnique({ where: { key } });
  return row?.value ?? null;
}

async function sendWhatsApp(to: string, body: string): Promise<{ ok: boolean; error?: string; providerMessageId?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_ID || (await getSetting("whatsapp_phone_id"));
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || (await getSetting("whatsapp_access_token"));
  if (!phoneId || !accessToken) return { ok: false, error: "WhatsApp not configured" };
  const cleaned = to.replace(/[^0-9]/g, "").replace(/^0/, "27");
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleaned,
        type: "text",
        text: { body },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, providerMessageId: json?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Template send — the ONLY way to reach a WhatsApp number that hasn't
// messaged us in the last 24h (Meta's business-initiated messaging rule).
// Template must be pre-approved in WhatsApp Manager (Utility category).
async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[],
  buttonUrlParam?: string,
  languageCode: string = "en",
): Promise<{ ok: boolean; error?: string; providerMessageId?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_ID || (await getSetting("whatsapp_phone_id"));
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || (await getSetting("whatsapp_access_token"));
  if (!phoneId || !accessToken) return { ok: false, error: "WhatsApp not configured" };
  const cleaned = to.replace(/[^0-9]/g, "").replace(/^0/, "27");
  const components: any[] = [
    {
      type: "body",
      parameters: bodyParams.map((v) => ({ type: "text", text: v })),
    },
  ];
  if (buttonUrlParam) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: buttonUrlParam }],
    });
  }
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleaned,
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
          components,
        },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, providerMessageId: json?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Prefer approved template (works cold), fall back to freeform (only works
// within a 24-hour customer-service window). Callers pass both so we can
// switch as soon as Meta approves the template.
async function sendWhatsAppSmart(
  to: string,
  templateName: string,
  bodyParams: string[],
  freeformBody: string,
  buttonUrlParam?: string,
): Promise<{ ok: boolean; error?: string; providerMessageId?: string; via?: string }> {
  const t = await sendWhatsAppTemplate(to, templateName, bodyParams, buttonUrlParam);
  if (t.ok) return { ...t, via: "TEMPLATE" };
  // Non-existent template or not yet approved → 132001 / 132000 / 100.
  // Fall back to freeform so users inside a service window still receive us.
  const f = await sendWhatsApp(to, freeformBody);
  if (f.ok) return { ...f, via: "FREEFORM", error: undefined };
  return { ok: false, error: `template: ${t.error}; freeform: ${f.error}`, via: "NONE" };
}

async function sendSMS(to: string, body: string): Promise<{ ok: boolean; error?: string }> {
  const apiKey = process.env.CLICKATELL_API_KEY || (await getSetting("clickatell_api_key"));
  if (!apiKey) return { ok: false, error: "SMS not configured" };
  const cleaned = to.replace(/[^0-9]/g, "").replace(/^0/, "27");
  try {
    const res = await fetch("https://platform.clickatell.com/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: apiKey },
      body: JSON.stringify({ messages: [{ channel: "sms", to: cleaned, content: body }] }),
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}

// Send portal link on demand via ALL configured channels (email + whatsapp + sms).
// Used by /careers/find-my-application and the "Send portal link" button.
export const sendPortalLinkAllChannels = baseProcedure
  .input(z.object({ email: z.string().email() }))
  .mutation(async ({ input }) => {
    const app = await db.application.findFirst({
      where: { email: input.email.toLowerCase() },
      orderBy: { createdAt: "desc" },
      select: { id: true, phone: true, accessToken: true, firstName: true, job: { select: { title: true } } },
    });
    // Always return generic OK — avoid enumeration.
    if (!app) return { ok: true };

    const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const portal = `${origin}/candidate/${app.accessToken}`;
    const title = app.job?.title ?? "Square 15";
    const smsText = `Hi ${app.firstName}, continue your ${title} application here: ${portal}`;

    // Rate-limit: 3 sends per day per applicationId with templateKey PORTAL_LINK_RESEND.
    const since = new Date(Date.now() - 24 * 3600 * 1000);
    const recent = await db.applicationMessage.count({
      where: { applicationId: app.id, templateKey: "PORTAL_LINK_RESEND", createdAt: { gte: since } },
    });
    if (recent >= 3) return { ok: true, rateLimited: true };

    void sendCandidateEmail({
      applicationId: app.id,
      to: app.email!,
      subject: `Your ${title} application link`,
      templateKey: "PORTAL_LINK_RESEND",
      html: `<p>Hi ${app.firstName},</p><p>Continue your application: <a href="${portal}">${portal}</a></p>`,
    }).catch(() => {});

    if (app.phone) {
      const [wa, sms] = await Promise.all([
        sendWhatsAppSmart(
          app.phone,
          "candidate_portal_link",
          [app.firstName ?? "there", title, portal],
          smsText,
          app.accessToken,
        ),
        sendSMS(app.phone, smsText),
      ]);
      await db.applicationMessage.create({
        data: {
          applicationId: app.id,
          channel: "WHATSAPP",
          direction: "OUTBOUND",
          subject: `Portal link${wa.via ? ` (${wa.via})` : ""}`,
          body: wa.ok ? smsText : `[Delivery failed: ${wa.error}]\n\n${smsText}`,
          templateKey: "PORTAL_LINK_RESEND",
          deliveredAt: wa.ok ? new Date() : null,
          provider: "WHATSAPP",
          providerMessageId: wa.providerMessageId,
        },
      }).catch(() => {});
      await db.applicationMessage.create({
        data: {
          applicationId: app.id,
          channel: "SMS",
          direction: "OUTBOUND",
          subject: "Portal link",
          body: sms.ok ? smsText : `[Delivery failed: ${sms.error}]\n\n${smsText}`,
          templateKey: "PORTAL_LINK_RESEND",
          deliveredAt: sms.ok ? new Date() : null,
          provider: "SMS",
        },
      }).catch(() => {});
    }
    return { ok: true };
  });

// Called after createApplication returns — best-effort WA/SMS confirmation.
export async function sendCandidateConfirmationCompanions(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: { phone: true, firstName: true, accessToken: true, job: { select: { title: true } } },
  });
  if (!app?.phone) return;
  const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  const portal = `${origin}/candidate/${app.accessToken}`;
  const title = app.job?.title ?? "Square 15";
  const body = `Hi ${app.firstName}, we received your ${title} application. Continue here: ${portal}`;
  const wa = await sendWhatsAppSmart(
    app.phone,
    "candidate_portal_link",
    [app.firstName ?? "there", title, portal],
    body,
    app.accessToken,
  );
  await db.applicationMessage.create({
    data: {
      applicationId,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      subject: `Application received${wa.via ? ` (${wa.via})` : ""}`,
      body: wa.ok ? body : `[Delivery failed: ${wa.error}]\n\n${body}`,
      templateKey: "APPLICATION_CONFIRMATION_WA",
      deliveredAt: wa.ok ? new Date() : null,
      provider: "WHATSAPP",
      providerMessageId: wa.providerMessageId,
    },
  }).catch(() => {});
  if (!wa.ok) {
    const sms = await sendSMS(app.phone, body);
    await db.applicationMessage.create({
      data: {
        applicationId,
        channel: "SMS",
        direction: "OUTBOUND",
        subject: "Application received",
        body: sms.ok ? body : `[Delivery failed: ${sms.error}]\n\n${body}`,
        templateKey: "APPLICATION_CONFIRMATION_SMS",
        deliveredAt: sms.ok ? new Date() : null,
        provider: "SMS",
      },
    }).catch(() => {});
  }
}

// Generic multi-channel companion fired by `sendCandidateEmail` whenever
// its caller sets `companionMessage`. Handles stage moves, rejection,
// interview scheduled, offer sent, assessment invite, etc. Uses the
// `candidate_status_update` utility template for cold recipients, freeform
// inside the 24h service window, SMS as final fallback.
export async function sendCandidateStatusCompanion(
  applicationId: number,
  statusMessage: string,
  templateKey: string,
  sentById: number | null,
): Promise<{ whatsappAccepted: boolean; whatsappVia?: string; smsAttempted: boolean; smsAccepted?: boolean; error?: string }> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      phone: true,
      firstName: true,
      accessToken: true,
      job: { select: { title: true } },
    },
  });
  if (!app?.phone) return { whatsappAccepted: false, smsAttempted: false, error: "Candidate phone number is missing" };
  const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
  const portal = `${origin}/candidate/${app.accessToken}`;
  const title = app.job?.title ?? "the role";
  const freeform = `Hi ${app.firstName ?? "there"}, an update on your Square 15 application for ${title}: ${statusMessage} See ${portal}`;
  const wa = await sendWhatsAppSmart(
    app.phone,
    "candidate_status_update",
    [app.firstName ?? "there", title, statusMessage, portal],
    freeform,
    undefined,
  );
  await db.applicationMessage.create({
    data: {
      applicationId,
      channel: "WHATSAPP",
      direction: "OUTBOUND",
      subject: `${templateKey}${wa.via ? ` (${wa.via})` : ""}`,
      body: wa.ok ? freeform : `[Delivery failed: ${wa.error}]\n\n${freeform}`,
      templateKey: `${templateKey}_WA`,
      sentById: sentById ?? undefined,
      deliveredAt: wa.ok ? new Date() : null,
      provider: "WHATSAPP",
      providerMessageId: wa.providerMessageId,
    },
  }).catch(() => {});
  let smsAttempted = false;
  let smsAccepted: boolean | undefined;
  let smsError: string | undefined;
  if (!wa.ok) {
    smsAttempted = true;
    const sms = await sendSMS(app.phone, freeform);
    smsAccepted = sms.ok;
    smsError = sms.error;
    await db.applicationMessage.create({
      data: {
        applicationId,
        channel: "SMS",
        direction: "OUTBOUND",
        subject: templateKey,
        body: sms.ok ? freeform : `[Delivery failed: ${sms.error}]\n\n${freeform}`,
        templateKey: `${templateKey}_SMS`,
        sentById: sentById ?? undefined,
        deliveredAt: sms.ok ? new Date() : null,
        provider: "SMS",
      },
    }).catch(() => {});
  }
  return {
    whatsappAccepted: wa.ok,
    whatsappVia: wa.via,
    smsAttempted,
    smsAccepted,
    error: wa.ok ? undefined : [wa.error, smsError].filter(Boolean).join("; ") || undefined,
  };
}

// C5 · Resend reference questionnaire to referee
export const resendReferenceQuestionnaire = baseProcedure
  .input(z.object({ token: z.string(), referenceCheckId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const ref = await db.referenceCheck.findUnique({
      where: { id: input.referenceCheckId },
      include: { application: { select: { firstName: true, lastName: true, job: { select: { title: true } } } } },
    });
    if (!ref) throw new TRPCError({ code: "NOT_FOUND" });
    const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const link = `${origin}/reference/${ref.token}`;
    await sendCandidateEmail({
      applicationId: ref.applicationId,
      to: ref.refereeEmail,
      subject: `Reminder: reference for ${ref.application.firstName} ${ref.application.lastName}`,
      templateKey: "REFERENCE_RESEND",
      sentById: user.id,
      html: `<p>Dear ${ref.refereeName},</p><p>This is a reminder to complete the short reference questionnaire for ${ref.application.firstName} ${ref.application.lastName} (${ref.application.job?.title ?? "the role"}). It takes about 5 minutes:</p><p><a href="${link}">${link}</a></p><p>Thank you.</p>`,
    });
    await db.referenceCheck.update({ where: { id: ref.id }, data: { sentAt: new Date() } });
    return { ok: true };
  });

// C1/C5 · Send referee link via WhatsApp (candidate can forward themselves,
// or recruiter can trigger).
export const sendReferenceLinkWhatsApp = baseProcedure
  .input(z.object({ token: z.string(), referenceCheckId: z.number(), toPhone: z.string().min(9) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertRecruiter(user);
    const ref = await db.referenceCheck.findUnique({
      where: { id: input.referenceCheckId },
      include: { application: { select: { firstName: true, lastName: true, id: true } } },
    });
    if (!ref) throw new TRPCError({ code: "NOT_FOUND" });
    const origin = (process.env.BASE_URL || process.env.APP_URL || "").replace(/\/+$/, "");
    const link = `${origin}/reference/${ref.token}`;
    const body = `Hi ${ref.refereeName}, ${ref.application.firstName} ${ref.application.lastName} listed you as a reference at Square 15. Please complete this short form (5 min): ${link}`;
    const r = await sendWhatsApp(input.toPhone, body);
    await db.applicationMessage.create({
      data: {
        applicationId: ref.applicationId,
        channel: "WHATSAPP",
        direction: "OUTBOUND",
        subject: "Reference link",
        body: r.ok ? body : `[Delivery failed: ${r.error}]\n\n${body}`,
        templateKey: "REFERENCE_LINK_WA",
        sentById: user.id,
        deliveredAt: r.ok ? new Date() : null,
        provider: "WHATSAPP",
        providerMessageId: r.providerMessageId,
      },
    }).catch(() => {});
    return { ok: r.ok, error: r.error };
  });

// ═══════════════════════════════════════════════════════════════════════
// C3 · Webcam consent audit (called client-side right before/after grant)
// ═══════════════════════════════════════════════════════════════════════

export const logWebcamConsent = baseProcedure
  .input(
    z.object({
      accessToken: z.string(),
      granted: z.boolean(),
      version: z.string().default("1.0"),
      declineReason: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const app = await db.application.findUnique({
      where: { accessToken: input.accessToken },
      select: { id: true },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND" });
    return db.consentEvent.create({
      data: {
        applicationId: app.id,
        action: input.granted ? "WEBCAM_MONITORING" : "WEBCAM_DECLINED",
        version: input.version,
        notes: input.declineReason,
      },
    });
  });
