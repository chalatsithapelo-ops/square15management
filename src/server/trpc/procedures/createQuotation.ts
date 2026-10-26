import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";
import { computeInvoiceTotals } from "~/utils/money";
import { resolveClientId, resolveClientBuildingId } from "~/server/trpc/procedures/clients";
import { getNextQuoteNumber } from "~/server/utils/documentNumbers";
import { writeAuditLog } from "~/server/utils/auditLog";

export const createQuotation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quoteNumber: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().min(1).optional()
      ),
      clientReferenceQuoteNumber: z.preprocess(
        (val) => (typeof val === "string" && val.trim() === "" ? undefined : val),
        z.string().optional()
      ),
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(1),
      address: z.string().min(1),
      items: z.array(
        z.object({
          description: z.string(),
          quantity: z.number(),
          unitPrice: z.number(),
          total: z.number(),
          unitOfMeasure: z.string(),
        })
      ),
      subtotal: z.number(),
      tax: z.number().default(0),
      total: z.number(),
      discountPercent: z.number().min(0).max(100).default(0),
      // Deposit REQUESTED on the quotation (percent authoritative;
      // amount recomputed server-side from canonical total).
      depositRequestedPercent: z.number().min(0).max(100).optional(),
      depositRequestedAmount: z.number().min(0).optional(),
      depositDueDate: z.string().optional(),
      validUntil: z.string().optional(),
      notes: z.string().optional(),
      assignedToId: z.number().optional(),
      leadId: z.number().optional(),
      projectId: z.number().optional(),
      companyMaterialCost: z.number().default(0),
      companyLabourCost: z.number().default(0),
      estimatedProfit: z.number().default(0),
      labourRate: z.number().optional(),
      customerVatNumber: z.string().optional(),
      projectDescription: z.string().optional(),
      quotationDate: z.string().optional(), // Custom quotation date (overrides createdAt)
      // Reusable client linkage (auto-upsert if not provided)
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      companyName: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Verify token first - separate from other logic for clear error messages
    let verified: any;
    try {
      verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);
    } catch {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }

    try {
      // Use provided quoteNumber or auto-generate
      let quoteNumber: string;
      
      if (input.quoteNumber) {
        // Check if the provided quoteNumber is already in use
        const existingQuotation = await db.quotation.findUnique({
          where: { quoteNumber: input.quoteNumber },
        });

        if (existingQuotation) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Quotation number "${input.quoteNumber}" is already in use. Please choose a different number.`,
          });
        }
        
        quoteNumber = input.quoteNumber;
      } else {
        // Auto-generate using shared helper (skips poisoned suffixes)
        const companyDetails = await getCompanyDetails();
        quoteNumber = await getNextQuoteNumber(db, companyDetails.quotationPrefix);
      }

      // Verify user token (already verified above)
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Resolve / auto-upsert client + building so the customer info is
      // saved on first input and reused on later quotations/invoices.
      const resolvedClientId = await resolveClientId(db, user.id, {
        existingClientId: input.clientId ?? null,
        customerName: input.customerName,
        companyName: input.companyName ?? null,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        address: input.address,
        customerVatNumber: input.customerVatNumber ?? null,
      });
      const resolvedBuildingId = await resolveClientBuildingId(db, {
        existingClientBuildingId: input.clientBuildingId ?? null,
        clientId: resolvedClientId,
        address: input.address,
        // PR-8J — pass the site/building name so distinct sites sharing a
        // head-office accounting address get their own ClientBuilding row
        // (and therefore appear in the artisan dropdown).
        buildingName: input.customerName,
      });

      // Canonicalise totals server-side so the stored values always match
      // what the form/PDF will display (avoids 5014.57 vs 5014.58 drift).
      const canonicalTotals = computeInvoiceTotals(input.items, input.discountPercent);

      // Deposit request derivation — percent authoritative.
      const roundMoney2 = (n: number) =>
        Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
      const qDepPct = Math.max(0, Math.min(100, Number(input.depositRequestedPercent) || 0));
      let qDepAmt = 0;
      if (qDepPct > 0) {
        qDepAmt = roundMoney2((canonicalTotals.total * qDepPct) / 100);
      } else if (input.depositRequestedAmount && input.depositRequestedAmount > 0) {
        qDepAmt = roundMoney2(Math.min(canonicalTotals.total, input.depositRequestedAmount));
      }

      const quotation = await db.quotation.create({
        data: {
          quoteNumber,
          clientReferenceQuoteNumber: input.clientReferenceQuoteNumber || null,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address,
          items: input.items,
          subtotal: canonicalTotals.subtotal,
          discountPercent: canonicalTotals.discountPercent,
          discountAmount: canonicalTotals.discountAmount,
          tax: canonicalTotals.tax,
          total: canonicalTotals.total,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes || null,
          assignedToId: user.role === "CONTRACTOR" ? user.id : (input.assignedToId || null),
          leadId: input.leadId || null,
          projectId: input.projectId || null,
          companyMaterialCost: input.companyMaterialCost,
          companyLabourCost: input.companyLabourCost,
          estimatedProfit: input.estimatedProfit,
          labourRate: input.labourRate || null,
          customerVatNumber: input.customerVatNumber || null,
          projectDescription: input.projectDescription || null,
          depositRequestedPercent: qDepPct,
          depositRequestedAmount: qDepAmt,
          depositDueDate: input.depositDueDate ? new Date(input.depositDueDate) : null,
          clientId: resolvedClientId,
          clientBuildingId: resolvedBuildingId,
          status: (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") ? "DRAFT" : "DRAFT",
          // Ensure contractor-created quotations are attributable to the contractor/company.
          // This drives contractor visibility and reporting in getQuotations.
          createdById:
            user.role === "CONTRACTOR" ||
            user.role === "CONTRACTOR_SENIOR_MANAGER" ||
            user.role === "CONTRACTOR_JUNIOR_MANAGER"
              ? user.id
              : null,
          ...(input.quotationDate ? { createdAt: new Date(input.quotationDate) } : {}),
        },
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

      // Notify artisan if quotation is assigned to one (and they're not the creator)
      try {
        const effectiveAssignedToId = user.role === "CONTRACTOR" ? user.id : (input.assignedToId || null);
        if (effectiveAssignedToId && effectiveAssignedToId !== parsed.userId) {
          const assignedUser = await db.user.findUnique({
            where: { id: effectiveAssignedToId },
            select: { role: true },
          });
          if (assignedUser && assignedUser.role === 'ARTISAN') {
            const { notifyArtisanQuotationAssigned } = await import('~/server/utils/notifications');
            await notifyArtisanQuotationAssigned({
              artisanId: effectiveAssignedToId,
              quoteNumber: quotation.quoteNumber,
              quotationId: quotation.id,
              serviceType: quotation.lead?.serviceType,
              address: quotation.address,
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send quotation assignment notification:', notifError);
      }

      await writeAuditLog(db, {
        actor: user,
        action: "CREATE",
        entityType: "Quotation",
        entityId: quotation.id,
        after: {
          quoteNumber: quotation.quoteNumber,
          customerName: quotation.customerName,
          total: quotation.total,
          status: quotation.status,
        },
        description: `Created quotation ${quotation.quoteNumber} for ${quotation.customerName}`,
      });

      return quotation;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      console.error("createQuotation error:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to create quotation",
      });
    }
  });
