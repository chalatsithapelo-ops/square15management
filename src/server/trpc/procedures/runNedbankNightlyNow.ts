/**
 * runNedbankNightlyNow — manual trigger for the Nedbank nightly automation.
 *
 * Lets an admin fire the same call sequence the 01:00 SAST scheduler runs,
 * on demand, from the Bank Feed admin page. Handy for smoke testing after
 * an env-var change and for demoing the automation to the Nedbank team
 * without waiting until 01:00.
 *
 * Auth: ADMIN role required (same policy as bankFeedConnector).
 */

import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { runNedbankNightlyJob } from "~/server/services/bankFeed/nedbankNightlyJob";

export const runNedbankNightlyNow = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) {
      throw new Error("Admin role required");
    }

    if (
      process.env.NEDBANK_ENABLED !== "1" &&
      process.env.NEDBANK_ENABLED !== "true"
    ) {
      throw new Error(
        "Nedbank connector is not enabled on this server (NEDBANK_ENABLED != 1)"
      );
    }

    const result = await runNedbankNightlyJob({ manual: true });
    return result;
  });
