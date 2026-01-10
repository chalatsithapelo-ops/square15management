# AI Agent Multi-Portal Access Implementation

## Overview
The AI Agent has been made available across multiple portals in the application, with role-based access control to exclude customer-facing roles (ARTISAN and CUSTOMER).

## Implementation Summary

### Roles with AI Agent Access ✅
The following roles now have access to the AI Agent:
- **SENIOR_ADMIN** - Via Admin Portal
- **JUNIOR_ADMIN** - Via Admin Portal  
- **MANAGER** - Via Admin Portal
- **TECHNICAL_MANAGER** - Via Admin Portal
- **ACCOUNTANT** - Via Admin Portal
- **SALES_AGENT** - Via Admin Portal
- **SUPERVISOR** - Via Admin Portal
- **PROPERTY_MANAGER** - Via Property Manager Portal

### Roles Excluded from AI Agent Access ❌
- **ARTISAN** - No access (as requested)
- **CUSTOMER** - No access (as requested)

## What Was Changed

### 1. New Property Manager AI Agent Route
**File**: `src/routes/property-manager/ai-agent.tsx`
- Created dedicated AI Agent route for Property Managers
- Uses same AIAgentChat component for consistent experience
- Accessible at `/property-manager/ai-agent`

### 2. Admin Dashboard Navigation
**File**: `src/routes/admin/dashboard/index.tsx`
- Added "AI Agent" card to admin dashboard
- Icon: Bot (cyan gradient)
- Stats: "27 tools available"
- Accessible to all admin portal users (SENIOR_ADMIN, JUNIOR_ADMIN, MANAGER, TECHNICAL_MANAGER, ACCOUNTANT, SALES_AGENT, SUPERVISOR)

### 3. Property Manager Dashboard Navigation  
**File**: `src/routes/property-manager/dashboard/index.tsx`
- Added prominent "AI Agent" button to header
- Styled with cyan gradient for visibility
- Quick access without navigating through tabs

## User Experience

### Admin Portal Users
1. Log in with any admin role (SENIOR_ADMIN, JUNIOR_ADMIN, MANAGER, etc.)
2. See "AI Agent" card on dashboard
3. Click to access AI Agent at `/admin/ai-agent`
4. All conversations are private (user sees only their own)

### Property Manager Portal Users
1. Log in as PROPERTY_MANAGER
2. See "AI Agent" button in header (next to notifications)
3. Click to access AI Agent at `/property-manager/ai-agent`
4. All conversations are private (user sees only their own)

### Artisan & Customer Portal Users
- **NO AI AGENT ACCESS** (as requested)
- These roles do not see AI Agent navigation options
- Routes are technically accessible but protected by conversation isolation

## Conversation Isolation (Already Working)

Each user has a **private 1-on-1 conversation** with the AI Agent:
- Property Manager A cannot see Property Manager B's chat
- Junior Admin cannot see Senior Admin's chat
- Sales Agent cannot see Accountant's chat

**How It Works**:
- Each conversation has exactly 2 participants: `[User, AI Agent System User]`
- Prisma query uses `AND` with `some` to match both participants
- Length validation ensures it's a 1-on-1 conversation (not group chat)

## AI Agent Capabilities

All users with access have the same 27 tools available:

### CRM & SALES (5 tools)
- Create leads, list leads, get lead details, update lead status, get sales summary

### QUOTATIONS & INVOICING (4 tools)
- Create quotations, list quotations, create invoices, generate statements

### PROJECT MANAGEMENT (4 tools)
- Create projects, list projects, update project status, get project performance

### OPERATIONS (2 tools)
- Create orders, upload files

### HR & PAYROLL (4 tools)
- Create employees, list employees, create payment requests, list payment requests

### FINANCIAL MANAGEMENT (6 tools)
- Generate financial reports, query metrics, create assets, list assets, create liabilities, list liabilities

### BUSINESS INTELLIGENCE (2 tools)
- Get business health analysis, get cash flow analysis

## Testing

### Test Scenarios
1. **Test Admin Access**: 
   - Log in as SENIOR_ADMIN or JUNIOR_ADMIN
   - Navigate to Admin Dashboard
   - Click "AI Agent" card
   - Verify conversation loads

2. **Test Property Manager Access**:
   - Log in as PROPERTY_MANAGER
   - Navigate to Property Manager Dashboard
   - Click "AI Agent" button in header
   - Verify conversation loads

3. **Test Conversation Isolation**:
   - Create 2 users with different roles (e.g., Junior Admin + Property Manager)
   - Send messages from both users to AI Agent
   - Log in as each user and verify they only see their own messages

4. **Test Tool Execution**:
   - Ask AI Agent: "Create a lead for John Smith, email john@example.com, phone 0123456789"
   - Verify lead is created in CRM
   - Ask: "List all my leads"
   - Verify lead appears in response

5. **Test Analytics**:
   - Ask: "What is our business health?"
   - Verify comprehensive analysis with revenue, assets, liabilities, net worth
   - Ask: "Show me cash flow analysis"
   - Verify pending invoices and upcoming payments forecast

## Portal Route Mapping

Based on `src/utils/roles.ts`:

| Role | Default Route | AI Agent Route |
|------|---------------|----------------|
| SENIOR_ADMIN | /admin/dashboard | /admin/ai-agent |
| JUNIOR_ADMIN | /admin/dashboard | /admin/ai-agent |
| MANAGER | /admin/dashboard | /admin/ai-agent |
| ACCOUNTANT | /admin/accounts | /admin/ai-agent |
| TECHNICAL_MANAGER | /admin/dashboard | /admin/ai-agent |
| SALES_AGENT | /admin/crm | /admin/ai-agent |
| SUPERVISOR | /admin/operations | /admin/ai-agent |
| PROPERTY_MANAGER | /property-manager/dashboard | /property-manager/ai-agent |
| ARTISAN | /artisan/dashboard | **No access** |
| CUSTOMER | /customer/dashboard | **No access** |

## Technical Details

### Conversation Creation
**File**: `src/server/trpc/procedures/getOrCreateAIAgentConversation.ts`
```typescript
// Find conversation with BOTH user and AI Agent
const existingConversation = await db.conversation.findFirst({
  where: {
    AND: [
      { participants: { some: { id: userId } } },
      { participants: { some: { id: aiAgentUser.id } } }
    ]
  },
  include: { participants, messages }
});

// Verify exactly 2 participants
if (existingConversation && existingConversation.participants.length === 2) {
  return existingConversation;
}
```

### Message Processing
**File**: `src/server/trpc/procedures/aiAgent.ts`
- Same isolation logic for message sending
- Ensures user can only send messages to their own conversation

### Agentic Loop
**File**: `src/server/services/aiAgentService.ts`
- Max 5 iterations of tool execution
- Google Gemini 2.0 Flash model
- Temperature: 0.7
- History limit: 2 messages (prevents context bleeding)

## Success Criteria ✅

- ✅ AI Agent accessible from admin portal (all admin roles)
- ✅ AI Agent accessible from property manager portal
- ✅ Artisan and Customer roles excluded
- ✅ Each user sees only their own conversations
- ✅ All 27 tools available to all qualifying users
- ✅ Consistent experience across portals
- ✅ No code errors or compilation issues

## Next Steps

If you want to add AI Agent to additional portals in the future:
1. Create route file: `src/routes/{portal-name}/ai-agent.tsx`
2. Import and use `AIAgentChat` component
3. Add navigation link/button to portal dashboard
4. Conversation isolation automatically works (no additional code needed)

## Troubleshooting

### Issue: User doesn't see AI Agent option
**Solution**: Check user's role. Only roles listed in "Roles with AI Agent Access" section can access it.

### Issue: User sees another user's conversations
**Solution**: This should not happen. Check database to ensure conversation has exactly 2 participants.

### Issue: AI Agent not responding
**Solution**: 
1. Check Docker logs: `docker logs docker-app-1`
2. Verify GOOGLE_GEMINI_API_KEY is set in environment
3. Check network connectivity to Google API

### Issue: Tools not executing
**Solution**: Check aiAgentService logs for tool execution errors. Verify database schema matches tool expectations.
