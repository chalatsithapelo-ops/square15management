import { eventHandler, readBody, getMethod, getQuery } from "h3";
import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Content-Type": "application/json",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: corsHeaders });
}

/**
 * Public Artisan Application API — No authentication required.
 *
 * POST /api/artisan/apply       — submit application
 * GET  /api/artisan/apply?token= — get application + assessments status
 */
const handler = eventHandler(async (event) => {
  const method = getMethod(event);

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // ── GET: Fetch application by token ──────────────────────────────
  if (method === "GET") {
    const query = getQuery(event);
    const token = query.token as string;
    if (!token) {
      return json({ success: false, error: "Token required" }, 400);
    }

    const application = await db.artisanApplication.findUnique({
      where: { accessToken: token },
      include: {
        assessments: { select: { type: true, completedAt: true, score: true, results: true } },
        interviewResponses: { select: { questionIndex: true, completedAt: true } },
      },
    });

    if (!application) {
      return json({ success: false, error: "Application not found" }, 404);
    }

    return json({
      success: true,
      application: {
        id: application.id,
        firstName: application.firstName,
        lastName: application.lastName,
        status: application.status,
        primaryTrade: application.primaryTrade,
        accessToken: application.accessToken,
        completedAssessments: application.assessments.filter(a => a.completedAt).map(a => a.type),
        pendingAssessments: ["IQ", "EQ", "MBTI", "BIG_FIVE"].filter(
          t => !application.assessments.some(a => a.type === t && a.completedAt)
        ),
        interviewComplete: application.interviewResponses.length >= 5,
      },
    });
  }

  // ── POST: Submit new application ─────────────────────────────────
  if (method !== "POST") {
    return json({ success: false, error: "Method not allowed" }, 405);
  }

  try {
    const body = await readBody(event);

    const errors: string[] = [];
    if (!body?.firstName?.trim()) errors.push("firstName is required");
    if (!body?.lastName?.trim()) errors.push("lastName is required");
    if (!body?.email?.trim() || !body.email.includes("@")) errors.push("Valid email is required");
    if (!body?.phone?.trim() || body.phone.trim().length < 7) errors.push("Phone number is required (min 7 chars)");
    if (!body?.primaryTrade?.trim()) errors.push("primaryTrade is required");
    if (body?.yearsExperience === undefined || body.yearsExperience < 0) errors.push("yearsExperience is required");

    if (errors.length > 0) {
      return json({ success: false, errors }, 400);
    }

    // Rate-limit: check recent duplicate
    const recent = await db.artisanApplication.findFirst({
      where: {
        email: body.email.trim().toLowerCase(),
        createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      },
    });

    if (recent) {
      return json({
        success: true,
        message: "You have already submitted an application. Check your email for the assessment link.",
        accessToken: recent.accessToken,
      });
    }

    const application = await db.artisanApplication.create({
      data: {
        firstName: body.firstName.trim(),
        lastName: body.lastName.trim(),
        email: body.email.trim().toLowerCase(),
        phone: body.phone.trim(),
        idNumber: body.idNumber?.trim() || null,
        dateOfBirth: body.dateOfBirth ? new Date(body.dateOfBirth) : null,
        gender: body.gender?.trim() || null,
        city: body.city?.trim() || null,
        province: body.province?.trim() || null,
        address: body.address?.trim() || null,
        primaryTrade: body.primaryTrade.trim(),
        secondaryTrades: body.secondaryTrades || [],
        yearsExperience: parseInt(body.yearsExperience, 10),
        qualifications: body.qualifications?.trim() || null,
        portfolioUrls: body.portfolioUrls || [],
        currentEmployer: body.currentEmployer?.trim() || null,
        availability: body.availability?.trim() || null,
        expectedSalary: body.expectedSalary?.trim() || null,
        hasOwnTools: body.hasOwnTools === true,
        hasDriversLicense: body.hasDriversLicense === true,
        hasOwnTransport: body.hasOwnTransport === true,
        motivationLetter: body.motivationLetter?.trim() || null,
        status: "ASSESSMENTS_PENDING",
      },
    });

    // Send email with assessment link (fire and forget)
    const assessmentUrl = `https://square15management.co.za/apply/assessments/${application.accessToken}`;
    sendEmail({
      to: application.email,
      subject: "Square15 — Your Application Has Been Received",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2D5016;">Application Received!</h2>
          <p>Hi ${application.firstName},</p>
          <p>Thank you for applying to join Square15 as a <strong>${application.primaryTrade}</strong> specialist.</p>
          <p>To proceed, please complete our assessment process. This includes:</p>
          <ul>
            <li>IQ Assessment (logical reasoning)</li>
            <li>EQ Assessment (emotional intelligence)</li>
            <li>MBTI Personality Type</li>
            <li>Big Five Personality Test (OCEAN)</li>
            <li>AI Interview (5 behavioural questions)</li>
          </ul>
          <p>
            <a href="${assessmentUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2D5016; color: white; text-decoration: none; border-radius: 8px; font-weight: bold;">
              Start Assessments
            </a>
          </p>
          <p style="color: #666; font-size: 13px;">This link is unique to you. You can pause and resume at any time.</p>
        </div>
      `,
    }).catch((err) => console.error("[artisan-apply] Email error:", err));

    return json({
      success: true,
      applicationId: application.id,
      accessToken: application.accessToken,
      message: "Application submitted! Check your email for the assessment link.",
    }, 201);
  } catch (error: any) {
    console.error("[artisan-apply] Error:", error);
    return json({ success: false, error: "An unexpected error occurred" }, 500);
  }
});

export default handler;
