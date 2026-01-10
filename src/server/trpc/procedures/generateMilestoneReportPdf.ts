import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { generateMilestoneReportPdf as generatePdf } from "~/server/utils/milestone-report-pdf";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const generateMilestoneReportPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    // Fetch milestone to check permissions
    const milestone = await db.milestone.findUnique({
      where: { id: input.milestoneId },
      select: {
        id: true,
        assignedToId: true,
        projectId: true,
      },
    });

    if (!milestone) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Milestone not found",
      });
    }

    // Check permissions: admins can generate any report, artisans can only generate reports for their assigned milestones
    const canGenerate = isAdmin(user) || milestone.assignedToId === user.id;
    
    if (!canGenerate) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to generate this milestone report",
      });
    }

    console.log(`[generateMilestoneReportPdf] Generating report for milestone ${input.milestoneId} by user ${user.email} (${user.role})`);

    // Generate the PDF using the utility function
    const { pdfBuffer } = await generatePdf(input.milestoneId);
    
    // Return as base64 for client consumption
    const pdfBase64 = pdfBuffer.toString("base64");
    return { pdf: pdfBase64 };
  });
