/**
 * Allocates incoming bank credits to unpaid invoices and marks them PAID.
 *
 * Clients often settle several invoices in one EFT and VAT rounding means
 * the bank amount can differ from the stored invoice total by a few cents,
 * so matching is: payer-scoped candidates → unique single or multi-invoice
 * combination within a rounding tolerance. Anything ambiguous is left alone.
 */
import { db } from "~/server/db";

const UNPAID_STATUSES = ["SENT", "APPROVED", "OVERDUE"] as const;

// Credit categories that are money in but not trading income.
export const NON_REVENUE_CREDIT_CATEGORIES = [
  "OWNER_CONTRIBUTION",
  "LOAN_RECEIVED",
  "INTERNAL_TRANSFER",
  "REFUND",
];

const STOP_WORDS = new Set([
  "property", "properties", "group", "admin", "admini", "administration", "payment", "payments",
  "transfer", "credit", "debit", "deposit", "from", "with", "send", "money", "investments",
  "holdings", "fund", "limited", "trust", "the", "and", "road", "avenue", "street",
  "invoice", "inv", "ref", "eft", "internet", "banking", "capital", "pty", "ltd",
]);

const SINGLE_TOLERANCE = 0.05;
const MAX_COMBINATION = 3;
const MAX_CANDIDATES = 40;

export interface InvoiceAllocationResult {
  transactionId: number;
  invoiceIds: number[];
  invoiceNumbers: string[];
}

function normalizeDescription(value: string): string {
  return value
    .toLowerCase()
    // Nedbank narratives render "BROLL" as "BRO11".
    .replace(/\bbro11\b/g, "broll")
    .replace(/[^a-z]+/g, " ")
    .trim();
}

export function payerTokens(description: string): string[] {
  return [...new Set(normalizeDescription(description).split(/\s+/))]
    .filter((token) => token.length >= 4 && !STOP_WORDS.has(token));
}

function payerKey(description: string): string {
  return normalizeDescription(description).split(/\s+/).slice(0, 3).join(" ");
}

type Candidate = {
  id: number;
  invoiceNumber: string;
  total: number;
  clientId: number | null;
  customerEmail: string;
  haystack: string;
};

function buildHaystack(invoice: {
  customerName: string;
  customerEmail: string;
  client: { name: string; companyName: string | null } | null;
}): string {
  const domain = invoice.customerEmail.split("@")[1] ?? "";
  return [invoice.customerName, invoice.client?.name, invoice.client?.companyName, domain]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

/** Returns up to two exact combinations so callers can detect ambiguity. */
function findCombinations(candidates: Candidate[], target: number): Candidate[][] {
  const sorted = [...candidates].sort((a, b) => b.total - a.total);
  const solutions: Candidate[][] = [];
  const suffix: number[] = new Array(sorted.length + 1).fill(0);
  for (let i = sorted.length - 1; i >= 0; i--) suffix[i] = suffix[i + 1]! + sorted[i]!.total;

  const walk = (start: number, picked: Candidate[], sum: number) => {
    if (solutions.length >= 2) return;
    // Invoice totals carry fractional cents, so each extra invoice can add up to 1c of rounding.
    const tolerance = picked.length <= 1 ? SINGLE_TOLERANCE : 0.01 * picked.length;
    if (picked.length > 0 && Math.abs(sum - target) <= tolerance) {
      solutions.push([...picked]);
      return;
    }
    if (picked.length >= MAX_COMBINATION) return;
    for (let i = start; i < sorted.length; i++) {
      const c = sorted[i]!;
      if (sum + c.total > target + 0.1) continue;
      if (sum + suffix[i]! < target - 0.1) return;
      picked.push(c);
      walk(i + 1, picked, sum + c.total);
      picked.pop();
      if (solutions.length >= 2) return;
    }
  };
  walk(0, [], 0);
  return solutions;
}

async function loadPayerScopedCandidates(tx: { id: number; description: string; transactionDate: Date }): Promise<Candidate[]> {
  const tokens = payerTokens(tx.description);
  const windowStart = new Date(tx.transactionDate.getTime() - 400 * 86400000);
  const windowEnd = new Date(tx.transactionDate.getTime() + 7 * 86400000);
  const invoices = await db.invoice.findMany({
    where: {
      status: { in: [...UNPAID_STATUSES] },
      isDisputed: false,
      createdAt: { gte: windowStart, lte: windowEnd },
    },
    select: {
      id: true,
      invoiceNumber: true,
      total: true,
      depositAmount: true,
      clientId: true,
      customerName: true,
      customerEmail: true,
      createdAt: true,
      client: { select: { name: true, companyName: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Customers this payer has settled before are in scope even without a name overlap.
  const key = payerKey(tx.description);
  const history = await db.bankTransaction.findMany({
    where: { transactionType: "CREDIT", reconciliationStatus: "MATCHED", linkedInvoiceId: { not: null }, id: { not: tx.id } },
    select: { description: true, linkedInvoiceId: true },
  });
  const historicalInvoiceIds = history.filter((h) => key && payerKey(h.description) === key).map((h) => h.linkedInvoiceId!);
  const historical = historicalInvoiceIds.length
    ? await db.invoice.findMany({ where: { id: { in: historicalInvoiceIds } }, select: { clientId: true, customerEmail: true } })
    : [];
  const knownClients = new Set(historical.map((h) => h.clientId).filter((id): id is number => id !== null));
  const knownEmails = new Set(historical.map((h) => h.customerEmail.toLowerCase()));

  return invoices
    .map((invoice) => ({
      id: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      total: Math.max(0, invoice.total - (invoice.depositAmount ?? 0)),
      clientId: invoice.clientId,
      customerEmail: invoice.customerEmail.toLowerCase(),
      haystack: buildHaystack(invoice),
    }))
    .filter((c) => c.total > 0)
    .filter((c) =>
      tokens.some((token) => c.haystack.includes(token)) ||
      (c.clientId !== null && knownClients.has(c.clientId)) ||
      knownEmails.has(c.customerEmail),
    )
    .slice(0, MAX_CANDIDATES);
}

/**
 * Try to allocate one unmatched credit to unpaid invoices. Only a unique
 * combination is applied; the invoices become PAID on the bank date.
 */
export async function allocateCreditToInvoices(
  transactionId: number,
  options: { dryRun?: boolean } = {},
): Promise<InvoiceAllocationResult | null> {
  const tx = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    select: {
      id: true, amount: true, description: true, transactionDate: true, transactionType: true,
      reconciliationStatus: true, linkedInvoiceId: true,
      categorization: { select: { category: true } },
    },
  });
  if (!tx || tx.transactionType !== "CREDIT" || tx.reconciliationStatus !== "UNMATCHED" || tx.linkedInvoiceId) return null;
  if (tx.categorization && NON_REVENUE_CREDIT_CATEGORIES.includes(tx.categorization.category)) return null;
  if (tx.amount < 1) return null;

  const candidates = await loadPayerScopedCandidates(tx);
  if (candidates.length === 0) return null;
  const solutions = findCombinations(candidates, tx.amount);
  if (solutions.length !== 1) return null;
  const chosen = solutions[0]!;

  // Another unmatched credit with the same amount from the same payer makes the allocation ambiguous.
  const competing = await db.bankTransaction.findMany({
    where: {
      id: { not: tx.id },
      transactionType: "CREDIT",
      reconciliationStatus: "UNMATCHED",
      amount: { gte: tx.amount - 0.01, lte: tx.amount + 0.01 },
    },
    select: { description: true },
  });
  if (competing.some((c) => payerKey(c.description) === payerKey(tx.description))) return null;

  const invoiceIds = chosen.map((c) => c.id);
  if (options.dryRun) return { transactionId: tx.id, invoiceIds, invoiceNumbers: chosen.map((c) => c.invoiceNumber) };
  return applyInvoiceAllocation({ transactionId: tx.id, invoiceIds, tolerance: 0.05 });
}

/**
 * Mark the given invoices PAID on the bank date and link the credit.
 * Returns null when the credit or invoices changed underneath us.
 */
export async function applyInvoiceAllocation(params: {
  transactionId: number;
  invoiceIds: number[];
  tolerance: number;
  actor?: { id: number; name: string };
}): Promise<InvoiceAllocationResult | null> {
  const invoiceIds = [...new Set(params.invoiceIds)];
  if (invoiceIds.length === 0) return null;
  return db.$transaction(async (trx) => {
    const tx = await trx.bankTransaction.findUnique({
      where: { id: params.transactionId },
      select: { id: true, amount: true, description: true, transactionDate: true, transactionType: true, reconciliationStatus: true },
    });
    if (!tx || tx.transactionType !== "CREDIT" || tx.reconciliationStatus !== "UNMATCHED") return null;
    const invoices = await trx.invoice.findMany({
      where: { id: { in: invoiceIds }, status: { in: [...UNPAID_STATUSES] } },
      select: { id: true, invoiceNumber: true, total: true, depositAmount: true },
    });
    if (invoices.length !== invoiceIds.length) return null;
    const outstanding = invoices.reduce((sum, inv) => sum + Math.max(0, inv.total - (inv.depositAmount ?? 0)), 0);
    if (Math.abs(outstanding - tx.amount) > params.tolerance) return null;
    const ordered = invoiceIds.map((id) => invoices.find((inv) => inv.id === id)!);

    await trx.invoice.updateMany({
      where: { id: { in: invoiceIds } },
      data: { status: "PAID", paidDate: tx.transactionDate },
    });
    await trx.bankTransaction.update({
      where: { id: tx.id },
      data: { reconciliationStatus: "MATCHED", reconciledAt: new Date(), linkedInvoiceId: invoiceIds[0] },
    });
    await trx.transactionCategorization.updateMany({
      where: { bankTransactionId: tx.id },
      data: { category: "INVOICE_PAYMENT", linkedEntityType: "INVOICE", linkedEntityId: invoiceIds[0] },
    });
    await trx.auditLog.create({
      data: {
        action: "BANK_INVOICE_ALLOCATION",
        entityType: "BankTransaction",
        entityId: tx.id,
        module: "bank-feed",
        userId: params.actor?.id ?? null,
        userName: params.actor?.name ?? "Bank feed auto-reconciliation",
        description: `R${tx.amount.toFixed(2)} "${tx.description}" allocated to ${ordered.map((inv) => inv.invoiceNumber).join(", ")}`,
        changes: JSON.stringify({ invoiceIds, invoiceNumbers: ordered.map((inv) => inv.invoiceNumber), amount: tx.amount, outstanding, paidDate: tx.transactionDate }),
      },
    });
    return { transactionId: tx.id, invoiceIds, invoiceNumbers: ordered.map((inv) => inv.invoiceNumber) };
  });
}

/** Unpaid invoices for manual allocation, payer-related ones first, plus any unique suggestion. */
export async function listAllocationCandidates(transactionId: number) {
  const tx = await db.bankTransaction.findUnique({
    where: { id: transactionId },
    select: { id: true, amount: true, description: true, transactionDate: true, transactionType: true },
  });
  if (!tx || tx.transactionType !== "CREDIT") return null;
  const related = await loadPayerScopedCandidates(tx);
  const relatedIds = new Set(related.map((c) => c.id));
  const all = await db.invoice.findMany({
    where: { status: { in: [...UNPAID_STATUSES] } },
    select: { id: true, invoiceNumber: true, customerName: true, total: true, depositAmount: true, dueDate: true, createdAt: true },
    orderBy: { createdAt: "desc" },
    take: 300,
  });
  const solutions = related.length ? findCombinations(related, tx.amount) : [];
  return {
    transaction: tx,
    suggestedInvoiceIds: solutions.length === 1 ? solutions[0]!.map((c) => c.id) : [],
    invoices: all
      .map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        customerName: inv.customerName,
        outstanding: Math.round(Math.max(0, inv.total - (inv.depositAmount ?? 0)) * 100) / 100,
        dueDate: inv.dueDate,
        related: relatedIds.has(inv.id),
      }))
      .sort((a, b) => Number(b.related) - Number(a.related)),
  };
}

/** Sweep every unmatched credit; used on a schedule and before debtor reminders. */
export async function runInvoicePaymentAutoMatch(
  options: { dryRun?: boolean } = {},
): Promise<{ scanned: number; allocated: InvoiceAllocationResult[] }> {
  const credits = await db.bankTransaction.findMany({
    where: { transactionType: "CREDIT", reconciliationStatus: "UNMATCHED", linkedInvoiceId: null },
    select: { id: true },
    orderBy: { transactionDate: "asc" },
  });
  const allocated: InvoiceAllocationResult[] = [];
  for (const credit of credits) {
    try {
      const result = await allocateCreditToInvoices(credit.id, options);
      if (result) allocated.push(result);
    } catch (err) {
      console.error(`[invoice-auto-match] tx ${credit.id} failed:`, err instanceof Error ? err.message : err);
    }
  }
  return { scanned: credits.length, allocated };
}
