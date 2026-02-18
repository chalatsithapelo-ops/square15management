import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";

/**
 * Staff updates the checklist for their assigned task.
 */
export const updateStaffTaskChecklist = baseProcedure
  .input(
    z.object({
      token: z.string(),
      taskId: z.number(),
      checklist: z.array(
        z.object({
          item: z.string(),
          completed: z.boolean(),
        })
      ),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const staffMember = await db.staffMember.findFirst({
      where: { userId: user.id },
    });

    if (!staffMember) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Staff profile not found." });
    }

    const task = await db.pMTask.findFirst({
      where: { id: input.taskId, assignedToId: staffMember.id },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Task not found or you do not have access.",
      });
    }

    const updatedTask = await db.pMTask.update({
      where: { id: input.taskId },
      data: {
        checklist: JSON.stringify(input.checklist),
        updatedAt: new Date(),
      },
    });

    // Notify property manager of checklist update
    const completedCount = input.checklist.filter(c => c.completed).length;
    const totalCount = input.checklist.length;
    await createNotification({
      recipientId: task.propertyManagerId,
      recipientRole: "PROPERTY_MANAGER",
      message: `${staffMember.firstName} ${staffMember.lastName} updated checklist on task "${task.title}" (${completedCount}/${totalCount} done).`,
      type: "TASK_STATUS_UPDATED" as any,
      relatedEntityId: task.id,
      relatedEntityType: "PM_TASK",
    });

    return updatedTask;
  });
