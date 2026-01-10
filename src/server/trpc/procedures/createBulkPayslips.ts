import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const createBulkPayslips = baseProcedure
  .input(
    z.object({
      token: z.string(),
      payPeriodStart: z.string(),
      payPeriodEnd: z.string(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requirePermission(user, PERMISSIONS.MANAGE_PAYSLIPS);

    // Fetch all employees
    const employees = await db.user.findMany({
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
      orderBy: [
        { role: "asc" },
        { firstName: "asc" },
      ],
    });

    if (employees.length === 0) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "No employees found",
      });
    }

    // Set payment date to pay period end
    const paymentDate = new Date(input.payPeriodEnd);
    const payPeriodStart = new Date(input.payPeriodStart);
    const payPeriodEnd = new Date(input.payPeriodEnd);

    const results = {
      totalEmployees: employees.length,
      successCount: 0,
      failedCount: 0,
      needsManualCalculation: 0,
      errors: [] as Array<{ employeeId: number; employeeName: string; error: string }>,
      createdPayslips: [] as Array<{ id: number; payslipNumber: string; employeeName: string; netPay: number; needsManualCalculation: boolean }>,
    };

    // Generate payslip number counter
    const existingPayslipCount = await db.payslip.count();
    let payslipCounter = existingPayslipCount + 1;

    // Generate payslips for each employee
    for (const employee of employees) {
      try {
        const payslipNumber = `PS-${String(payslipCounter).padStart(6, "0")}`;
        payslipCounter++;

        // Calculate earnings
        let basicSalary = 0;
        let calculationNote = "";
        let needsManualCalculation = false;
        
        if (employee.monthlySalary && employee.monthlySalary > 0) {
          // Use employee's monthly salary
          basicSalary = employee.monthlySalary;
        } else {
          // Check for paid payment requests within the pay period
          const paidPaymentRequests = await db.paymentRequest.findMany({
            where: {
              artisanId: employee.id,
              status: "PAID",
              paidDate: {
                gte: payPeriodStart,
                lte: payPeriodEnd,
              },
            },
            select: {
              id: true,
              calculatedAmount: true,
              requestNumber: true,
            },
          });

          if (paidPaymentRequests.length > 0) {
            // Sum up all paid payment requests for the period
            basicSalary = paidPaymentRequests.reduce(
              (sum, pr) => sum + pr.calculatedAmount,
              0
            );
            calculationNote = `Earnings calculated from ${paidPaymentRequests.length} paid payment request(s): ${paidPaymentRequests.map(pr => pr.requestNumber).join(", ")}`;
          } else {
            // No monthly salary and no paid payment requests - create R0 payslip
            basicSalary = 0;
            needsManualCalculation = true;
            calculationNote = `Employee ${employee.firstName} ${employee.lastName} does not have a monthly salary set and has no paid payment requests for this period. `;
            
            if (employee.hourlyRate) {
              calculationNote += `Hourly rate: R${employee.hourlyRate.toFixed(2)}/hour. `;
            }
            if (employee.dailyRate) {
              calculationNote += `Daily rate: R${employee.dailyRate.toFixed(2)}/day. `;
            }
            
            calculationNote += "Please update this payslip with actual hours/days worked and earnings.";
          }
        }
        
        const overtime = 0;
        const bonus = 0;
        const allowances = 0;
        const commission = 0;
        const otherEarnings = 0;

        const grossPay = basicSalary + overtime + bonus + allowances + commission + otherEarnings;

        // Calculate deductions using South African tax rules
        // PAYE (Income Tax): 15% of gross pay as a simple estimate
        // UIF: 1% of gross pay, capped at R177.12 per month
        const incomeTax = grossPay * 0.15;
        const uif = Math.min(grossPay * 0.01, 177.12);
        const pensionFund = 0;
        const medicalAid = 0;
        const otherDeductions = 0;

        const totalDeductions = incomeTax + uif + pensionFund + medicalAid + otherDeductions;
        const netPay = grossPay - totalDeductions;

        // Create payslip
        const payslip = await db.payslip.create({
          data: {
            payslipNumber,
            employeeId: employee.id,
            payPeriodStart,
            payPeriodEnd,
            paymentDate,
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
            hourlyRate: employee.hourlyRate ?? undefined,
            dailyRate: employee.dailyRate ?? undefined,
            notes: calculationNote || undefined,
            status: "GENERATED",
          },
        });

        results.successCount++;
        if (needsManualCalculation) {
          results.needsManualCalculation++;
        }
        results.createdPayslips.push({
          id: payslip.id,
          payslipNumber: payslip.payslipNumber,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          netPay: payslip.netPay,
          needsManualCalculation,
        });
      } catch (error) {
        results.failedCount++;
        results.errors.push({
          employeeId: employee.id,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }
    }

    return results;
  });
