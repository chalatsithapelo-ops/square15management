import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";

const updateContractorSchema = z.object({
  token: z.string(),
  contractorId: z.number().int().positive(),
  propertyManagerId: z.number().int().positive().nullable().optional(),

  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  phone: z.string().nullable().optional(),
  companyName: z.string().nullable().optional(),
  registrationNumber: z.string().nullable().optional(),

  serviceType: z.string().min(1).optional(),
  serviceCategory: z.string().nullable().optional(),
  specializations: z.array(z.string()).optional(),
  hourlyRate: z.number().nullable().optional(),
  dailyRate: z.number().nullable().optional(),
  projectRate: z.number().nullable().optional(),

  bankName: z.string().nullable().optional(),
  bankAccountHolder: z.string().nullable().optional(),
  bankAccountNumber: z.string().nullable().optional(),
  bankCode: z.string().nullable().optional(),

  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED", "TERMINATED"]).optional(),
  portalAccessEnabled: z.boolean().optional(),
  notes: z.string().nullable().optional(),
  newPassword: z.string().min(6).optional(),
});

export const updateContractor = baseProcedure
  .input(updateContractorSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isPropertyManager = user.role === "PROPERTY_MANAGER";
    const isAdmin = user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN";

    if (!isPropertyManager && !isAdmin) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admins or Property Managers can update contractors",
      });
    }

    try {
      const contractor = await db.contractor.findUnique({
        where: { id: input.contractorId },
        select: { id: true, email: true, propertyManagerId: true },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Contractor not found",
        });
      }

      if (isPropertyManager && contractor.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update contractors assigned to your account",
        });
      }

      // Property managers cannot reassign/unassign contractors.
      if (isPropertyManager && input.propertyManagerId !== undefined) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Property Managers cannot reassign contractors",
        });
      }

      // Update contractor record
      const updated = await db.contractor.update({
        where: { id: input.contractorId },
        data: {
          ...(isAdmin && input.propertyManagerId !== undefined
            ? { propertyManagerId: input.propertyManagerId }
            : {}),

          ...(input.firstName !== undefined ? { firstName: input.firstName } : {}),
          ...(input.lastName !== undefined ? { lastName: input.lastName } : {}),
          ...(input.phone !== undefined ? { phone: input.phone } : {}),
          ...(input.companyName !== undefined ? { companyName: input.companyName } : {}),
          ...(input.registrationNumber !== undefined
            ? { registrationNumber: input.registrationNumber }
            : {}),

          ...(input.serviceType !== undefined ? { serviceType: input.serviceType } : {}),
          ...(input.serviceCategory !== undefined ? { serviceCategory: input.serviceCategory } : {}),
          ...(input.specializations !== undefined ? { specializations: input.specializations } : {}),

          ...(input.hourlyRate !== undefined ? { hourlyRate: input.hourlyRate } : {}),
          ...(input.dailyRate !== undefined ? { dailyRate: input.dailyRate } : {}),
          ...(input.projectRate !== undefined ? { projectRate: input.projectRate } : {}),

          ...(input.bankName !== undefined ? { bankName: input.bankName } : {}),
          ...(input.bankAccountHolder !== undefined
            ? { bankAccountHolder: input.bankAccountHolder }
            : {}),
          ...(input.bankAccountNumber !== undefined
            ? { bankAccountNumber: input.bankAccountNumber }
            : {}),
          ...(input.bankCode !== undefined ? { bankCode: input.bankCode } : {}),

          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.portalAccessEnabled !== undefined
            ? { portalAccessEnabled: input.portalAccessEnabled }
            : {}),
          ...(input.notes !== undefined ? { notes: input.notes } : {}),
        },
      });

      // Update user password if newPassword is provided
      if (input.newPassword) {
        const hashedPassword = await bcryptjs.hash(input.newPassword, 10);
        await db.user.updateMany({
          where: {
            email: contractor.email,
            role: { in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER"] },
          },
          data: { password: hashedPassword },
        });
      }

      return {
        success: true,
        contractor: {
          id: updated.id,
          firstName: updated.firstName,
          lastName: updated.lastName,
          email: updated.email,
          serviceType: updated.serviceType,
          status: updated.status,
        },
        message: "Contractor updated successfully",
      };
    } catch (error) {
      console.error("Error updating contractor:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update contractor",
      });
    }
  });
