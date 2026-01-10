import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const recordUtilityReading = baseProcedure
  .input(
    z.object({
      token: z.string(),
      tenantId: z.number(),
      utilityType: z.enum(["ELECTRICITY", "WATER", "GAS", "INTERNET"]),
      readingDate: z.string().datetime(),
      currentReading: z.number().nonnegative(),
      previousReading: z.number().nonnegative().optional(),
      ratePerUnit: z.number().positive().optional(),
      meterNumber: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
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
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant not found.",
      });
    }

    // Get previous reading if not provided
    let previousReading = input.previousReading ?? 0;
    if (!input.previousReading) {
      const lastReading = await db.utilityReading.findFirst({
        where: {
          tenantId: input.tenantId,
          utilityType: input.utilityType,
        },
        orderBy: {
          readingDate: "desc",
        },
      });
      previousReading = lastReading?.currentReading ?? 0;
    }

    const consumption = input.currentReading - previousReading;
    const totalCost = input.ratePerUnit ? consumption * input.ratePerUnit : undefined;

    const utilityReading = await db.utilityReading.create({
      data: {
        tenantId: input.tenantId,
        propertyManagerId: userId,
        utilityType: input.utilityType,
        readingDate: new Date(input.readingDate),
        currentReading: input.currentReading,
        previousReading,
        consumption,
        ratePerUnit: input.ratePerUnit,
        totalCost,
        status: "RECORDED",
        meterNumber: input.meterNumber,
      },
      include: {
        tenant: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Utility reading recorded successfully.",
      utilityReading,
    };
  });
