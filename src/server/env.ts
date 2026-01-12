import { z } from "zod";
import { config as dotenvConfig } from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

// Load environment variables BEFORE validation
// Get the project root by going up from src/server/env.ts to the root
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../../');
const envPath = join(projectRoot, '.env');

console.log('[env.ts] Loading .env from:', envPath);
const result = dotenvConfig({ path: envPath });
console.log('[env.ts] Dotenv result:', result.error ? `ERROR: ${result.error.message}` : `Loaded ${Object.keys(result.parsed || {}).length} vars`);
console.log('[env.ts] BRAND_PRIMARY_COLOR from process.env:', process.env.BRAND_PRIMARY_COLOR);

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]),
  BASE_URL: z.string(),
  BASE_URL_OTHER_PORT: z.string().optional(),
  // Prisma reads DATABASE_URL directly; validate it early to avoid intermittent boot/login failures.
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  ADMIN_PASSWORD: z.string(),
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
  VAPID_SUBJECT: z.string().email().optional(),
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
