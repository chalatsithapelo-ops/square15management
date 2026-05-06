import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const deleteStatement = baseProcedure
  .input(
    z.object({
      token: z.string(),
      statementId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "delete statements");

    const statement = await db.statement.findUnique({
      where: { id: input.statementId },
      select: { id: true, client_email: true },
    });

    if (!statement) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Statement not found",
      });
    }

    // Authorization: admin OR property manager who manages the customer.
    if (!isAdmin(user)) {
      if (user.role === "PROPERTY_MANAGER") {
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
            message: "You can only delete statements for customers you manage",
          });
        }
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You do not have permission to delete statements",
        });
      }
    }

    await db.statement.delete({
      where: { id: input.statementId },
    });

    return { success: true };
  });
