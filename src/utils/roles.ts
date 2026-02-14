/**
 * Client-side role utilities
 * 
 * This module provides role-related utilities for client components
 * without importing server-side code.
 * 
 * NOTE: Custom roles are supported. When displaying role information,
 * use the roleMetadata from getRolePermissionConfig tRPC query to get
 * the most up-to-date role information including custom roles.
 */

export const ROLES = {
  // Legacy admin role (backwards compatibility)
  ADMIN: "ADMIN",
  SENIOR_ADMIN: "SENIOR_ADMIN",
  JUNIOR_ADMIN: "JUNIOR_ADMIN",
  MANAGER: "MANAGER",
  TECHNICAL_MANAGER: "TECHNICAL_MANAGER",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  SALES_AGENT: "SALES_AGENT",
  ACCOUNTANT: "ACCOUNTANT",
  SUPERVISOR: "SUPERVISOR",
  ARTISAN: "ARTISAN",
  CUSTOMER: "CUSTOMER",
  CONTRACTOR: "CONTRACTOR",
  CONTRACTOR_SENIOR_MANAGER: "CONTRACTOR_SENIOR_MANAGER",
  CONTRACTOR_JUNIOR_MANAGER: "CONTRACTOR_JUNIOR_MANAGER",
  STAFF: "STAFF",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

/**
 * Default routes for each role
 */
const ROLE_DEFAULT_ROUTES: Record<Role, string> = {
  [ROLES.ADMIN]: "/admin/dashboard",
  [ROLES.SENIOR_ADMIN]: "/admin/dashboard",
  [ROLES.JUNIOR_ADMIN]: "/admin/dashboard",
  [ROLES.MANAGER]: "/admin/dashboard",
  [ROLES.ACCOUNTANT]: "/admin/accounts",
  [ROLES.TECHNICAL_MANAGER]: "/admin/dashboard",
  [ROLES.PROPERTY_MANAGER]: "/property-manager/dashboard",
  [ROLES.SUPERVISOR]: "/admin/operations",
  [ROLES.SALES_AGENT]: "/admin/crm",
  [ROLES.ARTISAN]: "/artisan/dashboard",
  [ROLES.CUSTOMER]: "/customer/dashboard",
  [ROLES.CONTRACTOR]: "/contractor/dashboard",
  [ROLES.CONTRACTOR_SENIOR_MANAGER]: "/contractor/dashboard",
  [ROLES.CONTRACTOR_JUNIOR_MANAGER]: "/contractor/dashboard",
  [ROLES.STAFF]: "/staff/dashboard",
};

/**
 * Get default route for a user role
 */
export function getDefaultRoute(role: string): string {
  return ROLE_DEFAULT_ROUTES[role as Role] || "/customer/dashboard";
}

/**
 * Get role label for display
 */
export function getRoleLabel(role: string): string {
  const labels: Record<Role, string> = {
    [ROLES.ADMIN]: "Admin",
    [ROLES.SENIOR_ADMIN]: "Senior Admin",
    [ROLES.JUNIOR_ADMIN]: "Junior Admin",
    [ROLES.MANAGER]: "Manager",
    [ROLES.ACCOUNTANT]: "Accountant",
    [ROLES.TECHNICAL_MANAGER]: "Technical Manager",
    [ROLES.PROPERTY_MANAGER]: "Property Manager",
    [ROLES.SUPERVISOR]: "Supervisor",
    [ROLES.SALES_AGENT]: "Sales Agent",
    [ROLES.ARTISAN]: "Artisan",
    [ROLES.CUSTOMER]: "Customer",
    [ROLES.CONTRACTOR]: "Contractor",
    [ROLES.CONTRACTOR_SENIOR_MANAGER]: "Senior Manager",
    [ROLES.CONTRACTOR_JUNIOR_MANAGER]: "Junior Manager",
    [ROLES.STAFF]: "Staff",
  };
  
  return labels[role as Role] || role.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Get role color for badges
 */
export function getRoleColor(role: string): string {
  const colors: Record<Role, string> = {
    [ROLES.ADMIN]: "bg-blue-100 text-blue-800",
    [ROLES.SENIOR_ADMIN]: "bg-purple-100 text-purple-800",
    [ROLES.JUNIOR_ADMIN]: "bg-blue-100 text-blue-800",
    [ROLES.MANAGER]: "bg-indigo-100 text-indigo-800",
    [ROLES.ACCOUNTANT]: "bg-emerald-100 text-emerald-800",
    [ROLES.TECHNICAL_MANAGER]: "bg-orange-100 text-orange-800",
    [ROLES.PROPERTY_MANAGER]: "bg-teal-100 text-teal-800",
    [ROLES.SUPERVISOR]: "bg-cyan-100 text-cyan-800",
    [ROLES.SALES_AGENT]: "bg-pink-100 text-pink-800",
    [ROLES.ARTISAN]: "bg-green-100 text-green-800",
    [ROLES.CUSTOMER]: "bg-gray-100 text-gray-800",
    [ROLES.CONTRACTOR]: "bg-amber-100 text-amber-800",
    [ROLES.CONTRACTOR_SENIOR_MANAGER]: "bg-purple-100 text-purple-800",
    [ROLES.CONTRACTOR_JUNIOR_MANAGER]: "bg-blue-100 text-blue-800",
    [ROLES.STAFF]: "bg-lime-100 text-lime-800",
  };
  
  return colors[role as Role] || "bg-orange-100 text-orange-800";
}

/**
 * Get all available roles for selection (excludes customer)
 */
export function getSelectableRoles(): Role[] {
  return [
    ROLES.SENIOR_ADMIN,
    ROLES.JUNIOR_ADMIN,
    ROLES.MANAGER,
    ROLES.TECHNICAL_MANAGER,
    ROLES.PROPERTY_MANAGER,
    ROLES.ACCOUNTANT,
    ROLES.SALES_AGENT,
    ROLES.SUPERVISOR,
    ROLES.ARTISAN,
  ];
}

/**
 * Check if user has contractor portal access
 * Includes all contractor-related roles
 */
export function isContractorRole(role: string): boolean {
  return role === ROLES.CONTRACTOR || 
         role === ROLES.CONTRACTOR_SENIOR_MANAGER || 
         role === ROLES.CONTRACTOR_JUNIOR_MANAGER;
}

/**
 * Check if user is a contractor senior manager
 */
export function isContractorSeniorManager(role: string): boolean {
  return role === ROLES.CONTRACTOR_SENIOR_MANAGER;
}

/**
 * Check if user is a contractor manager (senior or junior)
 */
export function isContractorManager(role: string): boolean {
  return role === ROLES.CONTRACTOR_SENIOR_MANAGER || 
         role === ROLES.CONTRACTOR_JUNIOR_MANAGER;
}
