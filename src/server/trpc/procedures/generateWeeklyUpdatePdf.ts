import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { generateAndUploadWeeklyReportPdf } from "~/server/utils/weekly-report-pdf";
import { authenticateUser } from "~/server/utils/auth";

export const generateWeeklyUpdatePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      updateId: z.number(),
      forCustomer: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and get their role
    const user = await authenticateUser(input.token);

    const update = await db.weeklyBudgetUpdate.findUnique({
      where: { id: input.updateId },
    });

    if (!update) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Weekly update not found",
      });
    }

    // Determine whether to hide financial information
    // If forCustomer is explicitly provided, use that value
    // Otherwise, automatically hide financial data for CUSTOMER role
    const hideFinancialData = input.forCustomer !== undefined 
      ? input.forCustomer 
      : user.role === "CUSTOMER";

    console.log(`[generateWeeklyUpdatePdf] Generating PDF for user ${user.email} (${user.role}), hideFinancialData: ${hideFinancialData}`);

    // Generate the PDF using the utility function
    const { pdfBuffer } = await generateAndUploadWeeklyReportPdf(input.updateId, hideFinancialData);
    
    // Return as base64 for client consumption
    const pdfBase64 = pdfBuffer.toString("base64");
    return { pdf: pdfBase64 };
  });
