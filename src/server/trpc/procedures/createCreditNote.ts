import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { computeInvoiceTotals } from "~/utils/money";

const contractorRoles = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"] as const;

async function canAccessInvoice(user: { id: number; role: string; contractorCompanyName: string | null }, invoiceCreatedById: number | null) {
  if (isAdmin(user as any)) return true;

  if (!contractorRoles.includes(user.role as any)) {
    return false;
  }

  if (user.role === "CONTRACTOR") {
    return invoiceCreatedById === user.id;
  }

  const company = user.contractorCompanyName?.trim();
  if (!company) {
    return invoiceCreatedById === user.id;
  }

  const companyUsers = await db.user.findMany({
    where: {
      contractorCompanyName: company,
      role: { in: [...contractorRoles] },
    },
    select: { id: true },
  });

  const ids = companyUsers.map((u) => u.id);
  return invoiceCreatedById !== null && ids.includes(invoiceCreatedById);
}

export const createCreditNote = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      reason: z.string().min(3),
      disputeReason: z.string().optional(),
      notes: z.string().optional(),
      markInvoiceDisputed: z.boolean().optional().default(false),
      creditNoteDate: z.string().optional(),
      items: z.array(
        z.object({
          description: z.string().min(1),
          quantity: z.number().positive(),
          unitPrice: z.number().nonnegative(),
          total: z.number().nonnegative(),
          unitOfMeasure: z.string().default("Sum"),
        })
      ).min(1),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const invoice = await db.invoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        order: { select: { id: true, orderNumber: true } },
        project: { select: { id: true, name: true, projectNumber: true } },
      },
    });

    if (!invoice) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Invoice not found" });
    }

    const allowed = await canAccessInvoice(user, invoice.createdById ?? null);
    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this invoice" });
    }

    if (["CANCELLED", "REJECTED"].includes(invoice.status)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Cannot issue a credit note for a cancelled/rejected invoice" });
    }

    const totals = computeInvoiceTotals(input.items);
    if (totals.total <= 0) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Credit note total must be greater than 0" });
    }

    if (totals.total > invoice.total) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "Credit note total cannot exceed invoice total" });
    }

    const last = await db.creditNote.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const next = (last?.id ?? 0) + 1;
    const creditNoteNumber = `CN-${String(next).padStart(5, "0")}`;

    const creditNote = await db.creditNote.create({
      data: {
        creditNoteNumber,
        reason: input.reason,
        disputeReason: input.disputeReason || null,
        notes: input.notes || null,
        customerName: invoice.customerName,
        customerEmail: invoice.customerEmail,
        customerPhone: invoice.customerPhone || null,
        address: invoice.address || null,
        invoiceId: invoice.id,
        orderId: invoice.orderId || null,
        projectId: invoice.projectId || null,
        createdById: user.id,
        items: input.items,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        status: "ISSUED",
        ...(input.creditNoteDate ? { createdAt: new Date(input.creditNoteDate) } : {}),
      },
      include: {
        invoice: {
          select: {
            id: true,
            invoiceNumber: true,
            total: true,
            status: true,
            order: { select: { id: true, orderNumber: true } },
            project: { select: { id: true, name: true, projectNumber: true } },
          },
        },
      },
    });

    if (input.markInvoiceDisputed) {
      await db.invoice.update({
        where: { id: invoice.id },
        data: { isDisputed: true },
      });
    }

    return creditNote;
  });
