import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { generatePayslipPdf as generatePdf } from "~/server/utils/payslip-pdf";

export const generatePayslipPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      payslipId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const payslip = await db.payslip.findUnique({
      where: { id: input.payslipId },
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

    if (!payslip) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Payslip not found",
      });
    }

    // Check permissions: employee can view their own, admin can view all
    // Use explicit admin check to bypass potential permission configuration issues
    if (!isAdmin(user) && payslip.employeeId !== user.id) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You can only view your own payslips",
      });
    }

    // Update viewed status if employee is viewing their own payslip
    if (payslip.employeeId === user.id && payslip.status !== "VIEWED") {
      await db.payslip.update({
        where: { id: input.payslipId },
        data: {
          status: "VIEWED",
          viewedDate: new Date(),
        },
      });
    }

    // Generate PDF
    const pdfBuffer = await generatePdf({
      payslipNumber: payslip.payslipNumber,
      employee: payslip.employee,
      payPeriodStart: payslip.payPeriodStart,
      payPeriodEnd: payslip.payPeriodEnd,
      paymentDate: payslip.paymentDate,
      basicSalary: payslip.basicSalary,
      overtime: payslip.overtime,
      bonus: payslip.bonus,
      allowances: payslip.allowances,
      commission: payslip.commission,
      otherEarnings: payslip.otherEarnings,
      grossPay: payslip.grossPay,
      incomeTax: payslip.incomeTax,
      uif: payslip.uif,
      pensionFund: payslip.pensionFund,
      medicalAid: payslip.medicalAid,
      otherDeductions: payslip.otherDeductions,
      totalDeductions: payslip.totalDeductions,
      netPay: payslip.netPay,
      hoursWorked: payslip.hoursWorked || undefined,
      daysWorked: payslip.daysWorked || undefined,
      hourlyRate: payslip.hourlyRate || undefined,
      dailyRate: payslip.dailyRate || undefined,
      taxReferenceNumber: payslip.taxReferenceNumber || undefined,
      uifReferenceNumber: payslip.uifReferenceNumber || undefined,
      notes: payslip.notes || undefined,
    });

    const pdfBase64 = pdfBuffer.toString("base64");
    return { pdf: pdfBase64 };
  });
