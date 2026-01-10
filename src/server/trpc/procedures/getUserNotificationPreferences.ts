import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getUserNotificationPreferences = publicProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async (opts) => {
    const input = opts?.input;

    if (!input || typeof input.token !== "string") {
      return { disabledNotificationTypes: [] };
    }

    const user = await authenticateUser(input.token);

    const userData = await db.user.findUnique({
      where: { id: user.id },
      select: { disabledNotificationTypes: true },
    });

    return {
      disabledNotificationTypes: userData?.disabledNotificationTypes || [],
    };
  });
