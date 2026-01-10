import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import {
  getCurrentRolePermissions,
  getStaticRolePermissions,
  ALL_PERMISSIONS,
  getAllRolesAsync,
  getAllRoleMetadata,
} from "~/server/utils/permissions";

export const getRolePermissionConfig = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Get current configuration (dynamic or static)
    const currentConfig = await getCurrentRolePermissions();

    // Get static default configuration
    const defaultConfig = getStaticRolePermissions();

    // Check if dynamic config exists
    const dynamicConfigSetting = await db.systemSettings.findUnique({
      where: { key: "role_permissions_config" },
    });

    const isUsingDynamicConfig = !!dynamicConfigSetting?.value;

    // Get all roles (built-in + custom) and their metadata
    const allRoles = await getAllRolesAsync();
    const allRoleMetadata = await getAllRoleMetadata();

    return {
      currentConfig,
      defaultConfig,
      isUsingDynamicConfig,
      lastModified: dynamicConfigSetting?.updatedAt || null,
      allPermissions: ALL_PERMISSIONS,
      allRoles,
      roleMetadata: allRoleMetadata,
    };
  });
