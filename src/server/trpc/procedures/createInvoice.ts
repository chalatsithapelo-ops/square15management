import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";

export const createInvoice = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceNumber: z.string().min(1).optional().or(z.literal("").transform(() => undefined)),
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
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      orderId: z.number().optional(),
      projectId: z.number().optional(),
      isPMOrder: z.boolean().optional(), // Flag to indicate if this is for a PM order
      pmOrderId: z.number().optional(), // PropertyManagerOrder ID
    })
  )
  .mutation(async ({ input }) => {
    try {
      console.log('createInvoice - Received token:', input.token ? 'Token exists' : 'Token is missing');
      
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      console.log('createInvoice - Token verified successfully');
      
      z.object({ userId: z.number() }).parse(verified);

      // Use provided invoiceNumber or auto-generate
      let invoiceNumber: string;
      
      if (input.invoiceNumber) {
        // Check if the provided invoiceNumber is already in use in either table
        const existingInvoice = await db.invoice.findUnique({
          where: { invoiceNumber: input.invoiceNumber },
        });
        
        const existingPMInvoice = await db.propertyManagerInvoice.findUnique({
          where: { invoiceNumber: input.invoiceNumber },
        });

        if (existingInvoice || existingPMInvoice) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Invoice number "${input.invoiceNumber}" is already in use. Please choose a different number.`,
          });
        }
        
        invoiceNumber = input.invoiceNumber;
      } else {
        // Auto-generate unique invoice number with custom prefix
        const companyDetails = await getCompanyDetails();
        // Count both Invoice and PropertyManagerInvoice tables to avoid duplicates
        const invoiceCount = await db.invoice.count();
        const pmInvoiceCount = await db.propertyManagerInvoice.count();
        const totalCount = invoiceCount + pmInvoiceCount;
        invoiceNumber = `${companyDetails.invoicePrefix}-${String(totalCount + 1).padStart(5, "0")}`;
      }

      // Token already verified at line 41
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

      // Check if this is for a PropertyManagerOrder
      if (input.isPMOrder && input.pmOrderId) {
        // Get the PM order to find the property manager
        const pmOrder = await db.propertyManagerOrder.findUnique({
          where: { id: input.pmOrderId },
          select: {
            propertyManagerId: true,
            orderNumber: true,
          },
        });

        if (!pmOrder) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Property Manager Order not found",
          });
        }

        // Create a PropertyManagerInvoice instead
        const pmInvoice = await db.propertyManagerInvoice.create({
          data: {
            invoiceNumber,
            propertyManagerId: pmOrder.propertyManagerId,
            orderId: input.pmOrderId,
            items: input.items,
            subtotal: input.subtotal,
            tax: input.tax,
            total: input.total,
            dueDate: input.dueDate ? new Date(input.dueDate) : null,
            notes: input.notes || null,
            // Start with DRAFT status for approval workflow
            status: "DRAFT",
          },
          include: {
            order: {
              select: {
                id: true,
                orderNumber: true,
                title: true,
              },
            },
            propertyManager: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        return pmInvoice as any; // Return as Invoice type for compatibility
      }

      // Otherwise, create a regular invoice
      const invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address,
          items: input.items,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          notes: input.notes || null,
          orderId: input.orderId || null,
          projectId: input.projectId || null,
          status: (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") ? "DRAFT" : "PENDING_REVIEW",
          companyMaterialCost: input.companyMaterialCost || 0,
          companyLabourCost: input.companyLabourCost || 0,
          estimatedProfit: input.estimatedProfit || 0,
          createdById: user.id, // Track who created this invoice for portal separation
        },
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
      console.error("Error creating invoice:", error);
      
      // Check if it's a JWT error
      if (error instanceof jwt.JsonWebTokenError) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "Invalid or expired token",
        });
      }
      
      // If it's already a TRPCError, rethrow it
      if (error instanceof TRPCError) {
        throw error;
      }
      
      // For other errors, log and throw generic error
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to create invoice",
      });
    }
  });
