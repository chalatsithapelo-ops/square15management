import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getEmployeeRoleCounts = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    await authenticateUser(input.token);
    const rows = await db.user.groupBy({
      by: ["role"],
      where: { deletedAt: null },
      _count: { _all: true },
    });
    return rows.map((r) => ({ role: r.role, count: r._count._all }));
  });
