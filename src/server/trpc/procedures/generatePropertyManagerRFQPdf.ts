import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { generatePropertyManagerRFQPdf } from "~/server/utils/property-manager-rfq-pdf";

export const generatePropertyManagerRFQPdfProcedure = baseProcedure
  .input(z.object({ token: z.string(), rfqId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const rfq = await db.propertyManagerRFQ.findUnique({
      where: { id: input.rfqId },
      select: {
        id: true,
        rfqNumber: true,
        propertyManagerId: true,
        selectedContractorIds: true,
      },
    });

    if (!rfq) {
      throw new TRPCError({ code: "NOT_FOUND", message: "RFQ not found" });
    }

    const isContractorRole =
      user.role === "CONTRACTOR" ||
      user.role === "CONTRACTOR_JUNIOR_MANAGER" ||
      user.role === "CONTRACTOR_SENIOR_MANAGER";

    const userIsAdmin = isAdmin(user);

    let allowed = false;

    if (user.role === "PROPERTY_MANAGER") {
      allowed = rfq.propertyManagerId === user.id;
    } else if (isContractorRole) {
      const contractor = await db.contractor.findFirst({
        where: { email: user.email },
        select: { id: true },
      });
      allowed = !!contractor && rfq.selectedContractorIds.includes(contractor.id);
    } else if (userIsAdmin) {
      allowed = true;
    }

    if (!allowed) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You do not have access to this RFQ." });
    }

    const { pdfBuffer } = await generatePropertyManagerRFQPdf(input.rfqId);
    return {
      pdfBase64: pdfBuffer.toString("base64"),
      filename: `PropertyManagerRFQ_${rfq.rfqNumber || input.rfqId}.pdf`,
    };
  });
