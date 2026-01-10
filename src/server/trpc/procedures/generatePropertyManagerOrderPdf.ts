import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { generatePropertyManagerOrderPdf } from "~/server/utils/property-manager-order-pdf";

export const generatePropertyManagerOrderPdfProcedure = baseProcedure
  .input(z.object({ orderId: z.number() }))
  .mutation(async ({ input }) => {
    const { pdfBuffer } = await generatePropertyManagerOrderPdf(input.orderId);
    return {
      pdfBase64: pdfBuffer.toString("base64"),
      filename: `PropertyManagerOrder_${input.orderId}.pdf`,
    };
  });
