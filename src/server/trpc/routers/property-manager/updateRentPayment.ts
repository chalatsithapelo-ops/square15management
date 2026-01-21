import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const updateRentPayment = baseProcedure
  .input(
    z.object({
      token: z.string(),
      rentPaymentId: z.number().int().positive(),
      amountPaid: z.number().nonnegative().optional(),
      paidDate: z.string().datetime().nullable().optional(),
      lateFee: z.number().nonnegative().optional(),
      paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "CHEQUE"]).nullable().optional(),
      transactionReference: z.string().nullable().optional(),
      notes: z.string().nullable().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const propertyManagerId = user.id;

    const existing = await db.rentPayment.findUnique({
      where: { id: input.rentPaymentId },
      select: {
        id: true,
        tenantId: true,
        propertyManagerId: true,
        amount: true,
        lateFee: true,
        amountPaid: true,
        dueDate: true,
      },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Rent invoice not found." });
    }

    if (existing.propertyManagerId !== propertyManagerId) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only update your own tenant invoices." });
    }

    const amountPaid = input.amountPaid ?? existing.amountPaid;
    const lateFee = input.lateFee ?? existing.lateFee;
    const paidDate = input.paidDate === undefined ? undefined : input.paidDate;

    let status = "PENDING";
    const isPaid = paidDate && amountPaid >= existing.amount + lateFee;
    if (isPaid) {
      status = "PAID";
    } else if (amountPaid > 0) {
      status = "PARTIAL";
    } else if (existing.dueDate < new Date()) {
      status = "OVERDUE";
    }

    const updated = await db.rentPayment.update({
      where: { id: input.rentPaymentId },
      data: {
        amountPaid,
        lateFee,
        paidDate: paidDate === undefined ? undefined : paidDate ? new Date(paidDate) : null,
        status,
        paymentMethod: input.paymentMethod === undefined ? undefined : input.paymentMethod,
        transactionReference: input.transactionReference === undefined ? undefined : input.transactionReference,
        notes: input.notes === undefined ? undefined : input.notes,
      },
    });

    return {
      success: true,
      message: "Rent invoice updated successfully.",
      rentPayment: updated,
    };
  });
