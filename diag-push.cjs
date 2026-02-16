const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');
const db = new PrismaClient();

(async () => {
  try {
    // Show full endpoints
    const subs = await db.pushSubscription.findMany({
      select: { id: true, userId: true, endpoint: true, p256dh: true, auth: true, createdAt: true },
    });
    console.log('=== PUSH SUBSCRIPTIONS (full) ===');
    subs.forEach(s => {
      console.log(`  Sub ${s.id} | user ${s.userId} | created ${s.createdAt}`);
      console.log(`    endpoint: ${s.endpoint}`);
      console.log(`    p256dh: ${s.p256dh.substring(0, 30)}...`);
      console.log(`    auth: ${s.auth}`);
    });

    // Check if endpoints are different
    const endpoints = subs.map(s => s.endpoint);
    const unique = [...new Set(endpoints)];
    console.log(`\n  Unique endpoints: ${unique.length} / ${subs.length} total`);

    // Now try sending a test push to artisan (user 3)
    const artisanSubs = subs.filter(s => s.userId === 3);
    if (artisanSubs.length === 0) {
      console.log('\nNo push subscriptions for artisan (user 3)!');
    } else {
      console.log(`\nSending test push to artisan (${artisanSubs.length} subscriptions)...`);

      // Set VAPID
      webpush.setVapidDetails(
        process.env.VAPID_SUBJECT,
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
      );

      for (const sub of artisanSubs) {
        try {
          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: { p256dh: sub.p256dh, auth: sub.auth },
            },
            JSON.stringify({
              title: 'Square 15 Test',
              body: 'Push notification test - if you see this, push is working!',
              icon: '/icon-192x192.png',
              badge: '/icon-72x72.png',
              tag: 'test-push-' + Date.now(),
              data: { url: '/artisan/dashboard' },
            }),
            { TTL: 86400 }
          );
          console.log(`  Sub ${sub.id}: SUCCESS - HTTP ${result.statusCode}`);
          console.log(`    Headers:`, JSON.stringify(result.headers));
        } catch (err) {
          console.log(`  Sub ${sub.id}: FAILED - ${err.statusCode} ${err.message}`);
          if (err.body) console.log(`    Body: ${err.body}`);
        }
      }
    }
  } catch (e) {
    console.error('Error:', e.message);
  } finally {
    await db.$disconnect();
  }
})();
