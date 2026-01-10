import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { sendCompletionReportEmail } from "~/server/utils/email";
import { generateMilestoneReportPdf } from "~/server/utils/milestone-report-pdf";

export const updateMilestoneStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      status: z.enum(["NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]),
      progressPercentage: z.number().min(0).max(100).optional(),
      actualStartDate: z.string().optional(),
      actualEndDate: z.string().optional(),
      notes: z.string().optional(),
      expenseSlips: z
        .array(
          z.object({
            url: z.string(),
            category: z.enum(["MATERIALS", "TOOLS", "TRANSPORTATION", "OTHER"]),
            description: z.string().optional(),
            amount: z.number().optional(),
          })
        )
        .optional(),
      // Comprehensive reporting fields for weekly budget updates
      workDone: z.string().optional(),
      challenges: z.string().optional(),
      successes: z.string().optional(),
      imagesDone: z.array(z.string()).optional(),
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
      // Week dates for the budget update (if creating one)
      weekStartDate: z.string().optional(),
      weekEndDate: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get the milestone
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
        include: {
          project: true,
        },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Check authorization
      if (user.role === "ARTISAN" && milestone.assignedToId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this milestone",
        });
      }

      // Build update data
      const updateData: any = {
        status: input.status,
      };

      if (input.progressPercentage !== undefined) {
        updateData.progressPercentage = input.progressPercentage;
      }

      if (input.actualStartDate !== undefined) {
        updateData.actualStartDate = input.actualStartDate ? new Date(input.actualStartDate) : null;
      }

      if (input.actualEndDate !== undefined) {
        updateData.actualEndDate = input.actualEndDate ? new Date(input.actualEndDate) : null;
      }

      if (input.notes !== undefined) {
        updateData.notes = input.notes;
      }

      // Auto-set dates based on status
      if (input.status === "IN_PROGRESS" && !milestone.actualStartDate && !input.actualStartDate) {
        updateData.actualStartDate = new Date();
      }

      if (input.status === "COMPLETED" && !milestone.actualEndDate && !input.actualEndDate) {
        updateData.actualEndDate = new Date();
        updateData.progressPercentage = 100;
      }

      // Update milestone
      const updatedMilestone = await db.milestone.update({
        where: { id: input.milestoneId },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
      });

      // Create expense slips if provided
      if (input.expenseSlips && input.expenseSlips.length > 0) {
        await db.milestoneExpenseSlip.createMany({
          data: input.expenseSlips.map((slip) => ({
            milestoneId: input.milestoneId,
            url: slip.url,
            category: slip.category,
            description: slip.description || null,
            amount: slip.amount || null,
          })),
        });
      }

      // Create a WeeklyBudgetUpdate if comprehensive reporting fields are provided
      if (input.workDone || input.challenges || input.successes || 
          (input.imagesDone && input.imagesDone.length > 0) || 
          (input.itemizedExpenses && input.itemizedExpenses.length > 0) || 
          input.nextWeekPlan) {
        
        // Calculate expenditures from itemized expenses if provided
        let labourExpenditure = 0;
        let materialExpenditure = 0;
        let otherExpenditure = 0;
        
        if (input.itemizedExpenses && input.itemizedExpenses.length > 0) {
          // For now, categorize all as material expenditure
          // In a more sophisticated system, we could categorize based on item description
          materialExpenditure = input.itemizedExpenses.reduce(
            (sum, item) => sum + item.actualSpent, 
            0
          );
        }
        
        const totalExpenditure = labourExpenditure + materialExpenditure + otherExpenditure;
        
        // Determine week dates
        const now = new Date();
        const weekStartDate = input.weekStartDate ? new Date(input.weekStartDate) : now;
        const weekEndDate = input.weekEndDate ? new Date(input.weekEndDate) : now;
        
        await db.weeklyBudgetUpdate.create({
          data: {
            milestoneId: input.milestoneId,
            weekStartDate,
            weekEndDate,
            labourExpenditure,
            materialExpenditure,
            otherExpenditure,
            totalExpenditure,
            progressPercentage: input.progressPercentage || milestone.progressPercentage,
            notes: input.notes || null,
            createdById: parsed.userId,
            workDone: input.workDone || null,
            challenges: input.challenges || null,
            successes: input.successes || null,
            imagesDone: input.imagesDone || [],
            itemizedExpenses: input.itemizedExpenses || null,
            nextWeekPlan: input.nextWeekPlan || null,
          },
        });
        
        // Update milestone's actual cost based on all weekly updates
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
          },
        });
      }

      // If milestone is completed, send completion report email to customer
      if (input.status === "COMPLETED") {
        try {
          console.log(`[updateMilestoneStatus] Milestone ${input.milestoneId} marked as COMPLETED, preparing to send email...`);
          
          // Generate the Milestone Report PDF
          const { pdfBuffer } = await generateMilestoneReportPdf(input.milestoneId);
          
          console.log(`[updateMilestoneStatus] Milestone PDF generated successfully, size: ${pdfBuffer.length} bytes`);

          // Send the completion email to the project customer
          await sendCompletionReportEmail({
            customerEmail: milestone.project.customerEmail,
            customerName: milestone.project.customerName,
            completionType: "MILESTONE",
            completionTitle: `${milestone.project.name} - ${updatedMilestone.name}`,
            completionDate: new Date(),
            pdfBuffer,
            pdfFilename: `Milestone_${updatedMilestone.name.replace(/[^a-zA-Z0-9]/g, '_')}_Completion_Report.pdf`,
            additionalDetails: `Project: ${milestone.project.name}`,
          });

          console.log(`[updateMilestoneStatus] Completion report email sent successfully to ${milestone.project.customerEmail}`);
        } catch (emailError) {
          // Log the error but don't fail the milestone update
          console.error("[updateMilestoneStatus] Failed to send completion report email:", emailError);
          // We don't throw here because the milestone update was successful
          // The email failure shouldn't rollback the milestone completion
        }
      }

      return updatedMilestone;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
