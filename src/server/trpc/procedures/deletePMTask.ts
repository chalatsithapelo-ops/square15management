import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const deletePMTaskSchema = z.object({
  token: z.string(),
  taskId: z.number(),
});

export const deletePMTask = baseProcedure
  .input(deletePMTaskSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can delete tasks.",
      });
    }

    try {
      const task = await db.pMTask.findFirst({
        where: { id: input.taskId, propertyManagerId: user.id },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found.",
        });
      }

      // Only allow deleting tasks that haven't started
      if (!["DRAFT", "ASSIGNED", "CANCELLED"].includes(task.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete a task that is already in progress. Cancel it first.",
        });
      }

      await db.pMTask.delete({
        where: { id: input.taskId },
      });

      return { success: true };
    } catch (error) {
      console.error("Error deleting task:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete task.",
      });
    }
  });
