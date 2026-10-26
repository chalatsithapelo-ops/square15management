import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import {
  applyInvoiceAllocation,
  listAllocationCandidates,
  runInvoicePaymentAutoMatch,
  NON_REVENUE_CREDIT_CATEGORIES,
} from "~/server/services/bankFeed/invoicePaymentMatcher";
import {
  parseCSVStatement,
  storeBatchTransactions,
  categorizeTransaction,
  recategorizeTransaction,
  confirmCategorization,
  applySavedRulesToExistingTransactions,
  reconcileTransaction,
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
      search: z.string().trim().max(100).optional(),
      limit: z.number().min(1).max(500).default(100),
      offset: z.number().min(0).default(0),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = {};

    // Only show transactions from accounts owned by the current user unless
    // they hold the top-level finance administration role.
    if (input.bankAccountId) {
      const account = await db.bankAccount.findFirst({
        where: {
          id: input.bankAccountId,
          ...(user.role === "SENIOR_ADMIN" ? {} : { createdById: user.id }),
        },
        select: { id: true },
      });
      if (!account) throw new Error("Bank account not found or access denied");
      where.bankAccountId = input.bankAccountId;
    } else {
      const userAccounts = await db.bankAccount.findMany({
        where: user.role === "SENIOR_ADMIN" ? {} : { createdById: user.id },
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

    // The review queue includes missing suggestions and AI's unresolved OTHER
    // bucket, not just categorization rows explicitly marked unconfirmed.
    if (input.isConfirmed === false) {
      where.OR = [
        { categorization: { is: null } },
        { categorization: { is: { isConfirmed: false } } },
        { categorization: { is: { suggestedBy: "AI", confirmedById: null, category: { in: ["OTHER", "OTHER_REVENUE"] } } } },
      ];
    } else if (input.isConfirmed === true) {
      where.categorization = { isConfirmed: true };
    }
    if (input.search) {
      const searchFilter = {
        OR: [
          { description: { contains: input.search, mode: "insensitive" } },
          { reference: { contains: input.search, mode: "insensitive" } },
          { categorization: { is: { category: { contains: input.search, mode: "insensitive" } } } },
        ],
      };
      where.AND = [...(where.AND ?? []), searchFilter];
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
        orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
        take: input.limit,
        skip: input.offset,
      }),
      db.bankTransaction.count({ where }),
    ]);

    const linkedExpenseIds = [...new Set(transactions.map((tx) => tx.linkedOperationalExpenseId).filter((id): id is number => id !== null))];
    const linkedExpenses = linkedExpenseIds.length
      ? await db.operationalExpense.findMany({
          where: { id: { in: linkedExpenseIds } },
          select: { id: true, description: true, amount: true, category: true, isApproved: true },
        })
      : [];
    const expenseById = new Map(linkedExpenses.map((expense) => [expense.id, expense]));
    return {
      transactions: transactions.map((tx) => ({
        ...tx,
        linkedOperationalExpense: tx.linkedOperationalExpenseId ? expenseById.get(tx.linkedOperationalExpenseId) ?? null : null,
      })),
      total,
    };
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

export const applyBankCategorizationLearning = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const accounts = await db.bankAccount.findMany({ where: { createdById: user.id }, select: { id: true } });
    const result = await applySavedRulesToExistingTransactions(accounts.map((account) => account.id));
    return result;
  });

export const categorizeMissingBankTransactions = baseProcedure
  .input(z.object({ token: z.string(), take: z.number().int().min(1).max(100).default(50) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const accounts = await db.bankAccount.findMany({ where: { createdById: user.id }, select: { id: true } });
    const accountIds = accounts.map((account) => account.id);
    if (accountIds.length === 0) return { scanned: 0, categorized: 0, errors: 0 };
    const transactions = await db.bankTransaction.findMany({
      where: { bankAccountId: { in: accountIds }, categorization: { is: null } },
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: input.take,
    });
    let categorized = 0;
    let errors = 0;
    for (const transaction of transactions) {
      try {
        await categorizeTransaction(transaction.id, transaction.description, transaction.amount, transaction.transactionType as "DEBIT" | "CREDIT");
        const categorizedRecord = await db.bankTransaction.findUnique({
          where: { id: transaction.id },
          include: { categorization: true },
        });
        if (categorizedRecord?.reconciliationStatus === "UNMATCHED" && categorizedRecord.categorization) {
          await reconcileTransaction({
            id: categorizedRecord.id,
            transactionDate: categorizedRecord.transactionDate,
            description: categorizedRecord.description,
            amount: categorizedRecord.amount,
            transactionType: categorizedRecord.transactionType,
            reference: categorizedRecord.reference,
            categorization: categorizedRecord.categorization,
          });
        }
        categorized++;
      } catch (error) {
        errors++;
        console.error(`[BankFeed] Manual categorization failed for transaction ${transaction.id}:`, error);
      }
    }
    return { scanned: transactions.length, categorized, errors };
  });

export const reconcileBankAccountProcedure = baseProcedure
  .input(
    z.object({
      token: z.string(),
      bankAccountId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const account = await db.bankAccount.findFirst({
      where: { id: input.bankAccountId, ...(user.role === "SENIOR_ADMIN" ? {} : { createdById: user.id }) },
      select: { id: true },
    });
    if (!account) throw new Error("Bank account not found or access denied");
    const result = await reconcileBankAccount(input.bankAccountId);
    return result;
  });

export const getBankFeedStats = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const userAccounts = await db.bankAccount.findMany({
      where: user.role === "SENIOR_ADMIN" ? {} : { createdById: user.id },
      select: { id: true },
    });
    const accountIds = userAccounts.map((a) => a.id);

    if (accountIds.length === 0) {
      return {
        totalAccounts: 0,
        totalTransactions: 0,
        unmatchedCount: 0,
        pendingReviewCount: 0,
        uncategorizedCount: 0,
        unresolvedCategoryCount: 0,
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
      unresolvedCategory,
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
          OR: [
            { categorization: { is: null } },
            { categorization: { is: { isConfirmed: false } } },
            { categorization: { is: { suggestedBy: "AI", confirmedById: null, category: { in: ["OTHER", "OTHER_REVENUE"] } } } },
          ],
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
      orderBy: [{ transactionDate: "desc" }, { id: "desc" }],
      take: 10,
    });

    return {
      totalAccounts: accountIds.length,
      totalTransactions,
      unmatchedCount,
      pendingReviewCount: unresolvedCategory,
      uncategorizedCount: await db.bankTransaction.count({ where: { bankAccountId: { in: accountIds }, categorization: { is: null } } }),
      unresolvedCategoryCount: unresolvedCategory,
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
    const user = await authenticateUser(input.token);
    const transaction = await db.bankTransaction.findUnique({
      where: { id: input.transactionId },
      include: { bankAccount: { select: { createdById: true } } },
    });
    if (!transaction || (transaction.bankAccount.createdById !== user.id && user.role !== "SENIOR_ADMIN")) {
      throw new Error("Bank transaction not found or access denied");
    }

    const selectedLinks = [input.linkedInvoiceId, input.linkedOperationalExpenseId, input.linkedPaymentRequestId, input.linkedAlternativeRevenueId].filter((id) => id !== undefined);
    if (input.status === "MATCHED") {
      if (selectedLinks.length !== 1) throw new Error("A matched transaction must link to exactly one finance record");
      const alreadyLinked = async (field: "linkedInvoiceId" | "linkedOperationalExpenseId" | "linkedPaymentRequestId" | "linkedAlternativeRevenueId", id: number) =>
        db.bankTransaction.findFirst({ where: { [field]: id, reconciliationStatus: "MATCHED", id: { not: transaction.id } }, select: { id: true } });
      if (input.linkedOperationalExpenseId !== undefined) {
        const expense = await db.operationalExpense.findUnique({ where: { id: input.linkedOperationalExpenseId }, select: { amount: true } });
        if (transaction.transactionType !== "DEBIT" || !expense || Math.abs(expense.amount - transaction.amount) > 0.01 || await alreadyLinked("linkedOperationalExpenseId", input.linkedOperationalExpenseId)) {
          throw new Error("Expense must be an unused exact-amount match for this debit");
        }
      }
      if (input.linkedInvoiceId !== undefined) {
        const invoice = await db.invoice.findUnique({ where: { id: input.linkedInvoiceId }, select: { total: true } });
        if (transaction.transactionType !== "CREDIT" || !invoice || Math.abs(invoice.total - transaction.amount) > 0.01 || await alreadyLinked("linkedInvoiceId", input.linkedInvoiceId)) {
          throw new Error("Invoice must be an unused exact-amount match for this credit");
        }
      }
      if (input.linkedPaymentRequestId !== undefined) {
        const payment = await db.paymentRequest.findUnique({ where: { id: input.linkedPaymentRequestId }, select: { calculatedAmount: true } });
        if (transaction.transactionType !== "DEBIT" || !payment || Math.abs(payment.calculatedAmount - transaction.amount) > 0.01 || await alreadyLinked("linkedPaymentRequestId", input.linkedPaymentRequestId)) {
          throw new Error("Payment request must be an unused exact-amount match for this debit");
        }
      }
      if (input.linkedAlternativeRevenueId !== undefined) {
        const revenue = await db.alternativeRevenue.findUnique({ where: { id: input.linkedAlternativeRevenueId }, select: { amount: true } });
        if (transaction.transactionType !== "CREDIT" || !revenue || Math.abs(revenue.amount - transaction.amount) > 0.01 || await alreadyLinked("linkedAlternativeRevenueId", input.linkedAlternativeRevenueId)) {
          throw new Error("Revenue record must be an unused exact-amount match for this credit");
        }
      }
    }

    const clearLinks = input.status === "UNMATCHED";
    return db.bankTransaction.update({
      where: { id: input.transactionId },
      data: {
        reconciliationStatus: input.status,
        reconciledAt: input.status === "MATCHED" ? new Date() : null,
        linkedInvoiceId: clearLinks ? null : input.linkedInvoiceId,
        linkedOperationalExpenseId: clearLinks ? null : input.linkedOperationalExpenseId,
        linkedPaymentRequestId: clearLinks ? null : input.linkedPaymentRequestId,
        linkedAlternativeRevenueId: clearLinks ? null : input.linkedAlternativeRevenueId,
      },
    });
  });

/**
 * Cash received on the bank feed that is not yet represented by a PAID
 * invoice or approved revenue record, so dashboards can count it as revenue.
 */
export const getBankReceipts = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) return { receipts: [] as { id: number; transactionDate: Date; amount: number; description: string; category: string }[] };
    const credits = await db.bankTransaction.findMany({
      where: { transactionType: "CREDIT", linkedInvoiceId: null },
      select: {
        id: true, transactionDate: true, amount: true, description: true, linkedAlternativeRevenueId: true,
        categorization: { select: { category: true } },
      },
      orderBy: { transactionDate: "desc" },
    });
    const altIds = credits.map((c) => c.linkedAlternativeRevenueId).filter((id): id is number => id !== null);
    const approvedAlt = new Set(
      altIds.length
        ? (await db.alternativeRevenue.findMany({ where: { id: { in: altIds }, isApproved: true }, select: { id: true } })).map((r) => r.id)
        : [],
    );
    return {
      receipts: credits
        .filter((c) => !NON_REVENUE_CREDIT_CATEGORIES.includes(c.categorization?.category ?? ""))
        .filter((c) => c.linkedAlternativeRevenueId === null || !approvedAlt.has(c.linkedAlternativeRevenueId))
        .map((c) => ({
          id: c.id,
          transactionDate: c.transactionDate,
          amount: c.amount,
          description: c.description,
          category: c.categorization?.category ?? "UNCATEGORIZED",
        })),
    };
  });

export const getInvoiceAllocationCandidates = baseProcedure
  .input(z.object({ token: z.string(), transactionId: z.number() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin access required");
    const result = await listAllocationCandidates(input.transactionId);
    if (!result) throw new Error("Credit transaction not found");
    return result;
  });

export const allocateBankCreditToInvoices = baseProcedure
  .input(z.object({ token: z.string(), transactionId: z.number(), invoiceIds: z.array(z.number()).min(1).max(30) }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin access required");
    const result = await applyInvoiceAllocation({
      transactionId: input.transactionId,
      invoiceIds: input.invoiceIds,
      tolerance: 1,
      actor: { id: user.id, name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.email },
    });
    if (!result) {
      throw new Error("Selected invoices must be unpaid and add up to the credit amount (within R1.00), and the credit must still be unmatched");
    }
    return result;
  });

export const runInvoiceAutoMatch = baseProcedure
  .input(z.object({ token: z.string() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    if (!isAdmin(user)) throw new Error("Admin access required");
    const result = await runInvoicePaymentAutoMatch();
    return { scanned: result.scanned, allocatedCount: result.allocated.length, allocated: result.allocated };
  });
