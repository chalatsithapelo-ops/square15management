import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { baseProcedure } from '~/server/trpc/main';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';
import { isRestrictedDemoAccount } from '~/server/utils/demoAccounts';

const isAdminRole = (role: string | undefined) =>
  role === 'ADMIN' || role === 'SENIOR_ADMIN' || role === 'JUNIOR_ADMIN';

const canManageSubscriptions = (user: { role?: string; email?: string | null }) => {
  return !isRestrictedDemoAccount(user) && isAdminRole(user.role);
};

async function ensureDefaultPackagesExist() {
  const defaultPackages = [
    // CONTRACTOR packages (S1-S6)
    {
      name: 'S1',
      displayName: 'S1',
      description: 'Quotations, Invoices, Statements.',
      type: 'CONTRACTOR' as const,
      basePrice: 195,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: false,
      hasPayments: false,
      hasCRM: false,
      hasProjectManagement: false,
      hasAssets: false,
      hasHR: false,
      hasMessages: false,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'S2',
      displayName: 'S2',
      description: 'S1 + Operations management.',
      type: 'CONTRACTOR' as const,
      basePrice: 350,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: false,
      hasCRM: false,
      hasProjectManagement: false,
      hasAssets: false,
      hasHR: false,
      hasMessages: false,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'S3',
      displayName: 'S3',
      description: 'S2 + Payments.',
      type: 'CONTRACTOR' as const,
      basePrice: 400,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: false,
      hasProjectManagement: false,
      hasAssets: false,
      hasHR: false,
      hasMessages: false,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'S4',
      displayName: 'S4',
      description: 'S3 + CRM + Project management.',
      type: 'CONTRACTOR' as const,
      basePrice: 450,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: false,
      hasHR: false,
      hasMessages: false,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'S5',
      displayName: 'S5',
      description: 'S4 + Assets/Liabilities + Management accounts + HR + Messages.',
      type: 'CONTRACTOR' as const,
      basePrice: 600,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'S6',
      displayName: 'S6',
      description: 'All features including AI Agent and AI Insights.',
      type: 'CONTRACTOR' as const,
      basePrice: 650,
      additionalUserPrice: 100,
      additionalTenantPrice: null,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: true,
      hasAIInsights: true,
      trialDays: 0,
      isActive: true,
    },
    // PROPERTY_MANAGER packages (PM1-PM2)
    {
      name: 'PM1',
      displayName: 'PM1',
      description: 'Full system access (no AI Agent/AI Insights).',
      type: 'PROPERTY_MANAGER' as const,
      basePrice: 2500,
      additionalUserPrice: 950,
      additionalTenantPrice: 50,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: false,
      hasAIInsights: false,
      trialDays: 0,
      isActive: true,
    },
    {
      name: 'PM2',
      displayName: 'PM2',
      description: 'Full system access including AI Agent and AI Insights.',
      type: 'PROPERTY_MANAGER' as const,
      basePrice: 3500,
      additionalUserPrice: 950,
      additionalTenantPrice: 50,
      hasQuotations: true,
      hasInvoices: true,
      hasStatements: true,
      hasOperations: true,
      hasPayments: true,
      hasCRM: true,
      hasProjectManagement: true,
      hasAssets: true,
      hasHR: true,
      hasMessages: true,
      hasAIAgent: true,
      hasAIInsights: true,
      trialDays: 0,
      isActive: true,
    },
  ];

  for (const pkg of defaultPackages) {
    await db.package.upsert({
      where: { name: pkg.name },
      create: pkg,
      update: pkg,
    });
  }
}

export const getPackages = baseProcedure
  .input(
    z.object({
      token: z.string(),
      type: z.enum(['CONTRACTOR', 'PROPERTY_MANAGER']).optional(),
    })
  )
  .query(async ({ input }) => {
    // Public registration flow uses the literal token "public".
    // In that case we allow package listing without a JWT.
    if (input.token !== 'public') {
      await authenticateUser(input.token);
    }

    // If the DB was reset and packages are missing, restore defaults.
    await ensureDefaultPackagesExist();

    const packages = await db.package.findMany({
      where: {
        isActive: true,
        ...(input.type && { type: input.type }),
      },
      orderBy: {
        basePrice: 'asc',
      },
    });

    return packages;
  });

export const getUserSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const subscription = await db.subscription.findFirst({
      where: {
        userId: user.id,
        status: {
          in: ['ACTIVE', 'TRIAL'],
        },
      },
      include: {
        package: true,
        payments: {
          orderBy: {
            createdAt: 'desc',
          },
          take: 5,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return subscription;
  });

export const createSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
      userId: z.number(),
      packageId: z.number(),
      additionalUsers: z.number().default(0),
      additionalTenants: z.number().optional(),
      additionalContractors: z.number().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only non-demo administrators can create subscriptions',
      });
    }

    // Get package details
    const packageDetails = await db.package.findUnique({
      where: { id: input.packageId },
    });

    if (!packageDetails) {
      throw new Error('Package not found');
    }

    // Calculate dates
    const startDate = new Date();
    const trialEndsAt = packageDetails.trialDays > 0
      ? new Date(Date.now() + packageDetails.trialDays * 24 * 60 * 60 * 1000)
      : null;
    
    const nextBillingDate = trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create subscription
    const subscription = await db.subscription.create({
      data: {
        userId: input.userId,
        packageId: input.packageId,
        status: packageDetails.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        startDate,
        trialEndsAt,
        includedUsers: 1,
        additionalUsers: input.additionalUsers,
        maxUsers: 1 + input.additionalUsers,
        currentUsers: 1,
        additionalTenants: input.additionalTenants,
        additionalContractors: input.additionalContractors,
        nextBillingDate,
        notes: input.notes,
      },
      include: {
        package: true,
      },
    });

    return subscription;
  });

export const updateSubscriptionPackage = baseProcedure
  .input(
    z.object({
      token: z.string(),
      subscriptionId: z.number(),
      packageId: z.number(),
      additionalUsers: z.number().optional(),
      additionalTenants: z.number().optional(),
      additionalContractors: z.number().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only non-demo administrators can update subscriptions',
      });
    }

    const packageDetails = await db.package.findUnique({
      where: { id: input.packageId },
    });

    if (!packageDetails) {
      throw new Error('Package not found');
    }

    const updateData: any = {
      packageId: input.packageId,
    };

    if (input.additionalUsers !== undefined) {
      updateData.additionalUsers = input.additionalUsers;
      updateData.maxUsers = 1 + input.additionalUsers;
    }

    if (input.additionalTenants !== undefined) {
      updateData.additionalTenants = input.additionalTenants;
    }

    if (input.additionalContractors !== undefined) {
      updateData.additionalContractors = input.additionalContractors;
    }

    if (input.notes !== undefined) {
      updateData.notes = input.notes;
    }

    const subscription = await db.subscription.update({
      where: { id: input.subscriptionId },
      data: updateData,
      include: {
        package: true,
      },
    });

    return subscription;
  });

export const updatePackagePricing = baseProcedure
  .input(
    z.object({
      token: z.string(),
      packageId: z.number(),
      basePrice: z.number().optional(),
      additionalUserPrice: z.number().optional(),
      additionalTenantPrice: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only non-demo administrators can update package pricing',
      });
    }

    const updateData: any = {};

    if (input.basePrice !== undefined) {
      updateData.basePrice = input.basePrice;
    }

    if (input.additionalUserPrice !== undefined) {
      updateData.additionalUserPrice = input.additionalUserPrice;
    }

    if (input.additionalTenantPrice !== undefined) {
      updateData.additionalTenantPrice = input.additionalTenantPrice;
    }

    const packageDetails = await db.package.update({
      where: { id: input.packageId },
      data: updateData,
    });

    return packageDetails;
  });

export const activateSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
      subscriptionId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only non-demo administrators can activate subscriptions',
      });
    }

    const subscription = await db.subscription.update({
      where: { id: input.subscriptionId },
      data: {
        status: 'ACTIVE',
        isPaymentOverdue: false,
      },
      include: {
        package: true,
      },
    });

    return subscription;
  });

export const suspendSubscription = baseProcedure
  .input(
    z.object({
      token: z.string(),
      subscriptionId: z.number(),
      reason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only non-demo administrators can suspend subscriptions',
      });
    }

    const subscription = await db.subscription.update({
      where: { id: input.subscriptionId },
      data: {
        status: 'SUSPENDED',
        notes: input.reason ? `Suspended: ${input.reason}` : undefined,
      },
      include: {
        package: true,
      },
    });

    return subscription;
  });

export const getAllSubscriptions = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(['TRIAL', 'ACTIVE', 'SUSPENDED', 'CANCELLED', 'EXPIRED']).optional(),
    })
  )
  .query(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    const subscriptions = await db.subscription.findMany({
      where: {
        ...(input.status && { status: input.status }),
      },
      include: {
        package: true,
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return subscriptions;
  });

export const getSubscriptionRoster = baseProcedure
  .input(
    z.object({
      token: z.string(),
      includeRoles: z.array(z.string()).optional(),
    })
  )
  .query(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    if (!canManageSubscriptions(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Access denied',
      });
    }

    // Defaults keep the list focused on accounts that actually use subscriptions.
    const defaultRoles = [
      'CONTRACTOR',
      'CONTRACTOR_SENIOR_MANAGER',
      'CONTRACTOR_JUNIOR_MANAGER',
      'PROPERTY_MANAGER',
    ];

    const roles = (input.includeRoles && input.includeRoles.length > 0
      ? input.includeRoles
      : defaultRoles
    ).filter(Boolean);

    const users = await db.user.findMany({
      where: {
        role: {
          in: roles,
        },
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'desc' }],
    });

    const userIds = users.map((u) => u.id);

    const subscriptions = userIds.length
      ? await db.subscription.findMany({
          where: {
            userId: { in: userIds },
          },
          include: {
            package: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : [];

    const byUserId = new Map<number, any[]>();
    for (const sub of subscriptions) {
      const list = byUserId.get(sub.userId) ?? [];
      list.push(sub);
      byUserId.set(sub.userId, list);
    }

    const roster = users.map((user) => {
      const list = byUserId.get(user.id) ?? [];
      const activeOrTrial = list.find((s) => s.status === 'ACTIVE' || s.status === 'TRIAL') ?? null;
      const latest = list[0] ?? null;
      const current = activeOrTrial ?? latest;

      return {
        user,
        subscription: current,
      };
    });

    return roster;
  });
