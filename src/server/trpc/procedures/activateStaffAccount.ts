import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import bcryptjs from "bcryptjs";

/**
 * PM activates a staff member's self-service portal account.
 * Creates a User record with role "STAFF" and links it to the StaffMember.
 */
export const activateStaffAccount = baseProcedure
  .input(
    z.object({
      token: z.string(),
      staffMemberId: z.number(),
      email: z.string().email(),
      password: z.string().min(6, "Password must be at least 6 characters"),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Verify the staff member belongs to this PM
    const staffMember = await db.staffMember.findUnique({
      where: { id: input.staffMemberId },
      include: { user: true },
    });

    if (!staffMember) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Staff member not found." });
    }

    if (staffMember.propertyManagerId !== user.id) {
      throw new TRPCError({ code: "FORBIDDEN", message: "You can only activate accounts for your own staff." });
    }

    if (staffMember.userId) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "This staff member already has an active account." });
    }

    // Check if email is already taken
    const existingUser = await db.user.findFirst({
      where: { email: { equals: input.email, mode: "insensitive" } },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A user with this email already exists. Use a different email.",
      });
    }

    const hashedPassword = await bcryptjs.hash(input.password, 10);

    // Create user account and link to staff member in a transaction
    const result = await db.$transaction(async (tx) => {
      const newUser = await tx.user.create({
        data: {
          email: input.email.toLowerCase().trim(),
          password: hashedPassword,
          firstName: staffMember.firstName,
          lastName: staffMember.lastName,
          phone: staffMember.phone || "",
          role: "STAFF",
        },
      });

      const updatedStaff = await tx.staffMember.update({
        where: { id: staffMember.id },
        data: {
          userId: newUser.id,
          email: input.email.toLowerCase().trim(),
        },
        include: {
          user: { select: { id: true, email: true, firstName: true, lastName: true, role: true } },
        },
      });

      return updatedStaff;
    });

    return result;
  });
