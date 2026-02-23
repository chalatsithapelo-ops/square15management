/**
 * Shared PDF Template System
 * 
 * Provides reusable layout templates for quotations, invoices, and orders.
 * Supports multiple layout templates and customizable color themes.
 */
import PDFDocument from "pdfkit";
import { db } from "~/server/db";
import { env } from "~/server/env";

// ===== Types =====

export type PDFTemplateLayout = "classic" | "modern";

export interface PDFColorTheme {
  primary: string;      // Main brand color (header backgrounds, title text)
  secondary: string;    // Accent stripe color
  accent: string;       // Box borders, highlights
  headerText: string;   // Text on primary backgrounds
  tableHeaderBg: string; // Table header background
  tableHeaderText: string; // Table header text
  lineColor: string;    // Horizontal rules
  tagline: string;      // Tagline/subtitle text color
}

export interface PDFCompanyInfo {
  companyName: string;
  companyTagline?: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  companyPhone: string;
  companyEmail: string;
  companyVatNumber: string;
  companyBankName?: string;
  companyBankAccountName?: string;
  companyBankAccountNumber?: string;
  companyBankBranchCode?: string;
  companyBankAccountType?: string;
  postalAddress?: string;
  physicalAddress?: string;
}

export interface PDFCustomerInfo {
  customerName: string;
  customerVatNumber?: string;
  customerEmail?: string;
  customerPhone?: string;
  postalAddress?: string;
  physicalAddress?: string;
  address?: string; // legacy single address field
}

export interface PDFDocumentDetails {
  documentType: "QUOTATION" | "INVOICE" | "ORDER" | "JOB CARD" | "RFQ" | "STATEMENT";
  documentNumber: string;
  reference?: string;
  date: Date;
  dueDate?: Date;
  salesRep?: string;
  status?: string;
  overallDiscount?: number;
  projectName?: string;
  buildingName?: string;
  paymentTerms?: string;
  paidDate?: Date;
  orderNumber?: string;
}

export interface PDFLineItem {
  description: string;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
  vatPercent?: number;
  exclTotal: number;
  inclTotal: number;
  unitOfMeasure?: string;
}

export interface PDFTotals {
  totalDiscount?: number;
  subtotal: number;
  vat: number;
  total: number;
}

export interface PDFBankingDetails {
  bankName: string;
  accountName: string;
  accountNumber: string;
  branchCode: string;
  accountType?: string;
  reference: string;
}

export interface FullPDFData {
  template: PDFTemplateLayout;
  colors: PDFColorTheme;
  company: PDFCompanyInfo;
  customer: PDFCustomerInfo;
  document: PDFDocumentDetails;
  items: PDFLineItem[];
  totals: PDFTotals;
  banking?: PDFBankingDetails;
  notes?: string;
  paymentTerms?: string;
  logoBuffer?: Buffer | null;
}

// ===== Default Themes =====

export const DEFAULT_THEMES: Record<string, PDFColorTheme> = {
  olive: {
    primary: "#5C6B2F",
    secondary: "#D4A843",
    accent: "#5C6B2F",
    headerText: "#FFFFFF",
    tableHeaderBg: "#F5F5F0",
    tableHeaderText: "#333333",
    lineColor: "#D4A843",
    tagline: "#D4A843",
  },
  blue: {
    primary: "#1a4d8f",
    secondary: "#3a7bd5",
    accent: "#1a4d8f",
    headerText: "#FFFFFF",
    tableHeaderBg: "#EBF2FA",
    tableHeaderText: "#1a4d8f",
    lineColor: "#3a7bd5",
    tagline: "#3a7bd5",
  },
  green: {
    primary: "#2D5016",
    secondary: "#F4C430",
    accent: "#5A9A47",
    headerText: "#FFFFFF",
    tableHeaderBg: "#f0f7ec",
    tableHeaderText: "#2D5016",
    lineColor: "#F4C430",
    tagline: "#5A9A47",
  },
  teal: {
    primary: "#0d6e6e",
    secondary: "#14a3a3",
    accent: "#0d6e6e",
    headerText: "#FFFFFF",
    tableHeaderBg: "#e6f5f5",
    tableHeaderText: "#0d6e6e",
    lineColor: "#14a3a3",
    tagline: "#14a3a3",
  },
  charcoal: {
    primary: "#2c2c2c",
    secondary: "#c9a96e",
    accent: "#2c2c2c",
    headerText: "#FFFFFF",
    tableHeaderBg: "#f5f5f5",
    tableHeaderText: "#2c2c2c",
    lineColor: "#c9a96e",
    tagline: "#c9a96e",
  },
  red: {
    primary: "#8B1A1A",
    secondary: "#D4443B",
    accent: "#8B1A1A",
    headerText: "#FFFFFF",
    tableHeaderBg: "#FFF5F5",
    tableHeaderText: "#8B1A1A",
    lineColor: "#D4443B",
    tagline: "#D4443B",
  },
};

// ===== Fetch PDF Settings from DB =====

let _cachedPdfSettings: { template: PDFTemplateLayout; themeName: string; paymentTerms: string; companyTagline: string } | null = null;
let _lastSettingsFetch = 0;
const SETTINGS_CACHE_MS = 30_000;

export async function getPdfSettings(): Promise<{ template: PDFTemplateLayout; themeName: string; paymentTerms: string; companyTagline: string }> {
  const now = Date.now();
  if (_cachedPdfSettings && now - _lastSettingsFetch < SETTINGS_CACHE_MS) {
    return _cachedPdfSettings;
  }

  const rows = await db.systemSettings.findMany({
    where: {
      key: {
        in: [
          "pdf_template_layout",
          "pdf_color_theme",
          "pdf_payment_terms",
          "pdf_company_tagline",
        ],
      },
    },
  });

  const map: Record<string, string> = {};
  for (const r of rows) if (r.value) map[r.key] = r.value;

  _cachedPdfSettings = {
    template: (map.pdf_template_layout || "classic") as PDFTemplateLayout,
    themeName: map.pdf_color_theme || "olive",
    paymentTerms: map.pdf_payment_terms || "",
    companyTagline: map.pdf_company_tagline || "Unsurpassed Services",
  };
  _lastSettingsFetch = now;
  return _cachedPdfSettings;
}

export function clearPdfSettingsCache(): void {
  _cachedPdfSettings = null;
  _lastSettingsFetch = 0;
}

export function resolveTheme(themeName: string): PDFColorTheme {
  return (DEFAULT_THEMES[themeName] || DEFAULT_THEMES["olive"]) as PDFColorTheme;
}

// ===== Formatting Helpers =====

function formatCurrency(amount: number): string {
  return `R${amount.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function formatDate(d: Date): string {
  return new Date(d).toLocaleDateString("en-ZA", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatPercent(p: number): string {
  return `${p.toFixed(2)}%`;
}

// ===== CLASSIC TEMPLATE (matches attached screenshot) =====

function renderClassicTemplate(doc: typeof PDFDocument.prototype, data: FullPDFData): void {
  const { colors, company, customer, document: docInfo, items, totals, banking, logoBuffer } = data;
  const pageWidth = 595;
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;

  // ===== HEADER: Logo + Company Name (left) | Document Type (right) =====
  let headerY = 40;

  // Logo
  if (logoBuffer) {
    try {
      doc.image(logoBuffer, margin, headerY, { width: 80 });
    } catch (e) {
      console.error("Error adding logo to classic PDF:", e);
    }
  }

  // Company name and tagline below or next to logo
  const companyNameX = logoBuffer ? margin + 90 : margin;
  doc
    .fontSize(16)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(company.companyName.toUpperCase(), companyNameX, headerY + 5, { width: 250 });

  if (company.companyTagline) {
    doc
      .fontSize(9)
      .fillColor(colors.tagline)
      .font("Helvetica-Oblique")
      .text(company.companyTagline, companyNameX, headerY + 45, { width: 250 });
  }

  // Document type - large text on right
  const docTypeLabel = docInfo.documentType === "QUOTATION" ? "QUOTE" : docInfo.documentType;
  doc
    .fontSize(22)
    .fillColor("#333333")
    .font("Helvetica-Bold")
    .text(docTypeLabel, 350, headerY, { align: "right", width: contentWidth - 310 });

  // ===== Document Details (right side, below document type) =====
  let detailY = headerY + 30;
  const labelX = 370;
  const valueX = 460;
  const detailWidth = 95;

  const docDetails: [string, string][] = [
    ["NUMBER:", docInfo.documentNumber],
  ];
  if (docInfo.reference) docDetails.push(["REFERENCE:", docInfo.reference]);
  docDetails.push(["DATE:", formatDate(docInfo.date)]);
  if (docInfo.dueDate) docDetails.push(["DUE DATE:", formatDate(docInfo.dueDate)]);
  if (docInfo.salesRep) docDetails.push(["SALES REP:", docInfo.salesRep]);
  if (docInfo.overallDiscount !== undefined && docInfo.overallDiscount > 0) {
    docDetails.push(["OVERALL DISCOUNT %:", formatPercent(docInfo.overallDiscount)]);
  }
  if (docInfo.projectName) docDetails.push(["PROJECT:", docInfo.projectName]);
  if (docInfo.buildingName) docDetails.push(["BUILDING:", docInfo.buildingName]);

  docDetails.forEach(([label, value]) => {
    doc
      .fontSize(7.5)
      .fillColor("#666666")
      .font("Helvetica")
      .text(label, labelX, detailY, { width: 85, align: "right" });
    doc
      .fontSize(7.5)
      .fillColor("#1a1a1a")
      .font("Helvetica-Bold")
      .text(value, valueX, detailY, { width: detailWidth, align: "right" });
    detailY += 12;
  });

  // Page number
  doc
    .fontSize(7.5)
    .fillColor("#666666")
    .font("Helvetica")
    .text("PAGE:", labelX, detailY, { width: 85, align: "right" });
  doc
    .fontSize(7.5)
    .fillColor("#1a1a1a")
    .font("Helvetica-Bold")
    .text("1/1", valueX, detailY, { width: detailWidth, align: "right" });

  // ===== Horizontal gold line separator =====
  const separatorY = Math.max(headerY + 75, detailY + 20);
  doc
    .moveTo(margin, separatorY)
    .lineTo(pageWidth - margin, separatorY)
    .strokeColor(colors.lineColor)
    .lineWidth(2)
    .stroke();

  // ===== FROM / TO sections side by side =====
  let addressY = separatorY + 15;

  // FROM header
  doc
    .fontSize(8)
    .fillColor("#999999")
    .font("Helvetica")
    .text("FROM", margin, addressY);

  // TO header
  doc
    .text("TO", pageWidth / 2 + 10, addressY);

  addressY += 14;

  // FROM: Company name
  doc
    .fontSize(10)
    .fillColor("#1a1a1a")
    .font("Helvetica-Bold")
    .text(company.companyName.toUpperCase(), margin, addressY, { width: contentWidth / 2 - 10 });
  addressY += 14;

  // FROM: VAT number
  if (company.companyVatNumber) {
    doc
      .fontSize(8)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text(`VAT NO:  ${company.companyVatNumber}`, margin, addressY);
    addressY += 12;
  }

  // Address columns: POSTAL ADDRESS | PHYSICAL ADDRESS
  const addrColWidth = (contentWidth / 2 - 10) / 2;
  const fromPostal = company.postalAddress || company.companyAddressLine1;
  const fromPhysical = company.physicalAddress || company.companyAddressLine2;

  // Subheaders
  doc
    .fontSize(7)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("POSTAL ADDRESS:", margin, addressY, { width: addrColWidth })
    .text("PHYSICAL ADDRESS:", margin + addrColWidth + 5, addressY, { width: addrColWidth });

  addressY += 10;

  doc
    .fontSize(7.5)
    .fillColor("#555555")
    .font("Helvetica")
    .text(fromPostal || "", margin, addressY, { width: addrColWidth, lineGap: 2 })
    .text(fromPhysical || "", margin + addrColWidth + 5, addressY, { width: addrColWidth, lineGap: 2 });

  // TO: Customer details (right column)
  let toY = separatorY + 29;

  doc
    .fontSize(10)
    .fillColor("#1a1a1a")
    .font("Helvetica-Bold")
    .text(customer.customerName.toUpperCase(), pageWidth / 2 + 10, toY, { width: contentWidth / 2 - 10 });
  toY += 14;

  if (customer.customerVatNumber) {
    doc
      .fontSize(8)
      .fillColor("#333333")
      .font("Helvetica-Bold")
      .text(`CUSTOMER VAT NO: ${customer.customerVatNumber}`, pageWidth / 2 + 10, toY);
    toY += 12;
  }

  const toColStart = pageWidth / 2 + 10;
  const toColWidth = (contentWidth / 2 - 10) / 2;
  const custPostal = customer.postalAddress || customer.address || "";
  const custPhysical = customer.physicalAddress || customer.address || "";

  doc
    .fontSize(7)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text("POSTAL ADDRESS:", toColStart, toY, { width: toColWidth })
    .text("PHYSICAL ADDRESS:", toColStart + toColWidth + 5, toY, { width: toColWidth });

  toY += 10;

  doc
    .fontSize(7.5)
    .fillColor("#555555")
    .font("Helvetica")
    .text(custPostal, toColStart, toY, { width: toColWidth, lineGap: 2 })
    .text(custPhysical, toColStart + toColWidth + 5, toY, { width: toColWidth, lineGap: 2 });

  // ===== LINE ITEMS TABLE =====
  const tableTop = Math.max(addressY + 50, toY + 50);

  // Table header line (gold/accent)
  doc
    .moveTo(margin, tableTop)
    .lineTo(pageWidth - margin, tableTop)
    .strokeColor(colors.lineColor)
    .lineWidth(1.5)
    .stroke();

  // Column positions for classic layout
  const col = {
    desc: margin + 5,
    qty: 280,
    exclPrice: 320,
    disc: 380,
    vat: 410,
    exclTotal: 445,
    inclTotal: 500,
  };

  const colW = {
    desc: 230,
    qty: 35,
    exclPrice: 55,
    disc: 30,
    vat: 35,
    exclTotal: 55,
    inclTotal: 55,
  };

  // Header row
  const thY = tableTop + 5;
  doc
    .fontSize(7)
    .fillColor("#666666")
    .font("Helvetica-Oblique")
    .text("Description", col.desc, thY, { width: colW.desc })
    .text("Quantity", col.qty, thY, { width: colW.qty, align: "center" })
    .text("Excl. Price", col.exclPrice, thY, { width: colW.exclPrice, align: "right" })
    .text("Disc %", col.disc, thY, { width: colW.disc, align: "center" })
    .text("VAT %", col.vat, thY, { width: colW.vat, align: "center" })
    .text("Excl. Total", col.exclTotal, thY, { width: colW.exclTotal, align: "right" })
    .text("Incl. Total", col.inclTotal, thY, { width: colW.inclTotal, align: "right" });

  // Header bottom line
  const thBottomY = thY + 12;
  doc
    .moveTo(margin, thBottomY)
    .lineTo(pageWidth - margin, thBottomY)
    .strokeColor(colors.lineColor)
    .lineWidth(0.5)
    .stroke();

  // Line items
  let rowY = thBottomY + 8;

  items.forEach((item, index) => {
    // Check for page break
    if (rowY > 680) {
      doc.addPage();
      rowY = 50;
    }

    const vatPct = item.vatPercent !== undefined ? item.vatPercent : 15;
    const discPct = item.discountPercent !== undefined ? item.discountPercent : 0;

    doc
      .fontSize(8)
      .fillColor("#333333")
      .font("Helvetica")
      .text(item.description, col.desc, rowY, { width: colW.desc })
      .text(item.quantity.toFixed(2), col.qty, rowY, { width: colW.qty, align: "center" })
      .text(formatCurrency(item.unitPrice), col.exclPrice, rowY, { width: colW.exclPrice, align: "right" })
      .text(formatPercent(discPct), col.disc, rowY, { width: colW.disc, align: "center" })
      .text(formatPercent(vatPct), col.vat, rowY, { width: colW.vat, align: "center" })
      .text(formatCurrency(item.exclTotal), col.exclTotal, rowY, { width: colW.exclTotal, align: "right" });

    // Incl total in bold accent color
    doc
      .font("Helvetica-Bold")
      .fillColor(colors.primary)
      .text(formatCurrency(item.inclTotal), col.inclTotal, rowY, { width: colW.inclTotal, align: "right" });

    rowY += 18;
  });

  // ===== FOOTER AREA: Banking Details (left) | Totals (right) =====

  // Determine footer position
  let footerY = Math.max(rowY + 30, 620);
  if (footerY > 700) {
    doc.addPage();
    footerY = 50;
  }

  // Separator line above footer
  doc
    .moveTo(margin, footerY - 10)
    .lineTo(pageWidth - margin, footerY - 10)
    .strokeColor(colors.lineColor)
    .lineWidth(1)
    .stroke();

  // Banking details (bottom left)
  if (banking) {
    doc
      .fontSize(8)
      .fillColor("#1a1a1a")
      .font("Helvetica-Bold")
      .text(company.companyName + " (Pty) LTD", margin, footerY);

    let bankY = footerY + 12;
    const bankLines = [
      `Bank: ${banking.bankName}`,
      banking.accountType ? `Account Type: ${banking.accountType}` : null,
      `Account Number: ${banking.accountNumber}`,
      `Branch: ${banking.branchCode}`,
    ].filter(Boolean) as string[];

    doc
      .fontSize(7.5)
      .fillColor("#555555")
      .font("Helvetica");

    bankLines.forEach((line) => {
      doc.text(line, margin, bankY);
      bankY += 11;
    });
  }

  // Totals (bottom right)
  const totalsLabelX = 380;
  const totalsValueX = 480;
  const totalsValueW = pageWidth - margin - totalsValueX;
  let totY = footerY;

  const totalLines: [string, string][] = [];
  if (totals.totalDiscount !== undefined && totals.totalDiscount > 0) {
    totalLines.push(["Total Discount:", formatCurrency(totals.totalDiscount)]);
  }
  totalLines.push(["Total Exclusive:", formatCurrency(totals.subtotal)]);
  totalLines.push(["Total VAT:", formatCurrency(totals.vat)]);
  totalLines.push(["Sub Total:", formatCurrency(totals.subtotal + totals.vat)]);

  totalLines.forEach(([label, value]) => {
    doc
      .fontSize(8)
      .fillColor("#666666")
      .font("Helvetica")
      .text(label, totalsLabelX, totY, { width: 95, align: "right" })
      .fillColor("#1a1a1a")
      .font("Helvetica-Bold")
      .text(value, totalsValueX, totY, { width: totalsValueW, align: "right" });
    totY += 14;
  });

  // Grand Total with highlight
  totY += 5;
  doc
    .rect(totalsLabelX - 5, totY - 3, pageWidth - margin - totalsLabelX + 10, 22)
    .fill(colors.primary);

  doc
    .fontSize(11)
    .fillColor(colors.headerText)
    .font("Helvetica-Bold")
    .text("Grand Total:", totalsLabelX, totY + 2, { width: 95, align: "right" })
    .text(formatCurrency(totals.total), totalsValueX, totY + 2, { width: totalsValueW, align: "right" });

  // ===== PAYMENT TERMS (critical section requested by user) =====
  const paymentTermsText = data.paymentTerms || data.document.paymentTerms;
  if (paymentTermsText) {
    let ptY = totY + 35;
    if (ptY > 750) {
      doc.addPage();
      ptY = 50;
    }

    doc
      .moveTo(margin, ptY)
      .lineTo(pageWidth - margin, ptY)
      .strokeColor(colors.lineColor)
      .lineWidth(0.5)
      .stroke();

    ptY += 8;
    doc
      .fontSize(9)
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .text("PAYMENT TERMS", margin, ptY);

    ptY += 14;
    doc
      .fontSize(8)
      .fillColor("#555555")
      .font("Helvetica")
      .text(paymentTermsText, margin, ptY, { width: contentWidth, lineGap: 3 });
  }

  // ===== NOTES =====
  if (data.notes) {
    let notesY = paymentTermsText ? (doc.y + 15) : (totY + 35);
    if (notesY > 750) {
      doc.addPage();
      notesY = 50;
    }

    doc
      .fontSize(9)
      .fillColor(colors.primary)
      .font("Helvetica-Bold")
      .text("NOTES", margin, notesY);

    doc
      .fontSize(8)
      .fillColor("#666666")
      .font("Helvetica")
      .text(data.notes, margin, notesY + 14, { width: contentWidth, lineGap: 2 });
  }

  // ===== FOOTER LINE =====
  const footerLineY = 790;
  doc
    .moveTo(margin, footerLineY)
    .lineTo(pageWidth - margin, footerLineY)
    .strokeColor(colors.lineColor)
    .lineWidth(0.5)
    .stroke();

  doc
    .fontSize(7)
    .fillColor("#999999")
    .font("Helvetica")
    .text(
      `${company.companyName} | ${company.companyEmail} | VAT: ${company.companyVatNumber}`,
      margin,
      footerLineY + 4,
      { align: "center", width: contentWidth }
    );
}

// ===== MODERN TEMPLATE (previous branded banner style) =====

function renderModernTemplate(doc: typeof PDFDocument.prototype, data: FullPDFData): void {
  const { colors, company, customer, document: docInfo, items, totals, banking, logoBuffer } = data;
  const pageWidth = 595;
  const margin = 50;
  const contentWidth = pageWidth - margin * 2;

  // ===== HEADER SECTION WITH BRAND BANNER =====
  doc.rect(0, 0, pageWidth, 140).fill(colors.primary);
  doc.rect(0, 135, pageWidth, 5).fill(colors.secondary);

  if (logoBuffer) {
    try {
      doc.circle(100, 70, 45).fill("#ffffff").opacity(1);
      doc.opacity(1);
      doc.image(logoBuffer, 55, 25, { width: 90 });
    } catch (e) {
      console.error("Error adding logo to modern PDF:", e);
    }
  }

  // Company details on banner (right)
  doc
    .fontSize(11)
    .fillColor(colors.headerText)
    .font("Helvetica-Bold")
    .text(company.companyName, 320, 35, { align: "right", width: 225 })
    .font("Helvetica")
    .fontSize(9)
    .text(company.companyAddressLine1, 320, 52, { align: "right", width: 225 })
    .text(company.companyAddressLine2, 320, 65, { align: "right", width: 225 })
    .text(`Tel: ${company.companyPhone}`, 320, 85, { align: "right", width: 225 })
    .text(`Email: ${company.companyEmail}`, 320, 98, { align: "right", width: 225 })
    .text(`VAT: ${company.companyVatNumber}`, 320, 111, { align: "right", width: 225 });

  // ===== DOCUMENT TITLE =====
  const docTypeLabel = docInfo.documentType === "QUOTATION" ? "QUOTATION" : docInfo.documentType;
  doc
    .fontSize(28)
    .fillColor(colors.primary)
    .font("Helvetica-Bold")
    .text(docTypeLabel, margin, 170);

  // Status badge (for invoices)
  if (docInfo.status) {
    const statusColor = docInfo.status === "PAID" ? "#10b981"
      : docInfo.status === "OVERDUE" ? "#dc2626"
      : "#f59e0b";
    const statusBg = docInfo.status === "PAID" ? "#d1fae5"
      : docInfo.status === "OVERDUE" ? "#fee2e2"
      : "#fef3c7";
    doc.rect(470, 172, 75, 20).fill(statusBg);
    doc
      .fontSize(10)
      .fillColor(statusColor)
      .font("Helvetica-Bold")
      .text(docInfo.status, 470, 177, { width: 75, align: "center" });
  }

  // Document details
  let dy = 210;
  doc.fontSize(10).fillColor("#666666").font("Helvetica");
  doc.text(`${docTypeLabel} No: ${docInfo.documentNumber}`, margin, dy);
  dy += 15;

  if (docInfo.reference) {
    doc.text(`Client Ref: ${docInfo.reference}`, margin, dy);
    dy += 15;
  }

  doc.text(`Date: ${formatDate(docInfo.date)}`, margin, dy);
  dy += 15;

  if (docInfo.dueDate) {
    doc.fillColor(colors.accent).text(`Valid Until: ${formatDate(docInfo.dueDate)}`, margin, dy);
    dy += 15;
  }

  if (docInfo.orderNumber) {
    doc.fillColor(colors.primary).font("Helvetica-Bold").text(`Order No: ${docInfo.orderNumber}`, margin, dy);
    dy += 15;
  }

  if (docInfo.projectName) {
    doc.fillColor(colors.accent).font("Helvetica-Oblique").text(`Project: ${docInfo.projectName}`, margin, dy);
    dy += 15;
  }

  if (docInfo.buildingName) {
    doc.fillColor(colors.accent).font("Helvetica-Oblique").text(`Building: ${docInfo.buildingName}`, margin, dy);
    dy += 15;
  }

  // ===== CUSTOMER DETAILS BOX =====
  const boxTop = dy + 10;
  doc.rect(margin, boxTop, 240, 110).lineWidth(2).strokeColor(colors.accent).stroke();
  doc.rect(margin + 1, boxTop + 1, 238, 108).fill("#f9fafb");
  doc.rect(margin, boxTop, 240, 28).fill(colors.accent);
  doc.fontSize(11).fillColor(colors.headerText).font("Helvetica-Bold").text("BILL TO", margin + 10, boxTop + 8);

  doc
    .fontSize(10).fillColor("#1a1a1a").font("Helvetica-Bold")
    .text(customer.customerName, margin + 10, boxTop + 38, { width: 220 })
    .font("Helvetica").fontSize(9).fillColor("#333333")
    .text(customer.address || customer.postalAddress || "", margin + 10, boxTop + 53, { width: 220 })
    .text(customer.customerEmail || "", margin + 10, boxTop + 73, { width: 220 })
    .text(customer.customerPhone || "", margin + 10, boxTop + 88, { width: 220 });

  // ===== LINE ITEMS TABLE =====
  const tableTop = boxTop + 130;
  doc.rect(margin, tableTop, contentWidth, 25).fill(colors.primary);
  doc.rect(margin, tableTop + 22, contentWidth, 3).fill(colors.secondary);

  doc.fontSize(9).fillColor(colors.headerText).font("Helvetica-Bold")
    .text("DESCRIPTION", margin + 10, tableTop + 7, { width: 220 })
    .text("UoM", 290, tableTop + 7, { width: 40, align: "center" })
    .text("QTY", 340, tableTop + 7, { width: 40, align: "right" })
    .text("UNIT PRICE", 390, tableTop + 7, { width: 60, align: "right" })
    .text("AMOUNT", 460, tableTop + 7, { width: 75, align: "right" });

  let yPos = tableTop + 35;
  items.forEach((item, i) => {
    if (i % 2 === 0) doc.rect(margin, yPos - 5, contentWidth, 20).fill("#f9fafb");
    else doc.rect(margin, yPos - 5, contentWidth, 20).fill("#ffffff");

    doc.fontSize(9).fillColor("#333333").font("Helvetica")
      .text(item.description, margin + 10, yPos, { width: 220 })
      .text(item.unitOfMeasure || "Sum", 290, yPos, { width: 40, align: "center" })
      .text(item.quantity.toString(), 340, yPos, { width: 40, align: "right" })
      .text(formatCurrency(item.unitPrice), 390, yPos, { width: 60, align: "right" })
      .font("Helvetica-Bold")
      .text(formatCurrency(item.exclTotal), 460, yPos, { width: 75, align: "right" });

    yPos += 20;
  });

  // ===== TOTALS =====
  yPos += 20;
  const tX = 380;
  doc.fontSize(10).fillColor("#666666").font("Helvetica")
    .text("Subtotal:", tX, yPos, { width: 70, align: "right" })
    .fillColor("#333333").font("Helvetica-Bold")
    .text(formatCurrency(totals.subtotal), 460, yPos, { width: 75, align: "right" });

  yPos += 20;
  doc.fillColor("#666666").font("Helvetica")
    .text("VAT (15%):", tX, yPos, { width: 70, align: "right" })
    .fillColor("#333333").font("Helvetica-Bold")
    .text(formatCurrency(totals.vat), 460, yPos, { width: 75, align: "right" });

  yPos += 20;
  doc.rect(380, yPos - 5, 165, 28).fill(colors.primary);
  doc.rect(380, yPos + 20, 165, 3).fill(colors.secondary);
  doc.fontSize(12).fillColor(colors.headerText).font("Helvetica")
    .text("TOTAL:", tX, yPos + 3, { width: 70, align: "right" })
    .font("Helvetica-Bold")
    .text(formatCurrency(totals.total), 460, yPos + 3, { width: 75, align: "right" });

  // ===== PAYMENT DETAILS BOX =====
  if (banking) {
    yPos += 50;
    doc.rect(margin, yPos, contentWidth, 120).lineWidth(2).strokeColor(colors.accent).stroke();
    doc.rect(margin + 1, yPos + 1, contentWidth - 2, 118).fill("#f9fafb");
    doc.rect(margin, yPos, contentWidth, 35).fill(colors.accent);
    doc.fontSize(12).fillColor(colors.headerText).font("Helvetica-Bold")
      .text("PAYMENT DETAILS", margin + 10, yPos + 11);

    yPos += 45;
    const bankDetails = [
      { label: "Bank Name:", value: banking.bankName },
      { label: "Account Name:", value: banking.accountName },
      { label: "Account Number:", value: banking.accountNumber },
      { label: "Branch Code:", value: banking.branchCode },
      { label: "Reference:", value: banking.reference },
    ];

    bankDetails.forEach((d) => {
      doc.fontSize(10).fillColor("#666666").font("Helvetica")
        .text(d.label, margin + 10, yPos, { width: 150 })
        .fillColor("#1a1a1a").font("Helvetica-Bold")
        .text(d.value || "", margin + 160, yPos, { width: 325 });
      yPos += 16;
    });
  }

  // ===== PAYMENT TERMS =====
  const ptText = data.paymentTerms || data.document.paymentTerms;
  if (ptText) {
    yPos += 25;
    if (yPos > 730) { doc.addPage(); yPos = 50; }
    doc.fontSize(11).fillColor(colors.primary).font("Helvetica-Bold").text("PAYMENT TERMS", margin, yPos);
    yPos += 16;
    doc.fontSize(9).fillColor("#666666").font("Helvetica").text(ptText, margin, yPos, { width: contentWidth, lineGap: 3 });
    yPos = doc.y + 5;
  }

  // ===== NOTES =====
  if (data.notes) {
    yPos += 10;
    if (yPos > 740) { doc.addPage(); yPos = 50; }
    doc.fontSize(11).fillColor(colors.primary).font("Helvetica-Bold").text("NOTES", margin, yPos);
    yPos += 16;
    doc.fontSize(9).fillColor("#666666").font("Helvetica").text(data.notes, margin, yPos, { width: contentWidth, align: "justify" });
  }

  // ===== FOOTER =====
  doc.moveTo(margin, 770).lineTo(pageWidth - margin, 770).strokeColor(colors.accent).lineWidth(1).stroke();
  doc.fontSize(8).fillColor("#999999").font("Helvetica")
    .text("Thank you for your business!", margin, 778, { align: "center", width: contentWidth })
    .text(`${company.companyName} | ${company.companyEmail} | VAT Reg: ${company.companyVatNumber}`, margin, 788, { align: "center", width: contentWidth });
}

// ===== Main Render Function =====

export function renderPdfTemplate(doc: typeof PDFDocument.prototype, data: FullPDFData): void {
  if (data.template === "modern") {
    renderModernTemplate(doc, data);
  } else {
    renderClassicTemplate(doc, data);
  }
}

/**
 * Generate a complete PDF buffer from structured data.
 * This is the main entry point for all PDF generation.
 */
export async function generatePdfFromData(data: FullPDFData): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];
  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    try {
      renderPdfTemplate(doc, data);
      doc.end();
    } catch (error) {
      console.error("Error generating PDF:", error);
      reject(error);
    }
  });
}
