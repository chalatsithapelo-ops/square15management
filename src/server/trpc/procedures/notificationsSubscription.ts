import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { notificationEvents } from "~/server/utils/notification-events";
import { Notification } from "@prisma/client";

export const notificationsSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .subscription(async function* ({ input }) {
    try {
      // Verify JWT token and extract user ID
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);
      const userId = parsed.userId;

      // Create a queue to buffer notifications
      const notificationQueue: Notification[] = [];
      let resolve: (() => void) | null = null;

      // Set up event listener for new notifications
      const handleNotification = (event: { notification: Notification }) => {
        notificationQueue.push(event.notification);
        if (resolve) {
          resolve();
          resolve = null;
        }
      };

      // Subscribe to notifications for this user
      notificationEvents.onNotification(userId, handleNotification);

      try {
        // Stream notifications as they arrive
        while (true) {
          // If queue is empty, wait for a notification
          if (notificationQueue.length === 0) {
            await new Promise<void>((res) => {
              resolve = res;
            });
          }

          // Yield all queued notifications
          while (notificationQueue.length > 0) {
            const notification = notificationQueue.shift();
            if (notification) {
              yield notification;
            }
          }
        }
      } finally {
        // Clean up event listener when subscription ends
        notificationEvents.offNotification(userId, handleNotification);
      }
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
