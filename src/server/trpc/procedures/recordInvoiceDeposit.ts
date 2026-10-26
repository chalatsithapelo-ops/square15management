// PR-INV-DEPOSIT — record a deposit payment received against an invoice.
// Any admin-tier role can add a deposit; each call ADDs the amount to the
// running depositAmount on the invoice (multiple partial deposits are OK).
// When the running deposit reaches (or exceeds) the invoice total the
// invoice is auto-transitioned to PAID and paidDate set.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { writeAuditLog } from "~/server/utils/auditLog";
import { roundCurrency } from "~/utils/money";

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

export const recordInvoiceDeposit = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      amount: z.number().positive("Deposit amount must be greater than 0"),
      paidDate: z.string().optional(), // ISO date; defaults to now
      reference: z.string().optional(), // payment method / EFT ref
      mode: z.enum(["ADD", "SET"]).default("ADD"),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        customerName: true,
        total: true,
        depositAmount: true,
        depositReference: true,
        status: true,
        paidDate: true,
      },
    });
    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }

    const priorDeposit = Number(invoice.depositAmount) || 0;
    const total = Number(invoice.total) || 0;
    const newDeposit = roundCurrency(
      input.mode === "SET" ? input.amount : priorDeposit + input.amount,
    );

    // Cap at invoice total — clients cannot over-pay via this flow.
    if (newDeposit > total + 0.005) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Deposit (R${newDeposit.toFixed(2)}) exceeds invoice total (R${total.toFixed(2)}). Reduce the amount or issue a credit note.`,
      });
    }

    const paidDate = input.paidDate ? new Date(input.paidDate) : new Date();
    const fullyPaid = newDeposit >= total - 0.005 && total > 0;

    const updated = await db.invoice.update({
      where: { id: input.invoiceId },
      data: {
        depositAmount: newDeposit,
        depositPaidDate: paidDate,
        depositReference: input.reference ?? invoice.depositReference ?? null,
        ...(fullyPaid && invoice.status !== "PAID"
          ? { status: "PAID" as const, paidDate }
          : {}),
      },
      include: {
        order: { select: { id: true, orderNumber: true, serviceType: true } },
      },
    });

    try {
      await writeAuditLog(db, {
        actor: user,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: invoice.id,
        before: {
          depositAmount: priorDeposit,
          status: invoice.status,
        },
        after: {
          depositAmount: newDeposit,
          depositPaidDate: paidDate,
          depositReference: input.reference ?? invoice.depositReference ?? null,
          status: updated.status,
        },
        description:
          input.mode === "SET"
            ? `Set deposit on invoice ${invoice.invoiceNumber} to R${newDeposit.toFixed(2)}`
            : `Recorded R${input.amount.toFixed(2)} deposit on invoice ${invoice.invoiceNumber} (running total R${newDeposit.toFixed(2)})`,
      });
    } catch (auditErr) {
      console.error("Failed to write deposit audit log:", auditErr);
    }

    return updated;
  });

export const clearInvoiceDeposit = baseProcedure
  .input(z.object({ token: z.string(), invoiceId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAdminTier(user.role);

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      select: {
        id: true,
        invoiceNumber: true,
        depositAmount: true,
        status: true,
        paidDate: true,
        total: true,
      },
    });
    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }

    const priorDeposit = Number(invoice.depositAmount) || 0;
    // If the invoice was auto-set to PAID purely by deposit, roll it back to SENT.
    const wasAutoPaidByDeposit =
      invoice.status === "PAID" && priorDeposit >= Number(invoice.total) - 0.005;

    const updated = await db.invoice.update({
      where: { id: input.invoiceId },
      data: {
        depositAmount: 0,
        depositPaidDate: null,
        depositReference: null,
        ...(wasAutoPaidByDeposit ? { status: "SENT" as const, paidDate: null } : {}),
      },
    });

    try {
      await writeAuditLog(db, {
        actor: user,
        action: "UPDATE",
        entityType: "Invoice",
        entityId: invoice.id,
        before: { depositAmount: priorDeposit, status: invoice.status },
        after: { depositAmount: 0, status: updated.status },
        description: `Cleared deposit on invoice ${invoice.invoiceNumber}`,
      });
    } catch (auditErr) {
      console.error("Failed to write clear-deposit audit log:", auditErr);
    }

    return updated;
  });
