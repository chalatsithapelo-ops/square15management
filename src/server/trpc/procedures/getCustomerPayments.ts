import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getCustomerPayments = publicProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Access denied.",
      });
    }

    const where: any = {
      customerId: user.id,
    };

    if (input.status) {
      where.status = input.status;
    }

    const payments = await db.customerPayment.findMany({
      where,
      include: {
        tenant: {
          include: {
            building: true,
          },
        },
        propertyManager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return payments;
  });
