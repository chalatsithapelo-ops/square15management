import { z } from "zod";
import { TRPCError } from "@trpc/server";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { db } from "~/server/db";
import {
  isAdmin as checkIsAdmin,
  isSeniorAdmin as checkIsSeniorAdmin,
  isManagerOrHigher,
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
  PERMISSIONS,
  type Permission,
} from "~/server/utils/permissions";

export type AuthenticatedUser = {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  phone: string | null;
  hourlyRate: number | null;
  dailyRate: number | null;
  contractorCompanyName: string | null;
  hasPersonalEmail: boolean;
  disabledNotificationTypes: string[];
};

/**
 * Verifies a JWT token and returns the authenticated user.
 * Throws TRPCError with specific messages for different failure scenarios.
 * 
 * @param token - The JWT token to verify
 * @returns The authenticated user from the database
 * @throws TRPCError with code UNAUTHORIZED if token is invalid, expired, or user not found
 */
export async function authenticateUser(token: string): Promise<AuthenticatedUser> {
  try {
    // Verify the JWT token
    const verified = jwt.verify(token, env.JWT_SECRET);
    
    // Parse and validate the token payload
    const parsed = z.object({ userId: z.number() }).parse(verified);

    // Fetch the user from the database
    const user = await db.user.findUnique({
      where: { id: parsed.userId },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        phone: true,
        hourlyRate: true,
        dailyRate: true,
        contractorCompanyName: true,
        userEmailSmtpHost: true,
        userEmailSmtpUser: true,
        userEmailSmtpPassword: true,
        disabledNotificationTypes: true,
      },
    });

    if (!user) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "User not found",
      });
    }

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      phone: user.phone,
      hourlyRate: user.hourlyRate,
      dailyRate: user.dailyRate,
      contractorCompanyName: user.contractorCompanyName,
      hasPersonalEmail: !!(user.userEmailSmtpHost && user.userEmailSmtpUser && user.userEmailSmtpPassword),
      disabledNotificationTypes: user.disabledNotificationTypes,
    };
  } catch (error) {
    // Re-throw TRPCErrors as-is
    if (error instanceof TRPCError) {
      throw error;
    }
    
    // Handle JWT-specific errors with detailed messages
    if (error instanceof jwt.TokenExpiredError) {
      console.error("Token expired:", error.message);
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Your session has expired. Please log in again.",
      });
    }
    
    if (error instanceof jwt.JsonWebTokenError) {
      console.error("Invalid token:", error.message);
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid authentication token. Please log in again.",
      });
    }
    
    // Handle Zod parsing errors (malformed token payload)
    if (error instanceof z.ZodError) {
      console.error("Token payload validation failed:", error.errors);
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid token format. Please log in again.",
      });
    }
    
    // Generic fallback for any other errors
    console.error("Unexpected error during authentication:", error);
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication failed. Please log in again.",
    });
  }
}

/**
 * Checks if a user has admin privileges (Junior Admin or higher).
 * 
 * @param user - The authenticated user
 * @returns true if user is an admin, false otherwise
 */
export function isAdmin(user: AuthenticatedUser): boolean {
  return checkIsAdmin(user.role);
}

/**
 * Checks if a user is a Senior Admin.
 * 
 * @param user - The authenticated user
 * @returns true if user is a senior admin, false otherwise
 */
export function isSeniorAdmin(user: AuthenticatedUser): boolean {
  return checkIsSeniorAdmin(user.role);
}

/**
 * Checks if a user is a Manager or higher.
 * 
 * @param user - The authenticated user
 * @returns true if user is a manager or higher, false otherwise
 */
export function isManager(user: AuthenticatedUser): boolean {
  return isManagerOrHigher(user.role);
}

/**
 * Requires that the user has admin privileges.
 * Throws TRPCError with code FORBIDDEN if user is not an admin.
 * 
 * @param user - The authenticated user
 * @throws TRPCError with code FORBIDDEN if user is not an admin
 */
export function requireAdmin(user: AuthenticatedUser): void {
  if (!isAdmin(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only administrators can perform this action",
    });
  }
}

/**
 * Requires that the user is a Senior Admin.
 * Throws TRPCError with code FORBIDDEN if user is not a senior admin.
 * 
 * @param user - The authenticated user
 * @throws TRPCError with code FORBIDDEN if user is not a senior admin
 */
export function requireSeniorAdmin(user: AuthenticatedUser): void {
  if (!isSeniorAdmin(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only senior administrators can perform this action",
    });
  }
}

/**
 * Requires that the user is a Manager or higher.
 * Throws TRPCError with code FORBIDDEN if user is not a manager or higher.
 * 
 * @param user - The authenticated user
 * @throws TRPCError with code FORBIDDEN if user is not a manager or higher
 */
export function requireManager(user: AuthenticatedUser): void {
  if (!isManager(user)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Only managers and administrators can perform this action",
    });
  }
}

/**
 * Requires that the user has a specific permission.
 * Throws TRPCError with code FORBIDDEN if user doesn't have the permission.
 * 
 * @param user - The authenticated user
 * @param permission - The required permission
 * @param customMessage - Optional custom error message
 * @throws TRPCError with code FORBIDDEN if user doesn't have the permission
 */
export function requirePermission(
  user: AuthenticatedUser,
  permission: Permission,
  customMessage?: string
): void {
  if (!hasPermission(user.role, permission)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: customMessage || "You don't have permission to perform this action",
    });
  }
}

/**
 * Requires that the user has any of the specified permissions.
 * Throws TRPCError with code FORBIDDEN if user doesn't have any of the permissions.
 * 
 * @param user - The authenticated user
 * @param permissions - Array of acceptable permissions
 * @param customMessage - Optional custom error message
 * @throws TRPCError with code FORBIDDEN if user doesn't have any of the permissions
 */
export function requireAnyPermission(
  user: AuthenticatedUser,
  permissions: Permission[],
  customMessage?: string
): void {
  if (!hasAnyPermission(user.role, permissions)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: customMessage || "You don't have permission to perform this action",
    });
  }
}

/**
 * Requires that the user has all of the specified permissions.
 * Throws TRPCError with code FORBIDDEN if user doesn't have all permissions.
 * 
 * @param user - The authenticated user
 * @param permissions - Array of required permissions
 * @param customMessage - Optional custom error message
 * @throws TRPCError with code FORBIDDEN if user doesn't have all permissions
 */
export function requireAllPermissions(
  user: AuthenticatedUser,
  permissions: Permission[],
  customMessage?: string
): void {
  if (!hasAllPermissions(user.role, permissions)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: customMessage || "You don't have all required permissions to perform this action",
    });
  }
}

/**
 * Checks if a user has a specific permission.
 * 
 * @param user - The authenticated user
 * @param permission - The permission to check
 * @returns true if user has the permission, false otherwise
 */
export function userHasPermission(user: AuthenticatedUser, permission: Permission): boolean {
  return hasPermission(user.role, permission);
}

// Export PERMISSIONS for use in procedures
export { PERMISSIONS };
