/**
 * Mono Connect callback receiver.
 *
 * POST /api/bank-feed/mono-callback/
 * Body: { code: string, state: string }
 *
 * The Mono Connect widget runs in the browser and, on success, POSTs the
 * exchange code here (as plain JSON — the widget is same-origin with us
 * via the /api/bank-feed/mono-link page).
 *
 * We:
 *   1. Verify the HMAC-signed `state` (proves it was issued by us recently
 *      for this user + bankAccount).
 *   2. Exchange the code for a permanent Mono accountId.
 *   3. Persist the link (Mono "tokens" are really the server secret + accountId,
 *      see monoClient.ts for why).
 *   4. Trigger a 90-day backfill in the background.
 *   5. Return JSON { ok: true, bankAccountId } so the browser page can
 *      redirect to /admin/bank-feed/link?status=linked.
 *
 * On any error returns 4xx/5xx with { ok: false, reason: "..." }.
 */

import { eventHandler, getMethod } from "h3";
import { monoProvider } from "~/server/services/bankFeed/monoClient";
import { persistLink, syncBankAccount } from "~/server/services/bankFeed/providerConnector";
import { verifyState } from "~/server/services/bankFeed/linkState";

async function readJsonBody(req: any): Promise<any> {
  const chunks: Buffer[] = [];
  if (typeof req?.text === "function") {
    const t = await req.text();
    try {
      return JSON.parse(t);
    } catch {
      return null;
    }
  }
  return new Promise((resolve, reject) => {
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      try {
        const t = Buffer.concat(chunks).toString("utf8");
        resolve(t ? JSON.parse(t) : null);
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

function json(status: number, body: any): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}

function resolveBaseUrl(event: any): string {
  const fromEnv = (process.env.BASE_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const req = event?.node?.req;
  const host = req?.headers?.host || "localhost:3500";
  const proto =
    (req?.headers?.["x-forwarded-proto"] as string) ||
    (req?.socket?.encrypted ? "https" : "http");
  return `${proto}://${host}`;
}

const handler = eventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "POST") {
    return json(405, { ok: false, reason: "method_not_allowed" });
  }

  const body = await readJsonBody(event.node?.req).catch(() => null);
  const code = typeof body?.code === "string" ? body.code : "";
  const state = typeof body?.state === "string" ? body.state : "";

  if (!code || !state) {
    return json(400, { ok: false, reason: "missing_code_or_state" });
  }

  let parsedState: { userId: number; bankAccountId: number };
  try {
    parsedState = verifyState(state);
  } catch (err) {
    return json(400, { ok: false, reason: "invalid_state:" + (err as Error).message });
  }

  const baseUrl = resolveBaseUrl(event);
  const redirectUri =
    process.env.MONO_REDIRECT_URI || `${baseUrl}/api/bank-feed/mono-callback`;

  try {
    const link = await monoProvider.exchangeCode({ code, redirectUri });
    await persistLink({
      bankAccountId: parsedState.bankAccountId,
      providerId: "MONO",
      link,
    });
    // Fire-and-forget backfill of last 90 days
    syncBankAccount(parsedState.bankAccountId, { sinceDays: 90 }).catch((err) => {
      console.error("[Mono Callback] initial backfill failed:", err);
    });
    return json(200, { ok: true, bankAccountId: parsedState.bankAccountId });
  } catch (err) {
    console.error("[Mono Callback] exchangeCode failed:", err);
    return json(500, {
      ok: false,
      reason: (err as Error).message.slice(0, 200),
    });
  }
});

export default handler;
