import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

interface PayslipData {
  payslipNumber: string;
  employee: {
    firstName: string;
    lastName: string;
    email: string;
    role: string;
  };
  payPeriodStart: Date;
  payPeriodEnd: Date;
  paymentDate: Date;
  // Earnings
  basicSalary: number;
  overtime: number;
  bonus: number;
  allowances: number;
  commission: number;
  otherEarnings: number;
  grossPay: number;
  // Deductions
  incomeTax: number;
  uif: number;
  pensionFund: number;
  medicalAid: number;
  otherDeductions: number;
  totalDeductions: number;
  // Net Pay
  netPay: number;
  // Additional Details
  hoursWorked?: number;
  daysWorked?: number;
  hourlyRate?: number;
  dailyRate?: number;
  taxReferenceNumber?: string;
  uifReferenceNumber?: string;
  notes?: string;
}

export async function generatePayslipPdf(payslipData: PayslipData): Promise<Buffer> {
  // Load all async data BEFORE creating the PDF document
  const companyDetails = await getCompanyDetails();
  const logoBuffer = await getCompanyLogo();

  const doc = new PDFDocument({ 
    margin: 50,
    size: "A4",
  });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });

    doc.on("error", reject);

    try {
      // ===== HEADER SECTION WITH BRAND BANNER =====
      
      // Brand banner at the top (primary color with secondary accent)
      doc.rect(0, 0, 595, 140).fill(env.BRAND_PRIMARY_COLOR);
      
      // Secondary color accent strip
      doc.rect(0, 135, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

      // Add company logo on the banner
      if (logoBuffer) {
        try {
          // Add a solid white background circle behind the logo for better visibility
          doc.circle(100, 70, 45).fill("#ffffff").opacity(1);
          doc.image(logoBuffer, 55, 25, { width: 90 });
        } catch (error) {
          console.error("Error adding logo to PDF:", error);
          // Continue without logo rather than failing
        }
      }

      // Company details on the banner (right side, white text)
      doc
        .fontSize(11)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text(companyDetails.companyName, 320, 35, { align: "right", width: 225 })
        .font("Helvetica")
        .fontSize(9)
        .text(companyDetails.companyAddressLine1, 320, 52, { align: "right", width: 225 })
        .text(companyDetails.companyAddressLine2, 320, 65, { align: "right", width: 225 })
        .text(`Tel: ${companyDetails.companyPhone}`, 320, 85, { align: "right", width: 225 })
        .text(`Email: ${companyDetails.companyEmail}`, 320, 98, { align: "right", width: 225 });

      // ===== PAYSLIP TITLE =====
      
      doc
        .fontSize(28)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("PAY SLIP", 50, 170);

      // Payslip details
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text(`Payslip No: ${payslipData.payslipNumber}`, 50, 210)
        .text(`Pay Period: ${new Date(payslipData.payPeriodStart).toLocaleDateString("en-ZA")} - ${new Date(payslipData.payPeriodEnd).toLocaleDateString("en-ZA")}`, 50, 225)
        .text(`Payment Date: ${new Date(payslipData.paymentDate).toLocaleDateString("en-ZA")}`, 50, 240);

      // ===== EMPLOYEE DETAILS BOX =====
      
      const employeeBoxTop = 270;
      
      // Box with accent color border
      doc
        .rect(50, employeeBoxTop, 495, 90)
        .lineWidth(2)
        .strokeColor(env.BRAND_ACCENT_COLOR)
        .stroke();
      
      // Light background
      doc.rect(51, employeeBoxTop + 1, 493, 88).fill("#f9fafb");

      // Header with accent color
      doc
        .rect(50, employeeBoxTop, 495, 28)
        .fill(env.BRAND_ACCENT_COLOR);
      
      doc
        .fontSize(11)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("EMPLOYEE INFORMATION", 60, employeeBoxTop + 8);

      // Employee information in two columns
      doc
        .fontSize(10)
        .fillColor("#1a1a1a")
        .font("Helvetica-Bold")
        .text("Name:", 60, employeeBoxTop + 40)
        .font("Helvetica")
        .fillColor("#333333")
        .text(`${payslipData.employee.firstName} ${payslipData.employee.lastName}`, 150, employeeBoxTop + 40)
        
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("Email:", 60, employeeBoxTop + 57)
        .font("Helvetica")
        .fillColor("#333333")
        .text(payslipData.employee.email, 150, employeeBoxTop + 57)
        
        .font("Helvetica-Bold")
        .fillColor("#1a1a1a")
        .text("Position:", 320, employeeBoxTop + 40)
        .font("Helvetica")
        .fillColor("#333333")
        .text(payslipData.employee.role, 400, employeeBoxTop + 40);

      // Tax reference numbers if available
      if (payslipData.taxReferenceNumber || payslipData.uifReferenceNumber) {
        let refY = employeeBoxTop + 57;
        if (payslipData.taxReferenceNumber) {
          doc
            .font("Helvetica-Bold")
            .fillColor("#1a1a1a")
            .text("Tax Ref:", 320, refY)
            .font("Helvetica")
            .fillColor("#333333")
            .text(payslipData.taxReferenceNumber, 400, refY);
        }
      }

      // ===== EARNINGS SECTION =====
      
      let currentY = 390;

      // Earnings header
      doc
        .fontSize(12)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("EARNINGS", 50, currentY);
      
      currentY += 25;

      // Earnings table header
      doc.rect(50, currentY, 240, 22).fill(env.BRAND_PRIMARY_COLOR);
      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 60, currentY + 6)
        .text("AMOUNT", 230, currentY + 6, { width: 50, align: "right" });

      currentY += 22;

      // Earnings items
      const earnings = [
        { label: "Basic Salary", amount: payslipData.basicSalary },
        { label: "Overtime", amount: payslipData.overtime },
        { label: "Bonus", amount: payslipData.bonus },
        { label: "Allowances", amount: payslipData.allowances },
        { label: "Commission", amount: payslipData.commission },
        { label: "Other Earnings", amount: payslipData.otherEarnings },
      ];

      earnings.forEach((item, index) => {
        if (item.amount > 0) {
          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(50, currentY, 240, 18).fill("#f9fafb");
          } else {
            doc.rect(50, currentY, 240, 18).fill("#ffffff");
          }

          doc
            .fontSize(9)
            .fillColor("#333333")
            .font("Helvetica")
            .text(item.label, 60, currentY + 4)
            .text(`R${item.amount.toFixed(2)}`, 230, currentY + 4, { width: 50, align: "right" });

          currentY += 18;
        }
      });

      // Gross Pay total
      doc.rect(50, currentY, 240, 25).fill(env.BRAND_SUCCESS_COLOR);
      doc
        .fontSize(10)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("GROSS PAY", 60, currentY + 7)
        .text(`R${payslipData.grossPay.toFixed(2)}`, 230, currentY + 7, { width: 50, align: "right" });

      // ===== DEDUCTIONS SECTION =====
      
      let deductionsY = 390;

      // Deductions header
      doc
        .fontSize(12)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("DEDUCTIONS", 305, deductionsY);
      
      deductionsY += 25;

      // Deductions table header
      doc.rect(305, deductionsY, 240, 22).fill(env.BRAND_PRIMARY_COLOR);
      doc
        .fontSize(9)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 315, deductionsY + 6)
        .text("AMOUNT", 485, deductionsY + 6, { width: 50, align: "right" });

      deductionsY += 22;

      // Deductions items
      const deductions = [
        { label: "Income Tax (PAYE)", amount: payslipData.incomeTax },
        { label: "UIF", amount: payslipData.uif },
        { label: "Pension Fund", amount: payslipData.pensionFund },
        { label: "Medical Aid", amount: payslipData.medicalAid },
        { label: "Other Deductions", amount: payslipData.otherDeductions },
      ];

      deductions.forEach((item, index) => {
        if (item.amount > 0) {
          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(305, deductionsY, 240, 18).fill("#f9fafb");
          } else {
            doc.rect(305, deductionsY, 240, 18).fill("#ffffff");
          }

          doc
            .fontSize(9)
            .fillColor("#333333")
            .font("Helvetica")
            .text(item.label, 315, deductionsY + 4)
            .text(`R${item.amount.toFixed(2)}`, 485, deductionsY + 4, { width: 50, align: "right" });

          deductionsY += 18;
        }
      });

      // Total Deductions
      doc.rect(305, deductionsY, 240, 25).fill(env.BRAND_DANGER_COLOR);
      doc
        .fontSize(10)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("TOTAL DEDUCTIONS", 315, deductionsY + 7)
        .text(`R${payslipData.totalDeductions.toFixed(2)}`, 485, deductionsY + 7, { width: 50, align: "right" });

      // ===== NET PAY SECTION =====
      
      currentY = Math.max(currentY, deductionsY) + 35;

      // Net Pay banner
      doc.rect(50, currentY, 495, 40).fill(env.BRAND_PRIMARY_COLOR);
      doc.rect(50, currentY + 35, 495, 5).fill(env.BRAND_SECONDARY_COLOR);
      
      doc
        .fontSize(14)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("NET PAY", 60, currentY + 12)
        .fontSize(18)
        .text(`R${payslipData.netPay.toFixed(2)}`, 485, currentY + 10, { width: 50, align: "right" });

      // ===== ADDITIONAL INFORMATION =====
      
      currentY += 60;

      if (payslipData.hoursWorked || payslipData.daysWorked || payslipData.hourlyRate || payslipData.dailyRate) {
        doc
          .fontSize(11)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("WORK DETAILS", 50, currentY);
        
        currentY += 20;

        doc
          .fontSize(9)
          .fillColor("#666666")
          .font("Helvetica");

        if (payslipData.hoursWorked && payslipData.hourlyRate) {
          doc.text(`Hours Worked: ${payslipData.hoursWorked} hours @ R${payslipData.hourlyRate.toFixed(2)}/hour`, 50, currentY);
          currentY += 15;
        }

        if (payslipData.daysWorked && payslipData.dailyRate) {
          doc.text(`Days Worked: ${payslipData.daysWorked} days @ R${payslipData.dailyRate.toFixed(2)}/day`, 50, currentY);
          currentY += 15;
        }

        currentY += 10;
      }

      // ===== NOTES SECTION =====
      
      if (payslipData.notes) {
        doc
          .fontSize(11)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("NOTES", 50, currentY);
        
        currentY += 20;
        doc
          .fontSize(9)
          .fillColor("#666666")
          .font("Helvetica")
          .text(payslipData.notes, 50, currentY, { width: 495, align: "justify" });
        
        currentY += 30;
      }

      // ===== FOOTER =====
      
      // Footer separator line
      doc
        .moveTo(50, 770)
        .lineTo(545, 770)
        .strokeColor(env.BRAND_ACCENT_COLOR)
        .lineWidth(1)
        .stroke();

      doc
        .fontSize(8)
        .fillColor("#999999")
        .font("Helvetica")
        .text(
          "This is a computer-generated payslip and does not require a signature.",
          50,
          778,
          { align: "center", width: 495 }
        )
        .text(
          `${companyDetails.companyName} | ${companyDetails.companyEmail}`,
          50,
          788,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (error) {
      console.error("Error generating payslip PDF:", error);
      reject(error);
    }
  });
}
