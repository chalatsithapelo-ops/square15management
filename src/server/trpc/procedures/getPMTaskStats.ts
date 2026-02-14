import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const getPMTaskStatsSchema = z.object({
  token: z.string(),
});

export const getPMTaskStats = baseProcedure
  .input(getPMTaskStatsSchema)
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view task stats.",
      });
    }

    try {
      const [
        totalTasks,
        assignedTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        onHoldTasks,
        pendingReviewTasks,
        cancelledTasks,
        totalStaff,
        tasksByCategory,
        tasksByPriority,
        tasksByStaffRole,
        recentUpdates,
      ] = await Promise.all([
        db.pMTask.count({ where: { propertyManagerId: user.id } }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "ASSIGNED" } }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "IN_PROGRESS" } }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "COMPLETED" } }),
        db.pMTask.count({
          where: {
            propertyManagerId: user.id,
            status: { notIn: ["COMPLETED", "CANCELLED"] },
            dueDate: { lt: new Date() },
          },
        }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "ON_HOLD" } }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "PENDING_REVIEW" } }),
        db.pMTask.count({ where: { propertyManagerId: user.id, status: "CANCELLED" } }),
        db.staffMember.count({ where: { propertyManagerId: user.id, isActive: true } }),
        db.pMTask.groupBy({
          by: ["category"],
          where: { propertyManagerId: user.id },
          _count: true,
        }),
        db.pMTask.groupBy({
          by: ["priority"],
          where: { propertyManagerId: user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
          _count: true,
        }),
        db.pMTask.groupBy({
          by: ["assignedToId"],
          where: { propertyManagerId: user.id, status: { notIn: ["COMPLETED", "CANCELLED"] } },
          _count: true,
        }),
        db.pMTaskUpdate.findMany({
          where: {
            task: { propertyManagerId: user.id },
          },
          orderBy: { createdAt: "desc" },
          take: 10,
          include: {
            task: { select: { id: true, taskNumber: true, title: true } },
            updatedByPM: { select: { id: true, firstName: true, lastName: true } },
            updatedByStaff: { select: { id: true, firstName: true, lastName: true, staffRole: true } },
          },
        }),
      ]);

      return {
        totalTasks,
        assignedTasks,
        inProgressTasks,
        completedTasks,
        overdueTasks,
        onHoldTasks,
        pendingReviewTasks,
        cancelledTasks,
        totalStaff,
        tasksByCategory,
        tasksByPriority,
        tasksByStaffRole,
        recentUpdates,
        completionRate: totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0,
      };
    } catch (error) {
      console.error("Error fetching task stats:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch task stats.",
      });
    }
  });
