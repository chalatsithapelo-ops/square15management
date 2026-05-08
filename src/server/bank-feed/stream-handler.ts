/**
 * Server-Sent Events endpoint for real-time bank-feed updates.
 *
 * GET /api/bank-feed/stream?token=<auth-token>
 *
 * Streams `transaction` events as they are stored. Used by:
 *   - Cashbook panel on Management Accounts (auto-refresh KPIs)
 *   - Bank Feed admin page (auto-refresh transaction table)
 *
 * Auth: token query param verified via authenticateUser. Returns 401 on
 * invalid/missing token. We use query-string auth (not Authorization header)
 * because the browser EventSource API does not support custom headers.
 *
 * Heartbeat: comment line every 25 seconds to keep proxies/load-balancers
 * from killing the idle connection.
 *
 * Single-process only — see src/server/services/bankFeed/eventBus.ts for
 * scaling notes.
 */

import { eventHandler, getQuery } from "h3";
import { authenticateUser } from "~/server/utils/auth";
import { bankFeedEvents, type BankFeedTransactionEvent } from "~/server/services/bankFeed/eventBus";

const handler = eventHandler(async (event) => {
  const query = getQuery(event);
  const token = typeof query.token === "string" ? query.token : "";

  let user;
  try {
    user = await authenticateUser(token);
  } catch {
    return new Response(
      JSON.stringify({ error: "Unauthorized" }),
      { status: 401, headers: { "Content-Type": "application/json" } }
    );
  }

  // Optional: filter to a single bank account
  const filterBankAccountId =
    typeof query.bankAccountId === "string"
      ? parseInt(query.bankAccountId, 10)
      : null;

  // We must use the underlying Node response to write SSE chunks.
  const res = event.node?.res as any;
  const req = event.node?.req as any;
  if (!res || !req) {
    return new Response(JSON.stringify({ error: "Stream unavailable" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no"); // nginx: disable buffering

  // Initial hello so the client knows the stream is live
  res.write(`event: hello\ndata: ${JSON.stringify({ userId: user.id, ts: Date.now() })}\n\n`);

  const send = (e: BankFeedTransactionEvent) => {
    if (filterBankAccountId !== null && e.bankAccountId !== filterBankAccountId) return;
    try {
      res.write(`event: transaction\ndata: ${JSON.stringify(e)}\n\n`);
    } catch {
      // socket closed mid-write; cleanup happens via 'close'
    }
  };

  const unsubscribe = bankFeedEvents.onTransaction(send);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: keep-alive ${Date.now()}\n\n`);
    } catch {
      // ignore
    }
  }, 25_000);

  const cleanup = () => {
    clearInterval(heartbeat);
    unsubscribe();
    try { res.end(); } catch {}
  };

  req.on("close", cleanup);
  req.on("error", cleanup);

  // Tell h3 we've taken over the response
  // (returning undefined so h3 doesn't try to write anything else)
  return new Promise<void>(() => {
    // Never resolves — connection stays open until client closes.
  });
});

export default handler;
