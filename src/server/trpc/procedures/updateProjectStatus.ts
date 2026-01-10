import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { Prisma } from "@prisma/client";
import { sendCompletionReportEmail } from "~/server/utils/email";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";

export const updateProjectStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Use a transaction to update both project and milestones atomically
      const result = await db.$transaction(async (tx) => {
        // Get the current project status before updating
        const currentProject = await tx.project.findUnique({
          where: { id: input.projectId },
          select: { status: true },
        });

        if (!currentProject) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "Project not found",
          });
        }

        // Update the project status
        const project = await tx.project.update({
          where: { id: input.projectId },
          data: { status: input.status },
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        });

        // Handle milestone status transitions based on project status change
        const oldStatus = currentProject.status;
        const newStatus = input.status;

        // When moving from PLANNING to IN_PROGRESS, transition PLANNING milestones to NOT_STARTED
        // so artisans can start working on them
        if (oldStatus === "PLANNING" && newStatus === "IN_PROGRESS") {
          await tx.milestone.updateMany({
            where: {
              projectId: input.projectId,
              status: "PLANNING",
            },
            data: {
              status: "NOT_STARTED",
            },
          });
        }

        // When moving from IN_PROGRESS back to PLANNING, transition NOT_STARTED milestones back to PLANNING
        if (oldStatus === "IN_PROGRESS" && newStatus === "PLANNING") {
          await tx.milestone.updateMany({
            where: {
              projectId: input.projectId,
              status: "NOT_STARTED",
            },
            data: {
              status: "PLANNING",
            },
          });
        }

        // When moving to ON_HOLD, transition IN_PROGRESS milestones to ON_HOLD as well
        if (newStatus === "ON_HOLD" && oldStatus !== "ON_HOLD") {
          await tx.milestone.updateMany({
            where: {
              projectId: input.projectId,
              status: "IN_PROGRESS",
            },
            data: {
              status: "ON_HOLD",
            },
          });
        }

        // When moving from ON_HOLD back to IN_PROGRESS, transition ON_HOLD milestones back to IN_PROGRESS
        if (oldStatus === "ON_HOLD" && newStatus === "IN_PROGRESS") {
          await tx.milestone.updateMany({
            where: {
              projectId: input.projectId,
              status: "ON_HOLD",
            },
            data: {
              status: "IN_PROGRESS",
            },
          });
        }

        return project;
      });

      // If project is completed, send completion report email to customer
      if (input.status === "COMPLETED") {
        try {
          console.log(`[updateProjectStatus] Project ${input.projectId} marked as COMPLETED, preparing to send email...`);
          
          // Fetch full project data for PDF generation
          const fullProject = await db.project.findUnique({
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

          if (!fullProject) {
            throw new Error("Project not found for PDF generation");
          }

          // Generate the Project Report PDF inline
          const pdfDoc = new PDFDocument({ margin: 50 });
          const pdfChunks: Buffer[] = [];

          pdfDoc.on("data", (chunk) => pdfChunks.push(chunk));

          const pdfBufferPromise = new Promise<Buffer>((resolve, reject) => {
            pdfDoc.on("end", () => {
              const buffer = Buffer.concat(pdfChunks);
              resolve(buffer);
            });
            pdfDoc.on("error", reject);
          });

          const pdfCompanyDetails = await getCompanyDetails();

          // ===== HEADER SECTION WITH BRAND BANNER =====
          pdfDoc.rect(0, 0, 595, 140).fill(env.BRAND_PRIMARY_COLOR);
          pdfDoc.rect(0, 135, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

          const pdfLogoBuffer = await getCompanyLogo();
          if (pdfLogoBuffer) {
            try {
              pdfDoc.circle(100, 70, 45).fill("#ffffff").opacity(1);
              pdfDoc.opacity(1);
              pdfDoc.image(pdfLogoBuffer, 55, 25, { width: 90 });
            } catch (error) {
              console.error("Error adding logo to PDF:", error);
            }
          }

          pdfDoc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text(pdfCompanyDetails.companyName, 320, 35, { align: "right", width: 225 })
            .font("Helvetica")
            .fontSize(9)
            .text(pdfCompanyDetails.companyAddressLine1, 320, 52, { align: "right", width: 225 })
            .text(pdfCompanyDetails.companyAddressLine2, 320, 65, { align: "right", width: 225 })
            .text(`Tel: ${pdfCompanyDetails.companyPhone}`, 320, 85, { align: "right", width: 225 })
            .text(`Email: ${pdfCompanyDetails.companyEmail}`, 320, 98, { align: "right", width: 225 })
            .text(`VAT: ${pdfCompanyDetails.companyVatNumber}`, 320, 111, { align: "right", width: 225 });

          // ===== REPORT TITLE =====
          pdfDoc
            .fontSize(28)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("PROJECT COMPLETION REPORT", 50, 170);

          pdfDoc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text(`Project No: ${fullProject.projectNumber}`, 50, 210)
            .fillColor(env.BRAND_ACCENT_COLOR)
            .text(`Completed: ${new Date().toLocaleDateString("en-ZA", { 
              year: "numeric", 
              month: "long", 
              day: "numeric" 
            })}`, 50, 225);

          // ===== PROJECT OVERVIEW BOX =====
          const overviewBoxTop = 260;
          pdfDoc
            .rect(50, overviewBoxTop, 495, 140)
            .lineWidth(2)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .stroke();
          pdfDoc.rect(51, overviewBoxTop + 1, 493, 138).fill("#f9fafb");
          pdfDoc.rect(50, overviewBoxTop, 495, 28).fill(env.BRAND_ACCENT_COLOR);
          pdfDoc
            .fontSize(11)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("PROJECT OVERVIEW", 60, overviewBoxTop + 8);

          let infoYPos = overviewBoxTop + 38;
          pdfDoc
            .fontSize(10)
            .fillColor("#1a1a1a")
            .font("Helvetica-Bold")
            .text(fullProject.name, 60, infoYPos, { width: 475 });
          infoYPos += 20;

          pdfDoc
            .fontSize(9)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Customer:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(fullProject.customerName, 140, infoYPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Type:", 310, infoYPos, { width: 50 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(fullProject.projectType, 360, infoYPos, { width: 175 });
          infoYPos += 15;

          pdfDoc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Email:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .text(fullProject.customerEmail, 140, infoYPos, { width: 150 })
            .fillColor("#666666")
            .text("Phone:", 310, infoYPos, { width: 50 })
            .fillColor("#333333")
            .text(fullProject.customerPhone, 360, infoYPos, { width: 175 });
          infoYPos += 15;

          pdfDoc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Address:", 60, infoYPos, { width: 80 })
            .fillColor("#333333")
            .text(fullProject.address, 140, infoYPos, { width: 395 });
          infoYPos += 20;

          if (fullProject.startDate) {
            pdfDoc
              .fillColor("#666666")
              .font("Helvetica")
              .text("Start Date:", 60, infoYPos, { width: 80 })
              .fillColor("#333333")
              .font("Helvetica-Bold")
              .text(new Date(fullProject.startDate).toLocaleDateString("en-ZA"), 140, infoYPos, { width: 150 });
          }

          if (fullProject.endDate) {
            pdfDoc
              .fillColor("#666666")
              .font("Helvetica")
              .text("End Date:", 310, infoYPos, { width: 50 })
              .fillColor("#333333")
              .font("Helvetica-Bold")
              .text(new Date(fullProject.endDate).toLocaleDateString("en-ZA"), 360, infoYPos, { width: 175 });
          }

          // ===== FINANCIAL SUMMARY =====
          let pdfYPos = 425;
          pdfDoc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("FINANCIAL SUMMARY", 50, pdfYPos);
          pdfYPos += 25;

          const totalMilestoneBudget = fullProject.milestones.reduce((sum, m) => sum + m.budgetAllocated, 0);
          const totalMilestoneActual = fullProject.milestones.reduce((sum, m) => sum + m.actualCost, 0);
          const variance = totalMilestoneActual - (fullProject.estimatedBudget || totalMilestoneBudget);
          const isOverBudget = variance > 0;

          pdfDoc.rect(50, pdfYPos, 495, 80).fill("#f9fafb");
          pdfDoc.rect(50, pdfYPos, 495, 80).lineWidth(1).strokeColor("#e5e7eb").stroke();
          pdfYPos += 15;

          pdfDoc
            .fontSize(10)
            .fillColor("#666666")
            .font("Helvetica")
            .text("Estimated Budget:", 60, pdfYPos, { width: 150 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${(fullProject.estimatedBudget || totalMilestoneBudget).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, pdfYPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Actual Cost:", 370, pdfYPos, { width: 80 })
            .fillColor("#333333")
            .font("Helvetica-Bold")
            .text(`R${fullProject.actualCost.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 450, pdfYPos, { width: 85, align: "right" });
          pdfYPos += 25;

          pdfDoc
            .fillColor("#666666")
            .font("Helvetica")
            .text("Budget Variance:", 60, pdfYPos, { width: 150 })
            .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
            .font("Helvetica-Bold")
            .text(`${isOverBudget ? "+" : ""}R${variance.toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`, 210, pdfYPos, { width: 150 })
            .fillColor("#666666")
            .font("Helvetica")
            .text("Status:", 370, pdfYPos, { width: 80 })
            .fillColor(isOverBudget ? "#dc2626" : "#16a34a")
            .font("Helvetica-Bold")
            .text(isOverBudget ? "OVER BUDGET" : "UNDER BUDGET", 450, pdfYPos, { width: 85, align: "right" });

          // ===== MILESTONES SUMMARY =====
          pdfYPos += 50;
          pdfDoc
            .fontSize(14)
            .fillColor(env.BRAND_PRIMARY_COLOR)
            .font("Helvetica-Bold")
            .text("MILESTONES SUMMARY", 50, pdfYPos);
          pdfYPos += 25;

          pdfDoc.rect(50, pdfYPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
          pdfDoc.rect(50, pdfYPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

          pdfDoc
            .fontSize(9)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("MILESTONE", 60, pdfYPos + 7, { width: 200 })
            .text("STATUS", 270, pdfYPos + 7, { width: 70, align: "center" })
            .text("BUDGET", 350, pdfYPos + 7, { width: 80, align: "right" })
            .text("ACTUAL", 440, pdfYPos + 7, { width: 95, align: "right" });
          pdfYPos += 30;

          fullProject.milestones.forEach((milestone, index) => {
            if (pdfYPos + 20 > 750) {
              pdfDoc.addPage();
              pdfYPos = 50;
            }

            if (index % 2 === 0) {
              pdfDoc.rect(50, pdfYPos - 3, 495, 18).fill("#f9fafb");
            } else {
              pdfDoc.rect(50, pdfYPos - 3, 495, 18).fill("#ffffff");
            }

            const statusColor = 
              milestone.status === "COMPLETED" ? "#16a34a" :
              milestone.status === "IN_PROGRESS" ? "#2563eb" :
              milestone.status === "ON_HOLD" ? "#f59e0b" :
              "#6b7280";

            pdfDoc
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(milestone.name, 60, pdfYPos, { width: 200 })
              .fillColor(statusColor)
              .font("Helvetica-Bold")
              .fontSize(8)
              .text(milestone.status.replace(/_/g, " "), 270, pdfYPos + 2, { width: 70, align: "center" })
              .fontSize(9)
              .fillColor("#333333")
              .font("Helvetica")
              .text(`R${milestone.budgetAllocated.toLocaleString("en-ZA")}`, 350, pdfYPos, { width: 80, align: "right" })
              .font("Helvetica-Bold")
              .text(`R${milestone.actualCost.toLocaleString("en-ZA")}`, 440, pdfYPos, { width: 95, align: "right" });

            pdfYPos += 18;
          });

          pdfDoc.rect(50, pdfYPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
          pdfDoc
            .fontSize(10)
            .fillColor("#ffffff")
            .font("Helvetica-Bold")
            .text("TOTAL", 60, pdfYPos + 7)
            .text(`R${totalMilestoneBudget.toLocaleString("en-ZA")}`, 350, pdfYPos + 7, { width: 80, align: "right" })
            .text(`R${totalMilestoneActual.toLocaleString("en-ZA")}`, 440, pdfYPos + 7, { width: 95, align: "right" });

          // ===== FOOTER =====
          pdfDoc
            .moveTo(50, 770)
            .lineTo(545, 770)
            .strokeColor(env.BRAND_ACCENT_COLOR)
            .lineWidth(1)
            .stroke();

          pdfDoc
            .fontSize(8)
            .fillColor("#999999")
            .font("Helvetica")
            .text(
              `${pdfCompanyDetails.companyName} | ${pdfCompanyDetails.companyEmail} | VAT Reg: ${pdfCompanyDetails.companyVatNumber}`,
              50,
              778,
              { align: "center", width: 495 }
            );

          pdfDoc.end();

          // Wait for PDF generation to complete
          const pdfBuffer = await pdfBufferPromise;
          
          console.log(`[updateProjectStatus] Project PDF generated successfully, size: ${pdfBuffer.length} bytes`);

          // Send the completion email
          await sendCompletionReportEmail({
            customerEmail: fullProject.customerEmail,
            customerName: fullProject.customerName,
            completionType: "PROJECT",
            completionTitle: fullProject.name,
            completionDate: new Date(),
            pdfBuffer,
            pdfFilename: `Project_${fullProject.projectNumber}_Completion_Report.pdf`,
            additionalDetails: `Project Type: ${fullProject.projectType}`,
          });

          console.log(`[updateProjectStatus] Completion report email sent successfully to ${fullProject.customerEmail}`);
        } catch (emailError) {
          // Log the error but don't fail the project update
          console.error("[updateProjectStatus] Failed to send completion report email:", emailError);
          // We don't throw here because the project update was successful
          // The email failure shouldn't rollback the project completion
        }
      }

      return result;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
