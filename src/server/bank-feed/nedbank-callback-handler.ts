/**
 * Nedbank Accounts API OAuth callback receiver.
 *
 * GET /api/bank-feed/nedbank-callback?code=<CODE>&state=<STATE>
 * (Or ?error=access_denied&error_description=USER_DECLINED etc.)
 *
 * Nedbank's SCA portal redirects the user's browser here after they
 * complete strong customer authentication. We:
 *   1. Verify the HMAC-signed `state` (proves it was issued by us).
 *   2. Exchange the code for a heavy access + refresh token.
 *   3. Persist the tokens + externalAccountId on the BankAccount.
 *      (externalLinkageId — the ConsentId — was already stashed by
 *       linkBankAccountStart.)
 *   4. Kick off a 90-day backfill in the background.
 *   5. Redirect the user back to /admin/bank-feed/link?status=linked
 *      (or ?status=error&reason=... on failure).
 *
 * Unlike the Mono flow (which POSTs JSON from a browser widget), Nedbank
 * gives us a real HTTP GET redirect with query params, so this handler
 * returns a 302 rather than JSON.
 */

import { eventHandler, getMethod, getQuery } from "h3";
import { nedbankProvider } from "~/server/services/bankFeed/nedbankClient";
import { persistLink, syncBankAccount } from "~/server/services/bankFeed/providerConnector";
import { verifyState } from "~/server/services/bankFeed/linkState";
import { db } from "~/server/db";

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

function redirect(baseUrl: string, params: Record<string, string>): Response {
  const url = new URL(`${baseUrl}/admin/bank-feed/link`);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return new Response(null, {
    status: 302,
    headers: { Location: url.toString(), "Cache-Control": "no-store" },
  });
}

const handler = eventHandler(async (event) => {
  const method = getMethod(event);
  if (method !== "GET") {
    return new Response("Method not allowed", { status: 405 });
  }

  const baseUrl = resolveBaseUrl(event);
  const query = getQuery(event);
  const code = typeof query.code === "string" ? query.code : "";
  const state = typeof query.state === "string" ? query.state : "";
  const errParam = typeof query.error === "string" ? query.error : "";
  const errDesc =
    typeof query.error_description === "string" ? query.error_description : "";

  if (errParam) {
    console.warn("[Nedbank Callback] SCA returned error:", errParam, errDesc);
    return redirect(baseUrl, {
      status: "error",
      reason: (errDesc || errParam).slice(0, 200),
    });
  }

  if (!code || !state) {
    return redirect(baseUrl, {
      status: "error",
      reason: "missing_code_or_state",
    });
  }

  let parsedState: { userId: number; bankAccountId: number };
  try {
    parsedState = verifyState(state);
  } catch (err) {
    return redirect(baseUrl, {
      status: "error",
      reason: "invalid_state:" + (err as Error).message.slice(0, 100),
    });
  }

  const redirectUri =
    process.env.NEDBANK_REDIRECT_URI ||
    `${baseUrl}/api/bank-feed/nedbank-callback`;

  try {
    const link = await nedbankProvider.exchangeCode({ code, redirectUri });

    // Preserve the ConsentId (stashed by linkBankAccountStart) as
    // externalLinkageId — persistLink overwrites it with
    // link.externalLinkageId (which nedbankClient sets to AccountId for
    // want of anything better). Re-apply it here.
    const acct = await db.bankAccount.findUnique({
      where: { id: parsedState.bankAccountId },
      select: { externalLinkageId: true, externalConsentExpiry: true },
    });
    const preservedConsentId = acct?.externalLinkageId || null;
    const preservedConsentExpiry = acct?.externalConsentExpiry || null;

    await persistLink({
      bankAccountId: parsedState.bankAccountId,
      providerId: "NEDBANK",
      link: {
        ...link,
        externalLinkageId: preservedConsentId || link.externalLinkageId,
        tokens: {
          ...link.tokens,
          consentExpiry: preservedConsentExpiry ?? undefined,
        },
      },
    });

    // Fire-and-forget backfill of last 90 days
    syncBankAccount(parsedState.bankAccountId, { sinceDays: 90 }).catch((err) => {
      console.error("[Nedbank Callback] initial backfill failed:", err);
    });

    return redirect(baseUrl, { status: "linked" });
  } catch (err) {
    console.error("[Nedbank Callback] exchangeCode failed:", err);
    return redirect(baseUrl, {
      status: "error",
      reason: (err as Error).message.slice(0, 200),
    });
  }
});

export default handler;
