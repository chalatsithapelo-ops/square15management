import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const getStaffMembersSchema = z.object({
  token: z.string(),
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
  buildingId: z.number().optional(),
  isActive: z.boolean().optional(),
});

export const getStaffMembers = baseProcedure
  .input(getStaffMembersSchema)
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view staff members.",
      });
    }

    try {
      const where: any = {
        propertyManagerId: user.id,
      };

      if (input.staffRole) {
        where.staffRole = input.staffRole;
      }

      if (input.buildingId) {
        where.buildingId = input.buildingId;
      }

      if (input.isActive !== undefined) {
        where.isActive = input.isActive;
      }

      const staffMembers = await db.staffMember.findMany({
        where,
        include: {
          building: true,
          _count: {
            select: {
              tasksAssigned: true,
            },
          },
        },
        orderBy: [
          { staffRole: "asc" },
          { firstName: "asc" },
        ],
      });

      return staffMembers;
    } catch (error) {
      console.error("Error fetching staff members:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch staff members.",
      });
    }
  });
