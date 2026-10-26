import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { authenticateUser } from "~/server/utils/auth";
import { computeInvoiceTotals } from "~/utils/money";
import { writeAuditLog } from "~/server/utils/auditLog";

export const updateQuotationDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      quoteNumber: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().min(1).optional()
      ),
      clientReferenceQuoteNumber: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().optional()
      ),
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
      // Deposit REQUESTED on the quotation.
      depositRequestedPercent: z.number().min(0).max(100).optional(),
      depositRequestedAmount: z.number().min(0).optional(),
      depositDueDate: z.string().nullable().optional(),
      validUntil: z.string().optional(),
      notes: z.string().optional(),
      assignedToId: z.number().nullable().optional(),
      leadId: z.number().nullable().optional(),
      projectId: z.number().nullable().optional(),
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
      labourRate: z.number().nullable().optional(),
      customerVatNumber: z.string().optional(),
      projectDescription: z.string().optional(),
      quotationDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Get current quotation to check if quoteNumber is changing
      const currentQuotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
      });

      if (!currentQuotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      // If quoteNumber is being updated, check for uniqueness
      if (input.quoteNumber !== undefined && input.quoteNumber !== currentQuotation.quoteNumber) {
        const existingQuotation = await db.quotation.findUnique({
          where: { quoteNumber: input.quoteNumber },
        });

        if (existingQuotation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quotation number "${input.quoteNumber}" is already in use. Please choose a different number.`,
          });
        }
      }

      // Build update data object with only provided fields
      const updateData: any = {};

      if (input.quoteNumber !== undefined) updateData.quoteNumber = input.quoteNumber;
      if (input.clientReferenceQuoteNumber !== undefined) updateData.clientReferenceQuoteNumber = input.clientReferenceQuoteNumber || null;
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
          ((currentQuotation.items as any[] | null) ?? []).map((it) => ({
            total: Number(it?.total) || 0,
          }));
        const pct =
          input.discountPercent !== undefined
            ? input.discountPercent
            : (currentQuotation as any).discountPercent ?? 0;
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
      if (input.validUntil !== undefined) {
        updateData.validUntil = input.validUntil ? new Date(input.validUntil) : null;
      }
      if (input.quotationDate !== undefined) {
        updateData.createdAt = input.quotationDate ? new Date(input.quotationDate) : undefined;
      }
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.assignedToId !== undefined) updateData.assignedToId = input.assignedToId;
      if (input.leadId !== undefined) updateData.leadId = input.leadId;
      if (input.projectId !== undefined) updateData.projectId = input.projectId;
      if (input.companyMaterialCost !== undefined) updateData.companyMaterialCost = input.companyMaterialCost;
      if (input.companyLabourCost !== undefined) updateData.companyLabourCost = input.companyLabourCost;
      if (input.estimatedProfit !== undefined) updateData.estimatedProfit = input.estimatedProfit;
      if (input.labourRate !== undefined) updateData.labourRate = input.labourRate;
      if (input.customerVatNumber !== undefined) updateData.customerVatNumber = input.customerVatNumber || null;
      if (input.projectDescription !== undefined) updateData.projectDescription = input.projectDescription || null;

      // Deposit-request recalculation — keep percent + amount in sync with total.
      const roundMoneyQ = (n: number) =>
        Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
      const qNextTotal =
        typeof updateData.total === "number" ? updateData.total : Number((currentQuotation as any).total) || 0;
      const qWantsPct = input.depositRequestedPercent !== undefined;
      const qWantsAmt = input.depositRequestedAmount !== undefined;
      if (qWantsPct || qWantsAmt || updateData.total !== undefined) {
        const qPct = qWantsPct
          ? Math.max(0, Math.min(100, Number(input.depositRequestedPercent) || 0))
          : Number((currentQuotation as any).depositRequestedPercent) || 0;
        let qAmt = 0;
        if (qPct > 0) {
          qAmt = roundMoneyQ((qNextTotal * qPct) / 100);
        } else if (qWantsAmt && (input.depositRequestedAmount ?? 0) > 0) {
          qAmt = roundMoneyQ(Math.min(qNextTotal, input.depositRequestedAmount!));
        } else if (!qWantsAmt) {
          const existing = Number((currentQuotation as any).depositRequestedAmount) || 0;
          qAmt = existing > 0 ? roundMoneyQ(Math.min(qNextTotal, existing)) : 0;
        }
        updateData.depositRequestedPercent = qPct;
        updateData.depositRequestedAmount = qAmt;
      }
      if (input.depositDueDate !== undefined) {
        updateData.depositDueDate = input.depositDueDate ? new Date(input.depositDueDate) : null;
      }

      const quotation = await db.quotation.update({
        where: { id: input.quotationId },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          lead: {
            select: {
              id: true,
              customerName: true,
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

      // Notify artisan if quotation is being reassigned to a different artisan
      try {
        if (
          input.assignedToId !== undefined &&
          input.assignedToId !== null &&
          input.assignedToId !== currentQuotation.assignedToId
        ) {
          const assignedUser = await db.user.findUnique({
            where: { id: input.assignedToId },
            select: { role: true },
          });
          if (assignedUser && assignedUser.role === 'ARTISAN') {
            const { notifyArtisanQuotationAssigned } = await import('~/server/utils/notifications');
            await notifyArtisanQuotationAssigned({
              artisanId: input.assignedToId,
              quoteNumber: quotation.quoteNumber,
              quotationId: quotation.id,
              serviceType: quotation.lead?.serviceType,
              address: quotation.address,
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send quotation reassignment notification:', notifError);
      }

      try {
        const actor = await authenticateUser(input.token);
        await writeAuditLog(db, {
          actor,
          action: "UPDATE",
          entityType: "Quotation",
          entityId: quotation.id,
          before: {
            quoteNumber: currentQuotation.quoteNumber,
            customerName: currentQuotation.customerName,
            customerEmail: currentQuotation.customerEmail,
            customerPhone: currentQuotation.customerPhone,
            address: currentQuotation.address,
            total: currentQuotation.total,
            subtotal: currentQuotation.subtotal,
            tax: currentQuotation.tax,
            notes: currentQuotation.notes,
            assignedToId: currentQuotation.assignedToId,
            projectDescription: currentQuotation.projectDescription,
            companyMaterialCost: currentQuotation.companyMaterialCost,
            companyLabourCost: currentQuotation.companyLabourCost,
            estimatedProfit: currentQuotation.estimatedProfit,
          },
          after: {
            quoteNumber: quotation.quoteNumber,
            customerName: quotation.customerName,
            customerEmail: quotation.customerEmail,
            customerPhone: quotation.customerPhone,
            address: quotation.address,
            total: quotation.total,
            subtotal: quotation.subtotal,
            tax: quotation.tax,
            notes: quotation.notes,
            assignedToId: quotation.assignedToId,
            projectDescription: quotation.projectDescription,
            companyMaterialCost: quotation.companyMaterialCost,
            companyLabourCost: quotation.companyLabourCost,
            estimatedProfit: quotation.estimatedProfit,
          },
          description: `Edited quotation ${quotation.quoteNumber}`,
        });
      } catch (auditErr) {
        console.error('Failed to write quotation update audit log:', auditErr);
      }

      return quotation;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
