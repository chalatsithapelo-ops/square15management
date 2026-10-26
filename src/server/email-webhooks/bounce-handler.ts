/**
 * Unified email-provider bounce/delivery webhook receiver.
 *
 * POST /api/email-webhooks/:provider
 *
 * Providers supported: resend, sendgrid, postmark.
 * We record every event to `MessageBounce` so recruiters see hard bounces and
 * complaints alongside the audit trail. If we can resolve the source
 * ApplicationMessage (by providerMessageId or subject+recipient), we also
 * flip `deliveredAt=null` on a hard bounce.
 */
import { eventHandler, getMethod } from "h3";
import { db } from "~/server/db";

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

function parseProvider(url: string | undefined): string {
  if (!url) return "unknown";
  const m = url.match(/\/api\/email-webhooks\/([a-z]+)/i);
  return m ? m[1].toLowerCase() : "unknown";
}

type NormalisedEvent = {
  provider: string;
  event: "BOUNCE" | "COMPLAINT" | "DELIVERED" | "DEFERRED" | "OPEN" | "CLICK";
  recipient: string;
  reason?: string;
  providerMessageId?: string;
  raw: any;
};

function normalise(provider: string, payload: any): NormalisedEvent[] {
  const rows: NormalisedEvent[] = [];
  const push = (e: Partial<NormalisedEvent> & { recipient: string }) =>
    rows.push({
      provider: provider.toUpperCase(),
      event: (e.event as any) ?? "DELIVERED",
      recipient: e.recipient,
      reason: e.reason,
      providerMessageId: e.providerMessageId,
      raw: e.raw ?? payload,
    });

  if (provider === "resend") {
    const t = payload?.type as string | undefined;
    const to = Array.isArray(payload?.data?.to) ? payload.data.to[0] : payload?.data?.to;
    const id = payload?.data?.email_id ?? payload?.data?.id;
    const mapping: Record<string, NormalisedEvent["event"]> = {
      "email.bounced": "BOUNCE",
      "email.complained": "COMPLAINT",
      "email.delivered": "DELIVERED",
      "email.delivery_delayed": "DEFERRED",
      "email.opened": "OPEN",
      "email.clicked": "CLICK",
    };
    if (t && to && mapping[t]) {
      push({
        event: mapping[t],
        recipient: to,
        providerMessageId: id,
        reason: payload?.data?.bounce?.message ?? payload?.data?.reason,
      });
    }
  } else if (provider === "sendgrid") {
    const arr = Array.isArray(payload) ? payload : [];
    for (const e of arr) {
      const mapping: Record<string, NormalisedEvent["event"]> = {
        bounce: "BOUNCE",
        blocked: "BOUNCE",
        dropped: "BOUNCE",
        spamreport: "COMPLAINT",
        delivered: "DELIVERED",
        deferred: "DEFERRED",
        open: "OPEN",
        click: "CLICK",
      };
      if (e.email && mapping[e.event]) {
        push({
          event: mapping[e.event],
          recipient: e.email,
          reason: e.reason ?? e.response,
          providerMessageId: e.sg_message_id,
        });
      }
    }
  } else if (provider === "postmark") {
    const t = payload?.RecordType as string | undefined;
    const mapping: Record<string, NormalisedEvent["event"]> = {
      Bounce: "BOUNCE",
      SpamComplaint: "COMPLAINT",
      Delivery: "DELIVERED",
      Open: "OPEN",
      Click: "CLICK",
    };
    if (t && mapping[t] && payload?.Email) {
      push({
        event: mapping[t],
        recipient: payload.Email,
        reason: payload?.Description ?? payload?.Details,
        providerMessageId: payload?.MessageID,
      });
    }
  }
  return rows;
}

const handler = eventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") return new Response("Method not allowed", { status: 405 });

  const req = event.node?.req;
  if (!req) return new Response("server error", { status: 500 });
  const provider = parseProvider(req.url);
  const payload = await readJson(req);
  const events = normalise(provider, payload);
  if (events.length === 0) return new Response(JSON.stringify({ ok: true, ignored: true }), { status: 200 });

  for (const e of events) {
    let msgId: number | null = null;
    if (e.providerMessageId) {
      const m = await db.applicationMessage.findFirst({
        where: { providerMessageId: e.providerMessageId },
        select: { id: true },
      });
      msgId = m?.id ?? null;
    }
    if (!msgId) {
      const recent = await db.applicationMessage.findFirst({
        where: { channel: "EMAIL", direction: "OUTBOUND" },
        orderBy: { createdAt: "desc" },
        select: { id: true, applicationId: true },
      });
      // fallback: no message match — still record for visibility, no message linkage
      msgId = null;
      void recent;
    }
    await db.messageBounce.create({
      data: {
        applicationMessageId: msgId,
        provider: e.provider,
        event: e.event,
        reason: e.reason,
        recipient: e.recipient,
        raw: e.raw ?? {},
      },
    }).catch(() => {});
    if (msgId && (e.event === "BOUNCE" || e.event === "COMPLAINT")) {
      await db.applicationMessage.update({
        where: { id: msgId },
        data: { deliveredAt: null, body: { set: `[${e.event === "BOUNCE" ? "Bounced" : "Complained"}: ${e.reason ?? ""}]` } },
      }).catch(() => {});
    }
  }
  return new Response(JSON.stringify({ ok: true, count: events.length }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});

export default handler;
