import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const sendMessage = baseProcedure
  .input(
    z.object({
      token: z.string(),
      conversationId: z.number(),
      content: z.string().min(1),
      attachments: z.array(z.string()).optional().default([]),
    })
  )
  .mutation(async ({ input }) => {
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

      // Create the message
      const message = await db.message.create({
        data: {
          content: input.content,
          attachments: input.attachments,
          senderId: parsed.userId,
          conversationId: input.conversationId,
          readBy: [parsed.userId], // Sender has read their own message
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
      });

      // Update conversation timestamp
      await db.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      });

      return message;
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
