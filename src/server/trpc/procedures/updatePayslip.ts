import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const updatePayslip = baseProcedure
  .input(
    z.object({
      token: z.string(),
      payslipId: z.number(),
      // Earnings
      basicSalary: z.number().optional(),
      overtime: z.number().optional(),
      bonus: z.number().optional(),
      allowances: z.number().optional(),
      commission: z.number().optional(),
      otherEarnings: z.number().optional(),
      // Deductions
      incomeTax: z.number().optional(),
      uif: z.number().optional(),
      pensionFund: z.number().optional(),
      medicalAid: z.number().optional(),
      otherDeductions: z.number().optional(),
      // Additional details
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      taxReferenceNumber: z.string().optional(),
      uifReferenceNumber: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_PAYSLIPS);

    // Fetch existing payslip
    const existingPayslip = await db.payslip.findUnique({
      where: { id: input.payslipId },
    });

    if (!existingPayslip) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payslip not found",
      });
    }

    // Calculate totals
    const basicSalary = input.basicSalary ?? existingPayslip.basicSalary;
    const overtime = input.overtime ?? existingPayslip.overtime;
    const bonus = input.bonus ?? existingPayslip.bonus;
    const allowances = input.allowances ?? existingPayslip.allowances;
    const commission = input.commission ?? existingPayslip.commission;
    const otherEarnings = input.otherEarnings ?? existingPayslip.otherEarnings;
    
    const grossPay = basicSalary + overtime + bonus + allowances + commission + otherEarnings;
    
    const incomeTax = input.incomeTax ?? existingPayslip.incomeTax;
    const uif = input.uif ?? existingPayslip.uif;
    const pensionFund = input.pensionFund ?? existingPayslip.pensionFund;
    const medicalAid = input.medicalAid ?? existingPayslip.medicalAid;
    const otherDeductions = input.otherDeductions ?? existingPayslip.otherDeductions;
    
    const totalDeductions = incomeTax + uif + pensionFund + medicalAid + otherDeductions;
    const netPay = grossPay - totalDeductions;

    // Update payslip
    const updatedPayslip = await db.payslip.update({
      where: { id: input.payslipId },
      data: {
        basicSalary,
        overtime,
        bonus,
        allowances,
        commission,
        otherEarnings,
        grossPay,
        incomeTax,
        uif,
        pensionFund,
        medicalAid,
        otherDeductions,
        totalDeductions,
        netPay,
        hoursWorked: input.hoursWorked,
        daysWorked: input.daysWorked,
        hourlyRate: input.hourlyRate,
        dailyRate: input.dailyRate,
        taxReferenceNumber: input.taxReferenceNumber,
        uifReferenceNumber: input.uifReferenceNumber,
        notes: input.notes,
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    return updatedPayslip;
  });
