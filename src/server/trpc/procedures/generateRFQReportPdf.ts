import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";

export const generateRFQReportPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      const quotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
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
            },
          },
          expenseSlips: true,
        },
      });

      if (!quotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      // Verify ownership and permissions based on portal separation
      const isContractor =
        user.role === "CONTRACTOR" ||
        user.role === "CONTRACTOR_SENIOR_MANAGER" ||
        user.role === "CONTRACTOR_JUNIOR_MANAGER";
      const isAdmin = user.role === "ADMIN" || user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN";
      const isArtisan = user.role === "ARTISAN" && quotation.assignedToId === user.id;

      // Check ownership: contractors can only access quotations they created
      // Admins can only access quotations created by admins or system (null)
      if (isContractor) {
        // Verify the quotation was created by a contractor
        if (!quotation.createdBy || 
            (quotation.createdBy.role !== "CONTRACTOR" && 
             quotation.createdBy.role !== "CONTRACTOR_SENIOR_MANAGER" && 
             quotation.createdBy.role !== "CONTRACTOR_JUNIOR_MANAGER")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to view this RFQ report - it belongs to the admin portal",
          });
        }
        
        // Verify same company if company name exists
        const userCompanyName = user.contractorCompanyName?.trim();
        const quotationCompanyName = quotation.createdBy.contractorCompanyName?.trim();
        if (userCompanyName && quotationCompanyName && userCompanyName !== quotationCompanyName) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to view this RFQ report - it belongs to a different contractor company",
          });
        }
      } else if (isAdmin) {
        // Verify the quotation was NOT created by a contractor
        if (quotation.createdBy && 
            (quotation.createdBy.role === "CONTRACTOR" || 
             quotation.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" || 
             quotation.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER")) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You don't have permission to view this RFQ report - it belongs to the contractor portal",
          });
        }
      } else if (!isArtisan) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have permission to view this RFQ report",
        });
      }

      // Determine company details and logo
      let companyDetails;
      let logoBuffer;

      if (
        quotation.createdBy &&
        (quotation.createdBy.role === "CONTRACTOR" ||
          quotation.createdBy.role === "CONTRACTOR_SENIOR_MANAGER" ||
          quotation.createdBy.role === "CONTRACTOR_JUNIOR_MANAGER") &&
        quotation.createdBy.contractorCompanyName
      ) {
        companyDetails = {
          companyName: quotation.createdBy.contractorCompanyName,
          companyAddressLine1: quotation.createdBy.contractorCompanyAddressLine1 || "",
          companyAddressLine2: quotation.createdBy.contractorCompanyAddressLine2 || "",
          companyPhone: quotation.createdBy.contractorCompanyPhone || "",
          companyEmail: quotation.createdBy.contractorCompanyEmail || "",
        };
        logoBuffer = await getContractorLogo();
      } else {
        companyDetails = await getCompanyDetails();
        logoBuffer = await getCompanyLogo();
      }

      // Create PDF document
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
      });

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));

      // Header with logo
      if (logoBuffer) {
        try {
          doc.image(logoBuffer, 50, 45, { width: 80 });
        } catch (error) {
          console.warn("Could not load logo:", error);
        }
      }

      // Company details
      doc
        .fontSize(10)
        .text(companyDetails.companyName, 450, 50, { align: "right" })
        .fontSize(9)
        .text(companyDetails.companyAddressLine1, 450, 65, { align: "right" })
        .text(companyDetails.companyAddressLine2, 450, 78, { align: "right" })
        .text(`Tel: ${companyDetails.companyPhone}`, 450, 91, { align: "right" })
        .text(companyDetails.companyEmail, 450, 104, { align: "right" });

      // Title
      doc
        .fontSize(20)
        .fillColor("#2D5016")
        .text("RFQ WORK ASSESSMENT REPORT", 50, 140, { align: "center" })
        .fontSize(10)
        .fillColor("#666666")
        .text("Artisan Work Details & Cost Estimation", 50, 165, { align: "center" });

      let yPos = 200;

      // RFQ Information Box
      doc
        .fontSize(12)
        .fillColor("#2D5016")
        .text("REQUEST INFORMATION", 50, yPos);

      yPos += 20;
      doc
        .roundedRect(50, yPos, 495, 80, 5)
        .fillAndStroke("#F0F4F8", "#CCCCCC");

      yPos += 15;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("RFQ Number:", 60, yPos)
        .font("Helvetica-Bold")
        .text(quotation.quoteNumber, 160, yPos)
        .font("Helvetica");

      yPos += 18;
      if (quotation.clientReferenceQuoteNumber) {
        doc
          .text("Client Reference:", 60, yPos)
          .font("Helvetica-Bold")
          .text(quotation.clientReferenceQuoteNumber, 160, yPos)
          .font("Helvetica");
        yPos += 18;
      }

      doc
        .text("Status:", 60, yPos)
        .font("Helvetica-Bold")
        .fillColor("#D97706")
        .text(quotation.status.replace(/_/g, " "), 160, yPos)
        .fillColor("#333333")
        .font("Helvetica");

      yPos += 18;
      doc
        .text("Created Date:", 60, yPos)
        .font("Helvetica-Bold")
        .text(new Date(quotation.createdAt).toLocaleDateString(), 160, yPos)
        .font("Helvetica");

      yPos += 35;

      // Customer Information
      doc
        .fontSize(12)
        .fillColor("#2D5016")
        .text("CUSTOMER INFORMATION", 50, yPos);

      yPos += 20;
      doc
        .roundedRect(50, yPos, 495, 90, 5)
        .fillAndStroke("#F0F4F8", "#CCCCCC");

      yPos += 15;
      doc
        .fontSize(10)
        .fillColor("#333333")
        .text("Name:", 60, yPos)
        .font("Helvetica-Bold")
        .text(quotation.customerName, 160, yPos)
        .font("Helvetica");

      yPos += 18;
      doc
        .text("Email:", 60, yPos)
        .text(quotation.customerEmail, 160, yPos);

      yPos += 18;
      doc
        .text("Phone:", 60, yPos)
        .text(quotation.customerPhone, 160, yPos);

      yPos += 18;
      doc
        .text("Address:", 60, yPos)
        .text(quotation.address, 160, yPos, { width: 380 });

      yPos += 35;

      // Artisan Information
      if (quotation.assignedTo) {
        if (yPos > 680) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(12)
          .fillColor("#2D5016")
          .text("ARTISAN INFORMATION", 50, yPos);

        yPos += 20;
        doc
          .roundedRect(50, yPos, 495, 50, 5)
          .fillAndStroke("#F0F4F8", "#CCCCCC");

        yPos += 15;
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text("Assigned Artisan:", 60, yPos)
          .font("Helvetica-Bold")
          .text(
            `${quotation.assignedTo.firstName} ${quotation.assignedTo.lastName}`,
            160,
            yPos
          )
          .font("Helvetica");

        yPos += 18;
        doc
          .text("Email:", 60, yPos)
          .text(quotation.assignedTo.email || "N/A", 160, yPos);

        yPos += 35;
      }

      // Scope of Work
      if (quotation.quotationLineItems && Array.isArray(quotation.quotationLineItems) && (quotation.quotationLineItems as any[]).length > 0) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(12)
          .fillColor("#2D5016")
          .text("SCOPE OF WORK", 50, yPos);

        yPos += 20;

        for (const item of quotation.quotationLineItems as any[]) {
          if (yPos > 700) {
            doc.addPage();
            yPos = 50;
          }

          const itemHeight = 60 + (item.notes ? 15 : 0);
          doc
            .roundedRect(50, yPos, 495, itemHeight, 5)
            .fillAndStroke("#E8F4F0", "#CCCCCC");

          yPos += 15;
          doc
            .fontSize(10)
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(item.description, 60, yPos, { width: 380 })
            .font("Helvetica");

          doc
            .fontSize(8)
            .fillColor("#666666")
            .text(item.category, 450, yPos, { align: "right" });

          yPos += 18;
          if (item.quantity) {
            doc
              .fontSize(9)
              .fillColor("#666666")
              .text(`Quantity: ${item.quantity}`, 60, yPos);
            yPos += 12;
          }

          if (item.notes) {
            doc
              .fontSize(9)
              .fillColor("#666666")
              .text(item.notes, 60, yPos, { width: 475 });
            yPos += 12;
          }

          yPos += 18;
        }
      }

      // Labour Estimation
      if (quotation.numPeopleNeeded && quotation.estimatedDuration && quotation.durationUnit) {
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(12)
          .fillColor("#2D5016")
          .text("LABOUR ESTIMATION", 50, yPos);

        yPos += 20;
        doc
          .roundedRect(50, yPos, 495, 70, 5)
          .fillAndStroke("#E8F5E9", "#CCCCCC");

        yPos += 15;
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text("People Needed:", 60, yPos)
          .font("Helvetica-Bold")
          .text(quotation.numPeopleNeeded.toString(), 160, yPos)
          .font("Helvetica");

        doc
          .text("Duration:", 280, yPos)
          .font("Helvetica-Bold")
          .text(
            `${quotation.estimatedDuration} ${quotation.durationUnit === "HOURLY" ? "hours" : "days"}`,
            380,
            yPos
          )
          .font("Helvetica");

        yPos += 18;
        const rateAmount = quotation.labourRate || 0;
        const labourCost = quotation.companyLabourCost || 
          (quotation.numPeopleNeeded * quotation.estimatedDuration * rateAmount);

        doc
          .text("Rate:", 60, yPos)
          .font("Helvetica-Bold")
          .text(
            `R${rateAmount.toFixed(2)}/${quotation.durationUnit === "HOURLY" ? "hr" : "day"}`,
            160,
            yPos
          )
          .font("Helvetica");

        doc
          .text("Labour Cost:", 280, yPos)
          .font("Helvetica-Bold")
          .text(`R${labourCost.toFixed(2)}`, 380, yPos)
          .font("Helvetica");

        yPos += 35;
      }

      // Supplier Quotations
      if (quotation.expenseSlips && quotation.expenseSlips.length > 0) {
        if (yPos > 600) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(12)
          .fillColor("#2D5016")
          .text(`SUPPLIER QUOTATIONS (${quotation.expenseSlips.length})`, 50, yPos);

        yPos += 20;

        for (const slip of quotation.expenseSlips) {
          if (yPos > 720) {
            doc.addPage();
            yPos = 50;
          }

          const slipHeight = 50 + (slip.description ? 12 : 0);
          doc
            .roundedRect(50, yPos, 495, slipHeight, 5)
            .fillAndStroke("#F9FAFB", "#CCCCCC");

          yPos += 15;
          doc
            .fontSize(10)
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(slip.category, 60, yPos);

          if (slip.amount) {
            doc
              .font("Helvetica-Bold")
              .fillColor("#2D5016")
              .text(`R${slip.amount.toFixed(2)}`, 450, yPos, { align: "right" });
          }

          doc.font("Helvetica");

          if (slip.description) {
            yPos += 15;
            doc
              .fontSize(9)
              .fillColor("#666666")
              .text(slip.description, 60, yPos);
          }

          yPos += 30;
        }
      }

      // Cost Summary
      if (yPos > 620) {
        doc.addPage();
        yPos = 50;
      }

      doc
        .fontSize(12)
        .fillColor("#2D5016")
        .text("COST SUMMARY", 50, yPos);

      yPos += 20;
      doc
        .roundedRect(50, yPos, 495, 110, 5)
        .fillAndStroke("#FFF8E1", "#CCCCCC");

      yPos += 15;
      doc
        .fontSize(10)
        .fillColor("#333333");

      if (quotation.companyMaterialCost !== undefined) {
        doc
          .text("Material Cost:", 60, yPos)
          .font("Helvetica-Bold")
          .text(`R${quotation.companyMaterialCost.toFixed(2)}`, 450, yPos, { align: "right" })
          .font("Helvetica");
        yPos += 18;
      }

      if (quotation.companyLabourCost !== undefined) {
        doc
          .text("Labour Cost:", 60, yPos)
          .font("Helvetica-Bold")
          .text(`R${quotation.companyLabourCost.toFixed(2)}`, 450, yPos, { align: "right" })
          .font("Helvetica");
        yPos += 18;
      }

      doc
        .strokeColor("#999999")
        .moveTo(60, yPos)
        .lineTo(535, yPos)
        .stroke();
      yPos += 5;

      doc
        .text("Subtotal:", 60, yPos)
        .font("Helvetica-Bold")
        .text(`R${quotation.subtotal.toFixed(2)}`, 450, yPos, { align: "right" })
        .font("Helvetica");

      yPos += 18;
      doc
        .text("Tax (VAT):", 60, yPos)
        .font("Helvetica-Bold")
        .text(`R${quotation.tax.toFixed(2)}`, 450, yPos, { align: "right" })
        .font("Helvetica");

      yPos += 5;
      doc
        .strokeColor("#333333")
        .lineWidth(2)
        .moveTo(60, yPos)
        .lineTo(535, yPos)
        .stroke()
        .lineWidth(1);

      yPos += 8;
      doc
        .fontSize(12)
        .font("Helvetica-Bold")
        .fillColor("#2D5016")
        .text("TOTAL:", 60, yPos)
        .fontSize(14)
        .text(`R${quotation.total.toFixed(2)}`, 450, yPos, { align: "right" })
        .font("Helvetica")
        .fontSize(10);

      // Notes
      if (quotation.notes) {
        yPos += 40;
        if (yPos > 650) {
          doc.addPage();
          yPos = 50;
        }

        doc
          .fontSize(12)
          .fillColor("#2D5016")
          .text("ADDITIONAL NOTES", 50, yPos);

        yPos += 20;
        doc
          .fontSize(10)
          .fillColor("#333333")
          .text(quotation.notes, 50, yPos, { width: 495, align: "left" });
      }

      // Footer
      const pageCount = (doc as any).bufferedPageRange().count;
      for (let i = 0; i < pageCount; i++) {
        doc.switchToPage(i);
        doc
          .fontSize(8)
          .fillColor("#999999")
          .text(
            `RFQ Report - ${quotation.quoteNumber} | Page ${i + 1} of ${pageCount} | Generated: ${new Date().toLocaleString()}`,
            50,
            doc.page.height - 40,
            { align: "center", width: 495 }
          );
      }

      doc.end();

      return new Promise<{ pdfBase64: string }>((resolve, reject) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString("base64");
          resolve({ pdfBase64 });
        });

        doc.on("error", reject);
      });
    } catch (error) {
      if (error instanceof TRPCError) {
        throw error;
      }
      console.error("Error generating RFQ report PDF:", error);
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to generate RFQ report PDF",
      });
    }
  });
