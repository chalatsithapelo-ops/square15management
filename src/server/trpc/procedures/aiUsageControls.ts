import { z } from "zod";
import { TRPCError, type inferProcedureOutput } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

const LOCK = 1_591_503_921; // Same transaction lock as controlledGeneration.reserve/settle.
const DEFAULTS = { monthlyBudgetUsd: 4, dailyBudgetUsd: 1, dailyRequestLimit: 300 };
const budgetInput = z.object({
  token: z.string().min(1),
  monthlyBudgetUsd: z.number().finite().min(0).max(100),
  dailyBudgetUsd: z.number().finite().min(0).max(100),
  dailyRequestLimit: z.number().int().min(1).max(10_000),
}).refine(value => value.dailyBudgetUsd <= value.monthlyBudgetUsd, {
  message: "Daily budget must not exceed the monthly budget", path: ["dailyBudgetUsd"],
});

type AggregateRow = {
  period: "month" | "day" | "outstanding";
  feature: string; provider: string; model: string;
  committed: bigint; actual: bigint; reserved: bigint;
  requests: bigint; outstanding: bigint; carried: bigint;
  input_tokens: bigint; output_tokens: bigint; reasoning_tokens: bigint;
  cached_tokens: bigint; cache_write_tokens: bigint;
};

const emptyTotals = () => ({
  spendAndReservedUsd: 0, actualSettledUsd: 0, outstandingReservedUsd: 0,
  requests: 0, outstandingCount: 0, carriedOutstandingCount: 0,
  inputTokens: 0, outputTokens: 0, reasoningTokens: 0, cachedTokens: 0, cacheWriteTokens: 0,
});

function totals(row: AggregateRow) {
  return {
    spendAndReservedUsd: Number(row.committed) / 1_000_000,
    actualSettledUsd: Number(row.actual) / 1_000_000,
    outstandingReservedUsd: Number(row.reserved) / 1_000_000,
    requests: Number(row.requests), outstandingCount: Number(row.outstanding),
    carriedOutstandingCount: Number(row.carried),
    inputTokens: Number(row.input_tokens), outputTokens: Number(row.output_tokens),
    reasoningTokens: Number(row.reasoning_tokens), cachedTokens: Number(row.cached_tokens),
    cacheWriteTokens: Number(row.cache_write_tokens),
  };
}

export const getAIUsageSummary = baseProcedure
  .input(z.object({ token: z.string().min(1) }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      // Consistent read-only snapshot; never releases reservations or resets cooldowns.
      return await db.$transaction(async tx => {
        const [clock] = await tx.$queryRaw<{ now: Date; month: string; day: string }[]>`
          WITH clock AS (SELECT transaction_timestamp() AS now)
          SELECT now, to_char(now AT TIME ZONE 'UTC', 'YYYY-MM') AS month,
            to_char(now AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day FROM clock`;
        if (!clock) throw new Error("Missing database clock");
        const rows = await tx.systemSettings.findMany({
          where: { key: { in: ["ai_monthly_budget_usd", "ai_daily_budget_usd", "ai_daily_request_limit", "ai_billing_cooldown_until"] } },
          select: { key: true, value: true },
        });
        const settings = new Map(rows.map(row => [row.key, row.value]));
        const numeric = (key: string, fallback: number) => {
          const value = settings.get(key);
          if (value == null) return fallback;
          const format = key === "ai_daily_request_limit" ? /^\d{1,6}$/ : /^\d{1,9}(?:\.\d{1,6})?$/;
          if (!format.test(value) || !Number.isFinite(Number(value))) {
            throw new TRPCError({ code: "PRECONDITION_FAILED", message: "AI budget settings are invalid. Contact an administrator." });
          }
          return Number(value);
        };
        const controls = {
          monthlyBudgetUsd: numeric("ai_monthly_budget_usd", DEFAULTS.monthlyBudgetUsd),
          dailyBudgetUsd: numeric("ai_daily_budget_usd", DEFAULTS.dailyBudgetUsd),
          dailyRequestLimit: numeric("ai_daily_request_limit", DEFAULTS.dailyRequestLimit),
        };
        const cooldownValue = settings.get("ai_billing_cooldown_until");
        const cooldownTime = cooldownValue == null ? null : Date.parse(cooldownValue);
        const invalidCooldown = cooldownTime !== null && !Number.isFinite(cooldownTime);
        const aggregates = await tx.$queryRaw<AggregateRow[]>`
          SELECT scope.period, feature, provider, model,
            COALESCE(SUM(COALESCE(actual_micro_usd, reserved_micro_usd)), 0)::bigint AS committed,
            COALESCE(SUM(actual_micro_usd) FILTER (WHERE status = 'settled'), 0)::bigint AS actual,
            COALESCE(SUM(reserved_micro_usd) FILTER (WHERE actual_micro_usd IS NULL), 0)::bigint AS reserved,
            COUNT(*) FILTER (WHERE scope.in_period)::bigint AS requests,
            COUNT(*) FILTER (WHERE actual_micro_usd IS NULL)::bigint AS outstanding,
            COUNT(*) FILTER (WHERE actual_micro_usd IS NULL AND NOT scope.in_period)::bigint AS carried,
            COALESCE(SUM(input_tokens), 0)::bigint AS input_tokens,
            COALESCE(SUM(output_tokens), 0)::bigint AS output_tokens,
            COALESCE(SUM(reasoning_tokens), 0)::bigint AS reasoning_tokens,
            COALESCE(SUM(cached_tokens), 0)::bigint AS cached_tokens,
            COALESCE(SUM(cache_write_tokens), 0)::bigint AS cache_write_tokens
          FROM ai_usage_controls
          CROSS JOIN LATERAL (VALUES
            ('month', utc_month = ${clock.month}),
            ('day', utc_day = ${clock.day}::date),
            ('outstanding', false)
          ) AS scope(period, in_period)
          WHERE scope.in_period OR actual_micro_usd IS NULL
          GROUP BY scope.period, feature, provider, model
          ORDER BY scope.period, committed DESC, feature, provider, model`;
        const period = (name: AggregateRow["period"]) => {
          const byFeatureProviderModel = aggregates.filter(row => row.period === name).map(row => ({
            feature: row.feature, provider: row.provider, model: row.model, ...totals(row),
          }));
          const total = emptyTotals();
          for (const row of byFeatureProviderModel) {
            for (const key of Object.keys(total) as (keyof typeof total)[]) total[key] += row[key];
          }
          const cap = name === "month" ? controls.monthlyBudgetUsd : controls.dailyBudgetUsd;
          return { ...total, remainingBudgetUsd: Math.max(0, cap - total.spendAndReservedUsd), byFeatureProviderModel };
        };
        const month = period("month");
        const day = period("day");
        const outstanding = period("outstanding");
        return {
          asOfUtc: clock.now.toISOString(), utcMonth: clock.month, utcDay: clock.day,
          controls, defaults: DEFAULTS, canEdit: user.role === "ADMIN" || user.role === "SENIOR_ADMIN",
          month, day: { ...day, remainingRequests: Math.max(0, controls.dailyRequestLimit - day.requests) },
          outstanding: { count: outstanding.outstandingCount, reservedUsd: outstanding.outstandingReservedUsd },
          cooldown: {
            active: invalidCooldown || (cooldownTime !== null && cooldownTime > clock.now.getTime()),
            invalid: invalidCooldown,
            untilUtc: cooldownTime !== null && !invalidCooldown ? new Date(cooldownTime).toISOString() : null,
          },
        };
      }, { isolationLevel: "RepeatableRead" });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      // Never expose database details, prompt content, authentication data or settings values.
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI usage controls are unavailable. Please try again later." });
    }
  });

export const updateAIBudgetControls = baseProcedure
  .input(budgetInput)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);
    if (user.role !== "ADMIN" && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({ code: "FORBIDDEN", message: "Only ADMIN or SENIOR_ADMIN can change AI budgets." });
    }
    try {
      await db.$transaction(async tx => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK}::bigint)::text`;
        // Validate again within the same critical section as reservation/settlement.
        const validated = budgetInput.parse(input);
        const values = [
          ["ai_monthly_budget_usd", validated.monthlyBudgetUsd.toFixed(6)],
          ["ai_daily_budget_usd", validated.dailyBudgetUsd.toFixed(6)],
          ["ai_daily_request_limit", String(validated.dailyRequestLimit)],
        ] as const;
        for (const [key, value] of values) {
          await tx.systemSettings.upsert({ where: { key }, create: { key, value }, update: { value } });
        }
      }, { isolationLevel: "ReadCommitted" });
      return { success: true as const };
    } catch {
      throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "AI budget settings could not be saved. Please try again later." });
    }
  });

export type AIUsageSummary = inferProcedureOutput<typeof getAIUsageSummary>;