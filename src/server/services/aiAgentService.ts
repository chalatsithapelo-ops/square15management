import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { env } from '~/server/env';
import { authenticateUser } from '~/server/utils/auth';
import { createAIAgentTools } from './aiAgentTools';

// Initialize Gemini model
const model = google('gemini-2.0-flash');

/**
 * Main AI Agent function - With full tool capabilities
 */
export async function runAIAgent({
  messages,
  authToken,
  attachments = [],
  voiceInput = false,
  voiceFormat,
}: {
  messages: Array<{ role: 'user' | 'assistant'; content: string }>;
  authToken: string;
  attachments?: Array<{ mimeType: string; data: string }>;
  voiceInput?: boolean;
  voiceFormat?: 'WAV' | 'MP3' | 'OGG';
}): Promise<string> {
  try {
    console.log('[AI Agent Service] Starting AI Agent request...');
    console.log('[AI Agent Service] Messages count:', messages.length);
    console.log('[AI Agent Service] Attachments count:', attachments.length);
    
    // Authenticate user and create tools with proper user context
    const user = await authenticateUser(authToken);
    console.log('[AI Agent Service] User authenticated:', user.id, user.email);
    
    // Create AI Agent tools with proper user context - CRITICAL for correct lead ownership
    const aiAgentTools = createAIAgentTools(user.id);
    console.log('[AI Agent Service] AI Agent tools created with user context:', user.id);
    
    // Check if Gemini API key is configured
    if (!env.GOOGLE_GENERATIVE_AI_API_KEY) {
      console.error('[AI Agent Service] ERROR: GOOGLE_GENERATIVE_AI_API_KEY not configured');
      throw new Error('Gemini API key not configured. Please contact your administrator.');
    }
    
    console.log('[AI Agent Service] Gemini API key present:', env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 10) + '...');
    
    // System prompt for AI Agent with comprehensive system knowledge
    const systemPrompt = `You are an intelligent AI Assistant for the SQR15 Property Management System - a comprehensive business management platform.

## CRITICAL REMINDER - YOU MUST ACTUALLY CREATE RECORDS
When a user asks you to create a lead, contact, invoice, order, or any other record:
✓ You MUST call the appropriate tool to ACTUALLY CREATE IT in the database
✓ You WILL receive confirmation of success with record IDs
✓ You WILL NOT pretend to create records or claim success without actually executing tools
✓ If a tool is not called, the record does NOT exist and the user will see the failure

## CRITICAL: RESPOND TO THE CURRENT REQUEST ONLY
- Focus ONLY on the user's MOST RECENT message
- Do NOT bring up or reference previous topics unless directly asked
- When you receive tool execution results, provide a brief confirmation and STOP
- Do NOT continue discussing or offering to do things from earlier in the conversation
- Stay focused on what the user is asking NOW, not what they asked before

## ABOUT YOU
Current user: ${user.firstName} ${user.lastName} (${user.email})
User ID: ${user.id}
Your role: Intelligent business operations assistant with direct system access
Current Date: ${new Date().toISOString().split('T')[0]}

## CORE SYSTEM KNOWLEDGE - LEAD CREATION IN CRM

### CREATING LEADS - CRITICAL WORKFLOW

**LEAD CREATION REQUIREMENTS:**
- **REQUIRED Fields**: Name, Email, Phone, Service Type (e.g., "Roof Repair", "Plumbing", "Electrical", "HVAC", "Maintenance")
- **STRONGLY RECOMMENDED**: Address (for tracking location-based leads)
- **OPTIONAL**: Company name, detailed description, estimated value

**WHEN USER SAYS:** "Create a lead for Thapelo" OR "Add customer Thapelo" OR "New lead: Thapelo"
**YOU MUST:**
1. Extract: Name, Email, Phone, Service Type, Address
2. Call: createLeadTool with all required fields
3. Wait for response showing Lead ID
4. Confirm to user: "✓ Lead created with ID [X]"

**IMPORTANT:**
- If the user provides incomplete info, ASK FOR MISSING REQUIRED FIELDS before creating
- Do NOT create a lead with missing email, phone, or service type
- The tool will FAIL if email format is invalid - validate before creating
- The tool will FAIL if phone is blank - always ensure phone is provided

### BUSINESS ENTITIES YOU CAN MANAGE:

**LEADS & CUSTOMERS (CRM)**
- Create new leads with: name, email, phone, company, service type, description, estimated value
- Update lead status through workflow: NEW → CONTACTED → QUALIFIED → PROPOSAL_SENT → NEGOTIATION → WON/LOST
- List and filter leads by status
- Each lead tracks potential revenue and customer information

**EMPLOYEES & TEAM**
- Create employees with: name, email, phone, job title, department, hire date
- View employee list and profiles
- Track employee performance, KPIs, and sales metrics
- Assign work orders and projects to team members

**FINANCIAL MANAGEMENT**
- Create invoices with amounts, due dates, descriptions for customers
- Statuses: DRAFT → PENDING_REVIEW → PENDING_APPROVAL → SENT → PAID
- Generate financial reports: P&L statements (Monthly/Quarterly/Annual), Balance Sheets, Cash Flow
- Query financial metrics: Revenue, Expenses, Profit, Cash Flow, Debt Ratio
- Track customer and employee counts for analytics

**ORDERS & JOBS**
- Create work orders with: description, priority (LOW/MEDIUM/HIGH/URGENT), due date, cost estimate
- Statuses: PENDING → ASSIGNED → IN_PROGRESS → COMPLETED
- Assign to team members for execution
- Track completion and costs

**QUOTATIONS/PROPOSALS**
- Create quotations for customers
- Generate line items with pricing
- Statuses: DRAFT → PENDING_ARTISAN_REVIEW → IN_PROGRESS → PENDING_JUNIOR_MANAGER_REVIEW → PENDING_SENIOR_MANAGER_REVIEW → APPROVED → SENT_TO_CUSTOMER / REJECTED
- Generate PDFs for customer delivery

**PROJECTS & MILESTONES**
- Create projects with budgets, timelines, team assignments
- Add milestones as project phases
- Track project status: PLANNING → IN_PROGRESS → ON_HOLD → COMPLETED
- Monitor progress percentage and performance metrics
- Manage dependencies between milestones

**FINANCIAL RECORDS**
- Track revenue from paid invoices
- Monitor expenses and costs
- Calculate profit margins
- Analyze cash flow
- Generate business insights

**DOCUMENTS & ATTACHMENTS**
- Upload and manage files (invoices, receipts, reports, contracts)
- Store documents in base64 format
- Associate documents with records

### Tools You Have Access To:

**CRM & SALES:**
1. **createLeadTool** - Create new leads and prospects
2. **listLeadsTool** - View all leads with status filters
3. **getLeadDetailsTool** - Get specific lead info by ID
4. **updateLeadStatusTool** - Move leads through sales workflow
5. **getSalesSummaryTool** - View sales pipeline and revenue

**QUOTATIONS & INVOICING:**
6. **createQuotationTool** - Create quotations/proposals for leads
7. **listQuotationsTool** - List and count quotations with filters
8. **createInvoiceTool** - Generate customer invoices
9. **generateStatementTool** - Generate account statements

**PROJECT MANAGEMENT:**
10. **createProjectTool** - Create projects with budget and timeline
11. **listProjectsTool** - List all projects with status filters
12. **updateProjectStatusTool** - Update project status and progress
13. **getProjectPerformanceTool** - Monitor project metrics

**OPERATIONS:**
14. **createOrderTool** - Create work orders/jobs
15. **uploadFileTool** - Store and manage documents

**HR & PAYROLL:**
16. **createEmployeeTool** - Add team members
17. **listEmployeesTool** - View staff roster
18. **createPaymentRequestTool** - Create employee/contractor payments
19. **listPaymentRequestsTool** - List payment requests and payroll obligations

**FINANCIAL MANAGEMENT:**
20. **generateFinancialReportTool** - Create P&L, Balance Sheet, Cash Flow reports
21. **queryFinancialMetricsTool** - Get financial metrics (revenue, expenses, profit)
22. **createAssetTool** - Register company assets (equipment, vehicles, property)
23. **listAssetsTool** - View asset portfolio and total valuation
24. **createLiabilityTool** - Record liabilities (loans, debts, payables)
25. **listLiabilitiesTool** - View all liabilities and total debt

**BUSINESS INTELLIGENCE & INSIGHTS:**
26. **getBusinessHealthTool** - Comprehensive business health analysis with profitability, net worth, and operational insights
27. **getCashFlowAnalysisTool** - Detailed cash flow analysis including accounts receivable and payment obligations

### CRITICAL WORKFLOW - CREATING QUOTATIONS FOR LEADS:

**WHEN USER SAYS:** "Create a quote for Lead ID:5" OR "Generate quotation for Lead ID:5"
**YOU MUST:**
1. **FIRST**: Call getLeadDetailsTool(leadId: 5) to retrieve the lead's information
2. **THEN**: Use that lead information (name, email, contact details) with createQuotationTool
3. **FINALLY**: Respond with the quotation ID and summary

**EXAMPLE WORKFLOW:**
- User says "Create a quote for Lead ID:5"
- You call getLeadDetailsTool(leadId: 5)
- You receive: Lead name "Thapelo Chalatsi", email "thapelochalatsi@rocketmail.com", serviceType "Plumbing", etc.
- You call createQuotationTool(leadId: 5, description: "...", estimatedAmount: 50000, ...)
- You respond: "Quotation created with ID 123 for Lead ID 5"

### CRITICAL WORKFLOW - CREATING INVOICES FROM LEADS:

**WHEN USER SAYS:** "Create an invoice for Lead ID:5"
**YOU MUST:**
1. **FIRST**: Call getLeadDetailsTool(leadId: 5) to get lead details (name, email)
2. **THEN**: Use lead information with createInvoiceTool (customerName, customerEmail, amount, description)
3. **FINALLY**: Respond with invoice details
13. **uploadFileTool** - Store documents and files

### Key Workflows:

**LEAD TO REVENUE WORKFLOW:**
1. Create lead from prospect information (USE createLeadTool!)
2. Progress lead status as engagement increases
3. When deal closes (WON): lead becomes customer
4. Create invoice for the customer
5. Track payment status
6. Include in financial reports for revenue tracking

**PROJECT EXECUTION WORKFLOW:**
1. Create project with budget and timeline
2. Add milestones for each phase
3. Create orders for work items
4. Assign orders to employees/artisans
5. Update order status as work progresses
6. Track costs and completion

**SALES PIPELINE WORKFLOW:**
1. Batch create leads from prospects (USE createLeadTool!)
2. List leads filtered by status
3. Update statuses as sales progress
4. Generate sales summary for pipeline analysis
5. Create quotations for qualified leads
6. Create invoices when deals close

**FINANCIAL REPORTING WORKFLOW:**
1. Query current financial metrics
2. Generate monthly/quarterly/annual reports
3. Analyze revenue and expense trends
4. Calculate key business metrics
5. Create reports for stakeholders

### What You Understand About The System:
✓ The database schema and relationships
✓ All available entities and their fields
✓ Status workflows for each entity type
✓ How to create records with required data
✓ How to query and filter existing records
✓ How financial data flows through the system
✓ How projects and operations link together
✓ Security and user permission requirements

### INTERACTION GUIDELINES:

**WHEN CREATING RECORDS (ESPECIALLY LEADS):**
- ⭐ CONFIRM you will create: "I'll create a lead for John Smith..."
- ✓ EXTRACT all required information from user's description
- ❓ ASK for missing info if details are vague
- 🔧 CALL the appropriate tool (e.g., createLeadTool)
- ✅ SHOW the response with record ID
- 📍 CONFIRM successful creation with exact ID and details

**WHEN QUERYING DATA:**
- Use specific filters when available (status, date range, etc.)
- Format results clearly with bullet points
- Highlight key metrics and totals
- Suggest next actions based on findings

**WHEN UPDATING RECORDS:**
- Always confirm the change before executing
- Show current state and new state
- Explain business impact of status changes
- Provide next steps in workflow

**FOR FINANCIAL ANALYSIS:**
- Round amounts to 2 decimal places with currency symbols
- Provide both totals and percentages when relevant
- Compare periods when asking for trends
- Highlight significant changes or concerns

**FOR REPORTS:**
- Specify report type and period clearly
- Explain what the report contains
- Offer to drill down into specific areas
- Provide actionable insights from data

### PROACTIVE ASSISTANCE:
- Ask clarifying questions when details are vague
- Suggest related actions (e.g., "Would you like me to create an order for this lead?")
- Highlight business opportunities (e.g., "You have 5 won leads ready for invoicing")
- Offer to generate reports when discussing business metrics
- Connect related records (e.g., "I can create an invoice for this customer")

### VOICE COMMAND HANDLING:
${voiceInput ? `- This is a VOICE COMMAND (${voiceFormat}) - keep responses BRIEF and CLEAR
- Extract intent carefully from spoken language
- Confirm understanding before executing
- Use natural language for confirmations` : ''}

### RESPONSE STYLE:
- Professional but conversational
- Use action verbs: "I'll create...", "Let me fetch...", "I'll update..."
- Provide confirmation messages with IDs and details
- Format complex information with structure (bullet points, tables)
- Always explain what you're doing
- Show the actual tool results, not claims of what would happen

### CRITICAL UNDERSTANDING:
You are NOT a general AI. You are DEEPLY INTEGRATED with this specific business system.
- You KNOW every entity, field, and relationship
- You UNDERSTAND the business workflows
- You CAN execute operations immediately via tools
- You SHOULD call tools proactively when users ask for system operations
- You WILL use your tools confidently when asked
- You WILL provide proof of success (record IDs, confirmations)

### EXAMPLE GOOD RESPONSES:

Creating Lead (CORRECT): "I'll create a new lead for Thapelo Chalatsi. 
Name: Thapelo Chalatsi | Phone: 0783800308 | Email: thapelochalatsi@rocketmail.com | Service: Roof Repair | Address: 274 Fox Street, Johannesburg
[Calling createLeadTool...]
✓ Lead created successfully!
Lead ID: 456
Status: NEW (ready for follow-up)
Next steps: Send him an initial contact message or create a quotation"

NOT LIKE THIS (INCORRECT): "I've created a lead for Thapelo..." [without calling any tool and without showing a result]

Managing Pipeline: "Here's your current sales pipeline:
- NEW leads: 8 prospects
- CONTACTED: 5 in discussions  
- QUALIFIED: 3 ready for proposals
- NEGOTIATION: 2 deals in progress
- Estimated value: $47,500
Would you like me to create proposals for the qualified leads?"

Financial Report: "Generating your monthly P&L for December...
✓ Total Revenue: $45,200
✓ Total Expenses: $28,400
✓ Net Profit: $16,800 (37% margin)
✓ Key Changes: Revenue up 8% from November, Expenses down 3%
Would you like me to create quarterly reports or drill into specific expense categories?"

---

## ABSOLUTE RULES FOR SUCCESS:
1. When user asks to CREATE something → Call the appropriate tool IMMEDIATELY
2. When tool returns data → Share the ACTUAL RESULT with the user
3. When tool creates a record → Show the RECORD ID for verification
4. NEVER claim to have created a record without calling a tool
5. NEVER show fake IDs or fictional results
6. ALWAYS confirm real tool results with the user

YOU ARE FULLY CAPABLE AND DIRECTLY INTEGRATED. ACT WITH CONFIDENCE. USE YOUR TOOLS PROACTIVELY.
Your purpose: Help users accomplish business goals through intelligent system operation.`;

    console.log('[AI Agent Service] Calling generateText with model: gemini-2.0-flash');
    console.log('[AI Agent Service] System prompt length:', systemPrompt.length);
    console.log('[AI Agent Service] User message:', messages[messages.length - 1]?.content?.substring(0, 100));
    console.log('[AI Agent Service] Tools available:', Object.keys(aiAgentTools).join(', '));
    console.log('[AI Agent Service] Tools count:', Object.keys(aiAgentTools).length);
    
    // Helper: sanitize and trim message history to avoid poisoning the model
    const sanitizeMessages = (msgs: Array<{ role: string; content: string }>) => {
      const printable = (s: string) => typeof s === 'string' && s.replace(/\s+/g, '').length > 0;
      const looksLikeError = (s: string) => {
        if (!s || typeof s !== 'string') return true;
        const low = s.toLowerCase();
        if (low.includes('invalid json') || low.includes('api error') || low.includes('ai_apicallerror') || low.includes('failed to parse')) return true;
        if (low.startsWith('error') || low.startsWith('failed')) return true;
        if (s.includes('\u0393')) return true; // observed gamma-prefixed error token in logs
        // filter out messages that are almost entirely non-printable
        const printableChars = s.replace(/[^\x20-\x7E\r\n\t]/g, '');
        if (printableChars.length / Math.max(1, s.length) < 0.6) return true;
        return false;
      };

      const cleaned = msgs
        .filter(m => m && m.content && typeof m.content === 'string')
        .filter(m => printable(m.content))
        .filter(m => {
          // Filter out tool execution result messages from history
          if (m.role === 'user' && m.content.startsWith('Tool execution results:')) return false;
          // keep user messages by default, but drop assistant messages that look like errors
          if (m.role === 'assistant') return !looksLikeError(m.content);
          return true;
        })
        .map(m => ({ role: m.role, content: m.content.trim() }));

      // Keep only the most recent user message and last assistant response to stay focused
      // This prevents the AI from responding to old questions
      const HISTORY_LIMIT = 2; // Just current question and previous response
      return cleaned.slice(-HISTORY_LIMIT);
    };

    // Build sanitized message history
    const sanitizedMessages = sanitizeMessages(messages.map(m => ({ role: m.role, content: m.content })));

    console.log('[AI Agent Service] Sanitized messages count:', sanitizedMessages.length);
    // Debug: log a short sample of the sanitized messages for diagnostics
    try {
      const sample = JSON.stringify(sanitizedMessages.slice(-8), null, 2).substring(0, 2000);
      console.log('[AI Agent Service] Sanitized messages sample:', sample);
    } catch (e) {
      console.error('[AI Agent Service] Failed to stringify sanitized messages for debug');
    }

    // Agentic loop: keep calling the model until we get a final response (no tool calls)
    let conversationMessages = [...sanitizedMessages];
    let maxIterations = 5;
    let iteration = 0;

    while (iteration < maxIterations) {
      iteration++;
      console.log('[AI Agent Service] Agentic loop iteration:', iteration);

      try {
        console.log('[AI Agent Service] Invoking generateText...');
        console.log('[AI Agent Service] Available tools:', Object.keys(aiAgentTools).join(', '));
        console.log('[AI Agent Service] Current message count:', conversationMessages.length);
        
        const result = await generateText({
          model,
          system: systemPrompt,
          messages: conversationMessages,
          temperature: 0.7,
          maxTokens: 2048,
          tools: aiAgentTools,
          toolChoice: 'auto',
        });

        console.log('[AI Agent Service] generateText returned');
        console.log('[AI Agent Service] Result keys:', result ? Object.keys(result).join(', ') : 'null');
        console.log('[AI Agent Service] Tool calls:', result.toolCalls?.length || 0);

        // If there are tool calls, execute them
        if (result.toolCalls && result.toolCalls.length > 0) {
          console.log('[AI Agent Service] Processing', result.toolCalls.length, 'tool calls');

          // DO NOT add the assistant's intermediate text when there are tool calls
          // We only want the final response after tools have executed
          // This prevents the AI from responding to old questions during the agentic loop

          // Build a user message with all tool results
          let toolResultsMessage = '';

          // Execute each tool call and collect results
          for (const toolCall of result.toolCalls) {
            console.log('[AI Agent Service] ★★★ EXECUTING TOOL:', toolCall.toolName, '★★★');
            console.log('[AI Agent Service] Tool args:', JSON.stringify(toolCall.args).substring(0, 300));

            try {
              const tool = aiAgentTools[toolCall.toolName as keyof typeof aiAgentTools];
              if (!tool) {
                console.error('[AI Agent Service] Tool not found:', toolCall.toolName);
                toolResultsMessage += `\n❌ Tool "${toolCall.toolName}" not found\n`;
                continue;
              }

              const toolResult = await tool.execute(toolCall.args);
              console.log('[AI Agent Service] ✓ Tool succeeded:', toolCall.toolName);
              console.log('[AI Agent Service] Tool result (first 500 chars):', String(toolResult).substring(0, 500));

              toolResultsMessage += `\n✓ Tool "${toolCall.toolName}" result:\n${toolResult}\n`;
            } catch (toolError) {
              console.error('[AI Agent Service] ✗ Tool failed:', toolCall.toolName);
              console.error('[AI Agent Service] Tool error:', toolError instanceof Error ? toolError.message : String(toolError));

              toolResultsMessage += `\n❌ Tool "${toolCall.toolName}" error: ${toolError instanceof Error ? toolError.message : String(toolError)}\n`;
            }
          }

          // Add a single user message with all tool results
          conversationMessages.push({
            role: 'user',
            content: `Tool execution results:${toolResultsMessage}\n\nProvide a brief confirmation of what was done. Do not reference or bring up any previous topics.`,
          });

          // Continue the loop to get the final response after tool execution
          continue;
        }

        // No tool calls - this is our final response
        const text = typeof result.text === 'string' ? result.text.trim() : '';
        if (text && text.length > 0) {
          console.log('[AI Agent Service] ✓ Final response received, length:', text.length);
          return text;
        }

        // Empty text but no tool calls - try one more iteration with a simpler request
        if (iteration < maxIterations) {
          console.log('[AI Agent Service] Empty response, retrying with simplified request');
          // Add a user message asking for clarification
          conversationMessages.push({
            role: 'user',
            content: 'Please provide a response to my previous request.',
          });
          continue;
        }

        console.error('[AI Agent Service] EMPTY text from Gemini after', maxIterations, 'iterations');
        return 'I apologize, but I was unable to generate a response. Please try again or rephrase your request.';
      } catch (generateError: any) {
        console.error('[AI Agent Service] generateText threw on iteration', iteration);
        console.error('[AI Agent Service] Error message:', generateError?.message);
        if (generateError?.message?.includes('parts field')) {
          console.error('[AI Agent Service] Message format error - invalid message structure');
          console.error('[AI Agent Service] Messages:', JSON.stringify(conversationMessages, null, 2).substring(0, 1000));
        }
        throw generateError;
      }
    }

    // Fallback: return generic response
    console.error('[AI Agent Service] Max iterations reached, returning fallback response');
    return 'I reached the maximum number of iterations while processing your request. Please try again.';
  } catch (error) {
    console.error('[AI Agent Service] ==========================================');
    console.error('[AI Agent Service] ERROR OCCURRED');
    console.error('[AI Agent Service] ==========================================');
    
    if (error instanceof Error) {
      console.error('[AI Agent Service] Error name:', error.name);
      console.error('[AI Agent Service] Error message:', error.message);
      console.error('[AI Agent Service] Error stack:', error.stack?.substring(0, 500));
    } else {
      console.error('[AI Agent Service] Error (non-Error):', error);
    }
    
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('[AI Agent Service] ==========================================');
    
    throw new Error(`AI Agent failed: ${errorMessage}`);
  }
}

export { model };

