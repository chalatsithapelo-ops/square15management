import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";

export const updateEmployeeDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      email: z.string().email().optional(),
      password: z.string().min(6).optional(),
      phone: z.string().optional(),
      role: z.string().optional(),
      hourlyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      dailyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      monthlySalary: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      monthlyPaymentDay: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().min(1).max(31).optional()),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Basic permission check - must be able to manage employees
    requirePermission(user, PERMISSIONS.MANAGE_ALL_EMPLOYEES);
    
    // Additional permission checks for sensitive fields
    if (input.role !== undefined) {
      requirePermission(
        user,
        PERMISSIONS.MANAGE_EMPLOYEE_ROLES,
        "Only senior administrators can change employee roles"
      );
      
      // Validate that the role exists
      const { isValidRole } = await import("~/server/utils/permissions");
      const roleIsValid = await isValidRole(input.role);
      if (!roleIsValid) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid role specified",
        });
      }
    }
    
    if (input.hourlyRate !== undefined || input.dailyRate !== undefined || input.monthlySalary !== undefined || input.monthlyPaymentDay !== undefined) {
      requirePermission(
        user,
        PERMISSIONS.MANAGE_EMPLOYEE_COMPENSATION,
        "Only senior administrators can change employee compensation"
      );
    }

    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    // Check if email is being updated and if it's already taken by another user
    if (input.email && input.email !== employee.email) {
      const existingUser = await db.user.findUnique({
        where: { email: input.email },
      });

      if (existingUser && existingUser.id !== input.employeeId) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "User with this email already exists",
        });
      }
    }

    // Hash password if provided
    let hashedPassword: string | undefined;
    if (input.password) {
      hashedPassword = await bcryptjs.hash(input.password, 10);
    }

    const updatedEmployee = await db.user.update({
      where: { id: input.employeeId },
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        password: hashedPassword,
        phone: input.phone,
        role: input.role,
        hourlyRate: input.hourlyRate,
        dailyRate: input.dailyRate,
        monthlySalary: input.monthlySalary,
        monthlyPaymentDay: input.monthlyPaymentDay,
      },
    });

    return updatedEmployee;
  });
