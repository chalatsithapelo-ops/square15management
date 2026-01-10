# Property Manager Invoice Approval Enhancement

## Overview
Enhanced the Property Manager portal to allow PMs to approve or reject **ALL** invoices sent to them, including both PropertyManagerInvoices and regular Invoices.

## Changes Made

### 1. Frontend Changes - Property Manager Dashboard
**File**: `src/routes/property-manager/dashboard/index.tsx`

#### Added Regular Invoice Mutation
- Created `updateRegularInvoiceMutation` using `updateInvoiceStatus` procedure
- This mutation handles approve/reject actions for regular invoices

#### Updated Handlers
- Modified `handleApprove(invoiceId, isRegularInvoice)` to:
  - Detect invoice type (PM invoice vs regular invoice)
  - For regular invoices: Set status to `PAID` on approval
  - For PM invoices: Use existing `APPROVE` action

- Modified `handleReject(invoiceId, isRegularInvoice)` to:
  - Detect invoice type
  - For regular invoices: Set status to `REJECTED` on rejection
  - For PM invoices: Use existing `REJECT` action with reason

#### Updated UI Button Visibility
Changed button condition from:
```typescript
{invoice.status === "SENT_TO_PM" && (
  <button onClick={() => handleApprove(invoice.id)}>Approve</button>
  <button onClick={() => handleReject(invoice.id)}>Reject</button>
)}
```

To:
```typescript
{(invoice.status === "SENT_TO_PM" || 
  (invoice.isRegularInvoice && (invoice.status === "SENT" || invoice.status === "PENDING_APPROVAL"))) && (
  <button onClick={() => handleApprove(invoice.id, invoice.isRegularInvoice || false)}>Approve</button>
  <button onClick={() => handleReject(invoice.id, invoice.isRegularInvoice || false)}>Reject</button>
)}
```

This means approve/reject buttons now show for:
- **PropertyManagerInvoices** with status `SENT_TO_PM`
- **Regular Invoices** with status `SENT` or `PENDING_APPROVAL`

### 2. Backend Changes - Invoice Status Update Procedure
**File**: `src/server/trpc/procedures/updateInvoiceStatus.ts`

Added Property Manager validation:
```typescript
// Property Manager validation - they can only update invoices where they are the customer
if (user.role === "PROPERTY_MANAGER") {
  if (currentInvoice.customerEmail !== user.email) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Property Manager can only update invoices addressed to them",
    });
  }
  // Property Managers can only approve (PAID) or reject invoices
  if (input.status !== "PAID" && input.status !== "REJECTED") {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "Property Manager can only approve (mark as PAID) or reject invoices",
    });
  }
}
```

This ensures:
- PMs can only update invoices where their email matches the `customerEmail` field
- PMs can only set status to `PAID` (approve) or `REJECTED` (reject)
- No other status changes are allowed

## Invoice Workflow Summary

### PropertyManagerInvoice Workflow
```
DRAFT → ADMIN_APPROVED → SENT_TO_PM → [PM approves] → PM_APPROVED → PAID
                                     ↘ [PM rejects] → PM_REJECTED
```

### Regular Invoice Workflow (PM Approval)
```
DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → [PM approves] → PAID
                                                   ↘ [PM rejects] → REJECTED
```

## User Experience

### Property Manager Portal - Invoices Tab
1. PM sees both PropertyManagerInvoices and regular Invoices where their email is the customer
2. Invoices with the following statuses show Approve/Reject buttons:
   - PropertyManagerInvoice: `SENT_TO_PM`
   - Regular Invoice: `SENT` or `PENDING_APPROVAL`
3. Clicking "Approve":
   - PM invoice: Moves to `PM_APPROVED` status
   - Regular invoice: Moves to `PAID` status
4. Clicking "Reject":
   - PM invoice: Moves to `PM_REJECTED` status with rejection reason
   - Regular invoice: Moves to `REJECTED` status

## Testing Checklist
- [ ] Login as Property Manager
- [ ] Navigate to Invoices tab
- [ ] Verify both PM invoices and regular invoices are visible
- [ ] Check that regular invoices with status `SENT` show Approve/Reject buttons
- [ ] Approve a regular invoice - should move to `PAID` status
- [ ] Reject a regular invoice - should move to `REJECTED` status
- [ ] Approve a PM invoice - should move to `PM_APPROVED` status
- [ ] Reject a PM invoice - should move to `PM_REJECTED` status
- [ ] Verify query invalidation refreshes the invoice list after actions

## Security Considerations
- PMs can only update invoices where their email matches the `customerEmail`
- PMs cannot update invoices for other customers
- PMs can only approve (PAID) or reject (REJECTED) invoices
- All other status transitions are blocked for PM role

## Related Files
- Frontend: `src/routes/property-manager/dashboard/index.tsx`
- Backend: `src/server/trpc/procedures/updateInvoiceStatus.ts`
- Related Procedures:
  - `src/server/trpc/procedures/getInvoices.ts` (fetches regular invoices)
  - `src/server/trpc/procedures/getPropertyManagerInvoices.ts` (fetches PM invoices)
  - `src/server/trpc/procedures/updatePropertyManagerInvoiceStatus.ts` (updates PM invoices)
