import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deleteInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete invoices");

    const isAdmin = user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN";
    const isContractor = user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER";

    if (!isAdmin && !isContractor) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to delete invoices",
      });
    }

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
    });

    if (!invoice) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invoice not found",
      });
    }

    // Contractors can only delete their own invoices
    if (isContractor && invoice.createdById !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only delete your own invoices",
      });
    }

    // Delete the invoice (cascade handles lineItems)
    await db.invoice.delete({
      where: { id: input.invoiceId },
    });

    return { success: true };
  });
