import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";

/**
 * Allow staff to update their own task status, upload photos, add findings, etc.
 * This is the staff-facing version of updatePMTaskStatus — enforces staff ownership.
 */
export const updateStaffTaskStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      taskId: z.number(),
      status: z.enum([
        "ACCEPTED", "IN_PROGRESS", "ON_HOLD", "PENDING_REVIEW", "COMPLETED",
      ]),
      progressPercentage: z.number().min(0).max(100).optional(),
      message: z.string().optional(),
      beforePictures: z.array(z.string()).optional(),
      afterPictures: z.array(z.string()).optional(),
      findings: z.string().optional(),
      recommendations: z.string().optional(),
      actualHours: z.number().optional(),
      materialCost: z.number().optional(),
      labourCost: z.number().optional(),
      pauseReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Get the staff member profile linked to this user
    const staffMember = await db.staffMember.findFirst({
      where: { userId: user.id },
    });

    if (!staffMember) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Staff profile not found." });
    }

    const task = await db.pMTask.findFirst({
      where: {
        id: input.taskId,
        assignedToId: staffMember.id,
      },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Task not found or you do not have access.",
      });
    }

    // Validate status transitions for staff
    const validTransitions: Record<string, string[]> = {
      ASSIGNED: ["ACCEPTED"],
      ACCEPTED: ["IN_PROGRESS"],
      IN_PROGRESS: ["ON_HOLD", "PENDING_REVIEW", "COMPLETED"],
      ON_HOLD: ["IN_PROGRESS"],
      PENDING_REVIEW: [], // Staff can't transition from PENDING_REVIEW
    };

    const allowed = validTransitions[task.status] || [];
    if (!allowed.includes(input.status)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot transition from ${task.status} to ${input.status}.`,
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
    } else if (input.status === "IN_PROGRESS") {
      // Resuming from ON_HOLD
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
    }

    // Update job execution fields
    if (input.beforePictures && input.beforePictures.length > 0) {
      updateData.beforePictures = { push: input.beforePictures };
    }
    if (input.afterPictures && input.afterPictures.length > 0) {
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
      include: { assignedTo: true },
    });

    // Create task update record
    await db.pMTaskUpdate.create({
      data: {
        taskId: task.id,
        updatedByType: "STAFF",
        updatedByStaffId: staffMember.id,
        status: input.status,
        message: input.message || `Staff updated task status to ${input.status.replace(/_/g, " ")}.`,
        progressPercentage: input.progressPercentage,
        photos: input.afterPictures || input.beforePictures || [],
      },
    });

    // Notify the property manager of the status change
    const statusLabels: Record<string, string> = {
      ACCEPTED: "accepted",
      IN_PROGRESS: "started working on",
      ON_HOLD: "paused",
      PENDING_REVIEW: "submitted for review",
      COMPLETED: "completed",
    };
    const statusLabel = statusLabels[input.status] || input.status.toLowerCase().replace(/_/g, " ");
    await createNotification({
      recipientId: task.propertyManagerId,
      recipientRole: "PROPERTY_MANAGER",
      message: `${staffMember.firstName} ${staffMember.lastName} ${statusLabel} task "${task.title}".`,
      type: "TASK_STATUS_UPDATED" as any,
      relatedEntityId: task.id,
      relatedEntityType: "PM_TASK",
    });

    return updatedTask;
  });
