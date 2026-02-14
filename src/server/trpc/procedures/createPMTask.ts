import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createPMTaskSchema = z.object({
  token: z.string(),
  title: z.string().min(1, "Title is required"),
  description: z.string().min(1, "Description is required"),
  category: z.enum([
    "MAINTENANCE", "CLEANING", "GARDENING", "SECURITY", "INSPECTION",
    "REPAIR", "PAINTING", "PLUMBING", "ELECTRICAL", "GENERAL",
    "INVESTIGATION", "REPORT", "ADMINISTRATIVE", "OTHER",
  ]),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
  assignedToId: z.number(),
  buildingName: z.string().optional(),
  buildingAddress: z.string().optional(),
  unitNumber: z.string().optional(),
  specificLocation: z.string().optional(),
  dueDate: z.string().optional(), // ISO date string
  estimatedHours: z.number().optional(),
  notes: z.string().optional(),
  checklist: z.array(z.object({
    item: z.string(),
    completed: z.boolean().default(false),
  })).optional(),
  isRecurring: z.boolean().default(false),
  recurrencePattern: z.string().optional(),
});

export const createPMTask = baseProcedure
  .input(createPMTaskSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can create tasks.",
      });
    }

    try {
      // Verify staff member belongs to this PM
      const staffMember = await db.staffMember.findFirst({
        where: { id: input.assignedToId, propertyManagerId: user.id },
      });

      if (!staffMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Staff member not found or does not belong to you.",
        });
      }

      // Generate unique task number
      const lastTask = await db.pMTask.findFirst({
        where: { propertyManagerId: user.id },
        orderBy: { id: "desc" },
      });

      const taskCount = lastTask ? lastTask.id + 1 : 1;
      const taskNumber = `TSK-${String(taskCount).padStart(5, "0")}`;

      const task = await db.pMTask.create({
        data: {
          taskNumber,
          propertyManagerId: user.id,
          assignedToId: input.assignedToId,
          title: input.title,
          description: input.description,
          category: input.category,
          priority: input.priority,
          status: "ASSIGNED",
          buildingName: input.buildingName || null,
          buildingAddress: input.buildingAddress || null,
          unitNumber: input.unitNumber || null,
          specificLocation: input.specificLocation || null,
          dueDate: input.dueDate ? new Date(input.dueDate) : null,
          estimatedHours: input.estimatedHours || null,
          notes: input.notes || null,
          checklist: input.checklist ? JSON.stringify(input.checklist) : null,
          isRecurring: input.isRecurring,
          recurrencePattern: input.recurrencePattern || null,
        },
        include: {
          assignedTo: true,
          propertyManager: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
      });

      // Create initial task update
      await db.pMTaskUpdate.create({
        data: {
          taskId: task.id,
          updatedByType: "PM",
          updatedByPMId: user.id,
          status: "ASSIGNED",
          message: `Task "${input.title}" created and assigned to ${staffMember.firstName} ${staffMember.lastName}.`,
        },
      });

      return task;
    } catch (error) {
      console.error("Error creating task:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create task.",
      });
    }
  });
