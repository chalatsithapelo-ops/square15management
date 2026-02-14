import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

/**
 * Get all tasks assigned to the logged-in staff member.
 * Used in the staff self-service portal.
 */
export const getStaffTasks = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Find the staff member linked to this user
    const staffMember = await db.staffMember.findFirst({
      where: { userId: user.id },
    });

    if (!staffMember) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Staff profile not found.",
      });
    }

    const where: any = { assignedToId: staffMember.id };
    if (input.status) {
      where.status = input.status;
    }

    const tasks = await db.pMTask.findMany({
      where,
      include: {
        propertyManager: {
          select: { id: true, firstName: true, lastName: true, phone: true },
        },
        comments: {
          orderBy: { createdAt: "desc" },
          take: 3,
          include: {
            authorPM: { select: { firstName: true, lastName: true } },
            authorStaff: { select: { firstName: true, lastName: true } },
          },
        },
        updates: {
          orderBy: { createdAt: "desc" },
          take: 3,
        },
        _count: {
          select: { comments: true, updates: true, materials: true },
        },
      },
      orderBy: [
        { priority: "desc" },
        { dueDate: "asc" },
        { createdAt: "desc" },
      ],
    });

    return tasks;
  });
