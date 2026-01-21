import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateQuotationPdfBuffer } from "~/server/utils/quotation-pdf-buffer";
import { createNotification, notifyAdmins } from "~/server/utils/notifications";
import { sendEmail } from "~/server/utils/email";
import { getBaseUrl } from "~/server/utils/base-url";

export const selectQuotationForRFQ = baseProcedure
  .input(
    z.object({
      token: z.string(),
      rfqNumber: z.string().min(3),
      selectedQuotationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can approve quotations.",
      });
    }

    const rfq = await db.propertyManagerRFQ.findUnique({
      where: { rfqNumber: input.rfqNumber },
      select: {
        id: true,
        propertyManagerId: true,
        status: true,
        rfqNumber: true,
        generatedOrderId: true,
      },
    });

    if (!rfq) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "RFQ not found.",
      });
    }

    if (rfq.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only approve quotations for your own RFQs.",
      });
    }

    if (rfq.status !== "UNDER_REVIEW") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "RFQ must be in Under Review to approve a quotation.",
      });
    }

    if (rfq.generatedOrderId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "This RFQ has already been converted to an order.",
      });
    }

    const quotations = await db.quotation.findMany({
      where: {
        clientReferenceQuoteNumber: rfq.rfqNumber,
        status: {
          in: ["SENT_TO_CUSTOMER", "APPROVED", "REJECTED"] as any,
        },
      },
      select: { id: true },
    });

    if (quotations.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No quotations found for this RFQ number.",
      });
    }

    const quotationIds = quotations.map((q) => q.id);

    if (!quotationIds.includes(input.selectedQuotationId)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Selected quotation does not belong to this RFQ.",
      });
    }

    // Generate PDFs up-front (outside DB transaction) for record-keeping copies.
    // These copies are owned by the Property Manager and can be deleted without affecting the originals.
    const approvedId = input.selectedQuotationId;
    const rejectedIds = quotationIds.filter((id) => id !== approvedId);

    const [approvedPdf, rejectedPdfs] = await Promise.all([
      generateQuotationPdfBuffer(approvedId),
      Promise.all(rejectedIds.map((id) => generateQuotationPdfBuffer(id))),
    ]);

    await db.$transaction(async (tx) => {
      const copiesDelegate = (tx as any)["propertyManagerQuotationPdfCopy"];
      await tx.quotation.update({
        where: { id: approvedId },
        data: {
          status: "APPROVED" as any,
          rejectionReason: null,
        },
      });

      if (rejectedIds.length > 0) {
        await tx.quotation.updateMany({
          where: {
            id: { in: rejectedIds },
          },
          data: {
            status: "REJECTED" as any,
            rejectionReason: "Not selected",
          },
        });
      }

      await tx.propertyManagerRFQ.update({
        where: { id: rfq.id },
        data: {
          status: "APPROVED",
          approvedDate: new Date(),
        },
      });

      // Upsert the approved copy
      await copiesDelegate.upsert({
        where: {
          propertyManagerId_quotationId_decision: {
            propertyManagerId: user.id,
            quotationId: approvedId,
            decision: "APPROVED",
          },
        },
        create: {
          propertyManagerId: user.id,
          rfqId: rfq.id,
          rfqNumber: rfq.rfqNumber,
          quotationId: approvedId,
          decision: "APPROVED",
          filename: approvedPdf.filename,
          pdfData: approvedPdf.pdfBuffer,
        },
        update: {
          rfqId: rfq.id,
          rfqNumber: rfq.rfqNumber,
          filename: approvedPdf.filename,
          pdfData: approvedPdf.pdfBuffer,
        },
      });

      // Upsert rejected copies
      for (let i = 0; i < rejectedIds.length; i++) {
        const quotationId = rejectedIds[i]!;
        const pdf = rejectedPdfs[i]!;

        await copiesDelegate.upsert({
          where: {
            propertyManagerId_quotationId_decision: {
              propertyManagerId: user.id,
              quotationId,
              decision: "REJECTED",
            },
          },
          create: {
            propertyManagerId: user.id,
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            quotationId,
            decision: "REJECTED",
            filename: pdf.filename,
            pdfData: pdf.pdfBuffer,
          },
          update: {
            rfqId: rfq.id,
            rfqNumber: rfq.rfqNumber,
            filename: pdf.filename,
            pdfData: pdf.pdfBuffer,
          },
        });
      }
    });

    // Notify quotation creators (approved/rejected) + admins (best-effort)
    const allDecidedIds = [approvedId, ...rejectedIds];
    const decidedQuotations = await db.quotation.findMany({
      where: { id: { in: allDecidedIds } },
      select: {
        id: true,
        quoteNumber: true,
        createdBy: {
          select: {
            id: true,
            role: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    const portalLink = `${getBaseUrl()}`;

    for (const quotation of decidedQuotations) {
      if (!quotation.createdBy) continue;
      const isApproved = quotation.id === approvedId;
      const notificationType = isApproved ? "RFQ_APPROVED" : "RFQ_REJECTED";
      const decisionText = isApproved ? "approved" : "rejected";

      await createNotification({
        recipientId: quotation.createdBy.id,
        recipientRole: quotation.createdBy.role,
        message: `Your quotation ${quotation.quoteNumber} for RFQ ${rfq.rfqNumber} was ${decisionText} by ${user.firstName} ${user.lastName}.`,
        type: notificationType,
        relatedEntityId: quotation.id,
        relatedEntityType: "QUOTATION",
      });

      try {
        await sendEmail({
          to: quotation.createdBy.email,
          subject: `Quotation ${quotation.quoteNumber} ${decisionText} (RFQ ${rfq.rfqNumber})`,
          html: `
            <p>Hello <strong>${quotation.createdBy.firstName}</strong>,</p>
            <p>Your quotation <strong>${quotation.quoteNumber}</strong> for RFQ <strong>${rfq.rfqNumber}</strong> was <strong>${decisionText}</strong> by ${user.firstName} ${user.lastName}.</p>
            <p>Log into the portal for details: <a href="${portalLink}">${portalLink}</a></p>
          `,
          userId: user.id,
        });
      } catch (emailError) {
        console.error("Failed to send RFQ quotation decision email:", emailError);
      }
    }

    await notifyAdmins({
      message: `Quotation selection completed for RFQ ${rfq.rfqNumber} by ${user.firstName} ${user.lastName}.`,
      type: "RFQ_APPROVED",
      relatedEntityId: rfq.id,
      relatedEntityType: "PROPERTY_MANAGER_RFQ",
    });

    return { success: true };
  });
