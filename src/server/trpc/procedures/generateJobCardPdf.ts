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
import { userIsOnOrderCrew } from "~/server/utils/orderAccess";

export const generateJobCardPdf = baseProcedure
  .input(
    z.object({
      // Provide either a user JWT (`token`) OR a public signing link token (`signatureToken`).
      token: z.string().optional(),
      signatureToken: z.string().optional(),
      orderId: z.number(),
      isPMOrder: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      // Public signing-link flow: no JWT, no role checks; the possession of the
      // signature token is the authorization. We still validate that the token
      // actually matches the requested order to prevent enumeration.
      const isPublicSigningRequest = !!input.signatureToken && !input.token;

      let parsed: { userId: number } | null = null;
      if (!isPublicSigningRequest) {
        if (!input.token) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "Authentication token required",
          });
        }
        const verified = jwt.verify(input.token, env.JWT_SECRET);
        parsed = z.object({ userId: z.number() }).parse(verified);
      }

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
            assignedTo: {
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
            materials: true,
            jobActivities: true,
            ohsRiskAssessments: {
              include: { items: true },
              orderBy: { createdAt: "desc" },
              take: 1,
            },
            quotation: {
              select: {
                quoteNumber: true,
                clientReferenceQuoteNumber: true,
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

      // Public signing-link flow: verify the token on the record matches, then
      // skip role-based authorization entirely.
      if (isPublicSigningRequest) {
        if (
          !order.signatureRequestToken ||
          order.signatureRequestToken !== input.signatureToken
        ) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "Invalid signing link for this order",
          });
        }
      } else {
        // Get user details to check role
        const user = await db.user.findUnique({
          where: { id: parsed!.userId },
          select: { role: true, email: true },
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
        const isAdminPortalUser = user.role === "ADMIN" || user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN";
        const isCustomer = user.role === "CUSTOMER";

        if (!isAdminPortalUser) {
          if (isArtisan && order.assignedToId !== parsed!.userId) {
            // PR-6: allow if on the crew
            const onCrew = !input.isPMOrder && (await userIsOnOrderCrew(order.id, parsed!.userId));
            if (!onCrew) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You are not assigned to this order",
              });
            }
          }

          // For PM orders, verify contractor has access
          if (input.isPMOrder && isContractor) {
            if (order.contractorId !== parsed!.userId) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have access to this order",
              });
            }
          }

          // Customers can only download job cards for their own orders.
          if (isCustomer) {
            const customerEmail = (order.customerEmail ?? "").toLowerCase();
            const userEmail = (user.email ?? "").toLowerCase();
            if (!customerEmail || customerEmail !== userEmail) {
              throw new TRPCError({
                code: "FORBIDDEN",
                message: "You do not have access to this order",
              });
            }
          }
        }
      }

      // Load all async data BEFORE creating the PDF document
      const systemCompanyDetails = await getCompanyDetails();

      const contractorUser = input.isPMOrder ? order.contractor : order.assignedTo;
      
      // Use contractor's company details if available, otherwise fallback to system settings
      const companyDetails = {
        companyName: contractorUser?.contractorCompanyName || systemCompanyDetails.companyName,
        companyAddressLine1: contractorUser?.contractorCompanyAddressLine1 || systemCompanyDetails.companyAddressLine1,
        companyAddressLine2: contractorUser?.contractorCompanyAddressLine2 || systemCompanyDetails.companyAddressLine2,
        companyPhone: contractorUser?.contractorCompanyPhone || systemCompanyDetails.companyPhone,
        companyEmail: contractorUser?.contractorCompanyEmail || systemCompanyDetails.companyEmail,
        companyVatNumber: contractorUser?.contractorCompanyVatNumber || systemCompanyDetails.companyVatNumber,
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

            // Job card details — 2-column traceability block so admins can
            // cross-reference the client's PO + RFQ against Square 15's own
            // job / quote numbers at a glance. Falls back to em-dash if a
            // reference isn't captured yet.
            const traceLabelColor = "#666666";
            const traceValueColor = env.BRAND_ACCENT_COLOR;
            const traceLeftX = 50;
            const traceRightLabelX = 300;
            const traceRightValueX = 385;
            const quotation: { quoteNumber?: string | null; clientReferenceQuoteNumber?: string | null } | null =
              (order as any).quotation ?? null;
            const clientPO: string = ((order as any).clientOrderNumber ?? "").toString().trim() || "\u2014";
            const clientQuoteRef: string =
              ((quotation?.clientReferenceQuoteNumber ?? "") as string).toString().trim() || "\u2014";
            const ourQuoteNo: string = (quotation?.quoteNumber ?? "").toString().trim() || "\u2014";

            // Row 1 — Job No (left) | Client PO No (right)
            doc
              .fontSize(10)
              .font("Helvetica")
              .fillColor(traceLabelColor)
              .text("Job No: ", traceLeftX, 210, { continued: true })
              .fillColor(traceValueColor)
              .font("Helvetica-Bold")
              .text(order.orderNumber);
            doc
              .font("Helvetica")
              .fillColor(traceLabelColor)
              .text("Client PO No: ", traceRightLabelX, 210, { continued: true })
              .fillColor(traceValueColor)
              .font("Helvetica-Bold")
              .text(clientPO);

            // Row 2 — Our Quote No (left) | Client Quote/RFQ No (right)
            doc
              .font("Helvetica")
              .fillColor(traceLabelColor)
              .text("Our Quote No: ", traceLeftX, 225, { continued: true })
              .fillColor(traceValueColor)
              .font("Helvetica-Bold")
              .text(ourQuoteNo);
            doc
              .font("Helvetica")
              .fillColor(traceLabelColor)
              .text("Client Quote/RFQ No: ", traceRightLabelX, 225, { continued: true })
              .fillColor(traceValueColor)
              .font("Helvetica-Bold")
              .text(clientQuoteRef);

            // Row 3 — Date on its own line under the trace block
            doc
              .font("Helvetica")
              .fillColor(traceLabelColor)
              .text("Date: ", traceLeftX, 240, { continued: true })
              .fillColor(traceValueColor)
              .font("Helvetica-Bold")
              .text(
                new Date().toLocaleDateString("en-ZA", {
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })
              );

            // ===== CUSTOMER DETAILS BOX =====

            const customerBoxTop = 275;
            const CUSTOMER_BOX_LEFT = 50;
            const CUSTOMER_BOX_WIDTH = 240;
            const CUSTOMER_TEXT_LEFT = 60;
            const CUSTOMER_TEXT_WIDTH = 220;

            const ARTISAN_BOX_LEFT = 310;
            const ARTISAN_BOX_WIDTH = 235;
            const ARTISAN_TEXT_LEFT = 320;
            const ARTISAN_TEXT_WIDTH = 215;

            const HEADER_BAND_HEIGHT = 28;
            const PADDING_AFTER_HEADER = 10;
            const LINE_GAP = 4;
            const PADDING_BOTTOM = 12;
            const MIN_BOX_HEIGHT = 110;

            type Line = { text: string; bold: boolean; size: number };

            const measureBlock = (lines: Line[], width: number): number => {
              let total = 0;
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                doc.font(line.bold ? "Helvetica-Bold" : "Helvetica").fontSize(line.size);
                total += doc.heightOfString(line.text || " ", { width });
                if (i < lines.length - 1) total += LINE_GAP;
              }
              return total;
            };

            const renderBlock = (
              lines: Line[],
              x: number,
              y: number,
              width: number,
              boldColor: string,
              normalColor: string,
            ) => {
              let cursor = y;
              for (let i = 0; i < lines.length; i++) {
                const line = lines[i]!;
                doc
                  .font(line.bold ? "Helvetica-Bold" : "Helvetica")
                  .fontSize(line.size)
                  .fillColor(line.bold ? boldColor : normalColor)
                  .text(line.text || " ", x, cursor, { width });
                cursor += doc.heightOfString(line.text || " ", { width });
                if (i < lines.length - 1) cursor += LINE_GAP;
              }
            };

            const customerLines: Line[] = [
              { text: order.customerName, bold: true, size: 10 },
              { text: order.address, bold: false, size: 9 },
              { text: order.customerEmail, bold: false, size: 9 },
              { text: `Tel: ${order.customerPhone}`, bold: false, size: 9 },
            ];

            const artisanLines: Line[] = order.assignedTo
              ? [
                  {
                    text: `${order.assignedTo.firstName} ${order.assignedTo.lastName}`,
                    bold: true,
                    size: 10,
                  },
                  { text: order.assignedTo.email, bold: false, size: 9 },
                  { text: `Tel: ${order.assignedTo.phone || "N/A"}`, bold: false, size: 9 },
                ]
              : [];

            const customerContentHeight = measureBlock(customerLines, CUSTOMER_TEXT_WIDTH);
            const artisanContentHeight =
              artisanLines.length > 0 ? measureBlock(artisanLines, ARTISAN_TEXT_WIDTH) : 0;

            const contentHeight = Math.max(customerContentHeight, artisanContentHeight);
            const boxHeight = Math.max(
              MIN_BOX_HEIGHT,
              HEADER_BAND_HEIGHT + PADDING_AFTER_HEADER + contentHeight + PADDING_BOTTOM,
            );

            // Customer box border + background
            doc
              .rect(CUSTOMER_BOX_LEFT, customerBoxTop, CUSTOMER_BOX_WIDTH, boxHeight)
              .lineWidth(2)
              .strokeColor(env.BRAND_ACCENT_COLOR)
              .stroke();
            doc
              .rect(
                CUSTOMER_BOX_LEFT + 1,
                customerBoxTop + 1,
                CUSTOMER_BOX_WIDTH - 2,
                boxHeight - 2,
              )
              .fill("#f9fafb");

            // Customer header band
            doc
              .rect(CUSTOMER_BOX_LEFT, customerBoxTop, CUSTOMER_BOX_WIDTH, HEADER_BAND_HEIGHT)
              .fill(env.BRAND_ACCENT_COLOR);
            doc
              .fontSize(11)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("CUSTOMER DETAILS", CUSTOMER_TEXT_LEFT, customerBoxTop + 8);

            // Customer content
            renderBlock(
              customerLines,
              CUSTOMER_TEXT_LEFT,
              customerBoxTop + HEADER_BAND_HEIGHT + PADDING_AFTER_HEADER,
              CUSTOMER_TEXT_WIDTH,
              "#1a1a1a",
              "#333333",
            );

            // ===== ARTISAN DETAILS BOX =====

            // Artisan box border + background
            doc
              .rect(ARTISAN_BOX_LEFT, customerBoxTop, ARTISAN_BOX_WIDTH, boxHeight)
              .lineWidth(2)
              .strokeColor(env.BRAND_PRIMARY_COLOR)
              .stroke();
            doc
              .rect(
                ARTISAN_BOX_LEFT + 1,
                customerBoxTop + 1,
                ARTISAN_BOX_WIDTH - 2,
                boxHeight - 2,
              )
              .fill("#f9fafb");

            // Artisan header band
            doc
              .rect(ARTISAN_BOX_LEFT, customerBoxTop, ARTISAN_BOX_WIDTH, HEADER_BAND_HEIGHT)
              .fill(env.BRAND_PRIMARY_COLOR);
            doc
              .fontSize(11)
              .fillColor("#ffffff")
              .font("Helvetica-Bold")
              .text("ARTISAN DETAILS", ARTISAN_TEXT_LEFT, customerBoxTop + 8);

            // Artisan content
            if (artisanLines.length > 0) {
              renderBlock(
                artisanLines,
                ARTISAN_TEXT_LEFT,
                customerBoxTop + HEADER_BAND_HEIGHT + PADDING_AFTER_HEADER,
                ARTISAN_TEXT_WIDTH,
                "#1a1a1a",
                "#333333",
              );
            }

            const customerSectionBottom = customerBoxTop + boxHeight;

            // ===== WORK DETAILS SECTION =====

            let yPos = customerSectionBottom + 25;
            
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

              const duration = Math.max(0, Math.round(
                (new Date(order.endTime).getTime() - new Date(order.startTime).getTime()) / (1000 * 60)
              ));
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
                  new Date(order.startTime).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }),
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
                  new Date(order.endTime).toLocaleString("en-ZA", { timeZone: "Africa/Johannesburg" }),
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
                .text("MATERIAL", 60, yPos + 7, { width: 350 })
                .text("QTY", 420, yPos + 7, { width: 115, align: "right" });

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
                  .text(material.name, 60, yPos, { width: 350 })
                  .text(material.quantity.toString(), 420, yPos, { width: 115, align: "right" });

                yPos += 18;
              });
            }

            // ===== PICTURES SECTION =====
            // Only render the DOCUMENTATION block when there's actually
            // something to show. Otherwise the job card ends up with a
            // large "No pictures uploaded" placeholder that adds visual
            // clutter without adding evidence (per admin request for
            // retroactive manual job cards where photos weren't captured
            // on site).
            const hasBeforePictures =
              Array.isArray(order.beforePictures) && order.beforePictures.length > 0;
            const hasAfterPictures =
              Array.isArray(order.afterPictures) && order.afterPictures.length > 0;

            if (hasBeforePictures || hasAfterPictures) {
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

              // Before pictures box — always draw when hasBeforePictures OR
              // hasAfterPictures is true, but suppress the individual box if
              // that side has nothing so the layout doesn't show a mostly
              // empty box on one side.
              if (hasBeforePictures) {
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
                } else if (order.beforePictures.length > 0) {
                  // URLs recorded but none downloadable — surface the error
                  // instead of a misleading "No pictures uploaded" placeholder.
                  doc
                    .fontSize(8)
                    .fillColor("#dc2626")
                    .font("Helvetica")
                    .text("(Failed to load images)", 60, yPos + 35);
                  console.warn(`[generateJobCardPdf] Failed to load any before pictures (${order.beforePictures.length} available in database)`);
                  console.warn(`[generateJobCardPdf] Before picture URLs:`, order.beforePictures);
                }
              }

              // After pictures box
              if (hasAfterPictures) {
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
                } else if (order.afterPictures.length > 0) {
                  doc
                    .fontSize(8)
                    .fillColor("#dc2626")
                    .font("Helvetica")
                    .text("(Failed to load images)", afterBoxLeft + 10, yPos + 35);
                  console.warn(`[generateJobCardPdf] Failed to load any after pictures (${order.afterPictures.length} available in database)`);
                  console.warn(`[generateJobCardPdf] After picture URLs:`, order.afterPictures);
                }
              }

              yPos += imageBoxHeight + 10;
            }

            // ===== SITE-SPECIFIC RISK ASSESSMENT (SSRA) =====
            // Rendered only for regular Orders that have an attached OHS risk
            // assessment. Provides regulatory evidence that the artisan
            // performed a hazard identification before work commenced (per
            // OHSA 85 of 1993, Construction Regs 9 & 10).
            const ssra: any = !input.isPMOrder && Array.isArray((order as any).ohsRiskAssessments) && (order as any).ohsRiskAssessments.length > 0
              ? (order as any).ohsRiskAssessments[0]
              : null;

            if (ssra) {
              const ssraItems: any[] = Array.isArray(ssra.items) ? ssra.items : [];
              // Rough height estimate: header (40) + summary (30) + items × 60
              const estSsraHeight = 40 + 30 + Math.max(60, ssraItems.length * 55);
              if (yPos + estSsraHeight > 750) {
                doc.addPage();
                yPos = 50;
              }

              doc
                .rect(50, yPos, 495, 30)
                .fill(env.BRAND_ACCENT_COLOR);
              doc
                .fontSize(12)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("SITE-SPECIFIC RISK ASSESSMENT (SSRA)", 60, yPos + 9);
              yPos += 35;

              doc
                .fontSize(9)
                .fillColor("#333333")
                .font("Helvetica")
                .text(
                  `Reference: ${ssra.reference ?? "—"}    Overall residual risk: ${ssra.overallRisk ?? "—"}    ${ssra.aiGenerated ? "AI-assisted" : "Manual"}`,
                  60,
                  yPos,
                  { width: 475 }
                );
              yPos += 15;

              if (ssra.aiSummary) {
                doc
                  .fontSize(8)
                  .fillColor("#555555")
                  .font("Helvetica-Oblique")
                  .text(String(ssra.aiSummary), 60, yPos, { width: 475 });
                yPos += 20;
              }

              // Items table (hazard | controls | PPE | residual)
              if (ssraItems.length > 0) {
                doc
                  .fontSize(9)
                  .fillColor("#111111")
                  .font("Helvetica-Bold")
                  .text("Hazards identified & controls", 60, yPos);
                yPos += 15;

                for (const item of ssraItems) {
                  if (yPos + 55 > 750) {
                    doc.addPage();
                    yPos = 50;
                  }
                  doc
                    .rect(50, yPos, 495, 50)
                    .lineWidth(0.5)
                    .strokeColor("#e5e7eb")
                    .stroke();
                  doc
                    .fontSize(9)
                    .fillColor("#111111")
                    .font("Helvetica-Bold")
                    .text(String(item.hazard ?? "—"), 55, yPos + 4, { width: 220 });
                  doc
                    .fontSize(8)
                    .fillColor("#374151")
                    .font("Helvetica")
                    .text(`Controls: ${String(item.controls ?? "—")}`, 55, yPos + 20, { width: 220 });
                  const ppe = Array.isArray(item.ppeRequired) ? item.ppeRequired.join(", ") : "—";
                  doc.text(`PPE: ${ppe || "—"}`, 280, yPos + 4, { width: 260 });
                  doc.text(`Residual risk: ${item.residualRisk ?? "—"} (L${item.residualLikelihood ?? "-"}×S${item.residualSeverity ?? "-"})`, 280, yPos + 20, { width: 260 });
                  yPos += 55;
                }
              } else {
                doc
                  .fontSize(9)
                  .fillColor("#6b7280")
                  .font("Helvetica-Oblique")
                  .text("No hazards recorded on this SSRA.", 60, yPos);
                yPos += 15;
              }

              yPos += 10;
            }

            // Safety check: ensure signature section fits on current page
            // If not enough space (need ~130px for signature section), add new page
            if (yPos + 130 > 750) {
              doc.addPage();
              yPos = 50;
            }

            // Fetch signature image if available
            let signatureImageBuffer: Buffer | null = null;
            if (order.clientUnavailableToSign) {
              console.log(`[generateJobCardPdf] Client was unavailable to sign`);
            } else if (order.signedJobCardUrl) {
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
            // Box height needs to fit: header (30) + confirmation text (~20)
            // + Signature row (30) + Name row (25) + Date row (~20).
            // The old 120px height had the Date underline drawn beyond the
            // box border, making labels look overlapped. Bumped to 145.
            const clientConfirmBoxHeight = 145;

            // Box with accent border
            doc
              .rect(50, yPos, 495, clientConfirmBoxHeight)
              .lineWidth(2)
              .strokeColor(env.BRAND_ACCENT_COLOR)
              .stroke();
            
            doc.rect(51, yPos + 1, 493, clientConfirmBoxHeight - 2).fill("#f9fafb");

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

            // Consistent column geometry so labels/underlines align across rows.
            // Labels are right-aligned in a fixed-width column so the colons
            // all sit at the same x, and every underline starts at x=155.
            const LABEL_X = 60;
            const LABEL_W = 90; // labels end at x = 150 (right edge of column)
            const FIELD_X = 155;
            const FIELD_END = 440;
            const UNDERLINE_DY = 14;

            const drawUnderline = (rowY: number) => {
              doc
                .moveTo(FIELD_X, rowY + UNDERLINE_DY)
                .lineTo(FIELD_END, rowY + UNDERLINE_DY)
                .lineWidth(0.5)
                .strokeColor("#333333")
                .stroke();
            };

            const drawLabel = (label: string, rowY: number) => {
              doc
                .fontSize(10)
                .fillColor("#333333")
                .font("Helvetica")
                .text(label, LABEL_X, rowY, { width: LABEL_W, align: "right" });
            };

            // Signature section with embedded image if available
            drawLabel("Signature:", yPos);

            if (signatureImageBuffer) {
              try {
                console.log(`[generateJobCardPdf] Attempting to embed signature image at position (${FIELD_X}, ${yPos - 10})`);
                
                // Embed the signature image with preserved aspect ratio
                doc.image(signatureImageBuffer, FIELD_X, yPos - 10, {
                  fit: [FIELD_END - FIELD_X, 50]
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
                  .text("(Signature failed to embed)", FIELD_X, yPos);
              }
            } else if (order.clientUnavailableToSign) {
              // Keep blank signature line - signature can be added later via remote signing
              drawUnderline(yPos);
            } else {
              if (order.signedJobCardUrl) {
                // Signature URL exists but failed to load - show a message
                doc
                  .fontSize(8)
                  .fillColor("#dc2626")
                  .font("Helvetica")
                  .text("(Signature failed to load)", FIELD_X, yPos);
                console.error(`[generateJobCardPdf] Signature URL exists but failed to load: ${order.signedJobCardUrl}`);
              } else {
                // No signature captured yet
                drawUnderline(yPos);
              }
            }

            yPos += 30;

            // Display client representative name
            drawLabel("Name:", yPos);
            
            if (order.clientRepName) {
              doc
                .fontSize(10)
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(order.clientRepName, FIELD_X, yPos);
            } else {
              drawUnderline(yPos);
            }

            yPos += 25;

            // Display client representative sign date
            drawLabel("Date:", yPos);
            
            if (order.clientRepSignDate) {
              doc
                .fontSize(10)
                .fillColor("#333333")
                .font("Helvetica-Bold")
                .text(
                  new Date(order.clientRepSignDate).toLocaleDateString("en-ZA", {
                    year: "numeric",
                    month: "long",
                    day: "numeric"
                  }),
                  FIELD_X,
                  yPos
                );
            } else {
              drawUnderline(yPos);
            }

            // ===== ARTISAN CONFIRMATION (both regular Order and PM Order) =====
            // SA best practice: both parties acknowledge job completion.
            {
              yPos += 20;
              // Same 145px height as CLIENT CONFIRMATION so both boxes
              // visually match and Date row underline stays inside the box.
              const artisanConfirmBoxHeight = 145;
              if (yPos + artisanConfirmBoxHeight + 10 > 750) {
                doc.addPage();
                yPos = 50;
              }
              // Container box
              doc
                .rect(50, yPos, 495, artisanConfirmBoxHeight)
                .lineWidth(2)
                .strokeColor(env.BRAND_ACCENT_COLOR)
                .stroke();
              doc.rect(51, yPos + 1, 493, artisanConfirmBoxHeight - 2).fill("#f9fafb");
              // Header bar
              doc.rect(50, yPos, 495, 30).fill(env.BRAND_ACCENT_COLOR);
              doc
                .fontSize(12)
                .fillColor("#ffffff")
                .font("Helvetica-Bold")
                .text("ARTISAN CONFIRMATION", 60, yPos + 9);

              yPos += 40;

              doc
                .fontSize(9)
                .fillColor("#666666")
                .font("Helvetica")
                .text(
                  "I confirm the work described above has been completed in accordance with the SSRA and site safety controls.",
                  60,
                  yPos,
                  { width: 475 }
                );
              yPos += 20;

              // Artisan signature image + label
              let artisanSigBuffer: Buffer | null = null;
              if ((order as any).artisanSignatureUrl) {
                try {
                  artisanSigBuffer = await fetchImageAsBuffer((order as any).artisanSignatureUrl);
                } catch (err) {
                  console.error("[generateJobCardPdf] Failed to load artisan signature image:", err);
                }
              }

              drawLabel("Signature:", yPos);
              if (artisanSigBuffer) {
                try {
                  doc.image(artisanSigBuffer, FIELD_X, yPos - 10, { fit: [FIELD_END - FIELD_X, 50] });
                } catch (err) {
                  doc
                    .fontSize(8)
                    .fillColor("#dc2626")
                    .font("Helvetica")
                    .text("(Signature failed to embed)", FIELD_X, yPos);
                }
              } else {
                drawUnderline(yPos);
              }

              yPos += 30;
              drawLabel("Name:", yPos);
              if ((order as any).artisanSignedByName) {
                doc
                  .fontSize(10)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(String((order as any).artisanSignedByName), FIELD_X, yPos);
              } else if (order.assignedTo?.firstName || order.assignedTo?.lastName) {
                doc
                  .fontSize(10)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(
                    `${order.assignedTo?.firstName ?? ""} ${order.assignedTo?.lastName ?? ""}`.trim(),
                    FIELD_X,
                    yPos,
                  );
              } else {
                drawUnderline(yPos);
              }

              yPos += 25;
              drawLabel("Date:", yPos);
              if ((order as any).artisanSignDate) {
                doc
                  .fontSize(10)
                  .fillColor("#333333")
                  .font("Helvetica-Bold")
                  .text(
                    new Date((order as any).artisanSignDate).toLocaleDateString("en-ZA", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    }),
                    FIELD_X,
                    yPos,
                  );
              } else {
                drawUnderline(yPos);
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
