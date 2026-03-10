import { db } from "~/server/db";
import bcrypt from "bcryptjs";

/**
 * Ensures a CUSTOMER user account exists for the given email.
 * If the account already exists, returns the existing user.
 * If not, creates a new one with:
 *   - email: the customer's email
 *   - password: firstName.toLowerCase() + "123" (hashed)
 *   - role: "CUSTOMER"
 *
 * Returns { user, plainPassword, isNew } so callers can include
 * login credentials in emails when appropriate.
 */
export async function ensureCustomerAccount(params: {
  email: string;
  firstName: string;
  lastName: string;
}): Promise<{
  user: { id: number; email: string; firstName: string; lastName: string; role: string };
  plainPassword: string;
  isNew: boolean;
}> {
  const email = params.email.trim().toLowerCase();
  const firstName = params.firstName.trim();
  const lastName = params.lastName.trim();

  // Derive plain-text password: lowercase first name + "123"
  const plainPassword = firstName.toLowerCase() + "123";

  // Check if user already exists
  const existing = await db.user.findUnique({
    where: { email },
    select: { id: true, email: true, firstName: true, lastName: true, role: true },
  });

  if (existing) {
    return { user: existing, plainPassword, isNew: false };
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

  console.log(`[ensureCustomerAccount] Created CUSTOMER account for ${email} (password: ${firstName.toLowerCase()}123)`);

  return { user: newUser, plainPassword, isNew: true };
}
