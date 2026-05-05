# Bank Feed — Stitch Direct Connector (Runbook)

**Status:** Phase 2 — Direct bank integration (Nedbank and other SA banks via Stitch.money)
**Audience:** Operators, on-call admins
**Last updated:** December 2025

---

## 1. What this is

Phase 2 adds **direct bank → system** transaction sync using [Stitch.money](https://stitch.money),
a regulated SA Open Banking aggregator. Used because Nedbank does not send transaction
notification emails (which Phase 1 relied on for FNB / Capitec / Standard Bank).

**Provider-agnostic design.** The connector talks to a `BankFeedProvider` interface, so
swapping/adding **Mono** or another aggregator later is a single-file implementation.
See `src/server/services/bankFeed/providerInterface.ts`.

---

## 2. Architecture

```
┌─────────────┐  HTTPS+HMAC   ┌──────────────────────┐
│  Stitch     ├──────────────▶│ /api/bank-feed/      │
│  webhook    │   (pushes)    │ stitch-webhook       │
└─────────────┘               └──────────┬───────────┘
                                         │
┌─────────────┐  GraphQL      ┌──────────▼───────────┐    ┌──────────────────┐
│  Stitch     │◀──────────────┤ providerConnector    │───▶│ BankTransaction  │
│  GraphQL    │   (poll/sync) │ (dedup + persist)    │    │ table (existing) │
└─────────────┘               └──────────┬───────────┘    └────────┬─────────┘
                                         │                         │
                              ┌──────────▼───────────┐    ┌────────▼─────────┐
                              │ bankFeedEvents (SSE) │───▶│ Cashbook UI live │
                              └──────────────────────┘    └──────────────────┘
```

Two ingestion paths, **both deduplicated** via the same `createTransactionHash`:

| Path     | Trigger                                       | Source string written       |
| -------- | --------------------------------------------- | --------------------------- |
| Webhook  | Stitch → us, near-real-time                   | `STITCH_WEBHOOK`            |
| Poll     | Cron every `STITCH_POLL_MS` (default 15 min)  | `STITCH_POLL`               |
| Backfill | Manual "Sync N days" button or post-link 90d  | `STITCH_BACKFILL`           |

The webhook is the primary signal; the poll is a safety net for missed events.

---

## 3. One-time setup

### 3.1 Generate the token-encryption key

```bash
openssl rand -hex 32
```

Add to `.env`:

```
BANK_FEED_TOKEN_ENC_KEY=<64-hex-char string from above>
```

> **Critical:** This key encrypts every aggregator refresh token at rest (AES-256-GCM).
> If you lose it, all linked accounts must be re-linked. If you rotate it, all stored
> tokens become unreadable — plan a re-consent campaign before rotating.

### 3.2 Create a Stitch sandbox + production app

1. Sign up at <https://stitch.money>.
2. In the Stitch dashboard create an OAuth client. You will get:
   - `STITCH_CLIENT_ID`
   - `STITCH_CLIENT_SECRET`
3. Configure **redirect URI**: `https://www.square15management.co.za/api/bank-feed/stitch-callback`
4. Configure **webhook URL**: `https://www.square15management.co.za/api/bank-feed/stitch-webhook`
5. Generate a **webhook signing secret** in the Stitch dashboard → `STITCH_WEBHOOK_SECRET`.

### 3.3 Add env vars

```
# Phase 2 — Stitch direct bank feed
STITCH_ENABLED=1
STITCH_CLIENT_ID=<from-stitch-dashboard>
STITCH_CLIENT_SECRET=<from-stitch-dashboard>
STITCH_WEBHOOK_SECRET=<from-stitch-dashboard>
STITCH_REDIRECT_URI=https://www.square15management.co.za/api/bank-feed/stitch-callback
STITCH_API_BASE=https://api.stitch.money/graphql
STITCH_AUTH_BASE=https://secure.stitch.money/connect
STITCH_POLL_MS=900000
BANK_FEED_TOKEN_ENC_KEY=<see 3.1>
```

> **Local dev:** keep `STITCH_ENABLED=` (empty/unset). The poller and link UI
> degrade gracefully — admins see a helpful error when starting the link flow.

### 3.4 DB migration

The schema additions are **additive only** (10 nullable cols on `BankAccount` +
new `BankFeedWebhookLog` table). Already applied in this codebase via:

```bash
pnpm prisma db push --skip-generate
pnpm prisma generate
```

For prod use a proper migration:

```bash
pnpm prisma migrate dev --name add_bank_feed_external_link
pnpm prisma migrate deploy   # in production
```

---

## 4. Linking a bank account (operator flow)

1. Go to `/admin/bank-feed`.
2. Click **Link Direct Feed** in the header → `/admin/bank-feed/link`.
3. Find the existing BankAccount row, click **Link with Stitch**.
4. Browser redirects to Stitch's hosted login.
5. Operator selects bank (e.g. Nedbank), logs in **on the bank's site**, approves
   read-only consent.
6. Stitch redirects back to `/api/bank-feed/stitch-callback?code=…&state=…`.
7. Server exchanges the code for tokens, encrypts the refresh token with
   `BANK_FEED_TOKEN_ENC_KEY`, kicks off a 90-day backfill, and redirects to
   `/admin/bank-feed/link?status=linked`.
8. Done. New transactions arrive via webhook within seconds.

---

## 5. Day-to-day operations

### 5.1 Verify a webhook landed

```sql
SELECT id, "receivedAt", provider, "eventType", "signatureValid", "processedAt", error
FROM "BankFeedWebhookLog"
ORDER BY "receivedAt" DESC
LIMIT 20;
```

`signatureValid = false` → check `STITCH_WEBHOOK_SECRET` matches Stitch dashboard.

### 5.2 Force a manual sync

In the UI: **/admin/bank-feed/link** → row → **Sync 30d** button.
Or via tRPC: `backfillBankAccountFeed({ token, bankAccountId, sinceDays: 30 })`.

### 5.3 Token / consent expired

Most SA banks require **re-consent every 90 days** (regulatory requirement).
The link page shows an amber **"Re-consent needed"** badge when
`externalConsentExpiry < now`. Operator clicks **Link with Stitch** again on the
same row — Stitch reuses the existing linkage and just refreshes consent.

### 5.4 Rotate webhook secret

1. Stitch dashboard → generate new webhook secret.
2. Update `.env` → `STITCH_WEBHOOK_SECRET=<new>`.
3. PM2 reload (or restart server). Old in-flight webhooks signed with the previous
   secret will return 401 and be retried by Stitch with the new secret.

### 5.5 Rotate `BANK_FEED_TOKEN_ENC_KEY`

**Destructive operation.** Existing stored tokens become unreadable. Procedure:

1. Notify all admins they will need to re-link.
2. `UPDATE "BankAccount" SET "externalAccessToken"=NULL, "externalRefreshToken"=NULL, "externalProvider"=NULL`.
3. Set new `BANK_FEED_TOKEN_ENC_KEY` and restart.
4. Each admin re-links their accounts via the UI.

---

## 6. Disable / rollback

To turn off the direct feed without uninstalling anything:

```
STITCH_ENABLED=
```

Restart server. Effects:
- Poller does not start.
- Link button still visible but the start mutation throws "not enabled".
- Webhook endpoint still receives & logs payloads (signature still verified) but they
  will arrive only if Stitch is still configured to send them.
- Phase 1 (email + CSV + manual) continues unaffected.

To **completely remove** Phase 2: delete the connector files, drop the new schema
columns and `BankFeedWebhookLog` table. The existing `BankTransaction` data and
Phase 1 pipeline are entirely independent and survive untouched.

---

## 7. Troubleshooting

| Symptom                                    | Likely cause                                                  | Fix                                                                                       |
| ------------------------------------------ | ------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `signatureValid=false` on every webhook    | Wrong `STITCH_WEBHOOK_SECRET`                                 | Copy from Stitch dashboard, restart                                                       |
| Webhook returns 401, no row in log         | Reverse proxy stripping body                                  | Confirm Nginx passes raw body unmodified (`proxy_request_buffering off` not required)     |
| Link button → "not configured"             | `STITCH_CLIENT_ID` or `BANK_FEED_TOKEN_ENC_KEY` missing       | Set env, restart                                                                          |
| Backfill returns 0 transactions            | Account has none in window, or wrong external account         | Check `BankAccount.externalAccountId` matches Stitch's account id                         |
| Tokens marked expired but never refreshed  | Refresh token revoked by user / bank                          | UI shows "Re-consent needed" — operator re-links                                          |
| Duplicate transactions appear              | `createTransactionHash` collision unlikely; check for         | a) Two BankAccounts with same externalAccountId b) Manual + automated import of same data |
| Poller log shows "missing key"             | `BANK_FEED_TOKEN_ENC_KEY` unset                               | Generate (`openssl rand -hex 32`) and set                                                 |

### Useful queries

```sql
-- All linked accounts
SELECT id, "accountName", "externalProvider", "externalAccountId",
       "externalLastSyncAt", "externalLastError"
FROM "BankAccount"
WHERE "externalProvider" IS NOT NULL;

-- Transactions ingested by Stitch in last 24h
SELECT source, COUNT(*) FROM "BankTransaction"
WHERE "transactionDate" > NOW() - INTERVAL '24 hours'
  AND source LIKE 'STITCH%'
GROUP BY source;

-- Failed webhooks last 7 days
SELECT * FROM "BankFeedWebhookLog"
WHERE "receivedAt" > NOW() - INTERVAL '7 days'
  AND ("signatureValid" = false OR error IS NOT NULL)
ORDER BY "receivedAt" DESC;
```

---

## 8. Adding a second provider (Mono, Truelayer-SA, etc.)

1. Create `src/server/services/bankFeed/monoClient.ts` exporting
   `monoProvider: BankFeedProvider`.
2. Add the new provider to the `BankFeedProviderId` union and the `getProvider()`
   switch in `providerConnector.ts`.
3. Add `MONO_*` env vars to `src/server/env.ts`.
4. Add a router entry for the Mono webhook in `app.config.ts` and a thin
   `mono-webhook-handler.ts` that delegates to `ingestProviderTransactions` —
   identical pattern to Stitch.
5. The link UI accepts a `provider` argument already; expose a chooser per row.

No changes needed in the dedup, persistence, SSE, reconciliation or Cashbook
layers — that's the point of the interface.

---

## 9. Security notes

- Refresh tokens are encrypted with AES-256-GCM before being written to Postgres.
  Even with a DB dump an attacker would also need `BANK_FEED_TOKEN_ENC_KEY`.
- Webhook signature is HMAC-SHA256, constant-time compared.
- OAuth `state` is HMAC-signed and self-contained (10 min TTL) — no Redis needed.
- Tokens are **never** returned by any tRPC procedure.
- Only `ADMIN` role can start a link / unlink / backfill (ownership-checked
  against `BankAccount.createdById`).
- All webhook payloads (valid AND invalid) are logged to `BankFeedWebhookLog`
  for forensic audit.
