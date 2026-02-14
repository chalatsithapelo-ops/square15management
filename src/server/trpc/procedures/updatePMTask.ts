import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const updatePMTaskSchema = z.object({
  token: z.string(),
  taskId: z.number(),
  title: z.string().min(1).optional(),
  description: z.string().min(1).optional(),
  category: z.enum([
    "MAINTENANCE", "CLEANING", "GARDENING", "SECURITY", "INSPECTION",
    "REPAIR", "PAINTING", "PLUMBING", "ELECTRICAL", "GENERAL",
    "INVESTIGATION", "REPORT", "ADMINISTRATIVE", "OTHER",
  ]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.number().optional(),
  buildingName: z.string().optional(),
  buildingAddress: z.string().optional(),
  unitNumber: z.string().optional(),
  specificLocation: z.string().optional(),
  dueDate: z.string().nullable().optional(),
  estimatedHours: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  checklist: z.array(z.object({
    item: z.string(),
    completed: z.boolean(),
  })).optional(),
});

export const updatePMTask = baseProcedure
  .input(updatePMTaskSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can update tasks.",
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

      // Verify new assignee if changing
      if (input.assignedToId) {
        const staffMember = await db.staffMember.findFirst({
          where: { id: input.assignedToId, propertyManagerId: user.id },
        });
        if (!staffMember) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Staff member not found.",
          });
        }
      }

      const updateData: any = { updatedAt: new Date() };
      if (input.title !== undefined) updateData.title = input.title;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.category !== undefined) updateData.category = input.category;
      if (input.priority !== undefined) updateData.priority = input.priority;
      if (input.assignedToId !== undefined) updateData.assignedToId = input.assignedToId;
      if (input.buildingName !== undefined) updateData.buildingName = input.buildingName || null;
      if (input.buildingAddress !== undefined) updateData.buildingAddress = input.buildingAddress || null;
      if (input.unitNumber !== undefined) updateData.unitNumber = input.unitNumber || null;
      if (input.specificLocation !== undefined) updateData.specificLocation = input.specificLocation || null;
      if (input.dueDate !== undefined) updateData.dueDate = input.dueDate ? new Date(input.dueDate) : null;
      if (input.estimatedHours !== undefined) updateData.estimatedHours = input.estimatedHours;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.checklist !== undefined) updateData.checklist = JSON.stringify(input.checklist);

      const updated = await db.pMTask.update({
        where: { id: input.taskId },
        data: updateData,
        include: {
          assignedTo: true,
        },
      });

      return updated;
    } catch (error) {
      console.error("Error updating task:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update task.",
      });
    }
  });
