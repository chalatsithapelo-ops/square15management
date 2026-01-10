import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { getInternalMinioUrl } from "~/server/minio";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";

export const generateJobCardPdf = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

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
              },
            },
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                contractorCompanyName: true,
                contractorCompanyAddressLine1: true,
                contractorCompanyAddressLine2: true,
                contractorCompanyPhone: true,
                contractorCompanyEmail: true,
                contractorCompanyVatNumber: true,
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
          },
        });
      } else {
        order = await db.order.findUnique({
          where: { id: input.orderId },
          include: {
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                contractorCompanyName: true,
                contractorCompanyAddressLine1: true,
                contractorCompanyAddressLine2: true,
                contractorCompanyPhone: true,
                contractorCompanyEmail: true,
                contractorCompanyVatNumber: true,
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
            materials: true,
          },
        });
      }

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // Get user details to check role
      const user = await db.user.findUnique({
        where: { id: parsed.userId },
        select: { role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: "User not found",
        });
      }

      // Authorization: Artisans must be assigned to the order, Contractors can access their orders
      const isArtisan = user.role === "ARTISAN";
      const isContractor = user.role === "CONTRACTOR" || user.role === "CONTRACTOR_JUNIOR_MANAGER" || user.role === "CONTRACTOR_SENIOR_MANAGER";
      
      if (isArtisan && order.assignedToId !== parsed.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You are not assigned to this order",
        });
      }
      
      // For PM orders, verify contractor has access
      if (input.isPMOrder && isContractor) {
        if (order.contractorId !== parsed.userId) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You do not have access to this order",
          });
        }
      }

      // Load all async data BEFORE creating the PDF document
      const systemCompanyDetails = await getCompanyDetails();
      
      // Use contractor's company details if available, otherwise fallback to system settings
      const companyDetails = {
        companyName: order.contractor?.contractorCompanyName || systemCompanyDetails.companyName,
        companyAddressLine1: order.contractor?.contractorCompanyAddressLine1 || systemCompanyDetails.companyAddressLine1,
        companyAddressLine2: order.contractor?.contractorCompanyAddressLine2 || systemCompanyDetails.companyAddressLine2,
        companyPhone: order.contractor?.contractorCompanyPhone || systemCompanyDetails.companyPhone,
        companyEmail: order.contractor?.contractorCompanyEmail || systemCompanyDetails.companyEmail,
        companyVatNumber: order.contractor?.contractorCompanyVatNumber || systemCompanyDetails.companyVatNumber,
      };
      
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

        // Wrap all PDF generation in try-catch with async IIFE
        (async () => {
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

            // ===== JOB CARD TITLE =====
            
            doc
              .fontSize(28)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("JOB CARD", 50, 170);

            // Job card details
            doc
              .fontSize(10)
              .fillColor("#666666")
              .font("Helvetica")
              .text(`Order No: ${order.orderNumber}`, 50, 210)
              .fillColor(env.BRAND_ACCENT_COLOR)
              .text(`Date: ${new Date().toLocaleDateString("en-ZA", { 
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
              .text(`Tel: ${order.customerPhone}`, 60, customerBoxTop + 73, { width: 220 });

            // ===== ARTISAN DETAILS BOX =====
            
            const artisanBoxLeft = 310;
            
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
              .text("ARTISAN DETAILS", artisanBoxLeft + 10, customerBoxTop + 8);

            // Artisan information
            if (order.assignedTo) {
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

            // ===== WORK DETAILS SECTION =====
            
            let yPos = 395;
            
            doc
              .fontSize(14)
              .fillColor(env.BRAND_PRIMARY_COLOR)
              .font("Helvetica-Bold")
              .text("WORK PERFORMED", 50, yPos);
            
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

            // ===== TIME DETAILS =====
            
            if (order.startTime && order.endTime) {
              yPos += 50;
              
              doc
                .fontSize(14)
                .fillColor(env.BRAND_PRIMARY_COLOR)
                .font("Helvetica-Bold")
                .text("TIME DETAILS", 50, yPos);
              
              yPos += 25;

              const duration = Math.round(
                (new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / 
                (1000 * 60)
              );
              const hours = Math.floor(duration / 60);
              const minutes = duration % 60;

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
                )
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

              doc
                .fillColor("#666666")
                .font("Helvetica")
                .text("Duration:", 60, yPos, { width: 100 })
                .fillColor(env.BRAND_SUCCESS_COLOR)
                .font("Helvetica-Bold")
                .text(`${hours}h ${minutes}m`, 160, yPos, { width: 180 });
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

            // ===== PICTURES SECTION =====
            
            yPos += 30;
            
            // Check if we need a new page for BOTH pictures section (200px) and signature section (120px)
            // Total space needed: ~350px (200 for pictures + 120 for signature + 30 for spacing)
            if (yPos + 350 > 750) {
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

            // Fetch before pictures (limit to 2 for space)
            for (let i = 0; i < Math.min(order.beforePictures.length, 2); i++) {
              console.log(`[generateJobCardPdf] Fetching before picture ${i + 1}: ${order.beforePictures[i]}`);
              const buffer = await fetchImageAsBuffer(order.beforePictures[i]!);
              if (buffer) {
                beforeImageBuffers.push(buffer);
                console.log(`[generateJobCardPdf] Successfully fetched before picture ${i + 1} (${buffer.length} bytes)`);
              } else {
                console.error(`[generateJobCardPdf] Failed to fetch before picture ${i + 1}: ${order.beforePictures[i]}`);
              }
            }

            // Fetch after pictures (limit to 2 for space)
            for (let i = 0; i < Math.min(order.afterPictures.length, 2); i++) {
              console.log(`[generateJobCardPdf] Fetching after picture ${i + 1}: ${order.afterPictures[i]}`);
              const buffer = await fetchImageAsBuffer(order.afterPictures[i]!);
              if (buffer) {
                afterImageBuffers.push(buffer);
                console.log(`[generateJobCardPdf] Successfully fetched after picture ${i + 1} (${buffer.length} bytes)`);
              } else {
                console.error(`[generateJobCardPdf] Failed to fetch after picture ${i + 1}: ${order.afterPictures[i]}`);
              }
            }

            console.log(`[generateJobCardPdf] Loaded ${beforeImageBuffers.length} before images out of ${order.beforePictures.length} available`);
            console.log(`[generateJobCardPdf] Loaded ${afterImageBuffers.length} after images out of ${order.afterPictures.length} available`);

            const imageBoxHeight = 200;
            
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

            // Display before images
            if (beforeImageBuffers.length > 0) {
              const imageStartY = yPos + 28;
              const imageWidth = 100;
              const imageHeight = 75;
              const imageSpacing = 10;
              
              let successfullyEmbedded = 0;
              beforeImageBuffers.forEach((buffer, index) => {
                try {
                  const xPos = 60 + (index % 2) * (imageWidth + imageSpacing);
                  const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                  
                  console.log(`[generateJobCardPdf] Attempting to embed before image ${index + 1} at position (${xPos}, ${yPosImg})`);
                  
                  // Embed image with fit option only to maintain aspect ratio
                  doc.image(buffer, xPos, yPosImg, {
                    fit: [imageWidth, imageHeight]
                  });
                  
                  successfullyEmbedded++;
                  console.log(`[generateJobCardPdf] Successfully embedded before image ${index + 1}`);
                } catch (error) {
                  console.error(`[generateJobCardPdf] Error embedding before image ${index + 1}:`, error);
                  if (error instanceof Error) {
                    console.error(`[generateJobCardPdf] Error details:`, {
                      message: error.message,
                      stack: error.stack,
                    });
                  }
                }
              });
              
              console.log(`[generateJobCardPdf] Successfully embedded ${successfullyEmbedded} out of ${beforeImageBuffers.length} before images`);
              
              // Only show count if we successfully loaded some images AND there are more available
              if (beforeImageBuffers.length >= 2 && order.beforePictures.length > 2) {
                doc
                  .fontSize(8)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text(`+ ${order.beforePictures.length - beforeImageBuffers.length} more picture(s)`, 60, yPos + imageBoxHeight - 18, { width: 220 });
              }
              
              // Show warning if some images failed to embed
              if (successfullyEmbedded === 0 && beforeImageBuffers.length > 0) {
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Failed to load images)", 60, yPos + 35);
              }
            } else {
              doc
                .fontSize(8)
                .fillColor("#666666")
                .font("Helvetica")
                .text("No pictures uploaded", 60, yPos + 35);
              
              if (order.beforePictures.length > 0) {
                console.warn(`[generateJobCardPdf] Failed to load any before pictures (${order.beforePictures.length} available in database)`);
                console.warn(`[generateJobCardPdf] Before picture URLs:`, order.beforePictures);
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

            // Display after images
            if (afterImageBuffers.length > 0) {
              const imageStartY = yPos + 28;
              const imageWidth = 100;
              const imageHeight = 75;
              const imageSpacing = 10;
              
              let successfullyEmbedded = 0;
              afterImageBuffers.forEach((buffer, index) => {
                try {
                  const xPos = afterBoxLeft + 10 + (index % 2) * (imageWidth + imageSpacing);
                  const yPosImg = imageStartY + Math.floor(index / 2) * (imageHeight + imageSpacing);
                  
                  console.log(`[generateJobCardPdf] Attempting to embed after image ${index + 1} at position (${xPos}, ${yPosImg})`);
                  
                  // Embed image with fit option only to maintain aspect ratio
                  doc.image(buffer, xPos, yPosImg, {
                    fit: [imageWidth, imageHeight]
                  });
                  
                  successfullyEmbedded++;
                  console.log(`[generateJobCardPdf] Successfully embedded after image ${index + 1}`);
                } catch (error) {
                  console.error(`[generateJobCardPdf] Error embedding after image ${index + 1}:`, error);
                  if (error instanceof Error) {
                    console.error(`[generateJobCardPdf] Error details:`, {
                      message: error.message,
                      stack: error.stack,
                    });
                  }
                }
              });
              
              console.log(`[generateJobCardPdf] Successfully embedded ${successfullyEmbedded} out of ${afterImageBuffers.length} after images`);
              
              // Only show count if we successfully loaded some images AND there are more available
              if (afterImageBuffers.length >= 2 && order.afterPictures.length > 2) {
                doc
                  .fontSize(8)
                  .fillColor("#666666")
                  .font("Helvetica")
                  .text(`+ ${order.afterPictures.length - afterImageBuffers.length} more picture(s)`, afterBoxLeft + 10, yPos + imageBoxHeight - 18, { width: 220 });
              }
              
              // Show warning if some images failed to embed
              if (successfullyEmbedded === 0 && afterImageBuffers.length > 0) {
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Failed to load images)", afterBoxLeft + 10, yPos + 35);
              }
            } else {
              doc
                .fontSize(8)
                .fillColor("#666666")
                .font("Helvetica")
                .text("No pictures uploaded", afterBoxLeft + 10, yPos + 35);
              
              if (order.afterPictures.length > 0) {
                console.warn(`[generateJobCardPdf] Failed to load any after pictures (${order.afterPictures.length} available in database)`);
                console.warn(`[generateJobCardPdf] After picture URLs:`, order.afterPictures);
              }
            }

            yPos += imageBoxHeight + 10;

            // Safety check: ensure signature section fits on current page
            // If not enough space (need ~130px for signature section), add new page
            if (yPos + 130 > 750) {
              doc.addPage();
              yPos = 50;
            }

            // Fetch signature image if available
            let signatureImageBuffer: Buffer | null = null;
            if (order.signedJobCardUrl) {
              console.log(`[generateJobCardPdf] Attempting to load signature from: ${order.signedJobCardUrl}`);
              signatureImageBuffer = await fetchImageAsBuffer(order.signedJobCardUrl);
              if (signatureImageBuffer) {
                console.log(`[generateJobCardPdf] Successfully loaded signature image (${signatureImageBuffer.length} bytes)`);
              } else {
                console.error(`[generateJobCardPdf] Failed to load signature image from: ${order.signedJobCardUrl}`);
              }
            } else {
              console.log(`[generateJobCardPdf] No signature URL provided`);
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
                console.log(`[generateJobCardPdf] Attempting to embed signature image at position (140, ${yPos - 10})`);
                
                // Embed the signature image with preserved aspect ratio
                doc.image(signatureImageBuffer, 140, yPos - 10, {
                  fit: [250, 50]
                });
                
                console.log(`[generateJobCardPdf] Successfully embedded signature image`);
              } catch (error) {
                console.error("[generateJobCardPdf] Error embedding signature image:", error);
                if (error instanceof Error) {
                  console.error(`[generateJobCardPdf] Signature embed error details:`, {
                    message: error.message,
                    stack: error.stack,
                  });
                }
                // Fallback to error message if image fails
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Signature failed to embed)", 140, yPos);
              }
            } else {
              if (order.signedJobCardUrl) {
                // Signature URL exists but failed to load - show a message
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Signature failed to load)", 140, yPos);
                console.error(`[generateJobCardPdf] Signature URL exists but failed to load: ${order.signedJobCardUrl}`);
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
            console.error("Error generating job card PDF:", error);
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
