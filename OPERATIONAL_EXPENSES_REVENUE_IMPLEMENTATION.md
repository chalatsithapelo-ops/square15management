# Operational Expenses & Alternative Revenue Implementation

## ✅ COMPLETED

### 1. Database Schema
- ✅ Added `OperationalExpense` model with fields:
  - date, category, description, amount, vendor, referenceNumber
  - notes, documentUrl, isRecurring, recurringPeriod
  - createdBy, approvedBy, isApproved, approvedAt
  
- ✅ Added `AlternativeRevenue` model with fields:
  - date, category, description, amount, source, referenceNumber
  - notes, documentUrl, isRecurring, recurringPeriod
  - createdBy, approvedBy, isApproved, approvedAt

- ✅ Added enums:
  - `ExpenseCategory`: PETROL, OFFICE_SUPPLIES, RENT, UTILITIES, INSURANCE, SALARIES, MARKETING, MAINTENANCE, TRAVEL, PROFESSIONAL_FEES, TELECOMMUNICATIONS, SOFTWARE_SUBSCRIPTIONS, OTHER
  - `RevenueCategory`: CONSULTING, RENTAL_INCOME, INTEREST, INVESTMENTS, GRANTS, DONATIONS, OTHER

- ✅ Updated `NotificationType` enum with:
  - OPERATIONAL_EXPENSE_ADDED
  - ALTERNATIVE_REVENUE_ADDED

- ✅ Database migration applied successfully

### 2. Backend (TRPC Procedures)
Created 8 new procedures:

**Operational Expenses:**
- ✅ `createOperationalExpense` - Add new expense (notifies senior users)
- ✅ `getOperationalExpenses` - Retrieve expenses with filters
- ✅ `updateOperationalExpense` - Edit expense (only by creator before approval or senior users)
- ✅ `approveOperationalExpense` - Approve/reject expenses (senior users only)

**Alternative Revenue:**
- ✅ `createAlternativeRevenue` - Add new revenue (notifies senior users)
- ✅ `getAlternativeRevenues` - Retrieve revenues with filters
- ✅ `updateAlternativeRevenue` - Edit revenue (only by creator before approval or senior users)
- ✅ `approveAlternativeRevenue` - Approve/reject revenues (senior users only)

All procedures registered in `/src/server/trpc/root.ts`

### 3. Frontend Components
Created 2 reusable components:

- ✅ `/src/components/OperationalExpenseForm.tsx`
  - Add/edit operational expenses
  - View expense list with approval status
  - Stats dashboard (total, approved, pending)
  - Edit/approve/reject actions
  
- ✅ `/src/components/AlternativeRevenueForm.tsx`
  - Add/edit alternative revenue
  - View revenue list with approval status
  - Stats dashboard (total, approved, pending)
  - Edit/approve/reject actions

### 4. Notification System
- ✅ Automatic notifications to Senior Admin when Admin users add expenses/revenue
- ✅ Automatic notifications to Senior Contractor Manager when Contractor users add expenses/revenue
- ✅ Notification to creator when expense/revenue is approved/rejected

## 📋 NEXT STEPS (Required)

### 1. Add Components to Pages

#### Admin Operations Page
File: `/src/routes/admin/operations/index.tsx`

Add import at the top:
```typescript
import { OperationalExpenseForm } from "~/components/OperationalExpenseForm";
```

Add component inside the `<main>` section (after the orders section, before closing `</main>`):
```typescript
      {/* Operational Expenses */}
      <div className="mt-8">
        <OperationalExpenseForm />
      </div>
    </main>
```

#### Admin Invoices Page
File: `/src/routes/admin/invoices/index.tsx`

Add import:
```typescript
import { AlternativeRevenueForm } from "~/components/AlternativeRevenueForm";
```

Add component inside the `<main>` section (after the invoices section):
```typescript
      {/* Alternative Revenue */}
      <div className="mt-8">
        <AlternativeRevenueForm />
      </div>
    </main>
```

#### Contractor Operations Page
File: `/src/routes/contractor/operations/index.tsx`

Add the same `OperationalExpenseForm` component

#### Contractor Invoices Page
File: `/src/routes/contractor/invoices/index.tsx`

Add the same `AlternativeRevenueForm` component

### 2. Update Management Accounts

File: `/src/routes/admin/accounts/index.tsx` (around line 150-200)
File: `/src/routes/contractor/accounts/index.tsx`

**Add queries for operational data:**
```typescript
const operationalExpensesQuery = useQuery(
  trpc.getOperationalExpenses.queryOptions({
    token: token!,
    isApproved: true, // Only include approved expenses
  })
);

const alternativeRevenuesQuery = useQuery(
  trpc.getAlternativeRevenues.queryOptions({
    token: token!,
    isApproved: true, // Only include approved revenues
  })
);

const operationalExpenses = operationalExpensesQuery.data || [];
const alternativeRevenues = alternativeRevenuesQuery.data || [];
```

**Update expense calculation (around line 190):**
```typescript
// Filter operational expenses by date range
const filteredOperationalExpenses = operationalExpenses.filter(exp => {
  const expDate = new Date(exp.date);
  return expDate >= new Date(dateRange.start) && expDate <= new Date(dateRange.end);
});

const operationalExpenseTotal = filteredOperationalExpenses.reduce(
  (sum, exp) => sum + exp.amount, 
  0
);

// Update totalExpenses to include operational expenses
const totalExpenses = artisanPayments + materialCosts + labourCosts + operationalExpenseTotal;
```

**Update revenue calculation (around line 170):**
```typescript
// Filter alternative revenues by date range
const filteredAlternativeRevenues = alternativeRevenues.filter(rev => {
  const revDate = new Date(rev.date);
  return revDate >= new Date(dateRange.start) && revDate <= new Date(dateRange.end);
});

const alternativeRevenueTotal = filteredAlternativeRevenues.reduce(
  (sum, rev) => sum + rev.amount,
  0
);

// Update totalRevenue to include alternative revenue
const totalRevenue = filteredInvoices
  .filter(inv => inv.status === 'PAID')
  .reduce((sum, inv) => sum + (inv.total || 0), 0) + alternativeRevenueTotal;
```

**Update expense breakdown display (around line 196):**
```typescript
const expensesByCategory = {
  artisan_payments: artisanPayments,
  materials: materialCosts,
  labour: labourCosts,
  operational_expenses: operationalExpenseTotal, // ADD THIS
};
```

## 🎯 FEATURES

### Permissions & Security
- **All Users**: Can add operational expenses/alternative revenue
- **Senior Admin/Senior Contractor Manager**: Get notified, can approve/reject, can edit any entry
- **Creator**: Can edit their own entries before approval
- **Approved Entries**: Only senior users can edit

### Workflow
1. User adds expense/revenue
2. Notification sent to senior user
3. Senior user reviews and approves/rejects
4. Creator gets notification of decision
5. Approved items appear in management accounts

### Categories

**Expense Categories:**
- Petrol/Fuel
- Office Supplies/Stationery
- Rent
- Utilities
- Insurance
- Salaries
- Marketing
- Maintenance
- Travel
- Professional Fees
- Telecommunications
- Software Subscriptions
- Other

**Revenue Categories:**
- Consulting Services
- Rental Income
- Interest
- Investments
- Grants
- Donations
- Other

### Recurring Entries
Both expenses and revenues can be marked as recurring:
- Monthly
- Quarterly
- Annually

## 📝 TESTING CHECKLIST

After implementing the integration steps above:

### Admin Portal
- [ ] Navigate to `/admin/operations` - Should see "Operational Expenses" section
- [ ] Add a test expense (e.g., Petrol, R500)
- [ ] Check if Senior Admin received notification
- [ ] As Senior Admin, approve the expense
- [ ] Navigate to `/admin/invoices` - Should see "Alternative Revenue" section
- [ ] Add a test revenue (e.g., Consulting, R2000)
- [ ] Approve the revenue
- [ ] Navigate to `/admin/accounts` - Should see updated totals including operational data

### Contractor Portal
- [ ] Navigate to `/contractor/operations` - Should see "Operational Expenses" section
- [ ] Add a test expense
- [ ] Check if Senior Contractor Manager received notification
- [ ] Navigate to `/contractor/invoices` - Should see "Alternative Revenue" section
- [ ] Navigate to `/contractor/accounts` - Check management accounts updated

### Approval Workflow
- [ ] Junior user adds expense - cannot approve own expense
- [ ] Senior user can see pending expenses
- [ ] Senior user can approve/reject
- [ ] Creator receives notification of approval/rejection
- [ ] Approved expenses appear in management accounts
- [ ] Rejected expenses do not appear in management accounts

## 🚀 DEPLOYMENT

After testing locally:
1. Commit all changes
2. The database migration has already been applied (`prisma db push`)
3. Deploy to production
4. Run `npx prisma generate` on production to update Prisma client

## 📊 IMPACT ON MANAGEMENT ACCOUNTS

**Before:** Only tracked revenue/expenses from orders, invoices, payment requests

**After:** Comprehensive financial tracking including:
- Order-based revenue & expenses
- Invoice-based revenue
- Operational expenses (petrol, rent, utilities, etc.)
- Alternative revenue (consulting, interest, etc.)

This provides **accurate financial reporting** for tax, SARS, and business analysis.
