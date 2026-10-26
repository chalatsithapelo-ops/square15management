import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { computeInvoiceTotals } from "~/utils/money";
import { authenticateUser } from "~/server/utils/auth";
import { writeAuditLog } from "~/server/utils/auditLog";

export const updateInvoiceDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      invoiceNumber: z.string().min(1).optional(),
      customerName: z.string().min(1).optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      items: z.array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          total: z.number(),
          unitOfMeasure: z.string(),
        })
      ).optional(),
      subtotal: z.number().optional(),
      tax: z.number().optional(),
      total: z.number().optional(),
      discountPercent: z.number().min(0).max(100).optional(),
      // Deposit REQUESTED from the client (percent authoritative; amount recomputed).
      depositRequestedPercent: z.number().min(0).max(100).optional(),
      depositRequestedAmount: z.number().min(0).optional(),
      depositDueDate: z.string().nullable().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      orderId: z.number().nullable().optional(),
      projectId: z.number().nullable().optional(),
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
      clientReferenceNumber: z.string().optional(),
      customerVatNumber: z.string().optional(),
      projectDescription: z.string().optional(),
      invoiceDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Get current invoice to check if invoiceNumber is changing
      const currentInvoice = await db.invoice.findUnique({
        where: { id: input.invoiceId },
      });

      if (!currentInvoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      // If invoiceNumber is being updated, check for uniqueness
      if (input.invoiceNumber !== undefined && input.invoiceNumber !== currentInvoice.invoiceNumber) {
        const existingInvoice = await db.invoice.findUnique({
          where: { invoiceNumber: input.invoiceNumber },
        });

        if (existingInvoice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invoice number "${input.invoiceNumber}" is already in use. Please choose a different number.`,
          });
        }
      }

      // Build update data object with only provided fields
      const updateData: any = {};

      if (input.invoiceNumber !== undefined) updateData.invoiceNumber = input.invoiceNumber;
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.items !== undefined) updateData.items = input.items;
      // When items and/or discount change, recanonicalise all totals so the DB,
      // the web form, and the generated PDF always agree to the cent.
      if (input.items !== undefined || input.discountPercent !== undefined) {
        const items =
          input.items ??
          ((currentInvoice.items as any[] | null) ?? []).map((it) => ({
            total: Number(it?.total) || 0,
          }));
        const pct =
          input.discountPercent !== undefined
            ? input.discountPercent
            : (currentInvoice as any).discountPercent ?? 0;
        const canonical = computeInvoiceTotals(items, pct);
        updateData.subtotal = canonical.subtotal;
        updateData.discountPercent = canonical.discountPercent;
        updateData.discountAmount = canonical.discountAmount;
        updateData.tax = canonical.tax;
        updateData.total = canonical.total;
      } else {
        if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
        if (input.tax !== undefined) updateData.tax = input.tax;
        if (input.total !== undefined) updateData.total = input.total;
      }
      if (input.dueDate !== undefined) {
        updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.invoiceDate !== undefined) {
        updateData.createdAt = input.invoiceDate ? new Date(input.invoiceDate) : undefined;
      }
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.orderId !== undefined) updateData.orderId = input.orderId;
      if (input.projectId !== undefined) updateData.projectId = input.projectId;
      if (input.companyMaterialCost !== undefined) updateData.companyMaterialCost = input.companyMaterialCost;
      if (input.companyLabourCost !== undefined) updateData.companyLabourCost = input.companyLabourCost;
      if (input.estimatedProfit !== undefined) updateData.estimatedProfit = input.estimatedProfit;
      if (input.clientReferenceNumber !== undefined) updateData.clientReferenceNumber = input.clientReferenceNumber || null;
      if (input.customerVatNumber !== undefined) updateData.customerVatNumber = input.customerVatNumber || null;
      if (input.projectDescription !== undefined) updateData.projectDescription = input.projectDescription || null;

      // Deposit-request recalculation: recompute the amount whenever the
      // percent OR the invoice total changes so the two never drift.
      const roundMoney = (n: number) =>
        Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
      const nextTotal =
        typeof updateData.total === "number" ? updateData.total : Number((currentInvoice as any).total) || 0;
      const wantsPercentUpdate = input.depositRequestedPercent !== undefined;
      const wantsAmountUpdate = input.depositRequestedAmount !== undefined;
      if (wantsPercentUpdate || wantsAmountUpdate || updateData.total !== undefined) {
        const nextPct = wantsPercentUpdate
          ? Math.max(0, Math.min(100, Number(input.depositRequestedPercent) || 0))
          : Number((currentInvoice as any).depositRequestedPercent) || 0;
        let nextAmt = 0;
        if (nextPct > 0) {
          nextAmt = roundMoney((nextTotal * nextPct) / 100);
        } else if (wantsAmountUpdate && (input.depositRequestedAmount ?? 0) > 0) {
          nextAmt = roundMoney(Math.min(nextTotal, input.depositRequestedAmount!));
        } else if (!wantsAmountUpdate) {
          // Total changed but percent stayed 0 — preserve any explicit amount,
          // clamped to the new total.
          const existingAmt = Number((currentInvoice as any).depositRequestedAmount) || 0;
          nextAmt = existingAmt > 0 ? roundMoney(Math.min(nextTotal, existingAmt)) : 0;
        }
        updateData.depositRequestedPercent = nextPct;
        updateData.depositRequestedAmount = nextAmt;
      }
      if (input.depositDueDate !== undefined) {
        updateData.depositDueDate = input.depositDueDate ? new Date(input.depositDueDate) : null;
      }

      const invoice = await db.invoice.update({
        where: { id: input.invoiceId },
        data: updateData,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
              serviceType: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
      });

      try {
        const actor = await authenticateUser(input.token);
        await writeAuditLog(db, {
          actor,
          action: "UPDATE",
          entityType: "Invoice",
          entityId: invoice.id,
          before: {
            invoiceNumber: currentInvoice.invoiceNumber,
            customerName: currentInvoice.customerName,
            customerEmail: currentInvoice.customerEmail,
            customerPhone: currentInvoice.customerPhone,
            address: currentInvoice.address,
            total: currentInvoice.total,
            subtotal: currentInvoice.subtotal,
            tax: currentInvoice.tax,
            notes: currentInvoice.notes,
            projectDescription: (currentInvoice as any).projectDescription,
            companyMaterialCost: (currentInvoice as any).companyMaterialCost,
            companyLabourCost: (currentInvoice as any).companyLabourCost,
            estimatedProfit: (currentInvoice as any).estimatedProfit,
          },
          after: {
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            customerEmail: invoice.customerEmail,
            customerPhone: invoice.customerPhone,
            address: invoice.address,
            total: invoice.total,
            subtotal: invoice.subtotal,
            tax: invoice.tax,
            notes: invoice.notes,
            projectDescription: (invoice as any).projectDescription,
            companyMaterialCost: (invoice as any).companyMaterialCost,
            companyLabourCost: (invoice as any).companyLabourCost,
            estimatedProfit: (invoice as any).estimatedProfit,
          },
          description: `Updated invoice ${invoice.invoiceNumber}`,
        });
      } catch (auditErr) {
        console.error('Failed to write invoice update audit log:', auditErr);
      }

      return invoice;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
