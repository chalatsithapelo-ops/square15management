import { randomUUID } from "node:crypto";
import {
  generateText as sdkGenerateText, generateObject as sdkGenerateObject, wrapLanguageModel,
  type ToolSet, type LanguageModelV1Middleware,
} from "ai";
import { google } from "@ai-sdk/google";
import { db } from "~/server/db";
import { clamp, inputBound, normalizeImages, policyFor, priceMicroUSD, rawUsage, TEXT_ONLY_MESSAGE, usdMicro, type VerifiedUsage } from "./aiPolicy";

export type AIControls = { aiFeature?: string; aiUserId?: number };
const LOCK = 1_591_503_921;
const unavailable = () => new Error("AI budget controls are unavailable. No further AI requests can run; please use the manual workflow or contact an administrator.");

type Reservation = { id: string; reserved: bigint };
type Route = { provider: string; model: string; feature: string; userId: number | null };

async function reserve(route: Route, input: number, output: number): Promise<Reservation> {
  const reserved = priceMicroUSD(route.provider, route.model, input, output);
  try {
    return await db.$transaction(async tx => {
      // Prisma cannot deserialize PostgreSQL's void result without this cast.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK}::bigint)::text`;
      const [clock] = await tx.$queryRaw<{ now: Date; day: string; month: string }[]>`
        WITH clock AS (SELECT clock_timestamp() AS now)
        SELECT now,
          to_char(now AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
          to_char(now AT TIME ZONE 'UTC', 'YYYY-MM') AS month FROM clock`;
      if (!clock) throw unavailable();
      const rows = await tx.$queryRaw<{ key: string; value: string | null }[]>`
        SELECT key, value FROM "SystemSettings" WHERE key IN
          ('ai_monthly_budget_usd', 'ai_daily_budget_usd', 'ai_daily_request_limit', 'ai_billing_cooldown_until')`;
      const settings = new Map(rows.map(row => [row.key, row.value]));
      const cooldown = settings.get("ai_billing_cooldown_until");
      if (cooldown != null) {
        const until = Date.parse(cooldown);
        if (!Number.isFinite(until)) throw new Error("AI billing cooldown setting is invalid. Please contact an administrator.");
        if (until > clock.now.getTime()) throw new Error("AI billing is temporarily unavailable (402). Please use the manual workflow; automatic retries are disabled.");
      }
      const monthly = usdMicro(settings.get("ai_monthly_budget_usd") ?? "4.00");
      const daily = usdMicro(settings.get("ai_daily_budget_usd") ?? "1.00");
      const limitValue = settings.get("ai_daily_request_limit") ?? "300";
      if (!/^\d{1,6}$/.test(limitValue)) throw new Error("AI daily request limit setting is invalid. Please contact an administrator.");
      const [totals] = await tx.$queryRaw<{ month_cost: bigint; day_cost: bigint; daily: bigint; minute: bigint; user_daily: bigint }[]>`
        SELECT
          COALESCE(SUM(COALESCE(actual_micro_usd, reserved_micro_usd)) FILTER
            (WHERE utc_month = ${clock.month} OR actual_micro_usd IS NULL), 0)::bigint AS month_cost,
          COALESCE(SUM(COALESCE(actual_micro_usd, reserved_micro_usd)) FILTER
            (WHERE utc_day = ${clock.day}::date OR actual_micro_usd IS NULL), 0)::bigint AS day_cost,
          COUNT(*) FILTER (WHERE utc_day = ${clock.day}::date)::bigint AS daily,
          COUNT(*) FILTER (WHERE feature = ${route.feature} AND created_at >= ${clock.now}::timestamptz - interval '1 minute')::bigint AS minute,
          COUNT(*) FILTER (WHERE user_id = ${route.userId}::integer AND utc_day = ${clock.day}::date)::bigint AS user_daily
        FROM ai_usage_controls`;
      if (!totals) throw unavailable();
      if (BigInt(totals.month_cost) + reserved > monthly || BigInt(totals.day_cost) + reserved > daily) {
        throw new Error("AI budget limit reached. Please use the manual workflow until budget is available.");
      }
      if (BigInt(totals.daily) >= BigInt(limitValue) || BigInt(totals.minute) >= 10n ||
        (route.userId !== null && BigInt(totals.user_daily) >= 30n)) {
        throw new Error("AI request rate limit reached. Please use the manual workflow and try again later.");
      }
      const id = randomUUID();
      await tx.$executeRaw`
        INSERT INTO ai_usage_controls
          (id, created_at, utc_month, utc_day, feature, user_id, model, provider, reserved_micro_usd, input_bound, output_bound)
        VALUES (${id}::uuid, ${clock.now}, ${clock.month}, ${clock.day}::date, ${route.feature}, ${route.userId},
          ${route.model}, ${route.provider}, ${reserved}, ${input}, ${output})`;
      return { id, reserved };
    }, { isolationLevel: "ReadCommitted" });
  } catch (error) {
    if (error instanceof Error && error.message.startsWith("AI ")) throw error;
    throw unavailable();
  }
}

async function settle(reservation: Reservation, route: Route, usage: VerifiedUsage | null, status: string, billing402 = false) {
  const actual = usage ? priceMicroUSD(route.provider, route.model, usage.input, usage.output) : null;
  try {
    await db.$transaction(async tx => {
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(${LOCK}::bigint)::text`;
      await tx.$executeRaw`
        UPDATE ai_usage_controls SET actual_micro_usd = ${actual}, status = ${status}, settled_at = clock_timestamp(),
          input_tokens = ${usage?.input ?? null}, output_tokens = ${usage?.output ?? null},
          reasoning_tokens = ${usage?.reasoning ?? null}, cached_tokens = ${usage?.cached ?? null},
          cache_write_tokens = ${usage?.cacheWrite ?? null}
        WHERE id = ${reservation.id}::uuid AND status = 'reserved'`;
      if (billing402) {
        await tx.$executeRaw`
          INSERT INTO "SystemSettings" (key, value, "createdAt", "updatedAt")
          VALUES ('ai_billing_cooldown_until', (clock_timestamp() + interval '15 minutes')::text, clock_timestamp(), clock_timestamp())
          ON CONFLICT (key) DO UPDATE SET value =
            GREATEST("SystemSettings".value::timestamptz, clock_timestamp() + interval '15 minutes')::text,
            "updatedAt" = clock_timestamp()`;
      }
    }, { isolationLevel: "ReadCommitted" });
  } catch { throw unavailable(); }
  return actual;
}

function isBilling402(error: any): boolean {
  // Some SDK errors nest the HTTP error. Do not log or persist its message/body.
  for (let depth = 0; error && depth < 5; depth++, error = error.cause) {
    if (error.statusCode === 402 || error.status === 402) return true;
  }
  return false;
}

async function prepare(options: any) {
  const { aiFeature, aiUserId, ...original } = options;
  const policy = policyFor(aiFeature);
  if (aiUserId !== undefined && (!Number.isSafeInteger(aiUserId) || aiUserId < 1 || aiUserId > 2_147_483_647)) {
    throw new Error("AI user ID is invalid. Please use the manual workflow.");
  }
  if (original.stream) throw new Error(TEXT_ONLY_MESSAGE);
  // prepareStep can replace the wrapped model; repairs can make hidden unmetered calls.
  if (original.experimental_prepareStep || original.experimental_repairToolCall || original.experimental_repairText) {
    throw new Error("AI model switching and repair callbacks are not supported by cost controls. Please use the manual workflow.");
  }
  if ((original.providerOptions && Object.keys(original.providerOptions).length) ||
      (original.experimental_providerMetadata && Object.keys(original.experimental_providerMetadata).length)) {
    throw new Error("AI provider extensions are not budgeted. Please use plain text without provider options.");
  }
  const requested = original.model;
  const provider = requested?.provider === "google.generative-ai" ? "google" : requested?.provider === "anthropic.messages" ? "anthropic" : "unsupported";
  const model = provider === "google" ? google(policy.model) : requested;
  const route: Route = { provider, model: model?.modelId ?? "unknown", feature: policy.feature, userId: aiUserId ?? null };
  priceMicroUSD(provider, route.model, 0, 0); // Fail closed on unapproved providers/models before SDK work.
  if (original.system !== undefined && typeof original.system !== "string") throw new Error(TEXT_ONLY_MESSAGE);
  if (original.prompt !== undefined && typeof original.prompt !== "string") throw new Error(TEXT_ONLY_MESSAGE);
  const normalized = await normalizeImages(original.messages ?? [{ role: "user", content: original.prompt ?? "" }], provider);
  // Replace images with owned bounded bytes BEFORE SDK normalization/download logic.
  if (original.messages !== undefined) original.messages = normalized.messages;
  inputBound({ prompt: [...(original.system ? [{ role: "system", content: original.system }] : []), ...normalized.messages] }, provider, normalized.images);
  const maxTokens = clamp(original.maxTokens, policy.maxTokens);
  const maxSteps = clamp(original.maxSteps, 5);
  let attempts = 0;
  const middleware: LanguageModelV1Middleware = {
    transformParams: async ({ type, params }) => {
      if (type !== "generate") throw new Error(TEXT_ONLY_MESSAGE);
      return { ...params, maxTokens: clamp(params.maxTokens, maxTokens) };
    },
    wrapStream: async () => { throw new Error(TEXT_ONLY_MESSAGE); },
    wrapGenerate: async ({ params, doGenerate }) => {
      if (++attempts > maxSteps) throw new Error("AI maximum steps reached. Please use the manual workflow.");
      // Also rejects provider metadata that could add a thinking budget beyond maxTokens.
      const input = inputBound(params, provider, normalized.images);
      const reservation = await reserve(route, input, params.maxTokens!);
      let result;
      try { result = await doGenerate(); }
      catch (error) {
        const billing = isBilling402(error);
        await settle(reservation, route, null, "error", billing);
        throw new Error(billing
          ? "AI billing is temporarily unavailable (402). Please use the manual workflow; automatic retries are disabled."
          : "AI provider request failed. Reserved budget is retained; please use the manual workflow.");
      }
      let usage: VerifiedUsage;
      try { usage = rawUsage(provider, result); }
      catch {
        await settle(reservation, route, null, "unknown");
        throw new Error("AI usage could not be verified. Reserved budget is retained; please use the manual workflow.");
      }
      const actual = await settle(reservation, route, usage, "settled");
      if (actual! > reservation.reserved || usage.input > input || usage.output > params.maxTokens!) {
        throw new Error("AI usage exceeded its conservative reservation. Actual usage was recorded; please contact an administrator.");
      }
      return result;
    },
  };
  return { ...original, model: wrapLanguageModel({ model, middleware }), maxTokens, maxSteps, maxRetries: 0 };
}

// Keep generic inference (tools and structured output) rather than ReturnType<typeof fn> erasure.
type TextOptions<T extends ToolSet, O, P> = Parameters<typeof sdkGenerateText<T, O, P>>[0] & AIControls;
type ControlledText = {
  <T extends ToolSet, O = never, P = never>(options: TextOptions<T, O, P>): ReturnType<typeof sdkGenerateText<T, O, P>>;
};

// Extract the four installed v4 overload input shapes; rebind just their generic schema.
type ObjectInputs<F> = F extends { (o: infer A): unknown; (o: infer B): unknown; (o: infer C): unknown; (o: infer D): unknown }
  ? [A, B, C, D] : never;
type Inputs = ObjectInputs<typeof sdkGenerateObject>;
type SchemaFor<T> = import("zod").Schema<T, import("zod").ZodTypeDef, any> | import("@ai-sdk/ui-utils").Schema<T>;
type ControlledObject = {
  <T>(options: Omit<Inputs[0], "schema"> & { schema: SchemaFor<T> } & AIControls): Promise<import("ai").GenerateObjectResult<T>>;
  <T>(options: Omit<Inputs[1], "schema"> & { schema: SchemaFor<T> } & AIControls): Promise<import("ai").GenerateObjectResult<T[]>>;
  <E extends string>(options: Omit<Inputs[2], "enum"> & { enum: E[] } & AIControls): Promise<import("ai").GenerateObjectResult<E>>;
  (options: Inputs[3] & AIControls): ReturnType<typeof sdkGenerateObject>;
};

export const generateText: ControlledText & typeof sdkGenerateText = (async (options: any) => sdkGenerateText(await prepare(options))) as ControlledText & typeof sdkGenerateText;
export const generateObject: ControlledObject & typeof sdkGenerateObject = (async (options: any) => sdkGenerateObject(await prepare(options))) as ControlledObject & typeof sdkGenerateObject;