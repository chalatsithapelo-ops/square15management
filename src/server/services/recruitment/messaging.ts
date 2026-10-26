/**
 * Recruitment messaging helpers.
 *
 * Every outbound candidate email in the recruitment flow (application
 * confirmation, assessment invite, rejection, interview scheduled, offer
 * sent, auto-reject, etc.) MUST go through `sendCandidateEmail` so that
 * an `ApplicationMessage` row is written to the audit log. Otherwise
 * recruiters cannot answer "did we ever email this candidate?" without
 * grepping SMTP logs.
 *
 * The helper is defensive:
 *   - If sendEmail throws, the failure is recorded on the ApplicationMessage
 *     row (with a `[Delivery failed: ...]` prefix on the body and a null
 *     `deliveredAt`), and the caller receives `{ ok: false, error }`
 *     without a thrown exception. Every existing caller already treats
 *     candidate emails as non-fatal, so surfacing the error via return
 *     value keeps the pipeline moving.
 *   - If the DB insert of ApplicationMessage itself fails, we log to
 *     console and swallow — the email may already have gone out and we
 *     don't want to poison the transaction.
 *
 * `logSystemMessage` writes an OUTBOUND row without touching SMTP — used
 * for recording internal events (e.g. "AI processing failed") in the
 * same messages timeline recruiters look at.
 */

import { db } from "~/server/db";
import { sendEmail } from "~/server/utils/email";

export interface CandidateEmailPayload {
  applicationId: number;
  to: string;
  subject: string;
  html: string;
  /** Human-readable template identifier, e.g. `APPLICATION_CONFIRMATION`. */
  templateKey?: string;
  /** ID of the User who triggered the email (null for automated jobs). */
  sentById?: number | null;
  attachments?: {
    filename: string;
    content: Buffer;
    contentType?: string;
  }[];
  /**
   * Short single-sentence message to fire in parallel via WhatsApp / SMS.
   * When set (and the candidate has a phone number), the same lifecycle
   * event is broadcast on WhatsApp — using an approved template for cold
   * recipients, falling back to freeform inside the 24-hour service window.
   * Keep under ~150 chars for readability on mobile.
   */
  companionMessage?: string;
}

export interface CandidateEmailResult {
  ok: boolean;
  error?: string;
}

/**
 * Send an email to a candidate AND log it to `ApplicationMessage`.
 * Never throws — returns `{ ok, error }` so callers stay simple.
 */
export async function sendCandidateEmail(
  payload: CandidateEmailPayload,
): Promise<CandidateEmailResult> {
  let ok = true;
  let errorMsg: string | undefined;

  try {
    await sendEmail({
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments,
    });
  } catch (err) {
    ok = false;
    errorMsg = err instanceof Error ? err.message : String(err);
    console.error(
      `[recruitment.messaging] sendEmail failed for app ${payload.applicationId} (${payload.to}):`,
      err,
    );
  }

  try {
    await db.applicationMessage.create({
      data: {
        applicationId: payload.applicationId,
        channel: "EMAIL",
        direction: "OUTBOUND",
        subject: payload.subject,
        body: ok
          ? payload.html
          : `[Delivery failed: ${errorMsg ?? "unknown error"}]\n\n${payload.html}`,
        sentById: payload.sentById ?? null,
        templateKey: payload.templateKey ?? null,
        deliveredAt: ok ? new Date() : null,
      },
    });
  } catch (dbErr) {
    console.error(
      `[recruitment.messaging] Failed to persist ApplicationMessage for app ${payload.applicationId}:`,
      dbErr,
    );
  }

  // Fire the parallel WhatsApp / SMS companion. Never blocks the email
  // return — best-effort, audit-only. We import lazily to avoid the
  // messaging module having a compile-time dependency on Phase-4.
  if (payload.companionMessage) {
    void (async () => {
      try {
        const { sendCandidateStatusCompanion } = await import(
          "~/server/trpc/procedures/recruitmentPhase4"
        );
        await sendCandidateStatusCompanion(
          payload.applicationId,
          payload.companionMessage!,
          payload.templateKey ?? "STATUS_UPDATE",
          payload.sentById ?? null,
        );
      } catch (err) {
        console.warn(
          `[recruitment.messaging] Companion send failed for app ${payload.applicationId}:`,
          err instanceof Error ? err.message : err,
        );
      }
    })();
  }

  return { ok, error: errorMsg };
}

/**
 * Record an internal system event on an application's message timeline
 * without sending an email. Used for AI-failure notices, auto-transitions,
 * or any other note the recruiter should be able to see in the messages tab.
 */
export async function logSystemMessage(params: {
  applicationId: number;
  subject: string;
  body: string;
  templateKey?: string;
}): Promise<void> {
  try {
    await db.applicationMessage.create({
      data: {
        applicationId: params.applicationId,
        channel: "PORTAL",
        direction: "OUTBOUND",
        subject: params.subject,
        body: params.body,
        templateKey: params.templateKey ?? "SYSTEM",
        deliveredAt: new Date(),
      },
    });
  } catch (err) {
    console.error(
      `[recruitment.messaging] Failed to log system message for app ${params.applicationId}:`,
      err,
    );
  }
}
