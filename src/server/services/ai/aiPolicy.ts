import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { isUint8Array } from "node:util/types";
import sharp from "sharp";

export const ROUTINE_MODEL = "gemini-3.1-flash-lite";
export const COMPLEX_MODEL = "gemini-3.6-flash";
// Explicit names, not substring matching: an unknown feature always gets complex policy.
const routineFeatures = new Set([
  "classification", "extraction", "email-parser", "email-parsers", "short-description", "short-descriptions",
  "classifyServiceType", "suggestExpenseCategory", "extractActionItems", "orderEmailParser", "quoteEmailParser",
  "generateInvoiceDescription", "bank-transaction-classification", "bank-categorization",
]);

export function policyFor(feature = "unspecified") {
  if (typeof feature !== "string" || !/^[a-zA-Z0-9_.:-]{1,100}$/.test(feature)) {
    throw new Error("AI feature name is invalid. Please use the manual workflow.");
  }
  const routine = routineFeatures.has(feature);
  return { feature, model: routine ? ROUTINE_MODEL : COMPLEX_MODEL, maxTokens: routine ? 2048 : 4096 };
}

// Integer quarter-microUSD per token, rounded UP only once at the end.
// Anthropic input is charged at 2x standard input: covers 1-hour cache writes.
const tariffs: Record<string, readonly [bigint, bigint]> = {
  [`google:${ROUTINE_MODEL}`]: [1n, 6n],
  [`google:${COMPLEX_MODEL}`]: [3n, 15n],
  "anthropic:claude-sonnet-4-20250514": [24n, 60n],
  "anthropic:claude-haiku-4-5-20251001": [8n, 20n],
};

export function tokenCount(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    throw new Error("AI usage could not be verified. Reserved budget is retained; please use the manual workflow.");
  }
  return value;
}

export function priceMicroUSD(provider: string, model: string, input: number, output: number): bigint {
  const rates = tariffs[`${provider}:${model}`];
  if (!rates) throw new Error("AI model has no approved tariff. Please contact an administrator or use the manual workflow.");
  return (BigInt(tokenCount(input)) * rates[0] + BigInt(tokenCount(output)) * rates[1] + 3n) / 4n;
}

export function usdMicro(value: string): bigint {
  if (!/^\d{1,9}(\.\d{1,6})?$/.test(value)) throw new Error("AI budget settings are invalid. Please contact an administrator.");
  const [whole, fraction = ""] = value.split(".");
  return BigInt(whole!) * 1_000_000n + BigInt(fraction.padEnd(6, "0"));
}

export function clamp(value: unknown, maximum: number): number {
  if (value === undefined) return maximum;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1) {
    throw new Error("AI output/step limit is invalid. Please use the manual workflow.");
  }
  return Math.min(value, maximum);
}

export const TEXT_ONLY_MESSAGE = "AI cost controls support non-streaming text only for Anthropic, or Google text with bounded embedded images. Audio, video, PDF/files and tool-result images are not supported; please use the manual workflow.";
export const MAX_INPUT_BOUND = 128_000;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_IMAGES = 2;
export const IMAGE_TOKENS = 16_384;
const imageError = () => new Error("AI images must be at most two embedded PNG/JPEG/WebP/static GIF images, each at most 5 MiB. Remote URLs, animation and unverified images are not supported; please use the manual workflow.");
const imageKey = (image: Uint8Array) => createHash("sha256").update(image).digest("hex");

/** Local decoding only. No URL is ever passed to the SDK or the image decoder. */
export async function normalizeImages(messages: any[], provider: string) {
  const images = new Set<string>();
  let count = 0;
  const normalized = [];
  for (const message of messages) {
    assertNoExtensions(message);
    // UI-message conversion can introduce attachment URLs AFTER this preflight.
    if ([message.parts, message.experimental_attachments, message.toolInvocations].some(value => value !== undefined)) {
      throw new Error("AI cost controls require core messages; put bounded embedded images in user content, not UI attachments/parts. Please use the manual workflow.");
    }
    if (!Array.isArray(message.content)) { normalized.push(message); continue; }
    const content = [];
    for (const part of message.content) {
      assertNoExtensions(part);
      if (part.type !== "image") { content.push(part); continue; }
      if (provider !== "google" || message.role !== "user") throw new Error(TEXT_ONLY_MESSAGE);
      if (++count > MAX_IMAGES) throw imageError();
      let bytes: Buffer;
      if (isUint8Array(part.image)) {
        if (!part.image.byteLength || part.image.byteLength > MAX_IMAGE_BYTES) throw imageError();
        bytes = Buffer.from(part.image); // Own the bytes before any asynchronous decoding.
      } else if (typeof part.image === "string") {
        // Bound encoded length BEFORE regex/decoding; strict base64 excludes URL fetching and ambiguous encodings.
        if (part.image.length > Math.ceil(MAX_IMAGE_BYTES / 3) * 4 + 64) throw imageError();
        const match = /^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/.exec(part.image);
        if (!match || match[2]!.length % 4 !== 0) throw imageError();
        bytes = Buffer.from(match[2]!, "base64");
        if (!bytes.length || bytes.length > MAX_IMAGE_BYTES || bytes.toString("base64") !== match[2]) throw imageError();
      } else throw imageError();
      try {
        // Reject vector/PDF/animated inputs before pixel decoding. Limit decompression memory as well as encoded bytes.
        const decoder = sharp(bytes, { limitInputPixels: 40_000_000, failOn: "warning" });
        const metadata = await decoder.metadata();
        if (!["jpeg", "png", "webp", "gif"].includes(metadata.format ?? "") ||
            !metadata.width || !metadata.height || metadata.width * metadata.height > 40_000_000 ||
            (metadata.pages ?? 1) !== 1) throw imageError();
        const { data, info } = await decoder.rotate().resize({ width: 1536, height: 1536, fit: "inside", withoutEnlargement: true })
          .flatten({ background: "#ffffff" }).jpeg({ quality: 80 }).toBuffer({ resolveWithObject: true });
        if (data.length > MAX_IMAGE_BYTES || info.width > 1536 || info.height > 1536) throw imageError();
        images.add(imageKey(data));
        content.push({ type: "image", image: data, mimeType: "image/jpeg" });
      } catch { throw imageError(); }
    }
    normalized.push({ ...message, content });
  }
  return { messages: normalized, images };
}

function assertNoExtensions(value: any) {
  if ([value?.providerMetadata, value?.providerOptions, value?.experimental_providerMetadata]
    .some(options => options && Object.keys(options).length)) {
    throw new Error("AI provider extensions (including grounding and explicit caching) are not budgeted. Please use plain text.");
  }
}

/** Applied to SDK-normalized params, including converted tool schemas, at EVERY step. */
export function inputBound(params: any, provider = "google", images: ReadonlySet<string> = new Set()): number {
  assertNoExtensions(params);
  let imageCount = 0;
  const prompt = [];
  for (const message of params.prompt ?? []) {
    assertNoExtensions(message);
    if (typeof message.content === "string") { prompt.push(message); continue; }
    if (!Array.isArray(message.content)) throw new Error(TEXT_ONLY_MESSAGE);
    const content = [];
    for (const part of message.content) {
      assertNoExtensions(part);
      if (part.type === "image") {
        if (provider !== "google" || message.role !== "user") throw new Error(TEXT_ONLY_MESSAGE);
        if (++imageCount > MAX_IMAGES || !isUint8Array(part.image) || part.image.byteLength > MAX_IMAGE_BYTES ||
            part.mimeType !== "image/jpeg" || !images.has(imageKey(part.image))) throw imageError();
        // Never stringify Buffer.toJSON() or Uint8Array numeric keys (millions of bytes).
        content.push({ type: "image", image: "[bounded embedded image]", mimeType: "image/jpeg" });
        continue;
      }
      // Reasoning history is textual too, and its serialized bytes are included below.
      if (!["text", "reasoning", "redacted-reasoning", "tool-call", "tool-result"].includes(part.type)) throw new Error(TEXT_ONLY_MESSAGE);
      if (part.type === "tool-result") {
        for (const content of [part.content, part.experimental_content]) {
          if (content !== undefined && (!Array.isArray(content) || content.some((item: any) => item.type !== "text"))) {
            throw new Error(TEXT_ONLY_MESSAGE);
          }
        }
      }
      content.push(part);
    }
    prompt.push({ ...message, content });
  }
  const tools = params.mode?.tools ?? [];
  if (tools.some((tool: any) => tool.type !== "function")) {
    throw new Error("AI hosted tools are not budgeted. Please use application text tools only.");
  }
  // One token per serialized UTF-8 byte plus a substantial framing allowance.
  // Do not log or persist the serialized value.
  let serialized: string;
  try { serialized = JSON.stringify({ prompt: params.prompt === undefined ? undefined : prompt, mode: params.mode, responseFormat: params.responseFormat }); }
  catch { throw new Error("AI input cannot be safely budgeted. Please use the manual workflow."); }
  const bound = Buffer.byteLength(serialized, "utf8") + 8192 + imageCount * IMAGE_TOKENS;
  if (bound > MAX_INPUT_BOUND) throw new Error("AI input is too large for the cost limit (128,000-token conservative bound). Please shorten it.");
  return bound;
}

export type VerifiedUsage = { input: number; output: number; reasoning: number; cached: number; cacheWrite: number };

/** Google SDK usage omits thoughtsTokenCount. Never substitute SDK usage for raw metadata. */
export function rawUsage(provider: string, result: any): VerifiedUsage {
  // v4 adapters use rawResponse.body; accept response.body only when it contains the same verifiable raw counters.
  // Never fall back to lossy SDK usage (Google completionTokens omits reasoning).
  let body = result.rawResponse?.body ?? result.response?.body;
  if (typeof body === "string") {
    try { body = JSON.parse(body); } catch { body = undefined; }
  }
  if (provider === "google") {
    const u = body?.usageMetadata;
    const input = tokenCount(u?.promptTokenCount);
    const candidates = tokenCount(u?.candidatesTokenCount);
    const reasoning = tokenCount(u?.thoughtsTokenCount ?? 0);
    const cached = tokenCount(u?.cachedContentTokenCount ?? 0);
    const total = tokenCount(u?.totalTokenCount);
    if (cached > input || total < input + candidates + reasoning) throw new Error("AI usage metadata is inconsistent; reserved budget is retained.");
    // Include any unclassified billed tokens conservatively at the output tariff.
    return { input, output: tokenCount(total - input), reasoning, cached, cacheWrite: 0 };
  }
  if (provider !== "anthropic") throw new Error("AI provider usage is not supported.");
  const u = body?.usage;
  const cached = tokenCount(u?.cache_read_input_tokens ?? 0);
  const cacheWrite = tokenCount(u?.cache_creation_input_tokens ?? 0);
  const input = tokenCount(tokenCount(u?.input_tokens) + cached + cacheWrite);
  return { input, output: tokenCount(u?.output_tokens), reasoning: 0, cached, cacheWrite };
}