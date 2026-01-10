import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import {
  clearPermissionsCache,
  ALL_PERMISSIONS,
  ALL_ROLES,
  type Permission,
} from "~/server/utils/permissions";

// Validation schema for the role permissions configuration
const rolePermissionConfigSchema = z.record(
  z.string(),
  z.array(z.string())
);

export const updateRolePermissionConfig = baseProcedure
  .input(
    z.object({
      token: z.string(),
      config: rolePermissionConfigSchema,
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Validate that all roles in the config are valid
    const configRoles = Object.keys(input.config);
    const invalidRoles = configRoles.filter(role => !ALL_ROLES.includes(role as any));
    if (invalidRoles.length > 0) {
      throw new Error(`Invalid roles in configuration: ${invalidRoles.join(", ")}`);
    }

    // Validate that all permissions in the config are valid
    const allPermissionsInConfig = Object.values(input.config).flat();
    const invalidPermissions = allPermissionsInConfig.filter(
      perm => !ALL_PERMISSIONS.includes(perm as Permission)
    );
    if (invalidPermissions.length > 0) {
      throw new Error(`Invalid permissions in configuration: ${invalidPermissions.join(", ")}`);
    }

    // Save to database
    await db.systemSettings.upsert({
      where: { key: "role_permissions_config" },
      create: {
        key: "role_permissions_config",
        value: JSON.stringify(input.config),
      },
      update: {
        value: JSON.stringify(input.config),
      },
    });

    // Clear cache so changes take effect immediately
    clearPermissionsCache();

    return {
      success: true,
      message: "Role permissions updated successfully",
    };
  });
