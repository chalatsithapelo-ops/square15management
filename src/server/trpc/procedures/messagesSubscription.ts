import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const messagesSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
      conversationId: z.number(),
    })
  )
  .subscription(async function* ({ input }) {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Verify user is a participant in this conversation
      const conversation = await db.conversation.findFirst({
        where: {
          id: input.conversationId,
          participants: {
            some: {
              id: parsed.userId,
            },
          },
        },
      });

      if (!conversation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Conversation not found or access denied",
        });
      }

      let lastMessageId = 0;

      // Get the latest message ID to start from
      const latestMessage = await db.message.findFirst({
        where: { conversationId: input.conversationId },
        orderBy: { id: "desc" },
      });

      if (latestMessage) {
        lastMessageId = latestMessage.id;
      }

      // NOTE: This uses polling which is not ideal for production at scale.
      // Future improvement: Implement a proper push mechanism using WebSockets,
      // database triggers with LISTEN/NOTIFY (PostgreSQL), or a message queue.
      while (true) {
        // Poll for new messages
        const newMessages = await db.message.findMany({
          where: {
            conversationId: input.conversationId,
            id: {
              gt: lastMessageId,
            },
          },
          include: {
            sender: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                role: true,
              },
            },
          },
          orderBy: {
            id: "asc",
          },
        });

        for (const message of newMessages) {
          yield message;
          lastMessageId = message.id;
        }

        // Wait 2 seconds before polling again (reduced from 1s to decrease server load)
        await new Promise((resolve) => setTimeout(resolve, 2000));
      }
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
