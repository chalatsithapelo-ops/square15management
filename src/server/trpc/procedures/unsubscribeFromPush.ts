import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const unsubscribeFromPush = baseProcedure
  .input(
    z.object({
      token: z.string(),
      endpoint: z.string().url(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    try {
      // Delete the subscription
      await db.pushSubscription.deleteMany({
        where: {
          userId: user.id,
          endpoint: input.endpoint,
        },
      });

      return { success: true };
    } catch (error) {
      console.error("Failed to remove push subscription:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to remove push subscription",
      });
    }
  });
