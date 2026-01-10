import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createConversation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      participantIds: z.array(z.number()).min(1),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Include the current user in participants
      const allParticipantIds = Array.from(
        new Set([parsed.userId, ...input.participantIds])
      );

      // Verify all participants exist
      const users = await db.user.findMany({
        where: {
          id: {
            in: allParticipantIds,
          },
        },
      });

      if (users.length !== allParticipantIds.length) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "One or more participant users not found",
        });
      }

      // Check if a conversation already exists with exactly these participants
      const existingConversations = await db.conversation.findMany({
        where: {
          participants: {
            every: {
              id: {
                in: allParticipantIds,
              },
            },
          },
        },
        include: {
          participants: true,
        },
      });

      const exactMatch = existingConversations.find(
        (conv) =>
          conv.participants.length === allParticipantIds.length &&
          conv.participants.every((p) => allParticipantIds.includes(p.id))
      );

      if (exactMatch) {
        return {
          id: exactMatch.id,
          createdAt: exactMatch.createdAt,
          updatedAt: exactMatch.updatedAt,
          participants: exactMatch.participants.map((p) => ({
            id: p.id,
            firstName: p.firstName,
            lastName: p.lastName,
            email: p.email,
            role: p.role,
          })),
        };
      }

      // Create new conversation
      const conversation = await db.conversation.create({
        data: {
          participants: {
            connect: allParticipantIds.map((id) => ({ id })),
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
        },
      });

      return conversation;
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
