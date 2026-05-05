# Bank Feed — Stitch (Direct Nedbank) Integration Design

**Status:** PROPOSAL — awaiting approval before implementation
**Author:** Engineering
**Date:** 2026-05-03
**Replaces (for Nedbank only):** the email-poller path documented in `BANK_FEED_AS_BUILT.md`

---

## 1. Problem

Nedbank does **not** send transactional email notifications. The current bank feed
(`emailPoller.ts` + IMAP IDLE) therefore cannot capture Nedbank movements. Today the
only Nedbank path is **manual CSV upload**, which is too slow for daily cashbook /
real-time reconciliation.

We need a **direct, automated, near real-time** feed from the Nedbank business
account into our existing `BankTransaction` table — without us touching Nedbank's
website, storing customer credentials, or violating their T&Cs.

## 2. Recommendation: Stitch (`stitch.money`)

| Provider | Nedbank Business | Webhooks | SA-resident | Notes |
|---|---|---|---|---|
| **Stitch** ✅ | Supported (LinkPay + Transactions API) | Yes | Yes (JHB) | Most mature, largest SA footprint |
| Mono | Supported (newer) | Yes | Yes | Cheaper but younger product |
| Direct Nedbank API | Yes (API_Marketplace) | Limited | Yes | Requires corporate banking agreement, much heavier onboarding |
| DIY scraper | — | — | — | **Rejected**: T&C breach + credential storage liability |

**Decision:** Stitch. Lowest integration risk and we keep the door open to add FNB,
Standard Bank, ABSA, Capitec to the same connector later.

## 3. How Stitch works (one-paragraph summary)

The user (admin / finance lead) clicks **"Link Bank Account"**. We redirect them to
Stitch's hosted **LinkPay** flow. They log into Nedbank inside Stitch's UI (we never
see credentials), approve consent, and Stitch redirects back with an
`account_id` + long-lived `refresh_token`. We store these on the `BankAccount`
row. Thereafter:

- **Webhook**: Stitch POSTs to our endpoint every time a new transaction posts.
- **Polling cron**: every 15 min we also call `GET /transactions?cursor=…` as a
  belt-and-braces safety net for missed webhooks.
- **Re-consent**: Stitch tokens last 90 days for personal, indefinite for business
  with periodic re-auth — we surface a "re-link" banner in the admin when expired.

## 4. Architecture

```
                ┌────────────────────┐
                │   Nedbank          │
                └──────────┬─────────┘
                           │ (Stitch's secured connection — we don't touch this)
                ┌──────────▼─────────┐
                │   Stitch.money     │
                └─────┬────────┬─────┘
        webhook POST  │        │  GraphQL pull (cron)
                      │        │
              ┌───────▼────────▼────────┐
              │  Square15 backend       │
              │  /api/bank-feed/        │
              │     stitch-webhook/     │
              │  + 15-min cron job      │
              └───────────┬─────────────┘
                          │
                          │  storeBatchTransactions()  ← REUSED, unchanged
                          ▼
              ┌─────────────────────────┐
              │  BankTransaction (DB)   │
              │  + categorisation       │
              │  + reconciliation       │
              │  + bankFeedEvents emit  │  → SSE → Cashbook UI live update
              └─────────────────────────┘
```

**Key principle:** Stitch is *just a new source*. Everything downstream
(`storeBatchTransactions`, `categorizationEngine`, `reconciliationEngine`,
`bankFeedEvents`, SSE, Cashbook tab) is **reused with zero changes**. We only add
an ingestion layer.

## 5. Data model changes

Additive only — no migrations on existing data.

```prisma
model BankAccount {
  // ... existing fields unchanged ...

  // NEW: external aggregator linkage
  externalProvider      String?   // "STITCH" | "MONO" | null
  externalAccountId     String?   // Stitch account UUID
  externalLinkageId     String?   // Stitch user/linkage ID (refresh scope)
  externalRefreshToken  String?   @db.Text  // encrypted at rest (see §8)
  externalAccessToken   String?   @db.Text  // short-lived; cached
  externalTokenExpiry   DateTime?
  externalSyncCursor    String?   // last transaction cursor from Stitch
  externalLastSyncAt    DateTime?
  externalLastError     String?   // surfaced to admin re-link banner
  externalConsentExpiry DateTime? // when user must re-consent

  @@index([externalProvider, externalAccountId])
}

// Add to existing source enum (currently a String):
//   "STITCH_WEBHOOK" | "STITCH_BACKFILL"

model BankFeedWebhookLog {
  id              Int      @id @default(autoincrement())
  receivedAt      DateTime @default(now())
  provider        String   // "STITCH"
  eventType       String   // "transactions.created" etc.
  signatureValid  Boolean
  rawPayload      Json
  processedAt     DateTime?
  error           String?
  bankAccountId   Int?

  @@index([receivedAt])
  @@index([bankAccountId])
}
```

## 6. New files

```
src/server/services/bankFeed/
  stitchClient.ts          ← thin Stitch GraphQL/REST wrapper, token refresh
  stitchConnector.ts       ← link/unlink/backfill/poll orchestration
  stitchWebhook.ts         ← signature verification + event router
  tokenCrypto.ts           ← AES-256-GCM encrypt/decrypt for stored tokens

src/server/bank-feed/
  stitch-webhook-handler.ts  ← HTTP route: POST /api/bank-feed/stitch-webhook/
  stitch-link-callback.ts    ← HTTP route: GET /api/bank-feed/stitch-callback/

src/routes/admin/bank-feed/
  link.tsx                 ← "Link Bank Account" admin page

docs/
  BANK_FEED_STITCH_RUNBOOK.md  ← ops runbook (token rotation, re-consent, debug)
```

Plus:
- `app.config.ts` — register the two new HTTP routers
- `src/server/trpc/handler.ts` — start the 15-min Stitch poll cron (gated by env)
- `src/server/env.ts` — add new vars (see §7)

## 7. Environment variables

```bash
# Stitch — feature flag + credentials
STITCH_ENABLED=1
STITCH_CLIENT_ID=
STITCH_CLIENT_SECRET=
STITCH_REDIRECT_URI=https://www.square15management.co.za/api/bank-feed/stitch-callback
STITCH_WEBHOOK_SECRET=                 # for HMAC verification
STITCH_API_BASE=https://api.stitch.money/graphql
STITCH_AUTH_BASE=https://secure.stitch.money/connect

# Token-at-rest encryption (32-byte hex, generate with: openssl rand -hex 32)
BANK_FEED_TOKEN_ENC_KEY=

# Polling safety net
STITCH_POLL_MS=900000                  # 15 minutes
```

`env.ts` will validate the encryption key length (must be 64 hex chars) and refuse
to start the Stitch connector if `STITCH_ENABLED=1` and any required var missing.

## 8. Security

| Threat | Mitigation |
|---|---|
| Token theft from DB dump | All `external*Token` fields encrypted with AES-256-GCM using `BANK_FEED_TOKEN_ENC_KEY`; key only on server, not in repo |
| Webhook spoofing | Verify Stitch HMAC-SHA256 signature header against `STITCH_WEBHOOK_SECRET`; reject mismatch with 401 + log to `BankFeedWebhookLog` |
| Replay | Reject events with `eventTime` older than 5 min; idempotent insert via existing `transactionHash` unique constraint |
| Open callback redirect | Whitelist redirect URIs server-side; sign + verify a `state` nonce stored in Redis with 10 min TTL |
| Credential exposure in logs | Stitch client redacts `Authorization` and `refresh_token` from all log lines |
| Privilege escalation | Only `ADMIN` role can initiate link/unlink (tRPC `authenticateUser` + role check) |
| Cross-tenant data | `BankAccount.createdById` already scopes ownership; new procedures enforce same check |

OWASP Top 10 mapping: A01 (access control) — role check; A02 (crypto) — AES-GCM;
A07 (auth) — HMAC verify + state nonce; A08 (data integrity) — idempotent hash.

## 9. tRPC procedures (new)

```ts
linkBankAccountStart      // mutation → returns Stitch hosted-link URL + state
linkBankAccountComplete   // mutation → exchange code, store tokens, run backfill
unlinkBankAccount         // mutation → revoke at Stitch, clear external* fields
backfillBankAccount       // mutation → manual re-pull last N days
getBankAccountLinkStatus  // query    → connected? expired? lastSyncAt? lastError?
```

All take `{ token, bankAccountId? }` and validate via `authenticateUser`.

## 10. Rollout plan (change-managed, like the previous phase)

| Stage | Action | Gate |
|---|---|---|
| 0 | Sign up at stitch.money, request Nedbank Business scope | You |
| 1 | Merge code with `STITCH_ENABLED=` (off). Smoke test build. | Auto |
| 2 | Enable on staging account only. Link a single Nedbank test account. Watch webhooks for 48 h. | Eng |
| 3 | Enable in prod for **one** real Nedbank account. Run in **shadow mode** for 7 days: webhooks land in DB, but Cashbook still shows CSV-imported figures. Reconcile by comparing the two sources daily. | Finance lead sign-off |
| 4 | Cut Cashbook to live Stitch feed. Disable CSV imports for that account (still allowed for back-history). | Finance + you |
| 5 | Add remaining Nedbank accounts. | Routine |

Rollback at any stage: `STITCH_ENABLED=` → restart → existing email/CSV paths
unaffected. No data is lost; webhook log retains everything.

## 11. Cost (indicative — confirm at signup)

Stitch SA pricing typically: setup fee + per-linked-account/month + per-API-call.
Order of magnitude for a single business account with daily activity: **low
hundreds of ZAR/month**. Materially cheaper than the staff time currently spent on
manual CSV reconciliation.

## 12. What I will NOT change

- `BankTransaction` schema (only `BankAccount` gets additive cols).
- Existing email poller — stays for any bank that does send notifications.
- Existing CSV import — stays as fallback / back-history loader.
- Cashbook UI, SSE hook, reconciliation engine — all already work; new source
  flows through the same `bankFeedEvents.emitTransaction(...)` call.

## 13. Open questions for you

1. **Stitch account** — do you want to register, or should I prepare a signup
   email template / list of info Stitch will ask for (company reg, FSCA status,
   use-case description)?
2. **Test account** — do you have a Nedbank test/sandbox account, or do we link
   the live account directly into shadow mode (Stage 3)?
3. **Re-consent UX** — when Stitch's consent expires, do you want (a) email the
   admin, (b) in-app banner only, (c) both? Default proposal: both.
4. **Multi-bank scope** — should I design the connector layer generic enough to
   plug Mono in later, or Stitch-only? Default proposal: generic interface,
   Stitch as the first implementation.

## 14. Approval

Reply with **"approved, proceed"** (or "approved with changes: …") and I will
implement in this order:

1. Schema migration (additive)
2. `tokenCrypto.ts` + env vars
3. `stitchClient.ts` + `stitchConnector.ts`
4. Webhook + callback HTTP routes
5. tRPC procedures
6. Admin "Link Bank Account" UI
7. Cron poller
8. Runbook doc
9. Build + local prod smoke test
10. Staged prod rollout per §10

Estimated new code: ~900 LOC across ~10 files. No changes to the 4564-line
`schema.prisma` other than the additive fields in §5.
