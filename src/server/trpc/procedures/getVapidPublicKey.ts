import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { env } from "~/server/env";

export const getVapidPublicKey = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    // Authenticate the user
    await authenticateUser(input.token);

    // Return the public key if configured
    const publicKey = env.VAPID_PUBLIC_KEY;
    
    return {
      publicKey: publicKey || null,
      enabled: !!publicKey,
    };
  });
