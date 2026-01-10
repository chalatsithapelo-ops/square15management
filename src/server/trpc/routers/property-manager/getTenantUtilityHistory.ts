import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantUtilityHistory = baseProcedure
  .input(
    z.object({
      token: z.string(),
      tenantId: z.number(),
      utilityType: z.enum(["ELECTRICITY", "WATER", "GAS", "INTERNET"]).optional(),
      limit: z.number().min(1).max(100).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;

    // Verify tenant belongs to this PM
    const tenant = await db.propertyManagerCustomer.findFirst({
      where: {
        id: input.tenantId,
        propertyManagerId: userId,
      },
    });

    if (!tenant) {
      return [];
    }

    const utilityReadings = await db.utilityReading.findMany({
      where: {
        tenantId: input.tenantId,
        propertyManagerId: userId,
        utilityType: input.utilityType,
      },
      orderBy: {
        readingDate: "desc",
      },
      take: input.limit || 12,
    });

    // Calculate summary by utility type
    const summary = utilityReadings.reduce((acc, reading) => {
      const type = reading.utilityType;
      if (!acc[type]) {
        acc[type] = {
          totalConsumption: 0,
          totalCost: 0,
          readingCount: 0,
        };
      }
      acc[type].totalConsumption += reading.consumption;
      acc[type].totalCost += reading.totalCost || 0;
      acc[type].readingCount += 1;
      return acc;
    }, {} as Record<string, { totalConsumption: number; totalCost: number; readingCount: number }>);

    return {
      utilityReadings,
      summary,
    };
  });
