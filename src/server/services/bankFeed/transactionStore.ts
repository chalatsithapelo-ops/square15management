/**
 * Transaction storage — deduplication and persistence layer.
 */

import { createHash } from "crypto";
import { db } from "~/server/db";

export interface StoreTransactionInput {
  bankAccountId: number;
  transactionDate: Date;
  description: string;
  amount: number;
  transactionType: "DEBIT" | "CREDIT";
  balance?: number;
  reference?: string;
  rawDescription?: string;
  transactionHash: string;
  source: string;
  importBatchId?: number;
}

/**
 * Create a SHA-256 hash for deduplication.
 * Uses date + amount + description + balance to create a unique fingerprint.
 */
export function createTransactionHash(
  date: Date,
  amount: number,
  description: string,
  balance?: number
): string {
  const dateStr = date.toISOString().split("T")[0]; // YYYY-MM-DD
  const payload = `${dateStr}|${amount.toFixed(2)}|${description.trim().toLowerCase()}|${balance?.toFixed(2) || ""}`;
  return createHash("sha256").update(payload).digest("hex");
}

/**
 * Store a single transaction in the database. Returns the created record.
 */
export async function storeTransaction(input: StoreTransactionInput) {
  return db.bankTransaction.create({
    data: {
      bankAccountId: input.bankAccountId,
      transactionDate: input.transactionDate,
      description: input.description,
      amount: input.amount,
      transactionType: input.transactionType,
      balance: input.balance,
      reference: input.reference,
      rawDescription: input.rawDescription,
      transactionHash: input.transactionHash,
      source: input.source,
      importBatchId: input.importBatchId,
    },
  });
}

/**
 * Store multiple transactions from a CSV import.
 * Returns counts of new, duplicate, and errors.
 */
export async function storeBatchTransactions(
  bankAccountId: number,
  transactions: Array<{
    date: Date;
    amount: number;
    transactionType: "DEBIT" | "CREDIT";
    description: string;
    balance?: number;
    reference?: string;
  }>,
  importBatchId: number,
  source: string = "CSV"
): Promise<{ newCount: number; duplicateCount: number; errors: string[] }> {
  let newCount = 0;
  let duplicateCount = 0;
  const errors: string[] = [];

  for (const tx of transactions) {
    try {
      const hash = createTransactionHash(tx.date, tx.amount, tx.description, tx.balance);

      const existing = await db.bankTransaction.findUnique({
        where: { transactionHash: hash },
      });

      if (existing) {
        duplicateCount++;
        continue;
      }

      await storeTransaction({
        bankAccountId,
        transactionDate: tx.date,
        description: tx.description,
        amount: tx.amount,
        transactionType: tx.transactionType,
        balance: tx.balance,
        reference: tx.reference,
        transactionHash: hash,
        source,
        importBatchId,
      });

      newCount++;
    } catch (err: any) {
      errors.push(`Failed to store transaction: ${err.message}`);
    }
  }

  return { newCount, duplicateCount, errors };
}
