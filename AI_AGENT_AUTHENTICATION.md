# AI Agent Authentication Guide

## Overview

The **PropMate AI Agent** uses the **logged-in user's session token** for authentication. This means:

- ✅ **No separate token needed** - The AI Agent automatically uses your login session
- ✅ **Secure by design** - The agent can only access what the logged-in user can access
- ✅ **Role-based permissions** - The agent respects user roles (Admin, Manager, Artisan, Customer)
- ✅ **Automatic authentication** - Works seamlessly as long as you're logged in

## How It Works

### 1. User Login
When you log in to the application:
```
User logs in → JWT token generated → Token stored in browser (Zustand + localStorage)
```

The token is stored under the key `"prop-management-auth"` in your browser's localStorage.

### 2. AI Agent Authentication Flow
When you interact with the AI Agent:

```
User sends message → geminiService.ts retrieves token from auth store
                  → Token passed to server with message
                  → Server validates token
                  → AI tools execute with user's permissions
                  → Response returned to user
```

### 3. Permission-Based Access
The AI Agent inherits your permissions:

| User Role | AI Agent Can Access |
|-----------|---------------------|
| **Admin** | Everything - all leads, orders, projects, financial data, employees |
| **Manager** | CRM, operations, limited financial data |
| **Artisan** | Assigned jobs, milestones, earnings |
| **Customer** | Own orders, projects, invoices |

## Technical Implementation

### Client-Side (Automatic)
The AI Agent service (`src/services/geminiService.ts`) automatically retrieves your token:

```typescript
// Get auth token from Zustand store
const authToken = useAuthStore.getState().token;

if (!authToken) {
  throw new Error('You are not logged in. Please log in to use the AI Assistant.');
}
```

### Server-Side (Secure)
The server validates the token for every AI tool call:

```typescript
// Each tool authenticates the user
const user = await authenticateUser(authToken);
requirePermission(user, PERMISSIONS.VIEW_LEADS); // Example permission check
```

## Common Issues & Solutions

### Issue: "You are not logged in"

**Cause:** Your session token is not available.

**Solutions:**
1. **Log in to the application** - Simply log in with your credentials
2. **Refresh the page** - Sometimes the auth state needs to rehydrate
3. **Clear browser cache** - If the token is corrupted, log out and log back in

### Issue: "Permission denied" or "Access denied"

**Cause:** Your user role doesn't have permission for the requested action.

**Solution:**
- Contact your administrator to adjust your role permissions
- The AI Agent can only perform actions that your user account is authorized to do

### Issue: "AI service authentication failed"

**Cause:** This is a server-side API key issue, not a user authentication issue.

**Solution:**
- Contact your system administrator
- They need to verify the `GOOGLE_GENERATIVE_AI_API_KEY` environment variable is set correctly

## For Developers

### Accessing the Auth Store Outside React Components

The auth store can be accessed outside of React components:

```typescript
import { useAuthStore } from '~/stores/auth';

// Get current state
const token = useAuthStore.getState().token;
const user = useAuthStore.getState().user;

// Subscribe to changes
const unsubscribe = useAuthStore.subscribe((state) => {
  console.log('Token changed:', state.token);
});
```

### Auth Store Structure

```typescript
interface AuthState {
  token: string | null;          // JWT token
  user: AuthUser | null;         // User details
  setAuth: (token, user) => void; // Set authentication
  clearAuth: () => void;          // Clear authentication (logout)
}
```

### Token Lifecycle

1. **Login** → Token generated and stored
2. **Page refresh** → Token loaded from localStorage
3. **API calls** → Token sent in request parameters (not headers)
4. **Logout** → Token cleared from store and localStorage

## Security Notes

### Why We Don't Use a Separate AI Agent Token

Using the logged-in user's token ensures:
- **Audit trail** - All AI actions are attributed to the actual user
- **Permission boundaries** - The AI can't access data the user can't access
- **Session management** - AI access expires when the user logs out
- **Compliance** - Meets security and data access requirements

### Token Security

- ✅ Tokens are **JWT** (JSON Web Tokens) with expiration
- ✅ Tokens are **never** exposed in URLs or logs
- ✅ Tokens are validated on **every** server request
- ✅ Invalid tokens result in immediate rejection

## Testing AI Agent Authentication

### Test 1: Verify Token Retrieval
Open browser console and run:
```javascript
const store = localStorage.getItem('prop-management-auth');
console.log('Auth store:', JSON.parse(store));
```

You should see your token and user details.

### Test 2: Test AI Agent Access
1. Log in as different user roles
2. Try the AI Agent with commands like:
   - "Show me all leads" (requires CRM access)
   - "Get financial metrics" (requires Admin access)
3. Verify the agent respects your role permissions

### Test 3: Test Logout
1. Use the AI Agent successfully
2. Log out
3. Try to use the AI Agent
4. You should see "You are not logged in" error

## Environment Variables

The AI Agent requires this server-side environment variable:

```bash
GOOGLE_GENERATIVE_AI_API_KEY=your-api-key-here
```

This is **NOT** a user authentication token - it's the API key for the Google Gemini AI service.

**Current Status:** Check `.env` file or ask your administrator

## Troubleshooting Checklist

- [ ] Are you logged in to the application?
- [ ] Can you access other parts of the application?
- [ ] Does the browser console show any errors?
- [ ] Have you tried refreshing the page?
- [ ] Have you tried logging out and back in?
- [ ] Is the `GOOGLE_GENERATIVE_AI_API_KEY` configured? (Admin only)

## Getting Help

If you continue to experience authentication issues:

1. **Check the browser console** for detailed error messages
2. **Contact your administrator** if it's a permission issue
3. **Report the issue** with:
   - Your user role
   - What you were trying to do
   - The exact error message
   - Browser console logs

---

## Summary

**You don't need a separate authentication token for the AI Agent.** It automatically uses your login session. Just log in to the application and start using the AI Assistant!
