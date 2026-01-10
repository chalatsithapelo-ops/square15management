# Property Manager Invoice Workflow & PDF Fixes

## Issues Fixed

### 1. PM Invoice Bypassing Approval Workflow
**Problem**: PM invoices created from contractor portal were immediately sent to the PM (status: `SENT_TO_PM`) without going through the approval workflow.

**Solution**: Modified `createInvoice.ts` to start ALL PM invoices at `DRAFT` status, regardless of who creates them.

**Changes Made**:
- File: `src/server/trpc/procedures/createInvoice.ts`
- PM invoices now start at `DRAFT` status
- Removed auto-setting of `sentToPMDate`
- Added tracking fields: `companyMaterialCost`, `companyLabourCost`, `estimatedProfit`, `createdById`

**Expected Workflow**:
```
DRAFT → ADMIN_APPROVED → SENT_TO_PM → PM_APPROVED/PM_REJECTED → PAID
```

### 2. PM Invoice PDF Showing Wrong Company Details
**Problem**: PM invoice PDFs were showing Property Manager details instead of Contractor details. The invoice should show:
- **FROM** (Seller): Contractor company details
- **TO** (Buyer): Property Manager details

**Solution**: Completely rewrote `generatePropertyManagerInvoicePdf.ts` to:
1. Use contractor logo instead of PM logo
2. Show contractor company details in the header
3. Show PM details in the "Bill To" section
4. Add contractor banking details for payment

**Changes Made**:
- File: `src/server/trpc/procedures/generatePropertyManagerInvoicePdf.ts`
- Changed logo: `getCompanyLogo()` → `getContractorLogo()`
- Updated query to include `order.contractor` relation
- Added SystemSettings fallback with `contractor_` prefix
- Added Payment Information section with contractor's bank details

## Testing Instructions

### Test 1: PM Invoice Workflow
1. **Login** as Contractor (thapelochalatsi@square15.co.za)
2. **Navigate** to Contractor → Invoices
3. **Create** a new invoice for a PM order
4. **Verify**: Invoice status should be `DRAFT` (not `SENT_TO_PM`)
5. **Navigate** to Admin portal
6. **Approve** the invoice to change status to `ADMIN_APPROVED`
7. **Send** to PM to change status to `SENT_TO_PM`
8. **Login** as PM and verify invoice appears in their portal

### Test 2: PM Invoice PDF Content
1. **Login** as Contractor
2. **Navigate** to Contractor → Invoices
3. **Open** a PM invoice
4. **Download** the invoice PDF
5. **Verify** PDF shows:
   - **Company Logo**: Contractor's logo (top left)
   - **Header "FROM"**: Contractor company details (name, address, phone, email, VAT)
   - **"Bill To"**: Property Manager details
   - **Payment Information**: Contractor's bank details (Bank Name, Account Name, Account Number, Branch Code)

### Test 3: Contractor Settings Persistence
1. **Login** as Contractor
2. **Navigate** to Settings → Company Settings
3. **Update**:
   - Company logo
   - Company name
   - Banking details (Bank Name, Account Name, Account Number, Branch Code)
4. **Save** changes
5. **Create** a new invoice
6. **Download** the invoice PDF
7. **Verify**: New logo and banking details appear on the PDF

### Test 4: SystemSettings Fallback
1. **Ensure** contractor user profile fields are empty (contractorCompanyName, etc.)
2. **Update** SystemSettings table with contractor_ prefix fields:
   - `contractor_company_name`
   - `contractor_company_bank_name`
   - `contractor_company_bank_account_name`
   - `contractor_company_bank_account_number`
   - `contractor_company_bank_branch_code`
3. **Generate** invoice PDF
4. **Verify**: PDF uses SystemSettings values

## Database Schema Reference

### PropertyManagerInvoice Model
```prisma
model PropertyManagerInvoice {
  id                Int      @id @default(autoincrement())
  status            String   // DRAFT, ADMIN_APPROVED, SENT_TO_PM, PM_APPROVED, PM_REJECTED, PAID
  order             PropertyManagerOrder? @relation(...)
  propertyManager   User     @relation(...)
  // Note: No createdBy or createdById field
}
```

### Company Details Storage
1. **User Model Fields** (Contractor):
   - `contractorCompanyName`
   - `contractorCompanyBankName`
   - `contractorCompanyBankAccountName`
   - `contractorCompanyBankAccountNumber`
   - `contractorCompanyBankBranchCode`

2. **SystemSettings Table** (Fallback):
   - Key: `contractor_company_name`, Value: "Company Name"
   - Key: `contractor_company_bank_name`, Value: "FNB"
   - Key: `contractor_company_bank_account_name`, Value: "Business Account"
   - Key: `contractor_company_bank_account_number`, Value: "62012345678"
   - Key: `contractor_company_bank_branch_code`, Value: "250655"

## Code Changes Summary

### createInvoice.ts
```typescript
// OLD: Bypass approval for contractor-created PM invoices
status: (user.role === "CONTRACTOR" && isPropertyManagerOrder) ? "SENT_TO_PM" : "DRAFT"

// NEW: All PM invoices start at DRAFT
status: "DRAFT",
companyMaterialCost: input.companyMaterialCost || 0,
companyLabourCost: input.companyLabourCost || 0,
estimatedProfit: input.estimatedProfit || 0,
createdById: user.id,
```

### generatePropertyManagerInvoicePdf.ts
```typescript
// Get contractor details from order.contractor or SystemSettings
if (invoice.order?.contractor) {
  contractorDetails = invoice.order.contractor;
} else {
  // Fallback to SystemSettings with contractor_ prefix
  const contractorSettings = await db.systemSettings.findMany({
    where: { key: { in: ["contractor_company_name", ...] } }
  });
  contractorDetails = { /* mapped settings */ };
}

// Use contractor logo
const logoBuffer = await getContractorLogo();

// PDF shows: FROM = Contractor, TO = Property Manager
```

## Files Modified
1. `src/server/trpc/procedures/createInvoice.ts`
2. `src/server/trpc/procedures/generatePropertyManagerInvoicePdf.ts`

## Status
✅ TypeScript compilation successful  
✅ All errors resolved  
🔄 Ready for testing
