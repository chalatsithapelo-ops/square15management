import { z } from 'zod';
import { baseProcedure } from '~/server/trpc/main';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';

const isAdminRole = (role: string | undefined) =>
  role === 'ADMIN' || role === 'SENIOR_ADMIN' || role === 'JUNIOR_ADMIN';

export const getPackages = baseProcedure
  .input(
    z.object({
      token: z.string(),
      type: z.enum(['CONTRACTOR', 'PROPERTY_MANAGER']).optional(),
    })
  )
  .query(async ({ input }) => {
    await authenticateUser(input.token);

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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can create subscriptions');
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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can update subscriptions');
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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can update package pricing');
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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can activate subscriptions');
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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can suspend subscriptions');
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

    if (!isAdminRole(adminUser.role)) {
      throw new Error('Only administrators can view all subscriptions');
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
