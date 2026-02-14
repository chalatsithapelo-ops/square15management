import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const addPMTaskCommentSchema = z.object({
  token: z.string(),
  taskId: z.number(),
  message: z.string().min(1, "Comment cannot be empty"),
  photos: z.array(z.string()).optional(),
  documents: z.array(z.string()).optional(),
});

export const addPMTaskComment = baseProcedure
  .input(addPMTaskCommentSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    try {
      const task = await db.pMTask.findUnique({
        where: { id: input.taskId },
        include: { assignedTo: true },
      });

      if (!task) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Task not found.",
        });
      }

      // Verify authorization
      const isPM = user.id === task.propertyManagerId;
      if (!isPM) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to comment on this task.",
        });
      }

      const comment = await db.pMTaskComment.create({
        data: {
          taskId: input.taskId,
          authorType: "PM",
          authorPMId: user.id,
          message: input.message,
          photos: input.photos || [],
          documents: input.documents || [],
        },
        include: {
          authorPM: { select: { id: true, firstName: true, lastName: true } },
          authorStaff: { select: { id: true, firstName: true, lastName: true, staffRole: true } },
        },
      });

      return comment;
    } catch (error) {
      console.error("Error adding task comment:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to add task comment.",
      });
    }
  });
