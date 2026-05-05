/**
 * Stitch webhook receiver.
 *
 * POST /api/bank-feed/stitch-webhook/
 *
 * Stitch posts on every transaction event. We:
 *   1. Read raw body (needed for HMAC verification)
 *   2. Verify HMAC-SHA256 against STITCH_WEBHOOK_SECRET
 *   3. Log the event to BankFeedWebhookLog (always — even on failure)
 *   4. Locate the BankAccount by externalAccountId
 *   5. Ingest transactions through the same pipeline as CSV / poll
 *
 * Returns 200 with no body on success, 401 on bad signature, 4xx on bad payload.
 * We intentionally ALWAYS return 2xx after the signature check passes — Stitch
 * will retry on 5xx and we don't want duplicate webhooks because of a transient
 * downstream error. Errors are logged on the row.
 */

import { eventHandler, getMethod } from "h3";
import { db } from "~/server/db";
import { stitchProvider } from "~/server/services/bankFeed/stitchClient";
import { ingestProviderTransactions } from "~/server/services/bankFeed/providerConnector";

async function readRawBody(req: any): Promise<string> {
  if (typeof req?.text === "function") {
    return req.text();
  }
  // Node IncomingMessage
  return new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

const handler = eventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  }

  const req = event.node?.req;
  if (!req) {
    return new Response("server error", { status: 500 });
  }

  const rawBody = await readRawBody(req);
  const signatureHeader =
    (req.headers["x-stitch-signature"] as string) ||
    (req.headers["x-signature"] as string) ||
    null;

  const signatureValid = stitchProvider.verifyWebhookSignature({
    rawBody,
    signatureHeader,
  });

  // Best-effort log row — never block the response on log failure
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
        provider: "STITCH",
        eventType: typeof payloadJson?.type === "string" ? payloadJson.type : "unknown",
        signatureValid,
        rawPayload: payloadJson,
      },
    });
    logId = logged.id;
  } catch (err) {
    console.error("[Stitch Webhook] failed to log:", (err as Error).message);
  }

  if (!signatureValid) {
    return new Response(JSON.stringify({ error: "Invalid signature" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse + ingest
  try {
    const parsed = stitchProvider.parseWebhookEvent(rawBody);

    if (!parsed.externalAccountId) {
      return new Response(JSON.stringify({ ok: true, ignored: "no accountId" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const acct = await db.bankAccount.findFirst({
      where: {
        externalProvider: "STITCH",
        externalAccountId: parsed.externalAccountId,
      },
      select: { id: true },
    });

    if (!acct) {
      // Webhook for an account we don't manage — ack and ignore
      if (logId) {
        await db.bankFeedWebhookLog
          .update({
            where: { id: logId },
            data: { processedAt: new Date(), error: "BankAccount not found" },
          })
          .catch(() => {});
      }
      return new Response(JSON.stringify({ ok: true, ignored: "unknown account" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (parsed.transactions.length === 0) {
      // event types other than transactions.created — just ack
      if (logId) {
        await db.bankFeedWebhookLog
          .update({ where: { id: logId }, data: { processedAt: new Date() } })
          .catch(() => {});
      }
      return new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    const result = await ingestProviderTransactions({
      bankAccountId: acct.id,
      providerId: "STITCH",
      source: "STITCH_WEBHOOK",
      transactions: parsed.transactions,
    });

    if (logId) {
      await db.bankFeedWebhookLog
        .update({
          where: { id: logId },
          data: {
            bankAccountId: acct.id,
            processedAt: new Date(),
            error: result.errors.length ? result.errors.slice(0, 3).join(" | ") : null,
          },
        })
        .catch(() => {});
    }

    return new Response(
      JSON.stringify({
        ok: true,
        newCount: result.newCount,
        duplicateCount: result.duplicateCount,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[Stitch Webhook] processing error:", err);
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
    // Return 200 so Stitch doesn't retry — error is logged for ops
    return new Response(JSON.stringify({ ok: false, error: "processing error (logged)" }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
});

export default handler;
