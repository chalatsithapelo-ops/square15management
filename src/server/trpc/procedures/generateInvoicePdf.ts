import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";

export const generateInvoicePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const { userId } = z.object({ userId: z.number() }).parse(verified as any);

      const requestingUser = await db.user.findUnique({
        where: { id: userId },
        select: { id: true, role: true, email: true },
      });

      if (!requestingUser) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      const invoice = await db.invoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          order: {
            select: {
              orderNumber: true,
            },
          },
          project: {
            select: {
              name: true,
              projectNumber: true,
            },
          },
          createdBy: {
            select: {
              id: true,
              role: true,
              contractorCompanyName: true,
              contractorCompanyAddressLine1: true,
              contractorCompanyAddressLine2: true,
              contractorCompanyPhone: true,
              contractorCompanyEmail: true,
              contractorCompanyVatNumber: true,
              contractorCompanyBankName: true,
              contractorCompanyBankAccountName: true,
              contractorCompanyBankAccountNumber: true,
              contractorCompanyBankBranchCode: true,
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
              pmCompanyEmail: true,
              pmCompanyVatNumber: true,
              pmCompanyBankName: true,
              pmCompanyBankAccountName: true,
              pmCompanyBankAccountNumber: true,
              pmCompanyBankBranchCode: true,
            },
          },
        },
      });

      if (!invoice) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Invoice not found",
        });
      }

      const isAdminPortalUser =
        requestingUser.role === "ADMIN" ||
        requestingUser.role === "SENIOR_ADMIN" ||
        requestingUser.role === "JUNIOR_ADMIN";

      // Only allow export of sent/overdue/paid invoices for non-admin users.
      if (!isAdminPortalUser && !["SENT", "OVERDUE", "PAID"].includes(invoice.status)) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only sent, overdue, or paid invoices can be exported",
        });
      }

      // Determine if this is a contractor or property manager invoice
      const isContractorInvoice = invoice.createdBy && 
        (invoice.createdBy.role === "CONTRACTOR" || 
         invoice.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" || 
         invoice.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER");

      // Get company details based on who created the invoice
      let companyDetails;
      if (isContractorInvoice && invoice.createdBy) {
        // First try to use the user's saved company details
        if (invoice.createdBy.contractorCompanyName) {
          companyDetails = {
            companyName: invoice.createdBy.contractorCompanyName || "Your Company Name",
            companyAddressLine1: invoice.createdBy.contractorCompanyAddressLine1 || "Your Address Line 1",
            companyAddressLine2: invoice.createdBy.contractorCompanyAddressLine2 || "Your City, Country",
            companyPhone: invoice.createdBy.contractorCompanyPhone || "+27-XX-XXX-XXXX",
            companyEmail: invoice.createdBy.contractorCompanyEmail || "info@yourcompany.com",
            companyVatNumber: invoice.createdBy.contractorCompanyVatNumber || "ZAXXXXXXXXXX",
            companyBankName: invoice.createdBy.contractorCompanyBankName || "Bank Name",
            companyBankAccountName: invoice.createdBy.contractorCompanyBankAccountName || "Your Company Account Name",
            companyBankAccountNumber: invoice.createdBy.contractorCompanyBankAccountNumber || "XXXXXXXXXX",
            companyBankBranchCode: invoice.createdBy.contractorCompanyBankBranchCode || "123456",
          };
        } else {
          // Fallback to SystemSettings with contractor_ prefix
          const contractorSettings = await db.systemSettings.findMany({
            where: {
              key: {
                in: [
                  "contractor_company_name",
                  "contractor_company_address_line1",
                  "contractor_company_address_line2",
                  "contractor_company_phone",
                  "contractor_company_email",
                  "contractor_company_vat_number",
                  "contractor_company_bank_name",
                  "contractor_company_bank_account_name",
                  "contractor_company_bank_account_number",
                  "contractor_company_bank_branch_code",
                ],
              },
            },
          });

          const settingsMap = contractorSettings.reduce((acc, setting) => {
            if (setting.value) {
              acc[setting.key] = setting.value;
            }
            return acc;
          }, {} as Record<string, string>);

          companyDetails = {
            companyName: settingsMap.contractor_company_name || "Your Company Name",
            companyAddressLine1: settingsMap.contractor_company_address_line1 || "Your Address Line 1",
            companyAddressLine2: settingsMap.contractor_company_address_line2 || "Your City, Country",
            companyPhone: settingsMap.contractor_company_phone || "+27-XX-XXX-XXXX",
            companyEmail: settingsMap.contractor_company_email || "info@yourcompany.com",
            companyVatNumber: settingsMap.contractor_company_vat_number || "ZAXXXXXXXXXX",
            companyBankName: settingsMap.contractor_company_bank_name || "Bank Name",
            companyBankAccountName: settingsMap.contractor_company_bank_account_name || "Your Company Account Name",
            companyBankAccountNumber: settingsMap.contractor_company_bank_account_number || "XXXXXXXXXX",
            companyBankBranchCode: settingsMap.contractor_company_bank_branch_code || "123456",
          };
        }
      } else if (invoice.createdBy) {
        // Property Manager invoice
        companyDetails = {
          companyName: invoice.createdBy.pmCompanyName || "Your Company Name",
          companyAddressLine1: invoice.createdBy.pmCompanyAddressLine1 || "Your Address Line 1",
          companyAddressLine2: invoice.createdBy.pmCompanyAddressLine2 || "Your City, Country",
          companyPhone: invoice.createdBy.pmCompanyPhone || "+27-XX-XXX-XXXX",
          companyEmail: invoice.createdBy.pmCompanyEmail || "info@yourcompany.com",
          companyVatNumber: invoice.createdBy.pmCompanyVatNumber || "ZAXXXXXXXXXX",
          companyBankName: invoice.createdBy.pmCompanyBankName || "Bank Name",
          companyBankAccountName: invoice.createdBy.pmCompanyBankAccountName || "Your Company Account Name",
          companyBankAccountNumber: invoice.createdBy.pmCompanyBankAccountNumber || "XXXXXXXXXX",
          companyBankBranchCode: invoice.createdBy.pmCompanyBankBranchCode || "123456",
        };
      } else {
        // Fallback to system defaults
        companyDetails = await getCompanyDetails();
      }

      // Load all async data BEFORE creating the PDF document
      // Use contractor logo for contractor invoices, PM logo for PM invoices
      const logoBuffer = isContractorInvoice 
        ? await getContractorLogo() 
        : await getCompanyLogo();

      // Create PDF document
      const doc = new PDFDocument({ 
        margin: 50,
        size: "A4",
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));

      return new Promise<{ pdf: string }>((resolve, reject) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString("base64");
          resolve({ pdf: pdfBase64 });
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
            .text(`Email: ${companyDetails.companyEmail}`, 320, 98, { align: "right", width: 225 })
            .text(`VAT: ${companyDetails.companyVatNumber}`, 320, 111, { align: "right", width: 225 });

          // ===== INVOICE TITLE AND STATUS =====
          
          doc
            .fontSize(28)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("INVOICE", 50, 170);

          // Status badge with brand colors
          const statusColor = invoice.status === "PAID" 
            ? env.BRAND_SUCCESS_COLOR 
            : invoice.status === "OVERDUE" 
            ? env.BRAND_DANGER_COLOR 
            : env.BRAND_WARNING_COLOR;
          const statusBg = invoice.status === "PAID"
            ? "#d1fae5"
            : invoice.status === "OVERDUE"
            ? "#fee2e2"
            : "#fef3c7";
          const statusText = invoice.status === "PAID" 
            ? "PAID" 
            : invoice.status === "OVERDUE" 
            ? "OVERDUE" 
            : "OUTSTANDING";
          
          // Status badge background
          doc.rect(470, 172, 75, 20).fill(statusBg);
          doc
            .fontSize(10)
            .fillColor(statusColor)
            .font("Helvetica-Bold")
            .text(statusText, 470, 177, { width: 75, align: "center" });

          // Invoice details
          doc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text(`Invoice No: ${invoice.invoiceNumber}`, 50, 210)
            .text(`Date: ${new Date(invoice.createdAt).toLocaleDateString("en-ZA")}`, 50, 225);

          // Order Number - displayed prominently
          let nextLineY = 240;
          if (invoice.order) {
            doc.fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text(`Order No: ${invoice.order.orderNumber}`, 50, nextLineY);
            nextLineY += 15;
          }

          if (invoice.dueDate) {
            const isOverdue = invoice.status === "OVERDUE";
            doc.fillColor(isOverdue ? env.BRAND_DANGER_COLOR : "#666666")
              .font("Helvetica")
              .text(`Due Date: ${new Date(invoice.dueDate).toLocaleDateString("en-ZA")}`, 50, nextLineY);
            nextLineY += 15;
          }

          if (invoice.paidDate) {
            doc.fillColor(env.BRAND_SUCCESS_COLOR)
              .font("Helvetica")
              .text(`Paid Date: ${new Date(invoice.paidDate).toLocaleDateString("en-ZA")}`, 50, nextLineY);
            nextLineY += 15;
          }

          // Related project reference (if applicable)
          if (invoice.project) {
            doc.fillColor(env.BRAND_ACCENT_COLOR)
              .font("Helvetica-Oblique")
              .text(`Project: ${invoice.project.projectNumber}`, 50, nextLineY);
          }

          // ===== CUSTOMER DETAILS BOX =====
          
          const customerBoxTop = 305;
          
          // Box with accent color border
          doc
            .rect(50, customerBoxTop, 240, 110)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          
          // Light background
          doc.rect(51, customerBoxTop + 1, 238, 108).fill("#f9fafb");

          // Header with accent color
          doc
            .rect(50, customerBoxTop, 240, 28)
            .fill(env.BRAND_ACCENT_COLOR);
          
          doc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("BILL TO", 60, customerBoxTop + 8);

          // Customer information
          doc
            .fontSize(10)
            .fillColor("#1a1a1a")
            .font("Helvetica-Bold")
            .text(invoice.customerName, 60, customerBoxTop + 38, { width: 220 })
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#333333")
            .text(invoice.address, 60, customerBoxTop + 53, { width: 220 })
            .text(invoice.customerEmail, 60, customerBoxTop + 73, { width: 220 })
            .text(invoice.customerPhone, 60, customerBoxTop + 88, { width: 220 });

          // ===== LINE ITEMS TABLE =====
          
          const tableTop = 440;

          // Table header with gradient effect
          doc.rect(50, tableTop, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
          doc.rect(50, tableTop + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

          doc
            .fontSize(9)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("DESCRIPTION", 60, tableTop + 7, { width: 220 })
            .text("UoM", 290, tableTop + 7, { width: 40, align: "center" })
            .text("QTY", 340, tableTop + 7, { width: 40, align: "right" })
            .text("UNIT PRICE", 390, tableTop + 7, { width: 60, align: "right" })
            .text("AMOUNT", 460, tableTop + 7, { width: 75, align: "right" });

          // Line items with enhanced styling
          const items = Array.isArray(invoice.items) ? invoice.items : [];
          let yPosition = tableTop + 35;

          items.forEach((item: any, index: number) => {
            // Alternate row colors with subtle branding
            if (index % 2 === 0) {
              doc.rect(50, yPosition - 5, 495, 20).fill("#f9fafb");
            } else {
              doc.rect(50, yPosition - 5, 495, 20).fill("#ffffff");
            }

            doc
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(item.description, 60, yPosition, { width: 220 })
              .text(item.unitOfMeasure || "Sum", 290, yPosition, { width: 40, align: "center" })
              .text(item.quantity.toString(), 340, yPosition, { width: 40, align: "right" })
              .text(`R${item.unitPrice.toFixed(2)}`, 390, yPosition, { width: 60, align: "right" })
              .font("Helvetica-Bold")
              .text(`R${item.total.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

            yPosition += 20;
          });

          // ===== TOTALS SECTION =====
          
          yPosition += 20;
          const totalsX = 380;

          doc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Subtotal:", totalsX, yPosition, { width: 70, align: "right" })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${invoice.subtotal.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

          yPosition += 20;
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("VAT (15%):", totalsX, yPosition, { width: 70, align: "right" })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${invoice.tax.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

          yPosition += 20;
          // Total with brand banner
          doc.rect(380, yPosition - 5, 165, 28).fill(env.BRAND_PRIMARY_COLOR);
          doc.rect(380, yPosition + 20, 165, 3).fill(env.BRAND_SECONDARY_COLOR);
          
          doc
            .fontSize(12)
            .fillColor("#ffffff")
            .font("Helvetica")
            .text("TOTAL DUE:", totalsX, yPosition + 3, { width: 70, align: "right" })
            .font("Helvetica-Bold")
            .text(`R${invoice.total.toFixed(2)}`, 460, yPosition + 3, { width: 75, align: "right" });

          // ===== PAYMENT DETAILS BOX =====
          
          yPosition += 50;

          // Box with accent border
          doc
            .rect(50, yPosition, 495, 120)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          
          doc.rect(51, yPosition + 1, 493, 118).fill("#f9fafb");

          // Header
          doc.rect(50, yPosition, 495, 35).fill(env.BRAND_ACCENT_COLOR);
          doc
            .fontSize(12)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("PAYMENT DETAILS", 60, yPosition + 11);

          yPosition += 45;

          // Banking information
          const bankingDetails = [
            { label: "Bank Name:", value: companyDetails.companyBankName },
            { label: "Account Name:", value: companyDetails.companyBankAccountName },
            { label: "Account Number:", value: companyDetails.companyBankAccountNumber },
            { label: "Branch Code:", value: companyDetails.companyBankBranchCode },
            { label: "Reference:", value: invoice.invoiceNumber },
          ];

          bankingDetails.forEach((detail) => {
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text(detail.label, 60, yPosition, { width: 150 })
              .fillColor("#1a1a1a")
              .font("Helvetica-Bold")
              .text(detail.value, 210, yPosition, { width: 325 });
            yPosition += 16;
          });

          // ===== NOTES SECTION =====
          
          if (invoice.notes) {
            yPosition += 25;
            
            doc
              .fontSize(11)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("NOTES", 50, yPosition);
            
            yPosition += 20;
            doc
              .fontSize(9)
              .fillColor("#666666")
              .font("Helvetica")
              .text(invoice.notes, 50, yPosition, { width: 495, align: "justify" });
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
              "Thank you for your business!",
              50,
              778,
              { align: "center", width: 495 }
            )
            .text(
              `${companyDetails.companyName} | ${companyDetails.companyEmail} | VAT Reg: ${companyDetails.companyVatNumber}`,
              50,
              788,
              { align: "center", width: 495 }
            );

          doc.end();
        } catch (error) {
          console.error("Error generating invoice PDF:", error);
          reject(error);
        }
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
