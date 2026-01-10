import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getDistinctRoles = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const users = await db.user.findMany({
      select: {
        role: true,
      },
      distinct: ['role'],
      orderBy: {
        role: 'asc',
      },
    });

    return users.map(u => u.role);
  });
