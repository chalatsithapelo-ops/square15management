import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getUnreadNotificationCount = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    // Count unread notifications
    const count = await db.notification.count({
      where: {
        recipientId: user.id,
        isRead: false,
      },
    });

    return count;
  });
