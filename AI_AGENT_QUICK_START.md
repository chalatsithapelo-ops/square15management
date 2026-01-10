# AI Agent - Quick Reference & Common Tasks

## Quick Start: How to Use the AI Agent

The AI Agent is now fully trained on the SQR15 Property Management System and can help you with business operations. Just ask it to do things!

### Basic Commands

**Lead Management**:
- "Create a new lead for John Smith"
- "Show me all qualified leads"
- "Mark lead 456 as won"
- "How many new leads do we have?"

**Employee Management**:
- "Add new employee Sarah Johnson"
- "List all employees"
- "Who works in the HR department?"

**Financial Operations**:
- "Create an invoice for $5000"
- "Generate a monthly P&L statement"
- "What's our revenue for this month?"
- "Show me the sales summary"

**Work Orders**:
- "Create a maintenance order for ABC Building"
- "List all pending orders"
- "What's the status of order 123?"

**Projects**:
- "Show project 5 performance"
- "Get status of all projects"
- "How many milestones are in this project?"

---

## Common Workflows

### Workflow 1: Converting a Lead to Revenue

**Step 1 - Create the Lead**
```
User: "I have a prospect named John Smith from ABC Corp. They need plumbing services."
AI: Creates lead with details, returns ID
```

**Step 2 - Track Engagement**
```
User: "I contacted John today, he's interested."
AI: Updates lead status to CONTACTED
```

**Step 3 - Qualify the Lead**
```
User: "John confirmed they need the work, estimate $5000."
AI: Updates lead status to QUALIFIED
```

**Step 4 - Send Proposal**
```
User: "I'm sending John a proposal tomorrow."
AI: Updates lead status to PROPOSAL_SENT
```

**Step 5 - Close the Deal**
```
User: "John approved! We have the deal!"
AI: Updates lead status to WON
```

**Step 6 - Create Invoice**
```
User: "Invoice John Smith for the plumbing work, $5000."
AI: Creates invoice, returns ID
```

**Result**: Lead converted to customer, invoice generated, revenue tracked

---

### Workflow 2: Monthly Business Review

**Get Quick Stats**
```
User: "Give me a business summary for this month"
AI Actions:
- Queries revenue (from paid invoices)
- Queries expenses
- Queries customer count
- Gets sales pipeline status
- Lists top won deals

Response: Complete monthly overview with all metrics
```

---

### Workflow 3: Managing a Project

**Setup**
```
User: "We're starting ABC Building renovation project"
AI: 
- Creates project
- Asks about milestones and timeline
```

**Add Work**
```
User: "Add a plumbing order for phase 1"
AI:
- Creates order
- Links to project
- Sets priority and timeline
```

**Track Progress**
```
User: "What's the status of the ABC Building project?"
AI:
- Shows project progress
- Lists milestones
- Shows orders/work items
- Calculates completion %
```

**Complete & Invoice**
```
User: "The plumbing work is done, invoice them"
AI:
- Updates order status to COMPLETED
- Creates invoice
- Updates project progress
```

---

### Workflow 4: Sales Team Management

**Setup Your Team**
```
User: "Add a new salesperson, Maria Garcia"
AI: Creates employee record
```

**Assign Leads**
```
User: "Show me the new leads"
AI: Lists all new leads
User: "Assign lead 456 to Maria"
AI: Can help by listing lead details
```

**Track Performance**
```
User: "How is our sales pipeline looking?"
AI: Shows:
- Total leads by status
- Won deals this month
- Revenue generated
- Active negotiations
```

**Bonus**
```
User: "Show leads assigned to Maria"
AI: Can query and display specific results
```

---

### Workflow 5: Financial Analysis

**Generate Reports**
```
User: "Create a quarterly P&L statement"
AI: Generates report with:
- Revenue summary
- Expense breakdown
- Profit/loss
- Key metrics
```

**Query Metrics**
```
User: "How much profit did we make last month?"
AI: Queries database and responds:
- Revenue: $45,000
- Expenses: $28,000
- Profit: $17,000
```

**Cash Analysis**
```
User: "What's our cash position?"
AI: Shows:
- Cash flow statement
- Current cash
- Receivables (due from customers)
- Payables (amount owed)
```

---

## What the AI Agent Understands

### Entities It Knows About:
✓ **Leads** - Prospects and sales opportunities  
✓ **Customers** - Established clients  
✓ **Employees** - Team members  
✓ **Orders** - Work orders and jobs  
✓ **Invoices** - Customer billing  
✓ **Projects** - Large initiatives  
✓ **Milestones** - Project phases  
✓ **Financial Records** - Income and expenses  
✓ **Documents** - Files and attachments  

### Status Workflows It Knows:
✓ **Leads**: NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON/LOST  
✓ **Orders**: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED  
✓ **Invoices**: DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → PAID  
✓ **Projects**: PLANNING → IN_PROGRESS → ON_HOLD → COMPLETED  

### Operations It Can Perform:
✓ Create records (leads, employees, invoices, orders)  
✓ List and filter records (by status, date, type)  
✓ Update statuses (move records through workflows)  
✓ Generate reports (financial, sales, project)  
✓ Query metrics (revenue, expenses, counts)  
✓ Upload documents  
✓ Generate statements  

---

## Tips for Best Results

### 1. Be Specific
**Good**: "Create an invoice for $5000 for John Smith at ABC Corp for plumbing services"  
**Poor**: "Make an invoice"

### 2. Provide All Details
The AI will ask for missing information:
- When creating leads: name, email, phone, service type
- When creating invoices: customer, amount, description
- When creating orders: description, priority, due date

### 3. Use Lead IDs When Available
**Good**: "Update lead 456 to qualified"  
**Poor**: "Mark the ABC Corp lead as qualified" (AI will need to look it up)

### 4. Reference Previous Records
**Good**: "Create an invoice for the customer from lead 456"  
**Poor**: "Create an invoice... [without context]"

### 5. Ask for Summaries
**Good**: "Give me this month's business summary"  
**Good**: "What's our sales pipeline looking like?"  
**Good**: "Show me all high-priority orders"

### 6. Use Natural Language
The AI understands English naturally:
- "I just won a deal with John for $5000"
- "We need to do maintenance work at ABC Building"
- "How many employees do we have?"
- "What's our profit margin?"

---

## Sample Conversations

### Conversation 1: New Prospect
```
You: "I met with Sarah Johnson from TechCorp today. They need building maintenance, 
      estimated value $8000. Can you create a lead?"

AI: "I'll create a new lead for Sarah Johnson at TechCorp.
- Name: Sarah Johnson
- Company: TechCorp
- Email: [asks if you have it]
- Service: Building Maintenance
- Estimated Value: $8,000

Creating... Lead 567 created successfully!

Next steps:
- Send her an intro email?
- Create a quotation?
- Schedule a follow-up?"
```

### Conversation 2: Monthly Review
```
You: "Give me a business summary for this month"

AI: "Generating your December business summary...

SALES PIPELINE:
- New leads: 8
- Contacted: 5
- Qualified: 3
- Negotiation: 2
- Won: 4 deals (Estimated: $28,000)

FINANCIAL SUMMARY:
- Revenue (Paid): $42,500
- Pending Invoices: $15,300
- Expenses: $25,000
- Net Profit: $17,500 (41% margin)

KEY METRICS:
- Total Customers: 47
- Active Employees: 12
- Active Projects: 3

TOP PERFORMERS:
- Lead 456 (ABC Corp) - $10,000 potential
- Lead 234 (Tech Services) - $8,000 potential

Next Actions:
- Create invoices for the 4 won deals?
- Follow up on 3 qualified leads?
- Review project statuses?"
```

### Conversation 3: Project Management
```
You: "Set up the Downtown Project with phase 1 plumbing work"

AI: "I'll set up the Downtown Project.
- Project created with ID 890
- Initial status: PLANNING

Now I'll add the phase 1 plumbing order:
- Created order 123
- Description: Phase 1 Plumbing Work
- Status: PENDING

Would you like me to:
- Add more phases?
- Assign this to a team member?
- Set a due date?
- Create a quotation for the customer?"
```

### Conversation 4: Financial Query
```
You: "How much did we profit last month?"

AI: "Fetching November financial data...

NOVEMBER FINANCIAL SUMMARY:
- Total Revenue: $38,200
- Total Expenses: $22,500
- Net Profit: $15,700
- Profit Margin: 41%

REVENUE SOURCES:
- Invoices Paid: $38,200
- Outstanding: $6,500

EXPENSE BREAKDOWN:
- Labor: $14,000 (62%)
- Materials: $5,500 (24%)
- Operations: $3,000 (13%)

COMPARISON:
- vs October: Revenue +12%, Profit +8%
- vs November Last Year: Revenue +24%

Would you like me to:
- Generate a detailed P&L statement?
- Create a quarterly report?
- Analyze specific expense categories?"
```

---

## Quick Command Reference

| Task | Command |
|------|---------|
| Create lead | "Create a lead for [name]" |
| List leads | "Show me [status] leads" |
| Update lead | "Mark lead [id] as [status]" |
| Add employee | "Add employee [name]" |
| Create invoice | "Invoice [customer] for $[amount]" |
| Financial report | "Generate [type] report" |
| Query metric | "What's our [metric]?" |
| Create order | "Create order for [description]" |
| Project status | "What's the status of project [id]?" |
| Sales summary | "Show me sales summary" |
| Business review | "Give me a business summary" |
| Document upload | "Upload [type] document" |

---

## How The AI Agent Works

1. **You ask** for a business operation in natural language
2. **AI Agent analyzes** what you're asking for
3. **AI Agent confirms** the action before proceeding
4. **AI Agent executes** using available tools
5. **AI Agent confirms** the result with ID
6. **AI Agent suggests** next steps

---

## Important Notes

### Security
- All operations are logged for audit trail
- User permissions are respected
- Data is secure and encrypted
- Only you can see your company data

### Accuracy
- AI extracts all details from your messages
- Asks clarifying questions if needed
- Confirms all important actions
- Prevents mistakes through verification

### Integration
- Works seamlessly with existing system
- No additional logins needed
- Uses your authenticated session
- Real-time database updates

---

## Get Started Now!

Try asking the AI Agent to:
1. **"Show me all new leads"** - See what it can do
2. **"Create a lead for [prospect]"** - Create new record
3. **"What's our sales summary?"** - Get business metrics
4. **"Generate a monthly P&L"** - Get financial report

The AI Agent is fully trained and ready to help!

---

**AI Agent Status**: ✅ Fully Trained & Ready  
**System Knowledge**: ✅ Complete  
**Tool Access**: ✅ Enabled  
**Last Updated**: 2025

Start using the AI Agent for all your business operations!
