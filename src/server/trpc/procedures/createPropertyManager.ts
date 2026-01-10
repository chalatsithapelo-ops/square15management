import { z } from "zod";
import { TRPCError } from "@trpc/server";
import bcryptjs from "bcryptjs";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const createPropertyManagerSchema = z.object({
  token: z.string(),
  // Account
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  email: z.string().email("Invalid email address"),
  phone: z.string().optional(),
  password: z.string().min(6, "Password must be at least 6 characters"),

  // Company details
  pmCompanyName: z.string().optional(),
  pmCompanyAddressLine1: z.string().optional(),
  pmCompanyAddressLine2: z.string().optional(),
  pmCompanyPhone: z.string().optional(),
  pmCompanyEmail: z.string().optional(),
  pmCompanyVatNumber: z.string().optional(),
  pmCompanyBankName: z.string().optional(),
  pmCompanyBankAccountName: z.string().optional(),
  pmCompanyBankAccountNumber: z.string().optional(),
  pmCompanyBankBranchCode: z.string().optional(),

  // Branding
  pmBrandPrimaryColor: z.string().optional(),
  pmBrandSecondaryColor: z.string().optional(),
  pmBrandAccentColor: z.string().optional(),
});

export const createPropertyManager = baseProcedure
  .input(createPropertyManagerSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Admin users can create Property Managers",
      });
    }

    const existingUser = await db.user.findUnique({
      where: { email: input.email },
      select: { id: true },
    });

    if (existingUser) {
      throw new TRPCError({
        code: "CONFLICT",
        message: "A user with this email already exists",
      });
    }

    const hashedPassword = await bcryptjs.hash(input.password, 10);

    const created = await db.user.create({
      data: {
        email: input.email,
        password: hashedPassword,
        firstName: input.firstName,
        lastName: input.lastName,
        phone: input.phone,
        role: "PROPERTY_MANAGER",

        pmCompanyName: input.pmCompanyName,
        pmCompanyAddressLine1: input.pmCompanyAddressLine1,
        pmCompanyAddressLine2: input.pmCompanyAddressLine2,
        pmCompanyPhone: input.pmCompanyPhone,
        pmCompanyEmail: input.pmCompanyEmail,
        pmCompanyVatNumber: input.pmCompanyVatNumber,
        pmCompanyBankName: input.pmCompanyBankName,
        pmCompanyBankAccountName: input.pmCompanyBankAccountName,
        pmCompanyBankAccountNumber: input.pmCompanyBankAccountNumber,
        pmCompanyBankBranchCode: input.pmCompanyBankBranchCode,

        pmBrandPrimaryColor: input.pmBrandPrimaryColor,
        pmBrandSecondaryColor: input.pmBrandSecondaryColor,
        pmBrandAccentColor: input.pmBrandAccentColor,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        pmCompanyName: true,
      },
    });

    return {
      success: true,
      propertyManager: created,
      message: "Property Manager created successfully",
    };
  });
