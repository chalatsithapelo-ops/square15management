import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ADMIN_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "MANAGER",
  "TECHNICAL_MANAGER",
];

export const getEntityAuditLog = baseProcedure
  .input(
    z.object({
      token: z.string(),
      entityType: z.string(),
      entityId: z.number(),
      limit: z.number().int().min(1).max(500).default(200),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!ADMIN_ROLES.includes(user.role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to view audit history.",
      });
    }

    const entries = await db.auditLog.findMany({
      where: {
        entityType: input.entityType,
        entityId: input.entityId,
      },
      orderBy: { createdAt: "desc" },
      take: input.limit,
    });

    return entries.map((e) => {
      let parsedChanges: any = null;
      if (e.changes) {
        try {
          parsedChanges = JSON.parse(e.changes);
        } catch {
          parsedChanges = { raw: e.changes };
        }
      }
      return {
        id: e.id,
        createdAt: e.createdAt,
        userId: e.userId,
        userName: e.userName,
        action: e.action,
        module: e.module,
        description: e.description,
        changes: parsedChanges,
      };
    });
  });
