import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const updateContractorPMInvoiceStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      status: z.enum(["DRAFT", "ADMIN_APPROVED", "SENT_TO_PM", "CANCELLED", "REJECTED"]),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Only contractor roles can update PM invoice status through contractor workflow
    const isContractorRole = user.role === "CONTRACTOR" || 
                            user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                            user.role === "CONTRACTOR_JUNIOR_MANAGER";

    if (!isContractorRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only contractors can update PM invoice status through contractor workflow.",
      });
    }

    try {
      // Get the invoice
      const invoice = await db.propertyManagerInvoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          order: {
            select: {
              contractorId: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found.",
        });
      }

      // Verify the contractor has access to this invoice
      // Check if invoice's order belongs to this contractor's company
      if (invoice.order?.contractorId !== user.id) {
        const contractorCompanyName = user.contractorCompanyName?.trim();

        if (!contractorCompanyName) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this invoice.",
          });
        }

        const contractorUser = await db.user.findFirst({
          where: {
            id: invoice.order?.contractorId || -1,
            contractorCompanyName,
            role: {
              in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"],
            },
          },
        });

        if (!contractorUser) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have access to this invoice.",
          });
        }
      }

      // Validate workflow transitions based on user role
      if (user.role === "CONTRACTOR_JUNIOR_MANAGER") {
        // Junior Manager: DRAFT → ADMIN_APPROVED (their review approval)
        if (invoice.status === "DRAFT" && input.status === "ADMIN_APPROVED") {
          // Valid transition
        } else if (input.status === "REJECTED" || input.status === "DRAFT") {
          // Can reject or send back to draft
        } else {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Junior Manager can only move invoices from DRAFT to ADMIN_APPROVED (pending Sr Manager approval).",
          });
        }
      }
      // Senior Manager and Contractor have full control

      const updateData: any = {
        status: input.status,
      };

      // Set approval date when moving to ADMIN_APPROVED
      if (input.status === "ADMIN_APPROVED") {
        updateData.adminApprovedDate = new Date();
        updateData.adminApprovedById = user.id;
      }

      // Set sent date when sending to PM
      if (input.status === "SENT_TO_PM") {
        updateData.sentToPMDate = new Date();
      }

      // Add rejection reason if rejecting
      if (input.status === "REJECTED" && input.rejectionReason) {
        updateData.pmRejectionReason = input.rejectionReason;
      }

      const updatedInvoice = await db.propertyManagerInvoice.update({
        where: { id: input.invoiceId },
        data: updateData,
      });

      return updatedInvoice;
    } catch (error) {
      console.error("Error updating PM invoice status:", error);
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to update invoice status",
      });
    }
  });
