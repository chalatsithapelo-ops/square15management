/**
 * Fix mislinked invoices — some invoices are linked to the wrong orders.
 * This script:
 * 1. Finds orders where the linked invoice has a different customerName
 * 2. Finds the correct orphan invoice with matching customerName
 * 3. Swaps the linkages so each order has the correct invoice
 *
 * Run: node fix-invoice-linkages.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // Get all completed orders with their invoices
  const orders = await db.order.findMany({
    where: { status: "COMPLETED" },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          customerName: true,
          orderId: true,
        },
      },
    },
  });

  // Get all orphan invoices (no orderId)
  const orphans = await db.invoice.findMany({
    where: { orderId: null },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerEmail: true,
    },
  });

  console.log(`Completed orders: ${orders.length}`);
  console.log(`Orphan invoices: ${orphans.length}`);
  console.log("");

  // Phase 1: Fix mismatched links
  // Collect orders where invoice customerName doesn't match order customerName
  const mismatched = orders.filter(
    (o) =>
      o.invoice &&
      o.invoice.customerName.toLowerCase().trim() !== o.customerName.toLowerCase().trim()
  );

  console.log(`Mismatched order-invoice pairs: ${mismatched.length}`);
  for (const o of mismatched) {
    console.log(
      `  ${o.orderNumber} (${o.customerName}) ← Invoice ${o.invoice.invoiceNumber} (${o.invoice.customerName})`
    );
  }
  console.log("");

  // For each mismatched order:
  //   - Find orphan invoice matching the ORDER's customerName (the correct invoice)
  //   - Unlink the wrong invoice, link the correct one
  let fixed = 0;
  const usedOrphans = new Set();
  const detachedInvoices = []; // invoices to unlink from wrong orders

  for (const order of mismatched) {
    // Find the correct orphan invoice by matching customerName
    const correctInvoice = orphans.find(
      (inv) =>
        !usedOrphans.has(inv.id) &&
        inv.customerName.toLowerCase().trim() === order.customerName.toLowerCase().trim() &&
        inv.customerEmail.toLowerCase().trim() === order.customerEmail.toLowerCase().trim()
    );

    if (!correctInvoice) {
      console.log(
        `  [SKIP] No orphan invoice found for ${order.orderNumber} (${order.customerName})`
      );
      continue;
    }

    console.log(
      `  [FIX] ${order.orderNumber} (${order.customerName}): unlink ${order.invoice.invoiceNumber} (${order.invoice.customerName}), link ${correctInvoice.invoiceNumber} (${correctInvoice.customerName})`
    );

    // Detach wrong invoice first, then attach correct one
    detachedInvoices.push({
      invoiceId: order.invoice.id,
      invoiceNumber: order.invoice.invoiceNumber,
      wrongOrderId: order.id,
    });

    usedOrphans.add(correctInvoice.id);

    // Perform the swap in a transaction
    await db.$transaction(async (tx) => {
      // Detach the wrong invoice
      await tx.invoice.update({
        where: { id: order.invoice.id },
        data: { orderId: null },
      });

      // Attach the correct invoice
      await tx.invoice.update({
        where: { id: correctInvoice.id },
        data: { orderId: order.id },
      });
    });

    fixed++;
  }

  // Phase 2: Try to link remaining orphans to orders without invoices
  const ordersWithoutInvoice = orders.filter((o) => !o.invoice);
  const remainingOrphans = orphans.filter((inv) => !usedOrphans.has(inv.id));

  console.log(`\nOrders still without invoice: ${ordersWithoutInvoice.length}`);
  for (const order of ordersWithoutInvoice) {
    const match = remainingOrphans.find(
      (inv) =>
        !usedOrphans.has(inv.id) &&
        inv.customerName.toLowerCase().trim() === order.customerName.toLowerCase().trim() &&
        inv.customerEmail.toLowerCase().trim() === order.customerEmail.toLowerCase().trim()
    );

    if (match) {
      await db.invoice.update({
        where: { id: match.id },
        data: { orderId: order.id },
      });
      usedOrphans.add(match.id);
      console.log(
        `  [LINKED] ${order.orderNumber} (${order.customerName}) → ${match.invoiceNumber}`
      );
      fixed++;
    } else {
      console.log(
        `  [NO MATCH] ${order.orderNumber} (${order.customerName})`
      );
    }
  }

  // Also try to link detached invoices to their correct orders
  console.log(`\nDetached invoices to re-link: ${detachedInvoices.length}`);
  for (const det of detachedInvoices) {
    const detInv = await db.invoice.findUnique({
      where: { id: det.invoiceId },
      select: { id: true, invoiceNumber: true, customerName: true, customerEmail: true, orderId: true },
    });
    if (!detInv || detInv.orderId) continue; // already re-linked

    // Find an order with matching customerName that has no invoice
    const matchOrder = await db.order.findFirst({
      where: {
        status: "COMPLETED",
        customerName: { equals: detInv.customerName, mode: "insensitive" },
        invoice: { is: null },
      },
      select: { id: true, orderNumber: true, customerName: true },
    });

    if (matchOrder) {
      await db.invoice.update({
        where: { id: detInv.id },
        data: { orderId: matchOrder.id },
      });
      console.log(
        `  [RE-LINKED] ${detInv.invoiceNumber} (${detInv.customerName}) → ${matchOrder.orderNumber}`
      );
      fixed++;
    } else {
      console.log(
        `  [ORPHAN] ${detInv.invoiceNumber} (${detInv.customerName}) — no matching order`
      );
    }
  }

  console.log(`\nTotal fixes: ${fixed}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
