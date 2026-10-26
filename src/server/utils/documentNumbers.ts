/**
 * Shared helpers for sequential document numbers (invoices, orders, quotations).
 *
 * All generators used to scan `.match(/(\d+)$/)` across every existing row and
 * pick max+1. A single bad record with a `Date.now()`-style 13-digit suffix
 * (e.g. `ORD-1773485068010`) would poison the counter and force every
 * subsequent document to inherit that huge suffix. This helper caps the scan
 * to sane suffixes so poisoned records are simply ignored.
 *
 * Concurrency: every generator runs inside a transaction that first takes a
 * per-document-type PostgreSQL advisory lock (pg_advisory_xact_lock). This
 * serialises concurrent callers so two accounts (e.g. junior admin + technical
 * manager) creating a quotation at the same instant cannot both allocate the
 * same suffix — which used to produce visually-duplicated quote numbers
 * (QUO-00195 + 000195) even though the DB @unique constraint was satisfied.
 *
 * Prefix hygiene: a blank/whitespace prefix is coerced to the doc-type default
 * (QUO / INV / ORD) so we never emit bare `-00195`-style numbers.
 */
import type { PrismaClient, Prisma } from "@prisma/client";

// Any numeric suffix at or above this is considered a poisoned/garbage value
// (timestamps, uuids, etc.) and skipped when computing the next number.
export const MAX_SANE_DOCUMENT_SUFFIX = 999_999;

// Advisory-lock keys (stable random bigints per document type).
const LOCK_KEY_QUOTATION = BigInt("735981204518273451");
const LOCK_KEY_INVOICE = BigInt("491827365019283746");
const LOCK_KEY_ORDER = BigInt("827364519283746510");

function extractSuffix(value: string): number | null {
  const m = value.match(/(\d+)$/);
  if (!m?.[1]) return null;
  const n = parseInt(m[1], 10);
  if (!Number.isFinite(n) || n > MAX_SANE_DOCUMENT_SUFFIX) return null;
  return n;
}

function nextFromCurrentMax(values: string[]): number {
  let max = 0;
  for (const v of values) {
    const n = extractSuffix(v);
    if (n != null && n > max) max = n;
  }
  return max + 1;
}

function safePrefix(prefix: string | null | undefined, fallback: string): string {
  const p = (prefix ?? "").trim();
  return p.length > 0 ? p : fallback;
}

function format(prefix: string, num: number, pad = 5): string {
  return `${prefix}-${String(num).padStart(pad, "0")}`;
}

// Acquires a per-doc-type advisory lock; auto-released at transaction end.
async function acquireLock(
  tx: Prisma.TransactionClient,
  key: bigint
): Promise<void> {
  await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${key.toString()})`);
}

/**
 * Generate the next sequential invoice number for the base `Invoice` table,
 * cross-checked with `PropertyManagerInvoice` so both tables share a namespace.
 */
export async function getNextInvoiceNumber(
  db: PrismaClient,
  prefix: string
): Promise<string> {
  const safe = safePrefix(prefix, "INV");
  return db.$transaction(async (tx) => {
    await acquireLock(tx, LOCK_KEY_INVOICE);
    const [invs, pmInvs] = await Promise.all([
      tx.invoice.findMany({ select: { invoiceNumber: true } }),
      tx.propertyManagerInvoice.findMany({ select: { invoiceNumber: true } }),
    ]);
    let candidate = nextFromCurrentMax([
      ...invs.map((r) => r.invoiceNumber),
      ...pmInvs.map((r) => r.invoiceNumber),
    ]);
    for (let attempt = 0; attempt < 20; attempt++) {
      const num = format(safe, candidate);
      const [a, b] = await Promise.all([
        tx.invoice.findUnique({ where: { invoiceNumber: num } }),
        tx.propertyManagerInvoice.findUnique({ where: { invoiceNumber: num } }),
      ]);
      if (!a && !b) return num;
      candidate++;
    }
    throw new Error("Failed to allocate a unique invoice number after 20 attempts");
  });
}

/**
 * Generate the next sequential order number for the base `Order` table.
 */
export async function getNextOrderNumber(
  db: PrismaClient,
  prefix: string
): Promise<string> {
  const safe = safePrefix(prefix, "ORD");
  return db.$transaction(async (tx) => {
    await acquireLock(tx, LOCK_KEY_ORDER);
    const rows = await tx.order.findMany({ select: { orderNumber: true } });
    let candidate = nextFromCurrentMax(rows.map((r) => r.orderNumber));
    for (let attempt = 0; attempt < 20; attempt++) {
      const num = format(safe, candidate);
      const existing = await tx.order.findUnique({ where: { orderNumber: num } });
      if (!existing) return num;
      candidate++;
    }
    throw new Error("Failed to allocate a unique order number after 20 attempts");
  });
}

/**
 * Generate the next sequential quotation number for the base `Quotation` table.
 */
export async function getNextQuoteNumber(
  db: PrismaClient,
  prefix: string
): Promise<string> {
  const safe = safePrefix(prefix, "QUO");
  return db.$transaction(async (tx) => {
    await acquireLock(tx, LOCK_KEY_QUOTATION);
    const rows = await tx.quotation.findMany({ select: { quoteNumber: true } });
    let candidate = nextFromCurrentMax(rows.map((r) => r.quoteNumber));
    for (let attempt = 0; attempt < 20; attempt++) {
      const num = format(safe, candidate);
      const existing = await tx.quotation.findUnique({
        where: { quoteNumber: num },
      });
      if (!existing) return num;
      candidate++;
    }
    throw new Error("Failed to allocate a unique quote number after 20 attempts");
  });
}
