import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { notifyAdmins } from "~/server/utils/notifications";
import { createNotification } from "~/server/utils/notifications";
import { sendEmail } from "~/server/utils/email";
import { getBaseUrl } from "~/server/utils/base-url";

export const updatePropertyManagerInvoiceStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
      action: z.enum(["APPROVE", "REJECT", "MARK_PAID"]),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can update invoice status.",
      });
    }

    try {
      // Verify invoice exists and belongs to this PM
      const invoice = await db.propertyManagerInvoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          order: {
            include: {
              contractor: {
                select: {
                  id: true,
                  email: true,
                  firstName: true,
                  lastName: true,
                  role: true,
                },
              },
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

      if (invoice.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own invoices.",
        });
      }

      const now = new Date();
      let newStatus = invoice.status;
      const updateData: any = {};

      switch (input.action) {
        case "APPROVE":
          if (invoice.status !== "SENT_TO_PM") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invoice must be in SENT_TO_PM status to approve.",
            });
          }
          newStatus = "PM_APPROVED";
          updateData.pmApprovedDate = now;
          break;

        case "REJECT":
          if (invoice.status !== "SENT_TO_PM") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invoice must be in SENT_TO_PM status to reject.",
            });
          }
          newStatus = "PM_REJECTED";
          updateData.pmRejectedDate = now;
          updateData.pmRejectionReason = input.rejectionReason;
          break;

        case "MARK_PAID":
          if (invoice.status !== "PM_APPROVED") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Invoice must be approved before marking as paid.",
            });
          }
          newStatus = "PAID";
          updateData.paidDate = now;
          updateData.markedAsPaidByPMDate = now;
          break;
      }

      updateData.status = newStatus;

      const updatedInvoice = await db.propertyManagerInvoice.update({
        where: { id: input.invoiceId },
        data: updateData,
        include: {
          order: true,
        },
      });

      // Notify admins
      let notificationType: any = "PM_INVOICE_SENT";
      let message = "";
      let contractorNotificationType: any = null;
      let contractorMessage = "";

      switch (input.action) {
        case "APPROVE":
          notificationType = "PM_INVOICE_APPROVED";
          message = `Invoice ${invoice.invoiceNumber} has been approved by ${user.firstName} ${user.lastName}`;
          contractorNotificationType = "PM_INVOICE_APPROVED";
          contractorMessage = `Your invoice ${invoice.invoiceNumber} was approved by ${user.firstName} ${user.lastName}.`;
          break;
        case "REJECT":
          notificationType = "PM_INVOICE_REJECTED";
          message = `Invoice ${invoice.invoiceNumber} has been rejected by ${user.firstName} ${user.lastName}${input.rejectionReason ? `: ${input.rejectionReason}` : ""}`;
          contractorNotificationType = "PM_INVOICE_REJECTED";
          contractorMessage = `Your invoice ${invoice.invoiceNumber} was rejected by ${user.firstName} ${user.lastName}${input.rejectionReason ? `: ${input.rejectionReason}` : ""}.`;
          break;
        case "MARK_PAID":
          notificationType = "PM_INVOICE_APPROVED";
          message = `Invoice ${invoice.invoiceNumber} has been marked as paid by ${user.firstName} ${user.lastName}`;
          contractorNotificationType = "PM_INVOICE_APPROVED";
          contractorMessage = `Your invoice ${invoice.invoiceNumber} was marked as paid by ${user.firstName} ${user.lastName}.`;
          break;
      }

      await notifyAdmins({
        message,
        type: notificationType,
        relatedEntityId: invoice.id,
        relatedEntityType: "PROPERTY_MANAGER_INVOICE",
      });

      // Notify contractor (best-effort)
      const contractor = invoice.order?.contractor;
      if (contractor && contractorNotificationType) {
        await createNotification({
          recipientId: contractor.id,
          recipientRole: contractor.role,
          message: contractorMessage,
          type: contractorNotificationType,
          relatedEntityId: invoice.id,
          relatedEntityType: "PROPERTY_MANAGER_INVOICE",
        });

        try {
          const portalLink = `${getBaseUrl()}/contractor/invoices`;
          await sendEmail({
            to: contractor.email,
            subject: `Invoice update: ${invoice.invoiceNumber}`,
            html: `
              <p>Hello <strong>${contractor.firstName}</strong>,</p>
              <p>${contractorMessage}</p>
              <p><a href="${portalLink}">View in the contractor portal</a></p>
            `,
            userId: user.id,
          });
        } catch (emailError) {
          console.error("Failed to send contractor PM-invoice update email:", emailError);
        }
      }

      return updatedInvoice;
    } catch (error) {
      console.error("Error updating invoice status:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update invoice status.",
      });
    }
  });
