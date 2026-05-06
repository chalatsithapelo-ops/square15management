import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { generateStatementInBackground, createStatementWithUniqueNumber } from "~/server/trpc/procedures/generateStatement";

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

    if (Number.isNaN(period_start.getTime()) || Number.isNaN(period_end.getTime())) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Invalid period dates",
      });
    }
    if (period_end < period_start) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Period end must be on or after period start",
      });
    }

    const managedCustomers = await db.propertyManagerCustomer.findMany({
      where: { propertyManagerId: user.id },
      select: { email: true, firstName: true, lastName: true, phone: true, address: true },
    });

    const targets = managedCustomers
      .filter((c) => !!c.email)
      .map((c) => ({
        email: c.email as string,
        name: `${c.firstName ?? ""} ${c.lastName ?? ""}`.trim() || undefined,
        phone: c.phone || undefined,
        address: c.address || undefined,
      }));

    if (targets.length === 0) {
      return { success: true, created: 0, statementIds: [] as number[] };
    }

    const createdStatements: number[] = [];
    const skipped: Array<{ email: string; reason: string }> = [];

    // Sequential to keep the per-statement number allocation race-free.
    for (const t of targets) {
      // Duplicate-period guard.
      const existing = await db.statement.findFirst({
        where: {
          client_email: t.email,
          period_start,
          period_end,
          status: { in: ["generated", "sent", "viewed", "paid", "overdue"] },
        },
        select: { id: true, statement_number: true },
      });
      if (existing) {
        skipped.push({
          email: t.email,
          reason: `Already exists (${existing.statement_number})`,
        });
        continue;
      }

      let stmt: { id: number; statement_number: string };
      try {
        stmt = await createStatementWithUniqueNumber({
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
            days_1_30: 0,
            days_31_60: 0,
            days_61_90: 0,
            days_91_120: 0,
            over_120: 0,
          },
        });
      } catch (err) {
        skipped.push({
          email: t.email,
          reason: err instanceof Error ? err.message : "Unknown error",
        });
        continue;
      }

      generateStatementInBackground(
        stmt.id,
        stmt.statement_number,
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

      createdStatements.push(stmt.id);
    }

    return {
      success: true,
      created: createdStatements.length,
      statementIds: createdStatements,
      skipped,
    };
  });
