/**
 * Small WhatsApp sender used by the inbound bot. Sends freeform text
 * (allowed because the recipient just messaged us — 24-hour session open).
 */
import { db } from "~/server/db";

async function getSetting(key: string): Promise<string | null> {
  const row = await db.systemSettings.findUnique({ where: { key } });
  return row?.value ?? null;
}

export async function sendWhatsAppFreeform(
  to: string,
  body: string,
): Promise<{ ok: boolean; error?: string; providerMessageId?: string }> {
  const phoneId = process.env.WHATSAPP_PHONE_ID || (await getSetting("whatsapp_phone_id"));
  const accessToken = process.env.WHATSAPP_ACCESS_TOKEN || (await getSetting("whatsapp_access_token"));
  if (!phoneId || !accessToken) return { ok: false, error: "WhatsApp not configured" };
  const cleaned = to.replace(/[^0-9]/g, "").replace(/^0/, "27");
  try {
    const res = await fetch(`https://graph.facebook.com/v20.0/${phoneId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: cleaned,
        type: "text",
        text: { body: body.slice(0, 4000) },
      }),
    });
    const json: any = await res.json().catch(() => ({}));
    if (!res.ok) return { ok: false, error: json?.error?.message ?? `HTTP ${res.status}` };
    return { ok: true, providerMessageId: json?.messages?.[0]?.id };
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
}
