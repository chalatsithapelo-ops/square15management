// PR-INV-REMIT — admin-uploaded proof-of-payment (remittance) for invoices.
// Any admin-tier role can attach or clear a remittance on any invoice. The
// invoice list shows a warning badge when a PAID invoice has no remittance.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ADMIN_TIER_ROLES = [
  "ADMIN",
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "MANAGER",
  "TECHNICAL_MANAGER",
];

function ensureAdminTier(role: string) {
  if (!ADMIN_TIER_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Admin only" });
  }
}

export const adminAttachInvoiceRemittance = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      remittanceUrl: z.string().min(1),
      remittanceFileName: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const invoice = await db.invoice.findUnique({ where: { id: input.invoiceId } });
    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }

    const updated = await db.invoice.update({
      where: { id: input.invoiceId },
      data: {
        remittanceUrl: input.remittanceUrl,
        remittanceFileName: input.remittanceFileName ?? null,
        remittanceUploadedAt: new Date(),
        remittanceUploadedById: user.id,
      },
    });

    return updated;
  });

export const adminClearInvoiceRemittance = baseProcedure
  .input(z.object({ token: z.string(), invoiceId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const updated = await db.invoice.update({
      where: { id: input.invoiceId },
      data: {
        remittanceUrl: null,
        remittanceFileName: null,
        remittanceUploadedAt: null,
        remittanceUploadedById: null,
      },
    });

    return updated;
  });
