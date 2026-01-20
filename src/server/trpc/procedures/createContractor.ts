import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";
import { assertNotRestrictedDemoAccountAccessDenied } from "~/server/utils/demoAccounts";

const createContractorSchema = z.object({
  token: z.string(),
  // Optional subscription package assignment (use null for None)
  packageId: z.number().int().positive().nullable().optional().default(null),
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
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
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
      // Property Managers create contractors as email-only by default.
      // If a package is selected, it becomes a PENDING request that Admin must approve
      // before portal access + subscription is activated.
      if (isPropertyManager) {
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
            portalAccessEnabled: false,
            dateJoined: new Date(),
            propertyManagerId: targetPropertyManagerId ?? undefined,
            notes: input.notes,
          },
        });

        if (input.packageId != null) {
          const packageDetails = await db.package.findUnique({
            where: { id: input.packageId },
          });

          if (!packageDetails) {
            throw new TRPCError({
              code: "NOT_FOUND",
              message: "Package not found",
            });
          }

          if (packageDetails.type !== "CONTRACTOR") {
            throw new TRPCError({
              code: "BAD_REQUEST",
              message: "Selected package is not a contractor package",
            });
          }

          const existingPendingRequest = await db.contractorPackageRequest.findFirst({
            where: {
              contractorId: contractor.id,
              status: "PENDING",
            },
            select: { id: true },
          });

          if (existingPendingRequest) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A package request for this contractor is already pending admin approval",
            });
          }

          await db.contractorPackageRequest.create({
            data: {
              propertyManagerId: user.id,
              contractorId: contractor.id,
              packageId: packageDetails.id,
              status: "PENDING",
            },
          });
        }

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
          user: null,
          subscriptionId: null,
          message:
            input.packageId != null
              ? "Contractor created. Package request is pending admin approval; contractor will receive email-only notifications until approved."
              : "Contractor created as email-only (no portal access).",
        };
      }

      // Admin-created contractors: create a portal user immediately.
      if (!input.password) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Password is required to create a contractor portal account",
        });
      }

      const hashedPassword = await bcryptjs.hash(input.password, 10);

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
          portalAccessEnabled: true,
          dateJoined: new Date(),
          propertyManagerId: targetPropertyManagerId ?? undefined,
          notes: input.notes,
        },
      });

      let subscription: { id: number } | null = null;
      if (input.packageId != null) {
        const packageDetails = await db.package.findUnique({
          where: { id: input.packageId },
        });

        if (!packageDetails) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Package not found",
          });
        }

        if (packageDetails.type !== "CONTRACTOR") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Selected package is not a contractor package",
          });
        }

        const startDate = new Date();
        const trialEndsAt =
          packageDetails.trialDays > 0
            ? new Date(Date.now() + packageDetails.trialDays * 24 * 60 * 60 * 1000)
            : null;
        const nextBillingDate = trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

        subscription = await db.subscription.create({
          data: {
            userId: contractorUser.id,
            packageId: packageDetails.id,
            status: packageDetails.trialDays > 0 ? "TRIAL" : "ACTIVE",
            startDate,
            trialEndsAt,
            includedUsers: 1,
            additionalUsers: 0,
            maxUsers: 1,
            currentUsers: 1,
            nextBillingDate,
          },
          select: { id: true },
        });
      }

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
        subscriptionId: subscription?.id ?? null,
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

