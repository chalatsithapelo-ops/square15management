import webpush from "web-push";
import { env } from "~/server/env";
import { db } from "~/server/db";

// Initialize web-push with VAPID details
let isConfigured = false;

function ensureWebPushConfigured() {
  if (isConfigured) return true;
  
  const publicKey = env.VAPID_PUBLIC_KEY;
  const privateKey = env.VAPID_PRIVATE_KEY;
  const subject = env.VAPID_SUBJECT;

  if (!publicKey || !privateKey || !subject) {
    console.warn("Web Push is not configured. Set VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT environment variables.");
    return false;
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);
  isConfigured = true;
  return true;
}

export interface PushNotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  tag?: string;
  requireInteraction?: boolean;
}

/**
 * Send a push notification to a specific user
 */
export async function sendPushNotificationToUser(
  userId: number,
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureWebPushConfigured()) {
    return { sent: 0, failed: 0 };
  }

  try {
    // Get all push subscriptions for the user
    const subscriptions = await db.pushSubscription.findMany({
      where: { userId },
    });

    if (subscriptions.length === 0) {
      return { sent: 0, failed: 0 };
    }

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        try {
          const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          };

          await webpush.sendNotification(
            pushSubscription,
            JSON.stringify(payload),
            {
              TTL: 86400, // 24 hours
            }
          );
          return { success: true };
        } catch (error: any) {
          // If subscription is invalid or expired, delete it
          if (error.statusCode === 410 || error.statusCode === 404) {
            await db.pushSubscription.delete({
              where: { id: sub.id },
            }).catch(() => {
              // Ignore deletion errors
            });
          }
          console.error(`Failed to send push to subscription ${sub.id}:`, error.message);
          return { success: false };
        }
      })
    );

    const sent = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;
    const failed = results.length - sent;

    return { sent, failed };
  } catch (error) {
    console.error("Error sending push notification:", error);
    return { sent: 0, failed: 0 };
  }
}

/**
 * Send a push notification to multiple users
 */
export async function sendPushNotificationToUsers(
  userIds: number[],
  payload: PushNotificationPayload
): Promise<{ sent: number; failed: number }> {
  if (!ensureWebPushConfigured()) {
    return { sent: 0, failed: 0 };
  }

  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushNotificationToUser(userId, payload))
  );

  const totals = results.reduce(
    (acc, result) => {
      if (result.status === "fulfilled") {
        acc.sent += result.value.sent;
        acc.failed += result.value.failed;
      }
      return acc;
    },
    { sent: 0, failed: 0 }
  );

  return totals;
}
