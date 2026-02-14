import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

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

    return updatedTask;
  });
