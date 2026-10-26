/**
 * Maintenance App admin → SQR15 callback.
 *
 * POST /api/maintenance-app/artisan-outcome/
 * Headers:
 *   x-mba-timestamp: <unix seconds>
 *   x-mba-signature: <hex hmac-sha256 of "timestamp:body">
 * Body (JSON):
 *   { applicationId: number, outcome: "APPROVED" | "REJECTED",
 *     firestoreServiceProviderId?: string,   // set on approve
 *     rejectionReason?: string }
 *
 * Effect on APPROVED: mark MaintenanceArtisanLink APPROVED, link to
 * serviceProvider doc id, transition Application → HIRED, log an
 * ai_decision.
 * Effect on REJECTED: mark link REJECTED with reason, transition
 * Application → REJECTED, send rejection email.
 */

import { eventHandler, getMethod } from "h3";
import type { IncomingMessage } from "http";

async function readNodeBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
import { randomBytes } from "crypto";
import { db } from "~/server/db";
import { transitionApplication } from "~/server/services/recruitment/atsHelpers";
import { verifySignature, isTimestampFresh } from "~/server/services/maintenanceAppBridge";
import { sendCandidateEmail } from "~/server/services/recruitment/messaging";

function json(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
  });
}

const handler = eventHandler(async (event) => {
  const method = getMethod(event);
  if (method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: {
        "access-control-allow-origin": "*",
        "access-control-allow-methods": "POST, OPTIONS",
        "access-control-allow-headers": "content-type, x-mba-timestamp, x-mba-signature",
      },
    });
  }
  if (method !== "POST") return json(405, { ok: false, error: "method not allowed" });

  const rawHeaders = (event as any)?.node?.req?.headers ?? {};
  const _get = (name: string): string | undefined => {
    const raw = rawHeaders[name.toLowerCase()];
    if (Array.isArray(raw)) return raw[0];
    return raw;
  };
  const timestamp = _get("x-mba-timestamp");
  const signature = _get("x-mba-signature");
  if (!timestamp || !signature) return json(400, { ok: false, error: "missing signature headers" });
  if (!isTimestampFresh(timestamp)) return json(401, { ok: false, error: "stale timestamp" });

  const nodeReq = (event as any)?.node?.req as IncomingMessage | undefined;
  if (!nodeReq) return json(500, { ok: false, error: "no node req" });
  const raw = await readNodeBody(nodeReq);
  if (!raw) return json(400, { ok: false, error: "empty body" });
  if (!verifySignature(raw, timestamp, signature)) return json(401, { ok: false, error: "bad signature" });

  let body: any;
  try { body = JSON.parse(raw); } catch { return json(400, { ok: false, error: "invalid json" }); }

  const applicationId = Number(body.applicationId);
  const outcome = String(body.outcome || "").toUpperCase();
  if (!applicationId || !["APPROVED", "REJECTED"].includes(outcome))
    return json(400, { ok: false, error: "invalid applicationId or outcome" });

  const link = await db.maintenanceArtisanLink.findUnique({
    where: { applicationId },
    include: { application: { select: { id: true, email: true, firstName: true } } },
  });
  if (!link) return json(404, { ok: false, error: "MaintenanceArtisanLink not found" });

  // Idempotency: if this link is already resolved, either accept as duplicate
  // (same outcome) or reject as conflict (different outcome).
  if (link.status !== "PENDING") {
    if (link.status === outcome) {
      return json(200, { ok: true, applicationId, outcome, duplicate: true });
    }
    return json(409, { ok: false, error: `link already ${link.status}, cannot mark ${outcome}` });
  }

  if (outcome === "APPROVED") {
    const spId = String(body.firestoreServiceProviderId || "");

    // 1) Auto-onboard: create a User row if none exists on this email.
    //    Random password — artisans authenticate via Firebase on the maintenance
    //    app; the User row is only for HR tracking + audit inside SQR15.
    const app = link.application;
    let userIdForLink: number | null = null;
    try {
      const existing = await db.user.findUnique({ where: { email: app.email } });
      if (existing) {
        userIdForLink = existing.id;
      } else {
        const bcrypt = await import("bcryptjs");
        const rndPw = randomBytes(24).toString("hex");
        const hashed = await bcrypt.hash(rndPw, 10);
        const full = await db.application.findUnique({
          where: { id: applicationId },
          select: { firstName: true, lastName: true, phone: true },
        });
        const newUser = await db.user.create({
          data: {
            firstName: full?.firstName ?? "Artisan",
            lastName: full?.lastName ?? String(applicationId),
            email: app.email,
            password: hashed,
            role: "ARTISAN",
            phone: full?.phone ?? null,
          },
        });
        userIdForLink = newUser.id;
      }
      await db.application.update({
        where: { id: applicationId },
        data: {
          onboardedUserId: userIdForLink,
          hiredAt: new Date(),
        },
      });
    } catch (e) {
      console.warn(`[maintenance-app callback] onboarding failed for app ${applicationId}:`, (e as Error).message);
    }

    // 2) Update the link row.
    await db.maintenanceArtisanLink.update({
      where: { applicationId },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        firestoreServiceProviderId: spId || null,
        employeeUserId: userIdForLink,
      },
    });

    // 3) Transition Application to HIRED bucket.
    await transitionApplication({
      applicationId,
      toBucket: "HIRED",
      reason: "Approved by Maintenance App admin",
    });

    // 4) Welcome email — idempotent via templateKey.
    void (async () => {
      try {
        const already = await db.applicationMessage.count({
          where: { applicationId, templateKey: "MAINTENANCE_ARTISAN_WELCOME" },
        });
        if (already > 0) return;
        const brandAccent = process.env.BRAND_ACCENT_COLOR || "#0d9488";
        const brandName = process.env.BRAND_NAME || "Square 15";
        const appstore = process.env.MAINTENANCE_APP_APPSTORE_URL || "";
        const playstore = process.env.MAINTENANCE_APP_PLAYSTORE_URL || "";
        await sendCandidateEmail({
          applicationId,
          to: app.email,
          subject: `Welcome to ${brandName} — you have been approved!`,
          templateKey: "MAINTENANCE_ARTISAN_WELCOME",
          html: `<!DOCTYPE html>
<html><body style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:#f9fafb;padding:24px;color:#111827;">
  <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:12px;padding:28px;">
    <div style="text-align:center;margin-bottom:16px;">
      <div style="display:inline-block;width:56px;height:56px;border-radius:28px;background:${brandAccent}22;color:${brandAccent};font-size:32px;line-height:56px;">&#127881;</div>
    </div>
    <h1 style="margin:0 0 12px 0;font-size:22px;text-align:center;">Welcome to ${brandName}, ${app.firstName}!</h1>
    <p style="margin:0 0 12px 0;line-height:1.55;">Your application has been approved by our operations team. You are now an <strong>active artisan</strong> on the ${brandName} Maintenance App and eligible to receive jobs immediately.</p>
    <h3 style="margin:20px 0 8px 0;font-size:15px;">What to do next</h3>
    <ol style="margin:0 0 16px 20px;padding:0;line-height:1.6;">
      <li>Download the <strong>${brandName} Maintenance App</strong> from your app store:</li>
    </ol>
    <div style="text-align:center;margin:16px 0;">
      ${playstore ? `<a href="${playstore}" style="display:inline-block;margin:4px 6px;padding:10px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">Google Play</a>` : ""}
      ${appstore ? `<a href="${appstore}" style="display:inline-block;margin:4px 6px;padding:10px 18px;background:#111827;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">App Store</a>` : ""}
    </div>
    <p style="margin:0 0 12px 0;line-height:1.55;">Sign in with the email address on this message: <strong>${app.email}</strong>. If it is your first time, you will be asked to set a password.</p>
    <p style="margin:0 0 12px 0;line-height:1.55;">Once you are online in the app, you will start receiving job requests in your service area. Keep your phone reachable and your location on.</p>
    <p style="margin:16px 0 0 0;line-height:1.55;">Welcome aboard,<br/><strong>The ${brandName} Operations Team</strong></p>
  </div>
</body></html>`,
        });
        console.log(`[maintenance-app callback] welcome email sent for app ${applicationId}`);
      } catch (e) {
        console.warn(`[maintenance-app callback] welcome email failed for app ${applicationId}:`, (e as Error).message);
      }
    })();

    console.log(`[maintenance-app callback] APPROVED application ${applicationId} → serviceProvider/${spId} (userId=${userIdForLink})`);
    return json(200, { ok: true, applicationId, outcome: "APPROVED", userId: userIdForLink });
  }

  const reason = String(body.rejectionReason || "").slice(0, 500);
  await db.maintenanceArtisanLink.update({
    where: { applicationId },
    data: {
      status: "REJECTED",
      rejectedAt: new Date(),
      rejectionReason: reason || null,
    },
  });
  await transitionApplication({
    applicationId,
    toBucket: "REJECTED",
    reason: `Rejected by Maintenance App admin: ${reason || "no reason given"}`,
  });
  console.log(`[maintenance-app callback] REJECTED application ${applicationId}: ${reason}`);
  return json(200, { ok: true, applicationId, outcome: "REJECTED" });
});

export default handler;
