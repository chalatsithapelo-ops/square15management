import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";

export const generateQuotationPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      const quotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
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
              pmCompanyName: true,
              pmCompanyAddressLine1: true,
              pmCompanyAddressLine2: true,
              pmCompanyPhone: true,
              pmCompanyEmail: true,
              pmCompanyVatNumber: true,
            },
          },
        },
      });

      if (!quotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      // Allow export of approved quotations or those sent to customers
      if (quotation.status !== "APPROVED" && quotation.status !== "SENT_TO_CUSTOMER") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Only approved quotations or those sent to customers can be exported",
        });
      }

      // Determine company details and logo based on who created the quotation
      // Quotations are created by contractors, so use contractor company details
      let companyDetails;
      let logoBuffer;

      if (quotation.createdBy && 
          (quotation.createdBy.role === "CONTRACTOR" || 
           quotation.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" || 
           quotation.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER") &&
          quotation.createdBy.contractorCompanyName) {
        // Use contractor company details from the creator's profile
        companyDetails = {
          companyName: quotation.createdBy.contractorCompanyName,
          companyAddressLine1: quotation.createdBy.contractorCompanyAddressLine1 || "",
          companyAddressLine2: quotation.createdBy.contractorCompanyAddressLine2 || "",
          companyPhone: quotation.createdBy.contractorCompanyPhone || "",
          companyEmail: quotation.createdBy.contractorCompanyEmail || "",
          companyVatNumber: quotation.createdBy.contractorCompanyVatNumber || "",
        };
        // Use contractor logo
        logoBuffer = await getContractorLogo();
      } else {
        // Fallback to system company details (Property Manager)
        companyDetails = await getCompanyDetails();
        logoBuffer = await getCompanyLogo();
      }

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
              doc.opacity(1);
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

          // ===== QUOTATION TITLE =====
          
          doc
            .fontSize(28)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("QUOTATION", 50, 170);

          // Quotation details
          doc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text(`Quotation No: ${quotation.quoteNumber}`, 50, 210);

          let detailsY = 225;

          if (quotation.clientReferenceQuoteNumber) {
            doc.text(`Client Ref: ${quotation.clientReferenceQuoteNumber}`, 50, detailsY);
            detailsY += 15;
          }

          doc.text(`Date: ${new Date(quotation.createdAt).toLocaleDateString("en-ZA")}`, 50, detailsY);
          detailsY += 15;

          if (quotation.validUntil) {
            doc
              .fillColor(env.BRAND_ACCENT_COLOR)
              .text(
                `Valid Until: ${new Date(quotation.validUntil).toLocaleDateString("en-ZA")}`,
                50,
                detailsY
              );
            detailsY += 15;
          }

          // ===== CUSTOMER DETAILS BOX =====

          const customerBoxTop = detailsY + 15;
          
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
            .text(quotation.customerName, 60, customerBoxTop + 38, { width: 220 })
            .font("Helvetica")
            .fontSize(9)
            .fillColor("#333333")
            .text(quotation.address, 60, customerBoxTop + 53, { width: 220 })
            .text(quotation.customerEmail, 60, customerBoxTop + 73, { width: 220 })
            .text(quotation.customerPhone, 60, customerBoxTop + 88, { width: 220 });

          // ===== LINE ITEMS TABLE =====
          
          const tableTop = customerBoxTop + 135;

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
          const items = Array.isArray(quotation.items) ? quotation.items : [];
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
            .text(`R${quotation.subtotal.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

          yPosition += 20;
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("VAT (15%):", totalsX, yPosition, { width: 70, align: "right" })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${quotation.tax.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

          yPosition += 20;
          // Total with brand banner
          doc.rect(380, yPosition - 5, 165, 28).fill(env.BRAND_PRIMARY_COLOR);
          doc.rect(380, yPosition + 20, 165, 3).fill(env.BRAND_SECONDARY_COLOR);
          
          doc
            .fontSize(12)
            .fillColor("#ffffff")
            .font("Helvetica")
            .text("TOTAL:", totalsX, yPosition + 3, { width: 70, align: "right" })
            .font("Helvetica-Bold")
            .text(`R${quotation.total.toFixed(2)}`, 460, yPosition + 3, { width: 75, align: "right" });

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
            { label: "Reference:", value: quotation.quoteNumber },
          ];

          bankingDetails.forEach((detail) => {
            const safeValue = detail.value ?? "";
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text(detail.label, 60, yPosition, { width: 150 })
              .fillColor("#1a1a1a")
              .font("Helvetica-Bold")
              .text(String(safeValue), 210, yPosition, { width: 325 });
            yPosition += 16;
          });

          // ===== NOTES SECTION =====
          
          if (quotation.notes) {
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
              .text(quotation.notes, 50, yPosition, { width: 495, align: "justify" });
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
              "Thank you for considering our quotation!",
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
          console.error("Error generating quotation PDF:", error);
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
