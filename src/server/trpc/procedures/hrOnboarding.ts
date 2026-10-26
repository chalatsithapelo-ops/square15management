/**
 * HR Onboarding pipeline — surfaces HIRED applications that have not yet
 * been converted into User rows, and one-click provisions them under the
 * correct role tile (Artisan, Technical Manager, etc.).
 */
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";
import crypto from "crypto";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";

function assertHR(user: any) {
  if (!isAdmin(user) && user.role !== "HR" && user.role !== "TECHNICAL_MANAGER") {
    throw new TRPCError({ code: "FORBIDDEN", message: "HR / Admin access required" });
  }
}

/**
 * Derive the User.role from the Job title / category / department.
 * Falls back to STAFF when nothing matches.
 */
export function deriveRoleFromJob(job: {
  title?: string | null;
  category?: string | null;
  department?: string | null;
  jobType?: string | null;
}): string {
  const bag = `${job.title ?? ""} ${job.category ?? ""} ${job.department ?? ""}`.toLowerCase();
  if (/technical\s*manager/.test(bag)) return "TECHNICAL_MANAGER";
  if (/property\s*manager/.test(bag)) return "PROPERTY_MANAGER";
  if (/senior\s*admin|snr\s*admin/.test(bag)) return "SENIOR_ADMIN";
  if (/junior\s*admin|jnr\s*admin/.test(bag)) return "JUNIOR_ADMIN";
  if (/^manager$|\bmanager\b/.test(bag) && !/sales|technical|property/.test(bag)) return "MANAGER";
  if (/hr\b|human\s*resources/.test(bag)) return "HR";
  if (/recruit/.test(bag)) return "RECRUITER";
  if (/sales/.test(bag)) return "STAFF"; // sales agents live under Staff — commission-only
  if (/contractor\s*senior/.test(bag)) return "CONTRACTOR_SENIOR_MANAGER";
  if (/contractor\s*junior/.test(bag)) return "CONTRACTOR_JUNIOR_MANAGER";
  if (/contractor/.test(bag)) return "CONTRACTOR";
  if (/plumb|electric|carpent|paint|artis|gardener|clean|handyman|welder|tiler|glazier/.test(bag))
    return "ARTISAN";
  return "STAFF";
}

// ═════════════════════════════════════════════════════════════════════════════
// getPendingOnboarding — HIRED applications with no User row yet
// ═════════════════════════════════════════════════════════════════════════════
export const getPendingOnboarding = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);

    const hired = await db.application.findMany({
      where: {
        stageBucket: "HIRED",
        deletedAt: null,
      },
      orderBy: { hiredAt: "desc" },
      include: {
        job: {
          select: {
            id: true,
            title: true,
            department: true,
            category: true,
            location: true,
            jobType: true,
            employmentType: true,
          },
        },
        attachments: {
          select: { id: true, label: true, fileName: true, fileUrl: true, fileType: true },
        },
        offers: {
          orderBy: { id: "desc" },
          take: 1,
          select: { id: true, title: true, status: true, pdfUrl: true, candidateSignedAt: true },
        },
        assessments: { select: { type: true, score: true, completedAt: true } },
        interviewBookings: {
          orderBy: { scheduledStart: "desc" },
          take: 3,
          select: { id: true, scheduledStart: true, status: true },
        },
        maintenanceArtisanLink: {
          select: { status: true, approvedAt: true, employeeUserId: true },
        },
      },
    });

    // Filter to those with no linked User by email
    const emails = hired.map((a) => a.email.toLowerCase()).filter(Boolean);
    const existingUsers = emails.length
      ? await db.user.findMany({
          where: { email: { in: emails } },
          select: { id: true, email: true, role: true, createdAt: true },
        })
      : [];
    const byEmail: Record<string, any> = {};
    for (const u of existingUsers) byEmail[u.email.toLowerCase()] = u;

    const rows = hired.map((a) => {
      const existing = byEmail[a.email.toLowerCase()] ?? null;
      const suggestedRole = deriveRoleFromJob({
        title: a.job?.title,
        category: a.job?.category,
        department: a.job?.department,
        jobType: a.job?.jobType,
      });
      return {
        application: {
          id: a.id,
          firstName: a.firstName,
          lastName: a.lastName,
          email: a.email,
          phone: a.phone,
          primaryTrade: a.primaryTrade,
          yearsExperience: a.yearsExperience,
          city: a.city,
          province: a.province,
          resumeUrl: a.resumeUrl,
          portfolioUrls: a.portfolioUrls,
          qualifications: a.qualifications,
          hiredAt: a.hiredAt,
          overallScore: a.overallScore,
          redFlagScore: a.redFlagScore,
          workSampleScore: a.workSampleScore,
        },
        job: a.job,
        attachments: a.attachments,
        offer: a.offers[0] ?? null,
        interviewBookings: a.interviewBookings,
        maintenanceArtisanLink: a.maintenanceArtisanLink,
        existingUser: existing,
        suggestedRole,
        status: existing
          ? "USER_CREATED"
          : a.maintenanceArtisanLink?.status === "PENDING"
          ? "AWAITING_APP_APPROVAL"
          : "PENDING",
      };
    });

    const summary = {
      pending: rows.filter((r) => r.status === "PENDING").length,
      awaitingAppApproval: rows.filter((r) => r.status === "AWAITING_APP_APPROVAL").length,
      onboarded: rows.filter((r) => r.status === "USER_CREATED").length,
      total: rows.length,
    };
    return { rows, summary };
  });

// ═════════════════════════════════════════════════════════════════════════════
// onboardHiredCandidate — create the User row, send welcome email
// ═════════════════════════════════════════════════════════════════════════════
export const onboardHiredCandidate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      applicationId: z.number(),
      role: z.string(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      monthlySalary: z.number().optional(),
      customPassword: z.string().optional(), // if omitted a random one is generated
      sendWelcomeEmail: z.boolean().default(true),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertHR(user);

    const app = await db.application.findUnique({
      where: { id: input.applicationId },
      include: { job: { select: { title: true, jobType: true } } },
    });
    if (!app) throw new TRPCError({ code: "NOT_FOUND", message: "Application not found" });
    if (app.stageBucket !== "HIRED")
      throw new TRPCError({ code: "BAD_REQUEST", message: "Only HIRED applications can be onboarded" });

    const existing = await db.user.findUnique({ where: { email: app.email } });
    if (existing) {
      return { ok: true, userId: existing.id, already: true };
    }

    const password = input.customPassword || crypto.randomBytes(10).toString("hex");
    const hashed = await bcryptjs.hash(password, 10);

    const newUser = await db.user.create({
      data: {
        firstName: app.firstName ?? "Employee",
        lastName: app.lastName ?? "",
        email: app.email,
        phone: app.phone ?? null,
        password: hashed,
        role: input.role,
        hourlyRate: input.hourlyRate ?? null,
        dailyRate: input.dailyRate ?? null,
        monthlySalary: input.monthlySalary ?? null,
      },
    });

    // Link maintenance-artisan side if applicable
    if (app.job?.jobType === "MAINTENANCE_APP") {
      await db.maintenanceArtisanLink
        .updateMany({
          where: { applicationId: app.id },
          data: { employeeUserId: newUser.id },
        })
        .catch(() => {});
    }

    if (input.sendWelcomeEmail) {
      const origin = (process.env.APP_URL || "https://square15management.co.za").replace(/\/+$/, "");
      const html = `<!doctype html>
<html><body style="font-family:Arial,Helvetica,sans-serif;max-width:600px;margin:0 auto;padding:24px;color:#111;">
  <div style="background:#2D5016;color:#F4C430;padding:16px 20px;border-radius:8px 8px 0 0;">
    <div style="font-size:12px;letter-spacing:2px;">SQUARE 15 FACILITY SOLUTIONS</div>
    <div style="font-size:20px;font-weight:700;color:#fff;">Welcome to the team, ${app.firstName}!</div>
  </div>
  <div style="border:1px solid #eee;border-top:none;padding:20px 24px;border-radius:0 0 8px 8px;">
    <p>Your account has been created on the Square 15 Management System. You have been onboarded as <b>${input.role.replace(/_/g, " ")}</b> for the role of <b>${app.job?.title ?? "the position you applied for"}</b>.</p>
    <p><b>Login</b><br/>URL: <a href="${origin}/login">${origin}/login</a><br/>Email: ${app.email}<br/>Temporary password: <code>${password}</code></p>
    <p>Please log in and change your password immediately. Complete your profile (address, banking details, ID) so we can process any payments due to you.</p>
    <p style="margin-top:24px;font-size:12px;color:#666;">If you did not expect this email, contact HR at info@square15.co.za</p>
  </div>
</body></html>`;
      await sendCandidateEmail({
        applicationId: app.id,
        to: app.email,
        subject: `Welcome to Square 15 — your login is ready`,
        templateKey: "HR_ONBOARDING_WELCOME",
        sentById: user.id,
        html,
      }).catch((e) => console.warn("[onboardHiredCandidate] welcome email failed:", e));
    }

    return { ok: true, userId: newUser.id, temporaryPassword: input.customPassword ? null : password };
  });
