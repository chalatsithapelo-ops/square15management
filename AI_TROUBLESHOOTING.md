# AI Functionality Troubleshooting Guide

## Overview

This application uses **Google Gemini AI** to provide intelligent features including:

- **AI Agent Chat**: Interactive assistant that can read and manage application data
- **Lead Scoring**: AI-powered lead quality assessment and prioritization
- **Project Risk Analysis**: Automated risk identification and mitigation strategies
- **Service Classification**: Automatic categorization of service requests
- **Expense Categorization**: Receipt/slip analysis and categorization
- **Artisan Suggestions**: Smart matching of jobs to artisans
- **Quotation Generation**: Automated line item creation for quotes
- **HR Coaching Insights**: Personalized employee performance recommendations
- **Financial Report Insights**: AI-generated analysis of financial data
- **Invoice Description Generation**: Automatic invoice detail generation

## ⚠️ JUST UPDATED BILLING? READ THIS FIRST

**If you recently updated your Google Cloud billing details and are still seeing authentication errors**, this is the most common issue:

### The Problem

Updating billing details in Google Cloud **does not automatically fix an invalid API key**. The API key in your `.env` file (`AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw`) may be:
- Associated with a different Google Cloud project
- Created before billing was enabled
- Invalid or revoked
- From a project that doesn't have the Gemini API enabled

### The Solution: Generate a Fresh API Key

Follow these steps **in order**:

#### 1. Verify Your Google Cloud Project Setup

1. **Go to Google Cloud Console**: https://console.cloud.google.com/
2. **Select or Create a Project**:
   - If you just set up billing, make sure you're in the correct project
   - The project name should appear at the top of the page
3. **Verify Billing is Enabled**:
   - Click the menu (☰) → "Billing"
   - Confirm this project is linked to a billing account
   - You should see "Billing account: [Your Account Name]"

#### 2. Enable the Gemini API

1. **Navigate to API Library**:
   - Menu (☰) → "APIs & Services" → "Library"
2. **Search for Gemini**:
   - Type "Generative Language API" in the search box
   - This is the API name for Gemini
3. **Enable the API**:
   - Click on "Generative Language API"
   - If you see "ENABLE" button, click it
   - If you see "MANAGE", it's already enabled ✓
   - Wait a few seconds for activation

#### 3. Generate a New API Key

1. **Go to Credentials**:
   - Menu (☰) → "APIs & Services" → "Credentials"
2. **Create New Key**:
   - Click "+ CREATE CREDENTIALS" at the top
   - Select "API Key"
   - A popup will show your new key (starts with `AIzaSy...`)
3. **Copy the Key**:
   - Click the copy icon or manually select and copy
   - Keep this window open for now

#### 4. (Recommended) Restrict the Key

1. **Click "RESTRICT KEY"** in the popup (or click the key name in the credentials list)
2. **Set API Restrictions**:
   - Under "API restrictions", select "Restrict key"
   - In the dropdown, find and select "Generative Language API"
   - Click "Save"
3. **Why?** This prevents unauthorized use if the key is accidentally exposed

#### 5. Update Your Application

1. **Open the `.env` file** in your project root:
   ```bash
   nano .env
   # or use your preferred editor
   ```

2. **Find this line**:
   ```
   GEMINI_API_KEY=AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw
   ```

3. **Replace with your new key**:
   ```
   GEMINI_API_KEY=AIzaSyYourNewKeyHere123456789...
   ```

4. **Save the file** (Ctrl+X, then Y, then Enter if using nano)

#### 6. Restart the Application

```bash
# If using Docker Compose:
docker-compose restart

# If running locally:
# Press Ctrl+C to stop, then:
npm run dev
```

#### 7. Test the AI Agent

1. **Open your application** in the browser
2. **Click the AI chat widget** (bottom-right corner with the sparkle icon)
3. **Send a test message**: "Hello, can you help me?"
4. **Expected result**: You should get a response within 5-10 seconds

**If you still see an error**:
- Check the application logs for specific error details
- Verify you copied the entire API key (they're quite long)
- Confirm the `.env` file was saved correctly
- Make sure you restarted the application after updating `.env`

#### 8. Verify Everything Works

Test a few AI features to confirm:
- ✅ AI Agent Chat responds to messages
- ✅ Lead scoring works (CRM page → Create/Edit Lead → AI Score button)
- ✅ Project risk analysis works (Projects page → Open project → Analyze Risks)

### Why This is Necessary

**API keys are project-specific**. When you:
- Update billing on a project
- Create a new project
- Enable APIs in a different project

...the old API key from a different project won't work. You need a fresh key from the project that has:
1. ✅ Billing enabled
2. ✅ Gemini API (Generative Language API) enabled
3. ✅ Active and valid credentials

### Still Having Issues?

If you've followed all steps above and still see errors, continue to the sections below for detailed troubleshooting.

---

## Current Configuration

**AI Provider**: Google Gemini (via AI SDK)
**Environment Variable**: `GEMINI_API_KEY`
**Current Value**: `AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw`
**Location**: `.env` file in the project root
**Primary Model**: `gemini-2.0-flash-exp` (for agent chat with vision and tool calling)
**Secondary Model**: `gemini-1.5-pro` (for structured analysis tasks)

⚠️ **CURRENT STATUS**: If you're seeing authentication errors, this API key may be invalid, expired, or have billing/quota issues. See "Current Issue Diagnosis" section below.

## Current Issue Diagnosis

**Error Message**: "AI service authentication issue. Please contact your administrator to check the API key configuration."

**What This Means**: The Google Gemini API is rejecting the current API key with one of these issues:
- **Invalid API Key**: Key is incorrect, revoked, or expired
- **Billing Not Enabled**: Google Cloud project doesn't have billing enabled
- **API Not Enabled**: Gemini API is not enabled in the Google Cloud project
- **Quota Exceeded**: Free tier quota has been exhausted
- **Restricted Key**: API key restrictions prevent access to Gemini API

## Immediate Steps to Resolve

### Step 1: Verify the API Key Exists and is Valid

1. **Go to Google Cloud Console**:
   - Visit https://console.cloud.google.com/
   - Log in with the Google account that created the API key

2. **Navigate to API Credentials**:
   - Select your project (or create one if needed)
   - Go to "APIs & Services" → "Credentials"
   - Look for the API key: `AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw`

3. **Check Key Status**:
   - If the key doesn't exist, it was deleted → Generate a new one (see Step 4)
   - If the key exists, check if it's restricted
   - Click on the key to view its restrictions

### Step 2: Enable the Gemini API

1. **Navigate to API Library**:
   - In Google Cloud Console, go to "APIs & Services" → "Library"
   - Search for "Generative Language API" (this is the Gemini API)

2. **Enable the API**:
   - Click on "Generative Language API"
   - Click "Enable" if not already enabled
   - Wait for activation (usually instant)

### Step 3: Check Billing Status

**Important**: Google Gemini API requires billing to be enabled, even if you're using the free tier.

1. **Go to Billing**:
   - In Google Cloud Console, click the menu → "Billing"
   - Verify that billing is enabled for your project

2. **If Billing is Not Enabled**:
   - Click "Link a billing account"
   - Add a payment method (credit card required)
   - You won't be charged unless you exceed free tier limits

3. **Free Tier Limits** (as of 2024):
   - Gemini 1.5 Flash: 15 requests per minute, 1 million tokens per day
   - Gemini 1.5 Pro: 2 requests per minute, 50 requests per day
   - These limits are usually sufficient for moderate usage

4. **Check Quota Usage**:
   - Go to "APIs & Services" → "Quotas"
   - Search for "Generative Language API"
   - Check current usage vs. limits
   - If exceeded, wait for quota reset or request increase

### Step 4: Generate a New API Key (If Needed)

1. **Create New Key**:
   - Go to "APIs & Services" → "Credentials"
   - Click "Create Credentials" → "API Key"
   - A new key will be generated (format: `AIzaSy...`)

2. **Configure Key Restrictions (Recommended)**:
   - Click on the newly created key
   - Under "API restrictions", select "Restrict key"
   - Choose "Generative Language API"
   - Save changes

3. **Update Application**:
   - Copy the new API key
   - Open `.env` file in the project root
   - Update: `GEMINI_API_KEY=your-new-key-here`
   - Save the file

4. **Restart Application**:
   ```bash
   # If using Docker
   docker-compose restart
   
   # If running locally
   # Stop the app (Ctrl+C) and restart with:
   npm run dev
   ```

### Step 5: Test the Fix

1. **Try AI Agent Chat**:
   - Open the application
   - Click on the AI chat widget (bottom-right corner)
   - Send a message like "Hello, can you help me?"
   - Should receive a response within 5-10 seconds

2. **Try Other AI Features**:
   - Lead Scoring (CRM page)
   - Project Risk Analysis (Projects page)
   - Coaching Insights (HR Employee page)

3. **Check Application Logs**:
   - If still failing, check logs for specific error messages
   - Look for "[AI Agent] ERROR OCCURRED" or similar messages

## Common Issues and Solutions

### Issue 1: "AI service authentication issue"

**Symptoms**: 
- Error message: "AI service authentication issue. Please contact your administrator..."
- All AI features fail immediately
- Logs show 401 errors or "Invalid API key"

**Root Causes**:
- API key is invalid, revoked, or expired
- API key has incorrect restrictions
- Gemini API is not enabled in the project

**Solution**:
1. Follow Steps 1-4 above to verify and regenerate the key
2. Ensure Gemini API (Generative Language API) is enabled
3. Remove or adjust API key restrictions if too restrictive
4. Restart the application after updating `.env`

### Issue 2: "AI service quota exceeded"

**Symptoms**:
- Error message mentions "quota" or "insufficient_quota"
- AI features work sometimes but fail during high usage
- Logs show 429 errors

**Root Causes**:
- Free tier quota limits exceeded
- Too many requests in a short time period

**Solution**:
1. **Wait for Quota Reset**:
   - Daily quotas reset at midnight Pacific Time
   - Per-minute quotas reset after 60 seconds

2. **Check Current Usage**:
   - Go to Google Cloud Console → "APIs & Services" → "Quotas"
   - Search for "Generative Language API"
   - View current usage and limits

3. **Request Quota Increase** (if needed):
   - Click on the quota you want to increase
   - Click "Edit Quotas"
   - Submit a request explaining your needs
   - Usually approved within 24-48 hours

4. **Upgrade to Paid Tier** (if consistently hitting limits):
   - Paid tier has much higher quotas
   - Pricing: Pay-as-you-go based on usage
   - Typical costs: $0.001-0.01 per request depending on model and tokens

### Issue 3: "Billing not enabled"

**Symptoms**:
- Error message mentions "Payment Required" or "402"
- API key is valid but requests are rejected
- Logs show billing-related errors

**Root Causes**:
- Google Cloud project doesn't have billing enabled
- Payment method is expired or declined
- Billing account is suspended

**Solution**:
1. **Enable Billing**:
   - Go to Google Cloud Console → "Billing"
   - Link a billing account to your project
   - Add a valid payment method

2. **Verify Payment Method**:
   - Check that credit card is not expired
   - Ensure sufficient credit limit
   - Verify billing address is correct

3. **Free Tier Note**:
   - Even with billing enabled, you can stay within free tier limits
   - You won't be charged unless you exceed free quotas
   - Set up billing alerts to monitor usage

### Issue 4: "AI service rate limit exceeded"

**Symptoms**:
- Error message: "AI service rate limit exceeded. Please try again..."
- Intermittent failures during high usage
- Logs show 429 errors

**Root Causes**:
- Too many requests per minute
- Gemini 1.5 Pro has stricter rate limits (2 RPM)

**Solution**:
1. **Wait and Retry**:
   - Wait 60 seconds before trying again
   - Rate limits reset every minute

2. **Use Gemini Flash Instead** (if applicable):
   - Flash model has higher rate limits (15 RPM)
   - Slightly less capable but much faster
   - Good for most use cases

3. **Implement Request Throttling**:
   - Space out AI requests in high-volume scenarios
   - Add delays between batch operations

### Issue 5: "Network error connecting to AI service"

**Symptoms**:
- Error message mentions "network" or "connection"
- Logs show ECONNREFUSED or timeout errors
- Other internet services work fine

**Root Causes**:
- Firewall blocking Google API domains
- DNS resolution issues
- Proxy configuration problems

**Solution**:
1. **Check Firewall**:
   - Ensure `generativelanguage.googleapis.com` is not blocked
   - Whitelist Google API domains if needed

2. **Test Network Connectivity**:
   ```bash
   curl https://generativelanguage.googleapis.com/v1beta/models
   ```
   - Should return a JSON response (even without auth)
   - If timeout/error, network issue confirmed

3. **Check Proxy Settings**:
   - If behind corporate proxy, configure proxy settings
   - Set HTTP_PROXY and HTTPS_PROXY environment variables if needed

## Testing AI Functionality

### Quick Test Checklist

✅ **AI Agent Chat** (Main feature):
- Click the chat widget (bottom-right corner)
- Send: "Hello, what can you help me with?"
- Should respond in 5-10 seconds with capabilities list
- Try: "Show me all leads" (should use tools to fetch real data)
- Try uploading an image and asking about it

✅ **Lead Scoring** (CRM page):
- Create a test lead with complete information
- Click "AI Score" button
- Should receive score (0-100), priority, and recommendations

✅ **Project Risk Analysis** (Projects page):
- Open a project with milestones
- Click "Analyze Risks" button
- Should identify 3-8 potential risks with mitigation strategies

✅ **Coaching Insights** (HR Employee page):
- Navigate to an employee's detail page
- Click "Generate Coaching Recommendations"
- Should receive personalized insights in 10-20 seconds

✅ **Service Classification** (CRM page):
- Start creating a new lead
- Enter a detailed description (20+ characters)
- Service type should auto-suggest after 1.5 seconds

✅ **Financial Reports** (Accounts page):
- Generate a financial report
- AI insights should appear in the report
- If AI fails, report still generates with fallback message

## Verifying API Key Status

### Method 1: Test with curl
```bash
curl "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=YOUR_API_KEY_HERE" \
  -H 'Content-Type: application/json' \
  -d '{
    "contents": [{
      "parts": [{
        "text": "Hello"
      }]
    }]
  }'
```

**Expected Response** (if key is valid):
```json
{
  "candidates": [{
    "content": {
      "parts": [{
        "text": "Hello! How can I help you today?"
      }]
    }
  }]
}
```

**Error Response** (if key is invalid):
```json
{
  "error": {
    "code": 400,
    "message": "API key not valid...",
    "status": "INVALID_ARGUMENT"
  }
}
```

### Method 2: Check Application Logs

When AI functions fail, the application logs detailed diagnostics:

```
[AI Agent] ERROR OCCURRED
[AI Agent] Error name: GoogleGenerativeAIError
[AI Agent] Error message: [401] Invalid API key
[AI Agent] DIAGNOSIS: API key issue detected
```

Look for these patterns:
- `[401]` or `unauthorized` → Invalid API key
- `[402]` or `Payment Required` → Billing not enabled
- `[429]` or `rate limit` → Quota exceeded
- `insufficient_quota` → Quota limits hit

### Method 3: Google Cloud Console

1. Visit https://console.cloud.google.com/
2. Select your project
3. Go to "APIs & Services" → "Dashboard"
4. Click on "Generative Language API"
5. View traffic, errors, and quota usage graphs
6. Recent errors will show up with details

## Updating the API Key

### Step-by-Step Process

1. **Open the `.env` file**:
   ```bash
   # In the project root directory
   nano .env
   # or use your preferred text editor
   ```

2. **Find the line**:
   ```
   GEMINI_API_KEY=AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw
   ```

3. **Replace with new key**:
   ```
   GEMINI_API_KEY=AIzaSyYourNewKeyHere...
   ```

4. **Save the file**:
   - Press `Ctrl+X`, then `Y`, then `Enter` (if using nano)
   - Or save normally in your text editor

5. **Restart the application**:
   ```bash
   # If using Docker Compose
   docker-compose restart
   
   # If running locally
   # Stop with Ctrl+C, then:
   npm run dev
   ```

6. **Verify the change**:
   - Check logs for: `[AI Agent] API key configured: Yes (AIzaSyYo...)`
   - Try an AI feature to confirm it works

### Security Best Practices

⚠️ **Never commit API keys to version control**
- The `.env` file is already in `.gitignore`
- Never share API keys in screenshots or documentation
- Rotate keys periodically (every 3-6 months)

🔒 **Restrict API Key Access**:
- In Google Cloud Console, restrict keys to specific APIs
- Add application restrictions (HTTP referrers or IP addresses)
- Use separate keys for development and production

## Error Messages Reference

| Error Message | Cause | Action Required |
|--------------|-------|-----------------|
| "AI service authentication issue" | Invalid/expired API key | Generate new key, update `.env` |
| "API key not valid" | Key is incorrect | Verify key in Google Cloud Console |
| "Payment Required" / "402" | Billing not enabled | Enable billing in Google Cloud |
| "insufficient_quota" | Quota exceeded | Wait for reset or request increase |
| "rate limit exceeded" / "429" | Too many requests | Wait 60 seconds and retry |
| "API not enabled" | Gemini API not enabled | Enable in API Library |
| "Network error" | Connection issue | Check firewall/proxy settings |

## Cost and Quota Information

### Free Tier Limits (Gemini API)

**Gemini 1.5 Flash** (used for most features):
- 15 requests per minute
- 1 million tokens per day
- 1,500 requests per day

**Gemini 1.5 Pro** (used for complex analysis):
- 2 requests per minute
- 50 requests per day
- 32,000 tokens per minute

### Typical Usage Costs (if exceeding free tier)

**Gemini 1.5 Flash**:
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens

**Gemini 1.5 Pro**:
- Input: $1.25 per 1M tokens
- Output: $5.00 per 1M tokens

**Typical Request Costs**:
- AI Agent Chat: $0.001-0.01 per message
- Lead Scoring: $0.01-0.03 per lead
- Project Risk Analysis: $0.05-0.15 per analysis
- Coaching Insights: $0.05-0.10 per generation
- Service Classification: $0.005-0.01 per request

### Monitoring Usage

1. **Google Cloud Console**:
   - Go to "APIs & Services" → "Quotas"
   - View real-time usage metrics
   - Set up quota alerts

2. **Billing Reports**:
   - Go to "Billing" → "Reports"
   - Filter by "Generative Language API"
   - View daily/monthly costs

3. **Set Budget Alerts**:
   - Go to "Billing" → "Budgets & alerts"
   - Create budget with email alerts
   - Recommended: Set alert at 50%, 90%, 100% of budget

## Fallback Behavior

When AI services fail, the application provides graceful degradation:

1. **AI Agent Chat**: Shows error message with retry option
2. **Lead Scoring**: Users can manually assess and prioritize leads
3. **Project Risk Analysis**: Manual risk entry still available
4. **Service Classification**: Manual dropdown selection available
5. **Expense Categorization**: Manual category selection
6. **Artisan Suggestions**: Manual assignment from artisan list
7. **Quotation Line Items**: Manual entry of line items
8. **Coaching Insights**: Shows error with retry option
9. **Financial Reports**: Report generates with fallback message

## Getting Help

If issues persist after following this guide:

1. **Check Application Logs**:
   ```bash
   # If using Docker
   docker-compose logs -f app
   
   # Look for [AI Agent] ERROR OCCURRED sections
   ```

2. **Verify Google Cloud Project**:
   - Confirm project is active
   - Check billing is enabled
   - Verify Gemini API is enabled
   - Review quota usage

3. **Test API Key Directly**:
   - Use the curl command in "Method 1" above
   - Confirms if issue is with key or application

4. **Contact Google Cloud Support**:
   - If key appears valid but still fails
   - If quota increase request is needed
   - If billing issues persist

5. **Check Google Cloud Status**:
   - Visit https://status.cloud.google.com/
   - Check for Gemini API outages

## Recent Changes Log

**Current Status (Latest)**:
- ✅ Application uses Google Gemini API (not OpenRouter)
- ✅ Environment variable: `GEMINI_API_KEY`
- ✅ Primary model: `gemini-2.0-flash-exp`
- ✅ Comprehensive error handling for auth/billing issues
- ✅ Clear error messages guide users to troubleshooting steps

**Error Handling Improvements**:
- All AI procedures detect and report invalid API keys (401)
- Billing/quota issues properly identified (402, insufficient_quota)
- Rate limiting handled gracefully (429)
- Network errors reported with actionable guidance
- Users see clear messages directing them to contact administrator

## Next Steps for Administrator

1. ✅ **Verify Current API Key**:
   - Check if `AIzaSyCRTPu_VWs9K4GraM1VGfpjCdCRDraWxpw` is valid
   - Use curl test command above

2. ✅ **Check Google Cloud Project**:
   - Confirm Gemini API is enabled
   - Verify billing is active
   - Review quota usage

3. ✅ **Generate New Key** (if current is invalid):
   - Follow Step 4 in "Immediate Steps to Resolve"
   - Update `.env` file
   - Restart application

4. ✅ **Test AI Features**:
   - Try AI Agent Chat first
   - Test each AI feature systematically
   - Confirm all working before marking as resolved

5. ✅ **Set Up Monitoring**:
   - Enable quota alerts in Google Cloud
   - Set up billing alerts
   - Monitor daily usage for first week

---

**Last Updated**: 2024 (Gemini API Migration)
**Maintained By**: Development Team
**For Issues**: Check application logs and Google Cloud Console first
