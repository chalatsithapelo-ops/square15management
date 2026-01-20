import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { baseProcedure } from '~/server/trpc/main';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';
import { hash } from 'bcryptjs';
import { assertNotRestrictedDemoAccountAccessDenied, isRestrictedDemoAccount } from '~/server/utils/demoAccounts';

const isAdminRole = (role: string | undefined) =>
  role === 'ADMIN' || role === 'SENIOR_ADMIN' || role === 'JUNIOR_ADMIN';

const canManageRegistrations = (user: { role?: string; email?: string | null }) => {
  return (
    !isRestrictedDemoAccount(user) &&
    (user.role === 'ADMIN' || user.role === 'SENIOR_ADMIN' || user.role === 'JUNIOR_ADMIN')
  );
};

export const createPendingRegistration = baseProcedure
  .input(
    z.object({
      email: z.string().email(),
      firstName: z.string(),
      lastName: z.string(),
      phone: z.string(),
      companyName: z.string().optional(),
      accountType: z.enum(['CONTRACTOR', 'PROPERTY_MANAGER']),
      packageId: z.number(),
      additionalUsers: z.number().default(0),
      additionalTenants: z.number().default(0),
      additionalContractors: z.number().default(0),
    })
  )
  .mutation(async ({ input }) => {
    // Check if email already exists
    const existingUser = await db.user.findUnique({
      where: { email: input.email },
    });

    if (existingUser) {
      throw new Error('An account with this email already exists');
    }

    // Check if pending registration exists
    const existingPending = await db.pendingRegistration.findFirst({
      where: {
        email: input.email,
        isApproved: false,
      },
    });

    if (existingPending) {
      throw new Error('A registration request with this email is already pending');
    }

    // Create pending registration
    const pendingReg = await db.pendingRegistration.create({
      data: {
        email: input.email,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        companyName: input.companyName,
        accountType: input.accountType,
        packageId: input.packageId,
        additionalUsers: input.additionalUsers,
        additionalTenants: input.additionalTenants,
        additionalContractors: input.additionalContractors,
      },
    });

    return {
      success: true,
      registrationId: pendingReg.id,
      message: 'Registration submitted successfully. You will receive an email once approved.',
    };
  });

export const getPendingRegistrations = baseProcedure
  .input(
    z.object({
      token: z.string(),
      isApproved: z.boolean().optional(),
      hasPaid: z.boolean().optional(),
    })
  )
  .query(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can view pending registrations',
      });
    }

    const registrations = await db.pendingRegistration.findMany({
      where: {
        ...(input.isApproved !== undefined && { isApproved: input.isApproved }),
        ...(input.hasPaid !== undefined && { hasPaid: input.hasPaid }),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    // Get package details for each registration
    const registrationsWithPackages = await Promise.all(
      registrations.map(async (reg) => {
        const packageDetails = await db.package.findUnique({
          where: { id: reg.packageId },
        });
        return {
          ...reg,
          package: packageDetails,
        };
      })
    );

    return registrationsWithPackages;
  });

export const getAllRegistrations = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can view registrations',
      });
    }

    const [registrations, contractorPackageRequests] = await Promise.all([
      db.pendingRegistration.findMany({
        orderBy: {
          createdAt: 'desc',
        },
      }),
      db.contractorPackageRequest.findMany({
        include: {
          contractor: true,
          package: true,
          propertyManager: {
            select: { id: true, email: true, firstName: true, lastName: true },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
    ]);

    const packageIds = Array.from(new Set(registrations.map((r) => r.packageId)));
    const packages = await db.package.findMany({
      where: { id: { in: packageIds } },
    });
    const packagesById = new Map(packages.map((p) => [p.id, p] as const));

    const createdUserIds = Array.from(
      new Set(registrations.map((r) => r.createdUserId).filter((id): id is number => typeof id === 'number'))
    );

    const subscriptions = createdUserIds.length
      ? await db.subscription.findMany({
          where: {
            userId: { in: createdUserIds },
          },
          include: {
            package: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : [];

    const latestSubscriptionByUserId = new Map<number, (typeof subscriptions)[number]>();
    for (const sub of subscriptions) {
      if (!latestSubscriptionByUserId.has(sub.userId)) {
        latestSubscriptionByUserId.set(sub.userId, sub);
      }
    }

    const now = Date.now();

    const registrationItems = registrations.map((reg) => {
      const pkg = packagesById.get(reg.packageId) ?? null;
      const subscription = typeof reg.createdUserId === 'number' ? latestSubscriptionByUserId.get(reg.createdUserId) : null;

      const monthlyCharge = subscription
        ? subscription.package.basePrice +
          subscription.additionalUsers * subscription.package.additionalUserPrice +
          (subscription.additionalTenants ?? 0) * (subscription.package.additionalTenantPrice ?? 0)
        : null;

      const isInTrial = !!subscription?.trialEndsAt && subscription.trialEndsAt.getTime() > now;
      const isBillingDue =
        !!subscription &&
        !isInTrial &&
        (subscription.isPaymentOverdue || (subscription.nextBillingDate ? subscription.nextBillingDate.getTime() <= now : false));

      const amountDue = subscription && monthlyCharge != null && isBillingDue ? monthlyCharge : 0;

      const derivedStatus = !reg.isApproved
        ? 'PENDING'
        : subscription && (subscription.status === 'ACTIVE' || subscription.status === 'TRIAL')
          ? 'ACTIVE'
          : 'APPROVED';

      return {
        kind: 'REGISTRATION' as const,
        ...reg,
        package: pkg,
        derivedStatus,
        subscription: subscription
          ? {
              id: subscription.id,
              status: subscription.status,
              startDate: subscription.startDate,
              trialEndsAt: subscription.trialEndsAt,
              nextBillingDate: subscription.nextBillingDate,
              lastPaymentDate: subscription.lastPaymentDate,
              isPaymentOverdue: subscription.isPaymentOverdue,
              package: subscription.package,
              monthlyCharge,
              amountDue,
            }
          : null,
      };
    });

    const contractorRequestUserIds = Array.from(
      new Set(contractorPackageRequests.map((r) => r.createdUserId).filter((id): id is number => typeof id === 'number'))
    );

    const contractorRequestSubscriptions = contractorRequestUserIds.length
      ? await db.subscription.findMany({
          where: {
            userId: { in: contractorRequestUserIds },
          },
          include: {
            package: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        })
      : [];

    const latestContractorSubByUserId = new Map<number, (typeof contractorRequestSubscriptions)[number]>();
    for (const sub of contractorRequestSubscriptions) {
      if (!latestContractorSubByUserId.has(sub.userId)) {
        latestContractorSubByUserId.set(sub.userId, sub);
      }
    }

    const contractorPackageRequestItems = contractorPackageRequests.map((req) => {
      const createdUserSub = typeof req.createdUserId === 'number' ? latestContractorSubByUserId.get(req.createdUserId) : null;

      const derivedStatus =
        req.status === 'PENDING'
          ? 'PENDING'
          : createdUserSub && (createdUserSub.status === 'ACTIVE' || createdUserSub.status === 'TRIAL')
            ? 'ACTIVE'
            : 'APPROVED';

      return {
        kind: 'PM_CONTRACTOR_PACKAGE_REQUEST' as const,
        id: req.id,
        createdAt: req.createdAt,
        updatedAt: req.updatedAt,
        derivedStatus,
        requestStatus: req.status,
        contractor: {
          id: req.contractor.id,
          firstName: req.contractor.firstName,
          lastName: req.contractor.lastName,
          email: req.contractor.email,
          companyName: req.contractor.companyName,
          portalAccessEnabled: req.contractor.portalAccessEnabled,
        },
        propertyManager: req.propertyManager,
        package: req.package,
        createdUserId: req.createdUserId,
        createdSubscriptionId: req.createdSubscriptionId,
        subscription: createdUserSub
          ? {
              id: createdUserSub.id,
              status: createdUserSub.status,
              startDate: createdUserSub.startDate,
              trialEndsAt: createdUserSub.trialEndsAt,
              nextBillingDate: createdUserSub.nextBillingDate,
              lastPaymentDate: createdUserSub.lastPaymentDate,
              isPaymentOverdue: createdUserSub.isPaymentOverdue,
              package: createdUserSub.package,
            }
          : null,
      };
    });

    return [...contractorPackageRequestItems, ...registrationItems].sort((a: any, b: any) => {
      const aCreated = new Date(a.createdAt).getTime();
      const bCreated = new Date(b.createdAt).getTime();
      return bCreated - aCreated;
    });
  });

export const approveContractorPackageRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      requestId: z.number(),
      password: z.string().min(6).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can approve contractor package requests',
      });
    }

    const request = await db.contractorPackageRequest.findUnique({
      where: { id: input.requestId },
      include: {
        contractor: true,
        package: true,
        propertyManager: { select: { id: true } },
      },
    });

    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Package request not found' });
    }

    if (request.status !== 'PENDING') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request is not pending' });
    }

    if (request.package.type !== 'CONTRACTOR') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Selected package is not a contractor package' });
    }

    // Create or reuse user
    const existingUser = await db.user.findUnique({ where: { email: request.contractor.email } });

    let contractorUserId: number;
    if (existingUser) {
      contractorUserId = existingUser.id;
    } else {
      if (!input.password) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Password is required to create the contractor portal account',
        });
      }

      const hashedPassword = await hash(input.password, 10);
      const createdUser = await db.user.create({
        data: {
          email: request.contractor.email,
          password: hashedPassword,
          firstName: request.contractor.firstName,
          lastName: request.contractor.lastName,
          phone: request.contractor.phone ?? '',
          role: 'CONTRACTOR_SENIOR_MANAGER',
        },
        select: { id: true },
      });
      contractorUserId = createdUser.id;
    }

    // Create subscription for the contractor user
    const startDate = new Date();
    const trialEndsAt = request.package.trialDays > 0
      ? new Date(Date.now() + request.package.trialDays * 24 * 60 * 60 * 1000)
      : null;
    const nextBillingDate = trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const subscription = await db.subscription.create({
      data: {
        userId: contractorUserId,
        packageId: request.packageId,
        status: request.package.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        startDate,
        trialEndsAt,
        includedUsers: 1,
        additionalUsers: 0,
        maxUsers: 1,
        currentUsers: 1,
        nextBillingDate,
        notes: `Approved via PM request ${request.id} (PM ${request.propertyManagerId})`,
      },
      select: { id: true },
    });

    await db.contractor.update({
      where: { id: request.contractorId },
      data: { portalAccessEnabled: true },
    });

    await db.contractorPackageRequest.update({
      where: { id: request.id },
      data: {
        status: 'APPROVED',
        approvedAt: new Date(),
        approvedById: adminUser.id,
        createdUserId: contractorUserId,
        createdSubscriptionId: subscription.id,
      },
    });

    return {
      success: true,
      subscriptionId: subscription.id,
      userId: contractorUserId,
      message: 'Contractor package request approved and portal access enabled',
    };
  });

export const rejectContractorPackageRequest = baseProcedure
  .input(
    z.object({
      token: z.string(),
      requestId: z.number(),
      reason: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can reject contractor package requests',
      });
    }

    const request = await db.contractorPackageRequest.findUnique({ where: { id: input.requestId } });
    if (!request) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Package request not found' });
    }

    if (request.status !== 'PENDING') {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Request is not pending' });
    }

    await db.contractorPackageRequest.update({
      where: { id: input.requestId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        rejectedById: adminUser.id,
        rejectionReason: input.reason,
      },
    });

    return { success: true, message: 'Contractor package request rejected' };
  });

export const approvePendingRegistration = baseProcedure
  .input(
    z.object({
      token: z.string(),
      registrationId: z.number(),
      password: z.string().min(6),
      skipPaymentCheck: z.boolean().default(false), // Allow manual approval without payment
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can approve registrations',
      });
    }

    const registration = await db.pendingRegistration.findUnique({
      where: { id: input.registrationId },
    });

    if (!registration) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Registration not found',
      });
    }

    if (registration.isApproved) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Registration already approved',
      });
    }

    if (!input.skipPaymentCheck && !registration.hasPaid) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Payment not received. Please confirm payment before approving.',
      });
    }

    // Get package details
    const packageDetails = await db.package.findUnique({
      where: { id: registration.packageId },
    });

    if (!packageDetails) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Package not found',
      });
    }

    // Hash password
    const hashedPassword = await hash(input.password, 10);

    // Determine role based on account type
    const role = registration.accountType === 'CONTRACTOR' ? 'CONTRACTOR' : 'PROPERTY_MANAGER';

    // Create user
    const newUser = await db.user.create({
      data: {
        email: registration.email,
        password: hashedPassword,
        firstName: registration.firstName,
        lastName: registration.lastName,
        phone: registration.phone,
        role,
      },
    });

    // Calculate subscription dates
    const startDate = new Date();
    const trialEndsAt = packageDetails.trialDays > 0
      ? new Date(Date.now() + packageDetails.trialDays * 24 * 60 * 60 * 1000)
      : null;
    const nextBillingDate = trialEndsAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Create subscription
    const subscription = await db.subscription.create({
      data: {
        userId: newUser.id,
        packageId: registration.packageId,
        status: packageDetails.trialDays > 0 ? 'TRIAL' : 'ACTIVE',
        startDate,
        trialEndsAt,
        includedUsers: 1,
        additionalUsers: registration.additionalUsers,
        maxUsers: 1 + registration.additionalUsers,
        currentUsers: 1,
        additionalTenants: registration.additionalTenants,
        additionalContractors: registration.additionalContractors,
        nextBillingDate,
      },
    });

    // Ensure subscription-created contractors appear in Contractor Management
    if (registration.accountType === 'CONTRACTOR') {
      await db.contractor.upsert({
        where: { email: registration.email },
        create: {
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          phone: registration.phone,
          companyName: registration.companyName,
          serviceType: 'GENERAL_MAINTENANCE',
          portalAccessEnabled: true,
          dateJoined: new Date(),
        },
        update: {
          firstName: registration.firstName,
          lastName: registration.lastName,
          phone: registration.phone,
          companyName: registration.companyName,
          portalAccessEnabled: true,
        },
      });
    }

    // Update pending registration
    await db.pendingRegistration.update({
      where: { id: input.registrationId },
      data: {
        isApproved: true,
        approvedAt: new Date(),
        approvedById: adminUser.id,
        createdUserId: newUser.id,
      },
    });

    return {
      success: true,
      userId: newUser.id,
      subscriptionId: subscription.id,
      message: 'Registration approved and account created successfully',
    };
  });

export const rejectPendingRegistration = baseProcedure
  .input(
    z.object({
      token: z.string(),
      registrationId: z.number(),
      reason: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can reject registrations',
      });
    }

    const registration = await db.pendingRegistration.update({
      where: { id: input.registrationId },
      data: {
        rejectedAt: new Date(),
        rejectionReason: input.reason,
      },
    });

    return {
      success: true,
      message: 'Registration rejected',
    };
  });

export const markRegistrationAsPaid = baseProcedure
  .input(
    z.object({
      token: z.string(),
      registrationId: z.number(),
      paymentId: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const adminUser = await authenticateUser(input.token);

    assertNotRestrictedDemoAccountAccessDenied(adminUser);

    if (!canManageRegistrations(adminUser)) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Only administrators can mark registrations as paid',
      });
    }

    const registration = await db.pendingRegistration.update({
      where: { id: input.registrationId },
      data: {
        hasPaid: true,
        paymentId: input.paymentId,
      },
    });

    return {
      success: true,
      message: 'Registration marked as paid',
    };
  });
