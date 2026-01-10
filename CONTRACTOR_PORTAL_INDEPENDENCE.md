# Contractor Portal Independence Implementation

## Overview
The Contractor Portal has been updated to be completely independent from the Admin Portal, with its own management hierarchy and approval workflows.

## Key Changes

### 1. New Contractor Management Roles

Three contractor roles are now available:

- **CONTRACTOR** - Basic contractor role (existing)
- **CONTRACTOR_SENIOR_MANAGER** - Main contractor with full authority
- **CONTRACTOR_JUNIOR_MANAGER** - Junior manager with limited permissions

### 2. Role Assignment

When a Property Manager creates a contractor:
- The contractor is automatically assigned the **CONTRACTOR_SENIOR_MANAGER** role
- This gives them full management authority within their organization
- They can add subordinates through the HR tool with appropriate roles

### 3. Independent Approval Workflows

#### Invoice Workflow
- **DRAFT** → Can move to PENDING_REVIEW or CANCELLED
- **PENDING_REVIEW** → Contractor Senior Manager can approve to PENDING_APPROVAL
- **PENDING_APPROVAL** → Contractor Senior Manager can approve to SENT
- **SENT** → Can move to PAID or OVERDUE
- No connection to Admin portal approvals

#### Quotation Workflow
- **DRAFT** → Can assign to artisan (PENDING_ARTISAN_REVIEW)
- **PENDING_ARTISAN_REVIEW** → Artisan works on it (IN_PROGRESS)
- **IN_PROGRESS** → Artisan submits for review (READY_FOR_REVIEW)
- **READY_FOR_REVIEW** → Contractor Senior/Junior Manager can APPROVE or REJECT
- No connection to Admin portal approvals

### 4. Updated Files

#### Client-Side Files:
- `src/utils/roles.ts` - Added new roles and helper functions
- `src/routes/contractor/dashboard/index.tsx` - Updated access guard
- `src/routes/contractor/settings/index.tsx` - Updated access guard
- `src/routes/contractor/ai-agent.tsx` - Updated access guard
- `src/routes/contractor/invoices/index.tsx` - Updated workflow logic
- `src/routes/contractor/quotations/index.tsx` - Updated workflow logic

#### Server-Side Files:
- `src/server/utils/permissions.ts` - Added roles, permissions, and metadata
- `src/server/trpc/procedures/createContractor.ts` - Assigns CONTRACTOR_SENIOR_MANAGER role
- `src/server/trpc/procedures/getInvoices.ts` - Recognizes all contractor roles
- `src/server/trpc/procedures/getQuotations.ts` - Recognizes all contractor roles
- `src/server/trpc/procedures/createInvoice.ts` - Recognizes all contractor roles
- `src/server/trpc/procedures/uploadCompanyLogo.ts` - Allows all contractor roles
- `src/server/trpc/procedures/updateContractorBranding.ts` - Allows all contractor roles
- `src/server/trpc/procedures/getContractorBranding.ts` - Works with all contractor roles

### 5. Helper Functions

New utility functions in `src/utils/roles.ts`:

```typescript
// Check if user has contractor portal access
isContractorRole(role: string): boolean

// Check if user is a contractor senior manager
isContractorSeniorManager(role: string): boolean

// Check if user is a contractor manager (senior or junior)
isContractorManager(role: string): boolean
```

### 6. Permissions

#### CONTRACTOR_SENIOR_MANAGER Permissions:
- Full CRM & Sales management
- Complete operations & work management
- Full project management
- Complete financial management (invoices, reports, accounts)
- **Full HR & Employee Management Authority** (can add/edit/delete employees)
- Analytics & reporting access
- System customization

#### CONTRACTOR_JUNIOR_MANAGER Permissions:
- Full CRM & Sales management
- Complete operations & work management
- Full project management
- **View-only financial access** (cannot create/edit invoices)
- Limited HR management (cannot add/delete employees)
- Analytics & reporting access
- System customization

## Testing

To test the contractor portal independence:

1. **Create a new contractor** as a Property Manager
   - The contractor will be created with CONTRACTOR_SENIOR_MANAGER role
   
2. **Log in as the contractor**
   - Navigate to Invoices or Quotations
   - Create a new invoice or quotation
   - The approval workflow should only check for contractor management roles
   
3. **Add employees** via HR tool
   - Senior managers can assign CONTRACTOR_JUNIOR_MANAGER or other roles
   - Employees added will be part of the contractor's organization
   
4. **Test approvals**
   - Invoices in PENDING_APPROVAL state should be approvable by Contractor Senior Manager
   - Quotations in READY_FOR_REVIEW state should be approvable by Contractor Senior/Junior Manager
   - No admin portal access required

## Migration Notes

### For Existing Contractors:
Existing contractors with role "CONTRACTOR" will continue to work, but:
- They may have limited approval authority
- Consider updating their role to CONTRACTOR_SENIOR_MANAGER if they are the main contractor
- Can be done via database update or HR tool

### Database Update (Optional):
If you want to promote existing contractors to senior managers:

```sql
UPDATE "User"
SET role = 'CONTRACTOR_SENIOR_MANAGER'
WHERE role = 'CONTRACTOR';
```

## Role Hierarchy

Role hierarchy levels (from permissions.ts):

```
SENIOR_ADMIN: 100
JUNIOR_ADMIN: 80
MANAGER: 70
ACCOUNTANT: 60
TECHNICAL_MANAGER: 55
SUPERVISOR: 50
SALES_AGENT: 45
ARTISAN: 30
PROPERTY_MANAGER: 15
CONTRACTOR_SENIOR_MANAGER: 14  ← NEW
CONTRACTOR_JUNIOR_MANAGER: 13  ← NEW
CONTRACTOR: 12
CUSTOMER: 10
```

## Display Labels

When displaying roles in the UI:
- **CONTRACTOR_SENIOR_MANAGER** displays as "Senior Manager"
- **CONTRACTOR_JUNIOR_MANAGER** displays as "Junior Manager"
- **CONTRACTOR** displays as "Contractor"

## Benefits

1. **Complete Independence**: Contractor portal operates separately from Admin portal
2. **Clear Hierarchy**: Main contractor has senior manager authority
3. **Scalability**: Contractors can build their own teams with proper role structure
4. **Better UX**: Role names make sense within contractor context ("Senior Manager" vs "Senior Admin")
5. **Secure**: Each contractor organization manages its own approvals
6. **Flexible**: Contractors can add multiple managers at different levels

## Future Enhancements

Consider these potential improvements:
1. Add organization/company ID to link employees within same contractor company
2. Create contractor-specific admin role for managing multiple contractors
3. Add delegation feature for temporary authority transfer
4. Implement approval chains with multiple levels
5. Add audit logging for contractor approval actions
