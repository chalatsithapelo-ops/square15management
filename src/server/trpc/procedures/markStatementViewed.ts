import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";

export const markStatementViewed = baseProcedure
  .input(
    z.object({
      token: z.string(),
      statementId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const statement = await db.statement.findUnique({
      where: { id: input.statementId },
    });

    if (!statement) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Statement not found",
      });
    }

    // Only the recipient (client_email) or admin can mark as viewed.
    if (!isAdmin(user) && statement.client_email !== user.email) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only mark your own statements as viewed",
      });
    }

    const updated = await db.statement.update({
      where: { id: statement.id },
      data: {
        status: "viewed",
      },
    });

    return { success: true, statement: updated };
  });
