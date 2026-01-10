import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

/**
 * Get or create AI Agent conversation for the current user
 * This ensures each user has their own isolated conversation with the AI Agent
 */
export const getOrCreateAIAgentConversation = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Get or create AI Agent system user (if it doesn't exist)
      let aiAgentUser = await db.user.findFirst({
        where: {
          email: "ai-agent@system.local",
        },
      });

      if (!aiAgentUser) {
        // Create AI Agent system user if it doesn't exist
        aiAgentUser = await db.user.create({
          data: {
            email: "ai-agent@system.local",
            password: "system", // Not used for AI
            firstName: "AI",
            lastName: "Agent",
            role: "SYSTEM",
          },
        });
      }

      // Check if AI Agent conversation already exists for this user
      // We need to find a conversation with EXACTLY two participants: current user + AI Agent
      const existingConversation = await db.conversation.findFirst({
        where: {
          AND: [
            {
              participants: {
                some: {
                  id: parsed.userId,
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
          participants: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      // Verify this conversation has exactly 2 participants (current user + AI Agent)
      // This prevents returning a group conversation that happens to include both
      if (existingConversation && existingConversation.participants.length === 2) {
        return {
          id: existingConversation.id,
          createdAt: existingConversation.createdAt,
          updatedAt: existingConversation.updatedAt,
          participants: existingConversation.participants,
          messages: existingConversation.messages.reverse(), // Return in chronological order
        };
      }

      // Create new AI Agent conversation for this user
      const conversation = await db.conversation.create({
        data: {
          participants: {
            connect: [{ id: parsed.userId }, { id: aiAgentUser.id }],
          },
        },
        include: {
          participants: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          messages: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
            },
          },
        },
      });

      return {
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: conversation.participants,
        messages: [],
      };
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
