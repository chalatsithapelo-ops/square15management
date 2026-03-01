import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { assertNotRestrictedDemoAccount } from "~/server/utils/demoAccounts";

/**
 * Restore data by deleting all records created AFTER a chosen cutoff date.
 * This effectively "restores" the system to the state it was in at that point in time.
 *
 * Available periods:
 *  1_WEEK   - delete data from the last 1 week
 *  2_WEEKS  - delete data from the last 2 weeks
 *  1_MONTH  - delete data from the last 1 month
 *  2_MONTHS - delete data from the last 2 months
 *  3_MONTHS - delete data from the last 3 months
 *  6_MONTHS - delete data from the last 6 months
 *  1_YEAR   - delete data from the last 1 year
 *  ALL_TIME - delete ALL data
 */
export const restoreData = baseProcedure
  .input(
    z.object({
      token: z.string(),
      period: z.enum([
        "1_WEEK",
        "2_WEEKS",
        "1_MONTH",
        "2_MONTHS",
        "3_MONTHS",
        "6_MONTHS",
        "1_YEAR",
        "ALL_TIME",
      ]),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    assertNotRestrictedDemoAccount(user, "restore data");

    // Only main admin or contractor senior manager can restore data
    const canRestore =
      user.role === "SENIOR_ADMIN" || user.role === "CONTRACTOR_SENIOR_MANAGER";
    if (!canRestore) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only the main administrator or contractor manager can perform data restoration.",
      });
    }

    // Calculate cutoff date
    const now = new Date();
    let cutoffDate: Date;

    switch (input.period) {
      case "1_WEEK":
        cutoffDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "2_WEEKS":
        cutoffDate = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);
        break;
      case "1_MONTH":
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 1);
        break;
      case "2_MONTHS":
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 2);
        break;
      case "3_MONTHS":
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 3);
        break;
      case "6_MONTHS":
        cutoffDate = new Date(now);
        cutoffDate.setMonth(cutoffDate.getMonth() - 6);
        break;
      case "1_YEAR":
        cutoffDate = new Date(now);
        cutoffDate.setFullYear(cutoffDate.getFullYear() - 1);
        break;
      case "ALL_TIME":
        cutoffDate = new Date(0); // Unix epoch - deletes everything
        break;
      default:
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Invalid restoration period",
        });
    }

    const dateFilter = { createdAt: { gte: cutoffDate } };

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Delete in order that respects foreign key constraints
      // (child records first, then parent records)

      // 1. Delete expense slips (child of Order)
      const expenseSlips = await tx.expenseSlip.deleteMany({
        where: {
          order: { createdAt: { gte: cutoffDate } },
        },
      });

      // 2. Delete job activities (child of Order)
      const jobActivities = await tx.jobActivity.deleteMany({
        where: {
          order: { createdAt: { gte: cutoffDate } },
        },
      });

      // 3. Delete materials (child of Order)
      const materials = await tx.material.deleteMany({
        where: {
          order: { createdAt: { gte: cutoffDate } },
        },
      });

      // 4. Delete reviews (child of Order)
      const reviews = await tx.review.deleteMany({
        where: {
          order: { createdAt: { gte: cutoffDate } },
        },
      });

      // 5. Delete invoice line items (child of Invoice)
      const invoiceLineItems = await tx.invoiceLineItem.deleteMany({
        where: {
          invoice: { createdAt: { gte: cutoffDate } },
        },
      });

      // 6. Delete invoices
      const invoices = await tx.invoice.deleteMany({
        where: dateFilter,
      });

      // 7. Delete quotation line items (child of Quotation)
      const quotationLineItems = await tx.quotationLineItem.deleteMany({
        where: {
          quotation: { createdAt: { gte: cutoffDate } },
        },
      });

      // 8. Delete orders
      const orders = await tx.order.deleteMany({
        where: dateFilter,
      });

      // 9. Delete quotations
      const quotations = await tx.quotation.deleteMany({
        where: dateFilter,
      });

      // 10. Delete payment requests
      const paymentRequests = await tx.paymentRequest.deleteMany({
        where: dateFilter,
      });

      // 11. Delete payslips
      const payslips = await tx.payslip.deleteMany({
        where: dateFilter,
      });

      // 12. Delete assets
      const assets = await tx.asset.deleteMany({
        where: dateFilter,
      });

      // 13. Delete liabilities
      const liabilities = await tx.liability.deleteMany({
        where: dateFilter,
      });

      // 14. Delete operational expenses
      const operationalExpenses = await tx.operationalExpense.deleteMany({
        where: dateFilter,
      });

      // 15. Delete alternative revenues
      const alternativeRevenues = await tx.alternativeRevenue.deleteMany({
        where: dateFilter,
      });

      return {
        orders: orders.count,
        invoices: invoices.count,
        quotations: quotations.count,
        paymentRequests: paymentRequests.count,
        payslips: payslips.count,
        assets: assets.count,
        liabilities: liabilities.count,
        operationalExpenses: operationalExpenses.count,
        alternativeRevenues: alternativeRevenues.count,
        invoiceLineItems: invoiceLineItems.count,
        quotationLineItems: quotationLineItems.count,
        materials: materials.count,
        expenseSlips: expenseSlips.count,
        jobActivities: jobActivities.count,
        reviews: reviews.count,
      };
    });

    const totalDeleted = Object.values(result).reduce((a, b) => a + b, 0);

    return {
      success: true,
      message: `Data restoration complete. ${totalDeleted} records removed.`,
      cutoffDate: cutoffDate.toISOString(),
      period: input.period,
      details: result,
    };
  });
