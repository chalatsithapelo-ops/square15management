import { z } from "zod";
import { generateText } from 'ai';
import { google } from '@ai-sdk/google';
import { anthropic } from '@ai-sdk/anthropic';
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import { agentTools } from "~/server/utils/agent-tools";

const inputSchema = z.object({
  authToken: z.string(),
  history: z.array(z.object({
    role: z.enum(['user', 'model']),
    text: z.string(),
  })),
  userText: z.string(),
  attachments: z.array(z.object({
    mimeType: z.string(),
    data: z.string(), // base64 encoded
  })).optional().default([]),
  contextFunctions: z.any().optional(),
});

// Log module load to verify the file is being used
if (typeof process !== 'undefined' && process.env.NODE_ENV === 'development') {
  console.log('[sendAgentMessage.ts] Module loaded! Anthropic API key present:', process.env.ANTHROPIC_API_KEY ? 'YES (length: ' + process.env.ANTHROPIC_API_KEY.length + ')' : 'NO');
}

export const sendAgentMessage = baseProcedure
  .input(inputSchema)
  .mutation(async ({ input }) => {
    try {
      console.log('[AI Agent] ★ PROCEDURE CALLED ★');
      console.log('[AI Agent] Starting request processing');
      console.log('[AI Agent] History length:', input.history.length);
      console.log('[AI Agent] User text length:', input.userText.length);
      console.log('[AI Agent] Attachments count:', input.attachments.length);
      
      // Select AI provider and model. Preference order:
      // 1. If DEFAULT_AI_PROVIDER is set use it.
      // 2. Otherwise prefer Anthropic when ANTHROPIC_API_KEY is present, else Google (Gemini).
      let provider = (env.DEFAULT_AI_PROVIDER || '').toLowerCase();
      if (!provider) {
        provider = env.ANTHROPIC_API_KEY ? 'anthropic' : 'google';
      }

      let modelName: string;
      let model: any;

      if (provider === 'anthropic' && env.ANTHROPIC_API_KEY) {
        modelName = env.DEFAULT_ANTHROPIC_MODEL || 'claude-4-5-haiku';
        try {
          model = anthropic(modelName);
          console.log('[AI Agent] anthropic() initialization successful');
        } catch (initError) {
          console.error('[AI Agent] anthropic() initialization FAILED:', initError instanceof Error ? initError.message : String(initError));
          throw initError;
        }
        console.log('[AI Agent] Using Anthropic model:', modelName);
        console.log('[AI Agent] Anthropic API key length:', env.ANTHROPIC_API_KEY?.length || 0, 'chars');
        console.log('[AI Agent] Anthropic API key first 12 chars:', env.ANTHROPIC_API_KEY?.substring(0, 12) || 'MISSING');
      } else {
        modelName = env.DEFAULT_GOOGLE_MODEL || 'gemini-2.0-flash-exp';
        model = google(modelName);
        console.log('[AI Agent] Using Google model:', modelName);
        console.log('[AI Agent] Google API key configured:', env.GOOGLE_GENERATIVE_AI_API_KEY ? `Yes (${env.GOOGLE_GENERATIVE_AI_API_KEY.substring(0, 8)}...)` : 'No');
      }

      // Build the user message content
      const userContent: Array<{ type: 'text'; text: string } | { type: 'image'; image: Buffer }> = [];

      // Add text content
      if (input.userText.trim()) {
        userContent.push({
          type: 'text',
          text: input.userText,
        });
      }

      // Add attachments (images, PDFs, audio)
      for (const attachment of input.attachments) {
        if (attachment.mimeType.startsWith('image/')) {
          // Convert base64 to Buffer for images
          const imageBuffer = Buffer.from(attachment.data, 'base64');
          userContent.push({
            type: 'image',
            image: imageBuffer,
          });
          console.log('[AI Agent] Added image attachment, size:', imageBuffer.length, 'bytes');
        } else if (attachment.mimeType === 'application/pdf') {
          userContent.push({
            type: 'text',
            text: '[PDF document attached - I can see this is a PDF. Please describe what you need me to do with it, such as extract invoice details, analyze content, etc.]',
          });
          console.log('[AI Agent] Added PDF attachment placeholder');
        } else if (attachment.mimeType.startsWith('audio/')) {
          userContent.push({
            type: 'text',
            text: '[Voice recording received - Please note: I cannot directly process audio files yet. Please describe your request in text, or I can help you with any written instructions.]',
          });
          console.log('[AI Agent] Added audio attachment placeholder');
        }
      }

      // Convert history to AI SDK format
      const messages: any[] = input.history.slice(-10).map((msg) => ({
        role: (msg.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
        content: msg.text,
      }));

      // Add the current user message
      messages.push({
        role: 'user' as const,
        content: userContent,
      });

      console.log('[AI Agent] Prepared', messages.length, 'messages for API call');

      // Prepare tools with authToken injected
      const toolsWithAuth: Record<string, any> = {};
      for (const [toolName, toolDef] of Object.entries(agentTools)) {
        toolsWithAuth[toolName] = {
          description: toolDef.description,
          parameters: toolDef.parameters,
          execute: async (params: any) => {
            // Log tool execution
            console.log(`[AI Agent] ★★★ TOOL CALLED: ${toolName} ★★★`);
            console.log(`[AI Agent] Tool params:`, JSON.stringify(params, null, 2).substring(0, 200));
            
            try {
              // Inject authToken into all tool calls
              const result = await (toolDef.execute as any)(
                { ...params, authToken: input.authToken },
                { toolCallId: toolName, messages: [] }
              );
              console.log(`[AI Agent] ✓ Tool ${toolName} completed successfully`);
              console.log(`[AI Agent] Tool result:`, JSON.stringify(result, null, 2).substring(0, 300));
              return result;
            } catch (toolError) {
              console.error(`[AI Agent] ✗ Tool ${toolName} FAILED:`, toolError instanceof Error ? toolError.message : String(toolError));
              throw toolError;
            }
          },
        };
      }

      console.log('[AI Agent] Configured', Object.keys(toolsWithAuth).length, 'tools');
      console.log('[AI Agent] Tools available:', Object.keys(toolsWithAuth).join(', '));
      console.log('[AI Agent] About to call generateText with provider:', provider, 'model:', modelName);

      // Comprehensive system prompt
      const systemPrompt = `You are an AI assistant that creates business records for a property management system.

YOUR JOB: When users ask you to create something, USE TOOLS to create it immediately.

TOOLS YOU HAVE (USE THESE):
1. createLead - Create a lead for a new/existing customer
2. createQuotation - Create a price quote for a customer
3. createInvoice - Create a billing invoice
4. createProject - Create a project
5. createStatement - Create a customer statement
6. sendJobToArtisan - Assign work to a contractor
7. Get/View tools - Search and view data (getLeads, getQuotations, getInvoices, etc.)
8. Update tools - Modify existing records (updateLeadStatus, updateInvoiceStatus, etc.)

WHEN USER SAYS:
- "Create a lead for..." → USE createLead tool with the provided details
- "Create a quotation for..." → USE createQuotation tool
- "Create an invoice for..." → USE createInvoice tool
- "Create a project..." → USE createProject tool
- "Show me..." → USE the appropriate GET tool (getLeads, getInvoices, etc.)
- "Update..." → USE the appropriate UPDATE tool

IMPORTANT RULES:
1. ALWAYS use tools when asked to create, update, or view something
2. If tool execution fails, explain the error clearly
3. When a tool succeeds, confirm what was created with specific details (ID, number, etc.)
4. For missing details (email, phone, address), ask the user for them before proceeding
5. Be direct and action-oriented - no passive descriptions

TOOL PARAMETERS:
- authToken: Automatically provided (don't ask user for it)
- Always include all required fields from user input
- Use exact field names and formats specified in tool descriptions

RESPONSE FORMAT:
✓ Success: "Done! I created [item type] [details with ID/number]"
✗ Error: "I couldn't create it because [specific reason]"
? Missing info: "I need [specific field] to proceed. What is it?"

EXAMPLES OF CORRECT BEHAVIOR:
User: "Create a lead for John Smith, john@test.com, 555-1234, needs plumbing"
YOU: Use createLead tool → "✓ Created lead for John Smith (ID: 123). Assigned to you as NEW status."

User: "Create a quotation for Sarah, R5000, painting services"
YOU: Use createQuotation tool → "✓ Created quotation QUO-00045 for R5000"

User: "Show me all pending invoices"
YOU: Use getInvoices tool with status filter → Show results

REMINDERS:
- If user asks for reminders: "I don't have a reminder system, but I can create a quotation/project with follow-up notes"
- Don't refuse before trying - TRY the tool first
- If you get a permission error, explain what permission is needed`;

      console.log('[AI Agent] Calling generateText API...');
      
      // Generate response with tool calling
      let result;
      try {
        console.log('[AI Agent] About to call generateText');
        result = await generateText({
          model,
          system: systemPrompt,
          messages,
          tools: toolsWithAuth,
          maxSteps: 5, // Allow multi-step reasoning
        });
        console.log('[AI Agent] generateText returned successfully');
      } catch (generateTextError) {
        console.error('[AI Agent] @@@ generateText THREW ERROR @@@');
        console.error('[AI Agent] Error type:', typeof generateTextError);
        console.error('[AI Agent] Is Error instance:', generateTextError instanceof Error);
        if (generateTextError instanceof Error) {
          console.error('[AI Agent] Error.name:', generateTextError.name);
          console.error('[AI Agent] Error.message:', generateTextError.message);
          console.error('[AI Agent] Error.stack (first 800 chars):', generateTextError.stack?.substring(0, 800));
        } else {
          console.error('[AI Agent] Error value (stringified):', JSON.stringify(generateTextError));
        }
        throw generateTextError; // Re-throw to be caught by outer catch block
      }

      console.log('[AI Agent] API call successful');
      console.log('[AI Agent] Response text length:', result.text.length);
      console.log('[AI Agent] Steps taken:', result.steps?.length || 0);
      console.log('[AI Agent] Tool calls made:', result.steps?.length ? result.steps.length - 1 : 0);

      return {
        text: result.text,
        toolCalls: result.steps?.length ? result.steps.length - 1 : 0, // Number of tool calls made
      };
    } catch (error) {
      console.log('[AI Agent] CAUGHT ERROR - typeof:', typeof error);
      // Enhanced error logging
      console.error('==========================================');
      console.error('[AI Agent] ERROR OCCURRED');
      console.error('==========================================');
      
      // Log error type and message
      if (error instanceof Error) {
        console.error('[AI Agent] Error name:', error.name);
        console.error('[AI Agent] Error message:', error.message);
        console.error('[AI Agent] Error stack (first 500 chars):', error.stack?.substring(0, 500));
      } else {
        console.error('[AI Agent] Unknown error type:', typeof error);
        console.error('[AI Agent] Error value:', JSON.stringify(error));
      }
      
      // Try to extract more details from the error
      if (error && typeof error === 'object') {
        const errorObj = error as any;
        
        if (errorObj.status || errorObj.statusCode) {
          console.error('[AI Agent] HTTP Status:', errorObj.status || errorObj.statusCode);
        }
        
        if (errorObj.response) {
          console.error('[AI Agent] Response data (first 500 chars):', JSON.stringify(errorObj.response, null, 2).substring(0, 500));
        }
        
        if (errorObj.code) {
          console.error('[AI Agent] Error code:', errorObj.code);
        }
        
        if (errorObj.cause) {
          console.error('[AI Agent] Error cause:', JSON.stringify(errorObj.cause));
        }
      }
      
      console.error('==========================================');
      
      // Determine if this is an authentication/API key issue
      let errorMessage = 'Failed to get response from AI service';
      
      if (error instanceof Error) {
        const errorStr = error.message.toLowerCase();
        
        // Check for permission/authorization errors
        if (errorStr.includes('forbidden') || errorStr.includes('administrator') || errorStr.includes('permission')) {
          errorMessage = 'Access denied: This operation requires administrative privileges. Please log in as a Junior Admin or Senior Admin to use creation features.';
          console.error('[AI Agent] DIAGNOSIS: Permission/authorization issue detected');
        } else if (errorStr.includes('api key') || errorStr.includes('unauthorized') || errorStr.includes('401') || errorStr.includes('authentication')) {
          errorMessage = 'AI service authentication failed. Please check the API key configuration.';
          console.error('[AI Agent] DIAGNOSIS: API key/authentication issue detected');
        } else if (errorStr.includes('rate limit') || errorStr.includes('429')) {
          errorMessage = 'AI service rate limit exceeded. Please try again later.';
          console.error('[AI Agent] DIAGNOSIS: Rate limit issue detected');
        } else if (errorStr.includes('quota') || errorStr.includes('insufficient')) {
          errorMessage = 'AI service quota exceeded. Please check your account.';
          console.error('[AI Agent] DIAGNOSIS: Quota issue detected');
        } else if (errorStr.includes('network') || errorStr.includes('econnrefused') || errorStr.includes('timeout') || errorStr.includes('enotfound')) {
          errorMessage = 'Network error connecting to AI service. Please check your internet connection.';
          console.error('[AI Agent] DIAGNOSIS: Network issue detected');
        } else if (errorStr.includes('model') || errorStr.includes('not found')) {
          errorMessage = 'AI model not available. Please contact support.';
          console.error('[AI Agent] DIAGNOSIS: Model availability issue detected');
        }
      }
      
      throw new Error(errorMessage);
    }
  });
