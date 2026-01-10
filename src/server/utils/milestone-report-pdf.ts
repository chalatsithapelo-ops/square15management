import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { env } from "~/server/env";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getInternalMinioUrl } from "~/server/minio";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";

interface GenerateMilestoneReportPdfResult {
  pdfBuffer: Buffer;
}

/**
 * Generate a comprehensive milestone completion report PDF
 */
export async function generateMilestoneReportPdf(
  milestoneId: number
): Promise<GenerateMilestoneReportPdfResult> {
  const milestone = await db.milestone.findUnique({
    where: { id: milestoneId },
    include: {
      project: true,
      assignedTo: true,
      weeklyUpdates: {
        orderBy: {
          weekStartDate: "asc",
        },
      },
      expenseSlips: true,
      materials: true,
      risks: true,
      supplierQuotations: true,
    },
  });

  if (!milestone) {
    throw new Error("Milestone not found");
  }

  // Load all async data BEFORE creating the PDF document
  const companyDetails = await getCompanyDetails();
  const logoBuffer = await getCompanyLogo();

  // Collect all images from weekly updates and fetch them
  const allImages: string[] = [];
  milestone.weeklyUpdates.forEach((update) => {
    if (update.imagesDone && update.imagesDone.length > 0) {
      allImages.push(...update.imagesDone);
    }
  });

  // Fetch all images (limit to 12 for reasonable PDF size)
  const imageBuffers: Buffer[] = [];
  if (allImages.length > 0) {
    const maxImages = Math.min(allImages.length, 12);
    
    for (let i = 0; i < maxImages; i++) {
      const buffer = await fetchImageAsBuffer(allImages[i]!);
      if (buffer) {
        imageBuffers.push(buffer);
      }
    }
    
    console.log(`[generateMilestoneReportPdf] Loaded ${imageBuffers.length} images out of ${allImages.length} available`);
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
        .text("MILESTONE COMPLETION REPORT", 50, 170);

      // Report details
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text(`Project: ${milestone.project.name}`, 50, 210)
        .fillColor(env.BRAND_ACCENT_COLOR)
        .text(`Generated: ${new Date().toLocaleDateString("en-ZA", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })}`, 50, 225);

      // ===== MILESTONE OVERVIEW BOX =====
      
      const overviewBoxTop = 260;
      
      // Box with accent color border
      doc
        .rect(50, overviewBoxTop, 495, 160)
        .lineWidth(2)
        .strokeColor(env.BRAND_ACCENT_COLOR)
        .stroke();
      
      // Light background
      doc.rect(51, overviewBoxTop + 1, 493, 158).fill("#f9fafb");

      // Header with accent color
      doc
        .rect(50, overviewBoxTop, 495, 28)
        .fill(env.BRAND_ACCENT_COLOR);
      
      doc
        .fontSize(11)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("MILESTONE OVERVIEW", 60, overviewBoxTop + 8);

      // Milestone information
      let infoYPos = overviewBoxTop + 38;
      
      doc
        .fontSize(10)
        .fillColor("#1a1a1a")
        .font("Helvetica-Bold")
        .text(milestone.name, 60, infoYPos, { width: 475 });
      
      infoYPos += 20;
      
      doc
        .fontSize(9)
        .fillColor("#666666")
        .font("Helvetica")
        .text("Description:", 60, infoYPos, { width: 80 })
        .fillColor("#333333")
        .text(milestone.description, 140, infoYPos, { width: 395 });
      
      infoYPos += 30;
      
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .text("Status:", 60, infoYPos, { width: 80 })
        .fillColor(
          milestone.status === "COMPLETED" ? "#16a34a" :
          milestone.status === "IN_PROGRESS" ? "#2563eb" :
          milestone.status === "ON_HOLD" ? "#f59e0b" :
          "#6b7280"
        )
        .font("Helvetica-Bold")
        .text(milestone.status.replace(/_/g, " "), 140, infoYPos, { width: 150 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Progress:", 310, infoYPos, { width: 60 })
        .fillColor(env.BRAND_SUCCESS_COLOR)
        .font("Helvetica-Bold")
        .text(`${milestone.progressPercentage}%`, 370, infoYPos, { width: 165 });
      
      infoYPos += 20;
      
      if (milestone.assignedTo) {
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Assigned To:", 60, infoYPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`${milestone.assignedTo.firstName} ${milestone.assignedTo.lastName}`, 140, infoYPos, { width: 395 });
        
        infoYPos += 20;
      }
      
      if (milestone.startDate) {
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Planned Start:", 60, infoYPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(new Date(milestone.startDate).toLocaleDateString("en-ZA"), 140, infoYPos, { width: 150 });
      }
      
      if (milestone.endDate) {
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Planned End:", 310, infoYPos, { width: 60 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(new Date(milestone.endDate).toLocaleDateString("en-ZA"), 370, infoYPos, { width: 165 });
      }
      
      infoYPos += 20;
      
      if (milestone.actualStartDate) {
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Actual Start:", 60, infoYPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(new Date(milestone.actualStartDate).toLocaleDateString("en-ZA"), 140, infoYPos, { width: 150 });
      }
      
      if (milestone.actualEndDate) {
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Actual End:", 310, infoYPos, { width: 60 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(new Date(milestone.actualEndDate).toLocaleDateString("en-ZA"), 370, infoYPos, { width: 165 });
      }

      // ===== FINANCIAL SUMMARY =====
      
      let yPos = 445;
      
      doc
        .fontSize(14)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("FINANCIAL SUMMARY", 50, yPos);
      
      yPos += 25;

      const totalCosts = milestone.labourCost + milestone.materialCost + 
                        (milestone.dieselCost || 0) + (milestone.rentCost || 0) + 
                        (milestone.adminCost || 0) + (milestone.otherOperationalCost || 0);
      const variance = milestone.actualCost - milestone.budgetAllocated;
      const actualProfit = milestone.budgetAllocated - milestone.actualCost;
      const isOverBudget = variance > 0;

      // Financial summary box
      doc.rect(50, yPos, 495, 140).fill("#f9fafb");
      doc.rect(50, yPos, 495, 140).lineWidth(1).strokeColor("#e5e7eb").stroke();
      
      yPos += 15;
      
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text("Budget Allocated:", 60, yPos, { width: 150 })
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${milestone.budgetAllocated.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Actual Cost:", 370, yPos, { width: 80 })
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${milestone.actualCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });
      
      yPos += 20;
      
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .text("Expected Profit:", 60, yPos, { width: 150 })
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${milestone.expectedProfit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Actual Profit:", 370, yPos, { width: 80 })
        .fillColor(actualProfit >= 0 ? "#16a34a" : "#dc2626")
        .font("Helvetica-Bold")
        .text(`R${actualProfit.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });
      
      yPos += 25;
      
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .text("Budget Variance:", 60, yPos, { width: 150 })
        .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
        .font("Helvetica-Bold")
        .text(`${isOverBudget ? "+" : ""}R${variance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
        .fillColor("#666666")
        .font("Helvetica")
        .text("Status:", 370, yPos, { width: 80 })
        .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
        .font("Helvetica-Bold")
        .text(isOverBudget ? "OVER BUDGET" : "UNDER BUDGET", 450, yPos, { width: 85, align: "right" });

      yPos += 25;

      // Cost breakdown
      doc
        .fontSize(9)
        .fillColor("#666666")
        .font("Helvetica")
        .text("Labour Cost:", 60, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${milestone.labourCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 140, yPos, { width: 100 })
        .fillColor("#666666")
        .text("Material Cost:", 260, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${milestone.materialCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 340, yPos, { width: 195, align: "right" });
      
      yPos += 15;
      
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .text("Diesel Cost:", 60, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${(milestone.dieselCost || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 140, yPos, { width: 100 })
        .fillColor("#666666")
        .text("Rent Cost:", 260, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${(milestone.rentCost || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 340, yPos, { width: 195, align: "right" });
      
      yPos += 15;
      
      doc
        .fillColor("#666666")
        .font("Helvetica")
        .text("Admin Cost:", 60, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${(milestone.adminCost || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 140, yPos, { width: 100 })
        .fillColor("#666666")
        .text("Other Operational:", 260, yPos, { width: 80 })
        .fillColor("#333333")
        .text(`R${(milestone.otherOperationalCost || 0).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 340, yPos, { width: 195, align: "right" });

      // ===== WEEKLY REPORTS SUMMARY =====
      
      yPos += 40;
      
      // Check if we need a new page
      if (yPos + 200 > 750) {
        doc.addPage();
        yPos = 50;
      }
      
      doc
        .fontSize(14)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("WEEKLY REPORTS SUMMARY", 50, yPos);
      
      yPos += 25;

      if (milestone.weeklyUpdates.length === 0) {
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica")
          .text("No weekly reports have been submitted for this milestone.", 60, yPos);
        yPos += 30;
      } else {
        // Aggregate weekly data
        const totalWeeks = milestone.weeklyUpdates.length;
        const totalLabourExpenditure = milestone.weeklyUpdates.reduce((sum, w) => sum + w.labourExpenditure, 0);
        const totalMaterialExpenditure = milestone.weeklyUpdates.reduce((sum, w) => sum + w.materialExpenditure, 0);
        const totalOtherExpenditure = milestone.weeklyUpdates.reduce((sum, w) => sum + w.otherExpenditure, 0);
        const totalExpenditure = milestone.weeklyUpdates.reduce((sum, w) => sum + w.totalExpenditure, 0);
        const averageProgress = milestone.weeklyUpdates.reduce((sum, w) => sum + w.progressPercentage, 0) / totalWeeks;

        // Summary stats box
        doc.rect(50, yPos, 495, 100).fill("#f9fafb");
        doc.rect(50, yPos, 495, 100).lineWidth(1).strokeColor("#e5e7eb").stroke();
        
        yPos += 15;
        
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica")
          .text("Total Weeks Reported:", 60, yPos, { width: 150 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(totalWeeks.toString(), 210, yPos, { width: 150 })
          .fillColor("#666666")
          .font("Helvetica")
          .text("Avg Progress/Week:", 370, yPos, { width: 80 })
          .fillColor(env.BRAND_SUCCESS_COLOR)
          .font("Helvetica-Bold")
          .text(`${averageProgress.toFixed(1)}%`, 450, yPos, { width: 85, align: "right" });
        
        yPos += 20;
        
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Total Labour Spent:", 60, yPos, { width: 150 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`R${totalLabourExpenditure.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
          .fillColor("#666666")
          .font("Helvetica")
          .text("Total Material Spent:", 370, yPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`R${totalMaterialExpenditure.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });
        
        yPos += 20;
        
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Total Other Costs:", 60, yPos, { width: 150 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`R${totalOtherExpenditure.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
          .fillColor("#666666")
          .font("Helvetica")
          .text("Total Expenditure:", 370, yPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`R${totalExpenditure.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });

        yPos += 35;

        // Consolidated work summary
        const allWorkDone = milestone.weeklyUpdates
          .filter(w => w.workDone)
          .map(w => w.workDone);
        const allChallenges = milestone.weeklyUpdates
          .filter(w => w.challenges)
          .map(w => w.challenges);
        const allSuccesses = milestone.weeklyUpdates
          .filter(w => w.successes)
          .map(w => w.successes);

        if (allWorkDone.length > 0 || allChallenges.length > 0 || allSuccesses.length > 0) {
          doc
            .fontSize(12)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("Consolidated Progress Notes", 50, yPos);
          
          yPos += 20;

          if (allWorkDone.length > 0) {
            // Check if we need a new page
            if (yPos + 60 > 750) {
              doc.addPage();
              yPos = 50;
            }
            
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica-Bold")
              .text("Work Completed:", 60, yPos);
            
            yPos += 15;
            
            doc
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(`• ${allWorkDone.join("\n• ")}`, 60, yPos, { width: 485 });
            
            yPos += Math.min(allWorkDone.join("\n• ").length / 70, 10) * 12 + 20;
          }

          if (allChallenges.length > 0) {
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
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(`• ${allChallenges.join("\n• ")}`, 60, yPos, { width: 485 });
            
            yPos += Math.min(allChallenges.join("\n• ").length / 70, 10) * 12 + 20;
          }

          if (allSuccesses.length > 0) {
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
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(`• ${allSuccesses.join("\n• ")}`, 60, yPos, { width: 485 });
            
            yPos += Math.min(allSuccesses.join("\n• ").length / 70, 10) * 12 + 20;
          }
        }

        // Detailed weekly breakdown table
        yPos += 20;
        
        // Check if we need a new page
        if (yPos + 150 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(12)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("Weekly Breakdown", 50, yPos);
        
        yPos += 20;

        // Table header
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
        doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

        doc
          .fontSize(8)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("WEEK", 60, yPos + 7, { width: 120 })
          .text("PROGRESS", 190, yPos + 7, { width: 60, align: "center" })
          .text("LABOUR", 260, yPos + 7, { width: 70, align: "right" })
          .text("MATERIAL", 340, yPos + 7, { width: 70, align: "right" })
          .text("TOTAL", 420, yPos + 7, { width: 115, align: "right" });

        yPos += 30;

        milestone.weeklyUpdates.forEach((update, index) => {
          // Check if we need a new page
          if (yPos + 20 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
          } else {
            doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
          }

          doc
            .fontSize(8)
            .fillColor("#333333")
            .font("Helvetica")
            .text(
              `${new Date(update.weekStartDate).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })} - ${new Date(update.weekEndDate).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })}`,
              60,
              yPos,
              { width: 120 }
            )
            .fillColor(env.BRAND_SUCCESS_COLOR)
            .font("Helvetica-Bold")
            .text(`${update.progressPercentage}%`, 190, yPos, { width: 60, align: "center" })
            .fillColor("#333333")
            .font("Helvetica")
            .text(`R${update.labourExpenditure.toLocaleString("en-ZA")}`, 260, yPos, { width: 70, align: "right" })
            .text(`R${update.materialExpenditure.toLocaleString("en-ZA")}`, 340, yPos, { width: 70, align: "right" })
            .font("Helvetica-Bold")
            .text(`R${update.totalExpenditure.toLocaleString("en-ZA")}`, 420, yPos, { width: 115, align: "right" });

          yPos += 18;
        });

        // Total row
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
        
        doc
          .fontSize(9)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("TOTAL", 60, yPos + 7)
          .text(`R${totalLabourExpenditure.toLocaleString("en-ZA")}`, 260, yPos + 7, { width: 70, align: "right" })
          .text(`R${totalMaterialExpenditure.toLocaleString("en-ZA")}`, 340, yPos + 7, { width: 70, align: "right" })
          .text(`R${totalExpenditure.toLocaleString("en-ZA")}`, 420, yPos + 7, { width: 115, align: "right" });
        
        yPos += 35;
      }

      // ===== TIMELINE PERFORMANCE =====
      
      // Check if we need a new page
      if (yPos + 120 > 750) {
        doc.addPage();
        yPos = 50;
      }
      
      doc
        .fontSize(14)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("TIMELINE PERFORMANCE", 50, yPos);
      
      yPos += 25;

      if (milestone.startDate && milestone.endDate) {
        const plannedStart = new Date(milestone.startDate);
        const plannedEnd = new Date(milestone.endDate);
        const plannedDuration = Math.ceil((plannedEnd.getTime() - plannedStart.getTime()) / (1000 * 60 * 60 * 24));
        
        let actualDuration = 0;
        let daysDelay = 0;
        let timelineStatus = "On Schedule";
        let statusColor = "#16a34a";

        if (milestone.actualStartDate && milestone.actualEndDate) {
          const actualStart = new Date(milestone.actualStartDate);
          const actualEnd = new Date(milestone.actualEndDate);
          actualDuration = Math.ceil((actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));
          daysDelay = actualDuration - plannedDuration;
          
          if (daysDelay > 0) {
            timelineStatus = "Delayed";
            statusColor = "#dc2626";
          } else if (daysDelay < 0) {
            timelineStatus = "Ahead of Schedule";
            statusColor = "#16a34a";
          }
        } else if (milestone.status === "IN_PROGRESS" && milestone.actualStartDate) {
          const actualStart = new Date(milestone.actualStartDate);
          const today = new Date();
          actualDuration = Math.ceil((today.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24));
          
          if (today > plannedEnd) {
            daysDelay = Math.ceil((today.getTime() - plannedEnd.getTime()) / (1000 * 60 * 60 * 24));
            timelineStatus = "Behind Schedule";
            statusColor = "#f59e0b";
          }
        }

        // Timeline box
        doc.rect(50, yPos, 495, 100).fill("#f9fafb");
        doc.rect(50, yPos, 495, 100).lineWidth(1).strokeColor("#e5e7eb").stroke();
        
        yPos += 15;
        
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica")
          .text("Planned Duration:", 60, yPos, { width: 150 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(`${plannedDuration} days`, 210, yPos, { width: 150 })
          .fillColor("#666666")
          .font("Helvetica")
          .text("Actual Duration:", 370, yPos, { width: 80 })
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text(actualDuration > 0 ? `${actualDuration} days` : "In Progress", 450, yPos, { width: 85, align: "right" });
        
        yPos += 20;
        
        doc
          .fillColor("#666666")
          .font("Helvetica")
          .text("Timeline Status:", 60, yPos, { width: 150 })
          .fillColor(statusColor)
          .font("Helvetica-Bold")
          .text(timelineStatus, 210, yPos, { width: 150 });
        
        if (daysDelay !== 0) {
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Variance:", 370, yPos, { width: 80 })
            .fillColor(daysDelay > 0 ? "#dc2626" : "#16a34a")
            .font("Helvetica-Bold")
            .text(`${daysDelay > 0 ? "+" : ""}${daysDelay} days`, 450, yPos, { width: 85, align: "right" });
        }
        
        yPos += 25;
        
        doc
          .fontSize(9)
          .fillColor("#666666")
          .font("Helvetica")
          .text("Planned:", 60, yPos, { width: 60 })
          .fillColor("#333333")
          .text(
            `${plannedStart.toLocaleDateString("en-ZA")} → ${plannedEnd.toLocaleDateString("en-ZA")}`,
            120,
            yPos,
            { width: 415 }
          );
        
        yPos += 15;
        
        if (milestone.actualStartDate) {
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Actual:", 60, yPos, { width: 60 })
            .fillColor("#333333")
            .text(
              `${new Date(milestone.actualStartDate).toLocaleDateString("en-ZA")}${
                milestone.actualEndDate ? ` → ${new Date(milestone.actualEndDate).toLocaleDateString("en-ZA")}` : " → Ongoing"
              }`,
              120,
              yPos,
              { width: 415 }
            );
        }

        yPos += 30;
      } else {
        doc
          .fontSize(10)
          .fillColor("#666666")
          .font("Helvetica")
          .text("Timeline information not available - no planned dates set.", 60, yPos);
        yPos += 30;
      }

      // ===== MATERIALS & EXPENSES =====
      
      // Check if we need a new page
      if (yPos + 120 > 750) {
        doc.addPage();
        yPos = 50;
      }
      
      doc
        .fontSize(14)
        .fillColor(env.BRAND_PRIMARY_COLOR)
        .font("Helvetica-Bold")
        .text("MATERIALS & EXPENSES", 50, yPos);
      
      yPos += 25;

      if (milestone.materials.length > 0) {
        doc
          .fontSize(11)
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text("Materials Used", 60, yPos);
        
        yPos += 20;

        // Materials table header
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_ACCENT_COLOR);

        doc
          .fontSize(8)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("MATERIAL", 60, yPos + 7, { width: 180 })
          .text("QTY", 250, yPos + 7, { width: 50, align: "right" })
          .text("UNIT PRICE", 310, yPos + 7, { width: 70, align: "right" })
          .text("TOTAL", 390, yPos + 7, { width: 145, align: "right" });

        yPos += 30;

        let totalMaterialCost = 0;

        milestone.materials.forEach((material, index) => {
          // Check if we need a new page
          if (yPos + 20 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          // Alternate row colors
          if (index % 2 === 0) {
            doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
          } else {
            doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
          }

          totalMaterialCost += material.totalCost;

          doc
            .fontSize(8)
            .fillColor("#333333")
            .font("Helvetica")
            .text(material.name, 60, yPos, { width: 180 })
            .text(material.quantity.toString(), 250, yPos, { width: 50, align: "right" })
            .text(`R${material.unitPrice.toLocaleString("en-ZA")}`, 310, yPos, { width: 70, align: "right" })
            .font("Helvetica-Bold")
            .text(`R${material.totalCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 390, yPos, { width: 145, align: "right" });

          yPos += 18;
        });

        // Total row
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_ACCENT_COLOR);
        
        doc
          .fontSize(9)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("TOTAL MATERIALS", 60, yPos + 7)
          .text(`R${totalMaterialCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 390, yPos + 7, { width: 145, align: "right" });
        
        yPos += 35;
      }

      if (milestone.expenseSlips.length > 0) {
        // Check if we need a new page
        if (yPos + 80 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(11)
          .fillColor("#333333")
          .font("Helvetica-Bold")
          .text("Expense Slips", 60, yPos);
        
        yPos += 15;

        doc
          .fontSize(9)
          .fillColor("#666666")
          .font("Helvetica")
          .text(`${milestone.expenseSlips.length} expense slip(s) uploaded for this milestone.`, 60, yPos);
        
        yPos += 25;
      }

      // ===== RISKS & ISSUES =====
      
      if (milestone.risks.length > 0) {
        // Check if we need a new page
        if (yPos + 120 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(14)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("RISKS & ISSUES", 50, yPos);
        
        yPos += 25;

        milestone.risks.forEach((risk, index) => {
          // Check if we need a new page
          if (yPos + 60 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          doc
            .fontSize(10)
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`${index + 1}. ${risk.riskCategory}`, 60, yPos);
          
          yPos += 15;
          
          doc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text(risk.riskDescription, 60, yPos, { width: 475 });
          
          yPos += Math.ceil(risk.riskDescription.length / 80) * 12 + 5;
          
          doc
            .text(`Probability: ${risk.probability} | Impact: ${risk.impact} | Status: ${risk.status}`, 60, yPos, { width: 475 });
          
          yPos += 20;
        });

        yPos += 10;
      }

      // ===== PICTURE GALLERY =====
      
      if (allImages.length > 0) {
        // Check if we need a new page
        if (yPos + 250 > 750) {
          doc.addPage();
          yPos = 50;
        }
        
        doc
          .fontSize(14)
          .fillColor(env.BRAND_PRIMARY_COLOR)
          .font("Helvetica-Bold")
          .text("PICTURE GALLERY", 50, yPos);
        
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
                  .text("PICTURE GALLERY (continued)", 50, yPos);
                
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
              console.log(`[generateMilestoneReportPdf] Embedded image ${index + 1} at position (${xPos}, ${yPosImg})`);
            } catch (error) {
              console.error(`[generateMilestoneReportPdf] Error embedding image ${index}:`, error);
            }
          });
          
          // Calculate final yPos after all images
          const totalRows = Math.ceil(imageBuffers.length / 2);
          const rowsOnCurrentPage = totalRows - currentPageStartRow;
          yPos += rowsOnCurrentPage * (imageHeight + imageSpacing) + 20;
          
          // Show count if there are more images
          if (allImages.length > imageBuffers.length) {
            doc
              .fontSize(8)
              .fillColor("#666666")
              .font("Helvetica")
              .text(`+ ${allImages.length - imageBuffers.length} more photo(s) available in the system`, 60, yPos, { width: 475 });
          }
        } else {
          doc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Photos failed to load. Please check the system for uploaded images.", 60, yPos);
          
          console.warn(`[generateMilestoneReportPdf] Failed to load any photos (${allImages.length} available in database)`);
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
      console.error("Error generating milestone report PDF:", error);
      reject(error);
    }
  });

  return {
    pdfBuffer,
  };
}
