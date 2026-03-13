const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();

async function main() {
  // Find the real admin
  const realAdmin = await db.user.findUnique({ where: { email: 'chalatsithapelo@gmail.com' } });
  if (!realAdmin) { console.log('Real admin not found'); return; }
  
  // Find demo user IDs
  const demoEmails = [
    'admin@propmanagement.com',
    'junior@propmanagement.com',
    'pm@propmanagement.com',
    'contractor@propmanagement.com',
    'artisan@propmanagement.com',
    'artisan2@propmanagement.com',
    'customer@example.com'
  ];
  const demoUsers = await db.user.findMany({ where: { email: { in: demoEmails } }, select: { id: true } });
  const demoIds = demoUsers.map(u => u.id);
  console.log('Demo user IDs:', demoIds);
  
  // Count notifications on real admin
  const total = await db.notification.count({ where: { recipientId: realAdmin.id } });
  console.log('Total notifications on real admin:', total);
  
  // Delete notifications on real admin that reference demo data
  // These were created by the seed script or triggered by demo activity
  const deleted = await db.notification.deleteMany({
    where: {
      recipientId: realAdmin.id,
      OR: [
        { createdById: { in: demoIds } },
        { message: { contains: 'demo' } },
        { message: { contains: 'Demo' } },
      ]
    }
  });
  console.log('Deleted', deleted.count, 'cross-contaminated notifications from real admin');
  
  const remaining = await db.notification.count({ where: { recipientId: realAdmin.id } });
  console.log('Remaining notifications:', remaining);
  
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
