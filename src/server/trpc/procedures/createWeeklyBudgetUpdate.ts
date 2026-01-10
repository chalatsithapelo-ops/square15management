import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { generateAndUploadWeeklyReportPdf } from "~/server/utils/weekly-report-pdf";
import { sendWeeklyProgressReportEmail } from "~/server/utils/email";

export const createWeeklyBudgetUpdate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      weekStartDate: z.string(),
      weekEndDate: z.string(),
      labourExpenditure: z.number().default(0),
      materialExpenditure: z.number().default(0),
      otherExpenditure: z.number().default(0),
      progressPercentage: z.number().min(0).max(100).default(0),
      notes: z.string().optional(),
      // New detailed reporting fields
      workDone: z.string().optional(),
      challenges: z.string().optional(),
      successes: z.string().optional(),
      imagesDone: z.array(z.string()).default([]),
      itemizedExpenses: z.array(
        z.object({
          itemDescription: z.string(),
          quotedAmount: z.number(),
          actualSpent: z.number(),
          supplierInvoiceUrl: z.string().optional(),
          reasonForOverspend: z.string().optional(),
        })
      ).optional(),
      nextWeekPlan: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Verify milestone exists
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      const totalExpenditure =
        input.labourExpenditure + input.materialExpenditure + input.otherExpenditure;

      const weeklyUpdate = await db.weeklyBudgetUpdate.create({
        data: {
          milestoneId: input.milestoneId,
          weekStartDate: new Date(input.weekStartDate),
          weekEndDate: new Date(input.weekEndDate),
          labourExpenditure: input.labourExpenditure,
          materialExpenditure: input.materialExpenditure,
          otherExpenditure: input.otherExpenditure,
          totalExpenditure,
          progressPercentage: input.progressPercentage,
          notes: input.notes || null,
          createdById: parsed.userId,
          // New detailed reporting fields
          workDone: input.workDone || null,
          challenges: input.challenges || null,
          successes: input.successes || null,
          imagesDone: input.imagesDone,
          itemizedExpenses: input.itemizedExpenses || null,
          nextWeekPlan: input.nextWeekPlan || null,
        },
      });

      // Update milestone's actual cost
      const allUpdates = await db.weeklyBudgetUpdate.findMany({
        where: { milestoneId: input.milestoneId },
      });

      const totalActualCost = allUpdates.reduce(
        (sum, update) => sum + update.totalExpenditure,
        0
      );

      await db.milestone.update({
        where: { id: input.milestoneId },
        data: {
          actualCost: totalActualCost,
          progressPercentage: input.progressPercentage,
        },
      });

      // Generate PDF report and upload to MinIO
      try {
        console.log(`[createWeeklyBudgetUpdate] Generating PDF for weekly update ${weeklyUpdate.id}`);
        const { pdfBuffer, pdfUrl } = await generateAndUploadWeeklyReportPdf(weeklyUpdate.id);
        
        // Update the weekly update with the PDF URL
        await db.weeklyBudgetUpdate.update({
          where: { id: weeklyUpdate.id },
          data: { pdfUrl },
        });
        
        console.log(`[createWeeklyBudgetUpdate] PDF generated and uploaded: ${pdfUrl}`);
        
        // Fetch project details to get customer email
        const project = await db.project.findUnique({
          where: { id: milestone.projectId },
          select: {
            customerEmail: true,
            name: true,
          },
        });
        
        // Fetch all admin users to get their email addresses
        const admins = await db.user.findMany({
          where: {
            role: {
              in: ["JUNIOR_ADMIN", "SENIOR_ADMIN"],
            },
          },
          select: {
            email: true,
          },
        });
        
        // Compile list of recipients (customer + all admins)
        const recipients: string[] = [];
        if (project?.customerEmail) {
          recipients.push(project.customerEmail);
        }
        recipients.push(...admins.map((admin) => admin.email));
        
        // Remove duplicates
        const uniqueRecipients = [...new Set(recipients)];
        
        if (uniqueRecipients.length > 0) {
          console.log(`[createWeeklyBudgetUpdate] Sending email to ${uniqueRecipients.length} recipients:`, uniqueRecipients);
          
          // Send email to all stakeholders
          await sendWeeklyProgressReportEmail({
            recipients: uniqueRecipients,
            projectName: project?.name || milestone.name,
            milestoneName: milestone.name,
            weekStartDate: new Date(input.weekStartDate),
            weekEndDate: new Date(input.weekEndDate),
            progressPercentage: input.progressPercentage,
            pdfBuffer,
            weekNumber: weeklyUpdate.id,
          });
          
          console.log(`[createWeeklyBudgetUpdate] Email sent successfully to all stakeholders`);
        } else {
          console.warn(`[createWeeklyBudgetUpdate] No recipients found for weekly update ${weeklyUpdate.id}`);
        }
      } catch (emailError) {
        // Log the error but don't fail the entire operation
        console.error(`[createWeeklyBudgetUpdate] Failed to generate PDF or send email:`, emailError);
        // Continue execution - the weekly update was still created successfully
      }

      return weeklyUpdate;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
