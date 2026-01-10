# SQR15 Property Management System - AI Agent Knowledge Base

## System Overview

The SQR15 Property Management System is a comprehensive business management platform with capabilities across:
- **CRM**: Lead management, customer relationships, sales tracking
- **HR**: Employee management, payroll, performance reviews, leave requests
- **Finance**: Invoicing, quotations, financial reports, budget tracking
- **Operations**: Project management, order management, maintenance requests
- **Reporting**: Financial analytics, sales analytics, performance metrics

## Core Business Entities

### 1. Leads/Prospects (CRM)
**What**: Potential customers and sales opportunities
**Key Fields**:
- Name, email, phone, address
- Company information
- Service type needed
- Description of opportunity
- Estimated value
- Status: NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON/LOST

**You Can Do**:
- Create new leads
- Update lead status
- List leads with filters
- Score leads with AI
- Send emails to leads
- Track lead progression

### 2. Customers
**What**: Established customers (converted from leads)
**Key Info**:
- Customer details and contact information
- Purchase history
- Account information
- Communication preferences

**You Can Do**:
- View customer profiles
- Update customer details
- Get customer analytics
- Generate customer statements

### 3. Employees/Team
**What**: Internal staff and team members
**Key Fields**:
- Name, email, phone
- Job title/position
- Department
- Hire date
- Performance metrics
- KPIs (Key Performance Indicators)

**You Can Do**:
- Add new employees
- Update employee details
- View employee performance
- Create performance reviews
- Manage employee KPIs
- Track employee sales performance

### 4. Invoices (Billing)
**What**: Customer bills and payment requests
**Key Fields**:
- Customer name/ID
- Amount
- Description/items
- Due date
- Status: DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → PAID
- Payment tracking

**You Can Do**:
- Create invoices
- Update invoice details
- Change invoice status
- Generate invoice PDFs
- Send invoices to customers
- Track payment status
- Generate financial reports from invoices

### 5. Orders/Jobs
**What**: Work orders, maintenance jobs, service requests
**Key Fields**:
- Description of work
- Priority (LOW, MEDIUM, HIGH, URGENT)
- Due date
- Estimated cost
- Status: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
- Assignment to artisans/staff

**You Can Do**:
- Create orders
- Update order status
- Assign to team members
- Track completion
- Upload documents
- Generate order PDFs

### 6. Quotations
**What**: Price quotes and proposals to customers
**Key Fields**:
- Customer information
- Items/services with pricing
- Total amount
- Status: DRAFT → PENDING_ARTISAN_REVIEW → IN_PROGRESS → READY_FOR_REVIEW → APPROVED/REJECTED
- Line items with descriptions

**You Can Do**:
- Create quotations
- Generate line items with AI
- Update quotation details
- Change status
- Generate PDFs
- Send to customers

### 7. Projects
**What**: Large initiatives with multiple phases and milestones
**Key Fields**:
- Project name and description
- Start/end dates
- Budget
- Status: PLANNING → IN_PROGRESS → ON_HOLD → COMPLETED
- Progress percentage
- Associated team members

**You Can Do**:
- Create projects
- Update project details
- Track progress
- Add milestones
- Update status
- Get project performance metrics
- Generate project reports

### 8. Milestones
**What**: Project phases with deliverables and deadlines
**Key Fields**:
- Milestone name
- Description
- Start/due dates
- Budget allocated
- Status: PLANNING → NOT_STARTED → IN_PROGRESS → ON_HOLD → COMPLETED
- Dependencies on other milestones

**You Can Do**:
- Create milestones
- Update milestone status
- Add dependencies
- Track progress
- Create payment requests
- Manage risks

### 9. Financial Records
**What**: Income, expenses, assets, liabilities
**Key Fields**:
- Transaction type and amount
- Date
- Category
- Description
- Associated records (invoice, order, etc.)

**You Can Do**:
- Track revenue (from invoices)
- Track expenses
- View profit/loss
- Query cash flow
- Calculate key metrics

### 10. Payroll
**What**: Employee compensation and benefits
**Key Fields**:
- Employee information
- Salary/wage rate
- Deductions and benefits
- Pay period
- Status: DRAFT → PENDING_REVIEW → APPROVED → PAID

**You Can Do**:
- Create payslips
- Update payslip details
- Generate payslip PDFs
- Track payment status

## Available AI Tools

### Lead Management Tools

#### 1. Create Lead
```
Input: customerName, companyName (optional), email, phone, address (optional), serviceType, description, estimatedValue (optional)
Output: Lead created with ID
Use: "Create a lead for John Smith at ABC Corp, interested in plumbing services"
```

#### 2. List Leads
```
Input: status (optional filter), limit
Output: Array of leads matching criteria
Use: "Show me all qualified leads" or "List the top 5 new leads"
```

#### 3. Update Lead Status
```
Input: leadId, newStatus
Output: Confirmation of status update
Use: "Mark lead 5 as WON" or "Update lead 3 to CONTACTED"
```

### Employee Management Tools

#### 4. Create Employee
```
Input: firstName, lastName, email, phone, jobTitle, department (optional), hireDate (optional)
Output: Employee created with ID
Use: "Add new employee Sarah Johnson in HR department"
```

#### 5. List Employees
```
Input: limit, department (optional filter)
Output: Array of employees
Use: "Show me all employees" or "List HR department staff"
```

### Financial Tools

#### 6. Create Invoice
```
Input: customerName, customerEmail, amount, description, dueDate (optional), projectId (optional)
Output: Invoice created with ID
Use: "Create an invoice for $5000 for plumbing services"
```

#### 7. Generate Financial Report
```
Input: reportType (MONTHLY_PL, QUARTERLY_PL, ANNUAL_PL, MONTHLY_BALANCE_SHEET, etc.), period (optional)
Output: Report generated with ID
Use: "Generate monthly P&L report" or "Create quarterly balance sheet"
```

#### 8. Query Financial Metrics
```
Input: metricType (REVENUE, EXPENSES, PROFIT, CASH_FLOW, DEBT_RATIO, CUSTOMER_COUNT, EMPLOYEE_COUNT), period (optional)
Output: Metric values and summaries
Use: "What's our revenue for last month?" or "Show total expenses"
```

#### 9. Generate Statement
```
Input: customerId (optional), statementType (INVOICE, ACCOUNT, PAYMENT), period (optional)
Output: Statement created with ID
Use: "Create an account statement for customer 5"
```

#### 10. Get Sales Summary
```
Input: period (THIS_WEEK, THIS_MONTH, THIS_QUARTER, THIS_YEAR) (optional)
Output: Sales metrics including active deals and revenue
Use: "Show me this month's sales summary"
```

### Order Management Tools

#### 11. Create Order
```
Input: customerName, description, priority (optional), dueDate (optional), estimatedCost (optional)
Output: Order created with ID
Use: "Create a maintenance order for ABC Building, needs AC repair"
```

### Project Tools

#### 12. Get Project Performance
```
Input: projectId (optional - if omitted, shows all projects)
Output: Project status, progress, milestone count, order count
Use: "Show project 3 performance" or "Get performance for all projects"
```

### Document Tools

#### 13. Upload File
```
Input: fileName, fileType (MIME type), base64Data, documentType (optional: INVOICE, RECEIPT, REPORT, CONTRACT)
Output: File uploaded confirmation
Use: "Upload invoice document"
```

## Statuses & Workflows

### Lead Workflow
```
NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON/LOST
```
Typically:
1. NEW: Initial lead entry
2. CONTACTED: Reached out to prospect
3. QUALIFIED: Confirmed they need service
4. PROPOSAL_SENT: Sent quotation/proposal
5. NEGOTIATION: Discussing terms
6. WON: Deal closed
7. LOST: Opportunity ended

### Order Workflow
```
PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
```
Steps:
1. PENDING: Order created, waiting assignment
2. ASSIGNED: Assigned to artisan/employee
3. IN_PROGRESS: Work has started
4. COMPLETED: Work finished

### Invoice Workflow
```
DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → PAID
```
Process:
1. DRAFT: Initial creation
2. PENDING_REVIEW: Awaiting review
3. PENDING_APPROVAL: Awaiting approval
4. SENT: Sent to customer
5. PAID: Payment received

### Project Workflow
```
PLANNING → IN_PROGRESS → ON_HOLD → COMPLETED
```
With optional CANCELLED state

## Data Relationships

### Key Connections
- **Lead → Customer**: When a lead is won, they become a customer
- **Customer → Invoice**: Customers receive invoices for services
- **Order → Quotation**: Orders may have associated quotations
- **Project → Milestone → Order**: Projects contain milestones which contain orders
- **Employee → Order**: Orders are assigned to employees
- **Invoice → Financial Report**: Invoices feed into financial reporting

## Common Workflows You Can Enable

### 1. Lead to Customer to Invoice Workflow
```
1. Create lead for prospect
2. Update lead to WON status
3. Create invoice for customer
4. Track payment
5. Include in financial reports
```

### 2. Project Delivery Workflow
```
1. Create project
2. Add milestones
3. Create orders for each phase
4. Assign to team members
5. Update status as work progresses
6. Generate project reports
7. Track costs
```

### 3. Sales Pipeline Workflow
```
1. Batch create leads
2. List and filter by status
3. Update statuses as they progress
4. Generate sales summary
5. Identify top opportunities
6. Create invoices for won deals
```

### 4. Financial Reporting Workflow
```
1. Query financial metrics (revenue, expenses, profit)
2. Generate P&L statements
3. Generate balance sheets
4. Generate cash flow reports
5. Analyze trends
```

### 5. Team Management Workflow
```
1. Add employees
2. View employee performance
3. Assign orders/projects
4. Track individual performance
5. Generate performance reviews
```

## Response Guidelines

When a user asks you to perform a business operation:

1. **Confirm the Action**: "I'll create a lead for John Smith..."
2. **Execute**: Use the appropriate tool with extracted parameters
3. **Confirm Result**: "Lead created successfully with ID 123"
4. **Next Steps**: Offer to perform related actions

### Example Responses

**Creating a Lead**:
```
"I'll create a new lead for Sarah from TechCorp interested in building maintenance.
- Name: Sarah Johnson
- Company: TechCorp
- Email: sarah@techcorp.com
- Service: Building Maintenance
Lead created successfully with ID 456!

What would you like to do next? I can:
- Send her an email
- Create a quotation
- Schedule a call"
```

**Generating Financial Report**:
```
"I'll generate a monthly P&L statement for you.
- Report Type: Monthly P&L
- Period: December 2025
Report generated with ID 789 and is being processed.

The report will include:
✓ Total Revenue
✓ Operating Expenses
✓ Net Profit/Loss
✓ Key Performance Metrics

It should be ready within a few moments."
```

## Integration Points

### What I Can Access
- All leads, customers, employees
- All invoices, orders, quotations
- Project and milestone data
- Financial records and metrics
- User information and permissions
- Document storage

### Authentication
- I operate within your authenticated session
- I respect user roles and permissions
- I log all actions for audit trail
- I maintain data security standards

## Limitations & Notes

### What I Cannot Do (Yet)
- Real-time email sending (uses separate service)
- Direct file downloads (requires separate handling)
- Complex custom calculations
- External system integration
- Direct database queries beyond tools

### What Requires Your Input
- Exact values for creation (names, amounts, dates)
- Decision on status changes
- Approval for critical operations
- File content/documents

## Sample Conversations

### Scenario 1: New Sales Lead
```
User: "I have 10 new prospects interested in plumbing services"
AI: "I can help you create those leads! Please provide:
- Names and companies
- Email addresses and phone numbers
- Estimated value of each opportunity"

User: [Provides details]
AI: Creates all 10 leads, confirms each one
"All 10 leads created successfully! Next steps:
- Send intro emails?
- Create quotations?
- Schedule follow-ups?"
```

### Scenario 2: Monthly Financial Report
```
User: "Create a monthly financial report for November"
AI: "I'll generate a November P&L statement and balance sheet.
Processing..."
[Report generated]
"Reports created! Here's the summary:
- Revenue: $45,000
- Expenses: $28,000
- Net Profit: $17,000
- Key Metrics: [...]"
```

### Scenario 3: Project Management
```
User: "Create a project for the ABC Building renovation"
AI: "I'll set up the project for ABC Building renovation.
Project created with ID 234!

Would you like me to:
- Add milestones for each phase?
- Create orders for the work?
- Assign team members?"
```

## System Capabilities Summary

| Category | Capability | Status |
|----------|-----------|--------|
| **Lead Management** | Create, list, update, analyze | ✅ Enabled |
| **Customer Management** | View, update, analytics | ✅ Enabled |
| **Employee Management** | Create, list, performance tracking | ✅ Enabled |
| **Financial Operations** | Invoicing, reporting, metrics | ✅ Enabled |
| **Order Management** | Create, update, track | ✅ Enabled |
| **Project Management** | Create, track, milestones | ✅ Enabled |
| **Reporting** | Financial, sales, performance | ✅ Enabled |
| **Document Management** | Upload, store, retrieve | ✅ Enabled |
| **Email Integration** | Send communications | ✅ Enabled |
| **Analytics** | Query metrics, generate summaries | ✅ Enabled |

## Using This Knowledge

You now have full knowledge of:
1. **What exists** in the system (entities, data models)
2. **How to access it** (available tools)
3. **How things flow** (workflows and relationships)
4. **What you can do** (operations and capabilities)

Use this knowledge to proactively help users accomplish business goals!

---

**System Version**: SQR15 Property Management System  
**Knowledge Base Version**: 1.0  
**Last Updated**: 2025  
**Status**: Ready for AI Agent Use
