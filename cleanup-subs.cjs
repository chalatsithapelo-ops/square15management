const { PrismaClient } = require('@prisma/client');
const db = new PrismaClient();
(async () => {
  const r = await db.pushSubscription.deleteMany({});
  console.log('Deleted stale subs:', r.count);
  await db.$disconnect();
})();
