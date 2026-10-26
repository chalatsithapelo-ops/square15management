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
import { nedbankProvider, fetchAccountBalance, fetchAccountStatements } from "./nedbankClient";
import { bankFeedEvents } from "./eventBus";
import { createTransactionHash } from "./transactionStore";
import { encryptToken, decryptToken, encryptTokenOrNull } from "./tokenCrypto";
import { reconcileTransaction } from "./reconciliationEngine";
import { categorizeTransaction } from "./categorizationEngine";
import type {
  BankFeedProvider,
  BankFeedProviderId,
  ProviderLinkResult,
  NormalisedTransaction,
} from "./providerInterface";

function describeSyncError(err: unknown): string {
  const parts: string[] = [];
  let current: any = err;
  for (let depth = 0; current && depth < 4; depth++, current = current.cause) {
    const message = typeof current?.message === "string" ? current.message : String(current);
    if (message && !parts.includes(message)) parts.push(message);
    if (current?.code && !parts.includes(String(current.code))) parts.push(String(current.code));
  }
  return parts.join(" | ").slice(0, 500) || "Unknown bank-feed error";
}

// ── Provider registry ──────────────────────────────────────────────────────

export function getProvider(id: BankFeedProviderId): BankFeedProvider {
  switch (id) {
    case "STITCH":
      return stitchProvider;
    case "MONO":
      return monoProvider;
    case "NEDBANK":
      return nedbankProvider;
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
    | "MONO_POLL"
    | "NEDBANK_BACKFILL"
    | "NEDBANK_POLL";
  transactions: NormalisedTransaction[];
  importBatchId?: number;
}): Promise<{ newCount: number; duplicateCount: number; errors: string[] }> {
  let newCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];

  for (const tx of opts.transactions) {
    try {
      if (tx.externalId) {
        const byProviderId = await db.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM "BankTransaction"
          WHERE "bankAccountId" = ${opts.bankAccountId}
            AND "providerTransactionId" = ${tx.externalId}
          LIMIT 1
        `;
        if (byProviderId.length > 0) {
          duplicateCount++;
          continue;
        }
      }
      const hash = createTransactionHash(tx.date, tx.amount, tx.description, tx.balance);
      const existing = await db.bankTransaction.findUnique({ where: { transactionHash: hash } });
      if (existing) {
        if (tx.externalId) {
          await db.$executeRaw`
            UPDATE "BankTransaction"
            SET "providerTransactionId"=${tx.externalId}
            WHERE id=${existing.id}
              AND "bankAccountId"=${opts.bankAccountId}
              AND "providerTransactionId" IS NULL
          `;
        }
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
      if (tx.externalId) {
        await db.$executeRaw`
          UPDATE "BankTransaction"
          SET "providerTransactionId" = ${tx.externalId}
          WHERE id = ${created.id}
            AND "bankAccountId" = ${opts.bankAccountId}
        `;
      }
      newCount++;

      // Every provider ingestion must use the same categorize → reconcile
      // pipeline as CSV/email. Persist direct API categorizations too.
      let categorization: {
        category: string;
        isConfirmed: boolean;
        linkedEntityType: string | null;
        linkedEntityId: number | null;
        confidence: number;
      } | null = null;
      try {
        await categorizeTransaction(created.id, tx.description, tx.amount, tx.transactionType);
        categorization = await db.transactionCategorization.findUnique({
          where: { bankTransactionId: created.id },
          select: { category: true, isConfirmed: true, linkedEntityType: true, linkedEntityId: true, confidence: true },
        });
      } catch (categorizationError) {
        console.warn(`[BankFeed] Categorization deferred for transaction ${created.id}: ${describeSyncError(categorizationError)}`);
      }

      try {
        await reconcileTransaction({
          id: created.id,
          transactionDate: tx.date,
          description: tx.description,
          amount: tx.amount,
          transactionType: tx.transactionType,
          reference: tx.reference ?? null,
          categorization,
        });
      } catch (reconcileError) {
        console.warn(`[BankFeed] Auto-reconcile skipped for transaction ${created.id}: ${describeSyncError(reconcileError)}`);
      }

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
  const acct = await db.bankAccount.findUnique({ where: { id: bankAccountId } });
  if (!acct?.externalProvider || !acct.externalAccountId) {
    throw new Error(`[BankFeed] BankAccount ${bankAccountId} has no external link`);
  }
  const provider = getProvider(acct.externalProvider as BankFeedProviderId);
  const externalAccountId = acct.externalAccountId;
  const accessToken = provider.id === "NEDBANK"
    ? ""
    : (await getValidAccessToken(bankAccountId)).accessToken;

  let sinceDate: Date | undefined;
  if (opts?.sinceDays) {
    sinceDate = new Date(Date.now() - opts.sinceDays * 24 * 60 * 60 * 1000);
  } else if (provider.id === "NEDBANK") {
    const latest = await db.bankTransaction.findFirst({
      where: { bankAccountId },
      orderBy: { transactionDate: "desc" },
      select: { transactionDate: true },
    });
    const anchor = latest?.transactionDate ?? acct.externalLastSyncAt ?? new Date();
    sinceDate = new Date(Math.min(anchor.getTime(), Date.now()) - 3 * 24 * 60 * 60 * 1000);
    if (!latest && !acct.externalLastSyncAt) sinceDate = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  }

  let cursor: string | null = provider.id === "NEDBANK" ? null : acct.externalSyncCursor || null;
  let lastSeenCursor = cursor;
  let totalNew = 0;
  let totalDup = 0;
  let reachedEnd = false;
  const errors: string[] = [];

  if (provider.id === "NEDBANK") {
    try {
      const balance = await fetchAccountBalance(externalAccountId);
      if (!balance.currentBalance) {
        errors.push("Balance refresh: Nedbank returned no current-balance record.");
      } else {
        const asOf = balance.currentBalance.dateTime ? new Date(balance.currentBalance.dateTime) : new Date();
        await db.bankAccount.update({
          where: { id: bankAccountId },
          data: {
            currentBalance: balance.currentBalance.amount,
            availableBalance: balance.availableBalance?.amount ?? null,
            balanceCurrency: balance.currentBalance.currency || "ZAR",
            balanceIndicator: balance.currentBalance.indicator || "Credit",
            balanceType: "CurrentBalance",
            balanceAsOf: Number.isNaN(asOf.getTime()) ? new Date() : asOf,
            balanceCapturedAt: new Date(),
          },
        });
      }
    } catch (err) {
      errors.push(`Balance refresh: ${describeSyncError(err)}`);
    }

    try {
      const statements = await fetchAccountStatements(externalAccountId);
      for (const statement of statements) {
        if (!statement.statementId || !statement.startDateTime) continue;
        const startDateTime = new Date(statement.startDateTime);
        if (Number.isNaN(startDateTime.getTime())) continue;
        const row = {
          statementReference: statement.statementReference ?? null,
          statementType: statement.type ?? null,
          startDateTime,
          endDateTime: statement.endDateTime ? new Date(statement.endDateTime) : null,
          creationDateTime: statement.creationDateTime ? new Date(statement.creationDateTime) : null,
          broughtForwardAmount: statement.broughtForward?.amount ?? null,
          broughtForwardIndicator: statement.broughtForward?.indicator ?? null,
          carriedForwardAmount: statement.carriedForward?.amount ?? null,
          carriedForwardIndicator: statement.carriedForward?.indicator ?? null,
          currency: statement.carriedForward?.currency ?? statement.broughtForward?.currency ?? "ZAR",
        };
        await db.bankAccountStatement.upsert({
          where: { bankAccountId_externalStatementId: { bankAccountId, externalStatementId: statement.statementId } },
          update: row,
          create: { bankAccountId, externalStatementId: statement.statementId, ...row },
        });
      }
      console.log(`[BankFeed][Nedbank] ${acct.accountName}: balance and ${statements.length} statement header(s) refreshed`);
    } catch (err) {
      errors.push(`Statement refresh: ${describeSyncError(err)}`);
    }
  }

  for (let page = 0; page < 50; page++) {
    const result = await provider.fetchTransactions({ accessToken, externalAccountId, cursor, sinceDate });
    const ingest = await ingestProviderTransactions({
      bankAccountId,
      providerId: provider.id,
      source: opts?.sinceDays
        ? (`${provider.id}_BACKFILL` as "STITCH_BACKFILL" | "MONO_BACKFILL" | "NEDBANK_BACKFILL")
        : (`${provider.id}_POLL` as "STITCH_POLL" | "MONO_POLL" | "NEDBANK_POLL"),
      transactions: result.transactions,
    });
    totalNew += ingest.newCount;
    totalDup += ingest.duplicateCount;
    errors.push(...ingest.errors);
    if (!result.nextCursor) {
      reachedEnd = true;
      break;
    }
    lastSeenCursor = result.nextCursor;
    cursor = result.nextCursor;
  }

  if (!reachedEnd) errors.push("Transaction pagination reached the 50-page safety limit; next poll will repeat the incremental date window.");

  await db.bankAccount.update({
    where: { id: bankAccountId },
    data: {
      externalSyncCursor: provider.id === "NEDBANK" ? null : (lastSeenCursor || acct.externalSyncCursor),
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
          if (r.errors.length > 0) {
            console.error(`[BankFeed][Poll] ${a.accountName}: ${r.errors.join(" | ")}`);
          }
        } catch (err) {
          const message = describeSyncError(err);
          console.error(`[BankFeed][Poll] ${a.accountName}: ${message}`);
          await db.bankAccount
            .update({
              where: { id: a.id },
              data: { externalLastError: message },
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
