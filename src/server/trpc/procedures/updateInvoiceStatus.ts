import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { sendInvoiceNotificationEmail } from "~/server/utils/email";
import { notifyAdminsInvoicePaid, notifyCustomerInvoice } from "~/server/utils/notifications";

export const updateInvoiceStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      status: z.enum(["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "SENT", "PAID", "OVERDUE", "CANCELLED", "REJECTED"]).optional(),
      rejectionReason: z.string().optional(),
      pmApproved: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
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

      // Get the current invoice to check due date for automatic status allocation
      const currentInvoice = await db.invoice.findUnique({
        where: { id: input.invoiceId },
        include: { createdBy: true },
      });

      if (!currentInvoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      // Property Manager validation - they can only update invoices where they are the customer
      if (user.role === "PROPERTY_MANAGER") {
        if (currentInvoice.customerEmail !== user.email) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Property Manager can only update invoices addressed to them",
          });
        }
        // Property Managers can approve (set pmApproved=true), mark as PAID, or reject invoices
        if (input.status && input.status !== "PAID" && input.status !== "REJECTED" && !input.pmApproved) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Property Manager can only approve, mark as PAID, or reject invoices",
          });
        }
      }

      // Check if this is a contractor invoice (created by contractor)
      const isContractorInvoice = currentInvoice.createdBy && 
        (currentInvoice.createdBy.role === "CONTRACTOR" || 
         currentInvoice.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" || 
         currentInvoice.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER");

      // Contractor workflow validation
      if (isContractorInvoice) {
        // Junior Manager can approve from DRAFT to PENDING_APPROVAL
        if (user.role === "CONTRACTOR_JUNIOR_MANAGER") {
          if (currentInvoice.status === "DRAFT" && input.status === "PENDING_APPROVAL") {
            // Valid transition
          } else if (input.status === "REJECTED" || input.status === "DRAFT") {
            // Junior Manager can reject or send back to draft
          } else {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Junior Manager can only approve invoices from DRAFT to PENDING_APPROVAL",
            });
          }
        }
        // Senior Manager and Contractor (who is the senior manager of their company)
        // have full control over invoice status changes
        else if (user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR") {
          // Senior managers and contractors have full approval authority - no restrictions
          // They can change status to anything needed
        }
      }

      let finalStatus = input.status;

      // Automatic status allocation when approving (moving from PENDING_APPROVAL)
      // When admin approves, check due date and set to SENT or OVERDUE
      if (input.status && currentInvoice.status === "PENDING_APPROVAL" && 
          (input.status === "SENT" || input.status === "OVERDUE")) {
        if (currentInvoice.dueDate) {
          const now = new Date();
          const dueDate = new Date(currentInvoice.dueDate);
          
          // If due date is in the past, set to OVERDUE, otherwise SENT
          if (dueDate < now) {
            finalStatus = "OVERDUE";
          } else {
            finalStatus = "SENT";
          }
        } else {
          // If no due date is set, default to SENT
          finalStatus = "SENT";
        }
      }

      const updateData: any = {};
      
      // Update status if provided
      if (finalStatus) {
        updateData.status = finalStatus;
        updateData.paidDate = finalStatus === "PAID" ? new Date() : undefined;
      }
      
      // Update pmApproved if provided
      if (input.pmApproved !== undefined) {
        updateData.pmApproved = input.pmApproved;
        updateData.pmApprovedDate = input.pmApproved ? new Date() : null;
      }

      // Store rejection reason if status is REJECTED
      if (finalStatus === "REJECTED") {
        updateData.rejectionReason = input.rejectionReason || null;
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

      // In-app notifications (best-effort): customer + admins
      if (finalStatus && finalStatus !== currentInvoice.status) {
        // Try to map customer email -> user account for in-app notifications
        const customerUser = await db.user.findUnique({
          where: { email: invoice.customerEmail },
          select: { id: true },
        });

        if (customerUser && (finalStatus === "SENT" || finalStatus === "OVERDUE")) {
          await notifyCustomerInvoice({
            customerId: customerUser.id,
            invoiceNumber: invoice.invoiceNumber,
            invoiceId: invoice.id,
            status: finalStatus,
            amount: invoice.total,
          });
        }

        if (finalStatus === "PAID") {
          await notifyAdminsInvoicePaid({
            invoiceNumber: invoice.invoiceNumber,
            invoiceId: invoice.id,
            amount: invoice.total,
            customerName: invoice.customerName,
          });
        }
      }

      // Send email notification when invoice status changes to SENT
      if (finalStatus === "SENT" && currentInvoice.status !== "SENT") {
        try {
          await sendInvoiceNotificationEmail({
            customerEmail: invoice.customerEmail,
            customerName: invoice.customerName,
            invoiceNumber: invoice.invoiceNumber,
            invoiceAmount: invoice.total,
            invoiceDueDate: invoice.dueDate,
            orderNumber: invoice.order?.orderNumber,
            projectName: invoice.project?.name,
            userId: user.id, // Send from the user who sent the invoice
          });
          console.log(`Invoice notification email sent to ${invoice.customerEmail}`);
        } catch (emailError) {
          console.error("Failed to send invoice notification email:", emailError);
          // Don't fail the operation if email fails
        }
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
