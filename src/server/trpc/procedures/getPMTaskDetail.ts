import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const getPMTaskDetailSchema = z.object({
  token: z.string(),
  taskId: z.number(),
});

export const getPMTaskDetail = baseProcedure
  .input(getPMTaskDetailSchema)
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view task details.",
      });
    }

    try {
      const task = await db.pMTask.findFirst({
        where: {
          id: input.taskId,
          propertyManagerId: user.id,
        },
        include: {
          assignedTo: {
            include: {
              building: true,
            },
          },
          propertyManager: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          comments: {
            orderBy: { createdAt: "desc" },
            include: {
              authorPM: { select: { id: true, firstName: true, lastName: true } },
              authorStaff: { select: { id: true, firstName: true, lastName: true, staffRole: true } },
            },
          },
          updates: {
            orderBy: { createdAt: "desc" },
            include: {
              updatedByPM: { select: { id: true, firstName: true, lastName: true } },
              updatedByStaff: { select: { id: true, firstName: true, lastName: true, staffRole: true } },
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
          message: "Task not found.",
        });
      }

      return task;
    } catch (error) {
      console.error("Error fetching task detail:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch task detail.",
      });
    }
  });
