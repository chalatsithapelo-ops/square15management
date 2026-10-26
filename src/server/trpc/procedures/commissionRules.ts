// PR-7 — Commission rule CRUD (per-user effective-dated rates).
// Restricted to senior admin tier — controls how much TMs / site leads / ops
// managers earn.

import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const SENIOR_ADMIN_ROLES = ["ADMIN", "SENIOR_ADMIN", "MANAGER"];

function ensureSeniorAdmin(role: string) {
  if (!SENIOR_ADMIN_ROLES.includes(role)) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Senior admin only" });
  }
}

export const adminListCommissionRules = baseProcedure
  .input(z.object({ token: z.string(), userId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const rules = await db.commissionRule.findMany({
      where: input.userId ? { userId: input.userId } : undefined,
      orderBy: [{ userId: "asc" }, { effectiveFrom: "desc" }],
      include: {
        user: { select: { id: true, firstName: true, lastName: true, email: true, role: true } },
        createdBy: { select: { id: true, firstName: true, lastName: true } },
      },
    });
    return rules;
  });

export const adminUpsertCommissionRule = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number().optional(),
      userId: z.number(),
      role: z.enum(["TM", "SITE_LEAD", "OPS", "SALES_AGENT"]),
      rate: z.number().min(0).max(1), // legacy percent (kept for display / backwards compat)
      approvalThreshold: z.number().min(0).default(5000),
      // PR-7b — per-order-kind rate strategy. Optional: when omitted, both default
      // to PERCENT @ `rate`, preserving the original single-percent API.
      openRateType: z.enum(["PERCENT", "HOURLY", "DAILY", "NONE"]).optional(),
      openRateValue: z.number().min(0).optional(),
      quotedRateType: z.enum(["PERCENT", "HOURLY", "DAILY", "NONE"]).optional(),
      quotedRateValue: z.number().min(0).optional(),
      effectiveFrom: z.string().optional(), // ISO
      effectiveTo: z.string().nullable().optional(),
      notes: z.string().optional(),
    }),
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const openRateType = input.openRateType ?? "PERCENT";
    const openRateValue = input.openRateValue ?? input.rate;
    const quotedRateType = input.quotedRateType ?? "PERCENT";
    const quotedRateValue = input.quotedRateValue ?? input.rate;

    // If PERCENT, sanity-check rate values are in 0..1 (we store percents as fractions).
    if (openRateType === "PERCENT" && (openRateValue < 0 || openRateValue > 1)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "openRateValue must be 0..1 for PERCENT (e.g. 0.35 = 35%)" });
    }
    if (quotedRateType === "PERCENT" && (quotedRateValue < 0 || quotedRateValue > 1)) {
      throw new TRPCError({ code: "BAD_REQUEST", message: "quotedRateValue must be 0..1 for PERCENT (e.g. 0.35 = 35%)" });
    }

    const data = {
      userId: input.userId,
      role: input.role,
      rate: input.rate,
      approvalThreshold: input.approvalThreshold,
      openRateType,
      openRateValue,
      quotedRateType,
      quotedRateValue,
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : new Date(),
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
      notes: input.notes ?? null,
    };

    if (input.id) {
      const updated = await db.commissionRule.update({ where: { id: input.id }, data });
      return updated;
    }

    // Close the previous active rule for this user (set effectiveTo = effectiveFrom)
    await db.commissionRule.updateMany({
      where: { userId: input.userId, effectiveTo: null, id: { not: input.id ?? -1 } },
      data: { effectiveTo: data.effectiveFrom },
    });

    const created = await db.commissionRule.create({
      data: { ...data, createdById: user.id },
    });
    return created;
  });

export const adminDeactivateCommissionRule = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const updated = await db.commissionRule.update({
      where: { id: input.id },
      data: { effectiveTo: new Date() },
    });
    return updated;
  });

// Hard-delete a commission rule. Use when a rule was created in error or is a
// duplicate. Refuses to delete a rule that has already been used to lock a
// TmMonthlyStatement — those must be kept for audit; deactivate instead.
export const adminDeleteCommissionRule = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureSeniorAdmin(user.role);

    const rule = await db.commissionRule.findUnique({ where: { id: input.id } });
    if (!rule) throw new TRPCError({ code: "NOT_FOUND", message: "Rule not found" });

    // Refuse if any locked monthly statement overlaps this rule's active window
    // (statements are month-buckets keyed by periodMonth = first-of-month).
    const feStart = new Date(rule.effectiveFrom.getFullYear(), rule.effectiveFrom.getMonth(), 1);
    const lockedRef = await db.tmMonthlyStatement.findFirst({
      where: {
        userId: rule.userId,
        lockedAt: { not: null },
        periodMonth: {
          gte: feStart,
          ...(rule.effectiveTo ? { lte: rule.effectiveTo } : {}),
        },
      },
      select: { id: true, periodMonth: true },
    });
    if (lockedRef) {
      throw new TRPCError({
        code: "CONFLICT",
        message: `Cannot delete: rule overlaps locked statement for ${lockedRef.periodMonth.toISOString().slice(0, 7)}. Deactivate instead.`,
      });
    }

    await db.commissionRule.delete({ where: { id: input.id } });
    return { ok: true };
  });
