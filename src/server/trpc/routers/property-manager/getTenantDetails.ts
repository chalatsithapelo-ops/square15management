import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getTenantDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;

    const tenant = await db.propertyManagerCustomer.findUnique({
      where: { id: input.customerId },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            state: true,
            zipCode: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            name: true,
          },
        },
        rentPayments: {
          orderBy: { dueDate: "desc" },
          take: 12,
        },
        utilityReadings: {
          orderBy: { readingDate: "desc" },
          take: 12,
        },
        _count: {
          select: {
            rentPayments: true,
            utilityReadings: true,
          },
        },
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found.",
      });
    }

    if (tenant.propertyManagerId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only view your own tenants.",
      });
    }

    // Calculate rent payment metrics
    const rentMetrics = {
      totalPaid: tenant.rentPayments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amountPaid, 0),
      totalOutstanding: tenant.rentPayments
        .filter((p) => ["PENDING", "PARTIAL", "OVERDUE"].includes(p.status))
        .reduce((sum, p) => sum + (p.amount - p.amountPaid), 0),
      overdueCount: tenant.rentPayments.filter((p) => p.status === "OVERDUE").length,
    };

    return {
      tenant,
      rentMetrics,
    };
  });
