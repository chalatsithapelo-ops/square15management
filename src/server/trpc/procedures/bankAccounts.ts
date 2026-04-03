import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

export const getBankAccounts = baseProcedure
  .input(z.object({ token: z.string() }))
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const accounts = await db.bankAccount.findMany({
      where: { createdById: user.id },
      include: {
        _count: {
          select: { transactions: true },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    return accounts;
  });

export const createBankAccount = baseProcedure
  .input(
    z.object({
      token: z.string(),
      accountName: z.string().min(1),
      bankName: z.enum([
        "FNB", "ABSA", "STANDARD_BANK", "NEDBANK", "CAPITEC",
        "INVESTEC", "TYMEBANK", "DISCOVERY", "OTHER",
      ]),
      accountNumber: z.string().min(4).max(4), // Last 4 digits only
      branchCode: z.string().optional(),
      accountType: z.enum(["CHEQUE", "SAVINGS", "CREDIT_CARD", "BUSINESS", "PETROL_CARD"]).default("CHEQUE"),
      notificationEmail: z.string().email().optional(),
      feedEnabled: z.boolean().default(false),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const account = await db.bankAccount.create({
      data: {
        accountName: input.accountName,
        bankName: input.bankName,
        accountNumber: input.accountNumber,
        branchCode: input.branchCode,
        accountType: input.accountType,
        notificationEmail: input.notificationEmail,
        feedEnabled: input.feedEnabled,
        createdById: user.id,
      },
    });

    return account;
  });

export const updateBankAccount = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      accountName: z.string().min(1).optional(),
      notificationEmail: z.string().email().optional().nullable(),
      feedEnabled: z.boolean().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    // Verify ownership
    const account = await db.bankAccount.findFirst({
      where: { id: input.id, createdById: user.id },
    });
    if (!account) throw new Error("Bank account not found");

    const { token, id, ...data } = input;
    const updateData: any = {};
    if (data.accountName !== undefined) updateData.accountName = data.accountName;
    if (data.notificationEmail !== undefined) updateData.notificationEmail = data.notificationEmail;
    if (data.feedEnabled !== undefined) updateData.feedEnabled = data.feedEnabled;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;

    return db.bankAccount.update({
      where: { id: input.id },
      data: updateData,
    });
  });

export const deleteBankAccount = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const account = await db.bankAccount.findFirst({
      where: { id: input.id, createdById: user.id },
    });
    if (!account) throw new Error("Bank account not found");

    await db.bankAccount.delete({ where: { id: input.id } });
    return { success: true };
  });
