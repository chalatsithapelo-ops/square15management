import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const subscribeToPush = baseProcedure
  .input(
    z.object({
      token: z.string(),
      subscription: z.object({
        endpoint: z.string().url(),
        keys: z.object({
          p256dh: z.string(),
          auth: z.string(),
        }),
      }),
      deviceIdentifier: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    try {
      // Check if subscription already exists for this endpoint
      const existing = await db.pushSubscription.findUnique({
        where: { endpoint: input.subscription.endpoint },
      });

      if (existing) {
        // Update existing subscription
        const updated = await db.pushSubscription.update({
          where: { endpoint: input.subscription.endpoint },
          data: {
            userId: user.id,
            p256dh: input.subscription.keys.p256dh,
            auth: input.subscription.keys.auth,
            deviceIdentifier: input.deviceIdentifier,
          },
        });
        return { success: true, subscription: updated };
      }

      // Create new subscription
      const subscription = await db.pushSubscription.create({
        data: {
          userId: user.id,
          endpoint: input.subscription.endpoint,
          p256dh: input.subscription.keys.p256dh,
          auth: input.subscription.keys.auth,
          deviceIdentifier: input.deviceIdentifier,
        },
      });

      // Clean up old/stale subscriptions for this user (different endpoints)
      try {
        await db.pushSubscription.deleteMany({
          where: {
            userId: user.id,
            id: { not: subscription.id },
          },
        });
      } catch (cleanupError) {
        console.error("Failed to clean up old push subscriptions:", cleanupError);
      }

      return { success: true, subscription };
    } catch (error) {
      console.error("Failed to save push subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to save push subscription",
      });
    }
  });
