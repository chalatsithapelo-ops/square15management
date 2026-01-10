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
  ALL_PERMISSIONS,
  type Permission,
} from "~/server/utils/permissions";

export const updateCustomRole = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string(), // The role to update
      label: z.string().min(1).optional(),
      color: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      defaultRoute: z.string().min(1).optional(),
      permissions: z.array(z.string()).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Cannot update built-in roles
    if (isBuiltInRole(input.name)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot update a built-in role. Use the permission configuration to modify built-in role permissions.",
      });
    }

    // Get existing custom roles
    const existingCustomRoles = await getCustomRoles();
    const roleIndex = existingCustomRoles.findIndex(r => r.name === input.name);

    if (roleIndex === -1) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Custom role not found",
      });
    }

    // Validate permissions if provided
    let validPermissions: string[] | undefined;
    if (input.permissions) {
      validPermissions = input.permissions.filter(p => 
        ALL_PERMISSIONS.includes(p as Permission)
      );
    }

    // Update the role
    const updatedRole = {
      ...existingCustomRoles[roleIndex],
      ...(input.label && { label: input.label }),
      ...(input.color && { color: input.color }),
      ...(input.description && { description: input.description }),
      ...(input.defaultRoute && { defaultRoute: input.defaultRoute }),
      ...(validPermissions && { permissions: validPermissions }),
    };

    existingCustomRoles[roleIndex] = updatedRole;

    // Save to database
    await db.systemSettings.update({
      where: { key: "custom_roles_config" },
      data: {
        value: JSON.stringify(existingCustomRoles),
      },
    });

    // Clear caches
    clearCustomRolesCache();
    clearPermissionsCache();

    return {
      success: true,
      role: updatedRole,
    };
  });
