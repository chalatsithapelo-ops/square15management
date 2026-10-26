/**
 * Maintenance App bridge.
 *
 * On the Square 15 side we write "pending artisan" records into a Firestore
 * collection `pendingArtisans/{applicationId}` inside project promaintapp-b618a.
 * The Flutter admin app renders these on a new "Awaiting artisan approval"
 * screen. When an admin approves or rejects, the Flutter app POSTs back to
 * /api/maintenance-app/artisan-outcome with an HMAC-signed body.
 */

import { readFileSync } from "fs";
import crypto from "crypto";
import { getApps, initializeApp, cert, App } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { db } from "~/server/db";

const APP_NAME = "maintenance-app";

let cachedApp: App | null = null;

function isEnabled(): boolean {
  return (
    process.env.MAINTENANCE_APP_ENABLED === "1" ||
    process.env.MAINTENANCE_APP_ENABLED === "true"
  );
}

function getServiceAccount() {
  const path = process.env.FIREBASE_SERVICE_ACCOUNT_PATH;
  if (!path) throw new Error("FIREBASE_SERVICE_ACCOUNT_PATH not set");
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw);
  if (parsed.type !== "service_account") throw new Error("Invalid service account file (missing type)");
  return parsed;
}

function getBridgeApp(): App {
  if (cachedApp) return cachedApp;
  const existing = getApps().find((a) => a.name === APP_NAME);
  if (existing) {
    cachedApp = existing;
    return existing;
  }
  const svc = getServiceAccount();
  cachedApp = initializeApp(
    {
      credential: cert(svc),
      projectId: process.env.FIREBASE_PROJECT_ID || svc.project_id,
    },
    APP_NAME,
  );
  return cachedApp;
}

/** Health check — throws if credentials or project are wrong. */
export async function maintenanceAppHealthCheck() {
  if (!isEnabled()) return { ok: false, reason: "MAINTENANCE_APP_ENABLED != 1" };
  try {
    const app = getBridgeApp();
    const fs = getFirestore(app);
    // Cheapest possible read: fetch a limit-1 query on our own collection.
    await fs.collection("pendingArtisans").limit(1).get();
    return { ok: true, projectId: (app.options as any).projectId };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

export interface PendingArtisanPayload {
  applicationId: number;
  name: string;
  email: string;
  contact?: string | null;
  primaryTrade?: string | null;
  yearsExperience?: number | null;
  city?: string | null;
  province?: string | null;
  resumeUrl?: string | null;
  portfolioUrls?: string[];
  qualificationsText?: string | null;
  qualificationDocuments?: Array<{ label: string; fileName: string; fileUrl: string; fileType?: string }>;
  aiSummary?: string | null;
  scores: {
    overall: number | null;
    workSample: number | null;
    redFlag: number | null;
  };
  approvedByRecruiter?: { id: number; name: string } | null;
}

/**
 * Push a hired maintenance-app candidate to Firestore `pendingArtisans`.
 * Idempotent: uses applicationId as the doc id, so re-pushing overwrites.
 * Also creates / updates a MaintenanceArtisanLink row locally.
 */
export async function pushPendingArtisan(payload: PendingArtisanPayload) {
  if (!isEnabled()) {
    console.log("[MaintenanceAppBridge] disabled — skipping push for application", payload.applicationId);
    return { pushed: false, reason: "disabled" };
  }
  const app = getBridgeApp();
  const fs = getFirestore(app);
  const docId = String(payload.applicationId);

  await fs.collection("pendingArtisans").doc(docId).set(
    {
      sqr15ApplicationId: payload.applicationId,
      name: payload.name,
      email: payload.email,
      contact: payload.contact ?? null,
      primaryTrade: payload.primaryTrade ?? null,
      yearsExperience: payload.yearsExperience ?? null,
      city: payload.city ?? null,
      province: payload.province ?? null,
      resumeUrl: payload.resumeUrl ?? null,
      portfolioUrls: payload.portfolioUrls ?? [],
      qualificationsText: payload.qualificationsText ?? null,
      qualificationDocuments: payload.qualificationDocuments ?? [],
      aiSummary: payload.aiSummary ?? null,
      scores: payload.scores,
      approvedByRecruiter: payload.approvedByRecruiter ?? null,
      status: "PENDING",
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
    { merge: true },
  );

  await db.maintenanceArtisanLink.upsert({
    where: { applicationId: payload.applicationId },
    create: {
      applicationId: payload.applicationId,
      firestoreProjectId: process.env.FIREBASE_PROJECT_ID || "promaintapp-b618a",
      firestorePendingDocId: docId,
      status: "PENDING",
      pushedAt: new Date(),
    },
    update: {
      firestorePendingDocId: docId,
      pushedAt: new Date(),
      status: "PENDING",
    },
  });

  console.log(`[MaintenanceAppBridge] pushed pendingArtisans/${docId} for application ${payload.applicationId}`);
  return { pushed: true, docId };
}

/**
 * HMAC signature helpers for the Flutter → SQR15 callback.
 * Signature = HEX(HMAC-SHA256(secret, timestamp + ":" + body))
 */
export function signBody(rawBody: string, timestamp: string): string {
  const secret = process.env.MAINTENANCE_APP_WEBHOOK_SECRET;
  if (!secret) throw new Error("MAINTENANCE_APP_WEBHOOK_SECRET not set");
  return crypto.createHmac("sha256", secret).update(`${timestamp}:${rawBody}`).digest("hex");
}

export function verifySignature(rawBody: string, timestamp: string, signature: string): boolean {
  try {
    const expected = signBody(rawBody, timestamp);
    // constant-time compare
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(signature, "hex");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** True if the timestamp is fresh (within 5 minutes). Prevents replay. */
export function isTimestampFresh(timestamp: string, windowSec = 300): boolean {
  const ts = parseInt(timestamp, 10);
  if (!Number.isFinite(ts)) return false;
  const nowSec = Math.floor(Date.now() / 1000);
  return Math.abs(nowSec - ts) <= windowSec;
}
