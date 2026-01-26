import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantsOverview = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number().optional(),
      buildingId: z.number().optional(),
      status: z.enum(["PENDING", "ACTIVE", "INACTIVE", "MOVED_OUT"]).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;
    const propertyManagerId = input.propertyManagerId || userId;

    const tenants = await db.propertyManagerCustomer.findMany({
      where: {
        propertyManagerId: propertyManagerId,
        buildingId: input.buildingId,
        status: input.status,
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            rentPayments: true,
            utilityReadings: true,
          },
        },
      },
      orderBy: [
        { status: "asc" },
        { lastName: "asc" },
      ],
    });

    // Calculate metrics
    const metrics = {
      totalTenants: tenants.length,
      activeTenants: tenants.filter((t) => t.status === "ACTIVE").length,
      pendingOnboarding: tenants.filter((t) => t.onboardingStatus === "PENDING").length,
      totalMonthlyRent: tenants
        .filter((t) => t.status === "ACTIVE" && t.monthlyRent)
        .reduce((sum, t) => sum + (t.monthlyRent || 0), 0),
    };

    return {
      tenants,
      metrics,
    };
  });
