/**
 * ATS Automation service
 * â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
 *  - CV parsing (Gemini multimodal)
 *  - Portfolio visual review (Gemini vision)
 *  - Auto-invite emails for assessments after application
 *  - Auto-advance / auto-reject rules based on aiMatchScore + overallScore
 *  - SLA daily digest for recruiters
 *  - Retention cron â€” anonymise applications past retainUntil
 *  - Weekly adverse-impact alert to HR
 *  - Weekly job-alert emails to opted-in candidates
 *  - Reference-check auto-outreach on OFFER stage
 *  - Referral notification on HIRED stage
 *
 * All schedules boot lazily on first request via `bootstrapRecruitmentAutomation`.
 */

import { generateText } from "~/server/services/ai/controlledGeneration";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import { minioClient } from "~/server/minio";
import { sendEmail } from "~/server/utils/email";
import { createNotification } from "~/server/utils/notifications";
import { getAdverseImpactReport } from "./analytics";
import { computeAIMatchScore, recomputeApplicationScore } from "./atsHelpers";
import { sendCandidateEmail, logSystemMessage } from "./messaging";

// Use "latest" alias so recruiters aren't blocked when a specific model version
// is retired for new users. Override via env.RECRUITMENT_GEMINI_MODEL.
const model = google(process.env.RECRUITMENT_GEMINI_MODEL || "gemini-flash-latest");

const APP_URL = process.env.APP_URL || process.env.PUBLIC_URL || process.env.APP_BASE_URL || "https://square15management.co.za";

// Tunable via env
const AI_MATCH_AUTO_REJECT_BELOW = parseInt(
  process.env.AI_MATCH_AUTO_REJECT_BELOW ?? "35",
  10,
);
const AI_MATCH_AUTO_ADVANCE_ABOVE = parseInt(
  process.env.AI_MATCH_AUTO_ADVANCE_ABOVE ?? "75",
  10,
);
const AUTO_STALE_DAYS = parseInt(process.env.AUTO_STALE_DAYS ?? "14", 10);

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// MinIO helpers
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

function parseMinioUrl(fileUrl: string): { bucket: string; object: string } | null {
  // Accepts /minio/<bucket>/<object> and http(s)://host/minio/<bucket>/<object>
  const m = fileUrl.match(/\/minio\/([^/]+)\/(.+)$/);
  if (!m) return null;
  return { bucket: m[1]!, object: m[2]! };
}

async function fetchMinioObject(fileUrl: string): Promise<Buffer | null> {
  const parts = parseMinioUrl(fileUrl);
  if (!parts) return null;
  try {
    const stream = await (minioClient as any).getObject(parts.bucket, parts.object);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  } catch (err) {
    console.warn(`[atsAutomation] failed to fetch ${fileUrl}:`, err);
    return null;
  }
}

function guessMime(fileName: string, explicit?: string | null): string {
  if (explicit) return explicit;
  const ext = fileName.toLowerCase().split(".").pop() ?? "";
  return (
    {
      pdf: "application/pdf",
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
      doc: "application/msword",
      docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    }[ext] ?? "application/octet-stream"
  );
}

function extractJson<T = any>(text: string): T | null {
  const cleaned = text.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// CV parsing â€” Gemini multimodal reads the CV and returns structured data
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function parseAndSummariseCV(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      attachments: { where: { label: "CV / Resume" }, take: 1 },
      job: { select: { title: true, requirements: true, competencies: true } },
    },
  });
  if (!app) return;

  const cvAttachment = app.attachments[0];
  const cvUrl = cvAttachment?.fileUrl ?? app.resumeUrl ?? null;
  if (!cvUrl) return;

  const mime = guessMime(cvAttachment?.fileName ?? cvUrl, cvAttachment?.fileType);
  // Gemini 2.0 supports pdf + images natively; skip docx (no native handler).
  if (!/^(application\/pdf|image\/)/.test(mime)) {
    console.log(`[CV] skip parse for ${applicationId} â€” unsupported mime ${mime}`);
    return;
  }

  const buf = await fetchMinioObject(cvUrl);
  if (!buf) return;

  const jobBlock = app.job
    ? `TARGET JOB: ${app.job.title}
JOB REQUIREMENTS: ${app.job.requirements ?? "N/A"}
JOB COMPETENCIES: ${(app.job.competencies ?? []).join(", ") || "N/A"}`
    : "TARGET JOB: not specified";

  const prompt = `You are an expert recruiter. Extract structured info from this candidate CV and give a fit-verdict for the target job.

${jobBlock}

Return ONLY valid JSON with this exact shape:
{
  "summary": "<3 sentences summarising the candidate's professional background>",
  "skills": ["<skill1>", "<skill2>", ...],
  "experience": [
    {"employer":"<company>","title":"<role>","from":"<YYYY-MM or year>","to":"<YYYY-MM or 'present' or year>","monthsDuration": <int>}
  ],
  "education": ["<qualification 1>", "<qualification 2>"],
  "certifications": ["<cert 1>", "<cert 2>"],
  "gaps": ["<any employment gap > 6 months, if none omit>"],
  "yearsExperience": <total years number>,
  "strengths": "<2-3 comma-separated strengths for this specific role>",
  "redFlags": "<any concerns, or 'None identified' if clean>"
}`;

  try {
    const { text } = await generateText({
      aiFeature: "recruitment.cvExtraction",
      model,
      maxTokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: buf, mimeType: mime } as any,
          ],
        },
      ],
    });
    const parsed = extractJson<{
      summary: string;
      skills: string[];
      experience: any[];
      education: string[];
      certifications: string[];
      gaps?: string[];
      yearsExperience?: number;
      strengths: string;
      redFlags: string;
    }>(text);
    if (!parsed) return;

    const skillLines = (parsed.skills ?? []).slice(0, 20).join(", ");
    const expLines = (parsed.experience ?? [])
      .map(
        (e) =>
          `â€¢ ${e.employer ?? "?"} â€” ${e.title ?? "?"} (${e.from ?? "?"} â†’ ${e.to ?? "?"})`,
      )
      .join("\n");
    const eduLines = (parsed.education ?? []).map((e) => `â€¢ ${e}`).join("\n");
    const certLines = (parsed.certifications ?? []).map((c) => `â€¢ ${c}`).join("\n");
    const gapLines = (parsed.gaps ?? []).map((g) => `â€¢ ${g}`).join("\n");

    const richSummary =
      `${parsed.summary ?? ""}\n\n` +
      `ðŸ“Œ Extracted skills:\n${skillLines || "n/a"}\n\n` +
      `ðŸ’¼ Employment history:\n${expLines || "n/a"}\n\n` +
      `ðŸŽ“ Education:\n${eduLines || "n/a"}\n\n` +
      (certLines ? `ðŸŽ– Certifications:\n${certLines}\n\n` : "") +
      (gapLines ? `âš ï¸ Gaps:\n${gapLines}\n\n` : "");

    await db.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: richSummary.trim(),
        aiStrengths: parsed.strengths ?? "",
        aiRedFlags: parsed.redFlags ?? "",
        // Only overwrite yearsExperience if we don't have one yet
        ...(app.yearsExperience == null && parsed.yearsExperience
          ? { yearsExperience: Math.round(parsed.yearsExperience) }
          : {}),
      },
    });
    console.log(`[CV] parsed CV for application ${applicationId} (${(parsed.skills ?? []).length} skills)`);
  } catch (err) {
    console.warn(`[CV] parse failed for ${applicationId}:`, err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Portfolio visual review â€” Gemini vision on images
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function reviewPortfolio(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      attachments: { where: { label: "Portfolio" }, take: 6 },
      job: { select: { title: true } },
    },
  });
  if (!app || app.attachments.length === 0) return;

  const images: { buf: Buffer; mime: string; name: string }[] = [];
  for (const a of app.attachments) {
    const mime = guessMime(a.fileName, a.fileType);
    if (!mime.startsWith("image/") && mime !== "application/pdf") continue;
    const buf = await fetchMinioObject(a.fileUrl);
    if (buf) images.push({ buf, mime, name: a.fileName });
  }
  if (images.length === 0) return;

  const prompt = `You are an expert trade quality assessor. The candidate is applying for a ${
    app.job?.title ?? app.primaryTrade ?? "trade"
  } role. Assess the workmanship quality shown in these portfolio items.

Return ONLY valid JSON with this exact shape:
{
  "portfolioScore": <0-100 overall quality score>,
  "positives": ["<bullet 1>", "<bullet 2>"],
  "concerns": ["<any concerns, empty array if none>"],
  "summary": "<1-2 sentence overall verdict>"
}`;

  try {
    const content: any[] = [{ type: "text", text: prompt }];
    for (const img of images) {
      if (img.mime.startsWith("image/")) {
        content.push({ type: "image", image: img.buf });
      } else {
        content.push({ type: "file", data: img.buf, mimeType: img.mime });
      }
    }
    const { text } = await generateText({
      aiFeature: "recruitment.portfolioScoring",
      model,
      maxTokens: 800,
      messages: [{ role: "user", content }],
    });
    const parsed = extractJson<{
      portfolioScore: number;
      positives: string[];
      concerns: string[];
      summary: string;
    }>(text);
    if (!parsed) return;

    const block =
      `\n\nðŸ–¼ï¸ Portfolio review (${images.length} item${images.length === 1 ? "" : "s"}, AI score ${parsed.portfolioScore}/100):\n` +
      `${parsed.summary}\n` +
      (parsed.positives?.length
        ? `+ ${parsed.positives.map((p) => p).join("\n+ ")}\n`
        : "") +
      (parsed.concerns?.length
        ? `- ${parsed.concerns.map((c) => c).join("\n- ")}\n`
        : "");

    const current = await db.application.findUnique({
      where: { id: applicationId },
      select: { aiSummary: true, aiStrengths: true },
    });

    await db.application.update({
      where: { id: applicationId },
      data: {
        aiSummary: (current?.aiSummary ?? "") + block,
        // Note portfolio score in strengths if strong
        ...(parsed.portfolioScore >= 75 && !(current?.aiStrengths ?? "").includes("Portfolio")
          ? {
              aiStrengths: `${current?.aiStrengths ?? ""}${current?.aiStrengths ? ", " : ""}Strong portfolio (${parsed.portfolioScore}/100)`,
            }
          : {}),
      },
    });
    console.log(`[Portfolio] reviewed ${images.length} items for app ${applicationId} â€” score ${parsed.portfolioScore}`);
  } catch (err) {
    console.warn(`[Portfolio] review failed for ${applicationId}:`, err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Assessment invite email
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function sendAssessmentInvite(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    include: {
      job: {
        select: {
          title: true,
          requireIQ: true,
          requireEQ: true,
          requireBigFive: true,
          requireMBTI: true,
          requireSJT: true,
          requireInterview: true,
        },
      },
    },
  });
  if (!app || !app.job) return;
  const j = app.job;
  const required = [
    j.requireIQ && "Cognitive aptitude (IQ)",
    j.requireEQ && "Emotional intelligence (EQ)",
    j.requireBigFive && "Big Five personality",
    j.requireMBTI && "Personality type (MBTI)",
    j.requireSJT && "Situational judgement",
    j.requireInterview && "AI behavioural interview",
  ].filter(Boolean) as string[];
  if (required.length === 0) return;

  const list = required.map((r) => `<li>${r}</li>`).join("");
  const portalUrl = `${APP_URL}/candidate/${app.accessToken}`;
  await sendCandidateEmail({
    applicationId: app.id,
    to: app.email,
    subject: `Next step: complete your assessments for ${j.title}`,
    templateKey: "ASSESSMENT_INVITE",
    html: `<div style="font-family:Arial,sans-serif;max-width:600px">
      <p>Hi ${app.firstName},</p>
      <p>Thanks for applying for <b>${j.title}</b>. To help us evaluate your fit, please complete the following in your candidate portal:</p>
      <ul>${list}</ul>
      <p><a href="${portalUrl}" style="display:inline-block;padding:10px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Open my candidate portal</a></p>
      <p style="font-size:12px;color:#666">This link is valid for 21 days. If you have any questions, simply reply to this email or use the in-portal messaging.</p>
    </div>`,
    companionMessage: `Please complete your assessments for ${j.title} (${required.length} to do). Open your candidate portal to start.`,
  });
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Auto-advance rules  â€” nightly cron
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function autoAdvanceApplications(): Promise<{ advanced: number; rejected: number }> {
  let advanced = 0;
  let rejected = 0;

  // 1. Auto-move to SCREENING once we have an aiMatchScore
  const readyForScreening = await db.application.findMany({
    where: {
      stageBucket: "APPLIED",
      aiMatchScore: { not: null },
      deletedAt: null,
      // Give the candidate 24h buffer in case interview scoring is still in-flight
      createdAt: { lte: new Date(Date.now() - 24 * 3600 * 1000) },
    },
    select: {
      id: true,
      aiMatchScore: true,
      firstName: true,
      email: true,
      job: { select: { title: true } },
    },
    take: 200,
  });

  for (const a of readyForScreening) {
    const score = a.aiMatchScore ?? 0;
    if (score < AI_MATCH_AUTO_REJECT_BELOW) {
      // Auto-reject low-fit candidates with a compassionate template
      await db.application.update({
        where: { id: a.id },
        data: {
          stageBucket: "REJECTED",
          reviewedAt: new Date(),
          reviewNotes: `Auto-rejected â€” AI match score ${Math.round(score)}/100 below threshold (${AI_MATCH_AUTO_REJECT_BELOW}).`,
        },
      });
      await db.applicationStageHistory.create({
        data: {
          applicationId: a.id,
          bucket: "REJECTED",
          reason: `AI match ${Math.round(score)} < ${AI_MATCH_AUTO_REJECT_BELOW}`,
        },
      });
      void sendCandidateEmail({
        applicationId: a.id,
        to: a.email,
        subject: `Update on your application for ${a.job?.title ?? "the role"}`,
        templateKey: "AUTO_REJECT",
        html: `<p>Hi ${a.firstName},</p>
          <p>Thank you very much for your interest in the ${a.job?.title ?? "role"} at Square15.</p>
          <p>After carefully reviewing your application, we've decided not to move forward on this occasion. This decision is in no way a reflection of your abilities.</p>
          <p>We'll keep your details on file for 24 months (unless you tell us otherwise) and reach out if a more suitable role opens up.</p>
          <p>Wishing you every success in your search.</p>
          <p style="color:#666;font-size:12px">Square15 Recruitment Team</p>`,
      });
      rejected++;
    } else {
      const newBucket = score >= AI_MATCH_AUTO_ADVANCE_ABOVE ? "INTERVIEW" : "SCREENING";
      await db.application.update({
        where: { id: a.id },
        data: {
          stageBucket: newBucket,
          reviewNotes:
            newBucket === "INTERVIEW"
              ? `Auto-fast-tracked â€” AI match ${Math.round(score)}/100 â‰¥ ${AI_MATCH_AUTO_ADVANCE_ABOVE}.`
              : `Auto-moved to screening â€” AI match ${Math.round(score)}/100.`,
        },
      });
      await db.applicationStageHistory.create({
        data: {
          applicationId: a.id,
          bucket: newBucket,
          reason: `AI match ${Math.round(score)} â€” auto ${newBucket === "INTERVIEW" ? "fast-track" : "screening"}`,
        },
      });
      advanced++;
    }
  }

  return { advanced, rejected };
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// SLA daily digest for recruiters
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

// Per-bucket SLA in days. Any application whose `stageEnteredAt` is older
// than the threshold for its current bucket is considered overdue. Values
// come from evidence-based recruiting norms; each is env-overridable so
// you can tighten SLAs per company.
//   APPLIED   → 3d   (first review of a fresh application)
//   SCREENING → 5d   (recruiter phone screen turnaround)
//   ASSESSMENT→ 7d   (candidate given time to complete assessments)
//   INTERVIEW → 7d   (interview scheduling + debrief)
//   OFFER     → 5d   (finalising and sending the offer)
//   BACKGROUND→ 7d   (background check turnaround)
const SLA_DAYS_BY_BUCKET: Record<string, number> = {
  APPLIED: parseInt(process.env.SLA_DAYS_APPLIED ?? "3", 10),
  SCREENING: parseInt(process.env.SLA_DAYS_SCREENING ?? "5", 10),
  ASSESSMENT: parseInt(process.env.SLA_DAYS_ASSESSMENT ?? "7", 10),
  INTERVIEW: parseInt(process.env.SLA_DAYS_INTERVIEW ?? "7", 10),
  OFFER: parseInt(process.env.SLA_DAYS_OFFER ?? "5", 10),
  BACKGROUND_CHECK: parseInt(process.env.SLA_DAYS_BACKGROUND ?? "7", 10),
};

async function sendSlaNudges() {
  const recruiters = await db.user.findMany({
    where: {
      role: {
        in: [
          "RECRUITER",
          "HR",
          "ADMIN",
          "SENIOR_ADMIN",
          "MANAGER",
          "JUNIOR_ADMIN",
          "TECHNICAL_MANAGER",
        ],
      },
      isActive: true,
    },
    select: { id: true, email: true, firstName: true, role: true },
    take: 50,
  });

  for (const r of recruiters) {
    try {
      // Aggregate overdue apps assigned to this recruiter, per bucket.
      const now = Date.now();
      const buckets = Object.entries(SLA_DAYS_BY_BUCKET);
      const overdueByBucket: { bucket: string; count: number; oldestDays: number; days: number }[] = [];
      let totalOverdue = 0;

      for (const [bucket, days] of buckets) {
        const cutoff = new Date(now - days * 24 * 3600 * 1000);
        const list = await db.application.findMany({
          where: {
            assignedRecruiterId: r.id,
            stageBucket: bucket as any,
            stageEnteredAt: { lte: cutoff },
            deletedAt: null,
          },
          select: { id: true, stageEnteredAt: true },
          take: 200,
        });
        if (list.length === 0) continue;
        const oldest = list.reduce((min, a) => {
          const t = a.stageEnteredAt?.getTime() ?? now;
          return t < min ? t : min;
        }, now);
        overdueByBucket.push({
          bucket,
          count: list.length,
          oldestDays: Math.floor((now - oldest) / (24 * 3600 * 1000)),
          days,
        });
        totalOverdue += list.length;
      }

      if (totalOverdue === 0) continue;

      const rows = overdueByBucket
        .map(
          (b) =>
            `<tr><td style="padding:6px 12px;border-top:1px solid #e5e7eb;">${b.bucket}</td><td style="padding:6px 12px;border-top:1px solid #e5e7eb;text-align:right;">${b.count}</td><td style="padding:6px 12px;border-top:1px solid #e5e7eb;text-align:right;">&gt; ${b.days}d (oldest ${b.oldestDays}d)</td></tr>`,
        )
        .join("");

      await sendEmail({
        to: r.email,
        subject: `${totalOverdue} candidate${totalOverdue === 1 ? "" : "s"} overdue in your pipeline`,
        html: `<div style="font-family:Arial,sans-serif;max-width:640px">
          <p>Hi ${r.firstName},</p>
          <p>The following candidates assigned to you have been sitting in the same pipeline stage longer than the recommended SLA. Please review and either advance or reject.</p>
          <table style="border-collapse:collapse;width:100%;margin:12px 0;font-size:14px;">
            <thead>
              <tr style="background:#f9fafb;text-align:left;">
                <th style="padding:6px 12px;">Stage</th>
                <th style="padding:6px 12px;text-align:right;">Overdue</th>
                <th style="padding:6px 12px;text-align:right;">SLA</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
          <p><a href="${APP_URL}/staff/recruitment" style="display:inline-block;padding:10px 18px;background:#0d9488;color:#fff;text-decoration:none;border-radius:6px">Open recruitment dashboard</a></p>
          <p style="color:#6b7280;font-size:12px;">You are receiving this daily digest because you have candidates assigned to you. SLAs can be tuned per company via SLA_DAYS_* env vars.</p>
        </div>`,
      }).catch(() => {});

      await createNotification({
        recipientId: r.id,
        recipientRole: r.role,
        message: `${totalOverdue} candidate${totalOverdue === 1 ? "" : "s"} overdue across your pipeline stages.`,
        type: "SYSTEM_ALERT" as any,
      }).catch(() => {});
    } catch (err) {
      console.warn(`[SLA] nudge for ${r.email} failed:`, err);
    }
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Retention cron â€” anonymise applications past retainUntil
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function retentionCleanup(): Promise<number> {
  const expired = await db.application.findMany({
    where: {
      retainUntil: { lte: new Date() },
      deletedAt: null,
      dataRetentionOptIn: false, // opted-in candidates stay in talent pool
    },
    select: { id: true },
    take: 500,
  });

  for (const a of expired) {
    try {
      await db.$transaction([
        // Anonymise PII but preserve stats
        db.application.update({
          where: { id: a.id },
          data: {
            firstName: "Redacted",
            lastName: "Candidate",
            email: `redacted-${a.id}@example.invalid`,
            phone: null,
            idNumber: null,
            address: null,
            city: null,
            province: null,
            resumeUrl: null,
            portfolioUrls: [],
            motivationLetter: null,
            qualifications: null,
            aiSummary: null,
            aiStrengths: null,
            aiRedFlags: null,
            aiMatchExplanation: null,
            deletedAt: new Date(),
          },
        }),
        // Purge attachments (metadata only â€” actual files can be lifecycle-purged separately)
        db.applicationAttachment.deleteMany({ where: { applicationId: a.id } }),
        // Purge messages
        db.applicationMessage.deleteMany({ where: { applicationId: a.id } }),
        // Purge demographic profile
        db.demographicProfile.deleteMany({ where: { applicationId: a.id } }),
      ]);
    } catch (err) {
      console.warn(`[Retention] failed for app ${a.id}:`, err);
    }
  }
  return expired.length;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Adverse-impact weekly alert
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function sendWeeklyAdverseImpactAlert() {
  try {
    const report = await getAdverseImpactReport({});
    // Flag any group failing the 4/5ths rule
    const flagged: string[] = [];
    for (const g of report.groups ?? []) {
      if (g.adverseImpact) {
        flagged.push(`${g.group} (selection ratio ${g.selectionRatio.toFixed(2)}, ${g.hired}/${g.total} hired)`);
      }
    }
    if (flagged.length === 0) return;

    const hrTeam = await db.user.findMany({
      where: { role: { in: ["HR", "ADMIN", "SENIOR_ADMIN"] } },
      select: { email: true, firstName: true, id: true, role: true },
      take: 20,
    });
    for (const u of hrTeam) {
      await sendEmail({
        to: u.email,
        subject: "âš ï¸ Recruitment adverse-impact alert (4/5ths rule)",
        html: `<p>Hi ${u.firstName},</p>
          <p>The following demographic groups fell below the 4/5ths selection-ratio threshold in the last analytics window:</p>
          <ul>${flagged.map((f) => `<li>${f}</li>`).join("")}</ul>
          <p><a href="${APP_URL}/staff/recruitment/analytics">Review analytics</a></p>`,
      }).catch(() => {});
      await createNotification({
        recipientId: u.id,
        recipientRole: u.role,
        message: `Adverse-impact rule triggered on ${flagged.length} group(s).`,
        type: "SYSTEM_ALERT" as any,
      }).catch(() => {});
    }
  } catch (err) {
    console.warn("[AdverseImpact] weekly alert failed:", err);
  }
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Weekly job-alert emails
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

async function sendWeeklyJobAlerts(): Promise<number> {
  const optedIn = await db.application.findMany({
    where: {
      dataRetentionOptIn: true,
      deletedAt: null,
      primaryTrade: { not: null },
      stageBucket: { in: ["REJECTED", "WITHDRAWN", "HIRED", "ON_HOLD"] as any[] },
    },
    select: {
      id: true,
      firstName: true,
      email: true,
      primaryTrade: true,
      accessToken: true,
    },
    distinct: ["email"],
    take: 1000,
  });
  let sent = 0;
  for (const c of optedIn) {
    if (!c.primaryTrade) continue;
    const trade = c.primaryTrade;
    const matchingJobs = await db.job.findMany({
      where: {
        status: "OPEN",
        visibility: "PUBLIC",
        openedAt: { gte: new Date(Date.now() - 7 * 24 * 3600 * 1000) },
        OR: [
          { category: trade },
          { title: { contains: trade, mode: "insensitive" } },
        ],
      },
      select: { id: true, title: true, slug: true, location: true },
      take: 5,
    });
    if (matchingJobs.length === 0) continue;
    const rows = matchingJobs
      .map(
        (j) =>
          `<li><a href="${APP_URL}/careers/${j.slug}">${j.title}</a>${j.location ? ` â€” ${j.location}` : ""}</li>`,
      )
      .join("");
    await sendEmail({
      to: c.email,
      subject: `New ${trade} opportunities at Square15`,
      html: `<p>Hi ${c.firstName},</p>
        <p>Since you asked us to keep you posted, here are new ${trade} roles you may be interested in:</p>
        <ul>${rows}</ul>
        <p style="font-size:12px;color:#666">You're receiving this because you opted in during your previous application. <a href="${APP_URL}/candidate/${c.accessToken}">Manage preferences</a>.</p>`,
    }).catch(() => {});
    sent++;
  }
  return sent;
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Reference-check auto-outreach on OFFER stage
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function autoRequestReferences(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      id: true,
      firstName: true,
      lastName: true,
      email: true,
      referenceChecks: { select: { id: true } },
    },
  });
  if (!app) return;
  if (app.referenceChecks.length > 0) return;

  // Ask the candidate (rather than guess referees) to supply 2 referees via a form on the portal
  await sendEmail({
    to: app.email,
    subject: `Reference checks â€” final step for your Square15 offer`,
    html: `<p>Hi ${app.firstName},</p>
      <p>Congratulations â€” you've reached the offer stage. As a last step, please provide 2 professional references so we can complete the process.</p>
      <p>Simply reply to this email with each referee's <b>name, email address, phone number, and their relationship to you</b> (e.g. previous manager). We'll take it from there.</p>
      <p>Thank you,<br>Square15 Recruitment Team</p>`,
  }).catch(() => {});
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Referral notification on HIRED
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export async function notifyReferrerOnHired(applicationId: number): Promise<void> {
  const app = await db.application.findUnique({
    where: { id: applicationId },
    select: {
      firstName: true,
      lastName: true,
      referrerUserId: true,
      job: { select: { title: true } },
    },
  });
  if (!app?.referrerUserId) return;
  const referrer = await db.user.findUnique({
    where: { id: app.referrerUserId },
    select: { id: true, firstName: true, email: true, role: true },
  });
  if (!referrer) return;
  await sendEmail({
    to: referrer.email,
    subject: `ðŸŽ‰ Your referral was hired â€” thank you`,
    html: `<p>Hi ${referrer.firstName},</p>
      <p><b>${app.firstName} ${app.lastName}</b> (who you referred for <b>${app.job?.title ?? "a role"}</b>) has just accepted an offer and joined Square15.</p>
      <p>HR will be in touch about your referral reward. Thank you for helping us grow the team!</p>`,
  }).catch(() => {});
  await createNotification({
    recipientId: referrer.id,
    recipientRole: referrer.role,
    message: `Your referral ${app.firstName} ${app.lastName} was just hired â€” a reward is on the way.`,
    type: "SYSTEM_ALERT" as any,
  }).catch(() => {});
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// AI decision audit log â€” writes to PM2 logs so ops can grep
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export function logAiDecision(event: {
  applicationId: number;
  action: string;
  score?: number | null;
  reason: string;
  extras?: Record<string, any>;
}) {
  console.log(
    `[AI_AUDIT] ${new Date().toISOString()} app=${event.applicationId} action=${event.action} score=${event.score ?? "-"} reason="${event.reason}" ${
      event.extras ? JSON.stringify(event.extras) : ""
    }`,
  );
}

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// Hook helpers â€” called from other files
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

/**
 * Called from createApplication in the background.
 * Runs AI match, CV parse, portfolio review, then sends assessment invite.
 */
export function kickoffApplicationAI(applicationId: number) {
  (async () => {
    // Collect per-step failures so we can log one aggregated system-note
    // to the ApplicationMessage timeline instead of leaving the recruiter
    // in the dark when AI processing silently fails.
    const failures: string[] = [];
    try {
      await computeAIMatchScore(applicationId);
    } catch (e) {
      console.warn("[AI kickoff] match failed", e);
      failures.push(`Match scoring: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await parseAndSummariseCV(applicationId);
    } catch (e) {
      console.warn("[AI kickoff] cv failed", e);
      failures.push(`CV parsing: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await reviewPortfolio(applicationId);
    } catch (e) {
      console.warn("[AI kickoff] portfolio failed", e);
      failures.push(`Portfolio review: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await recomputeApplicationScore(applicationId);
    } catch (e) {
      console.warn("[AI kickoff] recompute failed", e);
      failures.push(`Score recompute: ${e instanceof Error ? e.message : String(e)}`);
    }
    try {
      await sendAssessmentInvite(applicationId);
    } catch (e) {
      console.warn("[AI kickoff] invite failed", e);
      failures.push(`Assessment invite: ${e instanceof Error ? e.message : String(e)}`);
    }

    if (failures.length > 0) {
      await logSystemMessage({
        applicationId,
        subject: `AI processing warning — ${failures.length} step${failures.length === 1 ? "" : "s"} failed`,
        templateKey: "AI_KICKOFF_FAILURE",
        body: [
          "Automated AI processing encountered errors while onboarding this application.",
          "Recruiter should review manually — CV summary, match score, or assessment invite may be missing.",
          "",
          "Failed steps:",
          ...failures.map((f) => `  • ${f}`),
        ].join("\n"),
      });
    }
  })().catch((err) => {
    console.error("[AI kickoff] unhandled", err);
    logSystemMessage({
      applicationId,
      subject: "AI processing failed unexpectedly",
      templateKey: "AI_KICKOFF_FAILURE",
      body: `Unhandled error during AI kickoff: ${err instanceof Error ? err.message : String(err)}`,
    }).catch(() => {});
  });
}

// ═══════════════════════════════════════════════════════════════════════
// Interview reminders — T-24h to candidates and panel members.
// Uses the InterviewBooking.reminderSentAt column so we send exactly once
// per booking. The reminder is dispatched when scheduledStart lies within
// the next 24h and no reminder has been sent yet. Slow-tick cadence (6h)
// means a candidate who books >24h in advance gets at least ~18h notice.
// ═══════════════════════════════════════════════════════════════════════
async function sendInterviewReminders(): Promise<number> {
  const now = Date.now();
  const upcoming = await db.interviewBooking.findMany({
    where: {
      scheduledStart: { gte: new Date(now), lte: new Date(now + 25 * 3600 * 1000) },
      reminderSentAt: null,
      status: { in: ["SCHEDULED", "CONFIRMED"] },
    },
    include: {
      application: {
        select: { id: true, firstName: true, email: true, job: { select: { title: true } } },
      },
      panel: {
        include: {
          members: {
            include: { user: { select: { id: true, firstName: true, email: true } } },
          },
        },
      },
    },
    take: 100,
  });

  let sent = 0;
  for (const b of upcoming) {
    try {
      const start = b.scheduledStart.toLocaleString("en-ZA", {
        timeZone: b.timezone || "Africa/Johannesburg",
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
      const roleTitle = b.application.job?.title ?? "your interview";
      const meetingLine = b.meetingUrl
        ? `<p><b>Join link:</b> <a href="${b.meetingUrl}">${b.meetingUrl}</a></p>`
        : "";
      const locationLine = b.location
        ? `<p><b>Location:</b> ${b.location}</p>`
        : "";
      const agendaBlock = b.agenda
        ? `<p><b>What we'll cover:</b><br/>${b.agenda.replace(/\n/g, "<br/>")}</p>`
        : "";

      // Candidate reminder
      await sendCandidateEmail({
        applicationId: b.application.id,
        to: b.application.email,
        subject: `Reminder: interview tomorrow for ${roleTitle}`,
        templateKey: "INTERVIEW_REMINDER_T24H",
        html: `<div style="font-family:Arial,sans-serif;max-width:600px">
          <p>Hi ${b.application.firstName},</p>
          <p>This is a friendly reminder that your interview is scheduled for <b>${start}</b>.</p>
          <p><b>Role:</b> ${roleTitle}</p>
          ${meetingLine}
          ${locationLine}
          ${agendaBlock}
          <p>Please reply to this email or use the candidate portal if you need to reschedule.</p>
          <p style="color:#666;font-size:12px">Good luck &mdash; the Recruitment Team</p>
        </div>`,
      });

      // Panel reminders
      if (b.panel?.members?.length) {
        for (const m of b.panel.members) {
          if (!m.user?.email) continue;
          await sendEmail({
            to: m.user.email,
            subject: `Interview reminder: ${b.application.firstName} — ${roleTitle}`,
            html: `<div style="font-family:Arial,sans-serif;max-width:600px">
              <p>Hi ${m.user.firstName ?? "there"},</p>
              <p>You are on the panel for the interview with <b>${b.application.firstName}</b> tomorrow at <b>${start}</b> for the ${roleTitle} role.</p>
              ${meetingLine}
              ${locationLine}
              ${agendaBlock}
              <p><a href="${APP_URL}/admin/recruitment/applications/${b.application.id}" style="color:#0d9488">Open candidate profile</a></p>
            </div>`,
          }).catch(() => {});
        }
      }

      await db.interviewBooking.update({
        where: { id: b.id },
        data: { reminderSentAt: new Date() },
      });
      sent++;
    } catch (err) {
      console.warn(`[Interview reminder] booking ${b.id} failed:`, err);
    }
  }
  return sent;
}

// R5: Sunday-evening digest — each line manager gets a list of hires with due check-ins.
async function sendWeeklyCheckInDigest(): Promise<void> {
  const now = new Date();
  const cutoffs = [
    { day: 30, from: 30, to: 45 },
    { day: 60, from: 60, to: 75 },
    { day: 90, from: 90, to: 105 },
    { day: 180, from: 180, to: 195 },
  ];
  const hiredApps = await db.application.findMany({
    where: { stageBucket: "HIRED", hiredAt: { not: null } },
    include: {
      job: { select: { hiringManagerId: true, title: true, hiringManager: true } },
      performanceCheckIns: { select: { dayMilestone: true } },
    },
  });
  const perManager = new Map<number, { name: string; email: string; rows: string[] }>();
  for (const app of hiredApps) {
    const mgr = app.job?.hiringManager;
    if (!mgr) continue;
    const daysSince = Math.floor((now.getTime() - new Date(app.hiredAt!).getTime()) / (24 * 3600 * 1000));
    const done = new Set(app.performanceCheckIns.map((c) => c.dayMilestone));
    const dueMilestones: number[] = [];
    for (const c of cutoffs) if (daysSince >= c.from && daysSince <= c.to && !done.has(c.day)) dueMilestones.push(c.day);
    if (dueMilestones.length === 0) continue;
    const entry = perManager.get(mgr.id) ?? { name: `${mgr.firstName} ${mgr.lastName}`, email: mgr.email, rows: [] };
    entry.rows.push(`${app.firstName} ${app.lastName} (${app.job?.title}) — check-in due day ${dueMilestones.join(", ")}`);
    perManager.set(mgr.id, entry);
  }
  for (const entry of perManager.values()) {
    if (entry.rows.length === 0) continue;
    const html = `<p>Hi ${entry.name},</p><p>You have <strong>${entry.rows.length}</strong> performance check-ins due this week:</p><ul>${entry.rows.map((r) => `<li>${r}</li>`).join("")}</ul><p><a href="${process.env.BASE_URL ?? ""}/admin/recruitment/hr-quality?tab=checkins">Open check-ins dashboard</a></p>`;
    try {
      const { sendEmail } = await import("~/server/utils/email");
      await sendEmail({ to: entry.email, subject: "Performance check-ins due this week", html });
    } catch (err) {
      console.warn(`[digest] check-in digest to ${entry.email} failed:`, err);
    }
  }
}

// R1: Daily 07:00 SAST — email delivery health summary to super-admins.
async function sendEmailHealthDigest(): Promise<void> {
  const since = new Date(Date.now() - 24 * 3600 * 1000);
  const [delivered, failed] = await Promise.all([
    db.applicationMessage.count({ where: { createdAt: { gte: since }, deliveredAt: { not: null }, direction: "OUTBOUND" } }),
    db.applicationMessage.count({ where: { createdAt: { gte: since }, deliveredAt: null, direction: "OUTBOUND" } }),
  ]);
  const total = delivered + failed;
  if (total === 0) return;
  const failedPct = Math.round((failed / total) * 100);
  if (failedPct < 20) return; // only send when something is off
  const admins = await db.user.findMany({
    where: { role: { in: ["ADMIN", "SENIOR_ADMIN", "MANAGER"] } },
    select: { email: true },
    take: 20,
  });
  const html = `<p>Email delivery health (last 24h):</p><ul><li>Delivered: <strong>${delivered}</strong></li><li>Failed: <strong>${failed}</strong> (${failedPct}%)</li></ul><p>Check <a href="${process.env.BASE_URL ?? ""}/admin/recruitment">/admin/recruitment</a> for details.</p>`;
  try {
    const { sendEmail } = await import("~/server/utils/email");
    await sendEmail({ to: admins.map((a) => a.email).filter(Boolean) as string[], subject: `[Email health] ${failedPct}% failed in last 24h`, html });
  } catch (err) {
    console.warn(`[digest] email health digest failed:`, err);
  }
}

// ═══════════════════════════════════════════════════════════════════════
// Bootstrap the scheduler
// ═══════════════════════════════════════════════════════════════════════

// Imported lazily inside bootstrap so we don't pull in the tRPC procedures
// module during service-only imports (avoids circular-import surprises).
async function seedRejectionReasonsOnBoot() {
  try {
    const { bootstrapRejectionReasons } = await import(
      "~/server/trpc/procedures/recruitmentAts"
    );
    const { inserted, updated } = await bootstrapRejectionReasons();
    console.log(
      `[ATS-auto] rejection reasons seeded (inserted=${inserted}, updated=${updated})`,
    );
  } catch (err) {
    console.error("[ATS-auto] rejection reason seed failed:", err);
  }
}

let _bootstrapped = false;
export function bootstrapRecruitmentAutomation() {
  if (_bootstrapped) return;
  if (process.env.RECRUITMENT_AUTOMATION_ENABLED === "0") return;
  _bootstrapped = true;

  const CHECK_HOURS = 6;
  const intervalMs = CHECK_HOURS * 60 * 60 * 1000;

  let lastAutoAdvanceHour = -1;
  let lastSlaNudgeDate = "";
  let lastRetentionDate = "";
  let lastAdverseImpactWeek = "";
  let lastJobAlertsWeek = "";
  let lastCheckinDigestWeek = "";
  let lastEmailHealthDigestDate = "";

  // One-time canonical seed of rejection reasons so recruiters always have
  // a starting set to pick from without an admin manually clicking "seed".
  seedRejectionReasonsOnBoot().catch(() => {});

  const check = async () => {
    try {
      const now = new Date();
      // SAST = UTC+2
      const sast = new Date(now.getTime() + 2 * 60 * 60 * 1000);
      const hour = sast.getUTCHours();
      const day = sast.getUTCDay(); // 0 Sun â€¦ 6 Sat
      const dateKey = sast.toISOString().slice(0, 10);
      const weekKey = `${sast.getUTCFullYear()}-W${Math.floor(sast.getUTCDate() / 7)}`;

      // Auto-advance every 6 hours (at any check tick)
      if (hour !== lastAutoAdvanceHour) {
        const { advanced, rejected } = await autoAdvanceApplications();
        if (advanced || rejected)
          console.log(`[ATS-auto] advanced=${advanced} rejected=${rejected}`);
        lastAutoAdvanceHour = hour;
      }

      // Every tick: interview reminders for bookings within the next 25h
      // that haven't been reminded yet. Cheap query, safe to run often.
      try {
        const reminded = await sendInterviewReminders();
        if (reminded > 0) console.log(`[ATS-auto] interview reminders sent: ${reminded}`);
      } catch (err) {
        console.warn("[ATS-auto] interview reminders failed:", err);
      }

      // Daily 06:00-08:00 SAST â†’ SLA nudges
      if (hour >= 6 && hour < 8 && lastSlaNudgeDate !== dateKey) {
        await sendSlaNudges();
        try {
          const { runRecruiterSlaNudges } = await import(
            "~/server/trpc/procedures/recruitmentPackageA"
          );
          const res = await runRecruiterSlaNudges();
          console.log(
            `[ATS-auto] recruiter SLA nudges nudged=${res.nudged} skipped=${res.skipped}`,
          );
        } catch (err) {
          console.warn("[ATS-auto] recruiter SLA nudges failed:", err);
        }
        lastSlaNudgeDate = dateKey;
        console.log("[ATS-auto] SLA nudges sent");
      }

      // Daily 03:00-05:00 SAST â†’ retention cleanup
      if (hour >= 3 && hour < 5 && lastRetentionDate !== dateKey) {
        const cleaned = await retentionCleanup();
        lastRetentionDate = dateKey;
        if (cleaned > 0) console.log(`[ATS-auto] retention purged ${cleaned}`);
      }

      // Monday 08:00-10:00 SAST â†’ adverse impact alert
      if (day === 1 && hour >= 8 && hour < 10 && lastAdverseImpactWeek !== weekKey) {
        await sendWeeklyAdverseImpactAlert();
        lastAdverseImpactWeek = weekKey;
        console.log("[ATS-auto] adverse-impact alert done");
      }

      // Friday 09:00-11:00 SAST â†’ job alerts
      if (day === 5 && hour >= 9 && hour < 11 && lastJobAlertsWeek !== weekKey) {
        const sent = await sendWeeklyJobAlerts();
        lastJobAlertsWeek = weekKey;
        if (sent > 0) console.log(`[ATS-auto] job alerts sent to ${sent}`);
      }

      // Sunday 18:00-20:00 SAST -> weekly check-ins-due digest to managers
      if (day === 0 && hour >= 18 && hour < 20 && lastCheckinDigestWeek !== weekKey) {
        try {
          await sendWeeklyCheckInDigest();
          lastCheckinDigestWeek = weekKey;
          console.log("[ATS-auto] weekly check-in digest sent");
        } catch (err) {
          console.warn("[ATS-auto] check-in digest failed:", err);
        }
      }

      // Daily 07:00-08:00 SAST -> email delivery health digest to super admins
      if (hour === 7 && lastEmailHealthDigestDate !== dateKey) {
        try {
          await sendEmailHealthDigest();
          lastEmailHealthDigestDate = dateKey;
        } catch (err) {
          console.warn("[ATS-auto] email health digest failed:", err);
        }
      }
    } catch (err) {
      console.error("[ATS-auto] tick failed:", err);
    }
  };

  // First tick 60 s after boot
  setTimeout(check, 60 * 1000);
  setInterval(check, intervalMs);
  console.log(
    `[ATS-auto] scheduler started (checks every ${CHECK_HOURS}h). Reject<${AI_MATCH_AUTO_REJECT_BELOW}, fast-trackâ‰¥${AI_MATCH_AUTO_ADVANCE_ABOVE}, stale>${AUTO_STALE_DAYS}d`,
  );
}
