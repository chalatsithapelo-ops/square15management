import { z } from 'zod';
import { baseProcedure } from '~/server/trpc/main';
import { db } from '~/server/db';
import { authenticateUser } from '~/server/utils/auth';
import { hash } from 'bcryptjs';

const isAdminRole = (role: string | undefined) =>
  role === 'ADMIN' || role === 'SENIOR_ADMIN' || role === 'JUNIOR_ADMIN';

const DEMO_JUNIOR_ADMIN_EMAIL = 'junior@propmanagement.com';

const canManageRegistrations = (user: { role?: string; email?: string }) =>
  user.role === 'ADMIN' ||
  user.role === 'SENIOR_ADMIN' ||
  (user.role === 'JUNIOR_ADMIN' && user.email !== DEMO_JUNIOR_ADMIN_EMAIL);

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

    if (!canManageRegistrations(adminUser)) {
      throw new Error('Only administrators can view pending registrations');
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

    if (!canManageRegistrations(adminUser)) {
      throw new Error('Only administrators can approve registrations');
    }

    const registration = await db.pendingRegistration.findUnique({
      where: { id: input.registrationId },
    });

    if (!registration) {
      throw new Error('Registration not found');
    }

    if (registration.isApproved) {
      throw new Error('Registration already approved');
    }

    if (!input.skipPaymentCheck && !registration.hasPaid) {
      throw new Error('Payment not received. Please confirm payment before approving.');
    }

    // Get package details
    const packageDetails = await db.package.findUnique({
      where: { id: registration.packageId },
    });

    if (!packageDetails) {
      throw new Error('Package not found');
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

    if (!canManageRegistrations(adminUser)) {
      throw new Error('Only administrators can reject registrations');
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

    if (!canManageRegistrations(adminUser)) {
      throw new Error('Only administrators can mark registrations as paid');
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
