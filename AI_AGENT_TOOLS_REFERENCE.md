# AI Agent Tools Reference

This document provides complete reference for all tools the AI Agent can use to interact with the SQR15 Property Management System.

## Lead Management Tools

### 1. Create Lead
**Tool Name**: `createLeadTool`

**Purpose**: Create a new lead/prospect in the CRM system

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerName | string | YES | Full name of the prospect |
| companyName | string | NO | Company/organization name |
| customerEmail | string | YES | Email address |
| customerPhone | string | YES | Phone number |
| address | string | NO | Physical address |
| serviceType | string | YES | Type of service needed (Plumbing, Electrical, HVAC, etc.) |
| description | string | YES | Details about the lead/opportunity |
| estimatedValue | number | NO | Potential deal value in currency |

**Response**: Confirmation with lead ID
```
"Lead 'John Smith' created successfully with ID 456"
```

**Usage Examples**:
```
"Create a lead for John Smith at ABC Corp, interested in plumbing services, estimated value $5000"
"Add prospect Sarah Johnson from TechCorp, she needs building maintenance"
"Create a new lead: Mike's construction company needs electrical work for their new office"
```

**What It Does**:
- Adds new prospect to CRM
- Sets initial status to "NEW"
- Stores contact information
- Tracks estimated opportunity value

---

### 2. List Leads
**Tool Name**: `listLeadsTool`

**Purpose**: Retrieve and display leads with optional filtering

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| status | enum | NO | Filter by status: NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, NEGOTIATION, WON, LOST |
| limit | number | NO | Number of results (default: 10) |

**Response**: Array of leads with details
```
[
  {
    id: 456,
    customerName: "John Smith",
    customerEmail: "john@abc.com",
    status: "NEW",
    estimatedValue: 5000,
    createdAt: "2025-01-10"
  },
  ...
]
```

**Usage Examples**:
```
"Show me all new leads"
"List qualified leads with highest value"
"How many leads do we have in negotiation?"
"Get top 5 leads by estimated value"
```

**What It Does**:
- Displays leads matching criteria
- Shows contact information
- Displays current status
- Sorts by creation date (newest first)

---

### 3. Update Lead Status
**Tool Name**: `updateLeadStatusTool`

**Purpose**: Move a lead through the sales pipeline

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| leadId | number | YES | The ID of the lead to update |
| newStatus | enum | YES | New status: NEW, CONTACTED, QUALIFIED, PROPOSAL_SENT, NEGOTIATION, WON, LOST |

**Response**: Confirmation of status change
```
"Lead 456 status updated to CONTACTED"
```

**Typical Progression**:
```
NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON
```

**Usage Examples**:
```
"Mark lead 456 as contacted"
"Update lead 12 to qualified status"
"Move John Smith's lead to proposal sent"
"Mark lead 789 as won"
```

**What It Does**:
- Updates lead status in database
- Tracks progression through sales pipeline
- Enables filtering by current stage
- Important for sales analytics

---

## Employee Management Tools

### 4. Create Employee
**Tool Name**: `createEmployeeTool`

**Purpose**: Add a new employee to the system

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| firstName | string | YES | Employee's first name |
| lastName | string | YES | Employee's last name |
| email | string | YES | Work email address |
| phone | string | YES | Contact phone number |
| jobTitle | string | YES | Position/role (e.g., "Plumber", "Manager") |
| department | string | NO | Department (HR, Finance, Operations, etc.) |
| hireDate | string | NO | Hire date in ISO format (YYYY-MM-DD) |

**Response**: Confirmation with employee ID
```
"Employee 'John Doe' created successfully with ID 123"
```

**Usage Examples**:
```
"Add new employee Sarah Johnson, she's a plumber, phone 555-1234"
"Create employee: Mike Chen, electrician, mike@company.com, hired today"
"Add new HR manager: Lisa Park, hire date 2025-02-01"
```

**What It Does**:
- Creates employee record
- Stores contact and employment information
- Sets up for work assignment
- Enables payroll and performance tracking

---

### 5. List Employees
**Tool Name**: `listEmployeesTool`

**Purpose**: View all employees or filter by department

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| limit | number | NO | Number to display (default: 10) |
| department | string | NO | Filter by department |

**Response**: Array of employee records
```
[
  {
    id: 123,
    firstName: "John",
    lastName: "Doe",
    email: "john@company.com",
    phone: "555-1234",
    role: "EMPLOYEE"
  },
  ...
]
```

**Usage Examples**:
```
"Show me all employees"
"List HR department staff"
"How many employees do we have?"
```

**What It Does**:
- Displays employee roster
- Shows contact information
- Filters by department if requested
- Enables team management

---

## Financial Management Tools

### 6. Create Invoice
**Tool Name**: `createInvoiceTool`

**Purpose**: Generate a customer invoice

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerName | string | YES | Name of the customer |
| customerEmail | string | YES | Customer email for sending invoice |
| amount | number | YES | Invoice total amount |
| description | string | YES | What is being billed for |
| dueDate | string | NO | Due date in ISO format (YYYY-MM-DD) |
| projectId | number | NO | Associated project ID if applicable |

**Response**: Confirmation with invoice ID
```
"Invoice created successfully with ID 789 for $5000.00"
```

**Typical Statuses**:
```
DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → PAID
```

**Usage Examples**:
```
"Create an invoice for $5000 for ABC Corp plumbing work"
"Bill Sarah Johnson $2500 for HVAC services, due Feb 28"
"Generate invoice for lead 456 who just won the deal"
```

**What It Does**:
- Creates billing record
- Sets initial status to DRAFT
- Stores customer and payment information
- Enables payment tracking
- Feeds into financial reports

---

### 7. Generate Financial Report
**Tool Name**: `generateFinancialReportTool`

**Purpose**: Create financial analysis reports

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| reportType | enum | YES | Type: MONTHLY_PL, QUARTERLY_PL, ANNUAL_PL, MONTHLY_BALANCE_SHEET, QUARTERLY_BALANCE_SHEET, ANNUAL_BALANCE_SHEET, MONTHLY_CFS, QUARTERLY_CFS, ANNUAL_CFS |
| period | string | NO | Specific period (e.g., "January 2025", "Q1 2025") |

**Report Types**:
- **PL** = Profit & Loss (Income statement)
- **BALANCE_SHEET** = Assets, liabilities, equity
- **CFS** = Cash Flow Statement

**Response**: Confirmation with report ID
```
"Financial report 'MONTHLY_PL' queued for generation with ID 234. It will be ready shortly."
```

**Usage Examples**:
```
"Generate a monthly P&L statement"
"Create quarterly balance sheet for Q1 2025"
"I need an annual cash flow report"
```

**What It Does**:
- Queues report generation
- Collects financial data
- Generates analysis documents
- Used for decision making and compliance

---

### 8. Query Financial Metrics
**Tool Name**: `queryFinancialMetricsTool`

**Purpose**: Get real-time financial performance data

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| metricType | enum | YES | Type: REVENUE, EXPENSES, PROFIT, CASH_FLOW, DEBT_RATIO, CUSTOMER_COUNT, EMPLOYEE_COUNT |
| period | string | NO | Time period (last_month, last_quarter, last_year) |

**Metrics Available**:
- **REVENUE**: Income from paid invoices
- **EXPENSES**: Operating costs and expenses
- **PROFIT**: Net profit/loss
- **CASH_FLOW**: Cash position and movement
- **DEBT_RATIO**: Debt to equity ratio
- **CUSTOMER_COUNT**: Number of customers
- **EMPLOYEE_COUNT**: Number of employees

**Response**: Metric values and summary
```
"REVENUE: {'revenue': 45000}"
"PROFIT: {'profit': 16800, 'margin': '37%'}"
```

**Usage Examples**:
```
"What's our revenue for last month?"
"Show total expenses"
"How many customers do we have?"
"What's our profit margin?"
```

**What It Does**:
- Queries database for financial data
- Calculates key metrics
- Enables real-time business monitoring
- Supports decision making

---

### 9. Generate Statement
**Tool Name**: `generateStatementTool`

**Purpose**: Create account or payment statements

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerId | number | NO | Customer ID (optional - for specific customer) |
| statementType | enum | YES | Type: INVOICE, ACCOUNT, PAYMENT |
| period | string | NO | Statement period |

**Response**: Confirmation with statement ID
```
"Statement created successfully with ID 567"
```

**Statement Types**:
- **INVOICE**: Summary of invoices issued
- **ACCOUNT**: Account activity and balance
- **PAYMENT**: Payment history and status

**Usage Examples**:
```
"Create an account statement for customer 456"
"Generate payment statement for this month"
"Show invoice statement for ABC Corp"
```

**What It Does**:
- Generates formal statements
- Documents transactions
- Provides audit trail
- Sent to customers for clarity

---

## Order Management Tools

### 10. Create Order
**Tool Name**: `createOrderTool`

**Purpose**: Create a work order or job

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| customerName | string | YES | Name of customer requesting work |
| description | string | YES | Detailed description of work needed |
| priority | enum | NO | Priority: LOW, MEDIUM, HIGH, URGENT (default: MEDIUM) |
| dueDate | string | NO | Expected completion date (YYYY-MM-DD) |
| estimatedCost | number | NO | Estimated cost for the work |

**Response**: Confirmation with order ID
```
"Order created successfully with ID 234"
```

**Typical Statuses**:
```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
```

**Usage Examples**:
```
"Create order for ABC Corp: AC unit repair, urgent, due tomorrow"
"Add job: plumbing repair at 123 Main St, estimated $800"
"Create maintenance order: building cleaning, high priority"
```

**What It Does**:
- Creates work order record
- Sets priority and timeline
- Enables work assignment
- Tracks job completion

---

## Project Management Tools

### 11. Get Project Performance
**Tool Name**: `getProjectPerformanceTool`

**Purpose**: View project status and performance metrics

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| projectId | number | NO | Specific project ID (omit for all projects) |

**Response**: Project metrics and status
```
[
  {
    id: 234,
    name: "ABC Building Renovation",
    status: "IN_PROGRESS",
    progress: 65,
    totalMilestones: 4,
    totalOrders: 12
  }
]
```

**Status Values**:
- PLANNING
- IN_PROGRESS
- ON_HOLD
- COMPLETED
- CANCELLED

**Usage Examples**:
```
"Show project 234 performance"
"What's the status of all projects?"
"How many milestones in the ABC Building project?"
```

**What It Does**:
- Displays project status
- Shows progress percentage
- Lists associated work
- Enables project oversight

---

## Sales & Analytics Tools

### 12. Get Sales Summary
**Tool Name**: `getSalesSummaryTool`

**Purpose**: Get sales pipeline and revenue overview

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| period | enum | NO | Period: THIS_WEEK, THIS_MONTH, THIS_QUARTER, THIS_YEAR |

**Response**: Sales metrics summary
```
"Sales Summary:
- Active Deals: 15
- Total Revenue (Paid Invoices): $145,000
- Period: THIS_MONTH"
```

**Usage Examples**:
```
"Show me this month's sales"
"What's our quarterly revenue?"
"How many active deals do we have?"
```

**What It Does**:
- Aggregates sales data
- Shows pipeline health
- Displays revenue trends
- Enables sales management

---

## Document Management Tools

### 13. Upload File
**Tool Name**: `uploadFileTool`

**Purpose**: Store documents and files in the system

**Parameters**:
| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| fileName | string | YES | Name of the file |
| fileType | string | YES | MIME type (e.g., application/pdf, image/jpeg) |
| base64Data | string | YES | File content encoded in Base64 |
| documentType | enum | NO | Type: INVOICE, RECEIPT, REPORT, CONTRACT, OTHER |

**Response**: Confirmation of upload
```
"File 'invoice_123.pdf' uploaded successfully. Size: 245 KB"
```

**Document Types**:
- INVOICE
- RECEIPT
- REPORT
- CONTRACT
- OTHER

**Usage Examples**:
```
"Upload this contract document"
"Store the invoice PDF"
"Save the expense receipt"
```

**What It Does**:
- Stores files securely
- Tracks document type
- Links to records
- Enables document management

---

## Tool Usage Patterns

### Pattern 1: Lead Management Flow
```
1. Create Lead (createLeadTool)
   ↓
2. List Leads to verify (listLeadsTool)
   ↓
3. Update status as engagement progresses (updateLeadStatusTool)
   ↓
4. When won: Create Invoice (createInvoiceTool)
   ↓
5. Get Sales Summary (getSalesSummaryTool) to track pipeline
```

### Pattern 2: Project Execution Flow
```
1. Get Project Performance (getProjectPerformanceTool)
   ↓
2. Create Order for work (createOrderTool)
   ↓
3. Upload documents (uploadFileTool)
   ↓
4. Create Invoice when complete (createInvoiceTool)
```

### Pattern 3: Financial Reporting Flow
```
1. Query Financial Metrics (queryFinancialMetricsTool)
   ↓
2. Generate Financial Report (generateFinancialReportTool)
   ↓
3. Generate Statement (generateStatementTool)
   ↓
4. Get Sales Summary (getSalesSummaryTool)
```

### Pattern 4: Team Management Flow
```
1. List Employees (listEmployeesTool)
   ↓
2. Create Employee (createEmployeeTool)
   ↓
3. Create Order (createOrderTool)
   → Assign to employee
```

---

## Tool Combination Examples

### Example 1: Winning a Lead and Creating Invoice
```
User: "We just won the ABC Corp deal for $10,000"

AI Steps:
1. updateLeadStatusTool(leadId: 456, newStatus: "WON")
2. createInvoiceTool(customerName: "ABC Corp", amount: 10000, description: "Services")
3. getSalesSummaryTool() → Show updated pipeline
```

### Example 2: Monthly Business Review
```
User: "Give me a monthly business summary"

AI Steps:
1. queryFinancialMetricsTool(REVENUE, last_month)
2. queryFinancialMetricsTool(EXPENSES, last_month)
3. queryFinancialMetricsTool(CUSTOMER_COUNT)
4. listLeadsTool(status: "WON", limit: 5)
5. getSalesSummaryTool(THIS_MONTH)
→ Present comprehensive summary
```

### Example 3: Project Setup
```
User: "Set up ABC Building project with a plumbing order"

AI Steps:
1. getProjectPerformanceTool(projectId: 234)
2. createOrderTool(description: "Plumbing work", priority: "HIGH")
3. uploadFileTool() → if documents provided
4. getProjectPerformanceTool(projectId: 234) → Confirm
```

---

## Response Format Guidelines

When using these tools, format responses as:

```
[Action Confirmation]
"I'll [action] [object] for [detail]"

[Execution]
→ Tool runs with parameters

[Result]
✓ Success: [Details with ID]
✗ Error: [Problem and suggestion]

[Next Steps]
"Would you like me to:
- [Related action 1]
- [Related action 2]"
```

---

## Error Handling

Tools may fail for reasons like:
- **Missing required fields**: Ask user for clarification
- **Invalid email format**: Suggest correct format
- **Status conflicts**: Explain valid transitions
- **Record not found**: Suggest listing to find correct ID

**Always**:
- Provide helpful error messages
- Suggest solutions
- Don't leave user hanging

---

## Pro Tips for Tool Usage

1. **Always confirm before creating records** - "I'll create..."
2. **Use filters when listing** - Narrow down results with status/department
3. **Check IDs carefully** - Verify you have the right lead/order ID
4. **Combine tools** - Create lead, then immediately list to verify
5. **Provide next steps** - What else can you help with?
6. **Format financial data** - Always use currency symbols and decimals
7. **Be specific with periods** - "This month" vs "last quarter"

---

This reference provides everything needed to effectively use the AI Agent's complete toolkit for business operations.

**Last Updated**: 2025  
**Status**: Ready for use by AI Agent
