import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const recordRentPayment = baseProcedure
  .input(
    z.object({
      token: z.string(),
      tenantId: z.number(),
      dueDate: z.string().datetime(),
      amount: z.number().positive(),
      paidDate: z.string().datetime().optional(),
      amountPaid: z.number().nonnegative().optional(),
      lateFee: z.number().nonnegative().optional(),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE"]).optional(),
      transactionReference: z.string().optional(),
      notes: z.string().optional(),
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

    // Generate payment number
    const now = new Date();
    const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
    const count = await db.rentPayment.count({
      where: {
        propertyManagerId: userId,
        createdAt: {
          gte: new Date(now.getFullYear(), now.getMonth(), 1),
        },
      },
    });
    const paymentNumber = `RENT-${yearMonth}-${String(count + 1).padStart(4, "0")}`;

    const amountPaid = input.amountPaid ?? 0;
    const amount = input.amount;
    const lateFee = input.lateFee ?? 0;

    let status = "PENDING";
    if (input.paidDate && amountPaid >= amount + lateFee) {
      status = "PAID";
    } else if (amountPaid > 0) {
      status = "PARTIAL";
    } else if (new Date(input.dueDate) < new Date() && !input.paidDate) {
      status = "OVERDUE";
    }

    const rentPayment = await db.rentPayment.create({
      data: {
        tenantId: input.tenantId,
        propertyManagerId: userId,
        paymentNumber,
        dueDate: new Date(input.dueDate),
        paidDate: input.paidDate ? new Date(input.paidDate) : undefined,
        amount,
        amountPaid,
        lateFee,
        status,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        notes: input.notes,
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
      message: "Rent payment recorded successfully.",
      rentPayment,
    };
  });
