import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getQuotationsForRFQComparison = baseProcedure
  .input(
    z.object({
      token: z.string(),
      rfqNumber: z.string().min(3),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can compare quotations.",
      });
    }

    const rfq = await db.propertyManagerRFQ.findUnique({
      where: { rfqNumber: input.rfqNumber },
      select: { id: true, propertyManagerId: true, status: true, rfqNumber: true },
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
        message: "You can only compare quotations for your own RFQs.",
      });
    }

    // Comparison is intended for UNDER_REVIEW, but allow RECEIVED too.
    if (rfq.status !== "UNDER_REVIEW" && rfq.status !== "RECEIVED") {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "RFQ must be in Received or Under Review to compare quotations.",
      });
    }

    const quotations = await db.quotation.findMany({
      where: {
        clientReferenceQuoteNumber: rfq.rfqNumber,
        status: {
          in: ["SENT_TO_CUSTOMER", "APPROVED", "REJECTED"] as any,
        },
      },
      include: {
        createdBy: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            contractorCompanyName: true,
          },
        },
      },
      orderBy: {
        total: "asc",
      },
    });

    const artisanIds = quotations
      .map((q) => q.createdBy?.id)
      .filter((id): id is number => typeof id === "number");

    const ratingByArtisanId = new Map<number, number>();

    if (artisanIds.length > 0) {
      const grouped = await db.review.groupBy({
        by: ["artisanId"],
        where: {
          artisanId: { in: artisanIds },
        },
        _avg: {
          rating: true,
        },
      });

      for (const row of grouped) {
        if (typeof row._avg.rating === "number") {
          ratingByArtisanId.set(row.artisanId, Math.round(row._avg.rating * 10) / 10);
        }
      }
    }

    return quotations.map((q) => ({
      id: q.id,
      quoteNumber: q.quoteNumber,
      total: q.total,
      subtotal: q.subtotal,
      tax: q.tax,
      status: q.status,
      createdAt: q.createdAt,
      createdBy: q.createdBy
        ? {
            id: q.createdBy.id,
            firstName: q.createdBy.firstName,
            lastName: q.createdBy.lastName,
            email: q.createdBy.email,
            contractorCompanyName: q.createdBy.contractorCompanyName,
            rating: ratingByArtisanId.get(q.createdBy.id) ?? null,
          }
        : null,
    }));
  });
