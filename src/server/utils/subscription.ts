import { db } from '~/server/db';
import { SubscriptionStatus } from '@prisma/client';

/**
 * Check if user has an active subscription
 */
export async function hasActiveSubscription(userId: number): Promise<boolean> {
  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
      },
    },
  });

  return !!subscription;
}

/**
 * Get user's current subscription with package details
 */
export async function getUserSubscription(userId: number) {
  const subscription = await db.subscription.findFirst({
    where: {
      userId,
      status: {
        in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL],
      },
    },
    include: {
      package: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  // Check if trial expired
  if (subscription && subscription.status === SubscriptionStatus.TRIAL && subscription.trialEndsAt) {
    if (new Date() > subscription.trialEndsAt) {
      // Trial expired, update status
      await db.subscription.update({
        where: { id: subscription.id },
        data: { status: SubscriptionStatus.EXPIRED },
      });
      return null;
    }
  }

  // Check if payment overdue
  if (subscription && subscription.isPaymentOverdue) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: { status: SubscriptionStatus.SUSPENDED },
    });
    return null;
  }

  return subscription;
}

/**
 * Check if user has access to a specific feature
 */
export async function hasFeatureAccess(
  userId: number,
  feature: keyof {
    hasQuotations: boolean;
    hasInvoices: boolean;
    hasStatements: boolean;
    hasOperations: boolean;
    hasPayments: boolean;
    hasCRM: boolean;
    hasProjectManagement: boolean;
    hasAssets: boolean;
    hasHR: boolean;
    hasMessages: boolean;
    hasAIAgent: boolean;
    hasAIInsights: boolean;
  }
): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }

  return subscription.package[feature] === true;
}

/**
 * Check if user can add more users
 */
export async function canAddUser(userId: number): Promise<boolean> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return false;
  }

  return subscription.currentUsers < subscription.maxUsers;
}

/**
 * Increment current user count
 */
export async function incrementUserCount(userId: number): Promise<void> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    throw new Error('No active subscription found');
  }

  if (subscription.currentUsers >= subscription.maxUsers) {
    throw new Error('User limit reached. Please upgrade your subscription.');
  }

  await db.subscription.update({
    where: { id: subscription.id },
    data: {
      currentUsers: {
        increment: 1,
      },
    },
  });
}

/**
 * Decrement current user count
 */
export async function decrementUserCount(userId: number): Promise<void> {
  const subscription = await getUserSubscription(userId);
  
  if (!subscription) {
    return;
  }

  if (subscription.currentUsers > 0) {
    await db.subscription.update({
      where: { id: subscription.id },
      data: {
        currentUsers: {
          decrement: 1,
        },
      },
    });
  }
}

/**
 * Check subscription and throw error if no access
 */
export async function requireSubscription(userId: number, feature?: string): Promise<void> {
  const hasSubscription = await hasActiveSubscription(userId);
  
  if (!hasSubscription) {
    throw new Error(
      'This feature requires an active subscription. Please contact your administrator or upgrade your plan.'
    );
  }

  if (feature) {
    const featureKey = `has${feature}` as keyof {
      hasQuotations: boolean;
      hasInvoices: boolean;
      hasStatements: boolean;
      hasOperations: boolean;
      hasPayments: boolean;
      hasCRM: boolean;
      hasProjectManagement: boolean;
      hasAssets: boolean;
      hasHR: boolean;
      hasMessages: boolean;
      hasAIAgent: boolean;
      hasAIInsights: boolean;
    };
    
    const hasAccess = await hasFeatureAccess(userId, featureKey);
    
    if (!hasAccess) {
      throw new Error(
        `Your current subscription plan does not include ${feature}. Please upgrade your plan to access this feature.`
      );
    }
  }
}

/**
 * Calculate subscription cost
 */
export function calculateSubscriptionCost(
  basePrice: number,
  additionalUsers: number,
  additionalUserPrice: number,
  additionalTenants?: number,
  additionalTenantPrice?: number,
  additionalContractors?: number
): number {
  let total = basePrice;
  
  // Add additional users cost
  total += additionalUsers * additionalUserPrice;
  
  // Add additional tenants cost (Property Managers only)
  if (additionalTenants && additionalTenantPrice) {
    total += additionalTenants * additionalTenantPrice;
  }
  
  // Add additional contractors cost (Property Managers only)
  if (additionalContractors && additionalUserPrice) {
    total += additionalContractors * additionalUserPrice;
  }
  
  return total;
}
