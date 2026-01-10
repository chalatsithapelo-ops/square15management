import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

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
      validUntil: z.string().optional(),
      notes: z.string().optional(),
      assignedToId: z.number().nullable().optional(),
      leadId: z.number().nullable().optional(),
      projectId: z.number().nullable().optional(),
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
      labourRate: z.number().nullable().optional(),
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
      if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
      if (input.tax !== undefined) updateData.tax = input.tax;
      if (input.total !== undefined) updateData.total = input.total;
      if (input.validUntil !== undefined) {
        updateData.validUntil = input.validUntil ? new Date(input.validUntil) : null;
      }
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.assignedToId !== undefined) updateData.assignedToId = input.assignedToId;
      if (input.leadId !== undefined) updateData.leadId = input.leadId;
      if (input.projectId !== undefined) updateData.projectId = input.projectId;
      if (input.companyMaterialCost !== undefined) updateData.companyMaterialCost = input.companyMaterialCost;
      if (input.companyLabourCost !== undefined) updateData.companyLabourCost = input.companyLabourCost;
      if (input.estimatedProfit !== undefined) updateData.estimatedProfit = input.estimatedProfit;
      if (input.labourRate !== undefined) updateData.labourRate = input.labourRate;

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

      return quotation;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
