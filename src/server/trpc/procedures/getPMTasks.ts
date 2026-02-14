import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const getPMTasksSchema = z.object({
  token: z.string(),
  status: z.enum([
    "DRAFT", "ASSIGNED", "ACCEPTED", "IN_PROGRESS", "ON_HOLD",
    "PENDING_REVIEW", "COMPLETED", "CANCELLED",
  ]).optional(),
  category: z.enum([
    "MAINTENANCE", "CLEANING", "GARDENING", "SECURITY", "INSPECTION",
    "REPAIR", "PAINTING", "PLUMBING", "ELECTRICAL", "GENERAL",
    "INVESTIGATION", "REPORT", "ADMINISTRATIVE", "OTHER",
  ]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.number().optional(),
  staffRole: z.enum([
    "ARTISAN", "BUILDING_MANAGER", "SECURITY", "CLEANER",
    "GARDENER", "MAINTENANCE_TECH", "SUPERVISOR", "OTHER",
  ]).optional(),
});

export const getPMTasks = baseProcedure
  .input(getPMTasksSchema)
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view tasks.",
      });
    }

    try {
      const where: any = {
        propertyManagerId: user.id,
      };

      if (input.status) where.status = input.status;
      if (input.category) where.category = input.category;
      if (input.priority) where.priority = input.priority;
      if (input.assignedToId) where.assignedToId = input.assignedToId;
      if (input.staffRole) {
        where.assignedTo = { staffRole: input.staffRole };
      }

      const tasks = await db.pMTask.findMany({
        where,
        include: {
          assignedTo: {
            include: {
              building: true,
            },
          },
          comments: {
            orderBy: { createdAt: "desc" },
            take: 3,
            include: {
              authorPM: { select: { id: true, firstName: true, lastName: true } },
              authorStaff: { select: { id: true, firstName: true, lastName: true, staffRole: true } },
            },
          },
          updates: {
            orderBy: { createdAt: "desc" },
            take: 5,
          },
          _count: {
            select: {
              comments: true,
              updates: true,
              materials: true,
              expenseSlips: true,
            },
          },
        },
        orderBy: [
          { priority: "desc" },
          { dueDate: "asc" },
          { createdAt: "desc" },
        ],
      });

      return tasks;
    } catch (error) {
      console.error("Error fetching tasks:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch tasks.",
      });
    }
  });
