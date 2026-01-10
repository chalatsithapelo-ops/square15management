# Access Control System Guide

## Overview

This application implements a comprehensive Role-Based Access Control (RBAC) system that provides granular control over what features and data different types of employees can access. The system is designed to be flexible, maintainable, and easy to extend.

## System Architecture

The access control system consists of three main components:

1. **Roles** - Define user types (e.g., Admin, Manager, Accountant)
2. **Permissions** - Define specific actions or data access rights
3. **Role-Permission Mappings** - Define which permissions each role has

All access control logic is centralized in `src/server/utils/permissions.ts` and `src/server/utils/auth.ts`.

## Available Roles

The system defines the following roles, listed in order of authority (highest to lowest):

### 1. Senior Admin (`SENIOR_ADMIN`)
- **Authority Level**: 100
- **Default Route**: `/admin/dashboard`
- **Description**: Full system access with ability to manage settings, users, and all features
- **Key Capabilities**:
  - Manage system settings and company configuration
  - Manage all employees including roles and compensation
  - Full access to all financial, operational, and HR features
  - Can perform any action in the system

### 2. Junior Admin (`JUNIOR_ADMIN`)
- **Authority Level**: 80
- **Default Route**: `/admin/dashboard`
- **Description**: Administrative access to most features except critical system settings
- **Key Capabilities**:
  - View all employees and HR data
  - Manage projects, orders, quotations, and invoices
  - View financial reports and accounts
  - Manage leads and campaigns
  - Cannot change system settings or manage employee roles/compensation

### 3. Manager (`MANAGER`)
- **Authority Level**: 70
- **Default Route**: `/admin/dashboard`
- **Description**: Team and project management with HR and operational oversight
- **Key Capabilities**:
  - Manage performance reviews and leave requests
  - Manage projects, milestones, and change orders
  - Assign work to artisans
  - View financial reports (but cannot manage accounts)
  - Manage leads and view campaigns

### 4. Accountant (`ACCOUNTANT`)
- **Authority Level**: 60
- **Default Route**: `/admin/accounts`
- **Description**: Financial management including accounts, invoices, and payment approvals
- **Key Capabilities**:
  - Full access to accounts, assets, and liabilities
  - Generate and view financial reports
  - Manage invoices and approve payment requests
  - View projects and orders (for financial tracking)
  - Cannot manage employees or operational aspects

### 5. Supervisor (`SUPERVISOR`)
- **Authority Level**: 50
- **Default Route**: `/admin/operations`
- **Description**: Operational oversight with ability to manage orders, quotations, and leads
- **Key Capabilities**:
  - Manage orders, quotations, and leads
  - Assign work to artisans
  - View projects and milestones
  - View employee lists and KPIs
  - Limited HR and financial access

### 6. Artisan (`ARTISAN`)
- **Authority Level**: 30
- **Default Route**: `/artisan/dashboard`
- **Description**: Field worker with access to assigned jobs and projects
- **Key Capabilities**:
  - View and work on assigned orders and projects
  - View assigned milestones
  - Submit progress updates and expense slips
  - View own performance metrics

### 7. Customer (`CUSTOMER`)
- **Authority Level**: 10
- **Default Route**: `/customer/dashboard`
- **Description**: Customer portal access to view orders and invoices
- **Key Capabilities**:
  - View own orders and their status
  - View own invoices and statements
  - Submit reviews for completed work
  - Communicate with the company

## Permission Categories

Permissions are organized into the following categories:

### System Administration
- `MANAGE_SYSTEM_SETTINGS` - Configure system-wide settings
- `MANAGE_COMPANY_SETTINGS` - Update company information and branding

### User Management
- `MANAGE_ALL_EMPLOYEES` - Create, update, and delete employees
- `VIEW_ALL_EMPLOYEES` - View employee information
- `MANAGE_EMPLOYEE_ROLES` - Change employee roles
- `MANAGE_EMPLOYEE_COMPENSATION` - Update hourly/daily rates

### HR Management
- `MANAGE_PERFORMANCE_REVIEWS` - Conduct and edit performance reviews
- `VIEW_PERFORMANCE_REVIEWS` - View performance review data
- `MANAGE_LEAVE_REQUESTS` - Approve/reject leave requests
- `VIEW_LEAVE_REQUESTS` - View leave request data
- `MANAGE_HR_DOCUMENTS` - Upload and manage HR documents
- `VIEW_HR_DOCUMENTS` - View HR documents
- `MANAGE_KPI` - Set and manage employee KPIs
- `VIEW_KPI` - View employee KPI data

### Financial Management
- `MANAGE_ACCOUNTS` - Full access to accounting features
- `VIEW_ACCOUNTS` - View accounting data
- `MANAGE_LIABILITIES` - Create and update liabilities
- `VIEW_LIABILITIES` - View liability data
- `MANAGE_ASSETS` - Create and update assets
- `VIEW_ASSETS` - View asset data
- `GENERATE_FINANCIAL_REPORTS` - Generate financial reports
- `VIEW_FINANCIAL_REPORTS` - View financial reports
- `MANAGE_INVOICES` - Create and update invoices
- `VIEW_INVOICES` - View invoice data
- `APPROVE_PAYMENT_REQUESTS` - Approve payment requests
- `VIEW_PAYMENT_REQUESTS` - View payment request data

### Project Management
- `MANAGE_PROJECTS` - Create and update projects
- `VIEW_ALL_PROJECTS` - View all projects
- `VIEW_ASSIGNED_PROJECTS` - View only assigned projects
- `MANAGE_MILESTONES` - Create and update milestones
- `VIEW_MILESTONES` - View milestone data
- `APPROVE_CHANGE_ORDERS` - Approve project change orders

### Operations
- `MANAGE_ORDERS` - Create and update orders
- `VIEW_ALL_ORDERS` - View all orders
- `VIEW_ASSIGNED_ORDERS` - View only assigned orders
- `MANAGE_QUOTATIONS` - Create and update quotations
- `VIEW_QUOTATIONS` - View quotation data
- `ASSIGN_WORK` - Assign work to artisans

### CRM & Sales
- `MANAGE_LEADS` - Create and update leads
- `VIEW_ALL_LEADS` - View all leads
- `VIEW_ASSIGNED_LEADS` - View only assigned leads
- `MANAGE_CAMPAIGNS` - Create and send campaigns
- `VIEW_CAMPAIGNS` - View campaign data

### Analytics & Reports
- `VIEW_DASHBOARD_ANALYTICS` - View dashboard analytics
- `VIEW_SALES_ANALYTICS` - View sales performance data
- `VIEW_EMPLOYEE_ANALYTICS` - View employee performance data
- `CUSTOMIZE_DASHBOARD` - Customize dashboard layout

### Customer Features
- `VIEW_OWN_ORDERS` - View own orders (customers)
- `CREATE_REVIEWS` - Submit reviews (customers)
- `VIEW_OWN_INVOICES` - View own invoices (customers)

## Using Access Control in Backend Procedures

### Basic Permission Check

```typescript
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const someProtectedProcedure = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Require a specific permission
    requirePermission(user, PERMISSIONS.VIEW_ALL_EMPLOYEES);
    
    // Your logic here...
  });
```

### Multiple Permission Options

```typescript
import { authenticateUser, requireAnyPermission, PERMISSIONS } from "~/server/utils/auth";

export const viewSomeData = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // User needs at least one of these permissions
    requireAnyPermission(user, [
      PERMISSIONS.MANAGE_PROJECTS,
      PERMISSIONS.VIEW_ALL_PROJECTS,
    ]);
    
    // Your logic here...
  });
```

### All Permissions Required

```typescript
import { authenticateUser, requireAllPermissions, PERMISSIONS } from "~/server/utils/auth";

export const criticalAction = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // User must have ALL of these permissions
    requireAllPermissions(user, [
      PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
      PERMISSIONS.MANAGE_COMPANY_SETTINGS,
    ]);
    
    // Your logic here...
  });
```

### Role-Based Checks

```typescript
import { authenticateUser, requireSeniorAdmin, isManager } from "~/server/utils/auth";

export const settingsUpdate = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Only senior admins can access
    requireSeniorAdmin(user);
    
    // Or check role level
    if (isManager(user)) {
      // Manager-specific logic
    }
    
    // Your logic here...
  });
```

### Conditional Logic Based on Permissions

```typescript
import { authenticateUser, userHasPermission, PERMISSIONS } from "~/server/utils/auth";

export const getProjects = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    
    // Different behavior based on permissions
    if (userHasPermission(user, PERMISSIONS.VIEW_ALL_PROJECTS)) {
      // Return all projects
      return await db.project.findMany();
    } else if (userHasPermission(user, PERMISSIONS.VIEW_ASSIGNED_PROJECTS)) {
      // Return only assigned projects
      return await db.project.findMany({
        where: { assignedToId: user.id }
      });
    } else {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You don't have permission to view projects"
      });
    }
  });
```

## Using Access Control in Frontend Components

### Getting User Permissions

```typescript
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";

function MyComponent() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  
  const permissionsQuery = useQuery(
    trpc.getUserPermissions.queryOptions({
      token: token || "",
    })
  );
  
  const permissions = permissionsQuery.data?.permissions || [];
  
  // Check if user has a permission
  const canManageEmployees = permissions.includes("MANAGE_ALL_EMPLOYEES");
  
  return (
    <div>
      {canManageEmployees && (
        <button>Add Employee</button>
      )}
    </div>
  );
}
```

### Role-Based UI Rendering

```typescript
import { useAuthStore } from "~/stores/auth";
import { isAdmin, isSeniorAdmin, getRoleLabel } from "~/server/utils/permissions";

function Navigation() {
  const { user } = useAuthStore();
  
  if (!user) return null;
  
  return (
    <nav>
      {/* Show to all admin-level users */}
      {isAdmin(user.role) && (
        <Link to="/admin/dashboard">Dashboard</Link>
      )}
      
      {/* Show only to senior admins */}
      {isSeniorAdmin(user.role) && (
        <Link to="/admin/settings">Settings</Link>
      )}
      
      {/* Display user's role */}
      <span>{getRoleLabel(user.role)}</span>
    </nav>
  );
}
```

### Conditional Feature Access

```typescript
import { useAuthStore } from "~/stores/auth";
import { hasPermission, PERMISSIONS } from "~/server/utils/permissions";

function ProjectsList() {
  const { user } = useAuthStore();
  
  const canCreateProjects = user && hasPermission(user.role, PERMISSIONS.MANAGE_PROJECTS);
  const canViewFinancials = user && hasPermission(user.role, PERMISSIONS.VIEW_ACCOUNTS);
  
  return (
    <div>
      <h1>Projects</h1>
      
      {canCreateProjects && (
        <button>Create New Project</button>
      )}
      
      {/* Project list */}
      {projects.map(project => (
        <div key={project.id}>
          <h3>{project.name}</h3>
          {canViewFinancials && (
            <p>Budget: R{project.budget}</p>
          )}
        </div>
      ))}
    </div>
  );
}
```

## Best Practices

### 1. Always Use Permission Checks in Backend Procedures

Never rely solely on frontend permission checks. Always validate permissions on the server:

```typescript
// ✅ GOOD - Server-side validation
export const deleteProject = baseProcedure
  .input(z.object({ token: z.string(), projectId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_PROJECTS);
    
    await db.project.delete({ where: { id: input.projectId } });
  });

// ❌ BAD - No server-side validation
export const deleteProject = baseProcedure
  .input(z.object({ token: z.string(), projectId: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    // Missing permission check!
    
    await db.project.delete({ where: { id: input.projectId } });
  });
```

### 2. Use the Most Specific Permission

Choose the most specific permission for your use case:

```typescript
// ✅ GOOD - Specific permission
requirePermission(user, PERMISSIONS.MANAGE_EMPLOYEE_ROLES);

// ❌ BAD - Too broad
requirePermission(user, PERMISSIONS.MANAGE_ALL_EMPLOYEES);
```

### 3. Provide Clear Error Messages

Use custom error messages to help users understand why they can't perform an action:

```typescript
requirePermission(
  user,
  PERMISSIONS.APPROVE_PAYMENT_REQUESTS,
  "Only senior administrators and accountants can approve payment requests"
);
```

### 4. Hide UI Elements Users Can't Access

Don't show buttons or features that users don't have permission to use:

```typescript
// ✅ GOOD
{canManageEmployees && <button>Add Employee</button>}

// ❌ BAD - Shows button but blocks on click
<button onClick={handleAddEmployee}>Add Employee</button>
```

### 5. Document Permission Requirements

Add comments to explain why certain permissions are required:

```typescript
// Only accountants and senior admins can approve payments over R10,000
if (amount > 10000) {
  requireAnyPermission(user, [
    PERMISSIONS.APPROVE_PAYMENT_REQUESTS,
    PERMISSIONS.MANAGE_SYSTEM_SETTINGS,
  ]);
}
```

## Adding New Roles or Permissions

### Adding a New Role

1. Add the role to `ROLES` in `src/server/utils/permissions.ts`:
```typescript
export const ROLES = {
  // ... existing roles
  PROJECT_COORDINATOR: "PROJECT_COORDINATOR",
} as const;
```

2. Add the role level to `ROLE_LEVELS`:
```typescript
export const ROLE_LEVELS: Record<Role, number> = {
  // ... existing levels
  [ROLES.PROJECT_COORDINATOR]: 55,
};
```

3. Add role metadata to `ROLE_METADATA`:
```typescript
export const ROLE_METADATA: Record<Role, RoleMetadata> = {
  // ... existing metadata
  [ROLES.PROJECT_COORDINATOR]: {
    label: "Project Coordinator",
    color: "bg-teal-100 text-teal-800",
    description: "Coordinates project activities and communications",
    defaultRoute: "/admin/projects",
  },
};
```

4. Define permissions for the role in `ROLE_PERMISSIONS`:
```typescript
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  // ... existing mappings
  [ROLES.PROJECT_COORDINATOR]: [
    PERMISSIONS.VIEW_ALL_PROJECTS,
    PERMISSIONS.MANAGE_MILESTONES,
    // ... other permissions
  ],
};
```

### Adding a New Permission

1. Add the permission to `PERMISSIONS` in `src/server/utils/permissions.ts`:
```typescript
export const PERMISSIONS = {
  // ... existing permissions
  MANAGE_PROJECT_TEMPLATES: "MANAGE_PROJECT_TEMPLATES",
} as const;
```

2. Add the permission to appropriate roles in `ROLE_PERMISSIONS`:
```typescript
export const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [ROLES.SENIOR_ADMIN]: [
    // ... existing permissions
    PERMISSIONS.MANAGE_PROJECT_TEMPLATES,
  ],
  [ROLES.MANAGER]: [
    // ... existing permissions
    PERMISSIONS.MANAGE_PROJECT_TEMPLATES,
  ],
  // ... other roles
};
```

3. Use the permission in your procedures:
```typescript
export const createProjectTemplate = baseProcedure
  .input(/* ... */)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_PROJECT_TEMPLATES);
    
    // Your logic here...
  });
```

## Testing Access Control

### Testing in Development

1. Create test users with different roles
2. Log in as each user type
3. Verify that:
   - Users can only access features they have permissions for
   - UI elements are hidden appropriately
   - Server-side validation works correctly
   - Error messages are clear and helpful

### Common Test Scenarios

- Can a Manager approve payment requests? (No)
- Can an Accountant view employee performance reviews? (No)
- Can a Supervisor create projects? (No)
- Can a Junior Admin change system settings? (No)
- Can an Artisan view other artisans' orders? (No)

## Troubleshooting

### "Forbidden" Errors

If users are getting forbidden errors when they should have access:

1. Check the user's role in the database
2. Verify the role has the required permission in `ROLE_PERMISSIONS`
3. Check that the procedure is using the correct permission
4. Ensure the token is being passed correctly

### UI Elements Not Showing

If UI elements aren't showing for users who should see them:

1. Verify the permission check is correct
2. Check that the user's role is loaded in `useAuthStore`
3. Ensure you're importing from the correct location
4. Check for typos in permission names

### Role Hierarchy Issues

If role hierarchy isn't working as expected:

1. Check `ROLE_LEVELS` values
2. Verify `hasRoleLevel` is being used correctly
3. Ensure role names match exactly (case-sensitive)

## Security Considerations

1. **Never trust the frontend** - Always validate permissions on the server
2. **Use specific permissions** - Don't rely solely on role checks
3. **Log access attempts** - Consider logging when users are denied access
4. **Regular audits** - Periodically review role-permission mappings
5. **Principle of least privilege** - Give users only the permissions they need
6. **Test thoroughly** - Test all permission combinations

## Migration Notes

When migrating existing code to use the new permission system:

1. Identify all `user.role === "SENIOR_ADMIN"` checks
2. Replace with appropriate permission checks
3. Update error messages to be more specific
4. Add UI conditional rendering based on permissions
5. Test thoroughly with different user roles

## Support and Questions

For questions about the access control system:
- Review this guide
- Check `src/server/utils/permissions.ts` for all roles and permissions
- Check `src/server/utils/auth.ts` for authorization helpers
- Look at existing procedures for examples

Remember: Security is paramount. When in doubt, restrict access and require explicit permissions.
