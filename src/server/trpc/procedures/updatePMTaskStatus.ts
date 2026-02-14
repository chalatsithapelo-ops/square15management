import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const updatePMTaskStatusSchema = z.object({
  token: z.string(),
  taskId: z.number(),
  status: z.enum([
    "DRAFT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD",
    "PENDING_REVIEW", "COMPLETED", "CANCELLED",
  ]),
  progressPercentage: z.number().min(0).max(100).optional(),
  message: z.string().optional(),
  // For staff updates
  beforePictures: z.array(z.string()).optional(),
  afterPictures: z.array(z.string()).optional(),
  findings: z.string().optional(),
  recommendations: z.string().optional(),
  actualHours: z.number().optional(),
  materialCost: z.number().optional(),
  labourCost: z.number().optional(),
  pauseReason: z.string().optional(),
});

export const updatePMTaskStatus = baseProcedure
  .input(updatePMTaskStatusSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      const task = await db.pMTask.findUnique({
        where: { id: input.taskId },
        include: {
          assignedTo: true,
          propertyManager: { select: { id: true, firstName: true, lastName: true } },
        },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found.",
        });
      }

      // Verify the user is either the PM who owns this task or we're allowing staff updates
      const isPM = user.id === task.propertyManagerId;
      // For now, PM can always update status. In the future, staff with accounts can too.

      if (!isPM) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to update this task.",
        });
      }

      // Build update data
      const updateData: any = {
        status: input.status,
        updatedAt: new Date(),
      };

      if (input.progressPercentage !== undefined) {
        updateData.progressPercentage = input.progressPercentage;
      }

      // Set dates based on status transitions
      if (input.status === "ACCEPTED" && !task.acceptedDate) {
        updateData.acceptedDate = new Date();
      } else if (input.status === "IN_PROGRESS" && !task.startDate) {
        updateData.startDate = new Date();
        updateData.startTime = new Date();
        updateData.isPaused = false;
        updateData.pausedAt = null;
        updateData.pauseReason = null;
      } else if (input.status === "ON_HOLD") {
        updateData.isPaused = true;
        updateData.pausedAt = new Date();
        updateData.pauseReason = input.pauseReason || null;
      } else if (input.status === "COMPLETED") {
        updateData.completedDate = new Date();
        updateData.endTime = new Date();
        updateData.progressPercentage = 100;
        updateData.isPaused = false;
      } else if (input.status === "CANCELLED") {
        updateData.isPaused = false;
      }

      // Update job execution fields
      if (input.beforePictures) {
        updateData.beforePictures = { push: input.beforePictures };
      }
      if (input.afterPictures) {
        updateData.afterPictures = { push: input.afterPictures };
      }
      if (input.findings !== undefined) updateData.findings = input.findings;
      if (input.recommendations !== undefined) updateData.recommendations = input.recommendations;
      if (input.actualHours !== undefined) updateData.actualHours = input.actualHours;
      if (input.materialCost !== undefined) updateData.materialCost = input.materialCost;
      if (input.labourCost !== undefined) updateData.labourCost = input.labourCost;

      const updatedTask = await db.pMTask.update({
        where: { id: input.taskId },
        data: updateData,
        include: {
          assignedTo: true,
        },
      });

      // Create task update record
      await db.pMTaskUpdate.create({
        data: {
          taskId: task.id,
          updatedByType: isPM ? "PM" : "STAFF",
          updatedByPMId: isPM ? user.id : null,
          status: input.status,
          message: input.message || `Task status updated to ${input.status.replace(/_/g, " ")}.`,
          progressPercentage: input.progressPercentage,
          photos: input.afterPictures || [],
        },
      });

      return updatedTask;
    } catch (error) {
      console.error("Error updating task status:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update task status.",
      });
    }
  });
