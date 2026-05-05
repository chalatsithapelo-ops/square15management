# Cashbook (Live Bank Feed) — Staff Cheatsheet

**Audience:** Finance, admin, and management users who view the Management
Accounts page or the Bank Feed admin page.

**Purpose:** A one-page reference so you understand what changed when the
Cashbook tab appeared, why the numbers may differ from the existing P&L, and
what to do when something looks "off".

---

## 1. What is new

A new tab labelled **Cashbook (Live)** is now visible on the **Management
Accounts** page (admins only, gated behind the `CASHBOOK_ENABLED` feature
flag).

It shows:

- Money In, Money Out, Net Cash Movement, Transaction Count
- Opening balance (last balance before the start date)
- Closing balance (last balance in the period)
- Recent transactions for **one selected bank account** at a time
- Reconciliation gaps (paid invoices with no bank credit; unmatched bank
  credits)

A **bank account selector** at the top lets you switch between accounts.
Numbers refresh **automatically** when new bank notification emails arrive
(typically within 1–5 minutes).

---

## 2. Cash vs Accrual — why these numbers differ from the P&L

The existing **P&L / Revenue / Expenses** tabs use **accrual** accounting:

- Revenue is recognised when an **invoice is issued or paid** (whichever
  rule the report uses).
- Expenses are recognised when an **operational expense or payment request
  is approved**.

The new **Cashbook** tab uses **cash basis** accounting:

- Money In = cash that actually arrived in the bank account.
- Money Out = cash that actually left the bank account.

> **They will not always match — and that is correct.** Examples:
>
> - You issued an invoice for R10 000 today → P&L Revenue +R10 000, Cashbook
>   shows nothing yet.
> - The customer pays tomorrow → Cashbook shows +R10 000, P&L Revenue is
>   unchanged.
> - You approved a R3 000 expense but haven't paid the supplier yet → P&L
>   Expenses +R3 000, Cashbook shows nothing yet.
>
> Cash and accrual numbers are **never added together**. If you see them in
> the same dashboard, treat them as two independent lenses on the same
> business.

The amber banner at the top of the Cashbook tab is a permanent reminder of
this. Please leave it visible.

---

## 3. Reconciliation status — what each badge means

Every bank transaction has one of these statuses:

| Status                | Meaning                                                                 |
| --------------------- | ----------------------------------------------------------------------- |
| **MATCHED**           | Linked to one invoice / expense / payment request.                      |
| **PARTIALLY_MATCHED** | Linked but the amounts differ (e.g. partial payment).                   |
| **UNMATCHED**         | We received the money but cannot find the source invoice/expense.       |
| **DISPUTED**          | A user flagged it for follow-up.                                        |
| **IGNORED**           | Bank fees, transfers between own accounts, anything we deliberately skip.|

**Do not delete unmatched transactions.** Use the **Review** workflow on
the Bank Feed admin page (`/admin/bank-feed`) to confirm or recategorise
them. Once confirmed, they will appear as MATCHED in the Cashbook view.

---

## 4. Daily routine

1. **Morning:** open Bank Feed → Review tab. Clear yesterday's unmatched
   credits by linking them to invoices.
2. **During the day:** the Cashbook tab on Management Accounts updates by
   itself. No manual refresh needed.
3. **End of week:** check the **Reconciliation Gaps** panel at the bottom
   of the Cashbook tab:
   - "Paid invoices with no bank credit" → check if the invoice was really
     paid; ask the customer if there's no proof.
   - "Unmatched bank credits" → match them to an invoice or recategorise.

---

## 5. Frequently asked

**Q: Why is the closing balance different from my actual bank balance on
the FNB app?**
A: We rely on bank notification emails. If a notification was missed (e.g.
spam folder, bank outage), one transaction can be missing. Use the **Import
CSV** workflow on the Bank Feed admin page to backfill from a downloaded
statement; duplicates are detected automatically.

**Q: Can I edit a bank transaction?**
A: No. Bank transactions are an immutable record of what happened in your
bank account. You can change the **categorisation** and **link** them to
invoices, but the date / amount / description are read-only.

**Q: A transaction shows up twice. What do I do?**
A: It shouldn't — we deduplicate by SHA256 hash of date + amount +
description + balance. If you genuinely see a duplicate, raise it with IT
so we can review the parser for that bank.

**Q: Will customers / suppliers see this?**
A: No. The Cashbook tab and Bank Feed admin page are admin-only. Customers
continue to see only their invoices.

---

## 6. Who to call

- **Categorisation question:** Finance lead.
- **Missing transactions / parser issue:** IT.
- **Permissions / access denied on the Cashbook tab:** IT — confirm your
  role is `ADMIN` and the `CASHBOOK_ENABLED` feature flag is on.

---

_Last updated when the live Cashbook went live._
