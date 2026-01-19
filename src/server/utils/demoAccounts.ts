import { TRPCError } from "@trpc/server";

export const DEMO_ADMIN_EMAIL = "admin@propmanagement.com";
export const DEMO_JUNIOR_ADMIN_EMAIL = "junior@propmanagement.com";
export const DEMO_PM_EMAIL = "pm@propmanagement.com";
export const DEMO_CONTRACTOR_EMAIL = "contractor@propmanagement.com";
export const DEMO_ARTISAN_EMAIL = "artisan@propmanagement.com";
export const DEMO_ARTISAN2_EMAIL = "artisan2@propmanagement.com";

const restrictedDemoEmails = new Set([
  DEMO_ADMIN_EMAIL.toLowerCase(),
  DEMO_JUNIOR_ADMIN_EMAIL.toLowerCase(),
  DEMO_PM_EMAIL.toLowerCase(),
  DEMO_CONTRACTOR_EMAIL.toLowerCase(),
  DEMO_ARTISAN_EMAIL.toLowerCase(),
  DEMO_ARTISAN2_EMAIL.toLowerCase(),
]);

export function isRestrictedDemoAccount(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email?.trim().toLowerCase();
  if (!email) return false;
  return restrictedDemoEmails.has(email);
}

export function assertNotRestrictedDemoAccount(
  user: { email?: string | null } | null | undefined,
  action: string
): void {
  if (!isRestrictedDemoAccount(user)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: `Demo admin accounts cannot ${action}.`,
  });
}

export function assertNotRestrictedDemoAccountAccessDenied(
  user: { email?: string | null } | null | undefined
): void {
  if (!isRestrictedDemoAccount(user)) return;
  throw new TRPCError({
    code: "FORBIDDEN",
    message: "Access denied",
  });
}
