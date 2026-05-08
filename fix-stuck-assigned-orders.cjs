// One-off backfill: orders that have an assigned artisan but are still PENDING
// (caused by convertQuotationToInvoice ternary bug). Promote them to ASSIGNED
// so the artisan dashboard / flow picks them up.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const stuck = await db.order.findMany({
    where: { status: "PENDING", assignedToId: { not: null } },
    select: { id: true, orderNumber: true, assignedToId: true },
  });

  console.log(`Found ${stuck.length} stuck order(s) (PENDING but with an assigned artisan).`);
  for (const o of stuck) {
    console.log(`- ${o.orderNumber} (id=${o.id}) -> artisan #${o.assignedToId}`);
  }

  if (stuck.length === 0) {
    await db.$disconnect();
    return;
  }

  const updated = await db.order.updateMany({
    where: { status: "PENDING", assignedToId: { not: null } },
    data: { status: "ASSIGNED" },
  });
  console.log(`Promoted ${updated.count} order(s) to ASSIGNED.`);

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
