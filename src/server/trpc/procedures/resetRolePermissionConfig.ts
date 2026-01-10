import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { db } from "~/server/db";
import { clearPermissionsCache } from "~/server/utils/permissions";

export const resetRolePermissionConfig = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    // Delete the dynamic configuration
    await db.systemSettings.deleteMany({
      where: { key: "role_permissions_config" },
    });

    // Clear cache so system falls back to static defaults
    clearPermissionsCache();

    return {
      success: true,
      message: "Role permissions reset to default configuration",
    };
  });
