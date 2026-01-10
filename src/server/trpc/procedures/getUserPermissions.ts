import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getRolePermissionsAsync, ROLE_METADATA, getRoleLabel } from "~/server/utils/permissions";

export const getUserPermissions = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    const permissions = await getRolePermissionsAsync(user.role);
    const roleMetadata = ROLE_METADATA[user.role as keyof typeof ROLE_METADATA];
    
    return {
      userId: user.id,
      role: user.role,
      roleLabel: getRoleLabel(user.role),
      roleDescription: roleMetadata?.description || "",
      permissions,
    };
  });
