const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

async function main() {
  const subs = await db.pushSubscription.findMany();
  console.log("Total push subscriptions:", subs.length);
  for (const s of subs) {
    console.log(`  User ${s.userId}: ${s.endpoint.substring(0, 80)}...`);
  }
  
  // Check recent notifications
  const recentNotifs = await db.notification.findMany({
    orderBy: { createdAt: "desc" },
    take: 10,
    include: { recipient: { select: { firstName: true, lastName: true, role: true } } },
  });
  console.log("\nRecent 10 notifications:");
  for (const n of recentNotifs) {
    console.log(`  [${n.createdAt.toISOString()}] To: ${n.recipient.firstName} ${n.recipient.lastName} (${n.recipient.role}) - Type: ${n.type} - Read: ${n.isRead}`);
    console.log(`    Message: ${n.message.substring(0, 100)}`);
  }

  // Check artisan users
  const artisans = await db.user.findMany({
    where: { role: { in: ["ARTISAN", "CONTRACTOR"] } },
    select: { id: true, firstName: true, lastName: true, role: true, email: true },
  });
  console.log("\nArtisan/Contractor users:");
  for (const a of artisans) {
    console.log(`  ID ${a.id}: ${a.firstName} ${a.lastName} (${a.role}) - ${a.email}`);
  }
}

main().catch(console.error).finally(() => db.$disconnect());
