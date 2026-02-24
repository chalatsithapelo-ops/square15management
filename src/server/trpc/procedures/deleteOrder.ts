import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deleteOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete orders");

    const isAdmin = user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN";
    const isContractor = user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER";

    if (!isAdmin && !isContractor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to delete orders",
      });
    }

    const order = await db.order.findUnique({
      where: { id: input.orderId },
      include: {
        invoice: {
          include: { lineItems: true },
        },
      },
    });

    if (!order) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Order not found",
      });
    }

    // Contractors can only delete their own orders
    if (isContractor && order.assignedToId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only delete your own orders",
      });
    }

    // Delete invoice and its line items first if exists
    if (order.invoice) {
      await db.invoiceLineItem.deleteMany({
        where: { invoiceId: order.invoice.id },
      });
      await db.invoice.delete({
        where: { id: order.invoice.id },
      });
    }

    // Delete the order (cascade handles materials, jobActivities, expenseSlips)
    // Reviews will have orderId set to null via SetNull
    await db.order.delete({
      where: { id: input.orderId },
    });

    return { success: true };
  });
