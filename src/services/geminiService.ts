import { Content } from '@google/genai';
import { client } from '~/trpc/react';
import { useAuthStore } from '~/stores/auth';

export async function sendMessageToGemini(
  historyForApi: Content[],
  userText: string,
  attachments: { mimeType: string; data: string }[]
): Promise<{ text: string }> {
  try {
    // Get auth token from Zustand store
    const authToken = useAuthStore.getState().token;

    if (!authToken) {
      throw new Error('You are not logged in. Please log in to use the AI Assistant.');
    }

    // Convert history to the format expected by the aiAgent procedure
    // Google Generative AI uses 'model' for assistant messages, but we need 'assistant'
    const messages = historyForApi.map((msg) => ({
      role: (msg.role === 'model' ? 'assistant' : 'user') as 'user' | 'assistant',
      content: msg.parts?.[0]?.text ?? '',
    }));

    console.log('[Gemini Service] Calling aiAgent with', messages.length, 'history messages');
    console.log('[Gemini Service] Message roles:', messages.map(m => m.role).join(', '));

    // Call the new Gemini-based aiAgent tRPC procedure
    const result = await client.aiAgent.mutate({
      authToken,
      messages,
      attachments,
    });

    console.log('[Gemini Service] Success - received response');
    
    if (!result.success) {
      throw new Error(result.message || 'Failed to get response from AI service');
    }

    return {
      text: result.message,
    };
  } catch (error) {
    console.error('[Gemini Service] Error occurred:', error);
    
    // Extract the actual error message from the tRPC error
    let errorMessage = 'Failed to get response from AI service. Please try again.';
    
    if (error instanceof Error) {
      // Check if this is a tRPC error with a specific message
      const errorMsg = error.message;
      
      // Pass through specific error messages from the server
      if (errorMsg.includes('authentication failed') || 
          errorMsg.includes('API key') ||
          errorMsg.includes('unauthorized')) {
        errorMessage = 'AI service authentication issue. Please contact your administrator to check the API key configuration.';
      } else if (errorMsg.includes('rate limit')) {
        errorMessage = 'AI service rate limit exceeded. Please wait a moment and try again.';
      } else if (errorMsg.includes('quota exceeded')) {
        errorMessage = 'AI service quota exceeded. Please contact your administrator.';
      } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (errorMsg.includes('model not available')) {
        errorMessage = 'AI model is currently unavailable. Please try again later or contact support.';
      } else if (errorMsg.includes('not logged in')) {
        errorMessage = 'You are not logged in. Please log in and try again.';
      } else if (errorMsg && errorMsg.length > 0 && !errorMsg.includes('Unknown error')) {
        // Use the server's error message if it's informative
        errorMessage = errorMsg;
      }
    }
    
    throw new Error(errorMessage);
  }
}

