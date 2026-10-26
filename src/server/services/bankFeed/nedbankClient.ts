/**
 * Nedbank Business Transactions API (B2B "Account Enquiries") provider.
 *
 * Docs: https://apim.nedbank.co.za/static/docs/accounts-b2b-balances-list
 *
 * This is NOT the AISP / UK Open Banking product. There is:
 *   • NO OAuth (no token endpoint, no client_credentials, no refresh)
 *   • NO user consent / SCA redirect
 *   • NO callback URL
 *
 * Every call is authenticated by:
 *   1. Static headers on the request:
 *        x-ibm-client-id      = NEDBANK_CLIENT_ID
 *        x-ibm-client-secret  = NEDBANK_CLIENT_SECRET
 *        x-fapi-financial-id  = NEDBANK_FINANCIAL_ID (default "OB/2017/001")
 *   2. Mutual TLS on the socket, using the Nedbank-issued .pfx:
 *        NEDBANK_CERT_PATH        = /root/square15management/certs/nedbank/*.pfx
 *        NEDBANK_CERT_PASSPHRASE  = <supplied by Nedbank support>
 *
 * Because there is no per-user consent flow, "linking" a BankAccount is
 * instant: we just call GET /balances to prove the credentials work, pick
 * the target account (either NEDBANK_PREFERRED_ACCOUNT_ID or the first
 * account returned), synthesise placeholder ProviderTokens (like Mono
 * does), and hand back a ProviderLinkResult. The tRPC layer persists
 * that via persistLink() and skips the SCA redirect entirely.
 *
 * Endpoints (all under NEDBANK_API_BASE, default sandbox):
 *   GET /balances
 *   GET /accounts/{accountId}
 *   GET /accounts/{accountId}/balances
 *   GET /accounts/{accountId}/transactions
 *          ?fromBookingDateTime=<ISO>&toBookingDateTime=<ISO>
 *          &pageSize=<N>&continuationValue=<token>
 *   GET /verify-health
 *
 * Response envelope is { Data, Links, Meta }. Transaction pagination uses
 * an opaque `continuationValue` echoed on the Meta and appended to Links.Next
 * — we use that as our cursor (not page numbers).
 *
 * Amounts:
 *   • Balances endpoint returns Amount.Amount as a JSON number.
 *   • Transactions endpoint returns Amount.Amount as a JSON string.
 *   Both are in major units (ZAR rand, NOT cents). We normalise to number.
 */

import type {
  BankFeedProvider,
  NormalisedTransaction,
  ProviderLinkResult,
  ProviderTokens,
  ProviderTransactionsPage,
} from "./providerInterface";
import { nedbankFetchOpts } from "./nedbankMtls";

const DEFAULT_API_BASE =
  "https://b2b-api.nedbank.co.za/apimarket/b2b-sb/account-enquiries/v1";
const DEFAULT_FINANCIAL_ID = "OB/2017/001";

function apiBase(): string {
  return (process.env.NEDBANK_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
}
function financialId(): string {
  return process.env.NEDBANK_FINANCIAL_ID || DEFAULT_FINANCIAL_ID;
}
function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`[Nedbank] Missing required env var: ${name}`);
  return v;
}

// ── HTTP helper ─────────────────────────────────────────────────────────────

/**
 * GET a Nedbank B2B endpoint. Injects the three required IBM/FAPI headers
 * and the mTLS dispatcher. Non-2xx throws with the server's message.
 */
async function nbGet<T = any>(
  path: string,
  query?: Record<string, string | undefined>
): Promise<T> {
  const qs =
    query &&
    Object.entries(query)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(
        ([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`
      )
      .join("&");
  const url = `${apiBase()}${path}${qs ? `?${qs}` : ""}`;
  const headers = {
    Accept: "application/json",
    "x-fapi-financial-id": financialId(),
    "x-ibm-client-id": requireEnv("NEDBANK_CLIENT_ID"),
    "x-ibm-client-secret": requireEnv("NEDBANK_CLIENT_SECRET"),
  };
  let resp: Response | undefined;
  let lastError: any;
  for (let attempt = 1; attempt <= 3; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 25_000);
    try {
      resp = await fetch(url, {
        method: "GET",
        headers,
        signal: controller.signal,
        // mTLS — see nedbankMtls.ts.
        ...(nedbankFetchOpts() as RequestInit),
      });
      clearTimeout(timer);
      break;
    } catch (err: any) {
      clearTimeout(timer);
      lastError = err;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 750));
      }
    }
  }
  if (!resp) {
    const detail: string[] = [];
    let cause = lastError;
    for (let depth = 0; cause && depth < 4; depth++, cause = cause.cause) {
      if (cause.message && !detail.includes(cause.message)) detail.push(cause.message);
      if (cause.code && !detail.includes(String(cause.code))) detail.push(String(cause.code));
    }
    throw new Error(`[Nedbank] Network request failed after 3 attempts: ${detail.join(" | ") || "unknown transport error"}`);
  }
  const text = await resp.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    /* leave as text */
  }
  if (!resp.ok) {
    const msg =
      (json &&
        (json.Message ||
          json.message ||
          json.error_description ||
          json.error ||
          json.fault?.faultstring)) ||
      text.slice(0, 500) ||
      `${resp.status} ${resp.statusText}`;
    throw new Error(`[Nedbank] HTTP ${resp.status}: ${msg}`);
  }
  return (json ?? {}) as T;
}

// ── Normalisation ──────────────────────────────────────────────────────────

interface NedbankAmount {
  Amount?: number | string;
  Currency?: string;
}

interface NedbankTxNode {
  AccountId?: string;
  TransactionId?: string;
  TransactionReference?: string;
  TransactionInformation?: string;
  Amount?: NedbankAmount;
  CreditDebitIndicator?: "Credit" | "Debit";
  Status?: string;
  BookingDateTime?: string;
  Balance?: {
    Amount?: NedbankAmount;
    CreditDebitIndicator?: "Credit" | "Debit";
    Type?: string;
  };
}

interface NedbankBalanceNode {
  AccountId?: string;
  Amount?: NedbankAmount;
  CreditDebitIndicator?: "Credit" | "Debit";
  Type?: string;
  DateTime?: string;
}

interface NedbankAccountNode {
  AccountId?: string;
  Currency?: string;
  AccountType?: string;
  AccountSubType?: string;
  Nickname?: string;
  Account?: {
    SchemeName?: string;
    Identification?: string;
    Name?: string;
    SecondaryIdentification?: string;
  };
}

/** Coerce Nedbank's mixed number|string Amount to a finite number (0 fallback). */
function amtNum(a: NedbankAmount | undefined): number {
  if (!a) return 0;
  const raw = a.Amount;
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  if (typeof raw === "string") {
    const n = parseFloat(raw);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function normaliseTx(node: NedbankTxNode): NormalisedTransaction {
  const amountAbs = Math.abs(amtNum(node.Amount));
  const description =
    (node.TransactionInformation || node.TransactionReference || "").trim() ||
    "(no description)";
  const balanceRaw = node.Balance?.Amount ? amtNum(node.Balance.Amount) : undefined;
  return {
    externalId: String(node.TransactionId || ""),
    date: node.BookingDateTime ? new Date(node.BookingDateTime) : new Date(),
    amount: amountAbs,
    transactionType: node.CreditDebitIndicator === "Credit" ? "CREDIT" : "DEBIT",
    description,
    balance: balanceRaw,
    reference: node.TransactionReference,
    rawDescription: node.TransactionInformation,
  };
}

// ── Public API ─────────────────────────────────────────────────────────────

/** Health-check the B2B API (useful for boot self-test / status page). */
export async function nedbankHealthCheck(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const resp = await nbGet<any>("/isup");
    return { ok: true, detail: JSON.stringify(resp).slice(0, 200) };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

/**
 * Discover the set of accounts we can see. B2B has no explicit "accounts"
 * list endpoint — GET /balances returns one Balance node per account per
 * balance type, so we distinct-by AccountId.
 */
async function listAccountIds(): Promise<string[]> {
  const resp = await nbGet<{ Data?: { Balance?: NedbankBalanceNode[] } }>(
    "/balances"
  );
  const nodes = resp?.Data?.Balance || [];
  const ids = new Set<string>();
  for (const n of nodes) if (n.AccountId) ids.add(String(n.AccountId));
  return Array.from(ids);
}

/** Fetch full details for a single account. */
async function getAccountDetails(
  accountId: string
): Promise<NedbankAccountNode | null> {
  try {
    const resp = await nbGet<{ Data?: { Account?: NedbankAccountNode } }>(
      `/accounts/${encodeURIComponent(accountId)}`
    );
    return resp?.Data?.Account || null;
  } catch (err) {
    console.warn(
      `[Nedbank] getAccountDetails(${accountId}) failed: ${(err as Error).message}`
    );
    return null;
  }
}

export async function fetchAccountBalance(accountId: string): Promise<{
  currentBalance?: { amount: number; currency: string; indicator: string; dateTime?: string };
  availableBalance?: { amount: number; currency: string; indicator: string; dateTime?: string };
  raw: unknown;
}> {
  const resp = await nbGet<{ Data?: { Balance?: NedbankBalanceNode | NedbankBalanceNode[] } }>(
    `/accounts/${encodeURIComponent(accountId)}/balances`,
  );
  const raw = resp?.Data?.Balance;
  const nodes = Array.isArray(raw) ? raw : raw ? [raw] : [];
  let current: NedbankBalanceNode | undefined;
  let available: NedbankBalanceNode | undefined;
  for (const node of nodes) {
    if (!current && ["CurrentBalance", "ClosingBooked", "ClosingAvailable"].includes(node.Type ?? "")) current = node;
    if (!available && ["InterimAvailable", "OpeningAvailable"].includes(node.Type ?? "")) available = node;
  }
  if (!current && nodes.length) current = nodes[0];
  const shape = (node?: NedbankBalanceNode) => node?.Amount ? {
    amount: amtNum(node.Amount),
    currency: node.Amount.Currency || "ZAR",
    indicator: node.CreditDebitIndicator || "Credit",
    dateTime: node.DateTime,
  } : undefined;
  return { currentBalance: shape(current), availableBalance: shape(available), raw: resp };
}

export interface NedbankStatementHeader {
  statementId: string;
  statementReference?: string;
  type?: string;
  startDateTime?: string;
  endDateTime?: string;
  creationDateTime?: string;
  broughtForward?: { amount: number; indicator: string; currency: string };
  carriedForward?: { amount: number; indicator: string; currency: string };
}

export async function fetchAccountStatements(accountId: string): Promise<NedbankStatementHeader[]> {
  const resp = await nbGet<{ Data?: { Statement?: Array<{
    StatementId?: string | number;
    StatementReference?: string | number;
    Type?: string;
    StartDateTime?: string;
    EndDateTime?: string;
    CreationDateTime?: string;
    StatementAmount?: Array<{ Amount?: NedbankAmount; CreditDebitIndicator?: string; Type?: string }>;
  }> } }>(`/accounts/${encodeURIComponent(accountId)}/statements`);
  const raw = resp?.Data?.Statement as any;
  const list: any[] = Array.isArray(raw) ? raw : raw ? [raw] : [];
  return list.map((statement) => {
    const amounts = Array.isArray(statement.StatementAmount) ? statement.StatementAmount : [];
    const brought = amounts.find((item: any) => item.Type === "BalanceBroughtForward");
    const carried = amounts.find((item: any) => item.Type === "BalanceCarriedForward");
    const shape = (item: any) => item?.Amount ? {
      amount: amtNum(item.Amount),
      indicator: item.CreditDebitIndicator || "Credit",
      currency: item.Amount.Currency || "ZAR",
    } : undefined;
    return {
      statementId: String(statement.StatementId ?? ""),
      statementReference: statement.StatementReference != null ? String(statement.StatementReference) : undefined,
      type: statement.Type,
      startDateTime: statement.StartDateTime,
      endDateTime: statement.EndDateTime,
      creationDateTime: statement.CreationDateTime,
      broughtForward: shape(brought),
      carriedForward: shape(carried),
    };
  });
}

// ── Provider implementation ─────────────────────────────────────────────────

/**
 * Nedbank B2B linking is instant (no user redirect). We expose an async
 * `startLink()` that returns both the ProviderLinkResult (for immediate
 * persist) AND a synthetic authorizeUrl the client can navigate to, so
 * that linkBankAccountStart can preserve its existing "return a URL to
 * window.location =" contract. The synthetic URL just points back to
 * our own /admin/bank-feed/link page with status=linked, so the UI
 * refreshes and shows the newly-linked account.
 */
class NedbankProvider implements BankFeedProvider {
  readonly id = "NEDBANK" as const;

  /**
   * There is no OAuth authorize URL for the B2B product. Anyone calling
   * this synchronously is on the wrong code path — throw loudly.
   */
  getAuthorizeUrl(_opts: {
    state: string;
    redirectUri: string;
    scopes?: string[];
  }): string {
    throw new Error(
      "[Nedbank] B2B API has no OAuth authorize URL — use nedbankProvider.startLink() to link instantly"
    );
  }

  /**
   * Instant link: verify creds work, pick the account, return a ready-to-
   * persist ProviderLinkResult + a self-redirect URL for the client.
   *
   * If NEDBANK_PREFERRED_ACCOUNT_ID is set, we use that account; otherwise
   * we pick the first AccountId returned by /balances.
   */
  async startLink(opts: {
    baseUrl: string;
  }): Promise<{ authorizeUrl: string; link: ProviderLinkResult }> {
    const preferred = (process.env.NEDBANK_PREFERRED_ACCOUNT_ID || "").trim();

    let accountId = preferred;
    if (!accountId) {
      const ids = await listAccountIds();
      if (ids.length === 0) {
        throw new Error(
          "[Nedbank] /balances returned no accounts — check credentials, mTLS cert and NEDBANK_API_BASE"
        );
      }
      if (ids.length > 1) {
        console.warn(
          `[Nedbank] /balances returned ${ids.length} accounts; linking ${ids[0]}. ` +
            "Set NEDBANK_PREFERRED_ACCOUNT_ID to pin a specific one."
        );
      }
      accountId = ids[0];
    }

    const details = await getAccountDetails(accountId);
    const identification = details?.Account?.Identification;
    const secondary = details?.Account?.SecondaryIdentification;
    const mask =
      typeof secondary === "string" && secondary.length >= 4
        ? secondary.slice(-4)
        : typeof identification === "string" && identification.length >= 4
          ? identification.slice(-4)
          : undefined;

    // Nedbank B2B has no tokens — creds live in env. Synthesise placeholders
    // with far-future expiry so the poller never tries to "refresh" them.
    // (mirrors monoClient.ts, per repo memory.)
    const farFuture = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000);
    const placeholder = "nedbank-b2b-no-token";
    const tokens: ProviderTokens = {
      accessToken: placeholder,
      refreshToken: placeholder,
      accessTokenExpiry: farFuture,
      consentExpiry: farFuture,
    };

    const link: ProviderLinkResult = {
      externalAccountId: accountId,
      externalLinkageId: accountId,
      tokens,
      bankName: "Nedbank",
      accountMask: mask,
    };

    // Self-redirect: instant success page. No round-trip to Nedbank.
    const base = (opts.baseUrl || process.env.BASE_URL || "").replace(/\/+$/, "");
    const authorizeUrl = `${base}/admin/bank-feed/link?status=linked&provider=NEDBANK`;

    return { authorizeUrl, link };
  }

  /**
   * B2B has no OAuth code exchange. Present only so we satisfy the
   * BankFeedProvider interface — never actually called (the tRPC layer
   * links inline via startLink()).
   */
  async exchangeCode(_opts: {
    code: string;
    redirectUri: string;
  }): Promise<ProviderLinkResult> {
    throw new Error(
      "[Nedbank] B2B API has no exchangeCode step — links are created inline via startLink()"
    );
  }

  /**
   * B2B has no refresh flow. Tokens are placeholder strings; return them
   * unchanged with a fresh far-future expiry so the poller stays happy.
   */
  async refreshAccessToken(refreshToken: string): Promise<ProviderTokens> {
    const farFuture = new Date(Date.now() + 50 * 365 * 24 * 60 * 60 * 1000);
    return {
      accessToken: refreshToken,
      refreshToken,
      accessTokenExpiry: farFuture,
      consentExpiry: farFuture,
    };
  }

  /**
   * GET /accounts/{accountId}/transactions
   *
   * Nedbank returns `Data.Transaction[]` plus `Meta.ContinuationValue`
   * and `Links.Next`. We use ContinuationValue as our opaque cursor.
   */
  async fetchTransactions(opts: {
    accessToken: string;
    externalAccountId: string;
    cursor?: string | null;
    sinceDate?: Date;
  }): Promise<ProviderTransactionsPage> {
    const query: Record<string, string | undefined> = {
      pageSize: process.env.NEDBANK_PAGE_SIZE || "100",
      toBookingDateTime: new Date().toISOString(),
    };
    if (opts.sinceDate) query.fromBookingDateTime = opts.sinceDate.toISOString();
    if (opts.cursor) query.continuationValue = opts.cursor;

    const resp = await nbGet<{
      Data?: { Transaction?: NedbankTxNode[] };
      Meta?: { ContinuationValue?: string; PageSize?: number };
      Links?: { Next?: string };
    }>(
      `/accounts/${encodeURIComponent(opts.externalAccountId)}/transactions`,
      query
    );

    const nodes = resp?.Data?.Transaction || [];
    // Next cursor: prefer Meta.ContinuationValue when Links.Next is present.
    const hasNext = Boolean(resp?.Links?.Next);
    const nextCursor =
      hasNext && resp?.Meta?.ContinuationValue
        ? String(resp.Meta.ContinuationValue)
        : null;

    return {
      transactions: nodes.map(normaliseTx),
      nextCursor,
    };
  }

  /** No webhook support on the B2B API — poll-only. */
  verifyWebhookSignature(_opts: {
    rawBody: string;
    signatureHeader: string | null;
  }): boolean {
    return false;
  }

  parseWebhookEvent(_rawBody: string): {
    eventType: string;
    externalAccountId: string | null;
    transactions: NormalisedTransaction[];
  } {
    throw new Error(
      "[Nedbank] Webhooks are not supported by the B2B Account Enquiries API"
    );
  }

  /** No revoke endpoint. Creds are in env; unlinking just clears the DB row. */
  async revoke(_refreshToken: string): Promise<void> {
    // Intentionally empty.
  }
}

export const nedbankProvider = new NedbankProvider();
