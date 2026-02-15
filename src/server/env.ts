import { z } from "zod";
import { config as dotenvConfig } from "dotenv";
import { dirname, isAbsolute, join, resolve } from "path";
import { existsSync } from "fs";

// Load environment variables BEFORE validation
// NOTE: Avoid relying on import.meta.url here.
// In some Windows/Nitro build/runtime combinations, import.meta can be rewritten
// in a way that breaks fileURLToPath(). Instead, resolve .env from common anchors.
function resolveEnvPath(): string {
  const candidates: string[] = [];

  if (process.env.DOTENV_CONFIG_PATH) {
    candidates.push(process.env.DOTENV_CONFIG_PATH);
  }

  // Common case: run from project root
  candidates.push(join(process.cwd(), ".env"));

  // If started from built output (e.g. .output/server/index.mjs), walk up
  const entryArg = process.argv[1];
  if (entryArg) {
    const entryAbs = isAbsolute(entryArg) ? entryArg : resolve(entryArg);
    const entryDir = dirname(entryAbs);
    candidates.push(join(entryDir, "..", "..", "..", ".env"));
  }

  for (const candidate of candidates) {
    try {
      if (candidate && existsSync(candidate)) {
        return candidate;
      }
    } catch {
      // ignore
    }
  }

  // Fallback: attempt to load from CWD even if it doesn't exist
  return join(process.cwd(), ".env");
}

const envPath = resolveEnvPath();

console.log('[env.ts] Loading .env from:', envPath);
const result = dotenvConfig({ path: envPath });
console.log('[env.ts] Dotenv result:', result.error ? `ERROR: ${result.error.message}` : `Loaded ${Object.keys(result.parsed || {}).length} vars`);
console.log('[env.ts] BRAND_PRIMARY_COLOR from process.env:', process.env.BRAND_PRIMARY_COLOR);

const optionalTrimmedString = z.preprocess(
  (val) => {
    if (typeof val !== 'string') return val;
    const trimmed = val.trim();
    return trimmed.length ? trimmed : undefined;
  },
  z.string().optional()
);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]),
  BASE_URL: z.string(),
  BASE_URL_OTHER_PORT: z.string().optional(),
  // Prisma reads DATABASE_URL directly; validate it early to avoid intermittent boot/login failures.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_PASSWORD: z.string(),
  // MinIO (optional overrides)
  // Defaults are accessKey="admin" and secretKey=ADMIN_PASSWORD.
  MINIO_ACCESS_KEY: optionalTrimmedString,
  MINIO_SECRET_KEY: optionalTrimmedString,
  // When set, this should be a server-reachable URL like "http://minio:9000" (Docker) or "http://127.0.0.1:9000".
  MINIO_INTERNAL_URL: optionalTrimmedString,
  JWT_SECRET: z.string(),
  GEMINI_API_KEY: z.string(),
  GOOGLE_GENERATIVE_AI_API_KEY: z.string(),
  // Optional Anthropic support
  ANTHROPIC_API_KEY: z.string().optional(),
  // Optional defaults for AI provider and models
  DEFAULT_AI_PROVIDER: z.string().optional(),
  DEFAULT_ANTHROPIC_MODEL: z.string().optional(),
  DEFAULT_GOOGLE_MODEL: z.string().optional(),
  // Company Information (optional with defaults)
  COMPANY_NAME: z.string().default("Square 15 Facility Solutions"),
  COMPANY_ADDRESS_LINE1: z.string().default(""),
  COMPANY_ADDRESS_LINE2: z.string().default(""),
  COMPANY_PHONE: z.string().default(""),
  COMPANY_EMAIL: z.string().default(""),
  COMPANY_VAT_NUMBER: z.string().default(""),
  // Banking Details (optional with defaults)
  COMPANY_BANK_NAME: z.string().default(""),
  COMPANY_BANK_ACCOUNT_NAME: z.string().default(""),
  COMPANY_BANK_ACCOUNT_NUMBER: z.string().default(""),
  COMPANY_BANK_BRANCH_CODE: z.string().default(""),
  // Brand Colors (optional with defaults)
  BRAND_PRIMARY_COLOR: z.string().transform(val => val || "#2D5016").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  BRAND_SECONDARY_COLOR: z.string().transform(val => val || "#F4C430").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  BRAND_ACCENT_COLOR: z.string().transform(val => val || "#5A9A47").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  BRAND_SUCCESS_COLOR: z.string().transform(val => val || "#10b981").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  BRAND_WARNING_COLOR: z.string().transform(val => val || "#f59e0b").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  BRAND_DANGER_COLOR: z.string().transform(val => val || "#dc2626").pipe(z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a valid hex color")),
  // Document Number Prefixes
  COMPANY_INVOICE_PREFIX: z.string().default("INV"),
  COMPANY_ORDER_PREFIX: z.string().default("ORD"),
  COMPANY_QUOTATION_PREFIX: z.string().default("QUO"),
  // Email Configuration
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform((val: string) => parseInt(val, 10)),
  SMTP_SECURE: z.string().transform((val: string) => val === "true"),
  SMTP_USER: z.string().email(),
  SMTP_PASSWORD: z.string(),
  // Web Push Notifications (VAPID keys)
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().optional(),

  // PayFast (optional - required only if using PayFast checkout)
  PAYFAST_MERCHANT_ID: optionalTrimmedString,
  PAYFAST_MERCHANT_KEY: optionalTrimmedString,
  PAYFAST_PASSPHRASE: optionalTrimmedString,
  PAYFAST_SANDBOX: z
    .string()
    .optional()
    .transform((val) => val === "1" || val === "true"),
});

type Env = z.infer<typeof envSchema>;

let _env: Env | null = null;
let _envError: Error | null = null;

function validateEnv(): Env {
  if (_env) {
    return _env;
  }
  
  if (_envError) {
    throw _envError;
  }
  
  try {
    _env = envSchema.parse(process.env);
    return _env;
  } catch (error: unknown) {
    const errorMessage = error instanceof z.ZodError
      ? `Environment variable validation failed:\n${error.errors.map((e: z.ZodIssue) => `  - ${e.path.join('.')}: ${e.message}`).join('\n')}`
      : `Environment variable validation failed: ${error}`;
    
    _envError = new Error(errorMessage);
    console.error(errorMessage);
    throw _envError;
  }
}

// Create a proxy that validates env on first access
export const env = new Proxy({} as Env, {
  get(_target, prop) {
    const validatedEnv = validateEnv();
    return validatedEnv[prop as keyof Env];
  },
  has(_target, prop) {
    const validatedEnv = validateEnv();
    return prop in validatedEnv;
  },
  ownKeys(_target) {
    const validatedEnv = validateEnv();
    return Reflect.ownKeys(validatedEnv);
  },
  getOwnPropertyDescriptor(_target, prop) {
    const validatedEnv = validateEnv();
    return Reflect.getOwnPropertyDescriptor(validatedEnv, prop);
  },
});
