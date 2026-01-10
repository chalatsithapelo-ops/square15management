import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const deleteEmployee = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Allow CONTRACTOR to delete their employees, or require DELETE_EMPLOYEES permission
    if (user.role !== "CONTRACTOR") {
      // Require DELETE_EMPLOYEES permission (only SENIOR_ADMIN has this)
      requirePermission(
        user,
        PERMISSIONS.DELETE_EMPLOYEES,
        "Only senior administrators can delete employees"
      );
    }
    
    // Prevent users from deleting themselves
    if (user.id === input.employeeId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "You cannot delete your own account",
      });
    }

    // Verify the employee exists
    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    try {
      // Attempt to delete the employee
      await db.user.delete({
        where: { id: input.employeeId },
      });

      return {
        success: true,
        message: `Employee ${employee.firstName} ${employee.lastName} has been deleted successfully`,
      };
    } catch (error: any) {
      // Handle Prisma foreign key constraint errors
      if (error.code === "P2003" || error.code === "P2014") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Cannot delete this employee because they have associated records (orders, leads, projects, etc.). Please reassign or remove these records first.",
        });
      }

      // Handle other database errors
      console.error("Error deleting employee:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to delete employee. Please try again.",
      });
    }
  });
