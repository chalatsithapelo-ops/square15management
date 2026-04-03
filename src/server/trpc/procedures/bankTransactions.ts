import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import {
  parseCSVStatement,
  storeBatchTransactions,
  categorizeTransaction,
  recategorizeTransaction,
  confirmCategorization,
  reconcileBankAccount,
} from "~/server/services/bankFeed";

export const getBankTransactions = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      transactionType: z.enum(["DEBIT", "CREDIT"]).optional(),
      reconciliationStatus: z.enum(["UNMATCHED", "MATCHED", "PARTIALLY_MATCHED", "DISPUTED", "IGNORED"]).optional(),
      isConfirmed: z.boolean().optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = {};

    // Only show transactions from user's bank accounts
    if (input.bankAccountId) {
      where.bankAccountId = input.bankAccountId;
    } else {
      const userAccounts = await db.bankAccount.findMany({
        where: { createdById: user.id },
        select: { id: true },
      });
      where.bankAccountId = { in: userAccounts.map((a) => a.id) };
    }

    if (input.startDate) {
      where.transactionDate = { ...where.transactionDate, gte: new Date(input.startDate) };
    }
    if (input.endDate) {
      where.transactionDate = { ...where.transactionDate, lte: new Date(input.endDate) };
    }
    if (input.transactionType) {
      where.transactionType = input.transactionType;
    }
    if (input.reconciliationStatus) {
      where.reconciliationStatus = input.reconciliationStatus;
    }

    // Filter by categorization confirmation status
    if (input.isConfirmed !== undefined) {
      where.categorization = input.isConfirmed
        ? { isConfirmed: true }
        : { OR: [{ isConfirmed: false }, { isNot: null }] };
    }

    const [transactions, total] = await Promise.all([
      db.bankTransaction.findMany({
        where,
        include: {
          bankAccount: {
            select: { id: true, accountName: true, bankName: true, accountNumber: true },
          },
          categorization: {
            include: {
              confirmedBy: { select: { id: true, firstName: true, lastName: true } },
            },
          },
        },
        orderBy: { transactionDate: "desc" },
        take: input.limit,
        skip: input.offset,
      }),
      db.bankTransaction.count({ where }),
    ]);

    return { transactions, total };
  });

export const importCSVStatement = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number(),
      csvContent: z.string(),
      bankHint: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Verify ownership
    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, createdById: user.id },
    });
    if (!account) throw new Error("Bank account not found");

    // Create import batch
    const batch = await db.bankImportBatch.create({
      data: {
        bankAccountId: input.bankAccountId,
        source: "CSV",
        importedById: user.id,
        status: "PROCESSING",
      },
    });

    try {
      // Parse CSV
      const result = parseCSVStatement(input.csvContent, input.bankHint || account.bankName);

      if (result.transactions.length === 0) {
        await db.bankImportBatch.update({
          where: { id: batch.id },
          data: { status: "FAILED", errorMessage: "No transactions found in CSV" },
        });
        throw new Error("No transactions found in the CSV file. Check the format.");
      }

      // Store transactions
      const storeResult = await storeBatchTransactions(
        input.bankAccountId,
        result.transactions.map((t) => ({
          date: t.date,
          amount: t.amount,
          transactionType: t.transactionType,
          description: t.description,
          balance: t.balance,
          reference: t.reference,
        })),
        batch.id,
        "CSV"
      );

      // Update batch
      await db.bankImportBatch.update({
        where: { id: batch.id },
        data: {
          status: "COMPLETED",
          transactionCount: result.transactions.length,
          newCount: storeResult.newCount,
          duplicateCount: storeResult.duplicateCount,
          periodStart: result.periodStart,
          periodEnd: result.periodEnd,
          fileName: `import_${new Date().toISOString().split("T")[0]}.csv`,
        },
      });

      // Categorize new transactions
      const newTransactions = await db.bankTransaction.findMany({
        where: { importBatchId: batch.id },
      });

      for (const tx of newTransactions) {
        await categorizeTransaction(
          tx.id,
          tx.description,
          tx.amount,
          tx.transactionType as "DEBIT" | "CREDIT"
        );
      }

      return {
        batchId: batch.id,
        total: result.transactions.length,
        new: storeResult.newCount,
        duplicates: storeResult.duplicateCount,
        errors: storeResult.errors,
        periodStart: result.periodStart,
        periodEnd: result.periodEnd,
      };
    } catch (err: any) {
      await db.bankImportBatch.update({
        where: { id: batch.id },
        data: { status: "FAILED", errorMessage: err.message },
      });
      throw err;
    }
  });

export const recategorizeBankTransaction = baseProcedure
  .input(
    z.object({
      token: z.string(),
      transactionId: z.number(),
      category: z.string(),
      notes: z.string().optional(),
      createRule: z.boolean().default(true),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    await recategorizeTransaction(input.transactionId, input.category, user.id, input.notes, input.createRule);
    return { success: true };
  });

export const confirmBankTransaction = baseProcedure
  .input(
    z.object({
      token: z.string(),
      transactionId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    await confirmCategorization(input.transactionId, user.id);
    return { success: true };
  });

export const reconcileBankAccountProcedure = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);
    const result = await reconcileBankAccount(input.bankAccountId);
    return result;
  });

export const getBankFeedStats = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userAccounts = await db.bankAccount.findMany({
      where: { createdById: user.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        totalAccounts: 0,
        totalTransactions: 0,
        unmatchedCount: 0,
        pendingReviewCount: 0,
        matchedCount: 0,
        totalDebits: 0,
        totalCredits: 0,
        recentTransactions: [],
      };
    }

    const [
      totalTransactions,
      unmatchedCount,
      matchedCount,
      pendingReview,
      debitSum,
      creditSum,
    ] = await Promise.all([
      db.bankTransaction.count({ where: { bankAccountId: { in: accountIds } } }),
      db.bankTransaction.count({
        where: { bankAccountId: { in: accountIds }, reconciliationStatus: "UNMATCHED" },
      }),
      db.bankTransaction.count({
        where: { bankAccountId: { in: accountIds }, reconciliationStatus: "MATCHED" },
      }),
      db.bankTransaction.count({
        where: {
          bankAccountId: { in: accountIds },
          categorization: { isConfirmed: false },
        },
      }),
      db.bankTransaction.aggregate({
        where: { bankAccountId: { in: accountIds }, transactionType: "DEBIT" },
        _sum: { amount: true },
      }),
      db.bankTransaction.aggregate({
        where: { bankAccountId: { in: accountIds }, transactionType: "CREDIT" },
        _sum: { amount: true },
      }),
    ]);

    const recentTransactions = await db.bankTransaction.findMany({
      where: { bankAccountId: { in: accountIds } },
      include: {
        bankAccount: { select: { accountName: true, bankName: true } },
        categorization: true,
      },
      orderBy: { transactionDate: "desc" },
      take: 10,
    });

    return {
      totalAccounts: accountIds.length,
      totalTransactions,
      unmatchedCount,
      pendingReviewCount: pendingReview,
      matchedCount,
      totalDebits: debitSum._sum.amount || 0,
      totalCredits: creditSum._sum.amount || 0,
      recentTransactions,
    };
  });

export const getImportBatches = baseProcedure
  .input(z.object({ token: z.string(), bankAccountId: z.number().optional() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = { importedById: user.id };
    if (input.bankAccountId) where.bankAccountId = input.bankAccountId;

    return db.bankImportBatch.findMany({
      where,
      include: {
        bankAccount: { select: { accountName: true, bankName: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 20,
    });
  });

export const updateTransactionReconciliation = baseProcedure
  .input(
    z.object({
      token: z.string(),
      transactionId: z.number(),
      status: z.enum(["UNMATCHED", "MATCHED", "PARTIALLY_MATCHED", "DISPUTED", "IGNORED"]),
      linkedInvoiceId: z.number().optional(),
      linkedOperationalExpenseId: z.number().optional(),
      linkedPaymentRequestId: z.number().optional(),
      linkedAlternativeRevenueId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    await authenticateUser(input.token);

    return db.bankTransaction.update({
      where: { id: input.transactionId },
      data: {
        reconciliationStatus: input.status,
        reconciledAt: input.status === "MATCHED" ? new Date() : null,
        linkedInvoiceId: input.linkedInvoiceId,
        linkedOperationalExpenseId: input.linkedOperationalExpenseId,
        linkedPaymentRequestId: input.linkedPaymentRequestId,
        linkedAlternativeRevenueId: input.linkedAlternativeRevenueId,
      },
    });
  });
