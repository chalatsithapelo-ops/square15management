import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";
import { NotificationType } from "@prisma/client";

export const updateUserNotificationPreferences = publicProcedure
  .input(
    z.object({
      token: z.string(),
      disabledTypes: z.array(z.nativeEnum(NotificationType)),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    await db.user.update({
      where: { id: user.id },
      data: {
        disabledNotificationTypes: input.disabledTypes,
      },
    });

    return {
      success: true,
      disabledNotificationTypes: input.disabledTypes,
    };
  });
