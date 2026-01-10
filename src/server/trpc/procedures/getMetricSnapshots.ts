import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getMetricSnapshots = baseProcedure
  .input(
    z.object({
      token: z.string(),
      metricType: z.enum(["DAILY", "MONTHLY"]).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      limit: z.number().optional().default(30),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.VIEW_DASHBOARD_ANALYTICS);

    const whereClause: any = {};
    
    if (input.metricType) {
      whereClause.metricType = input.metricType;
    }
    
    if (input.startDate || input.endDate) {
      whereClause.snapshotDate = {};
      if (input.startDate) {
        whereClause.snapshotDate.gte = new Date(input.startDate);
      }
      if (input.endDate) {
        whereClause.snapshotDate.lte = new Date(input.endDate);
      }
    }

    const snapshots = await db.metricSnapshot.findMany({
      where: whereClause,
      orderBy: {
        snapshotDate: "desc",
      },
      take: input.limit,
    });

    return snapshots;
  });
