# Contractor Management & Financial Reporting - Quick Start Guide

## What's New

You now have two powerful new features in your Property Manager Portal:

### 1. **Contractor Management** Tab
Complete lifecycle management for contractors with service categorization, document tracking, KPI monitoring, and spending analysis.

### 2. **Financial Reports** Tab
Comprehensive financial reporting for your properties and portfolio with income statements, balance sheets, and cash flow analysis.

---

## Getting Started

### Step 1: Apply Database Migration

Before using these features, you must update your database schema:

```bash
cd "c:\Users\Thapelo\Downloads\SQR15 Prop Management System (16)\SQR15 Prop Management System 1 12 2025"
npx prisma migrate dev --name add_contractor_financial_models
```

This will:
- Create 9 new database tables (Contractor, ContractorDocument, ContractorKPI, etc.)
- Add 3 new enums for contractor status, ratings, and document types
- Update existing User and Building tables with new relationships

### Step 2: Restart Your Application

```bash
npm run dev
# or
pnpm dev
```

### Step 3: Log in as Property Manager

Access the Property Manager Portal and you'll see two new tabs:
- **Contractors** (with briefcase icon)
- **Financial Reports** (with bar chart icon)

---

## Feature Overview

## Contractors Tab

### Managing Contractors

#### Add a New Contractor
1. Click "Contractors" tab
2. Click "Add Contractor" button
3. Fill in:
   - Name (required)
   - Email (required)
   - Phone Number (required)
   - Select Service Types (e.g., Plumbing, Electrical, HVAC)
   - Bank Details (account number, branch code)
   - Password (for contractor portal access - future feature)
4. Click "Add"

#### Edit Contractor
- Click the edit icon on contractor card
- Modify details
- Save changes

#### Delete Contractor
- Click delete icon
- Confirm deletion
- Contractor marked as ARCHIVED (data preserved)

### Documents Tab

#### Upload Contractor Documents
1. Click "Documents" sub-tab
2. Select contractor from dropdown
3. Choose document type:
   - Contract
   - ID Document
   - Qualification
   - Certificate
   - Performance Review
   - Warning Letter
   - Other
4. Drag-and-drop file or browse
5. Add title and optional expiry date
6. Click "Upload"

#### Manage Documents
- View all documents with upload dates
- See expiry warnings (red indicator = expired)
- Download documents
- Delete documents (confirmation required)

### KPIs Tab

#### Create Performance KPI
1. Click "KPIs" sub-tab
2. Click "Create KPI"
3. Fill in:
   - KPI Name (e.g., "On-Time Delivery %")
   - Description
   - Target Value (e.g., 95)
   - Unit (e.g., "%")
   - Frequency: Daily, Weekly, Monthly, Quarterly, or Yearly
   - Period Start and End dates
4. Click "Create"

#### Track KPI Progress
- View all KPIs with current achievement rates
- See color-coded status (green = on track, red = behind)
- Edit or delete KPIs as needed

### Performance Tab

#### View Contractor Performance
- **Performance Metrics Dashboard**:
  - Jobs Completed (count)
  - On-Time Completion % (chart)
  - Quality Rating (1-5 stars)
  - Response Time (hours)
  
- **Comparison Charts**:
  - Individual contractor vs. portfolio average
  - Historical trends (month-over-month)

- **Overall Rating**:
  - EXCELLENT, GOOD, AVERAGE, or POOR
  - Based on aggregated metrics

- **Export**:
  - Download performance report

### Spending Tab

#### Analyze Contractor Spending
- **Dashboard Widgets**:
  - Total Spending (all contractors)
  - Spending by Contractor (card view with rankings)
  - Cost Per Job
  - Spending Trends (line chart)

- **Top Spenders**:
  - Ranked list of contractors by spend
  - Average cost per job
  - Total jobs completed

- **Export**:
  - Download spending analysis

---

## Financial Reports Tab

### Report Types

#### 1. Income Statement
Shows how much profit your property/portfolio made

**Key Metrics**:
- **Total Income**: Rental income + maintenance fees + other income
- **Total Expenses**: All costs (maintenance, utilities, tax, insurance, staff, contractors)
- **Operating Profit**: Income minus expenses
- **Profit Margin %**: How much of every rent dollar is profit

**Breakdown by Category**:
- Income: Rental, Maintenance Fees, Other
- Expenses: Maintenance, Utilities, Property Tax, Insurance, Staff Salaries, Contractor Payments

**Features**:
- Period-to-period comparison
- Trend visualization (area chart)
- Month-by-month detail table

#### 2. Balance Sheet
Shows what you own vs. what you owe

**Assets** (What You Own):
- Properties
- Deposits
- Other Assets
- **Total Assets**

**Liabilities** (What You Owe):
- Mortgages
- Loans
- Other Debts
- **Total Liabilities**

**Equity** (Your Net Worth):
- **Total Equity** = Assets - Liabilities

**Key Metrics**:
- Debt-to-Equity Ratio
- Return on Assets (ROA)
- Property Count
- Average Occupancy Rate

#### 3. Cash Flow
Shows the actual movement of money in and out

**Operating Activities** (Day-to-day business):
- Net income adjustments
- Working capital changes
- **Operating Cash Flow**

**Investing Activities** (Long-term investments):
- Capital expenditures
- Asset sales
- **Investing Cash Flow**

**Financing Activities** (Debt and equity):
- Debt changes
- Equity changes
- **Financing Cash Flow**

**Summary**:
- **Net Cash Flow** = All activities combined
- Beginning and ending cash balances
- Free cash flow

### Using Financial Reports

#### 1. Select Date Range
- Use calendar picker
- Choose custom date range
- Reports show data for selected period

#### 2. Choose Report Type
- Click tabs: Income Statement / Balance Sheet / Cash Flow
- Report updates with your selection

#### 3. Review Metrics
- Top cards show key metrics with trends
- Charts visualize patterns and trends
- Tables provide detailed breakdowns

#### 4. Compare Periods
- Switch dates to compare performance
- See year-over-year trends
- Identify growth areas and concerns

#### 5. Export Reports
- Click "Export Report" button (ready for implementation)
- PDF format for printing/sharing
- CSV for spreadsheet analysis

---

## Best Practices

### Contractor Management

1. **Regular Document Updates**
   - Upload new certifications as they're obtained
   - Keep contracts current
   - Flag expired documents with warnings

2. **KPI Setting**
   - Set realistic targets
   - Review monthly
   - Adjust based on performance history

3. **Performance Tracking**
   - Record completed jobs regularly
   - Update quality ratings
   - Use performance data for negotiations

4. **Spending Analysis**
   - Monitor cost trends
   - Identify overspending contractors
   - Negotiate rates based on performance

### Financial Reporting

1. **Monthly Reviews**
   - Generate income statements monthly
   - Check balance sheet quarterly
   - Monitor cash flow weekly

2. **Trend Analysis**
   - Look for income growth areas
   - Identify rising expense categories
   - Plan for seasonal variations

3. **Budget Comparison**
   - Compare actual vs. budgeted expenses
   - Adjust budgets based on trends
   - Share with stakeholders

4. **Decision Making**
   - Use reports for contractor negotiations
   - Plan capital improvements
   - Manage refinancing needs
   - Forecast cash flow for 12 months

---

## Data Fields Reference

### Contractor Fields
- **Name**: Full name of contractor or company
- **Email**: Contact email address
- **Phone**: Contact phone number
- **Service Types**: Multi-select from available types (Plumbing, Electrical, HVAC, Carpentry, etc.)
- **Bank Details**: Account number and branch code for payments
- **Status**: ACTIVE, INACTIVE, SUSPENDED, or ARCHIVED
- **Rating**: EXCELLENT, GOOD, AVERAGE, POOR, or UNKNOWN

### Document Fields
- **Type**: CONTRACT, ID_DOCUMENT, QUALIFICATION, CERTIFICATE, PERFORMANCE_REVIEW, WARNING, OTHER
- **URL**: Uploaded file location
- **Title**: Document name/description
- **Expiry Date**: When document expires (optional)
- **Upload Date**: When file was uploaded

### KPI Fields
- **Name**: KPI description (e.g., "On-Time Delivery %")
- **Description**: Additional details
- **Target Value**: Numeric target (e.g., 95)
- **Unit**: Measurement unit (%, count, hours, etc.)
- **Frequency**: DAILY, WEEKLY, MONTHLY, QUARTERLY, or YEARLY
- **Period**: Start and end dates for KPI period

### Financial Fields
- **Period**: Date range for report (month, quarter, year)
- **Revenue**: Rental income, maintenance fees, other income
- **Expenses**: Maintenance, utilities, tax, insurance, salaries, contractors
- **Assets**: Properties, deposits, other holdings
- **Liabilities**: Mortgages, loans, other debts
- **Equity**: Net worth (Assets - Liabilities)

---

## Common Tasks

### Task: Add a New Plumber Contractor

1. Go to Contractors tab
2. Click "Add Contractor"
3. Fill in:
   - Name: "John's Plumbing Services"
   - Email: john@plumbing.co.za
   - Phone: +27 12 345 6789
   - Select "Plumbing" service type
   - Bank: Account 123456789, Branch Code 654321
4. Click "Add"

### Task: Upload Contractor License

1. Click Contractors → Documents
2. Select contractor
3. Choose "Certificate" document type
4. Upload license file
5. Enter expiry date (e.g., 31 Dec 2025)
6. Click "Upload"

### Task: Create Monthly Performance KPI

1. Click Contractors → KPIs
2. Click "Create KPI"
3. Enter:
   - Name: "Monthly Completion Rate"
   - Target: 100
   - Unit: "%"
   - Frequency: MONTHLY
   - Period: This month
4. Click "Create"

### Task: Generate Monthly Financial Report

1. Click Financial Reports tab
2. Select "Income Statement"
3. Set dates: 1st to 28th of current month
4. Review: Total Income, Total Expenses, Profit, Margin %
5. Check breakdown charts
6. Click "Export Report" when ready

### Task: Compare Spending Between Contractors

1. Click Contractors → Spending
2. View "Spending by Contractor" cards
3. See rankings sorted by total spend
4. Check "Cost Per Job" for efficiency
5. Identify top spenders for negotiation

---

## Troubleshooting

### Contractors Not Showing Up
- Ensure database migration was run
- Check that contractors were created while logged in as PROPERTY_MANAGER
- Refresh page (Ctrl+F5)

### Documents Not Uploading
- Check file size (usually limited to 10MB)
- Ensure file format is supported
- Check browser console for errors (F12)

### Financial Reports Show No Data
- Ensure financial metrics were created (usually by admin)
- Check date range includes data period
- Verify building has orders/invoices in selected period

### KPI Not Appearing
- Refresh page after creation
- Check that contractor is still active
- Verify KPI period hasn't passed end date

---

## Need Help?

### Key Files
- **Implementation Guide**: `CONTRACTOR_FINANCIAL_IMPLEMENTATION_SUMMARY.md`
- **Backend Code**: `src/server/trpc/procedures/`
- **Frontend Code**: `src/components/property-manager/`
- **Database Schema**: `prisma/schema.prisma`

### Related Documentation
- Voice Integration: `VOICE_INTEGRATION_INTEGRATION_USER_GUIDE.md`
- AI Agent Guide: `AI_AGENT_QUICK_START.md`
- Property Manager Guide: (Existing documentation)

---

## What's Coming Next

Future enhancements planned:

1. **Contractor Portal** - Contractors can log in to view their jobs, invoices, and performance
2. **Automated Exports** - PDF generation and email delivery of reports
3. **Performance Forecasting** - Predict cash flows and KPI achievement
4. **Mobile App** - Manage contractors on the go
5. **Webhook Integrations** - Connect with external accounting software

---

**Version**: 1.0  
**Last Updated**: January 2025  
**Status**: Production Ready (after database migration)
