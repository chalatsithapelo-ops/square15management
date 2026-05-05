/**
 * Cashbook tRPC procedures.
 *
 * "Cashbook" view of the bank feed for the Management Accounts page. Per
 * change-management plan: this is **strictly read-only**, scoped to a single
 * BankAccount selected by the admin, and never aggregated into the existing
 * accrual revenue/expense roll-ups.
 *
 * - getCashbookSummary: KPI numbers + recent transactions for one account
 *   over a date range. Money in / money out / net / opening / closing.
 * - getReconciliationGaps: diagnostic list of paid invoices with no matching
 *   bank credit, and bank credits with no matched invoice. Used by the
 *   review-queue workflow.
 *
 * Both procedures verify ownership via createdById to avoid cross-tenant
 * leakage.
 */

import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getCashbookSummary = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().int().positive(),
      startDate: z.string(), // ISO date
      endDate: z.string(),   // ISO date
      limit: z.number().int().min(1).max(500).default(100),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Ownership check
    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, createdById: user.id },
      select: {
        id: true,
        accountName: true,
        bankName: true,
        accountNumber: true,
        currency: true,
        isActive: true,
        feedEnabled: true,
        lastFeedCheck: true,
        lastFeedTransactionAt: true,
      },
    });
    if (!account) {
      throw new Error("Bank account not found or not accessible");
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    // Transactions in range
    const [creditAgg, debitAgg, txCount, transactions, openingTx, closingTx] =
      await Promise.all([
        db.bankTransaction.aggregate({
          where: {
            bankAccountId: account.id,
            transactionType: "CREDIT",
            transactionDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
        db.bankTransaction.aggregate({
          where: {
            bankAccountId: account.id,
            transactionType: "DEBIT",
            transactionDate: { gte: start, lte: end },
          },
          _sum: { amount: true },
          _count: true,
        }),
        db.bankTransaction.count({
          where: {
            bankAccountId: account.id,
            transactionDate: { gte: start, lte: end },
          },
        }),
        db.bankTransaction.findMany({
          where: {
            bankAccountId: account.id,
            transactionDate: { gte: start, lte: end },
          },
          include: {
            categorization: {
              select: {
                category: true,
                isConfirmed: true,
                confidence: true,
                linkedEntityType: true,
                linkedEntityId: true,
              },
            },
          },
          orderBy: { transactionDate: "desc" },
          take: input.limit,
        }),
        // Opening balance = last balance before the range start
        db.bankTransaction.findFirst({
          where: {
            bankAccountId: account.id,
            transactionDate: { lt: start },
            balance: { not: null },
          },
          orderBy: { transactionDate: "desc" },
          select: { balance: true, transactionDate: true },
        }),
        // Closing balance = last balance up to range end
        db.bankTransaction.findFirst({
          where: {
            bankAccountId: account.id,
            transactionDate: { lte: end },
            balance: { not: null },
          },
          orderBy: { transactionDate: "desc" },
          select: { balance: true, transactionDate: true },
        }),
      ]);

    const moneyIn = creditAgg._sum.amount || 0;
    const moneyOut = debitAgg._sum.amount || 0;

    // Reconciliation breakdown for the same range
    const [matched, unmatched, pendingReview] = await Promise.all([
      db.bankTransaction.count({
        where: {
          bankAccountId: account.id,
          transactionDate: { gte: start, lte: end },
          reconciliationStatus: "MATCHED",
        },
      }),
      db.bankTransaction.count({
        where: {
          bankAccountId: account.id,
          transactionDate: { gte: start, lte: end },
          reconciliationStatus: "UNMATCHED",
        },
      }),
      db.bankTransaction.count({
        where: {
          bankAccountId: account.id,
          transactionDate: { gte: start, lte: end },
          categorization: { isConfirmed: false },
        },
      }),
    ]);

    return {
      account,
      range: { start: input.startDate, end: input.endDate },
      kpi: {
        moneyIn,
        moneyOut,
        net: moneyIn - moneyOut,
        transactionCount: txCount,
        creditCount: creditAgg._count,
        debitCount: debitAgg._count,
        openingBalance: openingTx?.balance ?? null,
        closingBalance: closingTx?.balance ?? null,
      },
      reconciliation: {
        matched,
        unmatched,
        pendingReview,
      },
      transactions,
    };
  });

export const getReconciliationGaps = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().int().positive(),
      startDate: z.string(),
      endDate: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, createdById: user.id },
      select: { id: true },
    });
    if (!account) {
      throw new Error("Bank account not found or not accessible");
    }

    const start = new Date(input.startDate);
    const end = new Date(input.endDate);

    // Gap A: paid invoices in the period that have no linked bank transaction
    // (could indicate manual marking without underlying bank evidence)
    const paidInvoices = await db.invoice.findMany({
      where: {
        status: "PAID",
        paidDate: { gte: start, lte: end },
      },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        total: true,
        paidDate: true,
      },
      orderBy: { paidDate: "desc" },
      take: 100,
    });

    const linkedInvoiceIds = new Set(
      (
        await db.bankTransaction.findMany({
          where: {
            bankAccountId: account.id,
            linkedInvoiceId: { in: paidInvoices.map((i) => i.id) },
          },
          select: { linkedInvoiceId: true },
        })
      )
        .map((t) => t.linkedInvoiceId)
        .filter((id): id is number => id !== null)
    );

    const paidWithoutBankTx = paidInvoices.filter(
      (i) => !linkedInvoiceIds.has(i.id)
    );

    // Gap B: bank credits in the period not matched to any invoice
    const unmatchedCredits = await db.bankTransaction.findMany({
      where: {
        bankAccountId: account.id,
        transactionType: "CREDIT",
        transactionDate: { gte: start, lte: end },
        reconciliationStatus: "UNMATCHED",
      },
      select: {
        id: true,
        transactionDate: true,
        amount: true,
        description: true,
        reference: true,
      },
      orderBy: { transactionDate: "desc" },
      take: 100,
    });

    return {
      paidInvoicesWithoutBankTx: paidWithoutBankTx,
      unmatchedBankCredits: unmatchedCredits,
    };
  });
