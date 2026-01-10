import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import {
  getCustomRoles,
  clearCustomRolesCache,
  clearPermissionsCache,
  isBuiltInRole,
} from "~/server/utils/permissions";

export const deleteCustomRole = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Cannot delete built-in roles
    if (isBuiltInRole(input.name)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot delete a built-in role",
      });
    }

    // Get existing custom roles
    const existingCustomRoles = await getCustomRoles();
    const roleExists = existingCustomRoles.some(r => r.name === input.name);

    if (!roleExists) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Custom role not found",
      });
    }

    // Check if any users have this role
    const usersWithRole = await db.user.count({
      where: { role: input.name },
    });

    if (usersWithRole > 0) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: `Cannot delete role: ${usersWithRole} user(s) currently have this role assigned. Please reassign these users to a different role before deleting.`,
      });
    }

    // Remove the role from custom roles
    const updatedCustomRoles = existingCustomRoles.filter(r => r.name !== input.name);

    // Save to database
    if (updatedCustomRoles.length > 0) {
      await db.systemSettings.update({
        where: { key: "custom_roles_config" },
        data: {
          value: JSON.stringify(updatedCustomRoles),
        },
      });
    } else {
      // If no custom roles remain, delete the setting
      await db.systemSettings.delete({
        where: { key: "custom_roles_config" },
      });
    }

    // Clear caches
    clearCustomRolesCache();
    clearPermissionsCache();

    return {
      success: true,
    };
  });
