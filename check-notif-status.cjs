const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

(async () => {
  try {
    // Push subscriptions
    const subs = await db.pushSubscription.findMany({
      select: { id: true, userId: true, createdAt: true, endpoint: true },
    });
    console.log('=== PUSH SUBSCRIPTIONS ===');
    console.log('Total:', subs.length);
    subs.forEach(s => console.log(`  Sub ${s.id} | user ${s.userId} | ${s.createdAt} | ${s.endpoint.substring(0, 80)}...`));

    // Artisan notifications
    const artisanNotifs = await db.notification.findMany({
      where: { recipientId: 3 },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, type: true, message: true, isRead: true, createdAt: true, relatedEntityType: true },
    });
    console.log('\n=== ARTISAN (ID 3) NOTIFICATIONS ===');
    console.log('Total:', artisanNotifs.length);
    artisanNotifs.forEach(n => console.log(`  ${n.id} | ${n.type} | read:${n.isRead} | ${n.relatedEntityType} | ${n.message.substring(0, 70)} | ${n.createdAt}`));

    // Check quotations assigned to artisan
    const artisanQuotations = await db.quotation.findMany({
      where: { assignedToId: 3 },
      select: { id: true, quoteNumber: true, status: true, assignedToId: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    console.log('\n=== QUOTATIONS ASSIGNED TO ARTISAN ===');
    console.log('Total:', artisanQuotations.length);
    artisanQuotations.forEach(q => console.log(`  ${q.id} | ${q.quoteNumber} | ${q.status} | ${q.createdAt}`));

    // Check recent notifications of ALL types
    const recentNotifs = await db.notification.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, recipientId: true, recipientRole: true, type: true, message: true, createdAt: true },
    });
    console.log('\n=== LAST 10 NOTIFICATIONS (ALL USERS) ===');
    recentNotifs.forEach(n => console.log(`  ${n.id} | user ${n.recipientId} | ${n.recipientRole} | ${n.type} | ${n.message.substring(0, 60)} | ${n.createdAt}`));

  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await db.$disconnect();
  }
})();
