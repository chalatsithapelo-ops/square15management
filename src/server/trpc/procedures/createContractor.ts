import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";
import { assertNotRestrictedDemoAccountAccessDenied } from "~/server/utils/demoAccounts";

const createContractorSchema = z.object({
  token: z.string(),
  propertyManagerId: z.number().int().positive().optional(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  companyName: z.string().optional(),
  registrationNumber: z.string().optional(),
  serviceType: z.string().min(1, "Service type is required"),
  serviceCategory: z.string().optional(),
  specializations: z.array(z.string()).default([]),
  hourlyRate: z.number().optional(),
  dailyRate: z.number().optional(),
  projectRate: z.number().optional(),
  bankName: z.string().optional(),
  bankAccountHolder: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankCode: z.string().optional(),
  portalAccessEnabled: z.boolean().default(false),
  notes: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().optional(),
});

export const createContractor = baseProcedure
  .input(createContractorSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Demo admin accounts must not be able to create users
    assertNotRestrictedDemoAccountAccessDenied(user);

    const isPropertyManager = user.role === "PROPERTY_MANAGER";
    const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";

    if (!isPropertyManager && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins or Property Managers can create contractors",
      });
    }

    const targetPropertyManagerId = isPropertyManager
      ? user.id
      : input.propertyManagerId;

    if (isPropertyManager && !targetPropertyManagerId) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Property Manager assignment is required",
      });
    }

    // Check if contractor already exists with this email
    const existingContractor = await db.contractor.findFirst({
      where: { email: input.email },
    });

    if (existingContractor) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A contractor with this email already exists",
      });
    }

    // Check if user already exists with this email
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A user with this email already exists",
      });
    }

    try {
      // Hash the password
      const hashedPassword = await bcryptjs.hash(input.password, 10);

      // Create user account with CONTRACTOR_SENIOR_MANAGER role
      // This gives the main contractor full management authority within their organization
      const contractorUser = await db.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone || "",
          role: "CONTRACTOR_SENIOR_MANAGER",
        },
      });

      // Create contractor record
      const contractor = await db.contractor.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email,
          phone: input.phone,
          companyName: input.companyName,
          registrationNumber: input.registrationNumber,
          serviceType: input.serviceType,
          serviceCategory: input.serviceCategory,
          specializations: input.specializations,
          hourlyRate: input.hourlyRate,
          dailyRate: input.dailyRate,
          projectRate: input.projectRate,
          bankName: input.bankName,
          bankAccountHolder: input.bankAccountHolder,
          bankAccountNumber: input.bankAccountNumber,
          bankCode: input.bankCode,
          portalAccessEnabled: true, // Enable portal access by default
          dateJoined: new Date(),
          propertyManagerId: targetPropertyManagerId ?? undefined,
          notes: input.notes,
        },
      });

      return {
        success: true,
        contractor: {
          id: contractor.id,
          firstName: contractor.firstName,
          lastName: contractor.lastName,
          email: contractor.email,
          companyName: contractor.companyName,
          serviceType: contractor.serviceType,
          status: contractor.status,
        },
        user: {
          id: contractorUser.id,
          email: contractorUser.email,
          role: contractorUser.role,
        },
        message: "Contractor created successfully with Senior Admin access",
      };
    } catch (error) {
      console.error("Error creating contractor:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create contractor",
      });
    }
  });

