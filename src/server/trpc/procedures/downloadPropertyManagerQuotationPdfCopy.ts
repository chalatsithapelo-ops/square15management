import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const downloadPropertyManagerQuotationPdfCopy = baseProcedure
  .input(
    z.object({
      token: z.string(),
      copyId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can download quotation PDF copies.",
      });
    }

    const copy = await (db as any)["propertyManagerQuotationPdfCopy"].findUnique({
      where: { id: input.copyId },
      select: {
        id: true,
        propertyManagerId: true,
        filename: true,
        pdfData: true,
      },
    });

    if (!copy) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Saved copy not found.",
      });
    }

    if (copy.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only download your own saved copies.",
      });
    }

    const pdfBase64 = Buffer.from(copy.pdfData).toString("base64");

    return {
      pdfBase64,
      filename: copy.filename,
    };
  });
