// Send a test notification to the artisan (user 3) to verify the entire pipeline
const { PrismaClient } = require('@prisma/client');
const webpush = require('web-push');

const db = new PrismaClient();

// Load environment
require('dotenv').config();

(async () => {
  try {
    const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
    const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
    const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:admin@square15management.co.za';

    console.log('VAPID configured:', !!VAPID_PUBLIC_KEY, !!VAPID_PRIVATE_KEY);

    // 1. Create a notification in the database
    const notification = await db.notification.create({
      data: {
        recipientId: 3,
        recipientRole: 'ARTISAN',
        message: 'Welcome to Square 15! Your notification system is now active.',
        type: 'SYSTEM_ALERT',
        relatedEntityType: 'SYSTEM',
      },
    });
    console.log('DB notification created:', notification.id);

    // 2. Send push notification
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId: 3 },
    });
    console.log('Push subscriptions for artisan:', subscriptions.length);

    if (subscriptions.length > 0 && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
      webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

      for (const sub of subscriptions) {
        try {
          const payload = JSON.stringify({
            title: 'Square 15',
            body: 'Welcome to Square 15! Your notification system is now active.',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            tag: `notification-${notification.id}`,
            data: {
              notificationId: notification.id,
              type: 'SYSTEM',
              url: '/artisan/dashboard',
              userRole: 'ARTISAN',
            },
            silent: false,
            vibrate: [200, 100, 200],
            requireInteraction: true,
          });

          const result = await webpush.sendNotification(
            {
              endpoint: sub.endpoint,
              keys: {
                p256dh: sub.p256dh,
                auth: sub.auth,
              },
            },
            payload,
            { TTL: 86400 }
          );
          console.log('Push sent successfully! Status:', result.statusCode);
        } catch (pushError) {
          console.error('Push error:', pushError.statusCode, pushError.body);
          if (pushError.statusCode === 410 || pushError.statusCode === 404) {
            console.log('Subscription expired, deleting...');
            await db.pushSubscription.delete({ where: { id: sub.id } });
          }
        }
      }
    } else {
      console.log('No push subscriptions or VAPID not configured');
    }

    // Also create notifications for admin users to test admin bell
    const adminIds = [1, 2, 7, 21];
    for (const adminId of adminIds) {
      await db.notification.create({
        data: {
          recipientId: adminId,
          recipientRole: 'JUNIOR_ADMIN',
          message: 'Notification system test - all systems operational.',
          type: 'SYSTEM_ALERT',
          relatedEntityType: 'SYSTEM',
        },
      });
    }
    console.log('Admin test notifications created');

    // Create notification for contractor
    await db.notification.create({
      data: {
        recipientId: 8,
        recipientRole: 'CONTRACTOR',
        message: 'Notification system test - all systems operational.',
        type: 'SYSTEM_ALERT',
        relatedEntityType: 'SYSTEM',
      },
    });
    console.log('Contractor test notification created');

    console.log('\nDone! Check the artisan app for the bell notification and push notification.');
  } catch (e) {
    console.error('Error:', e);
  } finally {
    await db.$disconnect();
  }
})();
