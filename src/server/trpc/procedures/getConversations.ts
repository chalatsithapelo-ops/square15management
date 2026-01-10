import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getConversations = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const conversations = await db.conversation.findMany({
        where: {
          participants: {
            some: {
              id: parsed.userId,
            },
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
            take: 1,
            include: {
              sender: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                },
              },
            },
          },
        },
        orderBy: {
          updatedAt: "desc",
        },
      });

      // Get unread counts for all conversations in a single query
      const unreadCounts = await Promise.all(
        conversations.map(async (conversation) => {
          const count = await db.message.count({
            where: {
              conversationId: conversation.id,
              senderId: {
                not: parsed.userId,
              },
              NOT: {
                readBy: {
                  has: parsed.userId,
                },
              },
            },
          });
          return { conversationId: conversation.id, count };
        })
      );

      const unreadCountMap = new Map(
        unreadCounts.map((uc) => [uc.conversationId, uc.count])
      );

      return conversations.map((conversation) => ({
        id: conversation.id,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
        participants: conversation.participants,
        lastMessage: conversation.messages[0] || null,
        unreadCount: unreadCountMap.get(conversation.id) || 0,
      }));
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
