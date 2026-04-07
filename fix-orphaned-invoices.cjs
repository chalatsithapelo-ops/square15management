/**
 * Fix orphaned invoices — link invoices back to their orders
 * by matching on customerName + customerEmail + address.
 *
 * Run: node fix-orphaned-invoices.cjs
 */
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  // Find invoices that have no orderId
  const orphaned = await db.invoice.findMany({
    where: { orderId: null },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerEmail: true,
      address: true,
    },
  });

  console.log(`Found ${orphaned.length} invoices without orderId`);

  let fixed = 0;
  let alreadyLinked = 0;
  let noMatch = 0;

  for (const inv of orphaned) {
    // Try to find a matching completed order
    const matchingOrders = await db.order.findMany({
      where: {
        customerName: inv.customerName,
        customerEmail: inv.customerEmail,
        status: "COMPLETED",
      },
      select: {
        id: true,
        orderNumber: true,
        address: true,
        invoice: { select: { id: true } },
      },
    });

    // Filter to orders that don't already have an invoice linked
    const available = matchingOrders.filter((o) => !o.invoice);

    if (available.length === 0) {
      // Try a broader match on just customerEmail
      const broaderMatch = await db.order.findMany({
        where: {
          customerEmail: inv.customerEmail,
          status: "COMPLETED",
        },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          address: true,
          invoice: { select: { id: true } },
        },
      });

      const broaderAvailable = broaderMatch.filter((o) => !o.invoice);

      if (broaderAvailable.length === 0) {
        console.log(`  [NO MATCH] ${inv.invoiceNumber} (${inv.customerName} / ${inv.customerEmail})`);
        noMatch++;
        continue;
      }

      // Pick the best match by address similarity
      const best = broaderAvailable.find((o) =>
        o.address && inv.address && 
        (o.address.toLowerCase().includes(inv.address.toLowerCase().substring(0, 10)) ||
         inv.address.toLowerCase().includes(o.address.toLowerCase().substring(0, 10)))
      ) || broaderAvailable[0];

      await db.invoice.update({
        where: { id: inv.id },
        data: { orderId: best.id },
      });
      console.log(`  [FIXED-BROAD] ${inv.invoiceNumber} → ${best.orderNumber} (${best.customerName})`);
      fixed++;
      continue;
    }

    // If only one match, link it
    if (available.length === 1) {
      await db.invoice.update({
        where: { id: inv.id },
        data: { orderId: available[0].id },
      });
      console.log(`  [FIXED] ${inv.invoiceNumber} → ${available[0].orderNumber}`);
      fixed++;
      continue;
    }

    // Multiple matches — try to narrow by address
    const addressMatch = available.find(
      (o) => o.address && inv.address && o.address.toLowerCase() === inv.address.toLowerCase()
    );

    if (addressMatch) {
      await db.invoice.update({
        where: { id: inv.id },
        data: { orderId: addressMatch.id },
      });
      console.log(`  [FIXED-ADDR] ${inv.invoiceNumber} → ${addressMatch.orderNumber}`);
      fixed++;
    } else {
      // Link to the first available match
      await db.invoice.update({
        where: { id: inv.id },
        data: { orderId: available[0].id },
      });
      console.log(`  [FIXED-FIRST] ${inv.invoiceNumber} → ${available[0].orderNumber} (${available.length} candidates)`);
      fixed++;
    }
  }

  console.log(`\nDone: ${fixed} fixed, ${noMatch} no match, ${alreadyLinked} already linked`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
