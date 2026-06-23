/**
 * Bank-feed aggregator orchestration.
 *
 * Wires the provider-agnostic `BankFeedProvider` to our DB:
 *   - storing encrypted tokens on BankAccount.external*
 *   - feeding new transactions through storeBatchTransactions() so they go
 *     through dedup → categorisation → reconciliation → SSE → Cashbook UI
 *     (the same pipeline as CSV / email today)
 *   - polling and webhook-driven sync
 *
 * Adding a new provider = create another file like stitchClient.ts and
 * register it in `getProvider()`.
 */

import { db } from "~/server/db";
import { stitchProvider } from "./stitchClient";
import { monoProvider } from "./monoClient";
import { bankFeedEvents } from "./eventBus";
import { createTransactionHash } from "./transactionStore";
import { encryptToken, decryptToken, encryptTokenOrNull } from "./tokenCrypto";
import type {
  BankFeedProvider,
  BankFeedProviderId,
  ProviderLinkResult,
  NormalisedTransaction,
} from "./providerInterface";

// ── Provider registry ──────────────────────────────────────────────────────

export function getProvider(id: BankFeedProviderId): BankFeedProvider {
  switch (id) {
    case "STITCH":
      return stitchProvider;
    case "MONO":
      return monoProvider;
    default:
      throw new Error(`[BankFeed] Unknown provider: ${id}`);
  }
}

// ── Token helpers (encrypt at rest) ────────────────────────────────────────

async function getValidAccessToken(bankAccountId: number): Promise<{
  accessToken: string;
  provider: BankFeedProvider;
  externalAccountId: string;
}> {
  const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct?.externalProvider || !acct.externalRefreshToken || !acct.externalAccountId) {
    throw new Error(`[BankFeed] BankAccount ${bankAccountId} has no external link`);
  }
  const provider = getProvider(acct.externalProvider as BankFeedProviderId);

  const stillValid =
    acct.externalAccessToken &&
    acct.externalTokenExpiry &&
    acct.externalTokenExpiry.getTime() - Date.now() > 60_000;

  if (stillValid) {
    return {
      accessToken: decryptToken(acct.externalAccessToken!),
      provider,
      externalAccountId: acct.externalAccountId,
    };
  }

  // Refresh
  const refreshPlain = decryptToken(acct.externalRefreshToken);
  const tokens = await provider.refreshAccessToken(refreshPlain);
  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      externalAccessToken: encryptToken(tokens.accessToken),
      externalRefreshToken: encryptToken(tokens.refreshToken),
      externalTokenExpiry: tokens.accessTokenExpiry,
    },
  });
  return {
    accessToken: tokens.accessToken,
    provider,
    externalAccountId: acct.externalAccountId,
  };
}

// ── Linking ─────────────────────────────────────────────────────────────────

/**
 * Persist a successful provider link to a BankAccount row.
 * Tokens are encrypted before storage.
 */
export async function persistLink(opts: {
  bankAccountId: number;
  providerId: BankFeedProviderId;
  link: ProviderLinkResult;
}) {
  await db.bankAccount.update({
    where: { id: opts.bankAccountId },
    data: {
      externalProvider: opts.providerId,
      externalAccountId: opts.link.externalAccountId,
      externalLinkageId: opts.link.externalLinkageId,
      externalAccessToken: encryptTokenOrNull(opts.link.tokens.accessToken),
      externalRefreshToken: encryptTokenOrNull(opts.link.tokens.refreshToken),
      externalTokenExpiry: opts.link.tokens.accessTokenExpiry,
      externalConsentExpiry: opts.link.tokens.consentExpiry,
      externalLastSyncAt: null,
      externalLastError: null,
      feedEnabled: true,
    },
  });
}

/**
 * Disconnect a bank account. Best-effort revoke at provider, then clear local fields.
 */
export async function unlinkBankAccount(bankAccountId: number) {
  const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct) return;
  if (acct.externalProvider && acct.externalRefreshToken) {
    try {
      const provider = getProvider(acct.externalProvider as BankFeedProviderId);
      await provider.revoke(decryptToken(acct.externalRefreshToken));
    } catch (err) {
      console.warn("[BankFeed] revoke failed:", (err as Error).message);
    }
  }
  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      externalProvider: null,
      externalAccountId: null,
      externalLinkageId: null,
      externalAccessToken: null,
      externalRefreshToken: null,
      externalTokenExpiry: null,
      externalSyncCursor: null,
      externalLastSyncAt: null,
      externalLastError: null,
      externalConsentExpiry: null,
    },
  });
}

// ── Ingestion (shared with webhook + poll) ─────────────────────────────────

/**
 * Persist a batch of normalised transactions, emit SSE events, and return counts.
 * Reuses the existing dedup hash + bank-feed pipeline.
 */
export async function ingestProviderTransactions(opts: {
  bankAccountId: number;
  providerId: BankFeedProviderId;
  source:
    | "STITCH_WEBHOOK"
    | "STITCH_BACKFILL"
    | "STITCH_POLL"
    | "MONO_WEBHOOK"
    | "MONO_BACKFILL"
    | "MONO_POLL";
  transactions: NormalisedTransaction[];
  importBatchId?: number;
}): Promise<{ newCount: number; duplicateCount: number; errors: string[] }> {
  let newCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];

  for (const tx of opts.transactions) {
    try {
      const hash = createTransactionHash(tx.date, tx.amount, tx.description, tx.balance);
      const existing = await db.bankTransaction.findUnique({ where: { transactionHash: hash } });
      if (existing) {
        duplicateCount++;
        continue;
      }
      const created = await db.bankTransaction.create({
        data: {
          bankAccountId: opts.bankAccountId,
          transactionDate: tx.date,
          description: tx.description,
          amount: tx.amount,
          transactionType: tx.transactionType,
          balance: tx.balance,
          reference: tx.reference,
          rawDescription: tx.rawDescription,
          transactionHash: hash,
          source: opts.source,
          importBatchId: opts.importBatchId,
        },
      });
      newCount++;

      bankFeedEvents.emitTransaction({
        bankAccountId: opts.bankAccountId,
        transactionId: created.id,
        transactionDate: tx.date.toISOString(),
        amount: tx.amount,
        transactionType: tx.transactionType,
        description: tx.description,
        // SSE source enum is narrow — map provider sources to "API"
        source: "API",
      });
    } catch (err) {
      errors.push(`tx ${tx.externalId}: ${(err as Error).message}`);
    }
  }

  return { newCount, duplicateCount, errors };
}

// ── Polling / backfill ─────────────────────────────────────────────────────

/**
 * Pull transactions for a single account since its stored cursor.
 * Updates externalSyncCursor + externalLastSyncAt on success.
 */
export async function syncBankAccount(bankAccountId: number, opts?: { sinceDays?: number }) {
  const { accessToken, provider, externalAccountId } = await getValidAccessToken(bankAccountId);
  const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  const sinceDate = opts?.sinceDays
    ? new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000)
    : undefined;

  let cursor: string | null = acct?.externalSyncCursor || null;
  let totalNew = 0;
  let totalDup = 0;
  const errors: string[] = [];
  let lastSeenCursor: string | null = cursor;

  // Page through; cap at 20 pages to avoid runaway loops
  for (let page = 0; page < 20; page++) {
    const result = await provider.fetchTransactions({
      accessToken,
      externalAccountId,
      cursor,
      sinceDate,
    });

    const ingest = await ingestProviderTransactions({
      bankAccountId,
      providerId: provider.id,
      source: opts?.sinceDays ? "STITCH_BACKFILL" : "STITCH_POLL",
      transactions: result.transactions,
    });
    totalNew += ingest.newCount;
    totalDup += ingest.duplicateCount;
    errors.push(...ingest.errors);

    if (result.nextCursor) {
      lastSeenCursor = result.nextCursor;
      cursor = result.nextCursor;
    } else {
      break;
    }
  }

  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      externalSyncCursor: lastSeenCursor || acct?.externalSyncCursor,
      externalLastSyncAt: new Date(),
      externalLastError: errors.length ? errors.slice(0, 3).join(" | ") : null,
    },
  });

  return { newCount: totalNew, duplicateCount: totalDup, errors };
}

// ── Cron poller ────────────────────────────────────────────────────────────

let pollerHandle: NodeJS.Timeout | null = null;

/**
 * Start the periodic Stitch poller. Idempotent — calling twice is a no-op.
 * Runs every STITCH_POLL_MS (default 15 min).
 */
export function startBankFeedPoller(intervalMs?: number) {
  if (pollerHandle) return;
  const parsed = parseInt(process.env.STITCH_POLL_MS || "", 10);
  const ms =
    intervalMs ??
    (Number.isFinite(parsed) && parsed > 0 ? parsed : 15 * 60 * 1000);

  const tick = async () => {
    try {
      const accounts = await db.bankAccount.findMany({
        where: {
          externalProvider: { not: null },
          isActive: true,
          feedEnabled: true,
        },
        select: { id: true, accountName: true },
      });
      for (const a of accounts) {
        try {
          const r = await syncBankAccount(a.id);
          if (r.newCount > 0) {
            console.log(
              `[BankFeed][Poll] ${a.accountName}: ${r.newCount} new, ${r.duplicateCount} dup`
            );
          }
        } catch (err) {
          console.error(`[BankFeed][Poll] ${a.accountName}: ${(err as Error).message}`);
          await db.bankAccount
            .update({
              where: { id: a.id },
              data: { externalLastError: (err as Error).message.slice(0, 500) },
            })
            .catch(() => {});
        }
      }
    } catch (err) {
      console.error("[BankFeed][Poll] tick failed:", err);
    }
  };

  pollerHandle = setInterval(tick, ms);
  console.log(`[BankFeed] Aggregator poller started (${Math.round(ms / 1000)}s interval)`);
  // Run once shortly after boot
  setTimeout(tick, 10_000);
}

export function stopBankFeedPoller() {
  if (pollerHandle) {
    clearInterval(pollerHandle);
    pollerHandle = null;
  }
}
