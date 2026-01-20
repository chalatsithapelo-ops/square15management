import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import bcryptjs from "bcryptjs";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { isValidRole } from "~/server/utils/permissions";
import { assertNotRestrictedDemoAccountAccessDenied } from "~/server/utils/demoAccounts";

export const createEmployee = baseProcedure
  .input(
    z.object({
      token: z.string(),
      email: z.string().email(),
      password: z.string().min(6),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      phone: z.string().optional(),
      role: z.string(),
      hourlyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      dailyRate: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      monthlySalary: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().optional()),
      monthlyPaymentDay: z.preprocess((val) => (typeof val === "number" && isNaN(val) ? undefined : val), z.number().min(1).max(31).optional()),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate and verify admin privileges or contractor role
    const user = await authenticateUser(input.token);

    // Demo admin accounts must not be able to create users
    assertNotRestrictedDemoAccountAccessDenied(user);
    
    // Allow SENIOR_ADMIN, JUNIOR_ADMIN, and CONTRACTOR to create employees
    if (user.role !== "CONTRACTOR") {
      requireAdmin(user);
    }

    // Validate that the role exists
    const roleIsValid = await isValidRole(input.role);
    if (!roleIsValid) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid role specified",
      });
    }

    // Check if user with this email already exists
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "User with this email already exists",
      });
    }

    // Hash the password
    const hashedPassword = await bcryptjs.hash(input.password, 10);

    // Create the new employee
    const newEmployee = await db.user.create({
      data: {
        employerId: user.role === "CONTRACTOR" ? user.id : null,
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone || null,
        role: input.role,
        hourlyRate: input.hourlyRate || null,
        dailyRate: input.dailyRate || null,
        monthlySalary: input.monthlySalary || null,
        monthlyPaymentDay: input.monthlyPaymentDay || null,
      },
    });

    return {
      success: true,
      employee: {
        id: newEmployee.id,
        email: newEmployee.email,
        firstName: newEmployee.firstName,
        lastName: newEmployee.lastName,
        role: newEmployee.role,
        phone: newEmployee.phone,
        hourlyRate: newEmployee.hourlyRate,
        dailyRate: newEmployee.dailyRate,
        monthlySalary: newEmployee.monthlySalary,
        monthlyPaymentDay: newEmployee.monthlyPaymentDay,
      },
    };
  });
