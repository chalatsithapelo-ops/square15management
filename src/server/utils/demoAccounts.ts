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

// ── Demo data isolation ──────────────────────────────────
let _demoUserIds: number[] | null = null;

export async function getDemoUserIds(prismaClient: any): Promise<number[]> {
  if (_demoUserIds !== null) return _demoUserIds;
  const demoUsers = await prismaClient.user.findMany({
    where: {
      email: { in: Array.from(restrictedDemoEmails) },
    },
    select: { id: true },
  });
  _demoUserIds = demoUsers.map((u: any) => u.id);
  return _demoUserIds;
}

/**
 * Adds demo data isolation to a Prisma `where` clause.
 * - Demo accounts only see records owned by demo users.
 * - Real accounts never see records owned by demo users.
 */
export async function applyDemoIsolation(
  where: any,
  user: { email?: string | null },
  prismaClient: any,
  field: string = 'createdById',
): Promise<void> {
  const demoIds = await getDemoUserIds(prismaClient);
  if (demoIds.length === 0) return;
  if (!where.AND) where.AND = [];
  else if (!Array.isArray(where.AND)) where.AND = [where.AND];

  if (isRestrictedDemoAccount(user)) {
    where.AND.push({ [field]: { in: demoIds } });
  } else {
    where.AND.push({
      OR: [
        { [field]: { notIn: demoIds } },
        { [field]: null },
      ],
    });
  }
}
