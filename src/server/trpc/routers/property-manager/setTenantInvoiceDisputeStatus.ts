import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const setTenantInvoiceDisputeStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      source: z.enum(["RENT", "INVOICE"]),
      id: z.number().int().positive(),
      isDisputed: z.boolean(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can dispute/resolve tenant invoices.",
      });
    }

    const propertyManagerId = user.id;

    if (input.source === "RENT") {
      const existing = await db.rentPayment.findUnique({
        where: { id: input.id },
        select: { id: true, propertyManagerId: true },
      });

      if (!existing) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Rent invoice not found." });
      }

      if (existing.propertyManagerId !== propertyManagerId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own tenant invoices.",
        });
      }

      await db.rentPayment.update({
        where: { id: input.id },
        data: { isDisputed: input.isDisputed } as any,
      });

      return {
        success: true,
        message: input.isDisputed ? "Rent invoice marked as disputed." : "Rent invoice dispute cleared.",
      };
    }

    const existing = await db.invoice.findUnique({
      where: { id: input.id },
      select: { id: true, createdById: true },
    });

    if (!existing) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found." });
    }

    if (existing.createdById !== propertyManagerId) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only update invoices you created.",
      });
    }

    await db.invoice.update({
      where: { id: input.id },
      data: { isDisputed: input.isDisputed } as any,
    });

    return {
      success: true,
      message: input.isDisputed ? "Invoice marked as disputed." : "Invoice dispute cleared.",
    };
  });
