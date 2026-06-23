/**
 * Mono (mono.co) provider implementation.
 *
 * Docs: https://docs.mono.co/reference (verify field names at integration time)
 *
 * Notes on the flow vs Stitch
 * ---------------------------
 * Mono does NOT use OAuth. Instead:
 *   1. The browser opens the Mono Connect widget with MONO_PUBLIC_KEY.
 *   2. The widget returns a one-time `code` to our callback.
 *   3. We POST that code to /v2/accounts/auth with MONO_SECRET_KEY to get
 *      back a permanent `accountId` (the "auth code" — Mono calls it "id").
 *   4. From then on we authenticate every call with the header
 *        mono-sec-key: <MONO_SECRET_KEY>
 *      and the accountId in the URL — there is no per-account access token,
 *      no refresh token, no token expiry. Consent is revoked by the user
 *      in the Mono dashboard (or by calling DELETE /accounts/{id}/unlink).
 *
 * To fit Mono into the shared BankFeedProvider interface (which assumes
 * OAuth-style access + refresh tokens), we map:
 *   - ProviderTokens.accessToken   = MONO_SECRET_KEY     (the server secret)
 *   - ProviderTokens.refreshToken  = MONO_SECRET_KEY     (no separate refresh)
 *   - ProviderTokens.accessTokenExpiry = +50 years       (effectively never)
 * The encrypted column on BankAccount therefore holds the same secret value;
 * this is fine because the value is the SAME secret already present in
 * process.env on the same host, just encrypted at rest in the DB.
 *
 * Webhook signature:
 *   Mono signs with HMAC-SHA512 using MONO_WEBHOOK_SECRET. Header is
 *   `mono-webhook-secret` containing the raw secret as a sanity check,
 *   plus optional `x-mono-signature` carrying the hex digest. We accept
 *   either: a raw-secret match (constant-time) OR an HMAC match.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type {
  BankFeedProvider,
  NormalisedTransaction,
  ProviderLinkResult,
  ProviderTokens,
  ProviderTransactionsPage,
} from "./providerInterface";

const DEFAULT_API_BASE = "https://api.withmono.com";

function apiBase() {
  return (process.env.MONO_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[Mono] Missing required env var: ${name}`);
  return v;
}

// ── HTTP helper (Mono uses simple REST + `mono-sec-key` header) ────────────

async function monoFetch<T = any>(
  path: string,
  opts: { method?: "GET" | "POST" | "DELETE"; body?: any } = {}
): Promise<T> {
  const url = `${apiBase()}${path}`;
  const resp = await fetch(url, {
    method: opts.method || "GET",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      "mono-sec-key": requireEnv("MONO_SECRET_KEY"),
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }
  if (!resp.ok) {
    const msg =
      (json && (json.message || json.error)) ||
      text.slice(0, 500) ||
      `${resp.status} ${resp.statusText}`;
    throw new Error(`[Mono] HTTP ${resp.status}: ${msg}`);
  }
  return (json ?? {}) as T;
}

// ── Normalisation ──────────────────────────────────────────────────────────

interface MonoTxNode {
  _id?: string;
  id?: string;
  amount: number; // Mono returns amount in KOBO (NGN cents) — for ZAR via Mono SA it's in cents too
  narration?: string;
  type: "debit" | "credit";
  balance?: number;
  date: string; // ISO
  category?: string;
}

/**
 * Mono returns monetary values in MINOR units (cents).
 * Divide by 100 to get rand/major units, matching the rest of our app.
 */
function minorToMajor(n: number | undefined | null): number {
  if (typeof n !== "number" || !isFinite(n)) return 0;
  return Math.round(n) / 100;
}

function normaliseTx(node: MonoTxNode): NormalisedTransaction {
  const externalId = String(node._id || node.id || "");
  const amountMajor = Math.abs(minorToMajor(node.amount));
  const description = (node.narration || "").trim() || "(no description)";
  return {
    externalId,
    date: new Date(node.date),
    amount: amountMajor,
    transactionType: node.type === "credit" ? "CREDIT" : "DEBIT",
    description,
    balance: node.balance !== undefined ? minorToMajor(node.balance) : undefined,
    rawDescription: node.narration,
  };
}

// ── Provider ───────────────────────────────────────────────────────────────

const MONO_VIRTUAL_TOKEN_EXPIRY = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000);

class MonoProvider implements BankFeedProvider {
  readonly id = "MONO" as const;

  /**
   * Mono uses a JS widget rather than an OAuth redirect. The "authorize URL"
   * is therefore a hosted helper page on our own site that loads the widget
   * with the right public key + state and POSTs the resulting `code` back
   * to /api/bank-feed/mono-callback as a JSON body.
   *
   * The hosted page is served by `mono-link-handler.ts` (a simple HTML
   * response) so the existing linkBankAccountStart → window.location flow
   * keeps working unchanged.
   */
  getAuthorizeUrl(opts: { state: string; redirectUri: string; scopes?: string[] }): string {
    // We pass state + redirectUri through to our own hosted widget page.
    // The widget posts the code to redirectUri on success.
    const params = new URLSearchParams({
      state: opts.state,
      redirectUri: opts.redirectUri,
    });
    // Served by Nitro route registered in app.config.ts
    return `/api/bank-feed/mono-link?${params.toString()}`;
  }

  /**
   * Exchange the one-time widget code for a permanent accountId.
   * POST /v2/accounts/auth { code }
   * Response: { id: "<accountId>" }
   *
   * Then fetch account info for bank name + mask.
   */
  async exchangeCode(opts: { code: string; redirectUri: string }): Promise<ProviderLinkResult> {
    const authResp = await monoFetch<{ id?: string; status?: string }>("/v2/accounts/auth", {
      method: "POST",
      body: { code: opts.code },
    });
    const accountId = authResp?.id;
    if (!accountId) {
      throw new Error("[Mono] No accountId returned from /v2/accounts/auth");
    }

    // Best-effort: fetch account details so we can pre-fill bankName/mask
    let bankName: string | undefined;
    let accountMask: string | undefined;
    try {
      const info = await monoFetch<{
        account?: {
          institution?: { name?: string };
          accountNumber?: string;
          name?: string;
        };
      }>(`/v2/accounts/${encodeURIComponent(accountId)}`);
      bankName = info?.account?.institution?.name || undefined;
      accountMask =
        typeof info?.account?.accountNumber === "string"
          ? info.account.accountNumber.slice(-4)
          : undefined;
    } catch (err) {
      console.warn("[Mono] account info fetch failed (non-fatal):", (err as Error).message);
    }

    const secret = requireEnv("MONO_SECRET_KEY");
    const tokens: ProviderTokens = {
      accessToken: secret,
      refreshToken: secret,
      accessTokenExpiry: MONO_VIRTUAL_TOKEN_EXPIRY,
    };

    return {
      externalAccountId: accountId,
      externalLinkageId: accountId,
      tokens,
      bankName,
      accountMask,
    };
  }

  /**
   * Mono has no refresh-token rotation. We just return the same secret
   * with a fresh "expiry" so the polling/refresh path is a no-op.
   */
  async refreshAccessToken(_refreshToken: string): Promise<ProviderTokens> {
    const secret = requireEnv("MONO_SECRET_KEY");
    return {
      accessToken: secret,
      refreshToken: secret,
      accessTokenExpiry: MONO_VIRTUAL_TOKEN_EXPIRY,
    };
  }

  /**
   * GET /v2/accounts/{id}/transactions?page=N&start=YYYY-MM-DD
   * Mono v2 paginates by default — the `paginate` flag from v1 is rejected as
   * "not allowed". Response has meta.{page,pages,total}; we use page numbers
   * as opaque cursors.
   */
  async fetchTransactions(opts: {
    accessToken: string;
    externalAccountId: string;
    cursor?: string | null;
    sinceDate?: Date;
  }): Promise<ProviderTransactionsPage> {
    const params = new URLSearchParams();
    const pageNum = opts.cursor ? parseInt(opts.cursor, 10) : 1;
    if (Number.isFinite(pageNum) && pageNum > 1) params.set("page", String(pageNum));
    if (opts.sinceDate) {
      params.set("start", opts.sinceDate.toISOString().slice(0, 10));
    }
    const qs = params.toString();
    const path = `/v2/accounts/${encodeURIComponent(opts.externalAccountId)}/transactions${qs ? `?${qs}` : ""}`;
    const resp = await monoFetch<{
      data?: MonoTxNode[];
      meta?: { page?: number; pages?: number; total?: number };
    }>(path);

    const nodes = resp?.data || [];
    const meta = resp?.meta || {};
    const currentPage = typeof meta.page === "number" ? meta.page : pageNum;
    const totalPages = typeof meta.pages === "number" ? meta.pages : currentPage;
    const nextCursor = currentPage < totalPages ? String(currentPage + 1) : null;

    return {
      transactions: nodes.map(normaliseTx),
      nextCursor,
    };
  }

  /**
   * Mono webhook signature.
   * Their docs describe TWO mechanisms historically:
   *   (a) A header `mono-webhook-secret` carrying the secret verbatim
   *       (set per webhook in the Mono dashboard). Cheap to verify.
   *   (b) HMAC-SHA512 of the raw body using the same secret, sent as a hex
   *       digest in `x-mono-signature` (newer convention).
   * We accept either, both constant-time.
   */
  verifyWebhookSignature(opts: { rawBody: string; signatureHeader: string | null }): boolean {
    const secret = process.env.MONO_WEBHOOK_SECRET;
    if (!secret) return false;
    if (!opts.signatureHeader) return false;
    const presented = opts.signatureHeader.trim();

    // (a) Verbatim secret check
    if (presented.length === secret.length) {
      try {
        const a = Buffer.from(presented);
        const b = Buffer.from(secret);
        if (a.length === b.length && timingSafeEqual(a, b)) return true;
      } catch {
        /* fall through to HMAC check */
      }
    }

    // (b) HMAC-SHA512 hex digest of raw body
    const expected = createHmac("sha512", secret).update(opts.rawBody).digest("hex");
    const sig = presented.replace(/^sha512=/i, "");
    if (sig.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  }

  /**
   * Mono webhook payload shape:
   *   { event: "mono.events.account_updated" | "mono.events.account.linked" | ...,
   *     data: { account: { _id: "...", ... }, updates?: { transactions?: [...] } } }
   *
   * For brand-new accounts the webhook gives us the accountId only; we then
   * fetch transactions via fetchTransactions(). For "account_updated" Mono
   * sometimes includes the new transactions inline under data.updates.
   */
  parseWebhookEvent(rawBody: string): {
    eventType: string;
    externalAccountId: string | null;
    transactions: NormalisedTransaction[];
  } {
    const payload = JSON.parse(rawBody) as {
      event?: string;
      data?: {
        account?: { _id?: string; id?: string };
        updates?: { transactions?: MonoTxNode[] } | { transaction?: MonoTxNode };
        transactions?: MonoTxNode[];
        transaction?: MonoTxNode;
      };
    };
    const acct = payload?.data?.account;
    const externalAccountId = acct?._id || acct?.id || null;

    const txs: MonoTxNode[] = [];
    const updates: any = payload?.data?.updates;
    if (updates) {
      if (Array.isArray(updates.transactions)) txs.push(...updates.transactions);
      if (updates.transaction) txs.push(updates.transaction);
    }
    if (Array.isArray(payload?.data?.transactions)) txs.push(...payload.data!.transactions!);
    if (payload?.data?.transaction) txs.push(payload.data.transaction);

    return {
      eventType: payload.event || "unknown",
      externalAccountId,
      transactions: txs.map(normaliseTx),
    };
  }

  /**
   * Mono unlink: DELETE /v2/accounts/{id}/unlink
   * The "refresh token" we store IS the accountId-bound secret; for the
   * actual unlink we need the accountId, which the caller has via
   * BankAccount.externalAccountId. To keep the interface stable, we treat
   * `refreshToken` as the accountId when it's not the literal secret.
   *
   * Best-effort, never throws.
   */
  async revoke(refreshTokenOrAccountId: string): Promise<void> {
    const secret = process.env.MONO_SECRET_KEY;
    if (!secret) return;
    // If the caller passed the secret itself we have nothing to do — Mono
    // doesn't expose a "revoke token" endpoint, just per-account unlink,
    // which is done by providerConnector.unlinkBankAccount() when it has
    // the externalAccountId. Calls here are best-effort no-ops in that case.
    if (refreshTokenOrAccountId === secret) return;
    try {
      await monoFetch(`/v2/accounts/${encodeURIComponent(refreshTokenOrAccountId)}/unlink`, {
        method: "POST",
      });
    } catch (err) {
      console.warn("[Mono] revoke/unlink failed (non-fatal):", (err as Error).message);
    }
  }
}

export const monoProvider: BankFeedProvider = new MonoProvider();
