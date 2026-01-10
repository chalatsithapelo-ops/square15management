import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updatePaymentRequestStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      paymentRequestId: z.number(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]),
      rejectionReason: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const updateData: any = {
        status: input.status,
        rejectionReason: input.rejectionReason || null,
      };

      if (input.status === "APPROVED") {
        updateData.approvedDate = new Date();
      }

      if (input.status === "PAID") {
        updateData.paidDate = new Date();
      }

      const paymentRequest = await db.paymentRequest.update({
        where: { id: input.paymentRequestId },
        data: updateData,
        include: {
          artisan: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              hourlyRate: true,
              dailyRate: true,
            },
          },
        },
      });

      // Auto-create payslip when payment is marked as PAID
      if (input.status === "PAID") {
        const paidDate = new Date();
        const year = paidDate.getFullYear();
        const month = String(paidDate.getMonth() + 1).padStart(2, '0');
        
        // Generate unique payslip number
        const lastPayslip = await db.payslip.findFirst({
          where: {
            payslipNumber: {
              startsWith: `PS-${year}-${month}-`,
            },
          },
          orderBy: {
            payslipNumber: 'desc',
          },
        });
        
        let sequenceNumber = 1;
        if (lastPayslip) {
          const lastSequence = parseInt(lastPayslip.payslipNumber.split('-').pop() || '0');
          sequenceNumber = lastSequence + 1;
        }
        
        const payslipNumber = `PS-${year}-${month}-${String(sequenceNumber).padStart(5, '0')}`;
        
        // Calculate pay period (assume current month)
        const payPeriodStart = new Date(paidDate.getFullYear(), paidDate.getMonth(), 1);
        const payPeriodEnd = new Date(paidDate.getFullYear(), paidDate.getMonth() + 1, 0);
        
        // Calculate earnings breakdown
        const grossPay = paymentRequest.calculatedAmount;
        
        // Basic tax calculations (South African rates - simplified)
        // PAYE: Approximately 15% for lower income brackets
        // UIF: 1% of gross pay (capped at R177.12 per month)
        const incomeTax = grossPay * 0.15;
        const uif = Math.min(grossPay * 0.01, 177.12);
        
        const totalDeductions = incomeTax + uif;
        const netPay = grossPay - totalDeductions;
        
        // Create payslip
        await db.payslip.create({
          data: {
            payslipNumber,
            employeeId: paymentRequest.artisanId,
            paymentRequestId: paymentRequest.id,
            payPeriodStart,
            payPeriodEnd,
            paymentDate: paidDate,
            // Earnings
            basicSalary: grossPay, // All earnings go into basic salary for now
            overtime: 0,
            bonus: 0,
            allowances: 0,
            commission: 0,
            otherEarnings: 0,
            grossPay,
            // Deductions
            incomeTax,
            uif,
            pensionFund: 0,
            medicalAid: 0,
            otherDeductions: 0,
            totalDeductions,
            // Net Pay
            netPay,
            // Work details from payment request
            hoursWorked: paymentRequest.hoursWorked || undefined,
            daysWorked: paymentRequest.daysWorked || undefined,
            hourlyRate: paymentRequest.hourlyRate || undefined,
            dailyRate: paymentRequest.dailyRate || undefined,
            // Notes
            notes: paymentRequest.notes || undefined,
            status: "GENERATED",
          },
        });
      }

      return paymentRequest;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
