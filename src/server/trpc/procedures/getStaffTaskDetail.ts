import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

/**
 * Get a single task's full detail for the staff self-service portal.
 * Only returns tasks assigned to the logged-in staff member.
 */
export const getStaffTaskDetail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      taskId: z.number(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

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
      include: {
        propertyManager: {
          select: { id: true, firstName: true, lastName: true, email: true, phone: true },
        },
        assignedTo: true,
        comments: {
          orderBy: { createdAt: "desc" },
          include: {
            authorPM: { select: { firstName: true, lastName: true } },
            authorStaff: { select: { firstName: true, lastName: true } },
          },
        },
        updates: {
          orderBy: { createdAt: "desc" },
          include: {
            updatedByPM: { select: { firstName: true, lastName: true } },
            updatedByStaff: { select: { firstName: true, lastName: true } },
          },
        },
        materials: {
          orderBy: { createdAt: "desc" },
        },
        expenseSlips: {
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!task) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Task not found or you do not have access.",
      });
    }

    return task;
  });
