import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const markNotificationAsRead = baseProcedure
  .input(
    z.object({
      token: z.string(),
      notificationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    // Verify the notification exists and belongs to the user
    const notification = await db.notification.findFirst({
      where: {
        id: input.notificationId,
        recipientId: user.id,
      },
    });

    if (!notification) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Notification not found or access denied",
      });
    }

    // Mark as read
    await db.notification.update({
      where: { id: input.notificationId },
      data: { isRead: true },
    });

    return { success: true };
  });
