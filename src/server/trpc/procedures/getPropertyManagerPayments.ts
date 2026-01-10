import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const getPropertyManagerPayments = publicProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED"]).optional(),
      paymentType: z.enum(["RENT", "UTILITIES", "CLAIM"]).optional(),
      buildingId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can access this.",
      });
    }

    const where: any = {
      propertyManagerId: user.id,
    };

    if (input.status) {
      where.status = input.status;
    }

    if (input.paymentType) {
      where.paymentType = input.paymentType;
    }

    if (input.buildingId) {
      where.buildingId = input.buildingId;
    }

    const payments = await db.customerPayment.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        tenant: {
          include: {
            building: true,
          },
        },
        building: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return payments;
  });
