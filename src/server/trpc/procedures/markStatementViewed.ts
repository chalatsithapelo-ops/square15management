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

    // Authorization: admin, recipient, or PM that manages the recipient.
    if (!isAdmin(user)) {
      if (statement.client_email === user.email) {
        // recipient – allowed
      } else if (user.role === "PROPERTY_MANAGER") {
        const managed = await db.propertyManagerCustomer.findFirst({
          where: {
            propertyManagerId: user.id,
            email: statement.client_email,
          },
          select: { id: true },
        });
        if (!managed) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only mark statements you manage as viewed",
          });
        }
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only mark your own statements as viewed",
        });
      }
    }

    // Don't downgrade a paid statement back to viewed; only transition from
    // sent/generated/overdue.
    if (statement.status === "paid") {
      return { success: true, statement };
    }

    const updated = await db.statement.update({
      where: { id: statement.id },
      data: {
        status: "viewed",
      },
    });

    return { success: true, statement: updated };
  });
