import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateStatementInBackground } from "~/server/trpc/procedures/generateStatement";

/**
 * PM automation: generate draft statements (no email) for all managed customers.
 */
export const generateManagedCustomerStatements = baseProcedure
  .input(
    z.object({
      token: z.string(),
      period_start: z.string(),
      period_end: z.string(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can generate managed customer statements",
      });
    }

    const period_start = new Date(input.period_start);
    const period_end = new Date(input.period_end);

    const managedCustomers = await db.propertyManagerCustomer.findMany({
      where: { propertyManagerId: user.id },
      select: { email: true, name: true, phone: true, address: true },
    });

    const targets = managedCustomers
      .filter((c) => !!c.email)
      .map((c) => ({
        email: c.email as string,
        name: c.name || undefined,
        phone: c.phone || undefined,
        address: c.address || undefined,
      }));

    if (targets.length === 0) {
      return { success: true, created: 0, statementIds: [] as number[] };
    }

    // Compute next statement numbers sequentially to avoid collisions.
    const lastStatement = await db.statement.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });

    let nextId = (lastStatement?.id || 0) + 1;

    const createdStatements = await Promise.all(
      targets.map(async (t) => {
        const statement_number = `Statement #${nextId++}`;

        const stmt = await db.statement.create({
          data: {
            statement_number,
            client_email: t.email,
            client_name: t.name || "",
            customerPhone: t.phone || null,
            address: t.address || null,
            statement_date: new Date(),
            period_start,
            period_end,
            notes: input.notes || null,
            status: "generated",
            invoice_details: [],
            age_analysis: {
              current: 0,
              days_31_60: 0,
              days_61_90: 0,
              days_91_120: 0,
              over_120: 0,
            },
          },
          select: { id: true },
        });

        generateStatementInBackground(
          stmt.id,
          statement_number,
          t.email,
          period_start,
          period_end,
          t.name,
          t.phone,
          t.address,
          input.notes,
          false
        ).catch(async (error) => {
          console.error("Error generating managed customer statement:", error);
          try {
            await db.statement.update({
              where: { id: stmt.id },
              data: {
                status: "overdue",
                errorMessage: error instanceof Error ? error.message : String(error),
              },
            });
          } catch {
            // ignore
          }
        });

        return stmt.id;
      })
    );

    return {
      success: true,
      created: createdStatements.length,
      statementIds: createdStatements,
    };
  });
