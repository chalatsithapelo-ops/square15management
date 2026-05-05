/**
 * Generic bank-feed aggregator provider interface.
 *
 * Implemented by `stitchClient.ts` (Stitch.money) and (future) `monoClient.ts`.
 * Stored against BankAccount.externalProvider so we can swap providers per-row.
 */

export type BankFeedProviderId = "STITCH" | "MONO";

/** Normalised transaction shape across providers (matches storeBatchTransactions input). */
export interface NormalisedTransaction {
  externalId: string; // provider's unique transaction id
  date: Date;
  amount: number; // always positive
  transactionType: "DEBIT" | "CREDIT";
  description: string;
  balance?: number;
  reference?: string;
  rawDescription?: string;
}

export interface ProviderTokens {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiry: Date;
  consentExpiry?: Date;
}

export interface ProviderLinkResult {
  externalAccountId: string;
  externalLinkageId: string;
  tokens: ProviderTokens;
  // Optional: ask provider for "what is this account" so we can pre-fill DB
  bankName?: string;
  accountMask?: string; // last 4 digits
}

export interface ProviderTransactionsPage {
  transactions: NormalisedTransaction[];
  nextCursor: string | null;
}

export interface BankFeedProvider {
  readonly id: BankFeedProviderId;

  /** Build the hosted-link URL the user is redirected to. */
  getAuthorizeUrl(opts: {
    state: string;
    redirectUri: string;
    scopes?: string[];
  }): string;

  /** Exchange the OAuth `code` for tokens and account info. */
  exchangeCode(opts: {
    code: string;
    redirectUri: string;
  }): Promise<ProviderLinkResult>;

  /** Refresh an expiring access token using the stored refresh token. */
  refreshAccessToken(refreshToken: string): Promise<ProviderTokens>;

  /** Pull transactions since `cursor`, paginated. */
  fetchTransactions(opts: {
    accessToken: string;
    externalAccountId: string;
    cursor?: string | null;
    sinceDate?: Date;
  }): Promise<ProviderTransactionsPage>;

  /** Verify a webhook signature (HMAC-SHA256 typically). */
  verifyWebhookSignature(opts: {
    rawBody: string;
    signatureHeader: string | null;
  }): boolean;

  /** Parse a verified webhook into normalised events. */
  parseWebhookEvent(rawBody: string): {
    eventType: string;
    externalAccountId: string | null;
    transactions: NormalisedTransaction[];
  };

  /** Revoke tokens at the provider (best-effort; never throws). */
  revoke(refreshToken: string): Promise<void>;
}
