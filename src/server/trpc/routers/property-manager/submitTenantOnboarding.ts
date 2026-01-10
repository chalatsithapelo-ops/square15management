import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const submitTenantOnboarding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      propertyManagerId: z.number(),
      buildingId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phoneNumber: z.string().min(1),
      leaseStartDate: z.string().datetime().optional(),
      monthlyRent: z.number().positive().optional(),
      securityDeposit: z.number().nonnegative().optional(),
      electricityMeterNumber: z.string().optional(),
      waterMeterNumber: z.string().optional(),
      gasMeterNumber: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const userId = user.id;

    // Check if customer already exists with this email for this PM
    const existing = await db.propertyManagerCustomer.findFirst({
      where: {
        email: input.email,
        propertyManagerId: input.propertyManagerId,
      },
    });

    if (existing) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "An onboarding request already exists for this email address.",
      });
    }

    // Verify building belongs to the property manager
    const building = await db.building.findFirst({
      where: {
        id: input.buildingId,
        propertyManagerId: input.propertyManagerId,
      },
    });

    if (!building) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Building not found or does not belong to this property manager.",
      });
    }

    // Create the onboarding request
    const customer = await db.propertyManagerCustomer.create({
      data: {
        propertyManagerId: input.propertyManagerId,
        buildingId: input.buildingId,
        userId: userId,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phoneNumber: input.phoneNumber,
        onboardingStatus: "PENDING",
        onboardedDate: new Date(),
        status: "PENDING",
        leaseStartDate: input.leaseStartDate ? new Date(input.leaseStartDate) : undefined,
        monthlyRent: input.monthlyRent,
        securityDeposit: input.securityDeposit,
        electricityMeterNumber: input.electricityMeterNumber,
        waterMeterNumber: input.waterMeterNumber,
        gasMeterNumber: input.gasMeterNumber,
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
      message: "Your onboarding request has been submitted successfully. You will be notified once approved.",
      customer,
    };
  });
