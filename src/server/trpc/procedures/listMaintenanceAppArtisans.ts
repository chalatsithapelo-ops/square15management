/**
 * listMaintenanceAppArtisans — HR tool listing of every Maintenance App
 * artisan we have hired via the recruitment portal, alongside their
 * approval status and Firestore doc ids for cross-app navigation.
 */
import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";

export const listMaintenanceAppArtisans = baseProcedure
  .input(z.object({
    token: z.string(),
    status: z.enum(["ALL", "PENDING", "APPROVED", "REJECTED"]).default("ALL"),
  }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin role required");
    const where: any = {};
    if (input.status !== "ALL") where.status = input.status;
    const rows = await db.maintenanceArtisanLink.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 200,
      include: {
        application: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            primaryTrade: true,
            city: true,
            province: true,
            overallScore: true,
            hiredAt: true,
            onboardedUserId: true,
            stageBucket: true,
          },
        },
      },
    });
    const counts = await db.maintenanceArtisanLink.groupBy({
      by: ["status"],
      _count: { _all: true },
    });
    return { rows, counts };
  });
