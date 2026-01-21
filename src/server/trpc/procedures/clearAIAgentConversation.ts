import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { db } from "~/server/db";
import { authenticateUser } from "~/server/utils/auth";

const clearAIAgentConversationInputSchema = z.object({
  authToken: z.string(),
  conversationId: z.number().optional(),
});

/**
 * Clears (deletes) all messages in the user's 1:1 AI Agent conversation.
 * Keeps the conversation record + participants intact.
 */
export const clearAIAgentConversation = baseProcedure
  .input(clearAIAgentConversationInputSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.authToken);

    // Ensure AI Agent system user exists
    let aiAgentUser = await db.user.findFirst({
      where: { email: "ai-agent@system.local" },
      select: { id: true },
    });

    if (!aiAgentUser) {
      const created = await db.user.create({
        data: {
          email: "ai-agent@system.local",
          password: "system",
          firstName: "AI",
          lastName: "Agent",
          role: "SYSTEM",
        },
        select: { id: true },
      });
      aiAgentUser = created;
    }

    const resolveConversation = async () => {
      if (input.conversationId) {
        const conversation = await db.conversation.findUnique({
          where: { id: input.conversationId },
          include: { participants: { select: { id: true } } },
        });

        if (!conversation) return null;

        const participantIds = conversation.participants.map((p) => p.id);
        const isParticipant = participantIds.includes(user.id);
        const hasAiAgent = participantIds.includes(aiAgentUser.id);

        if (!isParticipant || !hasAiAgent || participantIds.length !== 2) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only clear your 1:1 AI Agent conversation.",
          });
        }

        return conversation;
      }

      const conversation = await db.conversation.findFirst({
        where: {
          AND: [
            { participants: { some: { id: user.id } } },
            { participants: { some: { id: aiAgentUser.id } } },
          ],
        },
        include: { participants: { select: { id: true } } },
      });

      if (conversation && conversation.participants.length === 2) return conversation;

      return null;
    };

    let conversation = await resolveConversation();

    if (!conversation) {
      conversation = await db.conversation.create({
        data: {
          participants: { connect: [{ id: user.id }, { id: aiAgentUser.id }] },
        },
        include: { participants: { select: { id: true } } },
      });
    }

    const deleteResult = await db.message.deleteMany({
      where: { conversationId: conversation.id },
    });

    return {
      success: true,
      conversationId: conversation.id,
      deletedCount: deleteResult.count,
    };
  });
