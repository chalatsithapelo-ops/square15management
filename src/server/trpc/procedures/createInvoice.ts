import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";
import { computeInvoiceTotals } from "~/utils/money";
import { resolveClientId, resolveClientBuildingId } from "~/server/trpc/procedures/clients";
import { getNextInvoiceNumber } from "~/server/utils/documentNumbers";
import { authenticateUser } from "~/server/utils/auth";
import { writeAuditLog } from "~/server/utils/auditLog";

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
      discountPercent: z.number().min(0).max(100).default(0),
      // Deposit REQUESTED from the client on the invoice document itself.
      // Percent is stored authoritatively; amount is recomputed server-side
      // from the canonical total so the two never drift.
      depositRequestedPercent: z.number().min(0).max(100).optional(),
      depositRequestedAmount: z.number().min(0).optional(),
      depositDueDate: z.string().optional(),
      companyMaterialCost: z.number().optional(),
      companyLabourCost: z.number().optional(),
      estimatedProfit: z.number().optional(),
      dueDate: z.string().optional(),
      notes: z.string().optional(),
      orderId: z.number().optional(),
      projectId: z.number().optional(),
      isPMOrder: z.boolean().optional(), // Flag to indicate if this is for a PM order
      pmOrderId: z.number().optional(), // PropertyManagerOrder ID
      clientReferenceNumber: z.string().optional(), // Client reference / order number
      customerVatNumber: z.string().optional(), // Customer VAT number
      projectDescription: z.string().optional(), // Project description shown above line items on PDF
      invoiceDate: z.string().optional(), // Custom invoice date (overrides createdAt)
      // Reusable client linkage (auto-upsert if not provided)
      clientId: z.number().optional(),
      clientBuildingId: z.number().optional(),
      companyName: z.string().optional(),
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
        // Auto-generate unique invoice number using the sanitised helper
        const companyDetails = await getCompanyDetails();
        invoiceNumber = await getNextInvoiceNumber(db, companyDetails.invoicePrefix);
      }

      // Token already verified at line 41
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Canonicalise totals server-side so the stored values always match
      // what the form/PDF will display (avoids 5014.57 vs 5014.58 drift).
      const canonical = computeInvoiceTotals(input.items, input.discountPercent);
      const canonicalSubtotal = canonical.subtotal;
      const canonicalDiscountPct = canonical.discountPercent;
      const canonicalDiscountAmt = canonical.discountAmount;
      const canonicalTax = canonical.tax;
      const canonicalTotal = canonical.total;

      // Deposit request derivation: prefer percent when supplied so the
      // amount stays consistent with the canonical total.
      const roundMoney = (n: number) =>
        Number.isFinite(n) ? Math.round((n + Number.EPSILON) * 100) / 100 : 0;
      const depReqPctRaw = Number(input.depositRequestedPercent) || 0;
      const depReqPct = Math.max(0, Math.min(100, depReqPctRaw));
      let depReqAmt = 0;
      if (depReqPct > 0) {
        depReqAmt = roundMoney((canonicalTotal * depReqPct) / 100);
      } else if (input.depositRequestedAmount && input.depositRequestedAmount > 0) {
        depReqAmt = roundMoney(Math.min(canonicalTotal, input.depositRequestedAmount));
      }

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
        const twoWeeksFromNow = new Date();
        twoWeeksFromNow.setDate(twoWeeksFromNow.getDate() + 14);
        const pmInvoice = await db.propertyManagerInvoice.create({
          data: {
            invoiceNumber,
            propertyManagerId: pmOrder.propertyManagerId,
            orderId: input.pmOrderId,
            items: input.items,
            subtotal: canonicalSubtotal,
            tax: canonicalTax,
            total: canonicalTotal,
            dueDate: input.dueDate ? new Date(input.dueDate) : twoWeeksFromNow,
            notes: input.notes || null,
            // Start with DRAFT status for approval workflow
            status: "DRAFT",
            ...(input.invoiceDate ? { createdAt: new Date(input.invoiceDate) } : {}),
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
      const twoWeeksFromNowRegular = new Date();
      twoWeeksFromNowRegular.setDate(twoWeeksFromNowRegular.getDate() + 14);

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

      const invoice = await db.invoice.create({
        data: {
          invoiceNumber,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address,
          items: input.items,
          subtotal: canonicalSubtotal,
          discountPercent: canonicalDiscountPct,
          discountAmount: canonicalDiscountAmt,
          tax: canonicalTax,
          total: canonicalTotal,
          dueDate: input.dueDate ? new Date(input.dueDate) : twoWeeksFromNowRegular,
          notes: input.notes || null,
          orderId: input.orderId || null,
          projectId: input.projectId || null,
          clientId: resolvedClientId,
          clientBuildingId: resolvedBuildingId,
          status: (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") ? "DRAFT" : "PENDING_REVIEW",
          companyMaterialCost: input.companyMaterialCost || 0,
          companyLabourCost: input.companyLabourCost || 0,
          estimatedProfit: input.estimatedProfit || 0,
          clientReferenceNumber: input.clientReferenceNumber || null,
          customerVatNumber: input.customerVatNumber || null,
          projectDescription: input.projectDescription || null,
          depositRequestedPercent: depReqPct,
          depositRequestedAmount: depReqAmt,
          depositDueDate: input.depositDueDate ? new Date(input.depositDueDate) : null,
          createdById: user.id, // Track who created this invoice for portal separation
          ...(input.invoiceDate ? { createdAt: new Date(input.invoiceDate) } : {}),
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

      try {
        const actor = await authenticateUser(input.token);
        await writeAuditLog(db, {
          actor,
          action: "CREATE",
          entityType: "Invoice",
          entityId: invoice.id,
          after: {
            invoiceNumber: invoice.invoiceNumber,
            customerName: invoice.customerName,
            total: invoice.total,
            status: invoice.status,
          },
          description: `Created invoice ${invoice.invoiceNumber} for ${invoice.customerName}`,
        });
      } catch (auditErr) {
        console.error('Failed to write invoice creation audit log:', auditErr);
      }

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
