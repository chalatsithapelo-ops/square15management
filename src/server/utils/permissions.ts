/**
 * Role-Based Access Control (RBAC) System
 * 
 * This module defines all roles, permissions, and access control logic for the application.
 */

import { db } from "~/server/db";

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export const ROLES = {
  // Administrative Roles
  SENIOR_ADMIN: "SENIOR_ADMIN",
  JUNIOR_ADMIN: "JUNIOR_ADMIN",
  MANAGER: "MANAGER",
  
  // Specialized Roles
  TECHNICAL_MANAGER: "TECHNICAL_MANAGER",
  SALES_AGENT: "SALES_AGENT",
  ACCOUNTANT: "ACCOUNTANT",
  SUPERVISOR: "SUPERVISOR",
  
  // Operational Roles
  ARTISAN: "ARTISAN",
  STAFF: "STAFF",
  
  // External Roles
  CUSTOMER: "CUSTOMER",
  PROPERTY_MANAGER: "PROPERTY_MANAGER",
  CONTRACTOR: "CONTRACTOR",
  CONTRACTOR_SENIOR_MANAGER: "CONTRACTOR_SENIOR_MANAGER",
  CONTRACTOR_JUNIOR_MANAGER: "CONTRACTOR_JUNIOR_MANAGER",
} as const;

export type Role = typeof ROLES[keyof typeof ROLES];

// ============================================================================
// CUSTOM ROLES SUPPORT
// ============================================================================

export interface CustomRole {
  name: string; // Unique identifier (e.g., "PROJECT_COORDINATOR")
  label: string; // Display name (e.g., "Project Coordinator")
  color: string; // Tailwind classes for badge (e.g., "bg-teal-100 text-teal-800")
  description: string; // Role description
  defaultRoute: string; // Default route after login
  permissions: Permission[]; // Array of permissions
}

/**
 * Cache for custom roles loaded from database
 */
let customRolesCache: CustomRole[] | null = null;
let lastCustomRolesCacheUpdate: Date | null = null;

// ============================================================================
// ROLE HIERARCHY
// ============================================================================

/**
 * Role hierarchy levels (higher number = more authority)
 */
export const ROLE_LEVELS: Record<Role, number> = {
  [ROLES.SENIOR_ADMIN]: 100,
  [ROLES.JUNIOR_ADMIN]: 80,
  [ROLES.MANAGER]: 70,
  [ROLES.ACCOUNTANT]: 60,
  [ROLES.TECHNICAL_MANAGER]: 55,
  [ROLES.SUPERVISOR]: 50,
  [ROLES.SALES_AGENT]: 45,
  [ROLES.ARTISAN]: 30,
  [ROLES.STAFF]: 11,
  [ROLES.PROPERTY_MANAGER]: 15,
  [ROLES.CONTRACTOR_SENIOR_MANAGER]: 14,
  [ROLES.CONTRACTOR_JUNIOR_MANAGER]: 13,
  [ROLES.CONTRACTOR]: 12,
  [ROLES.CUSTOMER]: 10,
};

/**
 * Check if a role has equal or higher authority than another role
 */
export function hasRoleLevel(userRole: string, requiredRole: Role): boolean {
  const normalizedRole = userRole === "ADMIN" ? ROLES.JUNIOR_ADMIN : userRole;
  const userLevel = ROLE_LEVELS[normalizedRole as Role] || 0;
  const requiredLevel = ROLE_LEVELS[requiredRole];
  return userLevel >= requiredLevel;
}

// ============================================================================
// PERMISSIONS
// ============================================================================

export const PERMISSIONS = {
  // System Administration
  MANAGE_SYSTEM_SETTINGS: "MANAGE_SYSTEM_SETTINGS",
  MANAGE_COMPANY_SETTINGS: "MANAGE_COMPANY_SETTINGS",
  
  // User Management
  MANAGE_ALL_EMPLOYEES: "MANAGE_ALL_EMPLOYEES",
  VIEW_ALL_EMPLOYEES: "VIEW_ALL_EMPLOYEES",
  // Backward-compatible aliases (older code used these names)
  MANAGE_EMPLOYEES: "MANAGE_ALL_EMPLOYEES",
  VIEW_EMPLOYEES: "VIEW_ALL_EMPLOYEES",
  MANAGE_EMPLOYEE_ROLES: "MANAGE_EMPLOYEE_ROLES",
  MANAGE_EMPLOYEE_COMPENSATION: "MANAGE_EMPLOYEE_COMPENSATION",
  DELETE_EMPLOYEES: "DELETE_EMPLOYEES",
  
  // HR Management
  MANAGE_PERFORMANCE_REVIEWS: "MANAGE_PERFORMANCE_REVIEWS",
  VIEW_PERFORMANCE_REVIEWS: "VIEW_PERFORMANCE_REVIEWS",
  MANAGE_LEAVE_REQUESTS: "MANAGE_LEAVE_REQUESTS",
  VIEW_LEAVE_REQUESTS: "VIEW_LEAVE_REQUESTS",
  MANAGE_HR_DOCUMENTS: "MANAGE_HR_DOCUMENTS",
  VIEW_HR_DOCUMENTS: "VIEW_HR_DOCUMENTS",
  MANAGE_KPI: "MANAGE_KPI",
  VIEW_KPI: "VIEW_KPI",
  VIEW_PAYSLIPS: "VIEW_PAYSLIPS",
  MANAGE_PAYSLIPS: "MANAGE_PAYSLIPS",
  
  // Financial Management
  MANAGE_ACCOUNTS: "MANAGE_ACCOUNTS",
  VIEW_ACCOUNTS: "VIEW_ACCOUNTS",
  MANAGE_LIABILITIES: "MANAGE_LIABILITIES",
  VIEW_LIABILITIES: "VIEW_LIABILITIES",
  MANAGE_ASSETS: "MANAGE_ASSETS",
  VIEW_ASSETS: "VIEW_ASSETS",
  GENERATE_FINANCIAL_REPORTS: "GENERATE_FINANCIAL_REPORTS",
  VIEW_FINANCIAL_REPORTS: "VIEW_FINANCIAL_REPORTS",
  MANAGE_INVOICES: "MANAGE_INVOICES",
  VIEW_INVOICES: "VIEW_INVOICES",
  APPROVE_PAYMENT_REQUESTS: "APPROVE_PAYMENT_REQUESTS",
  VIEW_PAYMENT_REQUESTS: "VIEW_PAYMENT_REQUESTS",
  
  // Project Management
  MANAGE_PROJECTS: "MANAGE_PROJECTS",
  VIEW_ALL_PROJECTS: "VIEW_ALL_PROJECTS",
  VIEW_ASSIGNED_PROJECTS: "VIEW_ASSIGNED_PROJECTS",
  MANAGE_MILESTONES: "MANAGE_MILESTONES",
  VIEW_MILESTONES: "VIEW_MILESTONES",
  APPROVE_CHANGE_ORDERS: "APPROVE_CHANGE_ORDERS",
  
  // Operations
  MANAGE_ORDERS: "MANAGE_ORDERS",
  VIEW_ALL_ORDERS: "VIEW_ALL_ORDERS",
  VIEW_ASSIGNED_ORDERS: "VIEW_ASSIGNED_ORDERS",
  MANAGE_QUOTATIONS: "MANAGE_QUOTATIONS",
  VIEW_QUOTATIONS: "VIEW_QUOTATIONS",
  ASSIGN_WORK: "ASSIGN_WORK",
  
  // CRM & Sales
  MANAGE_LEADS: "MANAGE_LEADS",
  VIEW_ALL_LEADS: "VIEW_ALL_LEADS",
  VIEW_ASSIGNED_LEADS: "VIEW_ASSIGNED_LEADS",
  MANAGE_CAMPAIGNS: "MANAGE_CAMPAIGNS",
  VIEW_CAMPAIGNS: "VIEW_CAMPAIGNS",
  
  // Analytics & Reports
  VIEW_DASHBOARD_ANALYTICS: "VIEW_DASHBOARD_ANALYTICS",
  VIEW_SALES_ANALYTICS: "VIEW_SALES_ANALYTICS",
  VIEW_EMPLOYEE_ANALYTICS: "VIEW_EMPLOYEE_ANALYTICS",
  CUSTOMIZE_DASHBOARD: "CUSTOMIZE_DASHBOARD",
  
  // Customer Features
  VIEW_OWN_ORDERS: "VIEW_OWN_ORDERS",
  CREATE_REVIEWS: "CREATE_REVIEWS",
  VIEW_OWN_INVOICES: "VIEW_OWN_INVOICES",
  
  // Property Manager Features
  MANAGE_PM_RFQS: "MANAGE_PM_RFQS",
  VIEW_PM_RFQS: "VIEW_PM_RFQS",
  MANAGE_PM_ORDERS: "MANAGE_PM_ORDERS",
  VIEW_PM_ORDERS: "VIEW_PM_ORDERS",
  APPROVE_PM_INVOICES: "APPROVE_PM_INVOICES",
  VIEW_PM_INVOICES: "VIEW_PM_INVOICES",
  MANAGE_PM_CUSTOMERS: "MANAGE_PM_CUSTOMERS",
  VIEW_PM_CUSTOMERS: "VIEW_PM_CUSTOMERS",
  MANAGE_PM_BUILDINGS: "MANAGE_PM_BUILDINGS",
  VIEW_PM_BUILDINGS: "VIEW_PM_BUILDINGS",
  MANAGE_PM_BUDGETS: "MANAGE_PM_BUDGETS",
  VIEW_PM_BUDGETS: "VIEW_PM_BUDGETS",
  MANAGE_MAINTENANCE_SCHEDULES: "MANAGE_MAINTENANCE_SCHEDULES",
  VIEW_MAINTENANCE_SCHEDULES: "VIEW_MAINTENANCE_SCHEDULES",
  APPROVE_MAINTENANCE_REQUESTS: "APPROVE_MAINTENANCE_REQUESTS",
  VIEW_MAINTENANCE_REQUESTS: "VIEW_MAINTENANCE_REQUESTS",
} as const;

export type Permission = typeof PERMISSIONS[keyof typeof PERMISSIONS];

// ============================================================================
// ROLE-PERMISSION MAPPINGS
// ============================================================================

export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SENIOR_ADMIN]: [
    // Full system access
    PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
    PERMISSIONS.MANAGE_COMPANY_SETTINGS,
    PERMISSIONS.MANAGE_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.MANAGE_EMPLOYEE_ROLES,
    PERMISSIONS.MANAGE_EMPLOYEE_COMPENSATION,
    PERMISSIONS.DELETE_EMPLOYEES,
    PERMISSIONS.MANAGE_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.MANAGE_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.MANAGE_HR_DOCUMENTS,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.MANAGE_KPI,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_PAYSLIPS,
    PERMISSIONS.MANAGE_PAYSLIPS,
    PERMISSIONS.MANAGE_ACCOUNTS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.MANAGE_LIABILITIES,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.MANAGE_ASSETS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.GENERATE_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.APPROVE_PAYMENT_REQUESTS,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.APPROVE_CHANGE_ORDERS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
    PERMISSIONS.CUSTOMIZE_DASHBOARD,
  ],
  
  [ROLES.JUNIOR_ADMIN]: [
    // Most admin features except critical system settings
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_PAYSLIPS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
    PERMISSIONS.CUSTOMIZE_DASHBOARD,
  ],
  
  [ROLES.MANAGER]: [
    // Team and project management focus
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.MANAGE_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.MANAGE_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.MANAGE_KPI,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_PAYSLIPS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.APPROVE_CHANGE_ORDERS,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
  ],
  
  [ROLES.ACCOUNTANT]: [
    // Financial management focus
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_PAYSLIPS,
    PERMISSIONS.MANAGE_PAYSLIPS,
    PERMISSIONS.MANAGE_ACCOUNTS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.MANAGE_LIABILITIES,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.MANAGE_ASSETS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.GENERATE_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.APPROVE_PAYMENT_REQUESTS,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
  ],
  
  [ROLES.TECHNICAL_MANAGER]: [
    // CRM Access
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    
    // Operations Access
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.ASSIGN_WORK,
    
    // Projects Access
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    
    // Quotations Access
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    
    // Invoices Access
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    
    // Note: Removed VIEW_FINANCIAL_REPORTS to restrict access to Management Accounts
    // Note: Does not have VIEW_DASHBOARD_ANALYTICS, VIEW_ASSETS, VIEW_LIABILITIES,
    //       VIEW_PAYMENT_REQUESTS, VIEW_ALL_EMPLOYEES, or MANAGE_SYSTEM_SETTINGS
  ],
  
  [ROLES.SUPERVISOR]: [
    // Operational oversight
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
  ],
  
  [ROLES.SALES_AGENT]: [
    // Access: CRM, Messages, Operations, Projects, Quotations, Invoices, Statements
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
  ],
  
  [ROLES.ARTISAN]: [
    // Field worker access
    PERMISSIONS.VIEW_ASSIGNED_PROJECTS,
    PERMISSIONS.VIEW_ASSIGNED_ORDERS,
    PERMISSIONS.VIEW_MILESTONES,
    PERMISSIONS.VIEW_ASSIGNED_LEADS,
    PERMISSIONS.VIEW_PAYSLIPS,
  ],
  
  [ROLES.CUSTOMER]: [
    // Tenant portal access
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.CREATE_REVIEWS,
    PERMISSIONS.VIEW_OWN_INVOICES,
  ],
  
  [ROLES.PROPERTY_MANAGER]: [
    // Property Manager RFQ Management
    PERMISSIONS.MANAGE_PM_RFQS,
    PERMISSIONS.VIEW_PM_RFQS,
    
    // Property Manager Order Management
    PERMISSIONS.MANAGE_PM_ORDERS,
    PERMISSIONS.VIEW_PM_ORDERS,
    
    // Property Manager Invoice Management
    PERMISSIONS.APPROVE_PM_INVOICES,
    PERMISSIONS.VIEW_PM_INVOICES,
    
    // Customer/Tenant Management
    PERMISSIONS.MANAGE_PM_CUSTOMERS,
    PERMISSIONS.VIEW_PM_CUSTOMERS,
    
    // Building Management
    PERMISSIONS.MANAGE_PM_BUILDINGS,
    PERMISSIONS.VIEW_PM_BUILDINGS,
    
    // Budget Management
    PERMISSIONS.MANAGE_PM_BUDGETS,
    PERMISSIONS.VIEW_PM_BUDGETS,
    
    // Maintenance Management
    PERMISSIONS.MANAGE_MAINTENANCE_SCHEDULES,
    PERMISSIONS.VIEW_MAINTENANCE_SCHEDULES,
    PERMISSIONS.APPROVE_MAINTENANCE_REQUESTS,
    PERMISSIONS.VIEW_MAINTENANCE_REQUESTS,
    
    // Basic features
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.CREATE_REVIEWS,
  ],
  
  [ROLES.CONTRACTOR]: [
    // Contractor Company Management - Full business operations
    
    // CRM & Sales
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    
    // Operations & Work Management
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    
    // Project Management
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    
    // Financial Management
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    
    // HR & Employee Management
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.MANAGE_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.MANAGE_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.MANAGE_KPI,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.VIEW_PAYSLIPS,
    
    // Analytics & Reporting
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
    
    // System Access
    PERMISSIONS.CUSTOMIZE_DASHBOARD,
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.CREATE_REVIEWS,
  ],
  
  [ROLES.CONTRACTOR_SENIOR_MANAGER]: [
    // Senior Manager - Full contractor portal authority
    // All CONTRACTOR permissions plus full employee management
    
    // CRM & Sales
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    
    // Operations & Work Management
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    
    // Project Management
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    
    // Financial Management
    PERMISSIONS.MANAGE_INVOICES,
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    
    // Full HR & Employee Management Authority
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.MANAGE_EMPLOYEES,
    PERMISSIONS.DELETE_EMPLOYEES,
    PERMISSIONS.MANAGE_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.MANAGE_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.MANAGE_KPI,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.VIEW_PAYSLIPS,
    
    // Analytics & Reporting
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
    
    // System Access
    PERMISSIONS.CUSTOMIZE_DASHBOARD,
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.CREATE_REVIEWS,
  ],
  
  [ROLES.CONTRACTOR_JUNIOR_MANAGER]: [
    // Junior Manager - Most contractor permissions, limited HR authority
    
    // CRM & Sales
    PERMISSIONS.MANAGE_LEADS,
    PERMISSIONS.VIEW_ALL_LEADS,
    PERMISSIONS.MANAGE_CAMPAIGNS,
    PERMISSIONS.VIEW_CAMPAIGNS,
    
    // Operations & Work Management
    PERMISSIONS.MANAGE_ORDERS,
    PERMISSIONS.VIEW_ALL_ORDERS,
    PERMISSIONS.MANAGE_QUOTATIONS,
    PERMISSIONS.VIEW_QUOTATIONS,
    PERMISSIONS.ASSIGN_WORK,
    
    // Project Management
    PERMISSIONS.MANAGE_PROJECTS,
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    PERMISSIONS.VIEW_MILESTONES,
    
    // Financial Management (view only for junior manager)
    PERMISSIONS.VIEW_INVOICES,
    PERMISSIONS.VIEW_FINANCIAL_REPORTS,
    PERMISSIONS.VIEW_ACCOUNTS,
    PERMISSIONS.VIEW_ASSETS,
    PERMISSIONS.VIEW_LIABILITIES,
    PERMISSIONS.VIEW_PAYMENT_REQUESTS,
    
    // Limited HR Management
    PERMISSIONS.VIEW_ALL_EMPLOYEES,
    PERMISSIONS.MANAGE_PERFORMANCE_REVIEWS,
    PERMISSIONS.VIEW_PERFORMANCE_REVIEWS,
    PERMISSIONS.MANAGE_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_LEAVE_REQUESTS,
    PERMISSIONS.VIEW_KPI,
    PERMISSIONS.VIEW_HR_DOCUMENTS,
    PERMISSIONS.VIEW_PAYSLIPS,
    
    // Analytics & Reporting
    PERMISSIONS.VIEW_DASHBOARD_ANALYTICS,
    PERMISSIONS.VIEW_SALES_ANALYTICS,
    PERMISSIONS.VIEW_EMPLOYEE_ANALYTICS,
    
    // System Access
    PERMISSIONS.CUSTOMIZE_DASHBOARD,
    PERMISSIONS.VIEW_OWN_ORDERS,
    PERMISSIONS.CREATE_REVIEWS,
  ],
};

// ============================================================================
// DYNAMIC PERMISSIONS LOADING
// ============================================================================

/**
 * Cache for dynamic role permissions loaded from database
 * This is refreshed when permissions are updated
 */
let dynamicRolePermissionsCache: Record<Role, Permission[]> | null = null;
let lastCacheUpdate: Date | null = null;

/**
 * Load role permissions from database (SystemSettings)
 * Falls back to static ROLE_PERMISSIONS if no dynamic config exists
 */
export async function loadDynamicRolePermissions(): Promise<Record<Role, Permission[]>> {
  try {
    const setting = await db.systemSettings.findUnique({
      where: { key: "role_permissions_config" },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      dynamicRolePermissionsCache = parsed;
      lastCacheUpdate = new Date();
      return parsed;
    }
  } catch (error) {
    console.error("Error loading dynamic role permissions:", error);
  }

  // Fallback to static configuration
  return ROLE_PERMISSIONS;
}

/**
 * Get current role permissions (dynamic if available, otherwise static)
 * Uses cache to avoid repeated database queries
 * Includes custom roles
 */
export async function getCurrentRolePermissions(): Promise<Record<string, Permission[]>> {
  // Use cache if it exists and is less than 5 minutes old
  if (dynamicRolePermissionsCache && lastCacheUpdate) {
    const cacheAge = Date.now() - lastCacheUpdate.getTime();
    if (cacheAge < 5 * 60 * 1000) {
      // Merge with custom roles
      const customRoles = await getCustomRoles();
      const customRolePermissions: Record<string, Permission[]> = {};
      customRoles.forEach(role => {
        customRolePermissions[role.name] = role.permissions;
      });
      
      return {
        ...dynamicRolePermissionsCache,
        ...customRolePermissions,
      };
    }
  }

  const basePermissions = await loadDynamicRolePermissions();
  
  // Merge with custom roles
  const customRoles = await getCustomRoles();
  const customRolePermissions: Record<string, Permission[]> = {};
  customRoles.forEach(role => {
    customRolePermissions[role.name] = role.permissions;
  });
  
  return {
    ...basePermissions,
    ...customRolePermissions,
  };
}

/**
 * Clear the dynamic permissions cache
 * Should be called after updating permissions
 */
export function clearPermissionsCache(): void {
  dynamicRolePermissionsCache = null;
  lastCacheUpdate = null;
}

/**
 * Get the static (default) role permissions
 * Useful for resetting to defaults or comparing with current config
 */
export function getStaticRolePermissions(): Record<Role, Permission[]> {
  return ROLE_PERMISSIONS;
}

/**
 * Load custom roles from database (SystemSettings)
 * Returns empty array if no custom roles exist
 */
export async function loadCustomRoles(): Promise<CustomRole[]> {
  try {
    const setting = await db.systemSettings.findUnique({
      where: { key: "custom_roles_config" },
    });

    if (setting && setting.value) {
      const parsed = JSON.parse(setting.value);
      customRolesCache = Array.isArray(parsed) ? parsed : [];
      lastCustomRolesCacheUpdate = new Date();
      return customRolesCache;
    }
  } catch (error) {
    console.error("Error loading custom roles:", error);
  }

  return [];
}

/**
 * Get current custom roles (uses cache to avoid repeated database queries)
 */
export async function getCustomRoles(): Promise<CustomRole[]> {
  // Use cache if it exists and is less than 5 minutes old
  if (customRolesCache && lastCustomRolesCacheUpdate) {
    const cacheAge = Date.now() - lastCustomRolesCacheUpdate.getTime();
    if (cacheAge < 5 * 60 * 1000) {
      return customRolesCache;
    }
  }

  return await loadCustomRoles();
}

/**
 * Clear the custom roles cache
 * Should be called after creating, updating, or deleting custom roles
 */
export function clearCustomRolesCache(): void {
  customRolesCache = null;
  lastCustomRolesCacheUpdate = null;
}

/**
 * Check if a role is a custom role
 */
export function isBuiltInRole(role: string): boolean {
  return Object.values(ROLES).includes(role as Role);
}

/**
 * Check if a role is a custom role
 */
export function isCustomRole(role: string): boolean {
  return !isBuiltInRole(role);
}

/**
 * Get all roles (built-in + custom) as an array of strings
 */
export async function getAllRolesAsync(): Promise<string[]> {
  const customRoles = await getCustomRoles();
  const customRoleNames = customRoles.map(r => r.name);
  return [...ALL_ROLES, ...customRoleNames];
}

/**
 * Get metadata for a custom role
 */
export async function getCustomRoleMetadata(roleName: string): Promise<RoleMetadata | null> {
  const customRoles = await getCustomRoles();
  const customRole = customRoles.find(r => r.name === roleName);
  
  if (!customRole) return null;
  
  return {
    label: customRole.label,
    color: customRole.color,
    description: customRole.description,
    defaultRoute: customRole.defaultRoute,
  };
}

/**
 * Get all role metadata (built-in + custom)
 */
export async function getAllRoleMetadata(): Promise<Record<string, RoleMetadata>> {
  const customRoles = await getCustomRoles();
  const customMetadata: Record<string, RoleMetadata> = {};
  
  customRoles.forEach(role => {
    // Never allow custom roles to override built-in roles.
    // This prevents UI regressions like JUNIOR_ADMIN showing the wrong label.
    if (isBuiltInRole(role.name)) return;
    customMetadata[role.name] = {
      label: role.label,
      color: role.color,
      description: role.description,
      defaultRoute: role.defaultRoute,
    };
  });
  
  return {
    ...ROLE_METADATA,
    ...customMetadata,
  };
}

/**
 * Validate that a role exists (built-in or custom)
 */
export async function isValidRole(role: string): Promise<boolean> {
  if (isBuiltInRole(role)) return true;
  
  const customRoles = await getCustomRoles();
  return customRoles.some(r => r.name === role);
}

/**
 * Get permissions for a custom role
 */
export async function getCustomRolePermissions(roleName: string): Promise<Permission[]> {
  const customRoles = await getCustomRoles();
  const customRole = customRoles.find(r => r.name === roleName);
  return customRole?.permissions || [];
}

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if a user has a specific permission
 * Uses dynamic permissions if available, otherwise falls back to static
 */
export async function hasPermissionAsync(userRole: string, permission: Permission): Promise<boolean> {
  const rolePermissions = await getCurrentRolePermissions();
  const permissions = rolePermissions[userRole as Role];
  if (!permissions) return false;
  return permissions.includes(permission);
}

/**
 * Check if a user has a specific permission (synchronous version using static config)
 * This is kept for backward compatibility but should be replaced with async version
 * @deprecated Use hasPermissionAsync for dynamic permissions support
 */
export function hasPermission(userRole: string, permission: Permission): boolean {
  const rolePermissions = ROLE_PERMISSIONS[userRole as Role];
  if (!rolePermissions) return false;
  return rolePermissions.includes(permission);
}

/**
 * Check if a user has any of the specified permissions
 */
export function hasAnyPermission(userRole: string, permissions: Permission[]): boolean {
  return permissions.some(permission => hasPermission(userRole, permission));
}

/**
 * Check if a user has all of the specified permissions
 */
export function hasAllPermissions(userRole: string, permissions: Permission[]): boolean {
  return permissions.every(permission => hasPermission(userRole, permission));
}

/**
 * Get all permissions for a role
 */
export function getRolePermissions(role: string): Permission[] {
  return ROLE_PERMISSIONS[role as Role] || [];
}

/**
 * Check if a user has any of the specified permissions (async)
 */
export async function hasAnyPermissionAsync(userRole: string, permissions: Permission[]): Promise<boolean> {
  for (const permission of permissions) {
    if (await hasPermissionAsync(userRole, permission)) {
      return true;
    }
  }
  return false;
}

/**
 * Check if a user has all of the specified permissions (async)
 */
export async function hasAllPermissionsAsync(userRole: string, permissions: Permission[]): Promise<boolean> {
  for (const permission of permissions) {
    if (!(await hasPermissionAsync(userRole, permission))) {
      return false;
    }
  }
  return true;
}

/**
 * Get all permissions for a role (async, uses dynamic config + custom roles)
 */
export async function getRolePermissionsAsync(role: string): Promise<Permission[]> {
  const rolePermissions = await getCurrentRolePermissions();
  return rolePermissions[role] || [];
}

// ============================================================================
// ROLE METADATA
// ============================================================================

export interface RoleMetadata {
  label: string;
  color: string;
  description: string;
  defaultRoute: string;
}

export const ROLE_METADATA: Record<Role, RoleMetadata> = {
  [ROLES.SENIOR_ADMIN]: {
    label: "Senior Admin",
    color: "bg-purple-100 text-purple-800",
    description: "Full system access with ability to manage settings, users, and all features",
    defaultRoute: "/admin/dashboard",
  },
  [ROLES.JUNIOR_ADMIN]: {
    label: "Junior Admin",
    color: "bg-blue-100 text-blue-800",
    description: "Administrative access to most features except critical system settings",
    defaultRoute: "/admin/dashboard",
  },
  [ROLES.MANAGER]: {
    label: "Manager",
    color: "bg-indigo-100 text-indigo-800",
    description: "Team and project management with HR and operational oversight",
    defaultRoute: "/admin/dashboard",
  },
  [ROLES.ACCOUNTANT]: {
    label: "Accountant",
    color: "bg-emerald-100 text-emerald-800",
    description: "Financial management including accounts, invoices, and payment approvals",
    defaultRoute: "/admin/accounts",
  },
  [ROLES.TECHNICAL_MANAGER]: {
    label: "Technical Manager",
    color: "bg-orange-100 text-orange-800",
    description: "Manages operational execution, project delivery, and quality control",
    defaultRoute: "/admin/operations",
  },
  [ROLES.SUPERVISOR]: {
    label: "Supervisor",
    color: "bg-cyan-100 text-cyan-800",
    description: "Operational oversight with ability to manage orders, quotations, and leads",
    defaultRoute: "/admin/operations",
  },
  [ROLES.SALES_AGENT]: {
    label: "Sales Agent",
    color: "bg-pink-100 text-pink-800",
    description: "Focuses on lead conversion, quotation management, and sales analytics",
    defaultRoute: "/admin/crm",
  },
  [ROLES.ARTISAN]: {
    label: "Artisan",
    color: "bg-green-100 text-green-800",
    description: "Field worker with access to assigned jobs and projects",
    defaultRoute: "/artisan/dashboard",
  },
  [ROLES.STAFF]: {
    label: "Staff",
    color: "bg-lime-100 text-lime-800",
    description: "Property management staff with access to assigned tasks and property maintenance",
    defaultRoute: "/staff/dashboard",
  },
  [ROLES.CUSTOMER]: {
    label: "Tenant",
    color: "bg-gray-100 text-gray-800",
    description: "Tenant portal access to view orders and invoices",
    defaultRoute: "/customer/dashboard",
  },
  [ROLES.PROPERTY_MANAGER]: {
    label: "Property Manager",
    color: "bg-teal-100 text-teal-800",
    description: "Manages properties, tenants, budgets, and maintenance requests with ability to request quotes and issue orders",
    defaultRoute: "/property-manager/dashboard",
  },
  [ROLES.CONTRACTOR]: {
    label: "Contractor",
    color: "bg-amber-100 text-amber-800",
    description: "External contractor with access to assigned jobs, invoices, performance metrics, and documents",
    defaultRoute: "/contractor/dashboard",
  },
  [ROLES.CONTRACTOR_SENIOR_MANAGER]: {
    label: "Senior Manager",
    color: "bg-purple-100 text-purple-800",
    description: "Contractor senior manager with full authority over contractor portal operations, invoices, quotations, and employee management",
    defaultRoute: "/contractor/dashboard",
  },
  [ROLES.CONTRACTOR_JUNIOR_MANAGER]: {
    label: "Junior Manager",
    color: "bg-blue-100 text-blue-800",
    description: "Contractor junior manager with operational oversight, limited financial authority, and HR management capabilities",
    defaultRoute: "/contractor/dashboard",
  },
};

/**
 * Get role label for display
 */
export function getRoleLabel(role: string): string {
  return ROLE_METADATA[role as Role]?.label || role.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Get role color for badges
 */
export function getRoleColor(role: string): string {
  return ROLE_METADATA[role as Role]?.color || "bg-orange-100 text-orange-800";
}

/**
 * Get role description
 */
export function getRoleDescription(role: string): string {
  return ROLE_METADATA[role as Role]?.description || "Custom role";
}

/**
 * Get default route for role
 */
export function getDefaultRoute(role: string): string {
  return ROLE_METADATA[role as Role]?.defaultRoute || "/customer/dashboard";
}

/**
 * Get role label for display (async version that supports custom roles)
 */
export async function getRoleLabelAsync(role: string): Promise<string> {
  // Check built-in roles first
  if (ROLE_METADATA[role as Role]) {
    return ROLE_METADATA[role as Role].label;
  }
  
  // Check custom roles
  const customRoleMetadata = await getCustomRoleMetadata(role);
  if (customRoleMetadata) {
    return customRoleMetadata.label;
  }
  
  // Fallback to formatted role name
  return role.split('_').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

/**
 * Get role color for badges (async version that supports custom roles)
 */
export async function getRoleColorAsync(role: string): Promise<string> {
  // Check built-in roles first
  if (ROLE_METADATA[role as Role]) {
    return ROLE_METADATA[role as Role].color;
  }
  
  // Check custom roles
  const customRoleMetadata = await getCustomRoleMetadata(role);
  if (customRoleMetadata) {
    return customRoleMetadata.color;
  }
  
  // Fallback
  return "bg-orange-100 text-orange-800";
}

/**
 * Get role description (async version that supports custom roles)
 */
export async function getRoleDescriptionAsync(role: string): Promise<string> {
  // Check built-in roles first
  if (ROLE_METADATA[role as Role]) {
    return ROLE_METADATA[role as Role].description;
  }
  
  // Check custom roles
  const customRoleMetadata = await getCustomRoleMetadata(role);
  if (customRoleMetadata) {
    return customRoleMetadata.description;
  }
  
  return "Custom role";
}

/**
 * Get default route for role (async version that supports custom roles)
 */
export async function getDefaultRouteAsync(role: string): Promise<string> {
  // Check built-in roles first
  if (ROLE_METADATA[role as Role]) {
    return ROLE_METADATA[role as Role].defaultRoute;
  }
  
  // Check custom roles
  const customRoleMetadata = await getCustomRoleMetadata(role);
  if (customRoleMetadata) {
    return customRoleMetadata.defaultRoute;
  }
  
  return "/customer/dashboard";
}

// ============================================================================
// COMMON ROLE CHECKS
// ============================================================================

/**
 * Check if user is any type of admin
 */
export function isAdmin(role: string): boolean {
  return hasRoleLevel(role, ROLES.JUNIOR_ADMIN);
}

/**
 * Check if user is senior admin
 */
export function isSeniorAdmin(role: string): boolean {
  return role === ROLES.SENIOR_ADMIN;
}

/**
 * Check if user is manager or higher
 */
export function isManagerOrHigher(role: string): boolean {
  return hasRoleLevel(role, ROLES.MANAGER);
}

/**
 * Check if user can manage employees
 */
export function canManageEmployees(role: string): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_ALL_EMPLOYEES);
}

/**
 * Check if user can view financial data
 */
export function canViewFinancials(role: string): boolean {
  return hasPermission(role, PERMISSIONS.VIEW_ACCOUNTS);
}

/**
 * Check if user can manage projects
 */
export function canManageProjects(role: string): boolean {
  return hasPermission(role, PERMISSIONS.MANAGE_PROJECTS);
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
    ROLES.ACCOUNTANT,
    ROLES.SALES_AGENT,
    ROLES.SUPERVISOR,
    ROLES.ARTISAN,
    ROLES.PROPERTY_MANAGER,
  ];
}

// Export static configuration for admin interface
export { ROLE_PERMISSIONS as STATIC_ROLE_PERMISSIONS };
export const ALL_PERMISSIONS = Object.values(PERMISSIONS);
export const ALL_ROLES = Object.values(ROLES);
