const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();
async function main() {
  const campaigns = await p.campaign.findMany({
    select: { id: true, name: true, status: true, createdById: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
    take: 10
  });
  console.log('CAMPAIGNS:', JSON.stringify(campaigns, null, 2));
  const demoUsers = await p.user.findMany({
    where: { email: { in: ['admin@propmanagement.com','junior@propmanagement.com','pm@propmanagement.com','contractor@propmanagement.com','artisan@propmanagement.com','artisan2@propmanagement.com'] } },
    select: { id: true, email: true }
  });
  console.log('DEMO_USERS:', JSON.stringify(demoUsers));
  const realUsers = await p.user.findMany({
    where: { email: { notIn: ['admin@propmanagement.com','junior@propmanagement.com','pm@propmanagement.com','contractor@propmanagement.com','artisan@propmanagement.com','artisan2@propmanagement.com'] } },
    select: { id: true, email: true },
    take: 5
  });
  console.log('REAL_USERS:', JSON.stringify(realUsers));
  await p.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
