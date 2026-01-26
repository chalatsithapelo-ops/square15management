import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const approveCustomerPayment = publicProcedure
  .input(
    z.object({
      token: z.string(),
      paymentId: z.number(),
      approvalNotes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can approve payments.",
      });
    }

    const payment = await db.customerPayment.findUnique({
      where: { id: input.paymentId },
      include: {
        tenant: true,
        building: true,
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
        message: "You cannot approve this payment.",
      });
    }

    if (payment.status !== "PENDING") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Only pending payments can be approved.",
      });
    }

    const now = new Date();

    // Update payment status
    const updatedPayment = await db.customerPayment.update({
      where: { id: input.paymentId },
      data: {
        status: "APPROVED",
        reviewedBy: user.id,
        reviewedDate: now,
        approvalNotes: input.approvalNotes,
        allocatedDate: now,
      },
    });

    // Create notification for customer
    await db.notification.create({
      data: {
        recipientId: payment.customerId!,
        recipientRole: "CUSTOMER",
        message: `Your ${payment.paymentType.toLowerCase()} payment of R${payment.amount.toFixed(2)} has been approved.${input.approvalNotes ? ` Notes: ${input.approvalNotes}` : ""}`,
        type: "CUSTOMER_PAYMENT_APPROVED",
        isRead: false,
      },
    });

    // If it's a rent payment, update the building revenue
    if (payment.paymentType === "RENT" && payment.buildingId) {
      await db.building.update({
        where: { id: payment.buildingId },
        data: {
          monthlyRevenue: {
            increment: payment.amount,
          },
        },
      });

      // Also update the matching rent invoice (RentPayment) so PAID reflects PM approval.
      if (payment.tenantId) {
        const basisDate = payment.paymentMonth ?? payment.paymentDate;
        const monthStart = new Date(basisDate.getFullYear(), basisDate.getMonth(), 1);
        const nextMonthStart = new Date(basisDate.getFullYear(), basisDate.getMonth() + 1, 1);

        const rentInvoice = await db.rentPayment.findFirst({
          where: {
            propertyManagerId: user.id,
            tenantId: payment.tenantId,
            dueDate: {
              gte: monthStart,
              lt: nextMonthStart,
            },
          },
          select: {
            id: true,
            amount: true,
            lateFee: true,
            amountPaid: true,
            dueDate: true,
          },
          orderBy: [{ dueDate: "desc" }, { createdAt: "desc" }],
        });

        if (rentInvoice) {
          const newAmountPaid = (rentInvoice.amountPaid ?? 0) + payment.amount;
          const lateFee = rentInvoice.lateFee ?? 0;
          const totalDue = (rentInvoice.amount ?? 0) + lateFee;

          const isFullyPaid = newAmountPaid >= totalDue;
          const status = isFullyPaid ? "PAID" : newAmountPaid > 0 ? "PARTIAL" : rentInvoice.dueDate < now ? "OVERDUE" : "PENDING";

          await db.rentPayment.update({
            where: { id: rentInvoice.id },
            data: {
              amountPaid: newAmountPaid,
              status,
              paidDate: isFullyPaid ? now : undefined,
              paymentMethod: payment.paymentMethod ?? undefined,
              transactionReference: payment.transactionReference ?? undefined,
            },
          });
        }
      }
    }

    // If it's a utilities payment, update the building revenue
    if (payment.paymentType === "UTILITIES" && payment.buildingId) {
      await db.building.update({
        where: { id: payment.buildingId },
        data: {
          monthlyRevenue: {
            increment: payment.amount,
          },
        },
      });
    }

    return {
      success: true,
      message: "Payment approved successfully.",
      payment: updatedPayment,
    };
  });
