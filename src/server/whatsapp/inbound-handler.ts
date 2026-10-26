/**
 * WhatsApp Cloud API webhook receiver.
 *
 * Endpoint mounted at /api/whatsapp/ (see app.config.ts).
 *   GET   → Meta verification (returns hub.challenge when hub.verify_token matches).
 *   POST  → Inbound message payloads. We forward each to router.ts.
 *
 * Verify token comes from either:
 *   env WHATSAPP_WEBHOOK_VERIFY_TOKEN
 *   SystemSettings.whatsapp_webhook_verify_token
 *
 * Meta expects a 200 OK within 5 seconds. We reply immediately and
 * process the message asynchronously so long AI calls don't cause retries.
 */
import { eventHandler, getMethod } from "h3";
import { db } from "~/server/db";
import { handleInboundMessage, type InboundMessage } from "~/server/services/whatsapp/router";

function parseQuery(url: string | undefined): URLSearchParams {
  if (!url) return new URLSearchParams();
  const idx = url.indexOf("?");
  return new URLSearchParams(idx >= 0 ? url.slice(idx + 1) : "");
}

async function readJson(req: any): Promise<any> {
  if (typeof req?.json === "function") return req.json().catch(() => ({}));
  return new Promise<any>((resolve) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8"))); }
      catch { resolve({}); }
    });
    req.on("error", () => resolve({}));
  });
}

async function getVerifyToken(): Promise<string | null> {
  if (process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) return process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;
  try {
    const row = await db.systemSettings.findUnique({ where: { key: "whatsapp_webhook_verify_token" } });
    return row?.value ?? null;
  } catch {
    return null;
  }
}

const handler = eventHandler(async (event) => {
  const req = event.node?.req;
  if (!req) return new Response("server error", { status: 500 });
  const method = getMethod(event);

  // ── GET: Meta verification handshake ─────────────────────────────────
  if (method === "GET") {
    const q = parseQuery(req.url);
    const mode = q.get("hub.mode");
    const token = q.get("hub.verify_token");
    const challenge = q.get("hub.challenge") ?? "";
    const expected = await getVerifyToken();
    if (mode === "subscribe" && token && expected && token === expected) {
      return new Response(challenge, { status: 200, headers: { "Content-Type": "text/plain" } });
    }
    return new Response("forbidden", { status: 403 });
  }

  // ── POST: inbound message payload ────────────────────────────────────
  if (method !== "POST") return new Response("method not allowed", { status: 405 });

  const payload = await readJson(req);

  // Forward the raw Meta payload to the legacy Maintenance App bot on
  // Render. Fire-and-forget so a slow / dead Render bot never causes Meta
  // to retry. Configured via env WA_MAINTENANCE_FORWARD_URL or
  // SystemSettings.wa_maintenance_forward_url.
  void (async () => {
    const forwardUrl =
      process.env.WA_MAINTENANCE_FORWARD_URL ||
      (await db.systemSettings.findUnique({ where: { key: "wa_maintenance_forward_url" } }))?.value ||
      "";
    if (!forwardUrl) return;
    try {
      const r = await fetch(forwardUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        console.warn(`[wa-inbound] Forward to maintenance bot HTTP ${r.status}`);
      }
    } catch (err) {
      console.warn(`[wa-inbound] Forward to maintenance bot failed:`, err instanceof Error ? err.message : err);
    }
  })();

  // Meta wraps everything in entry → changes → value.
  // We only care about `messages`. Statuses (sent/delivered/read) are ignored
  // here — those flow through the email/message-status webhook already.
  const inbounds: InboundMessage[] = [];
  for (const entry of payload?.entry ?? []) {
    for (const change of entry.changes ?? []) {
      const value = change.value ?? {};
      for (const m of value.messages ?? []) {
        if (!m?.from) continue;
        const text = m.text?.body ?? m.button?.text ?? m.interactive?.button_reply?.title ?? "";
        inbounds.push({
          from: String(m.from),
          waMessageId: String(m.id ?? ""),
          timestamp: Number(m.timestamp ?? Math.floor(Date.now() / 1000)),
          text: String(text ?? ""),
          type: String(m.type ?? "text"),
        });
      }
    }
  }

  // Process asynchronously so we can 200-OK Meta within their 5-second budget.
  void (async () => {
    for (const m of inbounds) {
      try {
        const r = await handleInboundMessage(m);
        console.log(`[wa-inbound] from=${m.from} domain=${r.domain} replied=${r.replied}${r.error ? " err=" + r.error : ""}`);
      } catch (err) {
        console.error(`[wa-inbound] handler crash from=${m.from}:`, err);
      }
    }
  })();

  return new Response(JSON.stringify({ ok: true, received: inbounds.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export default handler;
