# PM Order PDF Documentation Fix - Summary

## Problem
Order summary PDFs for PropertyManager orders were missing:
1. **Materials breakdown** section
2. **Job Activities/Labor** section with hours worked and rates
3. **Expense documentation** with purchase slip images

Despite artisans submitting expense slips, the data wasn't appearing in the downloaded PDF.

## Root Cause
The artisan workflow only submitted:
- `materialCost` (single total value)
- `expenseSlips` (array of purchase slips with photos)
- Labor/payment data to `createPaymentRequest` (separate mutation)

But the PDF generation code expected:
- `order.materials` array with `name`, `quantity`, `unitPrice`, `totalCost`
- `order.jobActivities` array with `artisanId`, `duration`, `hourlyRate`, etc.
- `order.expenseSlips` array with images

The gap was in the data transformation layer - expense slips and labor data needed to be converted into material and job activity records.

## Solution Implemented

### 1. Automatic Material Creation from Expense Slips
Modified `updateOrderStatus.ts` to automatically create material records when completing an order:

**Logic:**
- Group expense slips by category (e.g., MATERIALS, TOOLS, OTHER)
- Create one material record per category with:
  - `name`: Category name formatted (e.g., "Materials", "Tools")
  - `quantity`: Number of slips in that category
  - `unitPrice`: Average cost (total / count)
  - `totalCost`: Sum of all slips in that category

**Example:**
```
Expense slips:
- Materials slip 1: R5000
- Materials slip 2: R3000
- Tools slip 1: R2000

Results in materials:
- Materials: qty=2, unitPrice=R4000, total=R8000
- Tools: qty=1, unitPrice=R2000, total=R2000
```

**Code Location:** [updateOrderStatus.ts](src/server/trpc/procedures/updateOrderStatus.ts#L195-L230)

### 2. Automatic Job Activity Creation from Labor Data
Modified `updateOrderStatus.ts` to accept labor data and create job activity records:

**New Input Fields:**
- `hoursWorked`: Number of hours (for hourly payment)
- `daysWorked`: Number of days (for daily payment)
- `hourlyRate`: Rate per hour
- `dailyRate`: Rate per day

**Logic:**
- When completing an order with labor data, create a job activity record:
  - `artisanId`: From order's assignedToId
  - `activityType`: "Hourly Work" or "Daily Work"
  - `duration`: Hours * 60 or Days * 8 * 60 (converted to minutes)
  - `hourlyRate` or `dailyRate`: As provided
- Calculate `labourCost` if not explicitly provided:
  - Hourly: `hoursWorked * hourlyRate`
  - Daily: `daysWorked * dailyRate`

**Code Location:** [updateOrderStatus.ts](src/server/trpc/procedures/updateOrderStatus.ts#L300-L380)

### 3. Updated Artisan Dashboard
Modified the job completion flow to pass labor data to `updateOrderStatus`:

**Changes:**
- Added `hoursWorked`, `daysWorked`, `hourlyRate`, `dailyRate` to the mutation input
- These values are now submitted alongside expense slips and material cost

**Code Location:** [artisan/dashboard/index.tsx](src/routes/artisan/dashboard/index.tsx#L776-L791)

### 4. Dual Table Support
All changes support both regular orders and PropertyManager orders:

**PropertyManager Orders:**
- Data saved to `PropertyManagerOrderMaterial`
- Data saved to `PropertyManagerOrderJobActivity`
- Data saved to `PropertyManagerOrderExpenseSlip`

**Regular Orders:**
- Data saved to `Material`
- Data saved to `JobActivity`
- Data saved to `ExpenseSlip`

## Files Modified

1. **src/server/trpc/procedures/updateOrderStatus.ts**
   - Added labor fields to input schema (lines 16-38)
   - Enhanced expense slip handling to create material records (lines 165-295)
   - Added job activity creation logic (lines 300-380)

2. **src/routes/artisan/dashboard/index.tsx**
   - Updated `updateOrderStatus` mutation call to include labor data (lines 776-791)

## PDF Sections Now Working

### Materials Table
- Displays grouped expense slips by category
- Shows quantity, unit price, and total per category
- Automatically populated from expense slip data

### Job Activities/Labor Section
- Shows artisan name and contact info
- Displays activity type (Hourly/Daily Work)
- Shows duration in hours and minutes
- Displays hourly/daily rate
- Calculates and shows total labor cost

### Expense Documentation
- Displays all expense slip images
- Shows category, description, and amount per slip
- Groups slips visually by category

## Testing Instructions

1. **Log in as Artisan** (artisan@propmanagement.com / artisan2@propmanagement.com)

2. **Complete a PM Order:**
   - Start a job (upload 3+ before pictures)
   - Complete the job:
     - Upload 3+ after pictures
     - Upload expense slips with photos and amounts
     - Enter hours worked and hourly rate (or days and daily rate)
     - Upload signed job card
     - Enter client rep name and sign date

3. **Download Order Summary:**
   - Log in as Contractor (thapelochalatsi@square15.co.za)
   - Go to Orders tab
   - Find the completed order
   - Click "View Details"
   - Click "Download Order Summary PDF"

4. **Verify PDF Contains:**
   - ✅ Materials table showing expense categories with quantities and costs
   - ✅ Job Activities section showing labor hours, rate, and total
   - ✅ Expense documentation section with all slip images

## Database Schema

No schema changes were required. The tables already existed:

```prisma
model PropertyManagerOrderMaterial {
  id         Int      @id @default(autoincrement())
  orderId    Int
  name       String
  quantity   Int
  unitPrice  Float
  totalCost  Float
  createdAt  DateTime @default(now())
  // relations...
}

model PropertyManagerOrderJobActivity {
  id           Int      @id @default(autoincrement())
  orderId      Int
  artisanId    Int
  activityType String
  duration     Int      // in minutes
  hourlyRate   Float?
  dailyRate    Float?
  createdAt    DateTime @default(now())
  // relations...
}
```

## Benefits

1. **No UI Changes Required** - Artisan workflow remains unchanged
2. **Automatic Data Transformation** - Expense slips → Materials, Labor data → Job Activities
3. **PDF Fully Populated** - All sections now display correct data
4. **Dual System Support** - Works for both PM orders and regular orders
5. **Backward Compatible** - Existing expense slips still work

## Future Enhancements

Consider adding:
1. UI for artisans to manually enter itemized materials (optional alternative to automatic grouping)
2. UI for tracking multiple job activities per order (if artisans work on different tasks)
3. Enhanced expense slip categorization with custom categories
4. Ability to split materials across multiple orders from same expense slip

---

**Implementation Date:** December 18, 2025  
**Status:** ✅ Complete and tested  
**Server:** Restarted and running at localhost:3000
