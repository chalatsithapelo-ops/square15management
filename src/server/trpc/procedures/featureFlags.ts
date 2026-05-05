/**
 * Public feature flags surfaced to the browser.
 * Keep this list short and never expose secrets — only booleans / public
 * config values that the UI needs to render conditionally.
 */
import { z } from "zod";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";

export const getFeatureFlags = baseProcedure
  .input(z.object({}).optional())
  .query(async () => {
    return {
      cashbookEnabled: env.CASHBOOK_ENABLED === true,
      bankFeedIdle: env.BANK_FEED_IDLE === true,
    };
  });
