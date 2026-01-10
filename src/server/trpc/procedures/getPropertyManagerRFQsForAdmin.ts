import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const getPropertyManagerRFQsForAdmin = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    const where: any = {};

    if (input.status) {
      where.status = input.status;
    }

    const rfqs = await db.propertyManagerRFQ.findMany({
      where,
      include: {
        propertyManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
          },
        },
        adminQuote: true,
        generatedOrder: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return rfqs;
  });
