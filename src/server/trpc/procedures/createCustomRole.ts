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

export const createCustomRole = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().regex(/^[A-Z_]+$/, "Role name must be uppercase with underscores"),
      label: z.string().min(1),
      color: z.string().min(1),
      description: z.string().min(1),
      defaultRoute: z.string().min(1),
      permissions: z.array(z.string()).default([]),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Validate that the role name is not a built-in role
    if (isBuiltInRole(input.name)) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Cannot create a custom role with a built-in role name",
      });
    }

    // Validate that the role doesn't already exist as a custom role
    const existingCustomRoles = await getCustomRoles();
    if (existingCustomRoles.some(r => r.name === input.name)) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A custom role with this name already exists",
      });
    }

    // Validate permissions
    const validPermissions = input.permissions.filter(p => 
      ALL_PERMISSIONS.includes(p as Permission)
    );

    // Create the new custom role
    const newRole = {
      name: input.name,
      label: input.label,
      color: input.color,
      description: input.description,
      defaultRoute: input.defaultRoute,
      permissions: validPermissions,
    };

    // Add to existing custom roles
    const updatedCustomRoles = [...existingCustomRoles, newRole];

    // Save to database
    await db.systemSettings.upsert({
      where: { key: "custom_roles_config" },
      create: {
        key: "custom_roles_config",
        value: JSON.stringify(updatedCustomRoles),
      },
      update: {
        value: JSON.stringify(updatedCustomRoles),
      },
    });

    // Clear caches
    clearCustomRolesCache();
    clearPermissionsCache();

    return {
      success: true,
      role: newRole,
    };
  });
