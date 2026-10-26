/**
 * Nedbank Nightly Automation Job
 *
 * Fires once per night at 01:00 SAST (Africa/Johannesburg, UTC+2, no DST).
 * The Nedbank API team requested that we automate our calls so that when
 * they arrive at work each morning they have a batch of overnight requests
 * to review and approve on their side.
 *
 * Each run performs (in order):
 *   1. GET /isup                              — health check
 *   2. GET /balances                          — proves creds + lists accounts
 *   3. For each returned AccountId:
 *        GET /accounts/{id}
 *        GET /accounts/{id}/balances
 *        GET /accounts/{id}/transactions?fromBookingDateTime=<24h ago>&toBookingDateTime=<now>
 *   4. If any BankAccount rows are linked (externalProvider='NEDBANK'),
 *      runs syncBankAccount(id) on each so new txns land in BankTransaction
 *      (same dedup + categorisation + SSE pipeline as the 15-min poller).
 *
 * Cluster safety: PM2 cluster gives every worker its own timer. We gate
 * on NODE_APP_INSTANCE=0 so exactly ONE worker runs the job. Set
 * NEDBANK_NIGHTLY_FORCE=1 to bypass this for manual runs / single-worker mode.
 *
 * Env:
 *   NEDBANK_NIGHTLY_ENABLED     "1"/"true" to enable, "0"/"false" to disable.
 *                               Default: same as NEDBANK_ENABLED (auto-on with
 *                               the rest of the Nedbank connector).
 *   NEDBANK_NIGHTLY_HOUR_SAST   0-23, default 1
 *   NEDBANK_NIGHTLY_MINUTE_SAST 0-59, default 0
 *   NEDBANK_NIGHTLY_FORCE       "1" to run on all PM2 workers (not just 0)
 *
 * Manual trigger: use the `runNedbankNightlyNow` tRPC procedure or import
 * runNedbankNightlyJob() directly from a script.
 */

import { db } from "~/server/db";
import { nedbankFetchOpts } from "./nedbankMtls";
import { syncBankAccount } from "./providerConnector";
import { fetchAccountBalance, fetchAccountStatements } from "./nedbankClient";

const SAST_OFFSET_MIN = 120; // UTC+02:00 (no DST in South Africa)
const DEFAULT_HOUR = 1;
const DEFAULT_MINUTE = 0;
const DEFAULT_API_BASE =
  "https://b2b-api.nedbank.co.za/apimarket/b2b-sb/account-enquiries/v1";
const DEFAULT_FINANCIAL_ID = "OB/2017/001";

function apiBase(): string {
  return (process.env.NEDBANK_API_BASE || DEFAULT_API_BASE).replace(/\/+$/, "");
}
function financialId(): string {
  return process.env.NEDBANK_FINANCIAL_ID || DEFAULT_FINANCIAL_ID;
}
function nedbankHeaders(): Record<string, string> {
  return {
    Accept: "application/json",
    "x-fapi-financial-id": financialId(),
    "x-ibm-client-id": process.env.NEDBANK_CLIENT_ID || "",
    "x-ibm-client-secret": process.env.NEDBANK_CLIENT_SECRET || "",
  };
}

async function nbGet(
  path: string
): Promise<{ status: number; body: any; ok: boolean }> {
  const url = `${apiBase()}${path}`;
  try {
    const resp = await fetch(url, {
      method: "GET",
      headers: nedbankHeaders(),
      ...(nedbankFetchOpts() as RequestInit),
    });
    const text = await resp.text();
    let body: any = text;
    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        /* leave as raw text */
      }
    }
    return { status: resp.status, body, ok: resp.ok };
  } catch (err) {
    return { status: 0, body: { error: (err as Error).message }, ok: false };
  }
}

/**
 * Return the next Date (real UTC) at hour:minute SAST, strictly in the future.
 */
function nextSastTime(hour: number, minute: number): Date {
  const now = new Date();
  const utcMs = now.getTime();
  const sastNow = new Date(utcMs + SAST_OFFSET_MIN * 60_000);
  const targetSastAsUtc = new Date(
    Date.UTC(
      sastNow.getUTCFullYear(),
      sastNow.getUTCMonth(),
      sastNow.getUTCDate(),
      hour,
      minute,
      0
    )
  );
  let targetUtc = new Date(targetSastAsUtc.getTime() - SAST_OFFSET_MIN * 60_000);
  if (targetUtc.getTime() <= utcMs) {
    targetUtc = new Date(targetUtc.getTime() + 24 * 3600 * 1000);
  }
  return targetUtc;
}

// ── The job ────────────────────────────────────────────────────────────────

export interface NedbankNightlyResult {
  startedAt: string;
  finishedAt: string;
  elapsedMs: number;
  callsMade: number;
  errors: string[];
  summary: {
    isup: { status: number; ok: boolean; isUp?: boolean } | null;
    balances: { status: number; ok: boolean; accountCount?: number } | null;
    accounts: Array<{
      accountId: string;
      details: { status: number; ok: boolean };
      balances: { status: number; ok: boolean };
      transactions: { status: number; ok: boolean; count: number };
    }>;
    linkedAccountsSynced: Array<{
      id: number;
      name: string;
      newCount: number;
      duplicateCount: number;
      errors: string[];
    }>;
  };
}

export async function runNedbankNightlyJob(opts?: {
  manual?: boolean;
}): Promise<NedbankNightlyResult> {
  const startedAt = new Date();
  const errors: string[] = [];
  let callsMade = 0;
  const summary: NedbankNightlyResult["summary"] = {
    isup: null,
    balances: null,
    accounts: [],
    linkedAccountsSynced: [],
  };

  console.log(
    `[Nedbank][Nightly] ${opts?.manual ? "Manual" : "Scheduled"} run starting at ${startedAt.toISOString()}`
  );

  // 1) /isup
  {
    const r = await nbGet("/isup");
    callsMade++;
    summary.isup = { status: r.status, ok: r.ok, isUp: r.body?.isUp };
    if (!r.ok) errors.push(`isup: HTTP ${r.status}`);
    console.log(`[Nedbank][Nightly] GET /isup -> HTTP ${r.status}`);
  }

  // 2) /balances
  const accountIds: string[] = [];
  {
    const r = await nbGet("/balances");
    callsMade++;
    summary.balances = { status: r.status, ok: r.ok };
    if (r.ok) {
      const balArray: any[] = Array.isArray(r.body?.Data?.Balance)
        ? r.body.Data.Balance
        : [];
      for (const b of balArray) {
        if (b?.AccountId && !accountIds.includes(b.AccountId)) {
          accountIds.push(b.AccountId);
        }
      }
      summary.balances.accountCount = accountIds.length;
    } else {
      errors.push(`balances: HTTP ${r.status}`);
    }
    console.log(
      `[Nedbank][Nightly] GET /balances -> HTTP ${r.status} (${accountIds.length} accounts discovered)`
    );
  }

  // Optional pin: only touch a single account if operator has narrowed it down.
  const preferred = (process.env.NEDBANK_PREFERRED_ACCOUNT_ID || "").trim();
  const targetIds = preferred ? [preferred] : accountIds;

  // 3) Per-account calls, 24-hour window
  const fromISO = new Date(startedAt.getTime() - 24 * 3600 * 1000).toISOString();
  const toISO = startedAt.toISOString();

  for (const id of targetIds) {
    const perAcct: NedbankNightlyResult["summary"]["accounts"][number] = {
      accountId: id,
      details: { status: 0, ok: false },
      balances: { status: 0, ok: false },
      transactions: { status: 0, ok: false, count: 0 },
    };

    const details = await nbGet(`/accounts/${encodeURIComponent(id)}`);
    callsMade++;
    perAcct.details = { status: details.status, ok: details.ok };
    if (!details.ok) errors.push(`accounts/${id}: HTTP ${details.status}`);

    const acctBal = await nbGet(
      `/accounts/${encodeURIComponent(id)}/balances`
    );
    callsMade++;
    perAcct.balances = { status: acctBal.status, ok: acctBal.ok };
    if (!acctBal.ok)
      errors.push(`accounts/${id}/balances: HTTP ${acctBal.status}`);

    const txnPath =
      `/accounts/${encodeURIComponent(id)}/transactions` +
      `?fromBookingDateTime=${encodeURIComponent(fromISO)}` +
      `&toBookingDateTime=${encodeURIComponent(toISO)}`;
    const txns = await nbGet(txnPath);
    callsMade++;
    const txnList = Array.isArray(txns.body?.Data?.Transaction)
      ? txns.body.Data.Transaction
      : [];
    perAcct.transactions = {
      status: txns.status,
      ok: txns.ok,
      count: txnList.length,
    };
    if (!txns.ok)
      errors.push(`accounts/${id}/transactions: HTTP ${txns.status}`);

    summary.accounts.push(perAcct);
    console.log(
      `[Nedbank][Nightly] Account ${id}: details=${details.status} balances=${acctBal.status} txns=${txns.status} (${perAcct.transactions.count} txns in last 24h)`
    );
  }

  // 4) Ingest into BankTransaction for any linked NEDBANK BankAccount rows
  try {
    const linked = await db.bankAccount.findMany({
      where: {
        externalProvider: "NEDBANK",
        isActive: true,
        feedEnabled: true,
      },
      select: { id: true, accountName: true },
    });
    for (const a of linked) {
      try {
        const r = await syncBankAccount(a.id);
        // Persist live balance + statement headers so the admin UI can show them.
        try {
          const acctRow = await db.bankAccount.findUnique({ where: { id: a.id }, select: { externalAccountId: true } });
          if (acctRow?.externalAccountId) {
            const bal = await fetchAccountBalance(acctRow.externalAccountId);
            if (bal.currentBalance) {
              await db.bankAccount.update({
                where: { id: a.id },
                data: {
                  currentBalance: bal.currentBalance.amount,
                  balanceCurrency: bal.currentBalance.currency,
                  balanceIndicator: bal.currentBalance.indicator,
                  balanceType: "CurrentBalance",
                  balanceAsOf: bal.currentBalance.dateTime ? new Date(bal.currentBalance.dateTime) : new Date(),
                  balanceCapturedAt: new Date(),
                  availableBalance: bal.availableBalance?.amount ?? null,
                },
              });
            }
            const stmts = await fetchAccountStatements(acctRow.externalAccountId);
            for (const st of stmts) {
              if (!st.statementId || !st.startDateTime) continue;
              await db.bankAccountStatement.upsert({
                where: { bankAccountId_externalStatementId: { bankAccountId: a.id, externalStatementId: st.statementId } },
                update: {
                  statementReference: st.statementReference ?? null,
                  statementType: st.type ?? null,
                  startDateTime: new Date(st.startDateTime),
                  endDateTime: st.endDateTime ? new Date(st.endDateTime) : null,
                  creationDateTime: st.creationDateTime ? new Date(st.creationDateTime) : null,
                  broughtForwardAmount: st.broughtForward?.amount ?? null,
                  broughtForwardIndicator: st.broughtForward?.indicator ?? null,
                  carriedForwardAmount: st.carriedForward?.amount ?? null,
                  carriedForwardIndicator: st.carriedForward?.indicator ?? null,
                  currency: st.carriedForward?.currency ?? st.broughtForward?.currency ?? "ZAR",
                },
                create: {
                  bankAccountId: a.id,
                  externalStatementId: st.statementId,
                  statementReference: st.statementReference ?? null,
                  statementType: st.type ?? null,
                  startDateTime: new Date(st.startDateTime),
                  endDateTime: st.endDateTime ? new Date(st.endDateTime) : null,
                  creationDateTime: st.creationDateTime ? new Date(st.creationDateTime) : null,
                  broughtForwardAmount: st.broughtForward?.amount ?? null,
                  broughtForwardIndicator: st.broughtForward?.indicator ?? null,
                  carriedForwardAmount: st.carriedForward?.amount ?? null,
                  carriedForwardIndicator: st.carriedForward?.indicator ?? null,
                  currency: st.carriedForward?.currency ?? st.broughtForward?.currency ?? "ZAR",
                },
              });
            }
            console.log(`[Nedbank][Nightly] Persisted balance + ${stmts.length} statement(s) for ${a.accountName}`);
          }
        } catch (persistErr) {
          console.warn(`[Nedbank][Nightly] Persist balance/statements failed for ${a.accountName}:`, (persistErr as Error).message);
        }
        summary.linkedAccountsSynced.push({
          id: a.id,
          name: a.accountName,
          newCount: r.newCount,
          duplicateCount: r.duplicateCount,
          errors: r.errors,
        });
        console.log(
          `[Nedbank][Nightly] Synced BankAccount ${a.accountName}: ${r.newCount} new, ${r.duplicateCount} dup`
        );
      } catch (err) {
        const msg = (err as Error).message;
        errors.push(`sync ${a.accountName}: ${msg}`);
        console.error(
          `[Nedbank][Nightly] Sync failed for ${a.accountName}:`,
          msg
        );
      }
    }
    if (linked.length === 0) {
      console.log(
        "[Nedbank][Nightly] No BankAccount rows are linked to Nedbank yet — health/balance calls fired but no txns ingested. Link an account via /admin/bank-feed/link once the QA account is provisioned."
      );
    }
  } catch (err) {
    const msg = (err as Error).message;
    errors.push(`linked lookup: ${msg}`);
    console.error("[Nedbank][Nightly] Linked account lookup failed:", msg);
  }

  const finishedAt = new Date();
  const elapsedMs = finishedAt.getTime() - startedAt.getTime();
  console.log(
    `[Nedbank][Nightly] Finished in ${elapsedMs}ms — ${callsMade} API calls, ${errors.length} errors`
  );

  return {
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    elapsedMs,
    callsMade,
    errors,
    summary,
  };
}

// ── Scheduler ──────────────────────────────────────────────────────────────

let nightlyTimer: NodeJS.Timeout | null = null;
let nightlyStarted = false;

function scheduleNext() {
  const hourRaw = parseInt(process.env.NEDBANK_NIGHTLY_HOUR_SAST || "", 10);
  const minRaw = parseInt(process.env.NEDBANK_NIGHTLY_MINUTE_SAST || "", 10);
  const h =
    Number.isFinite(hourRaw) && hourRaw >= 0 && hourRaw <= 23
      ? hourRaw
      : DEFAULT_HOUR;
  const m =
    Number.isFinite(minRaw) && minRaw >= 0 && minRaw <= 59
      ? minRaw
      : DEFAULT_MINUTE;
  const next = nextSastTime(h, m);
  const delayMs = next.getTime() - Date.now();
  console.log(
    `[Nedbank][Nightly] Next run scheduled for ${next.toISOString()} (${h.toString().padStart(2, "0")}:${m
      .toString()
      .padStart(2, "0")} SAST) — in ${Math.round(delayMs / 60000)} min`
  );
  nightlyTimer = setTimeout(async () => {
    try {
      await runNedbankNightlyJob();
    } catch (err) {
      console.error("[Nedbank][Nightly] Job threw:", err);
    } finally {
      scheduleNext();
    }
  }, delayMs);
  nightlyTimer.unref?.();
}

export function bootstrapNedbankNightlyJob() {
  if (nightlyStarted) return;

  const enabledFlag = process.env.NEDBANK_NIGHTLY_ENABLED;
  const explicitOff = enabledFlag === "0" || enabledFlag === "false";
  const explicitOn = enabledFlag === "1" || enabledFlag === "true";
  const nedbankOn =
    process.env.NEDBANK_ENABLED === "1" ||
    process.env.NEDBANK_ENABLED === "true";
  const enabled = explicitOn || (nedbankOn && !explicitOff);
  if (!enabled) return;

  if (
    !process.env.NEDBANK_CLIENT_ID ||
    !process.env.NEDBANK_CLIENT_SECRET ||
    !process.env.NEDBANK_CERT_PATH ||
    !process.env.NEDBANK_CERT_PASSPHRASE
  ) {
    console.warn(
      "[Nedbank][Nightly] Enabled but NEDBANK_CLIENT_ID/SECRET or NEDBANK_CERT_PATH/PASSPHRASE missing — nightly job NOT started"
    );
    return;
  }

  // Cluster safety: only run on the primary PM2 worker.
  const instance =
    process.env.NODE_APP_INSTANCE ??
    process.env.pm_id ??
    process.env.PM2_INSTANCE_ID;
  const force = process.env.NEDBANK_NIGHTLY_FORCE === "1";
  if (instance !== undefined && instance !== "0" && !force) {
    console.log(
      `[Nedbank][Nightly] Skipping on PM2 instance ${instance} (only instance 0 runs the nightly job — set NEDBANK_NIGHTLY_FORCE=1 to override)`
    );
    return;
  }

  nightlyStarted = true;
  scheduleNext();
  console.log("[Nedbank][Nightly] Bootstrapped — nightly automation active");
}

export function stopNedbankNightlyJob() {
  if (nightlyTimer) {
    clearTimeout(nightlyTimer);
    nightlyTimer = null;
  }
  nightlyStarted = false;
}
