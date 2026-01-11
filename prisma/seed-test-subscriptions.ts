import { PrismaClient } from '@prisma/client';

const db = new PrismaClient();

async function main() {
  console.log('🌱 Creating test subscriptions...');

  // Find Thabo Ledwaba (Property Manager)
  const pm = await db.user.findFirst({
    where: {
      email: 'pm@propmanagement.com',
      role: 'PROPERTY_MANAGER',
    },
  });

  if (pm) {
    console.log(`\n📋 Found Property Manager: ${pm.firstName} ${pm.lastName} (${pm.email})`);

    // Find PM2 package
    const pm2Package = await db.package.findFirst({
      where: { name: 'PM2' },
    });

    if (pm2Package) {
      // Check if subscription exists
      const existingSub = await db.subscription.findFirst({
        where: { userId: pm.id },
      });

      if (existingSub) {
        console.log('  ⚠️  Subscription already exists, skipping...');
      } else {
        // Create active subscription with trial
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 25); // 25 days left in trial

        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        const subscription = await db.subscription.create({
          data: {
            userId: pm.id,
            packageId: pm2Package.id,
            status: 'TRIAL',
            startDate: new Date(),
            trialEndsAt: trialEnd,
            nextBillingDate: nextBilling,
            currentUsers: 1,
            maxUsers: 5,
            includedUsers: 5,
            additionalUsers: 0,
          },
        });

        console.log(`  ✅ Created TRIAL subscription for ${pm.firstName}: ${pm2Package.displayName}`);
        console.log(`     Trial expires: ${trialEnd.toLocaleDateString()}`);
      }
    }
  }

  // Find any contractors with portal access
  const contractors = await db.user.findMany({
    where: {
      role: { in: ['CONTRACTOR', 'CONTRACTOR_SENIOR_MANAGER'] },
    },
    take: 2,
  });

  if (contractors.length > 0) {
    console.log(`\n📋 Found ${contractors.length} Contractors with portal access`);

    // Find S4 and S6 packages
    const s4Package = await db.package.findFirst({ where: { name: 'S4' } });
    const s6Package = await db.package.findFirst({ where: { name: 'S6' } });

    for (const contractor of contractors) {
      const existingSub = await db.subscription.findFirst({
        where: { userId: contractor.id },
      });

      if (existingSub) {
        console.log(`  ⚠️  ${contractor.firstName} ${contractor.lastName} already has subscription, skipping...`);
        continue;
      }

      // First contractor gets S4 ACTIVE
      if (contractors.indexOf(contractor) === 0 && s4Package) {
        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await db.subscription.create({
          data: {
            userId: contractor.id,
            packageId: s4Package.id,
            status: 'ACTIVE',
            startDate: new Date(),
            nextBillingDate: nextBilling,
            currentUsers: 1,
            maxUsers: 3,
            includedUsers: 3,
            additionalUsers: 0,
          },
        });

        console.log(`  ✅ Created ACTIVE subscription for ${contractor.firstName}: ${s4Package.displayName}`);
      }

      // Second contractor gets S6 TRIAL
      if (contractors.indexOf(contractor) === 1 && s6Package) {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + 20); // 20 days left

        const nextBilling = new Date();
        nextBilling.setMonth(nextBilling.getMonth() + 1);

        await db.subscription.create({
          data: {
            userId: contractor.id,
            packageId: s6Package.id,
            status: 'TRIAL',
            startDate: new Date(),
            trialEndsAt: trialEnd,
            nextBillingDate: nextBilling,
            currentUsers: 1,
            maxUsers: 5,
            includedUsers: 5,
            additionalUsers: 0,
          },
        });

        console.log(`  ✅ Created TRIAL subscription for ${contractor.firstName}: ${s6Package.displayName}`);
        console.log(`     Trial expires: ${trialEnd.toLocaleDateString()}`);
      }
    }
  }

  // Create a pending registration
  console.log('\n📋 Creating test pending registration...');

  const existingPending = await db.pendingRegistration.findFirst({
    where: { email: 'test.contractor@example.com' },
  });

  if (existingPending) {
    console.log('  ⚠️  Pending registration already exists, skipping...');
  } else {
    const s3Package = await db.package.findFirst({ where: { name: 'S3' } });

    if (s3Package) {
      await db.pendingRegistration.create({
        data: {
          firstName: 'John',
          lastName: 'Builder',
          email: 'test.contractor@example.com',
          phone: '0821234567',
          companyName: 'Builder Co.',
          accountType: 'CONTRACTOR',
          packageId: s3Package.id,
          additionalUsers: 2,
          additionalTenants: 0,
          hasPaid: false,
        },
      });

      console.log('  ✅ Created pending registration for John Builder (S3 package, NOT paid)');
    }
  }

  console.log('\n✅ Test subscription data created successfully!\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
