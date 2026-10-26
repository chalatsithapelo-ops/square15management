/**
 * getNedbankAccountSummary — returns live balance, statement history,
 * and derived recurring-debit patterns for a Nedbank-linked BankAccount.
 *
 * Read-only. Admin only.
 */

import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getNedbankAccountSummary = baseProcedure
  .input(z.object({ token: z.string(), bankAccountId: z.number().int() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin role required");

    const acct = await db.bankAccount.findUnique({
      where: { id: input.bankAccountId },
      select: {
        id: true,
        accountName: true,
        accountNumber: true,
        bankName: true,
        externalAccountId: true,
        externalProvider: true,
        currentBalance: true,
        availableBalance: true,
        balanceCurrency: true,
        balanceType: true,
        balanceIndicator: true,
        balanceAsOf: true,
        balanceCapturedAt: true,
        externalLastSyncAt: true,
        externalLastError: true,
      },
    });
    if (!acct) throw new Error("Bank account not found");

    const statements = await db.bankAccountStatement.findMany({
      where: { bankAccountId: input.bankAccountId },
      orderBy: { startDateTime: "desc" },
      take: 24,
    });

    // Derive "recurring debit" patterns from ingested transactions.
    // Signal: >= 2 debits with the same normalized description in the last 120 days.
    const since = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000);
    const debits = await db.bankTransaction.findMany({
      where: {
        bankAccountId: input.bankAccountId,
        transactionType: "DEBIT",
        transactionDate: { gte: since },
      },
      select: { description: true, amount: true, transactionDate: true },
      orderBy: { transactionDate: "desc" },
    });
    const buckets = new Map<string, { key: string; description: string; occurrences: number; lastDate: Date; lastAmount: number; totalAmount: number }>();
    for (const d of debits) {
      const key = normalizeDescription(d.description);
      const b = buckets.get(key);
      if (b) {
        b.occurrences += 1;
        b.totalAmount += d.amount;
        if (d.transactionDate > b.lastDate) { b.lastDate = d.transactionDate; b.lastAmount = d.amount; }
      } else {
        buckets.set(key, { key, description: d.description, occurrences: 1, lastDate: d.transactionDate, lastAmount: d.amount, totalAmount: d.amount });
      }
    }
    const recurringDebits = Array.from(buckets.values())
      .filter((b) => b.occurrences >= 2)
      .sort((a, b) => b.occurrences - a.occurrences || b.lastAmount - a.lastAmount)
      .slice(0, 20)
      .map((b) => ({
        description: b.description,
        occurrences: b.occurrences,
        lastAmount: b.lastAmount,
        averageAmount: Math.round((b.totalAmount / b.occurrences) * 100) / 100,
        lastDate: b.lastDate,
      }));

    return {
      account: acct,
      statements,
      recurringDebits,
    };
  });

function normalizeDescription(d: string): string {
  return d
    .replace(/\d+/g, "#")
    .replace(/[^a-z#\s]/gi, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}
