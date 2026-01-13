import { TRPCError } from "@trpc/server";

export const DEMO_ADMIN_EMAIL = "admin@propmanagement.com";
export const DEMO_JUNIOR_ADMIN_EMAIL = "junior@propmanagement.com";

const restrictedDemoEmails = new Set([
  DEMO_ADMIN_EMAIL.toLowerCase(),
  DEMO_JUNIOR_ADMIN_EMAIL.toLowerCase(),
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
