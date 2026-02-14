import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const updateStaffMemberSchema = z.object({
  token: z.string(),
  staffMemberId: z.number(),
  firstName: z.string().min(1).optional(),
  lastName: z.string().min(1).optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  staffRole: z.enum([
    "ARTISAN",
    "BUILDING_MANAGER",
    "SECURITY",
    "CLEANER",
    "GARDENER",
    "MAINTENANCE_TECH",
    "SUPERVISOR",
    "OTHER",
  ]).optional(),
  title: z.string().optional(),
  buildingId: z.number().nullable().optional(),
  isActive: z.boolean().optional(),
});

export const updateStaffMember = baseProcedure
  .input(updateStaffMemberSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can update staff members.",
      });
    }

    try {
      const staffMember = await db.staffMember.findFirst({
        where: { id: input.staffMemberId, propertyManagerId: user.id },
      });

      if (!staffMember) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Staff member not found.",
        });
      }

      const updateData: any = {};
      if (input.firstName !== undefined) updateData.firstName = input.firstName;
      if (input.lastName !== undefined) updateData.lastName = input.lastName;
      if (input.email !== undefined) updateData.email = input.email || null;
      if (input.phone !== undefined) updateData.phone = input.phone || null;
      if (input.staffRole !== undefined) updateData.staffRole = input.staffRole;
      if (input.title !== undefined) updateData.title = input.title || null;
      if (input.buildingId !== undefined) updateData.buildingId = input.buildingId;
      if (input.isActive !== undefined) updateData.isActive = input.isActive;

      const updated = await db.staffMember.update({
        where: { id: input.staffMemberId },
        data: updateData,
        include: {
          building: true,
        },
      });

      return updated;
    } catch (error) {
      console.error("Error updating staff member:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update staff member.",
      });
    }
  });
