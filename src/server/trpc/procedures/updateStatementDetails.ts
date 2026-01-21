import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";

export const updateStatementDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      statementId: z.number(),
      statement_number: z.string().min(1).optional(),
      client_name: z.string().min(1).optional(),
      customerPhone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user
    const user = await authenticateUser(input.token);

    // Get current statement and perform authorization
    const currentStatement = await db.statement.findUnique({
      where: { id: input.statementId },
    });

    if (!currentStatement) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Statement not found",
      });
    }

    if (user.role === "PROPERTY_MANAGER") {
      // PM can only update statements issued to customers they manage
      const managedCustomer = await db.propertyManagerCustomer.findFirst({
        where: {
          propertyManagerId: user.id,
          email: currentStatement.client_email,
        },
        select: { id: true },
      });

      if (!managedCustomer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update statements for customers you manage",
        });
      }

      // PM can amend content fields, but not change the statement number
      if (input.statement_number !== undefined && input.statement_number !== currentStatement.statement_number) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Property managers cannot change statement numbers",
        });
      }
    } else {
      // Keep existing behavior: admins only
      requireAdmin(user);
    }

    // If statement_number is being updated, check for uniqueness
    if (input.statement_number !== undefined && input.statement_number !== currentStatement.statement_number) {
      const existingStatement = await db.statement.findUnique({
        where: { statement_number: input.statement_number },
      });

      if (existingStatement) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Statement number "${input.statement_number}" is already in use. Please choose a different number.`,
        });
      }
    }

    // Build update data object with only provided fields
    const updateData: any = {};

    if (input.statement_number !== undefined) updateData.statement_number = input.statement_number;
    if (input.client_name !== undefined) updateData.client_name = input.client_name;
    if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
    if (input.address !== undefined) updateData.address = input.address;
    if (input.notes !== undefined) updateData.notes = input.notes;

    // Update the statement
    const statement = await db.statement.update({
      where: { id: input.statementId },
      data: updateData,
    });

    return statement;
  });
