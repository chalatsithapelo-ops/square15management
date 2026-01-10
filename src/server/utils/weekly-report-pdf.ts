import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { env } from "~/server/env";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getInternalMinioUrl, minioClient } from "~/server/minio";
import { Readable } from "stream";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";

/**
 * Weekly Report PDF Generator
 * 
 * This module generates comprehensive weekly progress reports for project milestones.
 * All async operations (image loading, company details) are performed BEFORE the PDF
 * generation Promise to ensure the PDF generation itself is fully synchronous.
 */

interface GenerateWeeklyReportPdfResult {
  pdfBuffer: Buffer;
  pdfUrl: string;
}

/**
 * Generate a weekly update PDF report and upload it to MinIO
 */
export async function generateAndUploadWeeklyReportPdf(
  updateId: number,
  forCustomer: boolean = false
): Promise<GenerateWeeklyReportPdfResult> {
  const update = await db.weeklyBudgetUpdate.findUnique({
    where: { id: updateId },
    include: {
      milestone: {
        include: {
          project: true,
        },
      },
    },
  });

  if (!update) {
    throw new Error("Weekly update not found");
  }

  // Load all async data BEFORE creating the PDF document
  const companyDetails = await getCompanyDetails();
  const logoBuffer = await getCompanyLogo();

  // Fetch progress images if they exist
  const imageBuffers: Buffer[] = [];
  if (update.imagesDone && update.imagesDone.length > 0) {
    const maxImages = Math.min(update.imagesDone.length, 8);
    
    for (let i = 0; i < maxImages; i++) {
      const buffer = await fetchImageAsBuffer(update.imagesDone[i]!);
      if (buffer) {
        imageBuffers.push(buffer);
      }
    }
    
    console.log(`[generateAndUploadWeeklyReportPdf] Loaded ${imageBuffers.length} progress images out of ${update.imagesDone.length} available`);
  }

  // Create PDF document
  const doc = new PDFDocument({ margin: 50 });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => {
      const buffer = Buffer.concat(chunks);
      resolve(buffer);
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

      // ===== REPORT TITLE =====
      
      doc
        .fontSize(28)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("WEEKLY PROGRESS REPORT", 50, 170);

      // Report details
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text(`Week ${update.id}`, 50, 210)
        .fillColor(env.BRAND_ACCENT_COLOR)
        .text(`${new Date(update.weekStartDate).toLocaleDateString("en-ZA", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })} - ${new Date(update.weekEndDate).toLocaleDateString("en-ZA", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })}`, 50, 225);

      // ===== PROJECT & MILESTONE DETAILS BOX =====
      
      const detailsBoxTop = 260;
      
      // Box with accent color border
      doc
        .rect(50, detailsBoxTop, 495, 90)
        .lineWidth(2)
        .strokeColor(env.BRAND_ACCENT_COLOR)
        .stroke();
      
      // Light background
      doc.rect(51, detailsBoxTop + 1, 493, 88).fill("#f9fafb");

      // Header with accent color
      doc
        .rect(50, detailsBoxTop, 495, 28)
        .fill(env.BRAND_ACCENT_COLOR);
      
      doc
        .fontSize(11)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("PROJECT & MILESTONE DETAILS", 60, detailsBoxTop + 8);

      // Project and milestone information
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text("Project:", 60, detailsBoxTop + 38, { width: 80 })
        .fillColor("#1a1a1a")
        .font("Helvetica-Bold")
        .text(update.milestone.project.name, 140, detailsBoxTop + 38, { width: 395 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Milestone:", 60, detailsBoxTop + 58, { width: 80 })
        .fillColor("#1a1a1a")
        .font("Helvetica-Bold")
        .text(update.milestone.name, 140, detailsBoxTop + 58, { width: 395 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Progress:", 60, detailsBoxTop + 78, { width: 80 })
        .fillColor(env.BRAND_SUCCESS_COLOR)
        .font("Helvetica-Bold")
        .text(`${update.progressPercentage}%`, 140, detailsBoxTop + 78);

      // ===== EXPENDITURE SUMMARY (HIDDEN FOR CUSTOMERS) =====
      
      let yPos = 375;
      
      if (!forCustomer) {
        doc
          .fontSize(14)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("EXPENDITURE SUMMARY", 50, yPos);
        
        yPos += 25;

        // Expenditure table
        const expenseData = [
          { label: "Labour", amount: update.labourExpenditure },
          { label: "Material", amount: update.materialExpenditure },
          { label: "Other", amount: update.otherExpenditure },
          { label: "Total", amount: update.totalExpenditure, isTotal: true },
        ];

        expenseData.forEach((item, index) => {
          if (item.isTotal) {
            // Total row with highlight
            doc.rect(50, yPos - 3, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
            doc
              .fontSize(11)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text(item.label, 60, yPos + 3)
              .text(`R${item.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 350, yPos + 3, { width: 185, align: "right" });
          } else {
            // Regular row
            if (index % 2 === 0) {
              doc.rect(50, yPos - 3, 495, 20).fill("#f9fafb");
            }
            doc
              .fontSize(10)
              .fillColor("#333333")
              .font("Helvetica")
              .text(item.label, 60, yPos)
              .font("Helvetica-Bold")
              .text(`R${item.amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, 350, yPos, { width: 185, align: "right" });
          }
          yPos += item.isTotal ? 25 : 20;
        });

        yPos += 20;
      }

      // ===== WORK DETAILS SECTION =====
      
      doc
        .fontSize(14)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("WORK DETAILS", 50, yPos);
      
      yPos += 25;

      if (update.workDone) {
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica-Bold")
          .text("Work Completed This Week:", 60, yPos);
        
        yPos += 15;
        
        doc
          .fillColor("#333333")
          .font("Helvetica")
          .text(update.workDone, 60, yPos, { width: 485, align: "justify" });
        
        yPos += Math.ceil(update.workDone.length / 80) * 12 + 15;
      }

      if (update.challenges) {
        // Check if we need a new page
        if (yPos + 60 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica-Bold")
          .text("Challenges Faced:", 60, yPos);
        
        yPos += 15;
        
        doc
          .fillColor("#333333")
          .font("Helvetica")
          .text(update.challenges, 60, yPos, { width: 485, align: "justify" });
        
        yPos += Math.ceil(update.challenges.length / 80) * 12 + 15;
      }

      if (update.successes) {
        // Check if we need a new page
        if (yPos + 60 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica-Bold")
          .text("Successes & Achievements:", 60, yPos);
        
        yPos += 15;
        
        doc
          .fillColor("#333333")
          .font("Helvetica")
          .text(update.successes, 60, yPos, { width: 485, align: "justify" });
        
        yPos += Math.ceil(update.successes.length / 80) * 12 + 15;
      }

      if (update.nextWeekPlan) {
        // Check if we need a new page
        if (yPos + 60 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica-Bold")
          .text("Next Week's Plan:", 60, yPos);
        
        yPos += 15;
        
        doc
          .fillColor("#333333")
          .font("Helvetica")
          .text(update.nextWeekPlan, 60, yPos, { width: 485, align: "justify" });
        
        yPos += Math.ceil(update.nextWeekPlan.length / 80) * 12 + 15;
      }

      // ===== ITEMIZED EXPENSES TABLE (HIDDEN FOR CUSTOMERS) =====
      
      if (!forCustomer && update.itemizedExpenses && Array.isArray(update.itemizedExpenses) && update.itemizedExpenses.length > 0) {
        yPos += 20;
        
        // Check if we need a new page for the table
        if (yPos + 100 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(14)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("ITEMIZED EXPENSES", 50, yPos);
        
        yPos += 25;

        // Table header
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
        doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

        doc
          .fontSize(9)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("ITEM", 60, yPos + 7, { width: 180 })
          .text("QUOTED", 250, yPos + 7, { width: 70, align: "right" })
          .text("ACTUAL", 330, yPos + 7, { width: 70, align: "right" })
          .text("VARIANCE", 410, yPos + 7, { width: 70, align: "right" })
          .text("STATUS", 490, yPos + 7, { width: 45, align: "center" });

        yPos += 30;

        const expenses = update.itemizedExpenses as any[];
        
        expenses.forEach((expense, index) => {
          // Check if we need a new page
          if (yPos + 25 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          const isOverBudget = expense.actualSpent > expense.quotedAmount;
          const variance = expense.actualSpent - expense.quotedAmount;
          
          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(50, yPos - 3, 495, 20).fill("#f9fafb");
          } else {
            doc.rect(50, yPos - 3, 495, 20).fill("#ffffff");
          }

          doc
            .fontSize(8)
            .fillColor("#333333")
            .font("Helvetica")
            .text(expense.itemDescription, 60, yPos, { width: 180 })
            .text(`R${expense.quotedAmount.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 250, yPos, { width: 70, align: "right" })
            .fillColor(isOverBudget ? "#dc2626" : "#333333")
            .font("Helvetica-Bold")
            .text(`R${expense.actualSpent.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 330, yPos, { width: 70, align: "right" })
            .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
            .text(`${variance >= 0 ? "+" : ""}R${variance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 410, yPos, { width: 70, align: "right" })
            .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
            .fontSize(7)
            .text(isOverBudget ? "OVER" : "OK", 490, yPos + 2, { width: 45, align: "center" });

          yPos += 20;
          
          // Add reason for overspend if present
          if (expense.reasonForOverspend && isOverBudget) {
            doc
              .fontSize(7)
              .fillColor("#dc2626")
              .font("Helvetica")
              .text(`Reason: ${expense.reasonForOverspend}`, 60, yPos - 15, { width: 475 });
            yPos += 8;
          }
        });
      }

      // ===== PROGRESS PHOTOS SECTION =====
      
      if (update.imagesDone && update.imagesDone.length > 0) {
        yPos += 30;
        
        // Check if we need a new page
        if (yPos + 250 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(14)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("PROGRESS PHOTOS", 50, yPos);
        
        yPos += 25;

        if (imageBuffers.length > 0) {
          const imageWidth = 230;
          const imageHeight = 170;
          const imageSpacing = 15;
          let currentPageStartRow = 0;
          
          imageBuffers.forEach((buffer, index) => {
            try {
              const col = index % 2;
              const row = Math.floor(index / 2);
              
              // Check if we need a new page (every 2 rows = 4 images)
              if (row > 0 && row % 2 === 0 && row !== currentPageStartRow) {
                doc.addPage();
                currentPageStartRow = row;
                yPos = 50;
                
                // Add section header on new page
                doc
                  .fontSize(14)
                  .fillColor(env.BRAND_PRIMARY_COLOR)
                  .font("Helvetica-Bold")
                  .text("PROGRESS PHOTOS (continued)", 50, yPos);
                
                yPos += 25;
              }
              
              // Calculate position for this image
              const xPos = 60 + col * (imageWidth + imageSpacing);
              const rowOnPage = row - currentPageStartRow;
              const yPosImg = yPos + rowOnPage * (imageHeight + imageSpacing);
              
              doc.image(buffer, xPos, yPosImg, {
                fit: [imageWidth, imageHeight],
                align: 'center',
                valign: 'center'
              });
              console.log(`[generateAndUploadWeeklyReportPdf] Embedded progress image ${index + 1} at position (${xPos}, ${yPosImg})`);
            } catch (error) {
              console.error(`[generateAndUploadWeeklyReportPdf] Error embedding progress image ${index}:`, error);
            }
          });
          
          // Calculate final yPos after all images
          const totalRows = Math.ceil(imageBuffers.length / 2);
          const rowsOnCurrentPage = totalRows - currentPageStartRow;
          yPos += rowsOnCurrentPage * (imageHeight + imageSpacing) + 20;
          
          // Show count if there are more images
          if (update.imagesDone.length > imageBuffers.length) {
            doc
              .fontSize(8)
              .fillColor("#666666")
              .font("Helvetica")
              .text(`+ ${update.imagesDone.length - imageBuffers.length} more photo(s) available in the system`, 60, yPos, { width: 475 });
          }
        } else {
          doc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Progress photos failed to load. Please check the system for uploaded images.", 60, yPos);
          
          if (update.imagesDone.length > 0) {
            console.warn(`[generateAndUploadWeeklyReportPdf] Failed to load any progress photos (${update.imagesDone.length} available in database)`);
          }
        }
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
          `${companyDetails.companyName} | ${companyDetails.companyEmail} | VAT Reg: ${companyDetails.companyVatNumber}`,
          50,
          778,
          { align: "center", width: 495 }
        );

      doc.end();
    } catch (error) {
      console.error("Error generating weekly report PDF:", error);
      reject(error);
    }
  });

  // Upload PDF to MinIO
  const bucketName = "reports";
  const fileName = `weekly-updates/update-${updateId}-${Date.now()}.pdf`;

  // Ensure bucket exists
  const bucketExists = await minioClient.bucketExists(bucketName);
  if (!bucketExists) {
    await minioClient.makeBucket(bucketName, "us-east-1");
  }

  // Upload the PDF
  const stream = Readable.from(pdfBuffer);
  await minioClient.putObject(bucketName, fileName, stream, pdfBuffer.length, {
    "Content-Type": "application/pdf",
  });

  // Generate presigned URL (valid for 7 days)
  const pdfUrl = await minioClient.presignedGetObject(bucketName, fileName, 7 * 24 * 60 * 60);

  console.log(`[generateAndUploadWeeklyReportPdf] PDF uploaded to MinIO: ${fileName}`);

  return {
    pdfBuffer,
    pdfUrl,
  };
}
