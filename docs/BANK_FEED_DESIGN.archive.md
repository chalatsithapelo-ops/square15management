# [ARCHIVED] Bank Feed & Auto-Reconciliation — Original Design Draft

> ⚠️ **THIS DOCUMENT IS ARCHIVED AND OUT OF DATE.**
>
> The bank feed has been built and is in production. The actual schema,
> services, and UI differ from this draft. For accurate, current information
> see:
>
> - [docs/BANK_FEED_AS_BUILT.md](BANK_FEED_AS_BUILT.md) — what is actually
>   running today
> - [docs/STAFF_CASHBOOK_GUIDE.md](STAFF_CASHBOOK_GUIDE.md) — staff-facing
>   cheatsheet
>
> Kept for historical context only — do not rely on it for implementation
> decisions.

---

# Bank Feed & Auto-Reconciliation — Design for Review (original draft)

> Status: **Draft — pending sign-off before implementation**
> Owner: Engineering
> Goal: Real-time, fully automated reconciliation of incoming bank transactions
> across **FNB, ABSA, Nedbank, Capitec Business** to invoices, orders, expenses,
> and journal entries — without manual intervention.

---

## 1. Honest reality check (read first)

There is **no single API** that gives you real-time transaction feeds for all
four of these banks. Here is what is actually available in South Africa as of
2026:

| Bank | Real-time programmatic access | Notes |
|---|---|---|
| **FNB** | ✅ Yes — *FNB API Marketplace* (paid, app registration required) | Mature; supports balance + transactions on Business accounts |
| **Investec** | ✅ Yes — *Programmable Banking* (free for clients) | Best-in-class; not on your list |
| **Standard Bank** | ⚠️ Partial — Open Banking pilot, mostly partners | Not on your list |
| **ABSA** | ❌ No public API | Only via aggregators (Stitch, Truid, Mono) using user-consent screen-scraping |
| **Nedbank** | ❌ No public API | Same — aggregator only |
| **Capitec Business** | ❌ No public API | Aggregator only; coverage is patchy |

**Conclusion**: If we want automation across all four, we have **two viable paths**:

### Path 1 — Build directly per bank (NOT RECOMMENDED)
- FNB: use their official API.
- ABSA / Nedbank / Capitec: build our own scrapers against the internet-banking
  websites.
- **Problems**: scrapers break every time a bank updates its UI; storing
  customer banking passwords is a serious compliance/POPIA exposure;
  multi-factor auth (Capitec OTPs, ABSA SureCheck) requires a human in the loop
  on every sign-in. **This will not be reliably hands-off.**

### Path 2 — Use an aggregator (RECOMMENDED) + FNB direct
- Use **Stitch Money** (or **Truid** / **Mono**) as the bank-feed provider for
  ABSA / Nedbank / Capitec. They have already done the hard regulatory and
  scraping work, handle MFA via push, and sign linking-data agreements with the
  banks.
- Use **FNB API direct** for FNB (cheaper, more reliable, no aggregator fee).
- **One internal abstraction layer** so the rest of our system doesn't care
  which provider a transaction came from.

This is, ironically, the best way to "build our own Stitch" — by treating Stitch
(and friends) as a swappable backend behind our own normalised feed schema. If
later we want to swap to a different provider, only the adapter changes.

> ⚠️ **Decision required from you**: Do we proceed with Path 2? It involves
> ~R per-account/month aggregator fees and a one-time merchant onboarding with
> Stitch (~1–2 weeks of paperwork). If you'd rather keep costs zero and accept
> a "near-real-time" experience based on **forwarded bank notification SMS/email
> parsing + nightly CSV ingest**, say so and I'll re-scope.

---

## 2. Architecture (assuming Path 2)

```
┌─────────────────────────────────────────────────────────────────────┐
│                       SQR15 Prop Management                          │
│                                                                       │
│  ┌──────────────┐   ┌────────────────┐   ┌─────────────────────┐    │
│  │ Bank Feed    │──▶│ Reconciliation │──▶│ Invoices / Orders / │    │
│  │ Adapters     │   │ Engine         │   │ Expenses / Journal  │    │
│  └──────────────┘   └────────────────┘   └─────────────────────┘    │
│         ▲                   ▲                                        │
└─────────┼───────────────────┼────────────────────────────────────────┘
          │                   │
          │ (webhooks)        │ (review queue UI)
          │                   │
┌─────────┴────────┐  ┌───────┴──────┐
│ FNB API direct   │  │ Admin user   │
│ Stitch (Truid)   │  │ approves     │
│ for other banks  │  │ ambiguous    │
└──────────────────┘  └──────────────┘
```

### Key components
1. **Bank Feed Adapters** — one provider-specific module per source. They all
   normalise into the same internal `BankTransaction` shape.
2. **Webhook Receiver** — `/api/bank-feeds/webhook/:provider` accepts pushed
   transactions in real time and writes them to the DB.
3. **Reconciliation Engine** — runs on every new transaction; matches against
   open invoices/orders using the rules below; auto-applies high-confidence
   matches; queues ambiguous ones for admin review.
4. **Cashbook View** — read-only ledger of every bank transaction across all
   linked accounts, filterable by account, status, and matched-entity.
5. **Auto-Posting** — when a match is confirmed (auto or manual), the system
   marks the invoice paid, creates a `Payment` row, and posts the corresponding
   journal entries.

---

## 3. Database schema (additive — no breaking changes)

```prisma
// prisma/schema.prisma additions

model BankAccount {
  id                Int       @id @default(autoincrement())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  ownerUserId       Int       // pmCompany owner — admin who linked this account
  owner             User      @relation(fields: [ownerUserId], references: [id])

  bankName          String    // "FNB" | "ABSA" | "NEDBANK" | "CAPITEC"
  accountNumber     String    // last-4 only stored verbatim; full number encrypted
  accountNumberEnc  String    // AES-256-GCM ciphertext
  accountHolder     String
  accountType       String    // "CHEQUE" | "BUSINESS" | "SAVINGS"

  provider          String    // "FNB_API" | "STITCH" | "TRUID" | "MANUAL_CSV"
  providerLinkId    String?   // external linkage id from aggregator
  providerStatus    String    @default("PENDING") // PENDING | ACTIVE | EXPIRED | REVOKED
  lastSyncedAt      DateTime?
  syncCursor        String?   // provider-specific pagination cursor
  isActive          Boolean   @default(true)

  transactions      BankTransaction[]

  @@index([ownerUserId])
  @@index([provider, providerLinkId])
}

model BankTransaction {
  id                Int       @id @default(autoincrement())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  bankAccountId     Int
  bankAccount       BankAccount @relation(fields: [bankAccountId], references: [id])

  // Normalised fields (provider-agnostic)
  externalId        String    // provider's transaction id
  postedAt          DateTime  // value date
  amountCents       Int       // signed: positive = credit (money in)
  currency          String    @default("ZAR")
  description       String    // raw description from bank
  reference         String?   // EFT reference field (most useful for matching)
  counterpartyName  String?   // payer name if available
  balanceAfterCents Int?
  rawJson           Json      // full provider payload for audit / replay

  // Reconciliation state
  status            String    @default("UNMATCHED")
                              // UNMATCHED | AUTO_MATCHED | MANUAL_MATCHED |
                              // SUGGESTED | IGNORED | DUPLICATE
  matchedInvoiceId  Int?
  matchedOrderId    Int?
  matchedExpenseId  Int?
  matchConfidence   Float?    // 0.0 - 1.0
  matchReason       String?   // human-readable explanation
  reviewedByUserId  Int?
  reviewedAt        DateTime?

  @@unique([bankAccountId, externalId]) // idempotency on webhook re-delivery
  @@index([status, postedAt])
  @@index([matchedInvoiceId])
}

model BankFeedSyncLog {
  id              Int      @id @default(autoincrement())
  createdAt       DateTime @default(now())
  bankAccountId   Int
  provider        String
  trigger         String   // "WEBHOOK" | "POLL" | "BACKFILL"
  txCount         Int      @default(0)
  status          String   // "OK" | "ERROR"
  errorMessage    String?
  durationMs      Int?
}

model ReconciliationRule {
  id           Int      @id @default(autoincrement())
  createdAt    DateTime @default(now())
  ownerUserId  Int      // pmCompany scope
  priority     Int      @default(100)
  enabled      Boolean  @default(true)
  // e.g. "if reference matches /^INV-\d+$/ and amount equals invoice.balance → auto-match"
  matchType    String   // "REFERENCE_INVOICE" | "REFERENCE_ORDER" | "AMOUNT_AND_NAME" | "CUSTOM"
  config       Json     // rule-specific config (regex, fuzzy threshold, etc.)
}
```

---

## 4. Reconciliation matching rules (in priority order)

For every incoming **credit** (money in) transaction:

1. **Exact reference → invoice number**
   `reference` matches `INV-\d+` *and* unpaid invoice with that number exists
   *and* `amountCents == invoice.outstandingCents` → **auto-match**
   (confidence 1.0).
2. **Exact reference → order number**
   Same logic against `ORD-\d+`.
3. **Exact reference → quotation number** (treat as deposit on the converted invoice).
4. **Amount-only match against single open invoice**
   Exactly one open invoice exists with `outstandingCents == amountCents` and
   `counterpartyName` fuzzy-matches the customer's name (>=80% similarity)
   → **auto-match** (confidence 0.85).
5. **Suggest** all open invoices within ±R5.00 to admin review queue
   (confidence < 0.85). Admin clicks "Apply" to confirm.
6. **No candidates** → leaves status `UNMATCHED`. Admin can manually link later.

For **debits** (money out): tries to match against open `Expense` records by
amount + supplier name; if no match, queues as "Uncategorised expense" for
admin to assign a category.

All auto-matches generate the same `Payment` records and journal entries that
manual entry creates today, so downstream reports are unaffected.

---

## 5. New tRPC procedures (planned)

```
bankFeeds.linkAccount         // start OAuth/consent flow with provider
bankFeeds.completeLink        // finish flow; receive providerLinkId
bankFeeds.listAccounts        // for the linked-accounts admin page
bankFeeds.unlinkAccount       // revoke + soft-delete
bankFeeds.syncNow             // manual refresh button (calls provider /sync)
bankTransactions.list         // cashbook view with filters
bankTransactions.applyMatch   // admin confirms a SUGGESTED match
bankTransactions.unmatch      // undo a match (creates audit trail)
bankTransactions.ignore       // mark a transaction as not relevant
reconciliation.suggestionsForInvoice(invoiceId)   // reverse lookup
```

Plus the public webhook endpoint:
```
POST /api/bank-feeds/webhook/:provider
```
with HMAC signature verification per provider.

---

## 6. Security & compliance

- **Provider credentials** (Stitch client secret, FNB API key) live in
  `.env` only — never in DB.
- **Account numbers** stored AES-256-GCM-encrypted; UI shows last 4 only.
- **No customer banking passwords** are ever stored — that's the whole point of
  the aggregator path.
- **Webhook endpoint** validates HMAC signatures and rejects replay attacks
  (timestamp window + idempotency on `(bankAccountId, externalId)`).
- **POPIA**: bank transaction data is "personal information"; we add a data
  retention policy (purge `rawJson` after 13 months) and an audit table for
  every read by admin users.
- **Access control**: only `ADMIN` and `SENIOR_ADMIN` see the cashbook;
  `JUNIOR_ADMIN` sees only their own assigned matches.

---

## 7. Phased rollout (proposed)

| Phase | Scope | Estimated build size |
|---|---|---|
| **0** | Schema + migrations + adapter interface (no UI yet) | Small |
| **1** | FNB adapter via FNB API + cashbook UI + matching engine + auto-post payments | Medium |
| **2** | Stitch adapter for ABSA / Nedbank / Capitec | Medium |
| **3** | Admin review queue UI for SUGGESTED matches | Small |
| **4** | Expense matching + uncategorised-expense workflow | Small |
| **5** | Reconciliation rules editor (custom rules per pmCompany) | Optional / later |

Each phase is independently deployable; nothing in Phase 0–1 depends on Phase 2.

---

## 8. Decisions needed from you before I write code

1. **Path 2 confirmed** (use aggregator + FNB direct), or do you want me to
   re-scope to a no-cost "near real-time" approach (forwarded SMS/email
   notifications + nightly CSV import)?
2. **Aggregator choice**: Stitch Money is the most mature in SA but the most
   expensive. Truid and Mono are cheaper. Want me to compile a feature/price
   comparison?
3. **Who owns the bank-account link** — your single super-admin (one set of
   accounts visible to the whole system), or each PM-Company-Admin links their
   own accounts (multi-tenant)?
4. **Auto-post threshold**: do you want auto-matching to actually mark invoices
   paid + create journal entries automatically (true hands-off), or only
   *suggest* and require one click? I recommend auto-post at confidence ≥ 0.95
   and suggest below.
5. **Backfill window**: how far back should we import historical transactions
   on first link? (Default proposal: 90 days.)

Once you answer these, I'll start with Phase 0 (schema + migration + adapter
interface) so we have the foundation in place, then proceed to Phase 1.
