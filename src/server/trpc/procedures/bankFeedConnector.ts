/**
 * tRPC procedures for the direct bank-feed (Stitch / Mono) connector.
 *
 * Endpoints
 *   linkBankAccountStart     mutation → returns hosted-link URL + signed state
 *   linkBankAccountComplete  mutation → manual fallback if browser callback fails
 *   unlinkBankAccountFeed    mutation → revoke + clear external_* fields
 *   backfillBankAccountFeed  mutation → manual re-pull last N days (max 365)
 *   getBankAccountFeedStatus query    → connected? expired? lastSyncAt? lastError?
 *
 * Auth: ADMIN role required. Ownership check on every mutation
 * (BankAccount.createdById === user.id).
 */

import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { stitchProvider } from "~/server/services/bankFeed/stitchClient";
import {
  persistLink,
  unlinkBankAccount as unlinkAccountSvc,
  syncBankAccount,
} from "~/server/services/bankFeed/providerConnector";
import { createState } from "~/server/services/bankFeed/linkState";

async function requireAdminOwnedAccount(token: string, bankAccountId: number) {
  const user = await authenticateUser(token);
  if (!isAdmin(user)) {
    throw new Error("Admin role required");
  }
  const account = await db.bankAccount.findFirst({
    where: { id: bankAccountId, createdById: user.id },
  });
  if (!account) throw new Error("Bank account not found or not owned by you");
  return { user, account };
}

// ────────────────────────────────────────────────────────────────────────────

export const linkBankAccountStart = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().int(),
      provider: z.enum(["STITCH"]).default("STITCH"),
    })
  )
  .mutation(async ({ input }) => {
    const { user } = await requireAdminOwnedAccount(input.token, input.bankAccountId);

    if (process.env.STITCH_ENABLED !== "1" && process.env.STITCH_ENABLED !== "true") {
      throw new Error("Stitch direct bank feed is not enabled (STITCH_ENABLED=0)");
    }
    if (!process.env.STITCH_CLIENT_ID || !process.env.BANK_FEED_TOKEN_ENC_KEY) {
      throw new Error("Stitch is not fully configured — check server env vars");
    }

    const state = createState({ userId: user.id, bankAccountId: input.bankAccountId });
    const redirectUri =
      process.env.STITCH_REDIRECT_URI ||
      `${process.env.BASE_URL || ""}/api/bank-feed/stitch-callback`;

    const url = stitchProvider.getAuthorizeUrl({ state, redirectUri });
    return { authorizeUrl: url };
  });

// ────────────────────────────────────────────────────────────────────────────

export const linkBankAccountComplete = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().int(),
      code: z.string().min(1),
    })
  )
  .mutation(async ({ input }) => {
    await requireAdminOwnedAccount(input.token, input.bankAccountId);

    const redirectUri =
      process.env.STITCH_REDIRECT_URI ||
      `${process.env.BASE_URL || ""}/api/bank-feed/stitch-callback`;

    const link = await stitchProvider.exchangeCode({
      code: input.code,
      redirectUri,
    });
    await persistLink({
      bankAccountId: input.bankAccountId,
      providerId: "STITCH",
      link,
    });
    // backfill 90 days (don't block response)
    syncBankAccount(input.bankAccountId, { sinceDays: 90 }).catch((err) =>
      console.error("[trpc] backfill error:", err)
    );
    return { ok: true, externalAccountId: link.externalAccountId };
  });

// ────────────────────────────────────────────────────────────────────────────

export const unlinkBankAccountFeed = baseProcedure
  .input(z.object({ token: z.string(), bankAccountId: z.number().int() }))
  .mutation(async ({ input }) => {
    await requireAdminOwnedAccount(input.token, input.bankAccountId);
    await unlinkAccountSvc(input.bankAccountId);
    return { ok: true };
  });

// ────────────────────────────────────────────────────────────────────────────

export const backfillBankAccountFeed = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().int(),
      sinceDays: z.number().int().min(1).max(365).default(90),
    })
  )
  .mutation(async ({ input }) => {
    await requireAdminOwnedAccount(input.token, input.bankAccountId);
    const result = await syncBankAccount(input.bankAccountId, { sinceDays: input.sinceDays });
    return result;
  });

// ────────────────────────────────────────────────────────────────────────────

export const getBankAccountFeedStatus = baseProcedure
  .input(z.object({ token: z.string(), bankAccountId: z.number().int() }))
  .query(async ({ input }) => {
    const { account } = await requireAdminOwnedAccount(input.token, input.bankAccountId);
    return {
      provider: account.externalProvider,
      connected: !!account.externalProvider,
      externalAccountId: account.externalAccountId,
      lastSyncAt: account.externalLastSyncAt,
      lastError: account.externalLastError,
      tokenExpiry: account.externalTokenExpiry,
      consentExpiry: account.externalConsentExpiry,
      consentExpired:
        account.externalConsentExpiry !== null &&
        account.externalConsentExpiry !== undefined &&
        account.externalConsentExpiry.getTime() < Date.now(),
    };
  });
