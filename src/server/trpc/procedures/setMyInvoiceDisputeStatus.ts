import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const setMyInvoiceDisputeStatus = publicProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number().int().positive(),
      isDisputed: z.boolean(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only customers can dispute/resolve their invoices.",
      });
    }

    const invoice = await db.invoice.findFirst({
      where: {
        id: input.invoiceId,
        customerEmail: user.email,
      },
      select: {
        id: true,
        createdById: true,
        invoiceNumber: true,
      },
    });

    if (!invoice) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Invoice not found for your account.",
      });
    }

    await (db.invoice as any).update({
      where: { id: invoice.id },
      data: { isDisputed: input.isDisputed },
    });

    // Notify the creator (usually the PM) when a customer disputes/resolves.
    if (invoice.createdById) {
      await db.notification.create({
        data: {
          recipientId: invoice.createdById,
          recipientRole: "PROPERTY_MANAGER",
          type: "SYSTEM_ALERT",
          message: input.isDisputed
            ? `Customer disputed invoice ${invoice.invoiceNumber}.`
            : `Customer resolved dispute on invoice ${invoice.invoiceNumber}.`,
          isRead: false,
          relatedEntityType: "INVOICE",
          relatedEntityId: invoice.id,
        },
      });
    }

    return {
      success: true,
      message: input.isDisputed ? "Invoice marked as disputed." : "Invoice dispute cleared.",
    };
  });
