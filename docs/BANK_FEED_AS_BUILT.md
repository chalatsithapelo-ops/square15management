# Bank Feed — As-Built Reference

What is actually running in production. Update this doc when the
implementation changes.

---

## Architecture (one paragraph)

Each supported bank (FNB, ABSA, Standard Bank, Nedbank, Capitec, Investec,
TymeBank, Discovery) sends transaction notification emails to a finance
inbox. A long-lived IMAP connection ingests them, parses each notification
into a structured `BankTransaction`, deduplicates by SHA256 hash, attempts
auto-categorisation, and emits an in-process event. A Server-Sent Events
endpoint pushes that event to connected browser tabs so the Cashbook tab
on Management Accounts and the Bank Feed admin page refresh in real time.
A 5-minute polling loop is kept as a fallback for environments where IMAP
IDLE is unavailable.

---

## Data model (Prisma)

Defined in [prisma/schema.prisma](../prisma/schema.prisma):

| Model                     | Purpose                                                              |
| ------------------------- | -------------------------------------------------------------------- |
| `BankAccount`             | One row per real-world account. Owner via `createdById`.             |
| `BankTransaction`         | Immutable record of a single posting. Unique on `transactionHash`.   |
| `BankImportBatch`         | Tracks each CSV import run.                                          |
| `TransactionCategorization` | Audit trail of categorisations (rule vs manual).                   |
| `CategorizationRule`      | User-editable patterns the engine applies on insert.                 |

`BankTransaction.transactionType` is `DEBIT | CREDIT`; `amount` is always
positive. Reconciliation links: `linkedInvoiceId`,
`linkedOperationalExpenseId`, `linkedPaymentRequestId`,
`linkedAlternativeRevenueId`.

---

## Services

All under `src/server/services/bankFeed/`.

| File                         | Responsibility                                                              |
| ---------------------------- | --------------------------------------------------------------------------- |
| `emailParsers.ts`            | `detectBank(from)` and `parseEmailNotification(...)` per bank.              |
| `emailPoller.ts`             | Both polling (`startEmailPoller`) and IMAP IDLE (`startEmailIdle`) modes.   |
| `transactionStore.ts`        | `createTransactionHash`, `storeTransaction`, `storeBatchTransactions`.      |
| `categorizationEngine.ts`    | Rule-based auto-categorisation on insert.                                   |
| `eventBus.ts`                | In-process `bankFeedEvents` EventEmitter (single-process only).             |

### Mode switch

`src/server/trpc/handler.ts > bootstrapEmailPoller()` chooses:

- `BANK_FEED_IDLE=1` → `startEmailIdle` (push, sub-second).
- otherwise → `startEmailPoller(config, BANK_FEED_POLL_MS || 300000)`.

IMAP IDLE auto-reconnects with exponential backoff (cap 60 s) and runs a
NOOP keep-alive every 5 min to defeat Gmail's 29-min idle timeout.

> **Cluster-mode note:** `eventBus` is in-process. PM2 cluster runs ≥ 2
> workers; only one worker holds the IMAP connection. Browsers connected
> to other workers will receive the SSE notification only when their
> worker re-fetches via the safety-net `refetchInterval` (5 min) **or**
> they happen to be on the same worker. To get true real-time across all
> workers, swap `eventBus.ts` for Redis pub/sub. Tracked as future work.

---

## HTTP routes

Registered in [app.config.ts](../app.config.ts):

| Route                        | Handler                                            | Purpose                  |
| ---------------------------- | -------------------------------------------------- | ------------------------ |
| `POST /trpc/*`               | `src/server/trpc/handler.ts`                       | All tRPC procedures.     |
| `GET  /api/bank-feed/stream` | `src/server/bank-feed/stream-handler.ts`           | SSE — live transactions. |

### SSE protocol

- Auth: `?token=<sessionToken>` (validated via `authenticateUser`).
- Optional filter: `?bankAccountId=<id>` (verifies ownership; 403 if not).
- Events:
  - `event: transaction` — JSON payload `{ bankAccountId, transactionId,
    transactionDate, amount, transactionType, description, source }`.
  - `event: ping` — every 25 s, keeps proxies from killing the connection.
- Heartbeat comments (`:heartbeat`) every 25 s as a second keep-alive.

---

## tRPC procedures (Cashbook)

| Procedure                  | Purpose                                                     |
| -------------------------- | ----------------------------------------------------------- |
| `getFeatureFlags`          | Public read of `cashbookEnabled`, `bankFeedIdle`.           |
| `getCashbookSummary`       | Per-account KPI + recent transactions for one date range.   |
| `getReconciliationGaps`    | Diagnostic lists for the review workflow.                   |

Plus the existing `getBankAccounts`, `getBankTransactions`, `getBankFeedStats`,
`createBankAccount`, `updateBankAccount`, `deleteBankAccount`,
`importCSVStatement`, `getImportBatches`,
`reconcileBankAccountProcedure`, `confirmBankTransaction`,
`recategorizeBankTransaction`, `updateTransactionReconciliation`.

---

## UI

| Surface                                              | Location                                                |
| ---------------------------------------------------- | ------------------------------------------------------- |
| **Bank Feed admin** (full management)                | `src/routes/admin/bank-feed/index.tsx`                  |
| **Cashbook tab** on Management Accounts (read-only) | `src/components/accounts/CashbookPanel.tsx` rendered by `src/routes/admin/accounts/index.tsx` |
| **Live SSE hook**                                    | `src/hooks/useBankFeedStream.ts`                        |

The Cashbook tab is gated behind `env.CASHBOOK_ENABLED` and displays an
amber "Cash vs Accrual" banner that staff are not expected to dismiss.

---

## Environment variables

| Var                                | Required | Purpose                                                     |
| ---------------------------------- | -------- | ----------------------------------------------------------- |
| `FINANCE_IMAP_USER`                | Yes      | IMAP login. Falls back to `SMTP_USER`.                      |
| `FINANCE_IMAP_PASSWORD`            | Yes      | IMAP password. Falls back to `SMTP_PASSWORD`.               |
| `FINANCE_IMAP_HOST`                | No       | Default `imap.gmail.com`.                                   |
| `FINANCE_IMAP_PORT`                | No       | Default `993`.                                              |
| `CASHBOOK_ENABLED`                 | No       | `1`/`true` to expose Cashbook tab. Default off.             |
| `BANK_FEED_IDLE`                   | No       | `1`/`true` for IMAP IDLE mode. Default off (uses polling).  |
| `BANK_FEED_POLL_MS`                | No       | Polling interval in ms. Default `300000` (5 min).           |

DB-backed config (`emailAutomationSettings` table, `purpose: "finance"`)
overrides env vars when present.

---

## Operational runbook

- **No transactions arriving:**
  1. `pm2 logs square15management | grep BankFeed` — look for IDLE/poll
     start lines.
  2. Verify the inbox actually contains UNSEEN bank emails for the period.
  3. If IDLE mode: restart PM2 to force reconnect. (Auto-reconnect should
     handle this, but a manual restart is the fastest fix.)

- **Duplicates appearing:**
  - Should be impossible — `transactionHash` is `UNIQUE`. If it happens, a
    parser is producing inconsistent fields. Check `BankTransaction.rawDescription`
    for the offending rows and fix the parser in `emailParsers.ts`.

- **Disable the live tab quickly:** set `CASHBOOK_ENABLED=` (empty) and
  restart PM2. The admin Bank Feed page is unaffected.

- **Disable IDLE quickly:** set `BANK_FEED_IDLE=` (empty) and restart PM2;
  the 5-min poller takes over with no schema or UI change.

---

## Known limitations

1. Bank coverage depends on email parsers — a bank that changes its
   notification format silently breaks until a parser is updated.
2. Single-process event bus (see cluster note above).
3. The SSE endpoint trusts the URL `?token=` query parameter — same model
   as the rest of tRPC. Tokens are short-lived; rotate via the existing
   auth flow.
