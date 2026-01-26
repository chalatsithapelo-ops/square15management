import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { baseProcedure } from '~/server/trpc/main';
import { runAIAgent } from '~/server/services/aiAgentService';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';
import { requireSubscription } from '~/server/utils/subscription';

const aiAgentInputSchema = z.object({
  authToken: z.string().describe('Authentication token'),
  conversationId: z.number().optional().describe('Conversation ID to store messages (if not provided, will create one)'),
  messages: z.array(
    z.object({
      role: z.enum(['user', 'assistant']).describe('Message role'),
      content: z.string().describe('Message content'),
    })
  ).describe('Chat message history'),
  attachments: z.array(
    z.object({
      mimeType: z.string().describe('File MIME type'),
      data: z.string().describe('Base64 encoded file data'),
    })
  ).optional().default([]).describe('File attachments'),
  voiceInput: z.boolean().optional().default(false).describe('Whether this was a voice command'),
  voiceFormat: z.enum(['WAV', 'MP3', 'OGG']).optional().describe('Voice file format if applicable'),
});

export const aiAgent = baseProcedure
  .input(aiAgentInputSchema)
  .mutation(async ({ input }: { input: z.infer<typeof aiAgentInputSchema> }) => {
    try {
      console.log('[aiAgent.ts] Procedure called');
      console.log('[aiAgent.ts] Conversation ID:', input.conversationId);
      console.log('[aiAgent.ts] Messages count:', input.messages.length);
      console.log('[aiAgent.ts] Attachments count:', input.attachments?.length || 0);
      console.log('[aiAgent.ts] Voice input:', input.voiceInput);
      
      // Authenticate user to get userId for message saving
      const user = await authenticateUser(input.authToken);

      // Enforce subscription access for contractor/property-manager portals.
      // Admins/system accounts are allowed regardless.
      if (user.role === 'CONTRACTOR' || user.role === 'PROPERTY_MANAGER') {
        try {
          await requireSubscription(user.id, 'AIAgent');
        } catch (err: any) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: err?.message || 'AI Agent requires an active subscription that includes AI Agent access.',
          });
        }
      }
      
      if (input.voiceInput) {
        console.log('[aiAgent.ts] Voice format:', input.voiceFormat);
      }

      let conversationId = input.conversationId;

      // If no conversation ID provided, create or get the AI Agent conversation for this user
      if (!conversationId) {
        console.log('[aiAgent.ts] No conversation ID provided, creating/getting AI Agent conversation');
        
        let aiAgentUser = await db.user.findFirst({
          where: {
            email: "ai-agent@system.local",
          },
        });

        if (!aiAgentUser) {
          aiAgentUser = await db.user.create({
            data: {
              email: "ai-agent@system.local",
              password: "system",
              firstName: "AI",
              lastName: "Agent",
              role: "SYSTEM",
            },
          });
        }

        // Check if conversation exists for this specific user + AI Agent
        // Use AND with 'some' to ensure both participants are present
        let conversation = await db.conversation.findFirst({
          where: {
            AND: [
              {
                participants: {
                  some: {
                    id: user.id,
                  },
                },
              },
              {
                participants: {
                  some: {
                    id: aiAgentUser.id,
                  },
                },
              },
            ],
          },
          include: {
            participants: true,
          },
        });

        // Verify it's a 1-on-1 conversation (not a group chat)
        if (conversation && conversation.participants.length !== 2) {
          conversation = null; // Force creation of new conversation
        }

        if (!conversation) {
          // Create new conversation
          const created = await db.conversation.create({
            data: {
              participants: {
                connect: [{ id: user.id }, { id: aiAgentUser.id }],
              },
            },
          });

          conversation = await db.conversation.findUnique({
            where: {
              id: created.id,
            },
            include: {
              participants: true,
            },
          });
        }

        if (!conversation) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: 'Failed to initialize AI Agent conversation.',
          });
        }

        conversationId = conversation.id;
        console.log('[aiAgent.ts] Using conversation ID:', conversationId);
      }

      // Save user's last message to conversation before calling AI
      const lastMessage = input.messages[input.messages.length - 1];
      if (lastMessage && lastMessage.role === 'user') {
        await db.message.create({
          data: {
            content: lastMessage.content,
            senderId: user.id,
            conversationId: conversationId,
            attachments: input.attachments?.map((a: any) => a.mimeType) || [],
          },
        });
        console.log('[aiAgent.ts] User message saved to conversation');
      }

      const response = await runAIAgent({
        messages: input.messages,
        authToken: input.authToken,
        attachments: input.attachments,
        voiceInput: input.voiceInput,
        voiceFormat: input.voiceFormat,
      });

      console.log('[aiAgent.ts] Response received, length:', response.length);

      // Get AI Agent user
      let aiAgentUser = await db.user.findFirst({
        where: {
          email: "ai-agent@system.local",
        },
      });

      if (!aiAgentUser) {
        aiAgentUser = await db.user.create({
          data: {
            email: "ai-agent@system.local",
            password: "system",
            firstName: "AI",
            lastName: "Agent",
            role: "SYSTEM",
          },
        });
      }

      // Save AI's response to conversation
      await db.message.create({
        data: {
          content: response,
          senderId: aiAgentUser.id,
          conversationId: conversationId,
          readBy: [user.id], // Mark as read by the user immediately
        },
      });
      console.log('[aiAgent.ts] AI response saved to conversation');

      return {
        success: true,
        message: response,
        conversationId: conversationId,
      };
    } catch (error) {
      console.error('[aiAgent.ts] Error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      return {
        success: false,
        message: `Error: ${errorMessage}`,
      };
    }
  });
