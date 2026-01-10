import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const createPayslip = baseProcedure
  .input(
    z.object({
      token: z.string(),
      employeeId: z.number(),
      payPeriodStart: z.string(),
      payPeriodEnd: z.string(),
      paymentDate: z.string().optional(), // Made optional - defaults to payPeriodEnd
      // Optional earnings fields - if not provided, will calculate from employee's monthlySalary
      basicSalary: z.number().optional(),
      overtime: z.number().optional(),
      bonus: z.number().optional(),
      allowances: z.number().optional(),
      commission: z.number().optional(),
      otherEarnings: z.number().optional(),
      // Optional deduction overrides
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

    // Fetch employee details
    const employee = await db.user.findUnique({
      where: { id: input.employeeId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        email: true,
        role: true,
        monthlySalary: true,
        hourlyRate: true,
        dailyRate: true,
      },
    });

    if (!employee) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Employee not found",
      });
    }

    // Generate unique payslip number
    const payslipCount = await db.payslip.count();
    const payslipNumber = `PS-${String(payslipCount + 1).padStart(6, "0")}`;

    // Set payment date to pay period end if not provided
    const paymentDate = input.paymentDate ? new Date(input.paymentDate) : new Date(input.payPeriodEnd);

    // Calculate earnings
    // Priority: 1) input.basicSalary, 2) employee.monthlySalary, 3) calculate from hours/days worked, 4) default to 0
    let basicSalary = input.basicSalary;
    let calculationNote = "";
    
    if (basicSalary === undefined) {
      if (employee.monthlySalary && employee.monthlySalary > 0) {
        // Use employee's monthly salary
        basicSalary = employee.monthlySalary;
      } else if (input.hoursWorked && (input.hourlyRate || employee.hourlyRate)) {
        // Calculate from hours worked
        const rate = input.hourlyRate ?? employee.hourlyRate ?? 0;
        basicSalary = input.hoursWorked * rate;
        calculationNote = `Calculated from ${input.hoursWorked} hours @ R${rate.toFixed(2)}/hour`;
      } else if (input.daysWorked && (input.dailyRate || employee.dailyRate)) {
        // Calculate from days worked
        const rate = input.dailyRate ?? employee.dailyRate ?? 0;
        basicSalary = input.daysWorked * rate;
        calculationNote = `Calculated from ${input.daysWorked} days @ R${rate.toFixed(2)}/day`;
      } else {
        // Fallback: Check for paid payment requests within the pay period for dynamic earnings
        const paidPaymentRequests = await db.paymentRequest.findMany({
          where: {
            artisanId: employee.id, 
            status: "PAID",
            paidDate: {
              gte: new Date(input.payPeriodStart),
              lte: new Date(input.payPeriodEnd),
            },
          },
          select: {
            calculatedAmount: true,
            requestNumber: true,
          },
        });
        
        if (paidPaymentRequests.length > 0) {
            basicSalary = paidPaymentRequests.reduce(
                (sum, pr) => sum + pr.calculatedAmount,
                0
            );
            calculationNote = `Earnings calculated from ${paidPaymentRequests.length} paid payment request(s): ${paidPaymentRequests.map(pr => pr.requestNumber).join(", ")}`;
        } else {
            // No salary, rates, or paid payment requests found
            basicSalary = 0;
            calculationNote = "No salary information available and no paid payment requests found for this period. Please update payslip manually with actual earnings.";
        }
      }
    }
    
    const overtime = input.overtime ?? 0;
    const bonus = input.bonus ?? 0;
    const allowances = input.allowances ?? 0;
    const commission = input.commission ?? 0;
    const otherEarnings = input.otherEarnings ?? 0;

    const grossPay = basicSalary + overtime + bonus + allowances + commission + otherEarnings;

    // Calculate deductions using South African tax rules
    // PAYE (Income Tax): 15% of gross pay as a simple estimate
    // UIF: 1% of gross pay, capped at R177.12 per month
    const calculatedIncomeTax = grossPay * 0.15;
    const calculatedUif = Math.min(grossPay * 0.01, 177.12);

    const incomeTax = input.incomeTax ?? calculatedIncomeTax;
    const uif = input.uif ?? calculatedUif;
    const pensionFund = input.pensionFund ?? 0;
    const medicalAid = input.medicalAid ?? 0;
    const otherDeductions = input.otherDeductions ?? 0;

    const totalDeductions = incomeTax + uif + pensionFund + medicalAid + otherDeductions;
    const netPay = grossPay - totalDeductions;

    // Combine calculation note with user notes if both exist
    const finalNotes = calculationNote 
      ? (input.notes ? `${calculationNote}\n${input.notes}` : calculationNote)
      : input.notes;

    // Create payslip
    const payslip = await db.payslip.create({
      data: {
        payslipNumber,
        employeeId: input.employeeId,
        payPeriodStart: new Date(input.payPeriodStart),
        payPeriodEnd: new Date(input.payPeriodEnd),
        paymentDate, // Use the calculated paymentDate
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
        hourlyRate: input.hourlyRate ?? employee.hourlyRate ?? undefined,
        dailyRate: input.dailyRate ?? employee.dailyRate ?? undefined,
        taxReferenceNumber: input.taxReferenceNumber,
        uifReferenceNumber: input.uifReferenceNumber,
        notes: finalNotes,
        status: "GENERATED",
      },
      include: {
        employee: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    });

    return payslip;
  });
