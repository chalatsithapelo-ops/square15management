/**
 * Auto-Reconciliation Engine
 * Matches bank transactions against existing system records:
 * - Invoices (CREDIT → marks invoice as PAID)
 * - Operational Expenses (DEBIT → links to existing expense)
 * - Payment Requests (DEBIT → links to artisan payment)
 * Creates new records for unmatched transactions.
 */

import { db } from "~/server/db";

export interface ReconciliationResult {
  transactionId: number;
  status: "MATCHED" | "PARTIALLY_MATCHED" | "UNMATCHED";
  linkedEntityType?: string;
  linkedEntityId?: number;
  action?: string;
}

/**
 * Run auto-reconciliation on all unmatched transactions for a bank account.
 */
export async function reconcileBankAccount(bankAccountId: number): Promise<{
  matched: number;
  created: number;
  unmatched: number;
}> {
  const transactions = await db.bankTransaction.findMany({
    where: {
      bankAccountId,
      reconciliationStatus: "UNMATCHED",
    },
    include: {
      categorization: true,
    },
    orderBy: { transactionDate: "asc" },
  });

  let matched = 0;
  let created = 0;
  let unmatched = 0;

  for (const tx of transactions) {
    const result = await reconcileTransaction(tx);
    if (result.status === "MATCHED") matched++;
    else if (result.action === "CREATED") created++;
    else unmatched++;
  }

  return { matched, created, unmatched };
}

/**
 * Reconcile a single transaction.
 */
export async function reconcileTransaction(tx: {
  id: number;
  transactionDate: Date;
  description: string;
  amount: number;
  transactionType: string;
  reference: string | null;
  categorization: {
    category: string;
    isConfirmed: boolean;
    linkedEntityType: string | null;
    linkedEntityId: number | null;
    confidence: number;
  } | null;
}): Promise<ReconciliationResult> {
  // If categorization already linked an entity, use that
  if (tx.categorization?.linkedEntityId && tx.categorization?.linkedEntityType) {
    const result = await linkToEntity(
      tx.id,
      tx.categorization.linkedEntityType,
      tx.categorization.linkedEntityId,
      tx.amount,
      tx.transactionDate
    );
    if (result) return result;
  }

  // Try matching by reference
  if (tx.reference) {
    const refResult = await matchByReference(tx.id, tx.reference, tx.amount, tx.transactionType);
    if (refResult) return refResult;
  }

  // Try matching by description keywords + amount
  const descResult = await matchByDescription(tx.id, tx.description, tx.amount, tx.transactionType, tx.transactionDate);
  if (descResult) return descResult;

  // Only auto-create records for confirmed categorizations with high confidence
  if (tx.categorization?.isConfirmed && tx.categorization.confidence >= 80) {
    const createResult = await createFromTransaction(tx);
    if (createResult) return createResult;
  }

  return { transactionId: tx.id, status: "UNMATCHED" };
}

/**
 * Link a transaction to an existing entity and update both.
 */
async function linkToEntity(
  transactionId: number,
  entityType: string,
  entityId: number,
  amount: number,
  date: Date
): Promise<ReconciliationResult | null> {
  try {
    if (entityType === "INVOICE") {
      const invoice = await db.invoice.findUnique({ where: { id: entityId } });
      if (!invoice) return null;

      // Mark invoice as paid
      await db.invoice.update({
        where: { id: entityId },
        data: {
          status: "PAID",
          paidDate: date,
        },
      });

      await db.bankTransaction.update({
        where: { id: transactionId },
        data: {
          reconciliationStatus: "MATCHED",
          reconciledAt: new Date(),
          linkedInvoiceId: entityId,
        },
      });

      return {
        transactionId,
        status: "MATCHED",
        linkedEntityType: "INVOICE",
        linkedEntityId: entityId,
      };
    }

    if (entityType === "PAYMENT_REQUEST") {
      await db.paymentRequest.update({
        where: { id: entityId },
        data: {
          status: "PAID",
          paidDate: date,
        },
      });

      await db.bankTransaction.update({
        where: { id: transactionId },
        data: {
          reconciliationStatus: "MATCHED",
          reconciledAt: new Date(),
          linkedPaymentRequestId: entityId,
        },
      });

      return {
        transactionId,
        status: "MATCHED",
        linkedEntityType: "PAYMENT_REQUEST",
        linkedEntityId: entityId,
      };
    }

    if (entityType === "OPERATIONAL_EXPENSE") {
      await db.bankTransaction.update({
        where: { id: transactionId },
        data: {
          reconciliationStatus: "MATCHED",
          reconciledAt: new Date(),
          linkedOperationalExpenseId: entityId,
        },
      });

      return {
        transactionId,
        status: "MATCHED",
        linkedEntityType: "OPERATIONAL_EXPENSE",
        linkedEntityId: entityId,
      };
    }
  } catch (err: any) {
    console.error(`[Reconcile] Link error: ${err.message}`);
  }

  return null;
}

/**
 * Match by reference number against invoices and payment requests.
 */
async function matchByReference(
  transactionId: number,
  reference: string,
  amount: number,
  transactionType: string
): Promise<ReconciliationResult | null> {
  const ref = reference.trim().toUpperCase();

  if (transactionType === "CREDIT") {
    // Try matching to an invoice
    const invoice = await db.invoice.findFirst({
      where: {
        OR: [
          { invoiceNumber: { contains: ref, mode: "insensitive" } },
          { invoiceNumber: ref },
        ],
        status: { in: ["SENT", "APPROVED", "OVERDUE"] },
      },
    });

    if (invoice && Math.abs(invoice.total - amount) < 1) {
      return linkToEntity(transactionId, "INVOICE", invoice.id, amount, new Date());
    }
  }

  return null;
}

/**
 * Match by description and amount against existing records.
 */
async function matchByDescription(
  transactionId: number,
  description: string,
  amount: number,
  transactionType: string,
  date: Date
): Promise<ReconciliationResult | null> {
  const tolerance = 0.01; // R0.01 tolerance
  const dateTolerance = 3 * 24 * 60 * 60 * 1000; // 3 days

  if (transactionType === "DEBIT") {
    // Try matching to an operational expense by amount + date
    const expense = await db.operationalExpense.findFirst({
      where: {
        amount: { gte: amount - tolerance, lte: amount + tolerance },
        date: {
          gte: new Date(date.getTime() - dateTolerance),
          lte: new Date(date.getTime() + dateTolerance),
        },
      },
      orderBy: { date: "desc" },
    });

    if (expense) {
      await db.bankTransaction.update({
        where: { id: transactionId },
        data: {
          reconciliationStatus: "MATCHED",
          reconciledAt: new Date(),
          linkedOperationalExpenseId: expense.id,
        },
      });

      return {
        transactionId,
        status: "MATCHED",
        linkedEntityType: "OPERATIONAL_EXPENSE",
        linkedEntityId: expense.id,
      };
    }
  }

  if (transactionType === "CREDIT") {
    // Try matching to unpaid invoice by exact amount
    const invoice = await db.invoice.findFirst({
      where: {
        total: { gte: amount - tolerance, lte: amount + tolerance },
        status: { in: ["SENT", "APPROVED", "OVERDUE"] },
      },
      orderBy: { createdAt: "desc" },
    });

    if (invoice) {
      return linkToEntity(transactionId, "INVOICE", invoice.id, amount, date);
    }
  }

  return null;
}

/**
 * Create a new system record from an unmatched transaction (auto-capture).
 */
async function createFromTransaction(tx: {
  id: number;
  transactionDate: Date;
  description: string;
  amount: number;
  transactionType: string;
  categorization: {
    category: string;
    isConfirmed: boolean;
    confidence: number;
  } | null;
}): Promise<ReconciliationResult | null> {
  if (!tx.categorization?.isConfirmed) return null;

  const category = tx.categorization.category;

  if (tx.transactionType === "DEBIT") {
    // Create an operational expense
    const validExpenseCategories = [
      "PETROL", "OFFICE_SUPPLIES", "RENT", "UTILITIES", "INSURANCE",
      "SALARIES", "MARKETING", "MAINTENANCE", "TRAVEL", "PROFESSIONAL_FEES",
      "TELECOMMUNICATIONS", "SOFTWARE_SUBSCRIPTIONS", "OTHER",
    ];

    const expCategory = validExpenseCategories.includes(category) ? category : "OTHER";

    const expense = await db.operationalExpense.create({
      data: {
        date: tx.transactionDate,
        category: expCategory as any,
        description: `[Auto] ${tx.description}`,
        amount: tx.amount,
        createdById: 2, // System user — will be overridden by bank account owner
        isApproved: false, // Requires manual approval
      },
    });

    await db.bankTransaction.update({
      where: { id: tx.id },
      data: {
        reconciliationStatus: "MATCHED",
        reconciledAt: new Date(),
        linkedOperationalExpenseId: expense.id,
      },
    });

    return {
      transactionId: tx.id,
      status: "MATCHED",
      linkedEntityType: "OPERATIONAL_EXPENSE",
      linkedEntityId: expense.id,
      action: "CREATED",
    };
  }

  if (tx.transactionType === "CREDIT" && category !== "INVOICE_PAYMENT") {
    // Create an alternative revenue entry
    const revenueCategory = mapToRevenueCategory(category);

    const revenue = await db.alternativeRevenue.create({
      data: {
        date: tx.transactionDate,
        category: revenueCategory,
        description: `[Auto] ${tx.description}`,
        amount: tx.amount,
        source: tx.description,
        createdById: 2,
        isApproved: false,
      },
    });

    await db.bankTransaction.update({
      where: { id: tx.id },
      data: {
        reconciliationStatus: "MATCHED",
        reconciledAt: new Date(),
        linkedAlternativeRevenueId: revenue.id,
      },
    });

    return {
      transactionId: tx.id,
      status: "MATCHED",
      linkedEntityType: "ALTERNATIVE_REVENUE",
      linkedEntityId: revenue.id,
      action: "CREATED",
    };
  }

  return null;
}

function mapToRevenueCategory(category: string): string {
  const map: Record<string, string> = {
    RENTAL_INCOME: "RENTAL_INCOME",
    CONSULTING: "CONSULTING",
    INTEREST: "INTEREST",
    INVESTMENTS: "INVESTMENTS",
    COMMISSION: "COMMISSION",
    REFUND: "OTHER",
    OTHER_REVENUE: "OTHER",
  };
  return map[category] || "OTHER";
}
