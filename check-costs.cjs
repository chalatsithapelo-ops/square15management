const { PrismaClient } = require('./node_modules/.prisma/client');
const p = new PrismaClient();

(async () => {
  // Get all subscriptions with user and package info
  const subs = await p.subscription.findMany({
    include: {
      user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
      package: { select: { name: true, basePrice: true, type: true } }
    }
  });
  console.log('=== SUBSCRIPTIONS ===');
  console.log(JSON.stringify(subs, null, 2));

  // Count real users
  const realUserCount = await p.user.count({
    where: {
      email: {
        notIn: [
          'admin@propmanagement.com',
          'junior@propmanagement.com',
          'sarah@propmanagement.com',
          'mike@propmanagement.com',
          'emily@propmanagement.com'
        ]
      }
    }
  });
  console.log('\nReal users:', realUserCount);
  console.log('Total users:', await p.user.count());

  // Get all real users with roles
  const realUsers = await p.user.findMany({
    where: {
      email: {
        notIn: [
          'admin@propmanagement.com',
          'junior@propmanagement.com',
          'sarah@propmanagement.com',
          'mike@propmanagement.com',
          'emily@propmanagement.com'
        ]
      }
    },
    select: { id: true, email: true, role: true, firstName: true, lastName: true }
  });
  console.log('\n=== REAL USERS ===');
  console.log(JSON.stringify(realUsers, null, 2));

  await p.$disconnect();
})().catch(e => { console.error(e); process.exit(1); });
