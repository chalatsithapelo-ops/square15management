import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const approveTenantOnboarding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
      leaseStartDate: z.string().datetime(),
      leaseEndDate: z.string().datetime(),
      monthlyRent: z.number().positive(),
      securityDeposit: z.number().nonnegative().optional(),
      electricityMeterNumber: z.string().optional(),
      waterMeterNumber: z.string().optional(),
      gasMeterNumber: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;

    // Verify the customer exists and is pending
    const customer = await db.propertyManagerCustomer.findUnique({
      where: { id: input.customerId },
    });

    if (!customer) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Customer not found.",
      });
    }

    if (customer.propertyManagerId !== userId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only approve onboardings for your own customers.",
      });
    }

    if (customer.onboardingStatus !== "PENDING") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This onboarding request has already been processed.",
      });
    }

    // Update customer status to approved
    const updatedCustomer = await db.propertyManagerCustomer.update({
      where: { id: input.customerId },
      data: {
        onboardingStatus: "APPROVED",
        status: "ACTIVE",
        approvedBy: userId,
        approvedDate: new Date(),
        leaseStartDate: new Date(input.leaseStartDate),
        leaseEndDate: new Date(input.leaseEndDate),
        monthlyRent: input.monthlyRent,
        securityDeposit: input.securityDeposit,
        electricityMeterNumber: input.electricityMeterNumber || customer.electricityMeterNumber,
        waterMeterNumber: input.waterMeterNumber || customer.waterMeterNumber,
        gasMeterNumber: input.gasMeterNumber || customer.gasMeterNumber,
      },
      include: {
        building: {
          select: {
            name: true,
            address: true,
          },
        },
      },
    });

    return {
      success: true,
      message: "Tenant onboarding approved successfully.",
      customer: updatedCustomer,
    };
  });
