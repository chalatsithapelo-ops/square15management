import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";
import bcrypt from "bcryptjs";

export const addTenant = baseProcedure
  .input(
    z.object({
      token: z.string(),
      buildingId: z.number(),
      firstName: z.string().min(1),
      lastName: z.string().min(1),
      email: z.string().email(),
      phone: z.string().min(1),
      address: z.string().min(1),
      unitNumber: z.string().optional(),
      
      // Lease Information
      leaseStartDate: z.string().datetime(),
      leaseEndDate: z.string().datetime(),
      monthlyRent: z.number().positive(),
      securityDeposit: z.number().nonnegative(),
      
      // Utility Meters
      electricityMeterNumber: z.string().optional(),
      waterMeterNumber: z.string().optional(),
      gasMeterNumber: z.string().optional(),
      
      // Additional Details
      notes: z.string().optional(),
      
      // Auto-generate password or use custom
      autoGeneratePassword: z.boolean().default(true),
      customPassword: z.string().min(6).optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    const propertyManagerId = user.id;

    // Verify user is a property manager
    if (user.role !== "PROPERTY_MANAGER" && user.role !== "SENIOR_ADMIN" && user.role !== "ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can add tenants.",
      });
    }

    // Verify building belongs to this property manager (unless admin)
    const building = await db.building.findFirst({
      where: {
        id: input.buildingId,
        ...(user.role === "PROPERTY_MANAGER" ? { propertyManagerId } : {}),
      },
    });

    if (!building) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Building not found or you don't have access to it.",
      });
    }

    // Check if tenant with this email already exists for this PM
    const existingTenant = await db.propertyManagerCustomer.findFirst({
      where: {
        email: input.email,
        propertyManagerId: building.propertyManagerId,
      },
    });

    if (existingTenant) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A tenant with this email already exists in your portfolio.",
      });
    }

    // Check if user account already exists
    let customerUser = await db.user.findUnique({
      where: { email: input.email },
    });

    // Generate password
    const password = input.autoGeneratePassword
      ? generateRandomPassword()
      : input.customPassword!;

    const hashedPassword = await bcrypt.hash(password, 10);

    // Create or update user account
    if (!customerUser) {
      customerUser = await db.user.create({
        data: {
          email: input.email,
          password: hashedPassword,
          firstName: input.firstName,
          lastName: input.lastName,
          phone: input.phone,
          role: "CUSTOMER",
        },
      });
    } else {
      // Update existing user to ensure they're a customer
      if (customerUser.role !== "CUSTOMER") {
        throw new TRPCError({
          code: "CONFLICT",
          message: "This email is already registered with a different role.",
        });
      }
    }

    // Create tenant record
    const tenant = await db.propertyManagerCustomer.create({
      data: {
        propertyManagerId: building.propertyManagerId,
        buildingId: input.buildingId,
        userId: customerUser.id,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        phone: input.phone,
        address: input.address,
        unitNumber: input.unitNumber,
        buildingName: building.name,
        
        // Lease details
        leaseStartDate: new Date(input.leaseStartDate),
        leaseEndDate: new Date(input.leaseEndDate),
        monthlyRent: input.monthlyRent,
        securityDeposit: input.securityDeposit,
        
        // Utility meters
        electricityMeterNumber: input.electricityMeterNumber,
        waterMeterNumber: input.waterMeterNumber,
        gasMeterNumber: input.gasMeterNumber,
        
        // Status - directly approved since PM is adding
        onboardingStatus: "APPROVED",
        status: "ACTIVE",
        onboardedDate: new Date(),
        approvedBy: propertyManagerId,
        approvedDate: new Date(),
        moveInDate: new Date(input.leaseStartDate),
        
        notes: input.notes,
      },
      include: {
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return {
      tenant,
      credentials: {
        email: input.email,
        password: password, // Return plain password for PM to share with tenant
        loginUrl: process.env.APP_URL || "http://localhost:8000",
      },
    };
  });

// Helper function to generate a random password
function generateRandomPassword(): string {
  const length = 12;
  const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
  let password = "";
  
  // Ensure at least one uppercase, one lowercase, one number, one special char
  password += "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[Math.floor(Math.random() * 26)];
  password += "abcdefghijklmnopqrstuvwxyz"[Math.floor(Math.random() * 26)];
  password += "0123456789"[Math.floor(Math.random() * 10)];
  password += "!@#$%^&*"[Math.floor(Math.random() * 8)];
  
  // Fill the rest randomly
  for (let i = password.length; i < length; i++) {
    password += charset[Math.floor(Math.random() * charset.length)];
  }
  
  // Shuffle the password
  return password.split('').sort(() => Math.random() - 0.5).join('');
}
