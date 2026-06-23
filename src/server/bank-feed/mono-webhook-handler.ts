/**
 * Mono webhook receiver.
 *
 * POST /api/bank-feed/mono-webhook/
 *
 * Mono posts on relevant account events (e.g. account_updated,
 * data_status_available, account_linked). We:
 *   1. Read raw body (needed for signature verification)
 *   2. Verify the signature using monoProvider.verifyWebhookSignature
 *      (accepts either the verbatim shared secret in `mono-webhook-secret`
 *      OR an HMAC-SHA512 hex digest in `x-mono-signature`)
 *   3. Always log the event to BankFeedWebhookLog
 *   4. If transactions are inline → ingest them
 *      If only an accountId is present → trigger an incremental sync
 *   5. Return 200 after the signature passes so Mono doesn't retry
 */

import { eventHandler, getMethod } from "h3";
import { db } from "~/server/db";
import { monoProvider } from "~/server/services/bankFeed/monoClient";
import {
  ingestProviderTransactions,
  syncBankAccount,
} from "~/server/services/bankFeed/providerConnector";

async function readRawBody(req: any): Promise<string> {
  if (typeof req?.text === "function") {
    return req.text();
  }
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

function json(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

const handler = eventHandler(async (event) => {
  if (getMethod(event) !== "POST") {
    return json(405, { error: "Method not allowed" });
  }

  const req = event.node?.req;
  if (!req) return new Response("server error", { status: 500 });

  const rawBody = await readRawBody(req);
  const signatureHeader =
    (req.headers["mono-webhook-secret"] as string) ||
    (req.headers["x-mono-signature"] as string) ||
    (req.headers["x-signature"] as string) ||
    null;

  const signatureValid = monoProvider.verifyWebhookSignature({
    rawBody,
    signatureHeader,
  });

  // Best-effort: log every webhook attempt
  let logId: number | null = null;
  try {
    let payloadJson: any = null;
    try {
      payloadJson = JSON.parse(rawBody);
    } catch {
      payloadJson = { raw: rawBody.slice(0, 2000) };
    }
    const logged = await db.bankFeedWebhookLog.create({
      data: {
        provider: "MONO",
        eventType: typeof payloadJson?.event === "string" ? payloadJson.event : "unknown",
        signatureValid,
        rawPayload: payloadJson,
      },
    });
    logId = logged.id;
  } catch (err) {
    console.error("[Mono Webhook] failed to log:", (err as Error).message);
  }

  if (!signatureValid) {
    return json(401, { error: "Invalid signature" });
  }

  try {
    const parsed = monoProvider.parseWebhookEvent(rawBody);

    if (!parsed.externalAccountId) {
      if (logId) {
        await db.bankFeedWebhookLog
          .update({
            where: { id: logId },
            data: { processedAt: new Date(), error: "no accountId" },
          })
          .catch(() => {});
      }
      return json(200, { ok: true, ignored: "no accountId" });
    }

    const acct = await db.bankAccount.findFirst({
      where: {
        externalProvider: "MONO",
        externalAccountId: parsed.externalAccountId,
      },
      select: { id: true },
    });

    if (!acct) {
      if (logId) {
        await db.bankFeedWebhookLog
          .update({
            where: { id: logId },
            data: { processedAt: new Date(), error: "BankAccount not found" },
          })
          .catch(() => {});
      }
      return json(200, { ok: true, ignored: "unknown account" });
    }

    let newCount = 0;
    let duplicateCount = 0;
    let errors: string[] = [];

    if (parsed.transactions.length > 0) {
      // Inline transactions present in payload — ingest directly
      const result = await ingestProviderTransactions({
        bankAccountId: acct.id,
        providerId: "MONO",
        source: "MONO_WEBHOOK",
        transactions: parsed.transactions,
      });
      newCount = result.newCount;
      duplicateCount = result.duplicateCount;
      errors = result.errors;
    } else {
      // Mono pinged us about an account update but didn't include the txs.
      // Pull an incremental sync (last 7 days is plenty for a notification).
      const result = await syncBankAccount(acct.id, { sinceDays: 7 });
      newCount = result.newCount;
      duplicateCount = result.duplicateCount;
      errors = result.errors || [];
    }

    if (logId) {
      await db.bankFeedWebhookLog
        .update({
          where: { id: logId },
          data: {
            bankAccountId: acct.id,
            processedAt: new Date(),
            error: errors.length ? errors.slice(0, 3).join(" | ") : null,
          },
        })
        .catch(() => {});
    }

    return json(200, { ok: true, newCount, duplicateCount });
  } catch (err) {
    console.error("[Mono Webhook] processing error:", err);
    if (logId) {
      await db.bankFeedWebhookLog
        .update({
          where: { id: logId },
          data: {
            processedAt: new Date(),
            error: (err as Error).message.slice(0, 500),
          },
        })
        .catch(() => {});
    }
    // Return 200 so Mono doesn't retry — error is logged for ops
    return json(200, { ok: false, error: "processing error (logged)" });
  }
});

export default handler;
