import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantRentInvoiceTracking = baseProcedure
  .input(
    z.object({
      token: z.string(),
      tenantIds: z.array(z.number().int().positive()).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const propertyManagerId = user.id;

    const now = new Date();

    const tenantsOwned = await db.propertyManagerCustomer.findMany({
      where: {
        propertyManagerId,
        ...(input.tenantIds?.length ? { id: { in: input.tenantIds } } : {}),
      },
      select: { id: true },
    });

    const allowedTenantIds = new Set(tenantsOwned.map((t) => t.id));

    const baseWhere = {
      propertyManagerId,
      ...(input.tenantIds?.length
        ? {
            tenantId: {
              in: input.tenantIds.filter((id) => allowedTenantIds.has(id)),
            },
          }
        : {}),
    } as const;

    const issuedCounts = await db.rentPayment.groupBy({
      by: ["tenantId"],
      where: baseWhere,
      _count: { _all: true },
    });

    const paidCounts = await db.rentPayment.groupBy({
      by: ["tenantId"],
      where: { ...baseWhere, status: "PAID" },
      _count: { _all: true },
    });

    const overdueCounts = await db.rentPayment.groupBy({
      by: ["tenantId"],
      where: {
        ...baseWhere,
        OR: [
          { status: "OVERDUE" },
          {
            status: { in: ["PENDING", "PARTIAL"] },
            dueDate: { lt: now },
          },
        ],
      },
      _count: { _all: true },
    });

    const outstandingSums = await db.rentPayment.groupBy({
      by: ["tenantId"],
      where: {
        ...baseWhere,
        status: { in: ["PENDING", "PARTIAL", "OVERDUE"] },
      },
      _sum: {
        amount: true,
        amountPaid: true,
        lateFee: true,
      },
    });

    const issuedByTenantId = new Map(issuedCounts.map((r) => [r.tenantId, r._count._all]));
    const paidByTenantId = new Map(paidCounts.map((r) => [r.tenantId, r._count._all]));
    const overdueByTenantId = new Map(overdueCounts.map((r) => [r.tenantId, r._count._all]));

    const outstandingByTenantId = new Map(
      outstandingSums.map((r) => {
        const amount = r._sum.amount ?? 0;
        const amountPaid = r._sum.amountPaid ?? 0;
        const lateFee = r._sum.lateFee ?? 0;
        const outstanding = Math.max(0, amount + lateFee - amountPaid);
        return [r.tenantId, outstanding];
      })
    );

    const tenantIds = input.tenantIds?.length
      ? input.tenantIds.filter((id) => allowedTenantIds.has(id))
      : Array.from(new Set(issuedCounts.map((r) => r.tenantId)));

    return {
      success: true,
      tracking: tenantIds.map((tenantId) => ({
        tenantId,
        issuedCount: issuedByTenantId.get(tenantId) ?? 0,
        paidCount: paidByTenantId.get(tenantId) ?? 0,
        overdueCount: overdueByTenantId.get(tenantId) ?? 0,
        outstandingAmount: outstandingByTenantId.get(tenantId) ?? 0,
      })),
    };
  });
