import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const rejectTenantOnboarding = baseProcedure
  .input(
    z.object({
      token: z.string(),
      customerId: z.number(),
      rejectionReason: z.string().min(1),
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
        message: "You can only reject onboardings for your own customers.",
      });
    }

    if (customer.onboardingStatus !== "PENDING") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This onboarding request has already been processed.",
      });
    }

    // Update customer status to rejected
    const updatedCustomer = await db.propertyManagerCustomer.update({
      where: { id: input.customerId },
      data: {
        onboardingStatus: "REJECTED",
        status: "INACTIVE",
        approvedBy: userId,
        approvedDate: new Date(),
        rejectionReason: input.rejectionReason,
      },
    });

    return {
      success: true,
      message: "Tenant onboarding rejected.",
      customer: updatedCustomer,
    };
  });
