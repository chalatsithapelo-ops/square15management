/**
 * Auto-Reconciliation Engine
 * Matches bank transactions against existing system records:
 * - Invoices (CREDIT → marks invoice as PAID)
 * - Operational Expenses (DEBIT → links to existing expense)
 * - Payment Requests (DEBIT → links to artisan payment)
 * Creates new records for unmatched transactions.
 */

import { db } from "~/server/db";
import { allocateCreditToInvoices, NON_REVENUE_CREDIT_CATEGORIES } from "./invoicePaymentMatcher";

const NON_EXPENSE_DEBIT_CATEGORIES = ["LOAN_REPAYMENT", "VEHICLE_FINANCE", "HOME_BOND"];

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
    const linkType = tx.categorization.linkedEntityType;
    const directionCompatible =
      (linkType === "INVOICE" || linkType === "ALTERNATIVE_REVENUE")
        ? tx.transactionType === "CREDIT"
        : (linkType === "PAYMENT_REQUEST" || linkType === "OPERATIONAL_EXPENSE")
          ? tx.transactionType === "DEBIT"
          : false;
    if (directionCompatible) {
      const result = await linkToEntity(
        tx.id,
        linkType,
        tx.categorization.linkedEntityId,
        tx.amount,
        tx.transactionDate
      );
      if (result) return result;
    }
  }

  // Already-paid invoices still need their incoming bank credit linked for a complete audit trail.
  if (tx.transactionType === "CREDIT" && tx.amount > 0) {
    const paidMatch = await matchAlreadyPaidInvoiceByUniqueAmount(tx.id, tx.amount, tx.transactionDate);
    if (paidMatch) return paidMatch;
  }

  // Try matching by reference
  if (tx.reference) {
    const refResult = await matchByReference(tx.id, tx.reference, tx.amount, tx.transactionType, tx.transactionDate);
    if (refResult) return refResult;
  }

  // Try matching by description keywords + amount
  const descResult = await matchByDescription(tx.id, tx.description, tx.amount, tx.transactionType, tx.transactionDate);
  if (descResult) return descResult;

  if (tx.transactionType === "CREDIT") {
    const allocation = await allocateCreditToInvoices(tx.id);
    if (allocation) {
      return {
        transactionId: tx.id,
        status: "MATCHED",
        linkedEntityType: "INVOICE",
        linkedEntityId: allocation.invoiceIds[0],
        action: "ALLOCATED_INVOICES",
      };
    }
  }

  // Only auto-create records for confirmed categorizations with high confidence
  if (tx.categorization?.isConfirmed && tx.categorization.confidence >= 80) {
    const createResult = await createFromTransaction(tx);
    if (createResult) return createResult;
  }

  return { transactionId: tx.id, status: "UNMATCHED" };
}

async function matchAlreadyPaidInvoiceByUniqueAmount(
  transactionId: number,
  amount: number,
  date: Date,
): Promise<ReconciliationResult | null> {
  const tolerance = 0.01;
  const dateWindow = 180 * 24 * 60 * 60 * 1000;
  const invoices = await db.invoice.findMany({
    where: {
      status: "PAID",
      total: { gte: amount - tolerance, lte: amount + tolerance },
    },
    select: { id: true, paidDate: true, dueDate: true, createdAt: true },
    take: 50,
  });
  const recentInvoices = invoices.filter((invoice) => {
    const invoiceDate = invoice.paidDate ?? invoice.dueDate ?? invoice.createdAt;
    return Math.abs(date.getTime() - invoiceDate.getTime()) <= dateWindow;
  });
  if (recentInvoices.length !== 1) return null;
  const invoice = recentInvoices[0]!;
  const invoiceDate = invoice.paidDate ?? invoice.dueDate ?? invoice.createdAt;

  const otherCandidateTransactions = await db.bankTransaction.count({
    where: {
      id: { not: transactionId },
      transactionType: "CREDIT",
      reconciliationStatus: "UNMATCHED",
      amount: { gte: amount - tolerance, lte: amount + tolerance },
      transactionDate: {
        gte: new Date(invoiceDate.getTime() - dateWindow),
        lte: new Date(invoiceDate.getTime() + dateWindow),
      },
    },
  });
  if (otherCandidateTransactions > 0) return null;

  const existingLink = await db.bankTransaction.count({
    where: { linkedInvoiceId: invoice.id, reconciliationStatus: "MATCHED" },
  });
  if (existingLink > 0) return null;

  await db.bankTransaction.update({
    where: { id: transactionId },
    data: {
      reconciliationStatus: "MATCHED",
      reconciledAt: new Date(),
      linkedInvoiceId: invoice.id,
    },
  });
  return {
    transactionId,
    status: "MATCHED",
    linkedEntityType: "INVOICE",
    linkedEntityId: invoice.id,
    action: "LINKED_ALREADY_PAID_INVOICE",
  };
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
      // A reference alone must not mark a differently valued invoice paid.
      // Partial payments stay unmatched until the partial-payment workflow is used.
      if (Math.abs(invoice.total - amount) > 0.01) return null;
      const existingMatchedPayment = await db.bankTransaction.findFirst({
        where: {
          linkedInvoiceId: entityId,
          reconciliationStatus: "MATCHED",
          id: { not: transactionId },
        },
        select: { id: true },
      });
      if (existingMatchedPayment) return null;

      // Preserve the recorded settlement date when an invoice is already paid.
      if (invoice.status !== "PAID") {
        await db.invoice.update({
          where: { id: entityId },
          data: { status: "PAID", paidDate: date },
        });
      }

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
      const paymentRequest = await db.paymentRequest.findUnique({
        where: { id: entityId },
        select: { calculatedAmount: true },
      });
      if (!paymentRequest || Math.abs(paymentRequest.calculatedAmount - amount) > 0.01) return null;
      const existingPaymentLink = await db.bankTransaction.findFirst({
        where: { linkedPaymentRequestId: entityId, reconciliationStatus: "MATCHED", id: { not: transactionId } },
        select: { id: true },
      });
      if (existingPaymentLink) return null;
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
      const expense = await db.operationalExpense.findUnique({ where: { id: entityId }, select: { amount: true } });
      if (!expense || Math.abs(expense.amount - amount) > 0.01) return null;
      const existingExpenseLink = await db.bankTransaction.findFirst({
        where: { linkedOperationalExpenseId: entityId, reconciliationStatus: "MATCHED", id: { not: transactionId } },
        select: { id: true },
      });
      if (existingExpenseLink) return null;
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
  transactionType: string,
  transactionDate: Date,
): Promise<ReconciliationResult | null> {
  const ref = reference.trim().toUpperCase();

  if (transactionType === "CREDIT") {
    // Match only a unique invoice reference and exact amount.
    const candidates = await db.invoice.findMany({
      where: {
        OR: [
          { invoiceNumber: { contains: ref, mode: "insensitive" } },
          { invoiceNumber: ref },
        ],
        status: { in: ["PAID", "SENT", "APPROVED", "OVERDUE"] },
      },
      take: 5,
    });
    const exact = candidates.filter((invoice) => Math.abs(invoice.total - amount) <= 0.01);
    if (exact.length === 1) {
      return linkToEntity(transactionId, "INVOICE", exact[0]!.id, amount, transactionDate);
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
    // Match only an unused, unique exact-amount expense in the narrow date
    // window. The old findFirst-by-amount/date logic repeatedly linked many
    // bank transactions to the same pending expense.
    const candidates = await db.operationalExpense.findMany({
      where: {
        amount: { gte: amount - tolerance, lte: amount + tolerance },
        date: {
          gte: new Date(date.getTime() - dateTolerance),
          lte: new Date(date.getTime() + dateTolerance),
        },
      },
      orderBy: { date: "desc" },
      take: 10,
    });
    const available: typeof candidates = [];
    for (const candidate of candidates) {
      if (!descriptionsSupportMatch(description, candidate.description)) continue;
      const alreadyLinked = await db.bankTransaction.count({
        where: { linkedOperationalExpenseId: candidate.id, reconciliationStatus: "MATCHED" },
      });
      if (alreadyLinked === 0) available.push(candidate);
    }

    if (available.length === 1) {
      const expense = available[0]!;
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
    // Match only one recent unpaid invoice and never auto-link a repeated amount.
    const candidates = await db.invoice.findMany({
      where: {
        total: { gte: amount - tolerance, lte: amount + tolerance },
        status: { in: ["SENT", "APPROVED", "OVERDUE"] },
      },
      select: { id: true, createdAt: true, dueDate: true },
      take: 20,
    });
    const dateWindow = 180 * 24 * 60 * 60 * 1000;
    const recent = candidates.filter((invoice) => {
      const anchor = invoice.dueDate ?? invoice.createdAt;
      return Math.abs(date.getTime() - anchor.getTime()) <= dateWindow;
    });
    if (recent.length === 1) {
      const anchor = recent[0]!.dueDate ?? recent[0]!.createdAt;
      const competingCredits = await db.bankTransaction.count({
        where: {
          id: { not: transactionId },
          transactionType: "CREDIT",
          reconciliationStatus: "UNMATCHED",
          amount: { gte: amount - tolerance, lte: amount + tolerance },
          transactionDate: {
            gte: new Date(anchor.getTime() - dateWindow),
            lte: new Date(anchor.getTime() + dateWindow),
          },
        },
      });
      const alreadyMatched = await db.bankTransaction.count({
        where: { linkedInvoiceId: recent[0]!.id, reconciliationStatus: "MATCHED" },
      });
      if (competingCredits > 0 || alreadyMatched > 0) return null;
      return linkToEntity(transactionId, "INVOICE", recent[0]!.id, amount, date);
    }
  }

  return null;
}

function descriptionsSupportMatch(transactionDescription: string, expenseDescription: string): boolean {
  const stopWords = new Set(["auto", "debit", "credit", "transaction", "purchase", "payment", "fee", "bank", "card", "pos", "money", "cash", "transfer"]);
  const tokens = (value: string) => value
    .toLowerCase()
    .replace(/\d{5,}/g, " ")
    .replace(/[^a-z]+/g, " ")
    .split(/\s+/)
    .filter((token) => token.length >= 3 && !stopWords.has(token));
  const bankTokens = new Set(tokens(transactionDescription));
  return tokens(expenseDescription).some((token) => bankTokens.has(token));
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
  if (NON_EXPENSE_DEBIT_CATEGORIES.includes(category) || NON_REVENUE_CREDIT_CATEGORIES.includes(category)) return null;

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

function mapToRevenueCategory(category: string): any {
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
