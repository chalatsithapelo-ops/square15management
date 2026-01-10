import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { fetchImageAsBuffer } from "~/server/utils/pdf-images";
import { getCompanyLogo } from "~/server/utils/logo";
import { env } from "~/server/env";

interface GeneratePropertyManagerRFQPdfResult {
  pdfBuffer: Buffer;
}

/**
 * Generate a PDF for a Property Manager RFQ
 */
export async function generatePropertyManagerRFQPdf(rfqId: number): Promise<GeneratePropertyManagerRFQPdfResult> {
  const rfq = await db.propertyManagerRFQ.findUnique({
    where: { id: rfqId },
    include: {
      propertyManager: {
        select: {
          pmCompanyName: true,
          pmCompanyAddressLine1: true,
          pmCompanyAddressLine2: true,
          pmCompanyPhone: true,
          pmCompanyEmail: true,
          pmCompanyVatNumber: true,
          pmBrandPrimaryColor: true,
          pmBrandSecondaryColor: true,
          pmBrandAccentColor: true,
        },
      },
    },
  });
  if (!rfq) throw new Error("RFQ not found");

  // Use PM's company details and branding from their user record
  const companyDetails = {
    companyName: rfq.propertyManager?.pmCompanyName || env.COMPANY_NAME || "Square 15 Facility Solutions",
    companyAddressLine1: rfq.propertyManager?.pmCompanyAddressLine1 || "",
    companyAddressLine2: rfq.propertyManager?.pmCompanyAddressLine2 || "",
    companyPhone: rfq.propertyManager?.pmCompanyPhone || "",
    companyEmail: rfq.propertyManager?.pmCompanyEmail || "",
  };

  const brandColors = {
    primary: rfq.propertyManager?.pmBrandPrimaryColor || "#2D5016",
    secondary: rfq.propertyManager?.pmBrandSecondaryColor || "#F4C430",
    accent: rfq.propertyManager?.pmBrandAccentColor || "#5A9A47",
  };

  const logoBuffer = await getCompanyLogo();

  const doc = new PDFDocument({ margin: 50, size: "A4" });
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

      // ===== RFQ TITLE =====
      doc.fontSize(24).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("REQUEST FOR QUOTATION", 50, 120);
      
      doc.fontSize(10).fillColor("#666666").font("Helvetica")
        .text(`RFQ #: ${rfq.rfqNumber}`, 50, 150)
        .text(`Date Issued: ${rfq.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}`, 50, 165)
        .text(`Status: ${rfq.status.replace(/_/g, " ")}`, 50, 180)
        .text(`Urgency: ${rfq.urgency}`, 50, 195);

      // ===== RFQ TITLE BOX =====
      const titleBoxTop = 220;
      
      doc.rect(50, titleBoxTop, 495, 60)
        .lineWidth(2)
        .strokeColor(brandColors.primary)
        .stroke();
      
      doc.rect(50, titleBoxTop, 495, 25)
        .fill(brandColors.primary);
      
      doc.fontSize(11).fillColor("#ffffff").font("Helvetica-Bold")
        .text("PROJECT TITLE", 60, titleBoxTop + 7);
      
      doc.fontSize(12).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(rfq.title, 60, titleBoxTop + 35, { width: 475 });

      // ===== PROPERTY INFORMATION BOX =====
      const propertyBoxTop = 295;
      
      doc.rect(50, propertyBoxTop, 495, 80)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, propertyBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("PROPERTY INFORMATION", 60, propertyBoxTop + 6);
      
      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(`Building: ${rfq.buildingName || "N/A"}`, 60, propertyBoxTop + 32)
        .text(`Address: ${rfq.buildingAddress}`, 60, propertyBoxTop + 47);

      if (rfq.estimatedBudget) {
        doc.fontSize(10).font("Helvetica-Bold").fillColor(brandColors.accent)
          .text(`Estimated Budget: R${rfq.estimatedBudget.toLocaleString()}`, 60, propertyBoxTop + 62);
      }

      // ===== PROJECT DESCRIPTION BOX =====
      const descBoxTop = 390;
      
      doc.rect(50, descBoxTop, 495, 120)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, descBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("PROJECT DESCRIPTION", 60, descBoxTop + 6);
      
      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(rfq.description, 60, descBoxTop + 32, { width: 475, align: "left" });

      // ===== SCOPE OF WORK BOX =====
      const scopeBoxTop = 525;
      
      doc.rect(50, scopeBoxTop, 495, 150)
        .lineWidth(1.5)
        .strokeColor("#cccccc")
        .stroke();
      
      doc.rect(50, scopeBoxTop, 495, 22)
        .fill("#f5f5f5");
      
      doc.fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
        .text("SCOPE OF WORK", 60, scopeBoxTop + 6);
      
      doc.fontSize(9).font("Helvetica").fillColor("#333333")
        .text(rfq.scopeOfWork, 60, scopeBoxTop + 32, { width: 475, align: "left" });

      // ===== SUBMISSION INSTRUCTIONS BOX =====
      const instructionsBoxTop = 690;
      
      doc.rect(50, instructionsBoxTop, 495, 60)
        .lineWidth(1.5)
        .strokeColor(brandColors.accent)
        .stroke();
      
      doc.rect(50, instructionsBoxTop, 495, 20)
        .fill(brandColors.accent);
      
      doc.fontSize(10).fillColor("#ffffff").font("Helvetica-Bold")
        .text("QUOTATION SUBMISSION INSTRUCTIONS", 60, instructionsBoxTop + 5);
      
      doc.fontSize(8).fillColor("#333333").font("Helvetica")
        .text("Please submit your detailed quotation including:", 60, instructionsBoxTop + 30)
        .text("• Itemized breakdown of costs", 70, instructionsBoxTop + 42)
        .text("• Timeline for completion", 280, instructionsBoxTop + 42)
        .text("• References and certifications", 70, instructionsBoxTop + 54);

      // ===== FOOTER =====
      doc.fontSize(8).fillColor("#666666").font("Helvetica-Oblique")
        .text(`For any queries regarding this RFQ, please contact: ${companyDetails.companyEmail} | ${companyDetails.companyPhone}`, 50, 760, { align: "center", width: 495 });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
  return { pdfBuffer };
}
