import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getTenantRentHistory = baseProcedure
  .input(
    z.object({
      token: z.string(),
      tenantId: z.number(),
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

    const rentPayments = await db.rentPayment.findMany({
      where: {
        tenantId: input.tenantId,
        propertyManagerId: userId,
      },
      orderBy: {
        dueDate: "desc",
      },
      take: input.limit || 12,
    });

    // Calculate summary
    const summary = {
      totalPaid: rentPayments
        .filter((p) => p.status === "PAID")
        .reduce((sum, p) => sum + p.amountPaid, 0),
      totalOutstanding: rentPayments
        .filter((p) => ["PENDING", "PARTIAL", "OVERDUE"].includes(p.status))
        .reduce((sum, p) => sum + (p.amount - p.amountPaid) + p.lateFee, 0),
      overdueCount: rentPayments.filter((p) => p.status === "OVERDUE").length,
      totalLateFees: rentPayments.reduce((sum, p) => sum + p.lateFee, 0),
    };

    return {
      rentPayments,
      summary,
    };
  });
