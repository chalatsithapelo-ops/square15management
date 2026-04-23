/**
 * Recanonicalise invoice totals using per-step rounding.
 *
 * Fixes historical invoices where subtotal/tax/total drifted by a cent due to
 * binary float rounding (e.g. R5014.57 in the web form vs R5014.58 on the PDF).
 *
 * Deployment:
 *   pnpm tsx scripts/recanonicalise-invoice-totals.ts               # dry-run
 *   pnpm tsx scripts/recanonicalise-invoice-totals.ts --apply       # write changes
 *   pnpm tsx scripts/recanonicalise-invoice-totals.ts --apply --only INV-00063
 */

import { PrismaClient } from "@prisma/client";
import { computeInvoiceTotals } from "../src/utils/money";

const db = new PrismaClient();

const APPLY = process.argv.includes("--apply");
const onlyIdx = process.argv.indexOf("--only");
const ONLY = onlyIdx >= 0 ? process.argv[onlyIdx + 1] : null;

type Row = {
  invoiceNumber: string;
  oldSubtotal: number;
  newSubtotal: number;
  oldTax: number;
  newTax: number;
  oldTotal: number;
  newTotal: number;
};

async function processTable(label: "invoice" | "pmInvoice") {
  const rows: Row[] = [];
  const records = label === "invoice"
    ? await db.invoice.findMany({
        where: ONLY ? { invoiceNumber: ONLY } : undefined,
        select: { id: true, invoiceNumber: true, items: true, subtotal: true, tax: true, total: true },
      })
    : await db.propertyManagerInvoice.findMany({
        where: ONLY ? { invoiceNumber: ONLY } : undefined,
        select: { id: true, invoiceNumber: true, items: true, subtotal: true, tax: true, total: true },
      });

  for (const inv of records) {
    const items = Array.isArray(inv.items) ? (inv.items as any[]) : [];
    if (items.length === 0) continue;
    const canonical = computeInvoiceTotals(items);

    const drift =
      canonical.subtotal !== (inv.subtotal ?? 0) ||
      canonical.tax !== (inv.tax ?? 0) ||
      canonical.total !== (inv.total ?? 0);
    if (!drift) continue;

    rows.push({
      invoiceNumber: inv.invoiceNumber,
      oldSubtotal: inv.subtotal ?? 0,
      newSubtotal: canonical.subtotal,
      oldTax: inv.tax ?? 0,
      newTax: canonical.tax,
      oldTotal: inv.total ?? 0,
      newTotal: canonical.total,
    });

    if (APPLY) {
      if (label === "invoice") {
        await db.invoice.update({
          where: { id: inv.id },
          data: { subtotal: canonical.subtotal, tax: canonical.tax, total: canonical.total },
        });
      } else {
        await db.propertyManagerInvoice.update({
          where: { id: inv.id },
          data: { subtotal: canonical.subtotal, tax: canonical.tax, total: canonical.total },
        });
      }
    }
  }
  return rows;
}

async function main() {
  console.log(`Mode: ${APPLY ? "APPLY" : "DRY-RUN"}${ONLY ? `, only ${ONLY}` : ""}`);

  const invRows = await processTable("invoice");
  const pmRows = await processTable("pmInvoice");

  const all = [...invRows, ...pmRows];
  if (all.length === 0) {
    console.log("No drifted invoices found.");
    return;
  }

  console.log(`\nDrifted invoices (${all.length}):`);
  for (const r of all) {
    console.log(
      `  ${r.invoiceNumber.padEnd(14)}  ` +
      `sub ${r.oldSubtotal.toFixed(2)} → ${r.newSubtotal.toFixed(2)}  ` +
      `vat ${r.oldTax.toFixed(2)} → ${r.newTax.toFixed(2)}  ` +
      `total ${r.oldTotal.toFixed(2)} → ${r.newTotal.toFixed(2)}`,
    );
  }
  console.log(APPLY ? "\n✓ Updated." : "\n(dry-run — re-run with --apply to persist)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await db.$disconnect(); });
