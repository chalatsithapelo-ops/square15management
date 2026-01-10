import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { getCompanyLogo, getContractorLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

/**
 * Generates a quotation PDF buffer for record-keeping and downloads.
 *
 * NOTE: This intentionally does not enforce quotation status.
 * Access control must be enforced by the calling tRPC procedure.
 */
export async function generateQuotationPdfBuffer(quotationId: number): Promise<{ pdfBuffer: Buffer; filename: string }> {
  const quotation = await db.quotation.findUnique({
    where: { id: quotationId },
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

  if (!quotation) throw new Error("Quotation not found");

  // Determine company details and logo based on who created the quotation
  let companyDetails:
    | {
        companyName: string;
        companyAddressLine1: string;
        companyAddressLine2: string;
        companyPhone: string;
        companyEmail: string;
        companyVatNumber: string;
      }
    | undefined;

  let logoBuffer: Buffer | null | undefined;

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
      companyVatNumber: quotation.createdBy.contractorCompanyVatNumber || "",
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
  doc.on("data", (chunk) => chunks.push(chunk));

  const pdfBuffer = await new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      // ===== HEADER SECTION WITH BRAND BANNER =====
      doc.rect(0, 0, 595, 140).fill(env.BRAND_PRIMARY_COLOR);
      doc.rect(0, 135, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

      if (logoBuffer) {
        try {
          doc.circle(80, 70, 45).fill("#ffffff").opacity(1);
          doc.opacity(1);
          doc.image(logoBuffer, 40, 30, { width: 80 });
        } catch {
          // best-effort; continue without logo
        }
      }

      doc.fontSize(18)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text(companyDetails?.companyName || env.COMPANY_NAME || "Square 15 Facility Solutions", 150, 45, {
          align: "left",
        });

      doc.fontSize(9)
        .fillColor("#ffffff")
        .font("Helvetica")
        .text(companyDetails?.companyAddressLine1 || "", 150, 70)
        .text(companyDetails?.companyAddressLine2 || "", 150, 85)
        .text(`Tel: ${companyDetails?.companyPhone || ""} | Email: ${companyDetails?.companyEmail || ""}`, 150, 100)
        .text(`VAT: ${companyDetails?.companyVatNumber || ""}`, 150, 115);

      // ===== TITLE =====
      doc.fontSize(24).fillColor("#1a1a1a").font("Helvetica-Bold").text("QUOTATION", 50, 165);

      doc.fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text(`Quote #: ${quotation.quoteNumber}`, 50, 195)
        .text(
          `Date: ${quotation.createdAt.toLocaleDateString("en-ZA", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}`,
          50,
          210
        )
        .text(`Status: ${quotation.status}`, 50, 225);

      // ===== CUSTOMER DETAILS =====
      const customerTop = 255;
      doc.rect(50, customerTop, 495, 85).lineWidth(1.5).strokeColor("#cccccc").stroke();
      doc.rect(50, customerTop, 495, 22).fill("#f5f5f5");
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold").text("CUSTOMER DETAILS", 60, customerTop + 6);
      doc.fontSize(9)
        .fillColor("#333333")
        .font("Helvetica")
        .text(`Name: ${quotation.customerName}`, 60, customerTop + 32)
        .text(`Email: ${quotation.customerEmail}`, 60, customerTop + 47)
        .text(`Phone: ${quotation.customerPhone}`, 60, customerTop + 62)
        .text(`Address: ${quotation.address}`, 60, customerTop + 77, { width: 475 });

      // ===== ITEMS TABLE =====
      const tableTop = 360;
      doc.rect(50, tableTop, 495, 24).fill(env.BRAND_PRIMARY_COLOR);
      doc.rect(50, tableTop + 21, 495, 3).fill(env.BRAND_SECONDARY_COLOR);
      doc.fontSize(9)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("DESCRIPTION", 60, tableTop + 7, { width: 270 })
        .text("QTY", 345, tableTop + 7, { width: 45, align: "right" })
        .text("UNIT PRICE", 395, tableTop + 7, { width: 70, align: "right" })
        .text("AMOUNT", 470, tableTop + 7, { width: 65, align: "right" });

      const items = Array.isArray(quotation.items) ? (quotation.items as any[]) : [];
      let y = tableTop + 33;
      const rowH = 18;
      const maxY = 650;
      const maxRows = Math.max(0, Math.floor((maxY - y) / rowH));
      const visibleItems = items.slice(0, maxRows);

      visibleItems.forEach((item: any, idx: number) => {
        const description = String(item?.description ?? "Line item");
        const quantity = Number(item?.quantity ?? 0);
        const unitPrice = Number(item?.unitPrice ?? 0);
        const amount = item?.total !== undefined && item?.total !== null ? Number(item.total) : quantity * unitPrice;

        doc.rect(50, y - 4, 495, rowH).fill(idx % 2 === 0 ? "#f9fafb" : "#ffffff");
        doc.fontSize(9)
          .fillColor("#333333")
          .font("Helvetica")
          .text(description, 60, y, { width: 270 })
          .text(quantity ? String(quantity) : "", 345, y, { width: 45, align: "right" })
          .text(unitPrice ? `R${unitPrice.toFixed(2)}` : "", 395, y, { width: 70, align: "right" })
          .font("Helvetica-Bold")
          .text(amount ? `R${amount.toFixed(2)}` : "", 470, y, { width: 65, align: "right" });

        y += rowH;
      });

      if (items.length > visibleItems.length) {
        doc.fontSize(9)
          .fillColor("#666666")
          .font("Helvetica-Oblique")
          .text(`Note: ${items.length - visibleItems.length} additional item(s) omitted.`, 50, maxY + 10, {
            width: 495,
          });
      }

      // ===== TOTALS =====
      const totalsX = 380;
      let totalsY = 700;
      doc.fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text("Subtotal:", totalsX, totalsY, { width: 70, align: "right" })
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${Number(quotation.subtotal || 0).toFixed(2)}`, 460, totalsY, { width: 75, align: "right" });

      totalsY += 18;
      doc.fillColor("#666666")
        .font("Helvetica")
        .text("VAT/Tax:", totalsX, totalsY, { width: 70, align: "right" })
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${Number(quotation.tax || 0).toFixed(2)}`, 460, totalsY, { width: 75, align: "right" });

      totalsY += 18;
      doc.rect(380, totalsY - 5, 165, 28).fill(env.BRAND_PRIMARY_COLOR);
      doc.rect(380, totalsY + 20, 165, 3).fill(env.BRAND_SECONDARY_COLOR);
      doc.fontSize(12)
        .fillColor("#ffffff")
        .font("Helvetica")
        .text("TOTAL:", totalsX, totalsY + 3, { width: 70, align: "right" })
        .font("Helvetica-Bold")
        .text(`R${Number(quotation.total || 0).toFixed(2)}`, 460, totalsY + 3, { width: 75, align: "right" });

      doc.end();
    } catch (e) {
      reject(e);
    }
  });

  return {
    pdfBuffer,
    filename: `Quotation_${quotation.quoteNumber}.pdf`,
  };
}
