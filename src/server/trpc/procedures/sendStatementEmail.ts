import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { sendStatementNotificationEmail } from "~/server/utils/email";
import { notifyCustomerStatement } from "~/server/utils/notifications";

export const sendStatementEmail = baseProcedure
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

    // Authorization: admin OR PM who manages the customer
    if (!isAdmin(user)) {
      if (user.role === "PROPERTY_MANAGER") {
        const managedCustomer = await db.propertyManagerCustomer.findFirst({
          where: {
            propertyManagerId: user.id,
            email: statement.client_email,
          },
          select: { id: true },
        });

        if (!managedCustomer) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only send statements for customers you manage",
          });
        }
      } else {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not allowed to send this statement",
        });
      }
    }

    const periodLabel = `${new Date(statement.period_start).toLocaleDateString("en-ZA")} - ${new Date(statement.period_end).toLocaleDateString("en-ZA")}`;

    await sendStatementNotificationEmail({
      customerEmail: statement.client_email,
      customerName: statement.client_name || statement.client_email,
      statementNumber: statement.statement_number,
      statementPeriod: periodLabel,
      totalAmount: statement.total_amount_due ?? 0,
      userId: user.id,
    });

    // Best-effort in-app notification if the customer has a portal user
    try {
      const customerUser = await db.user.findUnique({
        where: { email: statement.client_email },
        select: { id: true },
      });

      if (customerUser) {
        await notifyCustomerStatement({
          customerId: customerUser.id,
          statementNumber: statement.statement_number,
          statementId: statement.id,
          totalDue: statement.total_amount_due ?? 0,
        });
      }
    } catch (err) {
      console.error("Failed to send statement in-app notification:", err);
    }

    const updated = await db.statement.update({
      where: { id: statement.id },
      data: {
        status: "sent",
        sent_date: new Date(),
      },
    });

    return { success: true, statement: updated };
  });
