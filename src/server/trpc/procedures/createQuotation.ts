import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";

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
      validUntil: z.string().optional(),
      notes: z.string().optional(),
      assignedToId: z.number().optional(),
      leadId: z.number().optional(),
      projectId: z.number().optional(),
      companyMaterialCost: z.number().default(0),
      companyLabourCost: z.number().default(0),
      estimatedProfit: z.number().default(0),
      labourRate: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

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
        // Auto-generate unique quotation number with custom prefix
        const companyDetails = await getCompanyDetails();
        const count = await db.quotation.count();
        quoteNumber = `${companyDetails.quotationPrefix}-${String(count + 1).padStart(5, "0")}`;
      }

      // Verify user token (already verified at line 41)
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

      const quotation = await db.quotation.create({
        data: {
          quoteNumber,
          clientReferenceQuoteNumber: input.clientReferenceQuoteNumber || null,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address,
          items: input.items,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes || null,
          assignedToId: user.role === "CONTRACTOR" ? user.id : (input.assignedToId || null),
          leadId: input.leadId || null,
          projectId: input.projectId || null,
          companyMaterialCost: input.companyMaterialCost,
          companyLabourCost: input.companyLabourCost,
          estimatedProfit: input.estimatedProfit,
          labourRate: input.labourRate || null,
          status: (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") ? "DRAFT" : "DRAFT",
          // Ensure contractor-created quotations are attributable to the contractor/company.
          // This drives contractor visibility and reporting in getQuotations.
          createdById:
            user.role === "CONTRACTOR" ||
            user.role === "CONTRACTOR_SENIOR_MANAGER" ||
            user.role === "CONTRACTOR_JUNIOR_MANAGER"
              ? user.id
              : null,
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
            });
          }
        }
      } catch (notifError) {
        console.error('Failed to send quotation assignment notification:', notifError);
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
