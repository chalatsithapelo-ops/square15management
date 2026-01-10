import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getContractorLogo } from "~/server/utils/logo";

export const generatePropertyManagerInvoicePdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      invoiceId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const payload = z.object({ userId: z.number() }).parse(verified);

      const invoice = await db.propertyManagerInvoice.findUnique({
        where: { id: input.invoiceId },
        include: {
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
            },
          },
          order: {
            select: {
              orderNumber: true,
              contractor: {
                select: {
                  id: true,
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
                },
              },
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

      // Get contractor details (the seller - who is issuing the invoice)
      let contractorDetails;
      if (invoice.order?.contractor) {
        contractorDetails = invoice.order.contractor;
      } else {
        // Fallback to SystemSettings
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

        contractorDetails = {
          contractorCompanyName: settingsMap.contractor_company_name || "Your Company Name",
          contractorCompanyAddressLine1: settingsMap.contractor_company_address_line1 || "",
          contractorCompanyAddressLine2: settingsMap.contractor_company_address_line2 || "",
          contractorCompanyPhone: settingsMap.contractor_company_phone || "",
          contractorCompanyEmail: settingsMap.contractor_company_email || "",
          contractorCompanyVatNumber: settingsMap.contractor_company_vat_number || "",
          contractorCompanyBankName: settingsMap.contractor_company_bank_name || "",
          contractorCompanyBankAccountName: settingsMap.contractor_company_bank_account_name || "",
          contractorCompanyBankAccountNumber: settingsMap.contractor_company_bank_account_number || "",
          contractorCompanyBankBranchCode: settingsMap.contractor_company_bank_branch_code || "",
        };
      }

      // Use Contractor's company details (the seller)
      const companyDetails = {
        companyName: contractorDetails.contractorCompanyName || "Your Company Name",
        companyAddressLine1: contractorDetails.contractorCompanyAddressLine1 || "",
        companyAddressLine2: contractorDetails.contractorCompanyAddressLine2 || "",
        companyPhone: contractorDetails.contractorCompanyPhone || "",
        companyEmail: contractorDetails.contractorCompanyEmail || "",
        companyVatNumber: contractorDetails.contractorCompanyVatNumber || "",
        companyBankName: contractorDetails.contractorCompanyBankName || "",
        companyBankAccountName: contractorDetails.contractorCompanyBankAccountName || "",
        companyBankAccountNumber: contractorDetails.contractorCompanyBankAccountNumber || "",
        companyBankBranchCode: contractorDetails.contractorCompanyBankBranchCode || "",
      };

      const brandColors = {
        primary: env.BRAND_PRIMARY_COLOR,
        secondary: env.BRAND_SECONDARY_COLOR,
        accent: env.BRAND_ACCENT_COLOR,
      };

      // Load logo (use contractor logo)
      const logoBuffer = await getContractorLogo();

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
          
          // Brand banner at the top
          doc.rect(0, 0, 595, 140).fill(brandColors.primary);
          
          // Secondary color accent strip
          doc.rect(0, 135, 595, 5).fill(brandColors.secondary);

          // Add company logo on the banner
          if (logoBuffer) {
            try {
              // Add a solid white background circle behind the logo
              doc.circle(100, 70, 45).fill("#ffffff").opacity(1);
              doc.image(logoBuffer, 55, 25, { width: 90 });
            } catch (error) {
              console.error("Error adding logo to PDF:", error);
            }
          }

          // Company details on the banner (white text)
          doc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text(companyDetails.companyName, 220, 30, { align: "left" });

          doc
            .fontSize(9)
            .font("Helvetica")
            .fillColor("#ffffff")
            .text(companyDetails.companyAddressLine1, 220, 50);
          
          if (companyDetails.companyAddressLine2) {
            doc.text(companyDetails.companyAddressLine2, 220, 64);
          }

          doc.text(`Tel: ${companyDetails.companyPhone}`, 220, companyDetails.companyAddressLine2 ? 78 : 64);
          doc.text(`Email: ${companyDetails.companyEmail}`, 220, companyDetails.companyAddressLine2 ? 92 : 78);

          if (companyDetails.companyVatNumber) {
            doc.text(`VAT: ${companyDetails.companyVatNumber}`, 220, companyDetails.companyAddressLine2 ? 106 : 92);
          }

          // ===== INVOICE TITLE =====
          doc.fontSize(26).fillColor("#1a1a1a").font("Helvetica-Bold")
            .text("TAX INVOICE", 50, 160);

          // Invoice metadata
          doc.fontSize(10).fillColor("#666666").font("Helvetica")
            .text(`Invoice Number: ${invoice.invoiceNumber}`, 50, 195)
            .text(`Date: ${invoice.createdAt.toLocaleDateString("en-ZA")}`, 50, 210)
            .text(`Status: ${invoice.status.replace(/_/g, " ")}`, 50, 225);

          if (invoice.order) {
            doc.text(`Order Number: ${invoice.order.orderNumber}`, 50, 240);
          }

          // ===== BILL TO SECTION =====
          const billToTop = 280;
          
          doc.rect(50, billToTop, 240, 90)
            .lineWidth(2)
            .strokeColor(brandColors.primary)
            .stroke();
          
          doc.rect(50, billToTop, 240, 25)
            .fill(brandColors.primary);
          
          doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
            .text("BILL TO", 60, billToTop + 7);

          // PM invoice is billed to the property manager
          const pmName = invoice.propertyManager 
            ? `${invoice.propertyManager.firstName} ${invoice.propertyManager.lastName}`
            : "Property Manager";
          
          doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
            .text(pmName, 60, billToTop + 35);
          
          if (invoice.propertyManager?.email) {
            doc.fontSize(9).font("Helvetica")
              .text(`Email: ${invoice.propertyManager.email}`, 60, billToTop + 52);
          }

          // ===== INVOICE DETAILS TABLE =====
          const tableTop = 400;
          const col1 = 50;
          const col2 = 200;
          const col3 = 350;
          const col4 = 470;

          // Table header
          doc.rect(col1, tableTop, 495, 25).fill(brandColors.primary);
          
          doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold");
          doc.text("Description", col1 + 10, tableTop + 8);
          doc.text("Quantity", col2 + 10, tableTop + 8);
          doc.text("Unit Price", col3 + 10, tableTop + 8);
          doc.text("Amount", col4 + 10, tableTop + 8);

          // Table content - parse items from JSON
          let yPos = tableTop + 35;
          
          const items = Array.isArray(invoice.items) ? invoice.items as Array<{
            description?: string;
            quantity?: number;
            unitPrice?: number;
            total?: number;
          }> : [];
          for (const item of items) {
            if (!item) continue;
            doc.fontSize(9).fillColor("#1a1a1a").font("Helvetica");
            doc.text(item.description || "Service", col1 + 10, yPos);
            doc.text(String(item.quantity || 1), col2 + 10, yPos);
            doc.text(`R${(item.unitPrice || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col3 + 10, yPos);
            doc.text(`R${(item.total || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col4 + 10, yPos);
            yPos += 20;
          }

          // Subtotal and Total
          yPos += 50;
          doc.rect(col3, yPos, 195, 1).fillAndStroke("#cccccc");
          
          yPos += 15;
          doc.fontSize(10).font("Helvetica");
          doc.text("Subtotal:", col3 + 10, yPos);
          doc.text(`R${invoice.subtotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col4 + 10, yPos);

          yPos += 20;
          const vatAmount = invoice.tax || 0;
          doc.text("VAT:", col3 + 10, yPos);
          doc.text(`R${vatAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col4 + 10, yPos);

          yPos += 20;
          const totalAmount = invoice.total;
          doc.rect(col3, yPos, 195, 25).fill(brandColors.primary);
          doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold");
          doc.text("TOTAL:", col3 + 10, yPos + 7);
          doc.text(`R${totalAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, col4 + 10, yPos + 7);

          // Payment terms/notes
          if (invoice.notes) {
            yPos += 50;
            doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold");
            doc.text("Notes:", 50, yPos);
            doc.fontSize(9).font("Helvetica");
            doc.text(invoice.notes, 50, yPos + 15, { width: 495, align: "left" });
          }

          // Banking details section
          yPos = invoice.notes ? yPos + 80 : yPos + 50;
          
          if (yPos > 680) {
            doc.addPage();
            yPos = 50;
          }

          doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold");
          doc.text("Payment Information:", 50, yPos);
          
          doc.fontSize(9).font("Helvetica").fillColor("#333333");
          yPos += 20;
          doc.text(`Bank: ${companyDetails.companyBankName}`, 50, yPos);
          yPos += 15;
          doc.text(`Account Name: ${companyDetails.companyBankAccountName}`, 50, yPos);
          yPos += 15;
          doc.text(`Account Number: ${companyDetails.companyBankAccountNumber}`, 50, yPos);
          yPos += 15;
          doc.text(`Branch Code: ${companyDetails.companyBankBranchCode}`, 50, yPos);

          // Footer
          const footerY = 750;
          doc.fontSize(8).fillColor("#999999").font("Helvetica");
          doc.text(
            "Thank you for your business!",
            50,
            footerY,
            { align: "center", width: 495 }
          );

          doc.end();
        } catch (err) {
          reject(err);
        }
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Error generating PM invoice PDF:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate invoice PDF",
      });
    }
  });
