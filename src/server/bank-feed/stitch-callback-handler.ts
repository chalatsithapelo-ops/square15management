/**
 * Stitch OAuth callback receiver.
 *
 * GET /api/bank-feed/stitch-callback/?code=...&state=...
 *
 * Stitch redirects the user here after consent. We:
 *   1. Decode + verify the HMAC-signed `state` (which encodes user id,
 *      target BankAccount id, and an expiry).
 *   2. Exchange the `code` for tokens and account info.
 *   3. Persist the link via persistLink() (encrypts tokens).
 *   4. Trigger an initial backfill (last 90 days).
 *   5. Redirect the browser back to /admin/bank-feed/link?status=linked.
 *
 * On error we redirect with ?status=error&reason=... so the UI can show a toast.
 */

import { eventHandler } from "h3";
import { stitchProvider } from "~/server/services/bankFeed/stitchClient";
import { persistLink, syncBankAccount } from "~/server/services/bankFeed/providerConnector";
import { verifyState } from "~/server/services/bankFeed/linkState";

function redirect(url: string): Response {
  return new Response(null, { status: 302, headers: { Location: url } });
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

/**
 * Parse query string from event.node.req.url manually.
 * h3's `getQuery` does `new URL(req.url)` which throws on relative URLs
 * (the vinxi router strips its base prefix, leaving e.g. `/?code=...`).
 */
function parseQuery(event: any): Record<string, string> {
  const rawUrl: string = event?.node?.req?.url || "";
  const qIdx = rawUrl.indexOf("?");
  if (qIdx < 0) return {};
  const params = new URLSearchParams(rawUrl.slice(qIdx + 1));
  const out: Record<string, string> = {};
  for (const [k, v] of params) out[k] = v;
  return out;
}

const handler = eventHandler(async (event) => {
  const query = parseQuery(event);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";
  const errorParam = typeof query.error === "string" ? query.error : "";

  const baseUrl = resolveBaseUrl(event);
  const uiPath = "/admin/bank-feed/link";

  if (errorParam) {
    return redirect(`${baseUrl}${uiPath}?status=error&reason=${encodeURIComponent(errorParam)}`);
  }
  if (!code || !state) {
    return redirect(`${baseUrl}${uiPath}?status=error&reason=missing_code_or_state`);
  }

  let parsedState: { userId: number; bankAccountId: number };
  try {
    parsedState = verifyState(state);
  } catch (err) {
    return redirect(
      `${baseUrl}${uiPath}?status=error&reason=${encodeURIComponent("invalid_state:" + (err as Error).message)}`
    );
  }

  const redirectUri = process.env.STITCH_REDIRECT_URI || `${baseUrl}/api/bank-feed/stitch-callback`;

  try {
    const link = await stitchProvider.exchangeCode({ code, redirectUri });
    await persistLink({
      bankAccountId: parsedState.bankAccountId,
      providerId: "STITCH",
      link,
    });
    // Fire-and-forget backfill of last 90 days
    syncBankAccount(parsedState.bankAccountId, { sinceDays: 90 }).catch((err) => {
      console.error("[Stitch Callback] initial backfill failed:", err);
    });
    return redirect(`${baseUrl}${uiPath}?status=linked&account=${parsedState.bankAccountId}`);
  } catch (err) {
    console.error("[Stitch Callback] exchangeCode failed:", err);
    return redirect(
      `${baseUrl}${uiPath}?status=error&reason=${encodeURIComponent((err as Error).message.slice(0, 200))}`
    );
  }
});

export default handler;
