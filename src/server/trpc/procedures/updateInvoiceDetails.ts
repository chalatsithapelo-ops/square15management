import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

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
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      orderId: z.number().nullable().optional(),
      projectId: z.number().nullable().optional(),
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
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
      if (input.subtotal !== undefined) updateData.subtotal = input.subtotal;
      if (input.tax !== undefined) updateData.tax = input.tax;
      if (input.total !== undefined) updateData.total = input.total;
      if (input.dueDate !== undefined) {
        updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      }
      if (input.notes !== undefined) updateData.notes = input.notes || null;
      if (input.orderId !== undefined) updateData.orderId = input.orderId;
      if (input.projectId !== undefined) updateData.projectId = input.projectId;
      if (input.companyMaterialCost !== undefined) updateData.companyMaterialCost = input.companyMaterialCost;
      if (input.companyLabourCost !== undefined) updateData.companyLabourCost = input.companyLabourCost;
      if (input.estimatedProfit !== undefined) updateData.estimatedProfit = input.estimatedProfit;

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

      return invoice;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
