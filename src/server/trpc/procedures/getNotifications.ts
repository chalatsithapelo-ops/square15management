import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { NotificationType } from "@prisma/client";

export const getNotifications = baseProcedure
  .input(
    z.object({
      token: z.string(),
      isRead: z.boolean().optional(),
      type: z.nativeEnum(NotificationType).optional(),
      limit: z.number().min(1).max(100).default(50),
    })
  )
  .query(async ({ input }) => {
    // Authenticate the user
    const user = await authenticateUser(input.token);

    // Build the where clause
    // IMPORTANT: Do not filter by recipientRole.
    // Users can change roles (e.g. contractor manager roles) while notifications may have been created
    // with a different role value. recipientId is the stable identity.
    const where: any = {
      recipientId: user.id,
    };

    if (input.isRead !== undefined) {
      where.isRead = input.isRead;
    }

    if (input.type) {
      where.type = input.type;
    }

    // Fetch notifications
    const notifications = await db.notification.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
      take: input.limit,
    });

    return notifications;
  });
