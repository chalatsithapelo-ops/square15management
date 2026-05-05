/**
 * Stitch.money provider implementation.
 *
 * Docs (verify when integrating): https://stitch.money/docs
 *
 * Notes
 * -----
 * Stitch's exact GraphQL field names and webhook signature format MUST be
 * confirmed against their current docs at integration time — this module
 * follows the publicly-documented shape but keeps a single
 * mutation/query/parse boundary so corrections are localised.
 *
 * Auth flow
 *   1. getAuthorizeUrl(state, redirectUri) → https://secure.stitch.money/connect/authorize?...
 *   2. user logs into Nedbank inside Stitch, approves consent
 *   3. Stitch redirects to redirectUri?code=...&state=...
 *   4. exchangeCode(code) → access + refresh tokens + accountId
 *
 * Pagination
 *   Stitch returns a cursor inside `pageInfo`. We translate to our
 *   ProviderTransactionsPage.nextCursor.
 */

import { createHmac, timingSafeEqual } from "crypto";
import type {
  BankFeedProvider,
  NormalisedTransaction,
  ProviderLinkResult,
  ProviderTokens,
  ProviderTransactionsPage,
} from "./providerInterface";

const DEFAULT_API_BASE = "https://api.stitch.money/graphql";
const DEFAULT_AUTH_BASE = "https://secure.stitch.money/connect";

function apiBase() {
  return process.env.STITCH_API_BASE || DEFAULT_API_BASE;
}
function authBase() {
  return process.env.STITCH_AUTH_BASE || DEFAULT_AUTH_BASE;
}

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[Stitch] Missing required env var: ${name}`);
  return v;
}

// ── Auth helpers ────────────────────────────────────────────────────────────

async function postForm(url: string, body: Record<string, string>): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`[Stitch] HTTP ${resp.status} ${resp.statusText}: ${text.slice(0, 500)}`);
  }
  return resp.json();
}

async function gql<T = any>(accessToken: string, query: string, variables?: any): Promise<T> {
  const resp = await fetch(apiBase(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`[Stitch] GraphQL HTTP ${resp.status}: ${text.slice(0, 500)}`);
  }
  const json = (await resp.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors?.length) {
    throw new Error(`[Stitch] GraphQL errors: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  return json.data as T;
}

// ── Normalisation ───────────────────────────────────────────────────────────

interface StitchTxNode {
  id: string;
  date: string; // ISO
  amount: { quantity: string; currency: string };
  description?: string;
  reference?: string;
  type?: string; // "debit" | "credit"
  runningBalance?: { quantity: string };
}

function normaliseTx(node: StitchTxNode): NormalisedTransaction {
  const amountNum = Math.abs(parseFloat(node.amount.quantity));
  // Stitch convention: negative = debit; some endpoints use `type` instead
  const isCredit =
    (node.type ? node.type.toLowerCase() === "credit" : false) ||
    parseFloat(node.amount.quantity) > 0;
  return {
    externalId: node.id,
    date: new Date(node.date),
    amount: amountNum,
    transactionType: isCredit ? "CREDIT" : "DEBIT",
    description: (node.description || "").trim() || "(no description)",
    reference: node.reference,
    balance: node.runningBalance ? parseFloat(node.runningBalance.quantity) : undefined,
    rawDescription: node.description,
  };
}

// ── Provider ────────────────────────────────────────────────────────────────

class StitchProvider implements BankFeedProvider {
  readonly id = "STITCH" as const;

  getAuthorizeUrl(opts: { state: string; redirectUri: string; scopes?: string[] }): string {
    const clientId = requireEnv("STITCH_CLIENT_ID");
    const scope = (opts.scopes && opts.scopes.length
      ? opts.scopes
      : ["accountholders", "transactions", "accounts", "balances", "openid"]
    ).join(" ");
    const params = new URLSearchParams({
      client_id: clientId,
      response_type: "code",
      redirect_uri: opts.redirectUri,
      scope,
      state: opts.state,
    });
    return `${authBase()}/authorize?${params.toString()}`;
  }

  async exchangeCode(opts: { code: string; redirectUri: string }): Promise<ProviderLinkResult> {
    const tokenUrl = `${authBase()}/token`;
    const tokenResp = await postForm(tokenUrl, {
      grant_type: "authorization_code",
      code: opts.code,
      redirect_uri: opts.redirectUri,
      client_id: requireEnv("STITCH_CLIENT_ID"),
      client_secret: requireEnv("STITCH_CLIENT_SECRET"),
    });

    const tokens: ProviderTokens = {
      accessToken: tokenResp.access_token,
      refreshToken: tokenResp.refresh_token,
      accessTokenExpiry: new Date(Date.now() + (tokenResp.expires_in || 3600) * 1000),
      consentExpiry: tokenResp.consent_expires_in
        ? new Date(Date.now() + tokenResp.consent_expires_in * 1000)
        : undefined,
    };

    // Discover the linked account
    const data = await gql<{ user: { bankAccounts: { node: any }[] } }>(
      tokens.accessToken,
      `query { user { bankAccounts { node { id name accountNumber bankId } } } }`
    );
    const first = data?.user?.bankAccounts?.[0]?.node;
    if (!first?.id) {
      throw new Error("[Stitch] No bank account returned after consent");
    }

    return {
      externalAccountId: first.id,
      externalLinkageId: tokenResp.linkage_id || first.id,
      tokens,
      bankName: first.bankId,
      accountMask:
        typeof first.accountNumber === "string" ? first.accountNumber.slice(-4) : undefined,
    };
  }

  async refreshAccessToken(refreshToken: string): Promise<ProviderTokens> {
    const resp = await postForm(`${authBase()}/token`, {
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: requireEnv("STITCH_CLIENT_ID"),
      client_secret: requireEnv("STITCH_CLIENT_SECRET"),
    });
    return {
      accessToken: resp.access_token,
      refreshToken: resp.refresh_token || refreshToken,
      accessTokenExpiry: new Date(Date.now() + (resp.expires_in || 3600) * 1000),
    };
  }

  async fetchTransactions(opts: {
    accessToken: string;
    externalAccountId: string;
    cursor?: string | null;
    sinceDate?: Date;
  }): Promise<ProviderTransactionsPage> {
    const data = await gql<{
      node: {
        transactions: {
          pageInfo: { hasNextPage: boolean; endCursor: string | null };
          edges: { node: StitchTxNode }[];
        };
      };
    }>(
      opts.accessToken,
      `query Tx($id: ID!, $after: String, $since: Date) {
        node(id: $id) {
          ... on BankAccount {
            transactions(first: 100, after: $after, dateGte: $since) {
              pageInfo { hasNextPage endCursor }
              edges { node { id date amount { quantity currency } description reference type runningBalance { quantity } } }
            }
          }
        }
      }`,
      {
        id: opts.externalAccountId,
        after: opts.cursor || null,
        since: opts.sinceDate ? opts.sinceDate.toISOString().slice(0, 10) : null,
      }
    );

    const edges = data?.node?.transactions?.edges || [];
    return {
      transactions: edges.map((e) => normaliseTx(e.node)),
      nextCursor: data?.node?.transactions?.pageInfo?.hasNextPage
        ? data.node.transactions.pageInfo.endCursor
        : null,
    };
  }

  verifyWebhookSignature(opts: { rawBody: string; signatureHeader: string | null }): boolean {
    const secret = process.env.STITCH_WEBHOOK_SECRET;
    if (!secret || !opts.signatureHeader) return false;
    // Stitch sends "sha256=<hex>" — strip prefix if present
    const sig = opts.signatureHeader.replace(/^sha256=/i, "").trim();
    const expected = createHmac("sha256", secret).update(opts.rawBody).digest("hex");
    if (sig.length !== expected.length) return false;
    try {
      return timingSafeEqual(Buffer.from(sig, "hex"), Buffer.from(expected, "hex"));
    } catch {
      return false;
    }
  }

  parseWebhookEvent(rawBody: string): {
    eventType: string;
    externalAccountId: string | null;
    transactions: NormalisedTransaction[];
  } {
    const payload = JSON.parse(rawBody) as {
      type?: string;
      data?: {
        accountId?: string;
        transactions?: StitchTxNode[];
        transaction?: StitchTxNode;
      };
    };
    const txs: StitchTxNode[] = [];
    if (Array.isArray(payload?.data?.transactions)) txs.push(...payload.data!.transactions!);
    if (payload?.data?.transaction) txs.push(payload.data.transaction);
    return {
      eventType: payload.type || "unknown",
      externalAccountId: payload?.data?.accountId || null,
      transactions: txs.map(normaliseTx),
    };
  }

  async revoke(refreshToken: string): Promise<void> {
    try {
      await postForm(`${authBase()}/revoke`, {
        token: refreshToken,
        client_id: requireEnv("STITCH_CLIENT_ID"),
        client_secret: requireEnv("STITCH_CLIENT_SECRET"),
      });
    } catch (err) {
      console.warn("[Stitch] revoke failed (non-fatal):", (err as Error).message);
    }
  }
}

export const stitchProvider: BankFeedProvider = new StitchProvider();
