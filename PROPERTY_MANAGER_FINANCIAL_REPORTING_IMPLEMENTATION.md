# Property Manager Enhanced Financial Reporting System

## Overview
Comprehensive real-time financial reporting and analytics dashboard for Property Managers, providing insights into revenue, expenses, profitability, occupancy, and overall portfolio performance.

## Features Implemented

### 1. **Real-Time Financial Data Aggregation**
- **Revenue Tracking**:
  - Tenant rent payments (actual payments received)
  - Other income from customer payments
  - Expected vs. actual rental income
  - Rent collection rate calculation
  
- **Expense Tracking**:
  - Building budget expenses (from allocated budgets)
  - Contractor payments (paid work requests)
  - Order costs (materials and labor from PropertyManagerOrders)
  - Per-building and portfolio-wide expense breakdown

- **Profitability Metrics**:
  - Net Operating Income (NOI) = Revenue - Expenses
  - Profit margin percentage
  - Per-unit financial performance
  - Comparison to previous period (trend analysis)

### 2. **Per-Building Financial Analysis**
Each building displays:
- **Revenue Metrics**:
  - Rental income (from tenant payments)
  - Expected rental income
  - Rent collection rate (%)
  - Other income sources
  
- **Expense Metrics**:
  - Budget expenses (from building budgets)
  - Maintenance costs
  - Total expenses
  
- **Profitability**:
  - Net operating income
  - Profit margin (%)
  
- **Budget Performance**:
  - Total budget allocated
  - Amount spent
  - Remaining budget
  - Budget utilization (%)
  
- **Occupancy Metrics**:
  - Total units
  - Occupied units
  - Vacant units
  - Occupancy rate (%)
  
- **Tenant Metrics**:
  - Active tenants
  - Overdue payments count
  - Partial payments count
  
- **Maintenance**:
  - Number of requests
  - Request count by building

### 3. **Portfolio-Wide Dashboard**
Aggregated metrics across all managed properties:

- **Portfolio Summary**:
  - Number of properties
  - Total units managed
  - Portfolio-wide occupancy rate
  - Vacant units count
  
- **Revenue Summary**:
  - Total portfolio revenue
  - Rental income breakdown
  - Other income
  - Revenue trend (vs. previous period)
  
- **Expense Summary**:
  - Budget expenses
  - Contractor payments
  - Order costs
  - Total portfolio expenses
  
- **Profitability**:
  - Portfolio net operating income
  - Portfolio profit margin
  
- **Performance Ratios**:
  - Revenue per unit
  - Expense per unit
  - Net income per unit
  - Average rent collection rate
  
- **Contractor Activity**:
  - Total contractor payments
  - Number of payments made
  - Average payment amount
  
- **Budget Management**:
  - Total budgets across properties
  - Total spent
  - Remaining budget
  - Portfolio-wide budget utilization

### 4. **Financial Visualizations**

#### Charts Included:
1. **Revenue vs. Expenses** (Pie & Bar Charts)
   - Visual comparison of income vs. costs
   
2. **Expense Breakdown** (Bar Chart)
   - Budget expenses
   - Contractor payments
   - Order costs
   
3. **Building Performance Comparison** (Multi-Bar Chart)
   - Revenue by building
   - Expenses by building
   - Net income by building
   
4. **Occupancy Analysis** (Bar Chart)
   - Occupancy rates per building
   
5. **Financial Health Indicators** (Progress Bars)
   - Profit margin with color-coded thresholds
   - Occupancy rate performance
   - Budget utilization status

### 5. **Filtering and Period Selection**
- **Time Periods**:
  - Current Month
  - Last Month
  - Current Quarter
  - Year to Date (YTD)
  - Custom Date Range
  
- **Building Filter**:
  - All Buildings (portfolio view)
  - Specific building (detailed view)

### 6. **Three Distinct Views**

#### Overview Tab
- Key portfolio metrics (4 main cards)
- Revenue vs. Expenses comparison
- Expense breakdown visualization
- Budget performance details
- Contractor activity summary
- Maintenance statistics

#### Building Analysis Tab
- Building performance comparison chart
- Detailed financial table for each building showing:
  - Revenue
  - Expenses
  - Net income
  - Profit margin
  - Occupancy rate

#### Performance Metrics Tab
- Per-unit metrics (Revenue, Expense, Net Income per unit)
- Rent collection rate
- Occupancy analysis chart
- Financial health indicators:
  - Profit margin (Excellent: ≥15%, Fair: 5-15%, Needs Improvement: <5%)
  - Occupancy rate (Excellent: ≥90%, Good: 75-90%, Below Target: <75%)
  - Budget utilization (Within Budget: ≤90%, Near Limit: 90-100%, Over Budget: >100%)
- Portfolio statistics summary

### 7. **Export Functionality**
- Export comprehensive financial report to CSV
- Includes:
  - Portfolio summary
  - Revenue breakdown
  - Expense breakdown
  - Profitability metrics
  - Per-unit performance

## Technical Implementation

### Backend (tRPC Procedure)
**File**: `src/server/trpc/procedures/getPMDashboardFinancials.ts`

**Query**: `getPMDashboardFinancials`

**Input Parameters**:
```typescript
{
  token: string;
  periodStart?: Date;  // Defaults to start of current month
  periodEnd?: Date;    // Defaults to end of current month
  buildingId?: number; // Optional: filter by specific building
}
```

**Data Sources**:
1. **Buildings** (`Building` model)
   - Includes budgets, tenants, payments
   
2. **Rent Payments** (`RentPayment` model)
   - Filters by property manager and date range
   - Includes tenant and building information
   
3. **Contractor Payments** (`PaymentRequest` model)
   - Status: PAID
   - Within date range
   
4. **Maintenance Requests** (`MaintenanceRequest` model)
   - Property manager's requests
   - Within date range
   
5. **Orders** (`PropertyManagerOrder` model)
   - Material and labor costs
   - Within date range

**Calculations**:
- Real-time aggregation of all financial data
- Per-building calculations for detailed analysis
- Portfolio-wide totals and averages
- Trend comparison with previous period
- Performance ratios (per unit, collection rates, etc.)

### Frontend Component
**File**: `src/components/property-manager/ComprehensivePMFinancialReporting.tsx`

**Features**:
- React Query for data fetching with auto-refetch
- Recharts for data visualization
- Three-tab interface (Overview, Buildings, Performance)
- Responsive design with Tailwind CSS
- Period selection and building filtering
- CSV export functionality
- Color-coded performance indicators
- Real-time loading states

### Integration
**File**: `src/routes/property-manager/dashboard/index.tsx`

The Financial Reports tab in the Property Manager dashboard now uses `ComprehensivePMFinancialReporting` component instead of the basic `PropertyFinancialReporting`.

## Key Property Management Financial Concepts Implemented

### 1. **Net Operating Income (NOI)**
Formula: `Total Revenue - Total Operating Expenses`
- Core profitability metric in property management
- Excludes financing and capital expenditures
- Used to evaluate property performance

### 2. **Profit Margin**
Formula: `(NOI / Total Revenue) × 100`
- Indicates efficiency of operations
- Industry standard: 15%+ is excellent, 5-15% is fair, <5% needs improvement

### 3. **Occupancy Rate**
Formula: `(Occupied Units / Total Units) × 100`
- Critical performance indicator
- Target: 90%+ is excellent, 75-90% is good, <75% is concerning

### 4. **Rent Collection Rate**
Formula: `(Actual Rent Collected / Expected Rent) × 100`
- Measures effectiveness of rent collection
- Target: 95%+ is ideal

### 5. **Per-Unit Metrics**
- **Revenue per Unit**: Total Revenue / Total Units
- **Expense per Unit**: Total Expenses / Total Units
- **Net Income per Unit**: (Revenue - Expenses) / Total Units
- Used for benchmarking and comparison

### 6. **Budget Utilization**
Formula: `(Spent Amount / Budgeted Amount) × 100`
- Tracks budget performance
- Warning thresholds: >90% near limit, >100% over budget

### 7. **Portfolio Diversification**
- Tracks performance across multiple properties
- Identifies high-performers and underperformers
- Enables data-driven investment decisions

## Automatic Updates
The financial dashboard automatically updates when:
- ✅ Tenants make rent payments
- ✅ Property Manager records any customer payment
- ✅ Budget expenses are added to buildings
- ✅ Contractor payments are approved and paid
- ✅ Property Manager orders are created (materials/labor)
- ✅ Tenants are added or removed (occupancy changes)
- ✅ Building budgets are modified

All calculations are done in real-time based on actual database records - no manual entry required.

## Access
**URL**: `http://localhost:8000/property-manager/dashboard`
**Tab**: Financial Reports (BarChart3 icon)
**Role Required**: PROPERTY_MANAGER

## Usage Workflow

### Step 1: Access Dashboard
1. Log in as Property Manager
2. Navigate to Property Manager Dashboard
3. Click on "Financial Reports" tab

### Step 2: Select Period
1. Choose period: Current Month, Last Month, Quarter, YTD, or Custom
2. If Custom: Select start and end dates

### Step 3: Filter (Optional)
1. Select "All Buildings" for portfolio view
2. Or select specific building for detailed analysis

### Step 4: Explore Views
- **Overview**: Get high-level portfolio snapshot
- **Building Analysis**: Compare performance across properties
- **Performance Metrics**: Deep dive into KPIs and ratios

### Step 5: Export (Optional)
1. Click "Export Report" button
2. CSV file downloads with comprehensive data

## Future Enhancements (Optional)

### Potential Additions:
1. **Cash Flow Statement**
   - Operating, investing, financing cash flows
   - Requires: cash receipts/disbursements tracking

2. **Debt Service Coverage Ratio (DSCR)**
   - Formula: NOI / Total Debt Service
   - Requires: loan/mortgage data

3. **Cap Rate (Capitalization Rate)**
   - Formula: NOI / Property Value
   - Requires: property valuation data

4. **Return on Investment (ROI)**
   - Formula: (Gains - Costs) / Costs × 100
   - Requires: initial investment tracking

5. **Expense Ratio**
   - Formula: Operating Expenses / Total Revenue
   - Industry benchmark: 35-45%

6. **Vacancy Loss**
   - Formula: (Vacant Units × Expected Rent) / Total Expected Rent
   - Already partially implemented via occupancy rate

7. **Predictive Analytics**
   - ML-based rent forecasting
   - Maintenance cost predictions
   - Occupancy trend analysis

8. **Automated Report Scheduling**
   - Weekly/monthly email reports
   - PDF generation
   - Shareholder distribution

## Testing Checklist

### Data Validation
- [x] Revenue correctly sums tenant payments
- [x] Expenses include budget, contractor, and order costs
- [x] NOI calculated correctly (Revenue - Expenses)
- [x] Profit margin formula accurate
- [x] Occupancy rate reflects actual tenant count
- [x] Per-unit metrics divide correctly

### UI/UX
- [x] All three tabs render without errors
- [x] Charts display properly with data
- [x] Period selection updates data
- [x] Building filter works correctly
- [x] Export CSV downloads successfully
- [x] Loading states show during data fetch
- [x] Error states handled gracefully
- [x] Responsive on mobile/tablet/desktop

### Integration
- [x] Component loads in Property Manager dashboard
- [x] Tab navigation works seamlessly
- [x] No TypeScript errors
- [x] tRPC procedure registered correctly
- [x] Authentication required (PM role only)

## Summary
This comprehensive financial reporting system provides Property Managers with enterprise-grade financial analytics, enabling data-driven decision-making, improved property performance, and better investor reporting. All data updates automatically based on real transactions, ensuring accuracy and timeliness without manual reconciliation.
