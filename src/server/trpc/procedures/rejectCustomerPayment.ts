import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const rejectCustomerPayment = publicProcedure
  .input(
    z.object({
      token: z.string(),
      paymentId: z.number(),
      rejectionReason: z.string().min(10, "Rejection reason must be at least 10 characters"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can reject payments.",
      });
    }

    const payment = await db.customerPayment.findUnique({
      where: { id: input.paymentId },
      include: {
        customer: true,
      },
    });

    if (!payment) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payment not found.",
      });
    }

    if (payment.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You cannot reject this payment.",
      });
    }

    if (payment.status !== "PENDING") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only pending payments can be rejected.",
      });
    }

    const now = new Date();

    // Update payment status
    const updatedPayment = await db.customerPayment.update({
      where: { id: input.paymentId },
      data: {
        status: "REJECTED",
        reviewedBy: user.id,
        reviewedDate: now,
        rejectionReason: input.rejectionReason,
      },
    });

    // Create notification for customer
    await db.notification.create({
      data: {
        recipientId: payment.customerId!,
        recipientRole: "CUSTOMER",
        message: `Your ${payment.paymentType.toLowerCase()} payment of R${payment.amount.toFixed(2)} has been rejected. Reason: ${input.rejectionReason}`,
        type: "CUSTOMER_PAYMENT_REJECTED",
        isRead: false,
      },
    });

    return {
      success: true,
      message: "Payment rejected successfully.",
      payment: updatedPayment,
    };
  });
