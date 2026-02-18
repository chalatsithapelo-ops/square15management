import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { createNotification } from "~/server/utils/notifications";

/**
 * Staff adds a comment to their own task.
 */
export const addStaffTaskComment = baseProcedure
  .input(
    z.object({
      token: z.string(),
      taskId: z.number(),
      message: z.string().min(1),
      photos: z.array(z.string()).optional(),
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

    // Verify task is assigned to this staff member
    const task = await db.pMTask.findFirst({
      where: { id: input.taskId, assignedToId: staffMember.id },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Task not found or you do not have access.",
      });
    }

    const comment = await db.pMTaskComment.create({
      data: {
        taskId: input.taskId,
        authorType: "STAFF",
        authorStaffId: staffMember.id,
        message: input.message,
        photos: input.photos || [],
      },
      include: {
        authorStaff: { select: { firstName: true, lastName: true } },
      },
    });

    // Notify property manager of the new comment
    await createNotification({
      recipientId: task.propertyManagerId,
      recipientRole: "PROPERTY_MANAGER",
      message: `${staffMember.firstName} ${staffMember.lastName} commented on task "${task.title}".`,
      type: "TASK_COMMENT_ADDED" as any,
      relatedEntityId: task.id,
      relatedEntityType: "PM_TASK",
    });

    return comment;
  });
