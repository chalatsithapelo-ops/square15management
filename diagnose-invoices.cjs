const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  // Check the specific orders from the screenshot
  const orders = await db.order.findMany({
    where: {
      orderNumber: {
        in: ["ORD-00021", "ORD-00019", "ORD-00017", "ORD-00011", "ORD-00010"],
      },
    },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      customerEmail: true,
      status: true,
      invoice: { select: { id: true, invoiceNumber: true } },
    },
  });
  console.log("ORDERS:");
  orders.forEach((o) =>
    console.log(
      `  ${o.orderNumber} | ${o.customerName} | ${o.customerEmail} | status=${o.status} | invoice=${o.invoice ? o.invoice.invoiceNumber : "NONE"}`
    )
  );

  // Check all invoices with cityprop email
  const invs = await db.invoice.findMany({
    where: { customerEmail: { contains: "cityprop", mode: "insensitive" } },
    select: {
      id: true,
      invoiceNumber: true,
      customerName: true,
      customerEmail: true,
      orderId: true,
    },
  });
  console.log("\nCITYPROP INVOICES:");
  invs.forEach((i) =>
    console.log(
      `  ${i.invoiceNumber} | ${i.customerName} | orderId=${i.orderId || "NULL"}`
    )
  );

  // Count all completed orders without invoice
  const completedNoInv = await db.order.findMany({
    where: { status: "COMPLETED" },
    select: {
      id: true,
      orderNumber: true,
      customerName: true,
      invoice: { select: { id: true } },
    },
  });
  const withoutInv = completedNoInv.filter((o) => !o.invoice);
  console.log(
    `\nCompleted orders: ${completedNoInv.length} total, ${withoutInv.length} WITHOUT invoice`
  );
  withoutInv.forEach((o) =>
    console.log(`  ${o.orderNumber} | ${o.customerName}`)
  );

  await db.$disconnect();
})();
