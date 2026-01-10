import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateQuotationPdfBuffer } from "~/server/utils/quotation-pdf-buffer";

export const getPropertyManagerQuotationPdfCopies = baseProcedure
  .input(
    z
      .object({
        token: z.string(),
        rfqId: z.number().optional(),
        rfqNumber: z.string().min(3).optional(),
        decision: z.enum(["APPROVED", "REJECTED"]).optional(),
      })
      .refine((v) => !!v.rfqId || !!v.rfqNumber, {
        message: "rfqId or rfqNumber is required",
      })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can access quotation PDF copies.",
      });
    }

    const rfq = await db.propertyManagerRFQ.findFirst({
      where: {
        ...(input.rfqId ? { id: input.rfqId } : {}),
        ...(input.rfqNumber ? { rfqNumber: input.rfqNumber } : {}),
      },
      select: { id: true, propertyManagerId: true, rfqNumber: true, status: true },
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
        message: "You can only access copies for your own RFQs.",
      });
    }

    const prisma: any = db;
    const listCopies = async () =>
      prisma.propertyManagerQuotationPdfCopy.findMany({
      where: {
        propertyManagerId: user.id,
        rfqId: rfq.id,
        ...(input.decision ? { decision: input.decision } : {}),
      },
      select: {
        id: true,
        createdAt: true,
        decision: true,
        filename: true,
        quotationId: true,
        rfqNumber: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const copies = await listCopies();
    if (Array.isArray(copies) && copies.length > 0) {
      return copies;
    }

    // Self-heal: if an RFQ has already been approved/converted/rejected, but no saved
    // record copies exist (e.g. older RFQs approved via a different flow), generate them now.
    // This is scoped to the single RFQ being viewed.
    const quotationRows = await db.quotation.findMany({
      where: {
        clientReferenceQuoteNumber: rfq.rfqNumber,
        status: {
          in: ["SENT_TO_CUSTOMER", "APPROVED", "REJECTED"] as any,
        },
      },
      select: {
        id: true,
        status: true,
      },
    });

    if (!quotationRows || quotationRows.length === 0) {
      return copies;
    }

    const hasApprovedQuotation = quotationRows.some((q) => q.status === "APPROVED");

    const toPersist = quotationRows
      .map((q) => {
        const status = String(q.status);

        if (status === "APPROVED") {
          return { quotationId: q.id, decision: "APPROVED" as const };
        }

        if (status === "REJECTED") {
          return { quotationId: q.id, decision: "REJECTED" as const };
        }

        // For still-sent quotations, infer rejection if another winner exists or the RFQ itself
        // is in a terminal state that implies selection happened.
        if (status === "SENT_TO_CUSTOMER") {
          if (hasApprovedQuotation || rfq.status === "REJECTED" || rfq.status === "CONVERTED_TO_ORDER" || rfq.status === "APPROVED") {
            return { quotationId: q.id, decision: "REJECTED" as const };
          }
        }

        return null;
      })
      .filter(Boolean) as Array<{ quotationId: number; decision: "APPROVED" | "REJECTED" }>;

    if (toPersist.length === 0) {
      return copies;
    }

    const delegate = prisma.propertyManagerQuotationPdfCopy;
    const pdfs = await Promise.all(toPersist.map((x) => generateQuotationPdfBuffer(x.quotationId)));

    for (let i = 0; i < toPersist.length; i++) {
      const entry = toPersist[i]!;
      const pdf = pdfs[i]!;
      await delegate.upsert({
        where: {
          propertyManagerId_quotationId_decision: {
            propertyManagerId: user.id,
            quotationId: entry.quotationId,
            decision: entry.decision,
          },
        },
        create: {
          propertyManagerId: user.id,
          rfqId: rfq.id,
          rfqNumber: rfq.rfqNumber,
          quotationId: entry.quotationId,
          decision: entry.decision,
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

    return await listCopies();
  });
