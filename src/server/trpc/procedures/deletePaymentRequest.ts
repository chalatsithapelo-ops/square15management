import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deletePaymentRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      paymentRequestId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete payment requests");
    requirePermission(user, PERMISSIONS.VIEW_PAYMENT_REQUESTS);

    // Only admins can delete payment requests
    if (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only admins can delete payment requests",
      });
    }

    // Check payment request exists
    const paymentRequest = await db.paymentRequest.findUnique({
      where: { id: input.paymentRequestId },
      include: { payslip: true },
    });

    if (!paymentRequest) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment request not found",
      });
    }

    // Delete associated payslip first if exists
    if (paymentRequest.payslip) {
      await db.payslip.delete({
        where: { id: paymentRequest.payslip.id },
      });
    }

    // Delete the payment request
    await db.paymentRequest.delete({
      where: { id: input.paymentRequestId },
    });

    return { success: true };
  });
