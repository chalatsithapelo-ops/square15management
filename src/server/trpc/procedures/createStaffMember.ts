import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";

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
  // Optional: if provided, creates a User account so staff can log in
  password: z.string().min(6, "Password must be at least 6 characters").optional(),
  enablePortal: z.boolean().optional(),
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
      const wantsPortal = input.enablePortal && input.password && input.email;

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

        // If creating a portal account, also check the User table
        if (wantsPortal) {
          const existingUser = await db.user.findFirst({
            where: { email: { equals: input.email, mode: "insensitive" } },
          });
          if (existingUser) {
            throw new TRPCError({
              code: "CONFLICT",
              message: "A user account with this email already exists. Use a different email.",
            });
          }
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

      // If portal access requested, create both User and StaffMember in a transaction
      if (wantsPortal) {
        const hashedPassword = await bcryptjs.hash(input.password!, 10);

        const result = await db.$transaction(async (tx) => {
          // Create the User account
          const newUser = await tx.user.create({
            data: {
              email: input.email!.toLowerCase().trim(),
              password: hashedPassword,
              firstName: input.firstName,
              lastName: input.lastName,
              phone: input.phone || "",
              role: "STAFF",
            },
          });

          // Create the StaffMember linked to the User
          const staffMember = await tx.staffMember.create({
            data: {
              firstName: input.firstName,
              lastName: input.lastName,
              email: input.email!.toLowerCase().trim(),
              phone: input.phone || null,
              staffRole: input.staffRole,
              title: input.title || null,
              propertyManagerId: user.id,
              buildingId: input.buildingId || null,
              userId: newUser.id,
            },
            include: {
              building: true,
              user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
            },
          });

          return staffMember;
        });

        return result;
      }

      // Otherwise, just create the StaffMember record (no login account)
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
