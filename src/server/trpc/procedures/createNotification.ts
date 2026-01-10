import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { NotificationType } from "@prisma/client";
import { notificationEvents } from "~/server/utils/notification-events";

export const createNotification = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientId: z.number(),
      message: z.string().min(1),
      type: z.nativeEnum(NotificationType),
      relatedEntityId: z.number().optional(),
      relatedEntityType: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate the user making the request
    await authenticateUser(input.token);

    // Verify the recipient exists
    const recipient = await db.user.findUnique({
      where: { id: input.recipientId },
    });

    if (!recipient) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Recipient user not found",
      });
    }

    // Create the notification
    const notification = await db.notification.create({
      data: {
        recipientId: input.recipientId,
        recipientRole: recipient.role,
        message: input.message,
        type: input.type,
        relatedEntityId: input.relatedEntityId,
        relatedEntityType: input.relatedEntityType,
      },
      include: {
        recipient: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    // Emit notification event for real-time push
    notificationEvents.emitNotification(input.recipientId, notification);

    return notification;
  });
