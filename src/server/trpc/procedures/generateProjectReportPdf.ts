import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";

export const generateProjectReportPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const project = await db.project.findUnique({
        where: { id: input.projectId },
        include: {
          milestones: {
            include: {
              weeklyUpdates: {
                orderBy: {
                  weekStartDate: "asc",
                },
              },
            },
            orderBy: {
              sequenceOrder: "asc",
            },
          },
        },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Load all async data BEFORE creating the PDF document
      const companyDetails = await getCompanyDetails();
      const logoBuffer = await getCompanyLogo();

      // Create PDF document
      const doc = new PDFDocument({ margin: 50 });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));

      return new Promise<{ pdf: string }>((resolve, reject) => {
        doc.on("end", () => {
          const pdfBuffer = Buffer.concat(chunks);
          const pdfBase64 = pdfBuffer.toString("base64");
          resolve({ pdf: pdfBase64 });
        });

        doc.on("error", reject);

        // No async operations needed in the PDF generation itself for this file
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
            .text("PROJECT COMPLETION REPORT", 50, 170);

          // Report details
          doc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text(`Project No: ${project.projectNumber}`, 50, 210)
            .fillColor(env.BRAND_ACCENT_COLOR)
            .text(`Generated: ${new Date().toLocaleDateString("en-ZA", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}`, 50, 225);

          // ===== PROJECT OVERVIEW BOX =====
          
          const overviewBoxTop = 260;
          
          // Box with accent color border
          doc
            .rect(50, overviewBoxTop, 495, 140)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          
          // Light background
          doc.rect(51, overviewBoxTop + 1, 493, 138).fill("#f9fafb");

          // Header with accent color
          doc
            .rect(50, overviewBoxTop, 495, 28)
            .fill(env.BRAND_ACCENT_COLOR);
          
          doc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("PROJECT OVERVIEW", 60, overviewBoxTop + 8);

          // Project information
          let infoYPos = overviewBoxTop + 38;
          
          doc
            .fontSize(10)
            .fillColor("#1a1a1a")
            .font("Helvetica-Bold")
            .text(project.name, 60, infoYPos, { width: 475 });
          
          infoYPos += 20;
          
          doc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Customer:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(project.customerName, 140, infoYPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Type:", 310, infoYPos, { width: 50 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(project.projectType, 360, infoYPos, { width: 175 });
          
          infoYPos += 15;
          
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Email:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .text(project.customerEmail, 140, infoYPos, { width: 150 })
            .fillColor("#666666")
            .text("Phone:", 310, infoYPos, { width: 50 })
            .fillColor("#333333")
            .text(project.customerPhone, 360, infoYPos, { width: 175 });
          
          infoYPos += 15;
          
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Address:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .text(project.address, 140, infoYPos, { width: 395 });
          
          infoYPos += 20;
          
          if (project.startDate) {
            doc
              .fillColor("#666666")
              .font("Helvetica")
              .text("Start Date:", 60, infoYPos, { width: 80 })
              .fillColor("#333333")
              .font("Helvetica-Bold")
              .text(new Date(project.startDate).toLocaleDateString("en-ZA"), 140, infoYPos, { width: 150 });
          }
          
          if (project.endDate) {
            doc
              .fillColor("#666666")
              .font("Helvetica")
              .text("End Date:", 310, infoYPos, { width: 50 })
              .fillColor("#333333")
              .font("Helvetica-Bold")
              .text(new Date(project.endDate).toLocaleDateString("en-ZA"), 360, infoYPos, { width: 175 });
          }

          // ===== FINANCIAL SUMMARY =====
          
          let yPos = 425;
          
          doc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("FINANCIAL SUMMARY", 50, yPos);
          
          yPos += 25;

          const totalMilestoneBudget = project.milestones.reduce((sum, m) => sum + m.budgetAllocated, 0);
          const totalMilestoneActual = project.milestones.reduce((sum, m) => sum + m.actualCost, 0);
          const variance = totalMilestoneActual - (project.estimatedBudget || totalMilestoneBudget);
          const isOverBudget = variance > 0;

          // Financial summary box
          doc.rect(50, yPos, 495, 80).fill("#f9fafb");
          doc.rect(50, yPos, 495, 80).lineWidth(1).strokeColor("#e5e7eb").stroke();
          
          yPos += 15;
          
          doc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Estimated Budget:", 60, yPos, { width: 150 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${(project.estimatedBudget || totalMilestoneBudget).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Actual Cost:", 370, yPos, { width: 80 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${project.actualCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });
          
          yPos += 20;
          
          doc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Milestone Budget:", 60, yPos, { width: 150 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${totalMilestoneBudget.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, yPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Milestone Actual:", 370, yPos, { width: 80 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${totalMilestoneActual.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, yPos, { width: 85, align: "right" });
          
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

          // ===== MILESTONES SUMMARY =====
          
          yPos += 50;
          
          doc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("MILESTONES SUMMARY", 50, yPos);
          
          yPos += 25;

          // Milestones table header
          doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
          doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

          doc
            .fontSize(9)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("MILESTONE", 60, yPos + 7, { width: 200 })
            .text("STATUS", 270, yPos + 7, { width: 70, align: "center" })
            .text("BUDGET", 350, yPos + 7, { width: 80, align: "right" })
            .text("ACTUAL", 440, yPos + 7, { width: 95, align: "right" });

          yPos += 30;

          project.milestones.forEach((milestone, index) => {
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

            const statusColor = 
              milestone.status === "COMPLETED" ? "#16a34a" :
              milestone.status === "IN_PROGRESS" ? "#2563eb" :
              milestone.status === "ON_HOLD" ? "#f59e0b" :
              "#6b7280";

            doc
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(milestone.name, 60, yPos, { width: 200 })
              .fillColor(statusColor)
              .font("Helvetica-Bold")
              .fontSize(8)
              .text(milestone.status.replace(/_/g, " "), 270, yPos + 2, { width: 70, align: "center" })
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(`R${milestone.budgetAllocated.toLocaleString("en-ZA")}`, 350, yPos, { width: 80, align: "right" })
              .font("Helvetica-Bold")
              .text(`R${milestone.actualCost.toLocaleString("en-ZA")}`, 440, yPos, { width: 95, align: "right" });

            yPos += 18;
          });

          // Total row
          doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
          
          doc
            .fontSize(10)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("TOTAL", 60, yPos + 7)
            .text(`R${totalMilestoneBudget.toLocaleString("en-ZA")}`, 350, yPos + 7, { width: 80, align: "right" })
            .text(`R${totalMilestoneActual.toLocaleString("en-ZA")}`, 440, yPos + 7, { width: 95, align: "right" });
          
          yPos += 35;

          // ===== WEEKLY UPDATES SECTION =====
          
          // Check if we need a new page
          if (yPos + 100 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          doc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("WEEKLY PROGRESS UPDATES", 50, yPos);
          
          yPos += 25;

          // Collect all weekly updates from all milestones
          const allUpdates: Array<{
            update: any;
            milestoneName: string;
          }> = [];

          project.milestones.forEach((milestone) => {
            milestone.weeklyUpdates.forEach((update) => {
              allUpdates.push({
                update,
                milestoneName: milestone.name,
              });
            });
          });

          // Sort by week start date
          allUpdates.sort((a, b) => 
            new Date(a.update.weekStartDate).getTime() - new Date(b.update.weekStartDate).getTime()
          );

          if (allUpdates.length === 0) {
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text("No weekly updates recorded for this project.", 60, yPos);
          } else {
            allUpdates.forEach((item, index) => {
              const update = item.update;
              
              // Check if we need a new page
              if (yPos + 120 > 750) {
                doc.addPage();
                yPos = 50;
              }
              
              // Update box
              doc
                .rect(50, yPos, 495, 100)
                .lineWidth(1)
                .strokeColor("#e5e7eb")
                .stroke();
              
              doc.rect(51, yPos + 1, 493, 98).fill("#f9fafb");

              // Header
              doc
                .rect(50, yPos, 495, 25)
                .fill(env.BRAND_ACCENT_COLOR);
              
              doc
                .fontSize(10)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text(`Week ${index + 1}: ${new Date(update.weekStartDate).toLocaleDateString("en-ZA")} - ${new Date(update.weekEndDate).toLocaleDateString("en-ZA")}`, 60, yPos + 7);

              yPos += 30;
              
              doc
                .fontSize(9)
                .fillColor("#666666")
                .font("Helvetica")
                .text("Milestone:", 60, yPos, { width: 70 })
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(item.milestoneName, 130, yPos, { width: 200 })
                .fillColor("#666666")
                .font("Helvetica")
                .text("Progress:", 350, yPos, { width: 60 })
                .fillColor(env.BRAND_SUCCESS_COLOR)
                .font("Helvetica-Bold")
                .text(`${update.progressPercentage}%`, 410, yPos);
              
              yPos += 15;
              
              doc
                .fillColor("#666666")
                .font("Helvetica")
                .text("Expenditure:", 60, yPos, { width: 70 })
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(`R${update.totalExpenditure.toLocaleString("en-ZA")}`, 130, yPos, { width: 100 })
                .fillColor("#666666")
                .font("Helvetica")
                .text("(Labour: R" + update.labourExpenditure.toLocaleString("en-ZA") + 
                      ", Material: R" + update.materialExpenditure.toLocaleString("en-ZA") + 
                      ", Other: R" + update.otherExpenditure.toLocaleString("en-ZA") + ")", 230, yPos, { width: 305 });
              
              yPos += 20;
              
              if (update.workDone) {
                doc
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text("Work Done:", 60, yPos, { width: 70 })
                  .fillColor("#333333")
                  .text(update.workDone.substring(0, 150) + (update.workDone.length > 150 ? "..." : ""), 130, yPos, { width: 405 });
                
                yPos += 20;
              }
              
              yPos += 15;
            });
          }

          // ===== PROJECT STATISTICS =====
          
          yPos += 20;
          
          // Check if we need a new page
          if (yPos + 120 > 750) {
            doc.addPage();
            yPos = 50;
          }
          
          doc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("PROJECT STATISTICS", 50, yPos);
          
          yPos += 25;

          const completedMilestones = project.milestones.filter(m => m.status === "COMPLETED").length;
          const totalWeeklyUpdates = allUpdates.length;
          const averageProgress = project.milestones.length > 0 
            ? project.milestones.reduce((sum, m) => sum + m.progressPercentage, 0) / project.milestones.length 
            : 0;

          // Statistics grid
          const statsData = [
            { label: "Total Milestones", value: project.milestones.length.toString() },
            { label: "Completed Milestones", value: completedMilestones.toString() },
            { label: "Weekly Updates", value: totalWeeklyUpdates.toString() },
            { label: "Average Progress", value: `${averageProgress.toFixed(1)}%` },
          ];

          statsData.forEach((stat, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const xPos = 50 + col * 250;
            const yPosBox = yPos + row * 50;
            
            doc
              .rect(xPos, yPosBox, 240, 40)
              .fill("#f9fafb");
            
            doc
              .rect(xPos, yPosBox, 240, 40)
              .lineWidth(1)
              .strokeColor("#e5e7eb")
              .stroke();
            
            doc
              .fontSize(9)
              .fillColor("#666666")
              .font("Helvetica")
              .text(stat.label, xPos + 10, yPosBox + 8, { width: 220 })
              .fontSize(16)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text(stat.value, xPos + 10, yPosBox + 20, { width: 220 });
          });

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
          console.error("Error generating project report PDF:", error);
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
