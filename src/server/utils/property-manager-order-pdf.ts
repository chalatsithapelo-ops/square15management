import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

interface GeneratePropertyManagerOrderPdfResult {
  pdfBuffer: Buffer;
}

/**
 * Generate a PDF for a Property Manager Order
 */
export async function generatePropertyManagerOrderPdf(orderId: number): Promise<GeneratePropertyManagerOrderPdfResult> {
  const order = await db.propertyManagerOrder.findUnique({
    where: { id: orderId },
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
      generatedFromRFQ: {
        select: {
          id: true,
          rfqNumber: true,
        },
      },
      sourceRFQ: {
        select: {
          id: true,
          rfqNumber: true,
        },
      },
    },
  });
  if (!order) throw new Error("Order not found");

  const normalizeItemsArray = (raw: unknown): any[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) return raw as any[];
    if (typeof raw === "string") {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed as any[];
        if (parsed && typeof parsed === "object" && Array.isArray((parsed as any).items)) {
          return (parsed as any).items as any[];
        }
      } catch {
        return [];
      }
    }
    if (typeof raw === "object" && raw !== null && Array.isArray((raw as any).items)) {
      return (raw as any).items as any[];
    }
    return [];
  };

  const linkedRfqNumber = order.generatedFromRFQ?.rfqNumber || order.sourceRFQ?.rfqNumber;
  const approvedQuotation = linkedRfqNumber
    ? await db.quotation.findFirst({
        where: {
          clientReferenceQuoteNumber: linkedRfqNumber,
          status: "APPROVED",
        },
        select: {
          items: true,
          subtotal: true,
          tax: true,
          total: true,
        },
      })
    : null;

  const approvedLineItems = normalizeItemsArray(approvedQuotation?.items);

  // Use PM's company details and branding from their user record
  const companyDetails = {
    companyName: order.propertyManager?.pmCompanyName || env.COMPANY_NAME || "Square 15 Facility Solutions",
    companyAddressLine1: order.propertyManager?.pmCompanyAddressLine1 || "",
    companyAddressLine2: order.propertyManager?.pmCompanyAddressLine2 || "",
    companyPhone: order.propertyManager?.pmCompanyPhone || "",
    companyEmail: order.propertyManager?.pmCompanyEmail || "",
  };

  const brandColors = {
    primary: order.propertyManager?.pmBrandPrimaryColor || "#2D5016",
    secondary: order.propertyManager?.pmBrandSecondaryColor || "#F4C430",
    accent: order.propertyManager?.pmBrandAccentColor || "#5A9A47",
  };

  const logoBuffer = await getCompanyLogo();

  // Use an explicit A4 page and keep all content within margins.
  // This prevents PDFKit from auto-adding blank pages when content is drawn below the bottom margin.
  const doc = new PDFDocument({ size: "A4", margin: 50 });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    try {
      // ===== HEADER SECTION WITH BRAND BANNER =====
      doc.rect(0, 0, 595, 100).fill(brandColors.primary);
      doc.rect(0, 95, 595, 5).fill(brandColors.secondary);

      // Add company logo
      if (logoBuffer) {
        try {
          doc.circle(80, 50, 35).fill("#ffffff").opacity(1);
          doc.opacity(1);
          doc.image(logoBuffer, 45, 15, { width: 70 });
        } catch (error) {
          console.error("Error adding logo to PDF:", error);
        }
      }

      // Company details on header
      doc.fontSize(16).fillColor("#ffffff").font("Helvetica-Bold")
        .text(companyDetails.companyName, 150, 25, { align: "left" });
      doc.fontSize(8).font("Helvetica")
        .text(companyDetails.companyAddressLine1, 150, 45)
        .text(companyDetails.companyAddressLine2 || "", 150, 57)
        .text(`Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}`, 150, 69);

      // ===== WORK ORDER TITLE =====
      doc.fontSize(24).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("WORK ORDER", 50, 120);
      
      doc.fontSize(10).fillColor("#666666").font("Helvetica")
        .text(`Order #: ${order.orderNumber}`, 50, 150)
        .text(`Date Issued: ${order.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}`, 50, 165)
        .text(`Status: ${order.status}`, 50, 180);

      // ===== CLIENT DETAILS BOX (Property Manager) =====
      const clientBoxTop = 210;
      
      doc.rect(50, clientBoxTop, 240, 100)
        .lineWidth(2)
        .strokeColor(brandColors.primary)
        .stroke();
      
      doc.rect(50, clientBoxTop, 240, 25)
        .fill(brandColors.primary);
      
      doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
        .text("CLIENT DETAILS", 60, clientBoxTop + 7);
      
      const pmName = order.propertyManager 
        ? `${order.propertyManager.firstName} ${order.propertyManager.lastName}`
        : "Property Manager";
      
      doc.fontSize(9).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(pmName, 60, clientBoxTop + 35);
      
      doc.font("Helvetica").fillColor("#333333")
        .text(`Email: ${order.propertyManager?.email || "N/A"}`, 60, clientBoxTop + 50)
        .text(`Phone: ${order.propertyManager?.phone || "N/A"}`, 60, clientBoxTop + 65)
        .text(`Ref: PM-${order.propertyManagerId}`, 60, clientBoxTop + 80);

      // ===== CONTRACTOR DETAILS BOX =====
      const contractorBoxTop = 210;
      
      doc.rect(305, contractorBoxTop, 240, 100)
        .lineWidth(2)
        .strokeColor(brandColors.accent)
        .stroke();
      
      doc.rect(305, contractorBoxTop, 240, 25)
        .fill(brandColors.accent);
      
      doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
        .text("CONTRACTOR DETAILS", 315, contractorBoxTop + 7);
      
      const contractorName = order.contractor 
        ? `${order.contractor.firstName} ${order.contractor.lastName}`
        : "To Be Assigned";
      
      doc.fontSize(9).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(contractorName, 315, contractorBoxTop + 35);
      
      doc.font("Helvetica").fillColor("#333333")
        .text(`Email: ${order.contractor?.email || "N/A"}`, 315, contractorBoxTop + 50)
        .text(`Phone: ${order.contractor?.phone || "N/A"}`, 315, contractorBoxTop + 65)
        .text(`ID: ${order.contractorId || "Pending"}`, 315, contractorBoxTop + 80);

      // ===== PROPERTY INFORMATION BOX =====
      const propertyBoxTop = 325;
      
      doc.rect(50, propertyBoxTop, 495, 80)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, propertyBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("PROPERTY INFORMATION", 60, propertyBoxTop + 6);
      
      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(`Building: ${order.buildingName || "N/A"}`, 60, propertyBoxTop + 32)
        .text(`Address: ${order.buildingAddress}`, 60, propertyBoxTop + 47)
        .text(`Work Title: ${order.title}`, 60, propertyBoxTop + 62);

      // ===== WORK DESCRIPTION BOX =====
      const descBoxTop = 420;
      
      doc.rect(50, descBoxTop, 495, 120)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, descBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("WORK DESCRIPTION", 60, descBoxTop + 6);
      
      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(order.description, 60, descBoxTop + 32, {
          width: 475,
          height: 85,
          align: "left",
          ellipsis: true,
        });

      // ===== SCOPE OF WORK BOX =====
      const scopeBoxTop = 555;
      
      doc.rect(50, scopeBoxTop, 495, 120)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, scopeBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("SCOPE OF WORK", 60, scopeBoxTop + 6);

      const scopeText = approvedLineItems.length
        ? "Issued based on the approved quotation line items. See the itemised scope of work on the next page."
        : order.scopeOfWork;

      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(scopeText, 60, scopeBoxTop + 32, {
          width: 475,
          height: 85,
          align: "left",
          ellipsis: true,
        });

      // ===== FINANCIAL SUMMARY BOX =====
      const finBoxTop = 690;
      
      doc.rect(350, finBoxTop, 195, 60)
        .lineWidth(1.5)
        .strokeColor(brandColors.accent)
        .stroke();
      
      doc.rect(350, finBoxTop, 195, 20)
        .fill(brandColors.accent);
      
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold")
        .text("FINANCIAL SUMMARY", 360, finBoxTop + 5);
      
      doc.fontSize(9).fillColor("#333333").font("Helvetica")
        .text("Total Amount:", 360, finBoxTop + 30)
        .font("Helvetica-Bold").text(`R ${order.totalAmount.toLocaleString()}`, 470, finBoxTop + 30, { align: "right", width: 65 });
      
      doc.font("Helvetica")
        .text("Paid Amount:", 360, finBoxTop + 45)
        .font("Helvetica-Bold").fillColor("#22c55e")
        .text(`R ${order.paidAmount.toLocaleString()}`, 470, finBoxTop + 45, { align: "right", width: 65 });

      // ===== CONTACT FOR QUERIES =====
      // Keep this block above the bottom margin to avoid implicit extra pages.
      doc.fontSize(8).fillColor("#666666").font("Helvetica-Oblique")
        .text("For any queries or clarifications, please contact:", 50, 730);

      doc.fontSize(9).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(companyDetails.companyName, 50, 743);

      doc.fontSize(8).font("Helvetica").fillColor("#333333")
        .text(`Phone: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}`, 50, 755);

      // ===== FOOTER =====
      doc.fontSize(7).fillColor("#999999").font("Helvetica")
        .text(
          `Generated on ${new Date().toLocaleString("en-ZA")} | Order Reference: ${order.orderNumber}`,
          50,
          780,
          { align: "center", width: 495 }
        );

      // ===== ITEMISED SCOPE (FROM APPROVED QUOTATION) =====
      // Always produce exactly 2 pages to avoid blank trailing pages and keep the output consistent.
      doc.addPage();

        // Header banner on page 2
        doc.rect(0, 0, 595, 90).fill(brandColors.primary);
        doc.rect(0, 85, 595, 5).fill(brandColors.secondary);

        if (logoBuffer) {
          try {
            doc.circle(70, 45, 28).fill("#ffffff").opacity(1);
            doc.opacity(1);
            doc.image(logoBuffer, 48, 23, { width: 44 });
          } catch (error) {
            console.error("Error adding logo to PDF (page 2):", error);
          }
        }

        doc.fontSize(14).fillColor("#ffffff").font("Helvetica-Bold")
          .text(companyDetails.companyName, 120, 28, { align: "left" });
        doc.fontSize(9).fillColor("#ffffff").font("Helvetica")
          .text(`WORK ORDER: ${order.orderNumber}`, 120, 48, { align: "left" })
          .text(`RFQ Ref: ${linkedRfqNumber || "N/A"}`, 120, 63, { align: "left" });

        // Table title
        doc.fontSize(16).fillColor("#1a1a1a").font("Helvetica-Bold")
          .text("ITEMISED SCOPE OF WORK", 50, 120);

        const tableTop = 155;
        doc.rect(50, tableTop, 495, 25).fill(brandColors.primary);
        doc.rect(50, tableTop + 22, 495, 3).fill(brandColors.secondary);

        doc.fontSize(9).fillColor("#ffffff").font("Helvetica-Bold")
          .text("DESCRIPTION", 60, tableTop + 7, { width: 250 })
          .text("UoM", 320, tableTop + 7, { width: 40, align: "center" })
          .text("QTY", 370, tableTop + 7, { width: 40, align: "right" })
          .text("UNIT PRICE", 420, tableTop + 7, { width: 55, align: "right" })
          .text("AMOUNT", 480, tableTop + 7, { width: 60, align: "right" });

        const rowHeight = 18;
        const firstRowY = tableTop + 35;
        const maxYForRows = 650; // leave room for totals and footer
        const maxRows = Math.max(0, Math.floor((maxYForRows - firstRowY) / rowHeight));

        const visibleItems = approvedLineItems.slice(0, maxRows);
        let yPosition = firstRowY;

        visibleItems.forEach((rawItem: any, index: number) => {
          const description = String(rawItem?.description ?? rawItem?.name ?? "").trim() || "Line item";
          const uom = String(rawItem?.unitOfMeasure ?? rawItem?.uom ?? "Sum").trim() || "Sum";
          const quantity = Number(rawItem?.quantity ?? 0);
          const unitPrice = Number(rawItem?.unitPrice ?? 0);
          const amount = rawItem?.total !== undefined && rawItem?.total !== null
            ? Number(rawItem.total)
            : quantity * unitPrice;

          // Alternate row background
          doc.rect(50, yPosition - 4, 495, rowHeight).fill(index % 2 === 0 ? "#f9fafb" : "#ffffff");

          doc.fontSize(9).fillColor("#333333").font("Helvetica")
            .text(description, 60, yPosition, { width: 250, height: rowHeight - 2, ellipsis: true })
            .text(uom, 320, yPosition, { width: 40, height: rowHeight - 2, align: "center", ellipsis: true })
            .text(quantity ? String(quantity) : "", 370, yPosition, { width: 40, height: rowHeight - 2, align: "right" })
            .text(unitPrice ? `R${unitPrice.toFixed(2)}` : "", 420, yPosition, { width: 55, height: rowHeight - 2, align: "right" })
            .font("Helvetica-Bold")
            .text(amount ? `R${amount.toFixed(2)}` : "", 480, yPosition, { width: 60, height: rowHeight - 2, align: "right" });

          yPosition += rowHeight;
        });

        if (!approvedLineItems.length) {
          doc.fontSize(10).fillColor("#666666").font("Helvetica")
            .text("No approved quotation line items were found for this order.", 50, firstRowY, { width: 495 });
        } else if (approvedLineItems.length > visibleItems.length) {
          doc.fontSize(9).fillColor("#666666").font("Helvetica-Oblique")
            .text(
              `Note: ${approvedLineItems.length - visibleItems.length} additional line item(s) omitted to keep this order to 2 pages.`,
              50,
              maxYForRows + 10,
              { width: 495 }
            );
        }

        // Totals
        const subtotal = Number(approvedQuotation?.subtotal ?? order.totalAmount ?? 0);
        const tax = Number(approvedQuotation?.tax ?? 0);
        const total = Number(approvedQuotation?.total ?? order.totalAmount ?? 0);

        // Totals (fixed area so we never push beyond the page)
        const totalsX = 380;
        yPosition = 700;
        doc.fontSize(10).fillColor("#666666").font("Helvetica")
          .text("Subtotal:", totalsX, yPosition, { width: 70, align: "right" })
          .fillColor("#333333").font("Helvetica-Bold")
          .text(`R${subtotal.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

        yPosition += 18;
        doc.fillColor("#666666").font("Helvetica")
          .text("VAT/Tax:", totalsX, yPosition, { width: 70, align: "right" })
          .fillColor("#333333").font("Helvetica-Bold")
          .text(`R${tax.toFixed(2)}`, 460, yPosition, { width: 75, align: "right" });

        yPosition += 18;
        doc.rect(380, yPosition - 5, 165, 28).fill(brandColors.primary);
        doc.rect(380, yPosition + 20, 165, 3).fill(brandColors.secondary);
        doc.fontSize(12).fillColor("#ffffff").font("Helvetica")
          .text("TOTAL:", totalsX, yPosition + 3, { width: 70, align: "right" })
          .font("Helvetica-Bold")
          .text(`R${total.toFixed(2)}`, 460, yPosition + 3, { width: 75, align: "right" });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
  return { pdfBuffer };
}
