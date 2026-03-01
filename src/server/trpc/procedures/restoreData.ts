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
      // Optional: choose which data categories to delete
      // If not provided, ALL categories are deleted (backwards compatible)
      categories: z.array(z.enum([
        "ORDERS",         // Orders + child records (expense slips, job activities, materials, reviews)
        "INVOICES",       // Invoices + line items
        "QUOTATIONS",     // Quotations + line items
        "PAYMENT_REQUESTS",
        "PAYSLIPS",
        "ASSETS",
        "LIABILITIES",
        "OPERATIONAL_EXPENSES",
        "ALTERNATIVE_REVENUES",
      ])).optional(),
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

    // Determine which categories to delete
    // If categories not provided, delete ALL (backwards compatible)
    const allCategories = [
      "ORDERS", "INVOICES", "QUOTATIONS", "PAYMENT_REQUESTS",
      "PAYSLIPS", "ASSETS", "LIABILITIES", "OPERATIONAL_EXPENSES", "ALTERNATIVE_REVENUES",
    ];
    const selectedCategories = input.categories && input.categories.length > 0
      ? input.categories
      : allCategories;
    const shouldDelete = (cat: string) => selectedCategories.includes(cat as any);

    // Use a transaction to ensure atomicity
    const result = await db.$transaction(async (tx) => {
      // Delete in order that respects foreign key constraints
      // (child records first, then parent records)

      let expenseSlipsCount = 0;
      let jobActivitiesCount = 0;
      let materialsCount = 0;
      let reviewsCount = 0;
      let ordersCount = 0;
      let invoiceLineItemsCount = 0;
      let invoicesCount = 0;
      let quotationLineItemsCount = 0;
      let quotationsCount = 0;
      let paymentRequestsCount = 0;
      let payslipsCount = 0;
      let assetsCount = 0;
      let liabilitiesCount = 0;
      let operationalExpensesCount = 0;
      let alternativeRevenuesCount = 0;

      // Orders + child records
      if (shouldDelete("ORDERS")) {
        const expenseSlips = await tx.expenseSlip.deleteMany({
          where: { order: { createdAt: { gte: cutoffDate } } },
        });
        expenseSlipsCount = expenseSlips.count;

        const jobActivities = await tx.jobActivity.deleteMany({
          where: { order: { createdAt: { gte: cutoffDate } } },
        });
        jobActivitiesCount = jobActivities.count;

        const materials = await tx.material.deleteMany({
          where: { order: { createdAt: { gte: cutoffDate } } },
        });
        materialsCount = materials.count;

        const reviews = await tx.review.deleteMany({
          where: { order: { createdAt: { gte: cutoffDate } } },
        });
        reviewsCount = reviews.count;

        const orders = await tx.order.deleteMany({ where: dateFilter });
        ordersCount = orders.count;
      }

      // Invoices + line items
      if (shouldDelete("INVOICES")) {
        const invoiceLineItems = await tx.invoiceLineItem.deleteMany({
          where: { invoice: { createdAt: { gte: cutoffDate } } },
        });
        invoiceLineItemsCount = invoiceLineItems.count;

        const invoices = await tx.invoice.deleteMany({ where: dateFilter });
        invoicesCount = invoices.count;
      }

      // Quotations + line items
      if (shouldDelete("QUOTATIONS")) {
        const quotationLineItems = await tx.quotationLineItem.deleteMany({
          where: { quotation: { createdAt: { gte: cutoffDate } } },
        });
        quotationLineItemsCount = quotationLineItems.count;

        const quotations = await tx.quotation.deleteMany({ where: dateFilter });
        quotationsCount = quotations.count;
      }

      // Payment requests
      if (shouldDelete("PAYMENT_REQUESTS")) {
        const paymentRequests = await tx.paymentRequest.deleteMany({ where: dateFilter });
        paymentRequestsCount = paymentRequests.count;
      }

      // Payslips
      if (shouldDelete("PAYSLIPS")) {
        const payslips = await tx.payslip.deleteMany({ where: dateFilter });
        payslipsCount = payslips.count;
      }

      // Assets
      if (shouldDelete("ASSETS")) {
        const assets = await tx.asset.deleteMany({ where: dateFilter });
        assetsCount = assets.count;
      }

      // Liabilities
      if (shouldDelete("LIABILITIES")) {
        const liabilities = await tx.liability.deleteMany({ where: dateFilter });
        liabilitiesCount = liabilities.count;
      }

      // Operational expenses
      if (shouldDelete("OPERATIONAL_EXPENSES")) {
        const operationalExpenses = await tx.operationalExpense.deleteMany({ where: dateFilter });
        operationalExpensesCount = operationalExpenses.count;
      }

      // Alternative revenues
      if (shouldDelete("ALTERNATIVE_REVENUES")) {
        const alternativeRevenues = await tx.alternativeRevenue.deleteMany({ where: dateFilter });
        alternativeRevenuesCount = alternativeRevenues.count;
      }

      return {
        orders: ordersCount,
        invoices: invoicesCount,
        quotations: quotationsCount,
        paymentRequests: paymentRequestsCount,
        payslips: payslipsCount,
        assets: assetsCount,
        liabilities: liabilitiesCount,
        operationalExpenses: operationalExpensesCount,
        alternativeRevenues: alternativeRevenuesCount,
        invoiceLineItems: invoiceLineItemsCount,
        quotationLineItems: quotationLineItemsCount,
        materials: materialsCount,
        expenseSlips: expenseSlipsCount,
        jobActivities: jobActivitiesCount,
        reviews: reviewsCount,
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
