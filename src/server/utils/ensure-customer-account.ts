import { db } from "~/server/db";
import bcrypt from "bcryptjs";

/**
 * Returns the alphabetic-only, lowercase token used to derive the customer's
 * deterministic password. Prefers the supplied first name when it is a real
 * name (>=2 alphabetic characters). Falls back to the alphabetic prefix of the
 * email's local part so records with junk first names (e.g. building numbers
 * like "102") still produce a usable, predictable password.
 */
export function deriveCustomerPasswordSlug(params: {
  email: string;
  firstName?: string | null;
}): string {
  const rawFirst = (params.firstName ?? "").trim().toLowerCase();
  const firstAlpha = rawFirst.replace(/[^a-z]/g, "");
  if (firstAlpha.length >= 2) {
    return firstAlpha;
  }

  const localPart = (params.email.split("@")[0] ?? "").toLowerCase();
  const localAlpha = localPart.replace(/[^a-z]/g, "");
  if (localAlpha.length >= 2) {
    return localAlpha;
  }

  // Last-resort fallback so we never produce just "123".
  return "customer";
}

/**
 * Ensures a CUSTOMER user account exists for the given email.
 * If the account already exists, returns the existing user.
 * If not, creates a new one with:
 *   - email: the customer's email
 *   - password: deriveCustomerPasswordSlug() + "123" (hashed)
 *   - role: "CUSTOMER"
 *
 * Returns { user, plainPassword, isNew } so callers can include
 * login credentials in emails when appropriate.
 */
export async function ensureCustomerAccount(params: {
  email: string;
  firstName: string;
  lastName: string;
  enforceDeterministicPassword?: boolean;
}): Promise<{
  user: { id: number; email: string; firstName: string; lastName: string; role: string };
  plainPassword: string;
  isNew: boolean;
}> {
  const email = params.email.trim().toLowerCase();
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();

  // Derive plain-text password: lowercase alphabetic first name (or email
  // local-part fallback) + "123".
  const passwordSlug = deriveCustomerPasswordSlug({ email, firstName });
  const plainPassword = passwordSlug + "123";

  // Check if user already exists
  const existing = await db.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      password: true,
    },
  });

  if (existing) {
    if (existing.role === "CUSTOMER" && (params.enforceDeterministicPassword ?? true)) {
      const hasExpectedPassword = await bcrypt.compare(plainPassword, existing.password);

      if (!hasExpectedPassword || existing.firstName !== firstName || existing.lastName !== lastName) {
        const hashedPassword = await bcrypt.hash(plainPassword, 10);
        const updated = await db.user.update({
          where: { id: existing.id },
          data: {
            password: hashedPassword,
            firstName,
            lastName,
          },
          select: { id: true, email: true, firstName: true, lastName: true, role: true },
        });

        console.log(`[ensureCustomerAccount] Synced CUSTOMER credentials for ${email} (password: ${plainPassword})`);
        return { user: updated, plainPassword, isNew: false };
      }
    }

    return {
      user: {
        id: existing.id,
        email: existing.email,
        firstName: existing.firstName,
        lastName: existing.lastName,
        role: existing.role,
      },
      plainPassword,
      isNew: false,
    };
  }

  // Create new CUSTOMER account
  const hashedPassword = await bcrypt.hash(plainPassword, 10);

  const newUser = await db.user.create({
    data: {
      email,
      password: hashedPassword,
      firstName,
      lastName,
      role: "CUSTOMER",
    },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  console.log(`[ensureCustomerAccount] Created CUSTOMER account for ${email} (password: ${plainPassword})`);

  return { user: newUser, plainPassword, isNew: true };
}
