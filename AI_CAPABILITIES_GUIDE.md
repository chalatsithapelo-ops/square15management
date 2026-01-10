# AI Capabilities Guide

This document provides a comprehensive overview of all AI-powered features available in the application. These features leverage the OpenRouter API to provide intelligent automation, content generation, and decision support.

## Table of Contents

1. [Overview](#overview)
2. [Configuration](#configuration)
3. [AI Agent Chat](#ai-agent-chat)
4. [PDF Generation via AI Agent](#pdf-generation-via-ai-agent)
5. [Financial Workflow Management](#financial-workflow-management)
6. [Automated Content Generation](#automated-content-generation)
7. [Intelligent Analysis](#intelligent-analysis)
8. [AI-Assisted Workflows](#ai-assisted-workflows)
9. [Best Practices](#best-practices)
10. [Troubleshooting](#troubleshooting)

---

## Overview

The application integrates advanced AI capabilities powered by OpenAI's GPT-4o model through OpenRouter. These features are designed to:

- **Save Time**: Automate repetitive tasks like email writing and description generation
- **Improve Quality**: Generate professional, consistent content
- **Enhance Decision-Making**: Provide data-driven insights and recommendations
- **Reduce Errors**: Classify and categorize data accurately
- **Increase Productivity**: Extract actionable items from unstructured text

---

## Configuration

### Environment Variables

All AI features require the `OPENROUTER_API_KEY` environment variable to be set:

```bash
OPENROUTER_API_KEY=your_openrouter_api_key_here
```

**Current Status**: The API key is configured and active.

**Important**: Ensure your OpenRouter account has sufficient credits. The application will gracefully handle API errors and provide clear feedback to users.

### Cost Considerations

- Model: `openai/gpt-4o`
- Typical cost: ~$0.005-0.015 per request (varies by complexity)
- All features include error handling for quota/billing issues

---

## AI Agent Chat

### Overview
An intelligent conversational assistant that can read and manage data across the entire application, **create business documents, assign jobs to artisans, and generate PDF downloads**.

### Location
- Accessible via the chat widget in the bottom-right corner of any page
- Component: `AgentChatWidget.tsx`

### Capabilities
The AI agent can:

#### Read & Search Operations
- Search and filter leads, orders, projects, invoices, **quotations, statements**
- Fetch financial metrics and analytics
- Get employee and artisan information
- Provide dashboard summaries
- Search across all system entities
- **View payment requests from artisans**

#### Creation Operations (Admin Only)
- **Create new leads** from natural language descriptions (requires MANAGE_LEADS permission)
- **Create projects** with full details (requires admin privileges)
- **Create invoices** with line items (requires admin privileges)
- **Create quotations** with line items (requires admin privileges)
- **Create customer statements** for any period (requires admin privileges)

#### Job & Order Management
- **Assign jobs to artisans** by updating order assignments (requires admin privileges)
- Update lead and order statuses
- **Add or update notes on orders** (available to admins and assigned artisan)

#### Financial Management
- **Update invoice status** - approve, reject, mark as paid
- **Update quotation status** - approve, reject
- View and filter invoices, quotations, and statements
- Track payment requests from artisans

#### PDF Generation
- **Generate invoice PDFs** for sent, overdue, or paid invoices
- **Generate quotation PDFs** for approved quotations
- **Generate statement PDFs** for customer statements
- **Provide downloadable PDFs directly** - the system automatically converts the generated PDF into a downloadable file

### Available Tools

1. **CRM Tools**
   - `getLeads`: Search and filter leads
   - `createLead`: Create new leads (requires MANAGE_LEADS permission)
   - `updateLeadStatus`: Update lead status (requires MANAGE_LEADS permission)

2. **Creation Tools (Admin Only)**
   - `createProject`: Create new projects with all details
   - `createInvoice`: Create new invoices with line items
   - `createQuotation`: Create new quotations with line items
   - `createStatement`: Create customer statements for specific periods

3. **Operations Tools**
   - `getOrders`: View and filter orders
   - `updateOrderStatus`: Update order status
   - `updateOrderNotes`: Add or update notes on orders (Admin or assigned artisan)
   - `sendJobToArtisan`: Assign jobs to specific artisans (Admin only)
   - `getProjects`: View projects
   - `getMilestonesByProject`: Get milestone details

4. **Financial Tools**
   - `getInvoices`: Search invoices
   - `updateInvoiceStatus`: Update invoice status (approve, reject, mark as paid)
   - `getQuotations`: Search and filter quotations
   - `updateQuotationStatus`: Update quotation status (approve, reject)
   - `getStatements`: Search and filter customer statements
   - `getPaymentRequests`: View payment requests from artisans (filter by status)
   - `getFinancialMetrics`: Get comprehensive analytics

5. **PDF Generation Tools**
   - `generateInvoicePdf`: Generate downloadable invoice PDFs
   - `generateQuotationPdf`: Generate downloadable quotation PDFs
   - `generateStatementPdf`: Generate downloadable statement PDFs

6. **Analytics Tools**
   - `getDashboardSummary`: Get business overview
   - `searchAcrossSystem`: Universal search
   - `getEmployees`: View employee/artisan information

### Permission Requirements

The AI Agent respects user permissions:

1. **Lead Management**: Requires MANAGE_LEADS permission
   - Available to: Sales Agents, Supervisors, Managers, Junior Admins, Senior Admins

2. **Creation Operations**: Require administrative privileges
   - Available to: Junior Admins, Senior Admins only
   - Includes: Creating projects, invoices, quotations, statements

3. **Job Assignment**: Requires administrative privileges
   - Available to: Junior Admins, Senior Admins only

If you attempt an operation without proper permissions, the AI will politely explain the requirement and suggest alternatives.

### Example Interactions

```
User: "Show me all new leads from this week"
Agent: [Uses getLeads tool with filters, presents results]

User: "Create a lead for John Smith who needs plumbing work at 123 Main St"
Agent: [Asks for missing details like phone/email, then uses createLead]
Note: Requires MANAGE_LEADS permission

User: "What's our revenue this month?"
Agent: [Uses getFinancialMetrics with date range]

User: "Create a project for renovating Building A with a budget of R500,000"
Agent: [Uses createProject tool to create actual database record]
Note: Requires admin privileges

User: "Create an invoice for John Smith for R5000 for plumbing services"
Agent: [Uses createInvoice tool to create actual invoice]
Note: Requires admin privileges

User: "Create a statement for john@example.com for January 2024"
Agent: [Uses createStatement tool with email and date range]
Note: Requires admin privileges

User: "Assign order #12345 to Mike the plumber"
Agent: [Uses getEmployees to find Mike, then sendJobToArtisan to assign]
Note: Requires admin privileges

User: "Send me the PDF for invoice #INV-00123"
Agent: [Uses getInvoices to find invoice, then generateInvoicePdf]
Result: PDF is automatically generated and made available for download

User: "I need the quotation PDF for quote QUO-00045"
Agent: [Uses searchAcrossSystem to find quotation, then generateQuotationPdf]
Result: PDF is automatically generated and made available for download

User: "Generate a statement PDF for statement #281"
Agent: [Uses generateStatementPdf to create the PDF]
Result: PDF is automatically generated and made available for download

User: "Show me all approved quotations"
Agent: [Uses getQuotations tool with status='APPROVED', presents results]

User: "Approve invoice INV-00123"
Agent: [Uses getInvoices to find invoice, then updateInvoiceStatus with status='SENT']
Result: Invoice status updated, automatically set to SENT or OVERDUE based on due date

User: "Show me all pending payment requests"
Agent: [Uses getPaymentRequests tool with status='PENDING']
Result: Lists all pending payment requests with artisan names and amounts

User: "Add a note to order #12345 saying the customer needs priority service"
Agent: [Uses updateOrderNotes tool with order ID and note text]
Result: Note added to order with timestamp

User: "Show me all statements for john@example.com"
Agent: [Uses getStatements tool with customerEmail filter]
Result: Lists all statements for that customer

User: "Reject quotation QUO-00045 because pricing is too high"
Agent: [Uses getQuotations to find ID, then updateQuotationStatus with status='REJECTED' and reason]
Result: Quotation rejected with reason recorded

User: "Mark invoice INV-00456 as paid"
Agent: [Uses getInvoices to find invoice, then updateInvoiceStatus with status='PAID']
Result: Invoice marked as paid with payment date recorded

User: "Show me all overdue invoices and approve them"
Agent: [Uses getInvoices with status='OVERDUE', then updates each to 'SENT' or keeps as 'OVERDUE']
Result: Batch status update with confirmation for each invoice
```

### Important Notes

1. **Authentication is Automatic**: You don't need to provide any authentication tokens. The system handles this automatically based on your login session.

2. **PDF Downloads Work**: Unlike earlier versions, the AI Agent can now generate and provide PDF downloads directly. When you request a PDF, it will be automatically generated and made available for download.

3. **Real Database Operations**: When the AI creates projects, invoices, quotations, or statements, these are actual records in the database, not just suggestions or drafts.

4. **Permission-Aware**: The AI will inform you if you don't have the required permissions for an operation and suggest alternatives.

### tRPC Procedure
- **Procedure**: `sendAgentMessage`
- **Input**: User message, conversation history, optional attachments (images, PDFs, audio)
- **Output**: AI-generated response with tool execution results and PDF data when applicable

---

## PDF Generation via AI Agent

### Overview
The AI Agent can now generate and provide downloadable PDFs for invoices, quotations, and customer statements directly through natural language requests.

### How It Works

When you request a PDF through the AI Agent:
1. The AI identifies which document you want (invoice, quotation, or statement)
2. It searches for the document using the provided reference number or other details
3. It generates a professional PDF document
4. The PDF is automatically made available for download
5. You receive a confirmation message with download instructions

### Supported Document Types

#### 1. Invoice PDFs
- **Requirement**: Invoice must be in SENT, OVERDUE, or PAID status
- **Format**: Professional branded invoice with company logo
- **Includes**: Line items, totals, payment details, customer information

**Example Request**:
```
"Generate a PDF for invoice INV-00123"
"Send me the invoice PDF for John Smith's latest invoice"
"I need a PDF of invoice #INV-00456"
```

#### 2. Quotation PDFs
- **Requirement**: Quotation must be in APPROVED status
- **Format**: Professional branded quotation with company logo
- **Includes**: Line items, pricing, validity period, terms

**Example Request**:
```
"Generate a PDF for quotation QUO-00045"
"Send me the quotation PDF for the ABC Corp project"
"I need a PDF of quote #QUO-00789"
```

#### 3. Statement PDFs
- **Requirement**: Statement must be generated
- **Format**: Comprehensive statement with aging analysis
- **Includes**: All invoices, payments, outstanding balances, aging buckets

**Example Request**:
```
"Generate a PDF for statement #281"
"Send me the statement PDF for john@example.com"
"I need a PDF of the January statement for ABC Corp"
```

### AI Agent vs Manual PDF Generation

| Feature | AI Agent | Manual (UI) |
|---------|----------|-------------|
| Natural Language | ✅ Yes | ❌ No |
| Search by Reference | ✅ Yes | ⚠️ Manual lookup |
| Batch Operations | ✅ Possible | ❌ One at a time |
| Conversational | ✅ Yes | ❌ No |
| Requires Navigation | ❌ No | ✅ Yes |

### Troubleshooting PDF Generation

#### "Invoice cannot be exported yet"
- **Cause**: Invoice is in DRAFT or PENDING status
- **Solution**: Only sent, overdue, or paid invoices can be exported
- **Action**: Update invoice status first, then request PDF

#### "Quotation cannot be exported yet"
- **Cause**: Quotation is not approved
- **Solution**: Only approved quotations can be exported
- **Action**: Approve the quotation first, then request PDF

#### "Statement not found"
- **Cause**: Statement hasn't been generated yet
- **Solution**: Create the statement first
- **Action**: Ask the AI to "Create a statement for [email] for [period]" first

### Best Practices

1. **Be Specific**: Include invoice/quotation/statement numbers when possible
2. **Check Status**: Ensure documents are in the correct status for PDF generation
3. **Use Natural Language**: The AI understands various phrasings
4. **Batch Requests**: You can request multiple PDFs in one conversation

### Example Workflow

```
User: "Show me all overdue invoices for ABC Corp"
Agent: [Lists 3 overdue invoices with numbers]

User: "Generate PDFs for all of them"
Agent: [Generates PDFs for INV-00123, INV-00456, INV-00789]
       "I've generated PDFs for all 3 invoices. They're ready for download."
```

---

## Financial Workflow Management

### Overview
The AI Agent now provides comprehensive financial workflow management, allowing you to manage the entire lifecycle of quotations, invoices, and statements through natural language commands.

### Invoice Management

#### Viewing Invoices
```
"Show me all pending invoices"
"Find invoices for ABC Corp"
"Show me overdue invoices from last month"
```

#### Updating Invoice Status
The agent can update invoice status through the approval workflow:

- **DRAFT** → Initial creation state
- **PENDING_REVIEW** → Awaiting initial review
- **PENDING_APPROVAL** → Awaiting manager approval
- **SENT** → Approved and sent to customer
- **OVERDUE** → Past due date (automatically determined)
- **PAID** → Payment received
- **CANCELLED** → Invoice cancelled
- **REJECTED** → Invoice rejected

**Smart Status Logic**: When approving an invoice (moving from PENDING_APPROVAL to SENT), the system automatically checks the due date:
- If due date has passed → Status set to OVERDUE
- If due date is in the future → Status set to SENT

**Example Commands**:
```
"Approve invoice INV-00123"
"Mark invoice INV-00456 as paid"
"Reject invoice INV-00789 because the pricing is incorrect"
"Cancel invoice INV-00321"
```

### Quotation Management

#### Viewing Quotations
```
"Show me all approved quotations"
"Find quotations for John Smith"
"Show me quotations in progress"
```

#### Updating Quotation Status
The agent can manage quotation status through the workflow:

- **DRAFT** → Initial creation
- **PENDING_ARTISAN_REVIEW** → Sent to artisan for review
- **IN_PROGRESS** → Artisan working on it
- **READY_FOR_REVIEW** → Artisan completed, awaiting admin review
- **APPROVED** → Approved by admin
- **REJECTED** → Rejected

**Example Commands**:
```
"Approve quotation QUO-00123"
"Reject quotation QUO-00456 because materials are too expensive"
"Show me all quotations ready for review"
```

### Statement Management

#### Viewing Statements
```
"Show me all statements for john@example.com"
"Find statements from January 2024"
"Show me the latest statement for ABC Corp"
```

#### Creating Statements
```
"Create a statement for john@example.com for January 2024"
"Generate a statement for ABC Corp from Jan 1 to Jan 31"
```

### Payment Request Tracking

#### Viewing Payment Requests
The agent can view payment requests submitted by artisans:

```
"Show me all pending payment requests"
"Find payment requests from Mike"
"Show me approved payment requests from last week"
```

**Filter Options**:
- PENDING - Awaiting approval
- APPROVED - Approved but not yet paid
- REJECTED - Rejected requests
- PAID - Already paid

### Order Notes Management

#### Adding Notes to Orders
Admins and assigned artisans can add notes to orders:

```
"Add a note to order #12345: Customer requested priority service"
"Update order #67890 notes: Materials arrived, starting work tomorrow"
"Add note to order #11111: Waiting for customer approval on change order"
```

**Permissions**:
- Admins can add notes to any order
- Artisans can only add notes to orders assigned to them

### Batch Operations

The AI Agent can perform batch operations across multiple records:

**Example Batch Workflows**:
```
User: "Show me all pending invoices for ABC Corp"
Agent: [Lists 5 pending invoices]

User: "Approve all of them"
Agent: [Approves each invoice individually, provides confirmation for each]

User: "Show me all quotations ready for review"
Agent: [Lists 3 quotations]

User: "Approve the first two and reject the third because pricing is too high"
Agent: [Approves QUO-001 and QUO-002, rejects QUO-003 with reason]
```

### Best Practices

1. **Always Provide Reasons for Rejections**: When rejecting invoices or quotations, provide a clear reason
2. **Verify Before Batch Operations**: Review the list before approving/rejecting multiple items
3. **Use Specific References**: Reference invoice/quotation numbers when possible for accuracy
4. **Check Status Before Operations**: The agent will inform you if a document is in the wrong status for the requested operation

### Error Handling

The agent provides clear feedback when operations cannot be completed:

- **Invoice not exportable**: "Invoice INV-00123 cannot be exported yet. Only sent, overdue, or paid invoices can be exported. Current status: DRAFT"
- **Quotation not exportable**: "Quotation QUO-00456 cannot be exported yet. Only approved quotations can be exported. Current status: IN_PROGRESS"
- **Permission denied**: "You don't have permission to update notes for this order. This operation is available to admins and the assigned artisan only."

---

## Automated Content Generation

### 1. Email Content Generator

**Purpose**: Generate professional business emails for various scenarios.

**Location**: CRM pages, customer communications

**tRPC Procedure**: `generateEmailContent`

**Email Types**:
- `LEAD_FOLLOW_UP`: Following up with potential customers
- `QUOTATION_SUBMISSION`: Submitting quotations
- `INVOICE_REMINDER`: Payment reminders
- `PROJECT_UPDATE`: Status updates
- `MEETING_REQUEST`: Requesting meetings
- `THANK_YOU`: Thank you messages
- `GENERAL`: General business communication

**Tone Options**:
- `PROFESSIONAL`: Polished and business-like
- `FRIENDLY`: Warm and personable
- `URGENT`: Conveys importance
- `FORMAL`: Traditional business language

**Input Parameters**:
```typescript
{
  token: string;
  emailType: EmailType;
  recipientName: string;
  context?: {
    leadDetails?: string;
    projectName?: string;
    invoiceNumber?: string;
    amount?: number;
    dueDate?: string;
    customInstructions?: string;
  };
  tone?: ToneType;
}
```

**Output**:
```typescript
{
  subject: string;
  greeting: string;
  body: string;
  callToAction?: string;
  closing: string;
  signature: string;
  fullEmail: string; // Complete formatted email
}
```

**Example Usage**:
```typescript
const result = await trpc.generateEmailContent.mutate({
  token,
  emailType: "LEAD_FOLLOW_UP",
  recipientName: "John Smith",
  context: {
    leadDetails: "Requested plumbing services for office renovation",
    customInstructions: "Mention our 10% discount for new customers"
  },
  tone: "PROFESSIONAL"
});

// Use result.fullEmail in email composer
```

---

### 2. Invoice Description Generator

**Purpose**: Generate detailed, professional invoice line item descriptions from brief inputs.

**Location**: Invoice creation/editing pages

**tRPC Procedure**: `generateInvoiceDescription`

**Input Parameters**:
```typescript
{
  token: string;
  briefDescription: string; // e.g., "painted office"
  serviceType?: string;
  quantity?: number;
  context?: {
    projectName?: string;
    location?: string;
    specifications?: string;
  };
}
```

**Output**:
```typescript
{
  fullDescription: string; // Detailed description for invoice
  shortDescription: string; // Max 60 chars for summary
  technicalDetails?: string; // Specs, standards, materials
  includedItems?: string[]; // List of included items
  notes?: string; // Additional clarifications
}
```

**Example**:
```typescript
Input: "Painted office walls"
Output: {
  fullDescription: "Interior wall preparation, priming, and painting of office walls (45m²) with premium acrylic paint (2 coats). Includes surface preparation, filling of minor imperfections, and final cleanup.",
  shortDescription: "Interior office wall painting - 45m²",
  technicalDetails: "Dulux Premium Acrylic, color code: Whisper White",
  includedItems: ["Surface preparation", "Primer coat", "2 finish coats", "Cleanup"]
}
```

---

### 3. Quotation Line Items Generator

**Purpose**: Break down service requests into detailed quotation line items with quantities and pricing.

**Location**: Quotation creation page

**tRPC Procedure**: `generateQuotationLineItems`

**Input Parameters**:
```typescript
{
  token: string;
  serviceDescription: string;
  serviceType?: string;
  address?: string;
  estimatedValue?: number;
}
```

**Output**:
```typescript
{
  lineItems: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    unitOfMeasure: "m2" | "Lm" | "Sum" | "m3" | "Hr";
    notes?: string;
    total: number;
  }>;
}
```

**Example**:
```typescript
Input: "Paint 3 offices"
Output: [
  {
    description: "Interior wall preparation and priming",
    quantity: 135,
    unitPrice: 25,
    unitOfMeasure: "m2",
    total: 3375
  },
  {
    description: "Premium acrylic paint (2 coats)",
    quantity: 135,
    unitPrice: 55,
    unitOfMeasure: "m2",
    total: 7425
  },
  // ... more items
]
```

---

## Intelligent Analysis

### 1. Lead Scoring

**Purpose**: Automatically score and prioritize leads based on multiple factors.

**Location**: CRM lead management page

**tRPC Procedure**: `scoreLeadWithAI`

**Scoring Criteria**:
- Project value (25%)
- Service complexity (20%)
- Lead quality (20%)
- Urgency indicators (15%)
- Geographic feasibility (10%)
- Contact information completeness (10%)

**Output**:
```typescript
{
  score: number; // 0-100
  priority: "HIGH" | "MEDIUM" | "LOW";
  reasoning: string;
  recommendedActions: string[];
  suggestedArtisanId?: number;
  artisanMatchReasoning?: string;
  estimatedProjectValue?: number;
  urgencyLevel: "IMMEDIATE" | "URGENT" | "NORMAL" | "LOW";
}
```

**When to Use**:
- New leads to determine follow-up priority
- Lead qualification assessment
- Resource allocation decisions

---

### 2. Project Risk Analysis

**Purpose**: Proactively identify potential risks in projects before they become critical.

**Location**: Project management pages

**tRPC Procedure**: `analyzeProjectRisks`

**Analysis Areas**:
- Financial risks (budget overruns, cash flow)
- Timeline risks (delays, schedule slippage)
- Resource risks (staffing, equipment)
- Quality risks (workmanship, standards)
- Scope risks (scope creep, unclear requirements)
- Communication risks (stakeholder alignment)
- Technical risks (complexity, design issues)
- External risks (weather, regulations)

**Input Parameters**:
```typescript
{
  token: string;
  projectId: number;
  includeFinancialRisks?: boolean;
  includeTimelineRisks?: boolean;
  includeResourceRisks?: boolean;
}
```

**Output**:
```typescript
{
  risks: Array<{
    riskTitle: string;
    description: string;
    category: RiskCategory;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
    likelihood: "VERY_HIGH" | "HIGH" | "MEDIUM" | "LOW" | "VERY_LOW";
    impact: string;
    indicators: string[]; // Data points that revealed this risk
    mitigationStrategies: string[];
    immediateActions?: string[];
    estimatedImpactCost?: number;
  }>;
  summary: {
    totalRisksIdentified: number;
    criticalRisks: number;
    highRisks: number;
    mediumRisks: number;
    lowRisks: number;
  };
}
```

**When to Use**:
- Weekly/monthly project reviews
- Before major milestones
- When project metrics show concerning trends
- For executive reporting

---

### 3. Project Summary Generation

**Purpose**: Generate comprehensive executive summaries of project status.

**Location**: Project reporting pages

**tRPC Procedure**: `generateProjectSummary`

**Summary Types**:
- `EXECUTIVE`: High-level insights for senior management
- `DETAILED`: Technical details and granular tracking
- `STATUS_UPDATE`: Recent progress and immediate next steps

**Output**:
```typescript
{
  summary: {
    executiveSummary: string; // 2-3 sentence overview
    keyHighlights: string[]; // 2-5 achievements
    progressAnalysis: string;
    budgetAnalysis: string;
    riskAssessment: string;
    upcomingMilestones: Array<{
      name: string;
      dueDate?: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
    }>;
    recommendations: string[]; // 2-5 actionable items
    overallStatus: "ON_TRACK" | "AT_RISK" | "DELAYED" | "AHEAD_OF_SCHEDULE";
    confidenceLevel: "HIGH" | "MEDIUM" | "LOW";
  };
  metrics: {
    overallProgress: number;
    budgetUtilization: number;
    completedMilestones: number;
    totalMilestones: number;
    totalRisks: number;
    highRisks: number;
  };
}
```

**When to Use**:
- Monthly board meetings
- Client status updates
- Project milestone reviews
- Performance evaluations

---

### 4. HR Coaching Recommendations

**Purpose**: Generate personalized coaching recommendations for employees based on performance data.

**Location**: HR employee management pages

**tRPC Procedure**: `generateCoachingRecommendation`

**Analysis Includes**:
- Sales performance metrics
- Lead conversion rates
- Response times
- KPI achievement
- Artisan ratings (if applicable)
- Comparison to team averages

**Output**:
```typescript
{
  coaching: {
    overallAssessment: string;
    strengths: string[]; // 2-4 key strengths
    areasForImprovement: Array<{
      area: string;
      currentPerformance: string;
      targetPerformance: string;
      priority: "HIGH" | "MEDIUM" | "LOW";
    }>;
    actionableRecommendations: Array<{
      recommendation: string;
      expectedImpact: string;
      timeframe: string;
    }>;
    trainingNeeds: string[];
    shortTermGoals: string[]; // 2-4 goals (1-3 months)
    longTermGoals: string[]; // 1-3 goals (6-12 months)
    coachingStyle: string;
  };
}
```

**When to Use**:
- Performance reviews
- One-on-one coaching sessions
- Professional development planning
- Identifying training needs

---

## AI-Assisted Workflows

### 1. Action Item Extraction

**Purpose**: Extract actionable tasks from meeting notes, project updates, or any text.

**Location**: Can be integrated into any text input area

**tRPC Procedure**: `extractActionItems`

**Input Parameters**:
```typescript
{
  token: string;
  text: string; // Meeting notes, email thread, etc.
  context?: {
    projectName?: string;
    meetingDate?: string;
    attendees?: string[];
  };
}
```

**Output**:
```typescript
{
  actionItems: Array<{
    action: string; // Clear, actionable task starting with verb
    priority: "HIGH" | "MEDIUM" | "LOW";
    suggestedOwner?: string;
    suggestedDeadline?: string;
    category: "FOLLOW_UP" | "DECISION_NEEDED" | "DOCUMENTATION" | 
              "COMMUNICATION" | "TECHNICAL_WORK" | "REVIEW" | "OTHER";
    context?: string;
  }>;
  totalItems: number;
}
```

**Example**:
```typescript
Input: "Meeting notes: John mentioned we need to follow up with ABC Corp about the quotation by Friday. Sarah will review the project timeline and update the team. We should schedule a site visit next week."

Output: [
  {
    action: "Follow up with ABC Corp regarding quotation",
    priority: "HIGH",
    suggestedOwner: "John",
    suggestedDeadline: "By Friday",
    category: "FOLLOW_UP"
  },
  {
    action: "Review project timeline and update team",
    priority: "MEDIUM",
    suggestedOwner: "Sarah",
    category: "REVIEW"
  },
  {
    action: "Schedule site visit",
    priority: "MEDIUM",
    suggestedDeadline: "Next week",
    category: "COMMUNICATION"
  }
]
```

**When to Use**:
- After meetings
- Processing email threads
- Converting discussions into tasks
- Project update reviews

---

### 2. Service Type Classification

**Purpose**: Automatically classify service requests into appropriate categories.

**Location**: Lead creation form (auto-triggers after typing description)

**tRPC Procedure**: `classifyServiceType`

**Input Parameters**:
```typescript
{
  token: string;
  description: string;
  address?: string; // Can help with classification
}
```

**Output**:
```typescript
{
  suggestedServiceType: string; // e.g., "Plumbing", "Electrical"
  confidence: number; // 0-100
  reasoning: string;
}
```

**Service Types**:
- Painting
- Plumbing
- Electrical
- Construction
- Affordable Housing
- Social Housing
- Shopping Center
- General Maintenance
- HVAC
- Carpentry
- Roofing
- Flooring
- Tiling

---

### 3. Artisan Suggestion

**Purpose**: Suggest the best artisan for a job based on skills, availability, and performance.

**Location**: Order assignment

**tRPC Procedure**: `suggestArtisanForJob`

**Input Parameters**:
```typescript
{
  token: string;
  serviceType: string;
  description: string;
  address?: string;
  urgency?: "LOW" | "MEDIUM" | "HIGH" | "EMERGENCY";
}
```

**Output**:
```typescript
{
  suggestedArtisanId: number;
  artisanName: string;
  reasoning: string;
  alternativeArtisans?: Array<{
    id: number;
    name: string;
    reason: string;
  }>;
}
```

---

### 4. Expense Category Suggestion

**Purpose**: Suggest appropriate expense categories from uploaded receipts/invoices.

**Location**: Expense upload pages

**tRPC Procedure**: `suggestExpenseCategory`

**Input Parameters**:
```typescript
{
  token: string;
  description?: string;
  amount: number;
  vendor?: string;
  imageData?: string; // Base64 encoded image
}
```

**Output**:
```typescript
{
  suggestedCategory: string;
  confidence: number;
  reasoning: string;
  extractedDetails?: {
    vendor?: string;
    date?: string;
    items?: string[];
  };
}
```

---

## Best Practices

### 1. Error Handling

All AI features include comprehensive error handling:

```typescript
try {
  const result = await trpc.generateEmailContent.mutate({...});
  // Use result
} catch (error) {
  // Error messages are user-friendly:
  // - API key issues: Clear instructions to check configuration
  // - Rate limits: Suggestion to try again later
  // - Generic errors: Fallback to manual process
  toast.error(error.message);
}
```

### 2. User Experience

- **Loading States**: Always show loading indicators during AI operations
- **Editable Results**: AI-generated content should be editable before final submission
- **Transparency**: Indicate when content is AI-generated
- **Fallbacks**: Always provide manual alternatives

### 3. Cost Optimization

- **Debouncing**: Auto-classification features use debouncing (1.5s delay)
- **Caching**: Consider caching results for repeated queries
- **User Control**: Users can choose when to use AI features
- **Batch Operations**: Use bulk features when possible

### 4. Data Privacy

- **No Sensitive Data**: Avoid sending passwords, tokens, or PII to AI
- **Audit Logging**: AI operations are logged with user attribution
- **User Consent**: Users are aware when AI is being used

---

## Troubleshooting

### Common Issues

#### 1. "AI service is currently unavailable"

**Cause**: OpenRouter API key not configured or invalid

**Solution**:
1. Check `.env` file has `OPENROUTER_API_KEY`
2. Verify API key is valid on OpenRouter dashboard
3. Restart the application after updating `.env`

#### 2. "Insufficient credits" or "Payment Required"

**Cause**: OpenRouter account has no credits

**Solution**:
1. Log into OpenRouter dashboard
2. Add credits to your account
3. Features will work automatically once credits are added

#### 3. "Rate limit exceeded"

**Cause**: Too many requests in short period

**Solution**:
- Wait a few moments and try again
- Consider implementing request queuing for bulk operations

#### 4. AI responses are not relevant

**Possible Causes**:
- Insufficient context provided
- Ambiguous input
- Model limitations

**Solutions**:
- Provide more detailed descriptions
- Include relevant context (project names, dates, etc.)
- Review and edit AI-generated content before use

### Performance Tips

1. **Optimize Prompts**: More specific context = better results
2. **Use Appropriate Types**: Choose the right summary/email type
3. **Provide Context**: Include project names, dates, amounts
4. **Review Output**: Always review AI-generated content

---

## Future Enhancements

Potential future AI capabilities:

1. **Document Analysis**: Extract data from PDF contracts and agreements
2. **Predictive Analytics**: Forecast project completion dates and costs
3. **Smart Scheduling**: AI-powered resource allocation
4. **Voice Commands**: Voice-to-text for field workers
5. **Image Analysis**: Assess work quality from photos
6. **Automated Reporting**: Generate comprehensive reports automatically

---

## Support

For issues or questions about AI features:

1. Check this guide first
2. Review error messages carefully
3. Check OpenRouter dashboard for account status
4. Contact system administrator for API key issues

---

**Last Updated**: 2024
**AI Model**: OpenAI GPT-4o via OpenRouter
**Documentation Version**: 1.0
