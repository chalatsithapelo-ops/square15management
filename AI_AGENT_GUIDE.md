# PropMate AI Agent Guide

## Overview

PropMate Agent is an intelligent AI assistant powered by GPT-4o (via OpenRouter) that can read, analyze, and manage your entire Square 15 Facility Solutions application. The agent uses advanced AI capabilities including:

- **Natural Language Understanding**: Communicate in plain English
- **Tool Calling**: Execute real actions in your application
- **Vision**: Analyze uploaded images and documents
- **Multi-step Reasoning**: Handle complex queries that require multiple operations

## Capabilities

### 1. Read the Entire Application

The agent has access to all data across your system through specialized tools:

#### CRM & Sales
- View and search leads by status, service type, or customer details
- Track lead progression through the sales pipeline
- Analyze sales performance metrics

#### Operations
- Monitor orders and their statuses
- Track project progress and milestones
- View job assignments and completion rates

#### Finance
- Check invoice statuses and payment history
- Get comprehensive financial metrics (revenue, expenses, profit margins)
- Monitor pending payments and overdue invoices

#### HR & Employees
- Look up employee information and roles
- View performance metrics
- Check team assignments

#### Analytics
- Get dashboard summaries across all business areas
- Generate reports on demand
- Search across the entire system

### 2. Manage Tasks

The agent can create and update entities in real-time:

- **Create new leads** from customer inquiries
- **Update lead statuses** through the sales pipeline (NEW → CONTACTED → QUALIFIED → WON)
- **Update order statuses** (PENDING → ASSIGNED → IN_PROGRESS → COMPLETED)
- **Track and report** on project progress

### 3. Process Voice Instructions

Record voice commands directly in the chat interface:

1. Click the microphone button
2. Speak your command
3. Click the stop button when done
4. The agent will process your request

**Note**: Currently, voice recordings are captured but you'll need to also type or describe your request. Full voice-to-text processing is coming soon.

### 4. Import and Analyze Files

Upload and analyze various file types:

- **Invoice Images**: Extract vendor details, amounts, line items
- **PDF Documents**: Read and analyze document content
- **Photos**: Analyze images for job documentation

## How to Use the Agent

### Access the Agent

The PropMate Agent is available through the chat interface in your application. Look for the bot icon to open the chat panel.

### Example Queries

#### CRM & Leads

```
"Show me all new leads"
"Create a lead for John Smith who needs plumbing work at 123 Main St"
"Update lead #45 to CONTACTED status"
"Search for leads related to electrical work"
"What's the status of leads for ABC Company?"
```

#### Orders & Operations

```
"Show me all active orders"
"What orders are assigned to Mike Johnson?"
"Update order #ORD-123 to IN_PROGRESS"
"Show me completed orders from this week"
```

#### Projects

```
"Show me all active projects"
"What's the status of project #PRJ-456?"
"Show me milestones for the Downtown Office project"
"Which projects are over budget?"
```

#### Financial

```
"What's our revenue this month?"
"Show me all unpaid invoices"
"What's our profit margin?"
"Show me pending payment requests"
```

#### Search & Analytics

```
"Search for anything related to Acme Corp"
"Give me a dashboard summary"
"Show me all employees who are artisans"
"What are our key metrics today?"
```

#### With File Uploads

```
[Upload invoice image] "Extract the details from this invoice"
[Upload job photo] "Analyze this completed work"
[Upload PDF] "Summarize this document"
```

## Available Tools

The agent has access to the following tools:

### CRM Tools
- **getLeads**: Search and filter leads
- **createLead**: Create new leads
- **updateLeadStatus**: Update lead status through pipeline

### Order Tools
- **getOrders**: View and filter orders
- **updateOrderStatus**: Update order status

### Project Tools
- **getProjects**: View projects and details
- **getMilestonesByProject**: Get milestone information

### Employee Tools
- **getEmployees**: View employee information

### Financial Tools
- **getInvoices**: Search and filter invoices
- **getFinancialMetrics**: Get comprehensive financial analytics

### Analytics Tools
- **getDashboardSummary**: Complete business overview
- **searchAcrossSystem**: Search all entities

## Technical Architecture

### Backend Components

1. **Agent Tools** (`src/server/utils/agent-tools.ts`)
   - Defines all available tools the AI can use
   - Each tool wraps existing database operations
   - Includes authentication and permission checks

2. **sendAgentMessage Procedure** (`src/server/trpc/procedures/sendAgentMessage.ts`)
   - Handles communication with GPT-4o via OpenRouter
   - Implements tool calling with multi-step reasoning
   - Processes text, images, and file attachments

3. **Authentication Integration**
   - All tool executions require valid auth tokens
   - Permission checks enforce role-based access control
   - Tools inherit user permissions

### Frontend Components

1. **AgentChat Component** (`src/components/AgentChat.tsx`)
   - Chat interface with message history
   - File upload support (images, PDFs)
   - Voice recording capability
   - Real-time response streaming

2. **Gemini Service** (`src/services/geminiService.ts`)
   - Client-side service for agent communication
   - Handles auth token management
   - Formats requests for the backend

### AI Model

- **Model**: GPT-4o via OpenRouter
- **Provider**: OpenRouter API
- **Capabilities**: 
  - Text generation
  - Vision (image analysis)
  - Tool calling (function execution)
  - Multi-step reasoning (up to 5 steps)

## Best Practices

### For Users

1. **Be Specific**: Include relevant details like IDs, names, or date ranges
2. **Use Natural Language**: Speak naturally - the agent understands context
3. **Ask Follow-ups**: The agent remembers conversation history
4. **Upload Files**: For invoices or documents, upload them for analysis
5. **Confirm Actions**: When creating or updating, verify the results

### For Developers

1. **Add New Tools**: Follow the pattern in `agent-tools.ts`
2. **Include Auth Checks**: Always use `authenticateUser` and `requirePermission`
3. **Provide Clear Descriptions**: Tool descriptions help the AI choose correctly
4. **Return Structured Data**: Format responses consistently
5. **Handle Errors Gracefully**: Provide clear error messages

## Troubleshooting

### Agent Not Responding

1. Check that you're logged in (auth token is required)
2. Verify OPENROUTER_API_KEY is set in `.env`
3. Check browser console for errors
4. Ensure you have network connectivity

### Tool Execution Fails

1. Verify you have the required permissions
2. Check that entity IDs are correct
3. Review the error message for specifics
4. Ensure all required parameters are provided

### Voice Recording Issues

1. Grant microphone permissions in your browser
2. Use a supported browser (Chrome, Edge, Firefox)
3. Check that your microphone is working
4. Try refreshing the page

### File Upload Problems

1. Ensure file size is reasonable (< 10MB)
2. Use supported formats (JPEG, PNG, PDF)
3. Check that you have a stable connection
4. Try compressing large images

## Security & Privacy

- **Authentication Required**: All agent operations require a valid auth token
- **Permission Enforcement**: Tools respect role-based access control
- **Data Privacy**: Conversations are not stored permanently
- **Secure Communication**: All API calls use HTTPS
- **Token Management**: Auth tokens are stored securely in browser storage

## Future Enhancements

Planned features for the AI Agent:

1. **Voice-to-Text**: Automatic transcription of voice commands
2. **More Tools**: Additional capabilities for quotes, schedules, reports
3. **Proactive Suggestions**: Agent recommends actions based on patterns
4. **Custom Workflows**: Define multi-step automated processes
5. **Integration with Email**: Send emails and notifications via agent
6. **Advanced Analytics**: Predictive insights and trend analysis

## Support

For issues or feature requests:
1. Check the console for error messages
2. Review the AI_TROUBLESHOOTING.md guide
3. Contact your system administrator
4. Report bugs through your development team

---

**Version**: 1.0  
**Last Updated**: 2024  
**AI Model**: GPT-4o via OpenRouter
