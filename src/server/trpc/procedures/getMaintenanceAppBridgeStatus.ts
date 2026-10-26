/**
 * Admin-only healthcheck for the Maintenance App bridge.
 * Verifies the Firebase service account works and lists any PENDING
 * MaintenanceArtisanLink rows.
 */
import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import { maintenanceAppHealthCheck } from "~/server/services/maintenanceAppBridge";

export const getMaintenanceAppBridgeStatus = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin role required");
    const health = await maintenanceAppHealthCheck();
    const links = await db.maintenanceArtisanLink.findMany({
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        application: { select: { id: true, firstName: true, lastName: true, email: true, primaryTrade: true } },
      },
    });
    const counts = await db.maintenanceArtisanLink.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return { health, links, counts };
  });
