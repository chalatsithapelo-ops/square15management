const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

(async () => {
  // Check recent RFQs
  const rfqs = await db.propertyManagerRFQ.findMany({
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true, rfqNumber: true, title: true, selectedContractorIds: true, createdAt: true, propertyManagerId: true },
  });
  console.log("Recent RFQs:");
  rfqs.forEach(r => console.log(JSON.stringify(r)));

  // Check notifications for artisan user ID 3
  const artisanNotifs = await db.notification.findMany({
    where: { recipientId: 3 },
    orderBy: { createdAt: "desc" },
    take: 5,
  });
  console.log("\nNotifications for artisan (ID 3):", artisanNotifs.length);
  artisanNotifs.forEach(n => console.log(JSON.stringify({ type: n.type, msg: n.message.substring(0, 80), read: n.isRead, date: n.createdAt })));

  // Check all notifications from last 24 hours
  const yesterday = new Date(Date.now() - 86400000);
  const recentNotifs = await db.notification.findMany({
    where: { createdAt: { gte: yesterday } },
    orderBy: { createdAt: "desc" },
  });
  console.log("\nNotifications from last 24h:", recentNotifs.length);
  recentNotifs.forEach(n => console.log(JSON.stringify({ to: n.recipientId, role: n.recipientRole, type: n.type, msg: n.message.substring(0, 80) })));

  // Check all contractor users and their IDs
  const contractors = await db.contractor.findMany({
    select: { id: true, companyName: true, email: true, portalAccessEnabled: true },
  });
  console.log("\nContractor table entries:");
  contractors.forEach(c => console.log(JSON.stringify(c)));
})().finally(() => db.$disconnect());
