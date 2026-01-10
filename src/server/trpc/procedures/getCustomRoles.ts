import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireSeniorAdmin } from "~/server/utils/auth";
import { getCustomRoles } from "~/server/utils/permissions";

export const getCustomRolesProc = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireSeniorAdmin(user);

    const customRoles = await getCustomRoles();
    
    return {
      customRoles,
    };
  });
