import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createStaffMemberSchema = z.object({
  token: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
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
  ]),
  title: z.string().optional(),
  buildingId: z.number().optional(),
});

export const createStaffMember = baseProcedure
  .input(createStaffMemberSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can create staff members.",
      });
    }

    try {
      // Check for duplicate email if provided
      if (input.email && input.email !== "") {
        const existing = await db.staffMember.findFirst({
          where: {
            email: input.email,
            propertyManagerId: user.id,
          },
        });
        if (existing) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "A staff member with this email already exists.",
          });
        }
      }

      // Verify building belongs to PM if provided
      if (input.buildingId) {
        const building = await db.building.findFirst({
          where: { id: input.buildingId, propertyManagerId: user.id },
        });
        if (!building) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Building not found or does not belong to you.",
          });
        }
      }

      const staffMember = await db.staffMember.create({
        data: {
          firstName: input.firstName,
          lastName: input.lastName,
          email: input.email || null,
          phone: input.phone || null,
          staffRole: input.staffRole,
          title: input.title || null,
          propertyManagerId: user.id,
          buildingId: input.buildingId || null,
        },
        include: {
          building: true,
        },
      });

      return staffMember;
    } catch (error) {
      console.error("Error creating staff member:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create staff member.",
      });
    }
  });
