import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getContractorLogo, getPropertyManagerLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getInternalMinioUrl } from "~/server/minio";
import { authenticateUser } from "~/server/utils/auth";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";

export const generateOrderPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Authenticate user and get their role
      const authenticatedUser = await authenticateUser(input.token);

      let order: any = null;

      // Check if this is a PM order or regular order
      if (input.isPMOrder) {
        order = await db.propertyManagerOrder.findUnique({
          where: { id: input.orderId },
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
                pmCompanyEmail: true,
                pmCompanyVatNumber: true,
                pmCompanyBankName: true,
                pmCompanyBankAccountName: true,
                pmCompanyBankAccountNumber: true,
                pmCompanyBankBranchCode: true,
                pmBrandPrimaryColor: true,
                pmBrandSecondaryColor: true,
                pmBrandAccentColor: true,
              },
            },
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            progressUpdates: {
              orderBy: {
                createdAt: "desc",
              },
            },
            materials: true,
            jobActivities: {
              include: {
                artisan: {
                  select: {
                    firstName: true,
                    lastName: true,
                  },
                },
              },
            },
            expenseSlips: true,
          },
        });
      } else {
        order = await db.order.findUnique({
          where: { id: input.orderId },
          include: {
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            materials: true,
            jobActivities: true,
            expenseSlips: true,
            invoice: {
              select: {
                invoiceNumber: true,
                total: true,
                status: true,
                paidDate: true,
                dueDate: true,
              },
            },
          },
        });
      }

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      console.log(`[generateOrderPdf] Order ${input.orderId} loaded:`, {
        isPMOrder: input.isPMOrder,
        orderNumber: order.orderNumber,
        hasMaterials: order.materials?.length > 0,
        hasExpenseSlips: order.expenseSlips?.length > 0,
        hasInvoice: !!order.invoice,
        materialCost: order.materialCost,
        labourCost: order.labourCost,
        userRole: authenticatedUser.role,
      });

      // Determine which company details to use based on user role
      // Contractors/Admins viewing orders should see their own company details
      // Property Managers should see system/PM company details
      let companyDetails: any;
      let logoBuffer: Buffer | null = null;

      const isContractorOrAdmin = [
        "CONTRACTOR",
        "CONTRACTOR_JUNIOR_MANAGER",
        "CONTRACTOR_SENIOR_MANAGER",
        "ADMIN",
        "ARTISAN"
      ].includes(authenticatedUser.role);

      if (isContractorOrAdmin) {
        // For contractors/admins, try to get contractor company details from their user profile
        const contractorUser = await db.user.findUnique({
          where: { id: authenticatedUser.id },
          select: {
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
        });

        // Use contractor details if available, otherwise fall back to system details
        if (contractorUser?.contractorCompanyName) {
          companyDetails = {
            companyName: contractorUser.contractorCompanyName,
            companyAddressLine1: contractorUser.contractorCompanyAddressLine1 || "",
            companyAddressLine2: contractorUser.contractorCompanyAddressLine2 || "",
            companyPhone: contractorUser.contractorCompanyPhone || "",
            companyEmail: contractorUser.contractorCompanyEmail || "",
            companyVatNumber: contractorUser.contractorCompanyVatNumber || "",
            companyBankName: contractorUser.contractorCompanyBankName || "",
            companyBankAccountName: contractorUser.contractorCompanyBankAccountName || "",
            companyBankAccountNumber: contractorUser.contractorCompanyBankAccountNumber || "",
            companyBankBranchCode: contractorUser.contractorCompanyBankBranchCode || "",
          };
        } else {
          companyDetails = await getCompanyDetails();
        }
        
        // Use contractor logo (falls back to default if not set)
        logoBuffer = await getContractorLogo();
      } else {
        // Property managers or other roles
        // For PM orders, use the PM's company details
        if (input.isPMOrder && order.propertyManager) {
          companyDetails = {
            companyName: order.propertyManager.pmCompanyName || env.COMPANY_NAME || "Square 15 Facility Solutions",
            companyAddressLine1: order.propertyManager.pmCompanyAddressLine1 || "",
            companyAddressLine2: order.propertyManager.pmCompanyAddressLine2 || "",
            companyPhone: order.propertyManager.pmCompanyPhone || "",
            companyEmail: order.propertyManager.pmCompanyEmail || "",
            companyVatNumber: order.propertyManager.pmCompanyVatNumber || "",
            companyBankName: order.propertyManager.pmCompanyBankName || "",
            companyBankAccountName: order.propertyManager.pmCompanyBankAccountName || "",
            companyBankAccountNumber: order.propertyManager.pmCompanyBankAccountNumber || "",
            companyBankBranchCode: order.propertyManager.pmCompanyBankBranchCode || "",
          };
        } else {
          // Non-PM orders use system company details
          companyDetails = await getCompanyDetails();
        }
        logoBuffer = await getPropertyManagerLogo();
      }

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

        // Wrap all PDF generation in try-catch
        (async () => {
          try {
            // Determine what financial information to show based on user role
            // Only show detailed financials to contractors, admins, and artisans (not to customers or property managers)
            const showFinancials = authenticatedUser.role !== "CUSTOMER" && authenticatedUser.role !== "PROPERTY_MANAGER";
            
            console.log(`[generateOrderPdf] PDF generation settings:`, {
              showFinancials,
              userRole: authenticatedUser.role,
              hasExpenseSlips: order.expenseSlips?.length > 0,
              hasInvoice: !!order.invoice,
            });
            
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

            // ===== ORDER TITLE AND STATUS =====
            
            doc
              .fontSize(28)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("ORDER SUMMARY", 50, 170);

            // Status badge with brand colors
            const statusColor = order.status === "COMPLETED" 
              ? env.BRAND_SUCCESS_COLOR 
              : order.status === "IN_PROGRESS" 
              ? env.BRAND_WARNING_COLOR 
              : env.BRAND_ACCENT_COLOR;
            const statusBg = order.status === "COMPLETED"
              ? "#d1fae5"
              : order.status === "IN_PROGRESS"
              ? "#fef3c7"
              : "#e0f2fe";
            
            // Status badge background
            doc.rect(450, 172, 95, 20).fill(statusBg);
            doc
              .fontSize(10)
              .fillColor(statusColor)
              .font("Helvetica-Bold")
              .text(order.status.replace(/_/g, " "), 450, 177, { width: 95, align: "center" });

            // Order details
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text(`Order No: ${order.orderNumber}`, 50, 210)
              .fillColor(env.BRAND_ACCENT_COLOR)
              .text(`Created: ${new Date(order.createdAt).toLocaleDateString("en-ZA", { 
                year: "numeric", 
                month: "long", 
                day: "numeric" 
              })}`, 50, 225);

            // ===== CUSTOMER DETAILS BOX =====
            
            const customerBoxTop = 260;
            
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
              .text("CUSTOMER DETAILS", 60, customerBoxTop + 8);

            // Customer information
            doc
              .fontSize(10)
              .fillColor("#1a1a1a")
              .font("Helvetica-Bold")
              .text(order.customerName, 60, customerBoxTop + 38, { width: 220 })
              .font("Helvetica")
              .fontSize(9)
              .fillColor("#333333")
              .text(order.address, 60, customerBoxTop + 53, { width: 220 })
              .text(order.customerEmail, 60, customerBoxTop + 73, { width: 220 })
              .text(`Tel: ${order.customerPhone}`, 60, customerBoxTop + 88, { width: 220 });

            // ===== ARTISAN DETAILS BOX =====
            
            const artisanBoxLeft = 310;
            
            if (order.assignedTo) {
              // Box with primary color border
              doc
                .rect(artisanBoxLeft, customerBoxTop, 235, 110)
                .lineWidth(2)
                .strokeColor(env.BRAND_PRIMARY_COLOR)
                .stroke();
              
              // Light background
              doc.rect(artisanBoxLeft + 1, customerBoxTop + 1, 233, 108).fill("#f9fafb");

              // Header with primary color
              doc
                .rect(artisanBoxLeft, customerBoxTop, 235, 28)
                .fill(env.BRAND_PRIMARY_COLOR);
              
              doc
                .fontSize(11)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("ASSIGNED ARTISAN", artisanBoxLeft + 10, customerBoxTop + 8);

              // Artisan information
              doc
                .fontSize(10)
                .fillColor("#1a1a1a")
                .font("Helvetica-Bold")
                .text(
                  `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
                  artisanBoxLeft + 10,
                  customerBoxTop + 38,
                  { width: 215 }
                )
                .font("Helvetica")
                .fontSize(9)
                .fillColor("#333333")
                .text(
                  order.assignedTo.email,
                  artisanBoxLeft + 10,
                  customerBoxTop + 53,
                  { width: 215 }
                )
                .text(
                  `Tel: ${order.assignedTo.phone || "N/A"}`,
                  artisanBoxLeft + 10,
                  customerBoxTop + 68,
                  { width: 215 }
                );
            }

            // ===== SERVICE DETAILS SECTION =====
            
            let yPos = 395;
            
            doc
              .fontSize(14)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("SERVICE DETAILS", 50, yPos);
            
            yPos += 25;

            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text("Service Type:", 60, yPos, { width: 100 })
              .fillColor("#1a1a1a")
              .font("Helvetica-Bold")
              .text(order.serviceType, 160, yPos, { width: 385 });

            yPos += 20;

            doc
              .fillColor("#666666")
              .font("Helvetica")
              .text("Description:", 60, yPos, { width: 100 })
              .fillColor("#333333")
              .text(order.description, 160, yPos, { width: 385, align: "justify" });

            // ===== TIME TRACKING =====
            
            if (order.startTime) {
              yPos += 50;
              
              doc
                .fontSize(14)
                .fillColor(env.BRAND_PRIMARY_COLOR)
                .font("Helvetica-Bold")
                .text("TIME TRACKING", 50, yPos);
              
              yPos += 25;

              doc
                .fontSize(10)
                .fillColor("#666666")
                .font("Helvetica")
                .text("Start Time:", 60, yPos, { width: 100 })
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(
                  new Date(order.startTime).toLocaleString("en-ZA"),
                  160,
                  yPos,
                  { width: 180 }
                );

              if (order.endTime) {
                doc
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text("End Time:", 360, yPos, { width: 80 })
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(
                    new Date(order.endTime).toLocaleString("en-ZA"),
                    440,
                    yPos,
                    { width: 105 }
                  );

                yPos += 20;

                const duration = Math.round(
                  (new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 
                  (1000 * 60)
                );
                const hours = Math.floor(duration / 60);
                const minutes = duration % 60;

                doc
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text("Duration:", 60, yPos, { width: 100 })
                  .fillColor(env.BRAND_SUCCESS_COLOR)
                  .font("Helvetica-Bold")
                  .text(`${hours}h ${minutes}m (${duration} minutes)`, 160, yPos, { width: 180 });
              }
            }

            // ===== MATERIALS TABLE =====
            
            if (order.materials && order.materials.length > 0) {
              yPos += 50;
              
              doc
                .fontSize(14)
                .fillColor(env.BRAND_PRIMARY_COLOR)
                .font("Helvetica-Bold")
                .text("MATERIALS USED", 50, yPos);
              
              yPos += 25;

              // Table header with gradient effect
              doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
              doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

              doc
                .fontSize(9)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("MATERIAL", 60, yPos + 7, { width: 220 })
                .text("QTY", 290, yPos + 7, { width: 50, align: "right" })
                .text("UNIT PRICE", 350, yPos + 7, { width: 80, align: "right" })
                .text("TOTAL", 440, yPos + 7, { width: 95, align: "right" });

              yPos += 30;

              // Material rows with enhanced styling
              order.materials.forEach((material: any, index: number) => {
                // Alternate row colors
                if (index % 2 === 0) {
                  doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
                } else {
                  doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
                }

                doc
                  .fontSize(9)
                  .fillColor("#333333")
                  .font("Helvetica")
                  .text(material.name, 60, yPos, { width: 220 })
                  .text(material.quantity.toString(), 290, yPos, { width: 50, align: "right" })
                  .text(`R${(material.unitPrice || 0).toFixed(2)}`, 350, yPos, { width: 80, align: "right" })
                  .font("Helvetica-Bold")
                  .text(`R${(material.totalCost || 0).toFixed(2)}`, 440, yPos, { width: 95, align: "right" });

                yPos += 18;
              });
            }

            // ===== JOB ACTIVITIES / LABOR SECTION =====
            // Only show to contractors, admins, and artisans (not to customers or property managers)
            if (showFinancials && order.jobActivities && order.jobActivities.length > 0) {
              yPos += 50;
              
              // Check if we need a new page
              if (yPos > 650) {
                doc.addPage();
                yPos = 50;
              }
              
              doc
                .fontSize(14)
                .fillColor(env.BRAND_PRIMARY_COLOR)
                .font("Helvetica-Bold")
                .text("LABOR / JOB ACTIVITIES", 50, yPos);
              
              yPos += 25;

              // Table header
              doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
              doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

              doc
                .fontSize(9)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("DESCRIPTION", 60, yPos + 7, { width: 200 })
                .text("HOURS", 270, yPos + 7, { width: 60, align: "right" })
                .text("RATE/HR", 340, yPos + 7, { width: 80, align: "right" })
                .text("TOTAL", 430, yPos + 7, { width: 105, align: "right" });

              yPos += 30;

              // Job activity rows
              let totalLaborCost = 0;
              order.jobActivities.forEach((activity: any, index: number) => {
                // Check if we need a new page
                if (yPos > 720) {
                  doc.addPage();
                  yPos = 50;
                }

                // Alternate row colors
                if (index % 2 === 0) {
                  doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
                } else {
                  doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
                }

                // Calculate hours worked
                const hoursWorked = activity.hoursWorked || (activity.durationMinutes ? (activity.durationMinutes / 60).toFixed(2) : 0);
                const rate = activity.rate || order.labourRate || 0;
                const activityTotal = Number(hoursWorked) * rate;
                totalLaborCost += activityTotal;

                doc
                  .fontSize(9)
                  .fillColor("#333333")
                  .font("Helvetica")
                  .text(activity.description || "Labor work", 60, yPos, { width: 200 })
                  .text(hoursWorked.toString(), 270, yPos, { width: 60, align: "right" })
                  .text(`R${rate.toFixed(2)}`, 340, yPos, { width: 80, align: "right" })
                  .font("Helvetica-Bold")
                  .text(`R${activityTotal.toFixed(2)}`, 430, yPos, { width: 105, align: "right" });

                yPos += 18;
              });

              // Total row
              yPos += 5;
              doc.rect(330, yPos - 3, 215, 22).fill(env.BRAND_ACCENT_COLOR);
              doc
                .fontSize(10)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("TOTAL LABOR COST:", 340, yPos + 2, { width: 150, align: "left" })
                .text(`R${totalLaborCost.toFixed(2)}`, 430, yPos + 2, { width: 105, align: "right" });
              
              yPos += 30;
            }

            // ===== EXPENSE SLIPS SECTION =====
            // Only show expense slips to contractors, admins, and artisans (not to customers or property managers)
            if (showFinancials && order.expenseSlips && order.expenseSlips.length > 0) {
              yPos += 50;
              
              // Check if we need a new page
              if (yPos > 650) {
                doc.addPage();
                yPos = 50;
              }
              
              doc
                .fontSize(14)
                .fillColor(env.BRAND_PRIMARY_COLOR)
                .font("Helvetica-Bold")
                .text("EXPENSE SLIPS & PURCHASES", 50, yPos);
              
              yPos += 25;

              // Table header
              doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
              doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

              doc
                .fontSize(9)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("CATEGORY", 60, yPos + 7, { width: 100 })
                .text("DESCRIPTION", 170, yPos + 7, { width: 180 })
                .text("AMOUNT", 440, yPos + 7, { width: 95, align: "right" });

              yPos += 30;

              // Expense slip rows
              let totalExpenseAmount = 0;
              order.expenseSlips.forEach((slip: any, index: number) => {
                // Check if we need a new page
                if (yPos > 720) {
                  doc.addPage();
                  yPos = 50;
                }

                // Alternate row colors
                if (index % 2 === 0) {
                  doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
                } else {
                  doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
                }

                // Category label mapping
                const categoryLabels: Record<string, string> = {
                  MATERIALS: "Materials",
                  TOOLS: "Tools",
                  TRANSPORTATION: "Transportation",
                  OTHER: "Other",
                };

                doc
                  .fontSize(9)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(categoryLabels[slip.category] || slip.category, 60, yPos, { width: 100 })
                  .font("Helvetica")
                  .text(slip.description || "No description", 170, yPos, { width: 180 })
                  .font("Helvetica-Bold");
                
                if (slip.amount !== null && slip.amount !== undefined) {
                  doc.text(`R${slip.amount.toFixed(2)}`, 440, yPos, { width: 95, align: "right" });
                  totalExpenseAmount += slip.amount;
                } else {
                  doc.text("N/A", 440, yPos, { width: 95, align: "right" });
                }

                yPos += 18;
              });

              // Total row
              yPos += 5;
              doc.rect(380, yPos - 3, 165, 22).fill(env.BRAND_ACCENT_COLOR);
              doc
                .fontSize(10)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("TOTAL FROM SLIPS:", 390, yPos + 2, { width: 140, align: "left" })
                .text(`R${totalExpenseAmount.toFixed(2)}`, 440, yPos + 2, { width: 95, align: "right" });
              
              yPos += 30;

              // ===== EXPENSE SLIP IMAGES =====
              // Fetch and display images for each slip that has a URL
              for (const slip of order.expenseSlips) {
                if (slip.url) {
                  // Check if we need a new page (image needs ~300px)
                  if (yPos > 450) {
                    doc.addPage();
                    yPos = 50;
                  }

                  doc
                    .fontSize(11)
                    .fillColor(env.BRAND_PRIMARY_COLOR)
                    .font("Helvetica-Bold")
                    .text(`Slip: ${slip.description || "No description"} - R${(slip.amount || 0).toFixed(2)}`, 50, yPos);
                  
                  yPos += 20;

                  try {
                    const slipImageBuffer = await fetchImageAsBuffer(slip.url);
                    if (slipImageBuffer) {
                      // Add image with border
                      doc.rect(50, yPos, 495, 250).stroke("#cccccc");
                      doc.image(slipImageBuffer, 55, yPos + 5, {
                        fit: [485, 240],
                        align: "center",
                        valign: "center",
                      });
                      yPos += 260;
                    } else {
                      doc
                        .fontSize(9)
                        .fillColor("#999999")
                        .font("Helvetica-Oblique")
                        .text("(Image could not be loaded)", 50, yPos);
                      yPos += 20;
                    }
                  } catch (error) {
                    console.error("Error loading expense slip image:", error);
                    doc
                      .fontSize(9)
                      .fillColor("#999999")
                      .font("Helvetica-Oblique")
                      .text("(Error loading image)", 50, yPos);
                    yPos += 20;
                  }
                }
              }
            } // End of expense slips section

            // ===== COST BREAKDOWN =====
            // Only show cost breakdown to contractors, admins, and artisans (not to customers or property managers)
            if (showFinancials) {
              yPos += 40;
              
              // Check if we need a new page
              if (yPos > 650) {
                doc.addPage();
                yPos = 50;
              }

              // Box with primary border
              doc
                .rect(50, yPos, 495, 130)
                .lineWidth(2)
                .strokeColor(env.BRAND_PRIMARY_COLOR)
                .stroke();
              
              doc.rect(51, yPos + 1, 493, 128).fill("#f9fafb");

              // Header
              doc.rect(50, yPos, 495, 30).fill(env.BRAND_PRIMARY_COLOR);
              doc
                .fontSize(12)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("COST BREAKDOWN", 60, yPos + 9);

              yPos += 40;

              const costItems = [
                { label: "Material Cost:", value: order.materialCost },
                { label: "Labour Cost:", value: order.labourCost },
                { label: "Call Out Fee:", value: order.callOutFee },
              ];

              costItems.forEach((item) => {
                doc
                  .fontSize(10)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text(item.label, 380, yPos, { width: 70, align: "right" })
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(`R${(item.value || 0).toFixed(2)}`, 460, yPos, { width: 75, align: "right" });
                yPos += 18;
              });

              if (order.labourRate) {
                doc
                  .fontSize(9)
                  .fillColor("#999999")
                  .font("Helvetica-Oblique")
                  .text(`(Labour rate: R${(order.labourRate || 0).toFixed(2)}/hr)`, 380, yPos, { 
                    width: 155, 
                    align: "right" 
                  });
                yPos += 18;
              }

              // Total with brand banner
              doc.rect(380, yPos - 5, 165, 28).fill(env.BRAND_PRIMARY_COLOR);
              doc.rect(380, yPos + 20, 165, 3).fill(env.BRAND_SECONDARY_COLOR);
              
              doc
                .fontSize(12)
                .fillColor("#ffffff")
                .font("Helvetica")
                .text("TOTAL COST:", 380, yPos + 3, { width: 70, align: "right" })
                .font("Helvetica-Bold")
                .text(`R${(order.totalCost || 0).toFixed(2)}`, 460, yPos + 3, { width: 75, align: "right" });
            } // End of cost breakdown section (hidden from customers)

            // ===== INVOICE & PAYMENT SECTION =====
            // Only show to contractors, admins, and artisans
            if (showFinancials && order.invoice) {
              yPos += 40;
              
              // Check if we need a new page
              if (yPos > 650) {
                doc.addPage();
                yPos = 50;
              }

              // Box with primary border
              doc
                .rect(50, yPos, 495, 110)
                .lineWidth(2)
                .strokeColor(env.BRAND_PRIMARY_COLOR)
                .stroke();
              
              doc.rect(51, yPos + 1, 493, 108).fill("#f9fafb");

              // Header
              doc.rect(50, yPos, 495, 30).fill(env.BRAND_PRIMARY_COLOR);
              doc
                .fontSize(12)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("INVOICE & PAYMENT STATUS", 60, yPos + 9);

              yPos += 40;

              // Invoice details
              doc
                .fontSize(10)
                .fillColor("#666666")
                .font("Helvetica")
                .text("Invoice Number:", 60, yPos)
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(order.invoice.invoiceNumber, 180, yPos);
              
              yPos += 18;

              doc
                .fontSize(10)
                .fillColor("#666666")
                .font("Helvetica")
                .text("Invoice Total:", 60, yPos)
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(`R${(order.invoice.total || 0).toFixed(2)}`, 180, yPos);
              
              yPos += 18;

              doc
                .fontSize(10)
                .fillColor("#666666")
                .font("Helvetica")
                .text("Payment Status:", 60, yPos);
              
              const isPaid = order.invoice.paidDate !== null;
              const statusColor = isPaid ? "#10b981" : "#ef4444";
              const statusText = isPaid ? "PAID" : order.invoice.status;
              
              doc
                .fillColor(statusColor)
                .font("Helvetica-Bold")
                .text(statusText, 180, yPos);
              
              yPos += 18;

              if (order.invoice.paidDate) {
                doc
                  .fontSize(10)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text("Paid Date:", 60, yPos)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(new Date(order.invoice.paidDate).toLocaleDateString("en-ZA"), 180, yPos);
              } else if (order.invoice.dueDate) {
                doc
                  .fontSize(10)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text("Due Date:", 60, yPos)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(new Date(order.invoice.dueDate).toLocaleDateString("en-ZA"), 180, yPos);
              }
            } // End of invoice section

            // ===== PICTURES SECTION =====
            
            yPos += 50;
            
            // Check if we need a new page for pictures section (250px) and signature section (130px)
            // Total space needed: ~400px
            if (yPos + 400 > 750) {
              doc.addPage();
              yPos = 50;
            }

            doc
              .fontSize(14)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("DOCUMENTATION", 50, yPos);
            
            yPos += 25;

            // Fetch all images first
            const beforeImageBuffers: Buffer[] = [];
            const afterImageBuffers: Buffer[] = [];

            // Fetch before pictures (limit to 4 for space - 2x2 grid)
            for (let i = 0; i < Math.min(order.beforePictures.length, 4); i++) {
              const buffer = await fetchImageAsBuffer(order.beforePictures[i]!);
              if (buffer) {
                beforeImageBuffers.push(buffer);
              }
            }

            // Fetch after pictures (limit to 4 for space - 2x2 grid)
            for (let i = 0; i < Math.min(order.afterPictures.length, 4); i++) {
              const buffer = await fetchImageAsBuffer(order.afterPictures[i]!);
              if (buffer) {
                afterImageBuffers.push(buffer);
              }
            }

            console.log(`[generateOrderPdf] Loaded ${beforeImageBuffers.length} before images (${order.beforePictures.length} available)`);
            console.log(`[generateOrderPdf] Loaded ${afterImageBuffers.length} after images (${order.afterPictures.length} available)`);

            const imageBoxHeight = 250;
            
            // Before pictures box
            doc
              .rect(50, yPos, 240, imageBoxHeight)
              .lineWidth(1)
              .strokeColor(env.BRAND_ACCENT_COLOR)
              .stroke();
            
            doc.rect(51, yPos + 1, 238, imageBoxHeight - 2).fill("#f9fafb");

            doc
              .rect(50, yPos, 240, 22)
              .fill(env.BRAND_ACCENT_COLOR);
            
            doc
              .fontSize(10)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("BEFORE PICTURES", 60, yPos + 6);

            // Display before images in 2x2 grid
            if (beforeImageBuffers.length > 0) {
              const imageStartY = yPos + 28;
              const imageWidth = 100;
              const imageHeight = 90;
              const imageSpacing = 10;
              
              beforeImageBuffers.forEach((buffer, index) => {
                try {
                  const xPos = 60 + (index % 2) * (imageWidth + imageSpacing);
                  const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                  
                  // Use only fit option to maintain aspect ratio
                  doc.image(buffer, xPos, yPosImg, {
                    fit: [imageWidth, imageHeight]
                  });
                  console.log(`[generateOrderPdf] Embedded before image ${index + 1}`);
                } catch (error) {
                  console.error(`[generateOrderPdf] Error embedding before image ${index}:`, error);
                }
              });
              
              // Show count if there are more images available
              if (order.beforePictures.length > beforeImageBuffers.length) {
                doc
                  .fontSize(8)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text(`+ ${order.beforePictures.length - beforeImageBuffers.length} more picture(s)`, 60, yPos + imageBoxHeight - 18, { width: 220 });
              }
            } else {
              doc
                .fontSize(8)
                .fillColor("#666666")
                .font("Helvetica")
                .text("No pictures uploaded", 60, yPos + 35);
              
              if (order.beforePictures.length > 0) {
                console.warn(`[generateOrderPdf] Failed to load any before pictures (${order.beforePictures.length} available in database)`);
              }
            }

            // After pictures box
            const afterBoxLeft = 305;
            doc
              .rect(afterBoxLeft, yPos, 240, imageBoxHeight)
              .lineWidth(1)
              .strokeColor(env.BRAND_ACCENT_COLOR)
              .stroke();
            
            doc.rect(afterBoxLeft + 1, yPos + 1, 238, imageBoxHeight - 2).fill("#f9fafb");

            doc
              .rect(afterBoxLeft, yPos, 240, 22)
              .fill(env.BRAND_ACCENT_COLOR);
            
            doc
              .fontSize(10)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("AFTER PICTURES", afterBoxLeft + 10, yPos + 6);

            // Display after images in 2x2 grid
            if (afterImageBuffers.length > 0) {
              const imageStartY = yPos + 28;
              const imageWidth = 100;
              const imageHeight = 90;
              const imageSpacing = 10;
              
              afterImageBuffers.forEach((buffer, index) => {
                try {
                  const xPos = afterBoxLeft + 10 + (index % 2) * (imageWidth + imageSpacing);
                  const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                  
                  // Use only fit option to maintain aspect ratio
                  doc.image(buffer, xPos, yPosImg, {
                    fit: [imageWidth, imageHeight]
                  });
                  console.log(`[generateOrderPdf] Embedded after image ${index + 1}`);
                } catch (error) {
                  console.error(`[generateOrderPdf] Error embedding after image ${index}:`, error);
                }
              });
              
              // Show count if there are more images available
              if (order.afterPictures.length > afterImageBuffers.length) {
                doc
                  .fontSize(8)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text(`+ ${order.afterPictures.length - afterImageBuffers.length} more picture(s)`, afterBoxLeft + 10, yPos + imageBoxHeight - 18, { width: 220 });
              }
            } else {
              doc
                .fontSize(8)
                .fillColor("#666666")
                .font("Helvetica")
                .text("No pictures uploaded", afterBoxLeft + 10, yPos + 35);
              
              if (order.afterPictures.length > 0) {
                console.warn(`[generateOrderPdf] Failed to load any after pictures (${order.afterPictures.length} available in database)`);
              }
            }

            yPos += imageBoxHeight + 20;

            // Safety check: ensure signature section fits on current page
            // If not enough space (need ~130px for signature section), add new page
            if (yPos + 130 > 750) {
              doc.addPage();
              yPos = 50;
            }

            // Fetch signature image if available
            let signatureImageBuffer: Buffer | null = null;
            if (order.signedJobCardUrl) {
              console.log(`[generateOrderPdf] Attempting to load signature from: ${order.signedJobCardUrl}`);
              signatureImageBuffer = await fetchImageAsBuffer(order.signedJobCardUrl);
              if (signatureImageBuffer) {
                console.log(`[generateOrderPdf] Successfully loaded signature image`);
              } else {
                console.warn(`[generateOrderPdf] Failed to load signature image`);
              }
            } else {
              console.log(`[generateOrderPdf] No signature URL provided`);
            }

            // ===== SIGNATURE SECTION =====
            
            // Box with accent border
            doc
              .rect(50, yPos, 495, 120)
              .lineWidth(2)
              .strokeColor(env.BRAND_ACCENT_COLOR)
              .stroke();
            
            doc.rect(51, yPos + 1, 493, 118).fill("#f9fafb");

            // Header
            doc.rect(50, yPos, 495, 30).fill(env.BRAND_ACCENT_COLOR);
            doc
              .fontSize(12)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("CLIENT CONFIRMATION", 60, yPos + 9);

            yPos += 40;

            doc
              .fontSize(9)
              .fillColor("#666666")
              .font("Helvetica")
              .text(
                "I confirm that the work has been completed to my satisfaction.",
                60,
                yPos,
                { width: 475 }
              );

            yPos += 20;

            // Signature section with embedded image if available
            doc
              .fontSize(10)
              .fillColor("#333333")
              .font("Helvetica")
              .text("Signature:", 60, yPos);

            if (signatureImageBuffer) {
              try {
                // Embed the signature image with preserved aspect ratio
                doc.image(signatureImageBuffer, 140, yPos - 10, {
                  fit: [250, 50]
                });
                console.log(`[generateOrderPdf] Successfully embedded signature image`);
              } catch (error) {
                console.error("[generateOrderPdf] Error embedding signature image:", error);
                // Fallback to line if image fails
                doc.text("_________________________________", 140, yPos);
              }
            } else {
              if (order.signedJobCardUrl) {
                // Signature URL exists but failed to load - show a message
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Signature failed to load)", 140, yPos);
                console.error(`[generateOrderPdf] Signature URL exists but failed to load: ${order.signedJobCardUrl}`);
              } else {
                // No signature captured yet
                doc.text("_________________________________", 140, yPos);
              }
            }

            yPos += 30;

            // Display client representative name
            doc
              .fontSize(10)
              .fillColor("#333333")
              .font("Helvetica")
              .text("Name:", 60, yPos);
            
            if (order.clientRepName) {
              doc
                .font("Helvetica-Bold")
                .text(order.clientRepName, 140, yPos);
            } else {
              doc.text("_______________________", 140, yPos);
            }

            yPos += 25;

            // Display client representative sign date
            doc
              .font("Helvetica")
              .text("Date:", 60, yPos);
            
            if (order.clientRepSignDate) {
              doc
                .font("Helvetica-Bold")
                .text(
                  new Date(order.clientRepSignDate).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  }),
                  140,
                  yPos
                );
            } else {
              doc.text("_________________________________", 140, yPos);
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
            console.error("Error generating order PDF:", error);
            reject(error);
          }
        })();
      });
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
