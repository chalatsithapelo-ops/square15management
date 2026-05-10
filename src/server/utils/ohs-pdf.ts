// OHS PDF builder. Self-contained to keep the existing pdf-templates.ts
// untouched. Used to export Risk Assessments, Incidents, Toolbox Talks
// and policies/procedures into download-ready A4 PDFs.
import PDFDocument from "pdfkit";

interface CompanyHeader {
  name: string;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  vatNumber?: string | null;
}

const PRIMARY = "#2D5016";
const ACCENT = "#5A9A47";
const MUTED = "#666666";

function streamToBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
}

function header(doc: PDFKit.PDFDocument, title: string, subtitle: string, company: CompanyHeader) {
  doc.rect(0, 0, doc.page.width, 70).fill(PRIMARY);
  doc.fillColor("white").font("Helvetica-Bold").fontSize(18).text(title, 40, 22);
  doc.fontSize(10).font("Helvetica").text(subtitle, 40, 48);
  doc.fillColor("black");
  doc.moveDown(3);

  // Company block
  doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY).text(company.name, 40, 90);
  doc.font("Helvetica").fontSize(9).fillColor(MUTED);
  if (company.address) doc.text(company.address, 40);
  const meta = [company.email, company.phone, company.vatNumber ? `VAT: ${company.vatNumber}` : null].filter(Boolean).join("  |  ");
  if (meta) doc.text(meta, 40);
  doc.moveDown(1);
  doc.fillColor("black");
}

function sectionHeading(doc: PDFKit.PDFDocument, text: string) {
  doc.moveDown(0.5);
  doc.font("Helvetica-Bold").fontSize(12).fillColor(PRIMARY).text(text);
  doc.moveTo(doc.x, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(ACCENT).lineWidth(1).stroke();
  doc.moveDown(0.4);
  doc.fillColor("black").font("Helvetica").fontSize(10);
}

function kv(doc: PDFKit.PDFDocument, label: string, value: string | number | null | undefined) {
  doc.font("Helvetica-Bold").fontSize(9).fillColor(MUTED).text(`${label}:`, { continued: true });
  doc.font("Helvetica").fontSize(10).fillColor("black").text(` ${value ?? "—"}`);
}

function legalFooter(doc: PDFKit.PDFDocument) {
  const y = doc.page.height - 40;
  doc.font("Helvetica-Oblique").fontSize(8).fillColor(MUTED).text(
    "This document is generated for compliance purposes under the Occupational Health and Safety Act, 1993 (Act No. 85 of 1993) of the Republic of South Africa. It must be retained for inspection per Sec 14.",
    40,
    y,
    { width: doc.page.width - 80, align: "center" }
  );
}

/**
 * Render markdown-style content into the PDF.
 * Supports:
 *  - "# "  H1, "## " H2, "### " H3
 *  - "- " / "* " bullet list
 *  - "[ ]" / "[x]" checklist item (renders empty/ticked square)
 *  - "|..." table row (rendered as monospace)
 *  - blank line = paragraph break
 *  - "**bold**" inline (rendered as bold run)
 *  - underscore lines / signature lines preserved
 */
function renderMarkdownBody(doc: PDFKit.PDFDocument, body: string) {
  const lines = body.split(/\r?\n/);
  const pageWidth = doc.page.width - 80;

  const ensureSpace = (h: number) => {
    if (doc.y + h > doc.page.height - 60) doc.addPage();
  };

  const writeBoldRuns = (text: string, opts: any = {}) => {
    // split by **bold**
    const parts = text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    parts.forEach((p, i) => {
      const isLast = i === parts.length - 1;
      if (p.startsWith("**") && p.endsWith("**")) {
        doc.font("Helvetica-Bold").text(p.slice(2, -2), { continued: !isLast, ...opts });
      } else {
        doc.font("Helvetica").text(p, { continued: !isLast, ...opts });
      }
    });
    if (parts.length === 0) doc.font("Helvetica").text("", opts);
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i] ?? "";
    const line = raw.replace(/\s+$/g, "");

    if (line.startsWith("# ")) {
      ensureSpace(28);
      doc.moveDown(0.5);
      doc.font("Helvetica-Bold").fontSize(16).fillColor(PRIMARY).text(line.slice(2));
      doc.fillColor("black").fontSize(10);
    } else if (line.startsWith("## ")) {
      ensureSpace(22);
      doc.moveDown(0.4);
      doc.font("Helvetica-Bold").fontSize(12).fillColor(PRIMARY).text(line.slice(3));
      doc.moveTo(40, doc.y).lineTo(doc.page.width - 40, doc.y).strokeColor(ACCENT).lineWidth(0.5).stroke();
      doc.moveDown(0.2);
      doc.fillColor("black").font("Helvetica").fontSize(10);
    } else if (line.startsWith("### ")) {
      ensureSpace(18);
      doc.moveDown(0.3);
      doc.font("Helvetica-Bold").fontSize(11).fillColor("black").text(line.slice(4));
      doc.font("Helvetica").fontSize(10);
    } else if (line.startsWith("- ") || line.startsWith("* ")) {
      ensureSpace(14);
      const text = line.slice(2);
      doc.font("Helvetica").fontSize(10).fillColor("black");
      const startX = doc.x;
      doc.text("•  ", { continued: true });
      writeBoldRuns(text, { width: pageWidth - 12 });
      doc.x = startX;
    } else if (/^\[[ xX]\]/.test(line)) {
      ensureSpace(16);
      const checked = /^\[[xX]\]/.test(line);
      const text = line.replace(/^\[[ xX]\]\s*/, "");
      const boxY = doc.y + 2;
      const boxX = doc.x;
      doc.rect(boxX, boxY, 9, 9).strokeColor("#333333").lineWidth(0.7).stroke();
      if (checked) {
        doc.font("Helvetica-Bold").fontSize(9).fillColor(PRIMARY).text("X", boxX + 1.5, boxY - 1);
        doc.fillColor("black");
      }
      doc.font("Helvetica").fontSize(10).text("  " + text, boxX + 12, boxY - 2, { width: pageWidth - 14 });
      doc.x = 40;
    } else if (line.startsWith("|")) {
      // Treat as monospace row
      ensureSpace(12);
      doc.font("Courier").fontSize(8).fillColor("black").text(line);
      doc.font("Helvetica").fontSize(10);
    } else if (line.trim() === "") {
      doc.moveDown(0.3);
    } else {
      ensureSpace(14);
      writeBoldRuns(line, { width: pageWidth, align: "left" });
    }
  }
}


// ============================================================
// Risk Assessment PDF
// ============================================================
export interface RiskAssessmentPdfInput {
  reference?: string | null;
  title: string;
  activity: string;
  location?: string | null;
  status: string;
  overallRisk: string;
  effectiveDate?: Date | null;
  reviewDate?: Date | null;
  createdByName?: string;
  approvedByName?: string | null;
  aiSummary?: string | null;
  items: Array<{
    hazard: string;
    potentialHarm: string;
    inherentLikelihood: number;
    inherentSeverity: number;
    inherentRisk: string;
    controls: string;
    responsiblePerson?: string | null;
    residualLikelihood: number;
    residualSeverity: number;
    residualRisk: string;
    ppeRequired: string[];
    trainingRequired: string[];
    legalReferences: string[];
  }>;
  company: CompanyHeader;
}

export async function buildRiskAssessmentPdf(input: RiskAssessmentPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  header(doc, "RISK ASSESSMENT", input.reference || input.title, input.company);

  sectionHeading(doc, "Assessment Details");
  kv(doc, "Title", input.title);
  kv(doc, "Activity", input.activity);
  kv(doc, "Location", input.location || "—");
  kv(doc, "Status", input.status);
  kv(doc, "Overall residual risk", input.overallRisk);
  kv(doc, "Effective date", input.effectiveDate?.toISOString().slice(0, 10) || "—");
  kv(doc, "Review date", input.reviewDate?.toISOString().slice(0, 10) || "—");
  kv(doc, "Prepared by", input.createdByName || "—");
  kv(doc, "Approved by", input.approvedByName || "Pending");

  if (input.aiSummary) {
    sectionHeading(doc, "Executive Summary");
    doc.font("Helvetica").fontSize(10).fillColor("black").text(input.aiSummary, { align: "justify" });
  }

  sectionHeading(doc, "Hazards & Controls");
  input.items.forEach((it, idx) => {
    if (doc.y > doc.page.height - 200) doc.addPage();
    doc.font("Helvetica-Bold").fontSize(11).fillColor(PRIMARY).text(`${idx + 1}. ${it.hazard}`);
    doc.font("Helvetica").fontSize(9).fillColor("black");
    doc.text(`Potential harm: ${it.potentialHarm}`);
    doc.text(`Inherent: L${it.inherentLikelihood} × S${it.inherentSeverity} = ${it.inherentRisk}    Residual: L${it.residualLikelihood} × S${it.residualSeverity} = ${it.residualRisk}`);
    doc.text(`Controls: ${it.controls}`);
    if (it.responsiblePerson) doc.text(`Responsible: ${it.responsiblePerson}`);
    if (it.ppeRequired.length) doc.text(`PPE: ${it.ppeRequired.join(", ")}`);
    if (it.trainingRequired.length) doc.text(`Training: ${it.trainingRequired.join(", ")}`);
    if (it.legalReferences.length) doc.text(`Legal: ${it.legalReferences.join("; ")}`, { fillColor: MUTED } as any);
    doc.moveDown(0.6);
  });

  sectionHeading(doc, "Acknowledgement");
  doc.font("Helvetica").fontSize(10).text(
    "I confirm that I have read and understood this risk assessment, and I will comply with all controls listed above.",
    { align: "justify" }
  );
  doc.moveDown(2);
  doc.text("Name: ___________________________   Signature: ___________________________   Date: __________", { align: "left" });

  legalFooter(doc);
  doc.end();
  return streamToBuffer(doc);
}

// ============================================================
// Incident Report PDF
// ============================================================
export interface IncidentPdfInput {
  reference: string;
  type: string;
  severity: string;
  status: string;
  occurredAt: Date;
  reportedAt: Date;
  location: string;
  description: string;
  immediateActions?: string | null;
  injuredPersonName?: string | null;
  injuredPersonRole?: string | null;
  witnesses?: string | null;
  rootCause?: string | null;
  investigationNotes?: string | null;
  reportedToDol: boolean;
  reportedToDolAt?: Date | null;
  aiInsights?: string | null;
  reporterName?: string;
  correctiveActions?: Array<{
    description: string;
    responsibleName?: string;
    dueDate: Date;
    status: string;
  }>;
  company: CompanyHeader;
}

export async function buildIncidentPdf(input: IncidentPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  header(doc, "INCIDENT REPORT", input.reference, input.company);

  sectionHeading(doc, "Incident Details");
  kv(doc, "Reference", input.reference);
  kv(doc, "Type", input.type);
  kv(doc, "Severity", input.severity);
  kv(doc, "Status", input.status);
  kv(doc, "Occurred at", input.occurredAt.toISOString().replace("T", " ").slice(0, 16));
  kv(doc, "Reported at", input.reportedAt.toISOString().replace("T", " ").slice(0, 16));
  kv(doc, "Location", input.location);
  kv(doc, "Reported to DoL (Sec 24)", input.reportedToDol ? `Yes — ${input.reportedToDolAt?.toISOString().slice(0, 10) || "date pending"}` : "No");

  sectionHeading(doc, "Persons Involved");
  kv(doc, "Reporter", input.reporterName || "—");
  kv(doc, "Affected person", input.injuredPersonName || "None / not applicable");
  kv(doc, "Role", input.injuredPersonRole || "—");
  if (input.witnesses) kv(doc, "Witnesses", input.witnesses);

  sectionHeading(doc, "Description");
  doc.font("Helvetica").fontSize(10).text(input.description, { align: "justify" });

  if (input.immediateActions) {
    sectionHeading(doc, "Immediate Actions Taken");
    doc.font("Helvetica").fontSize(10).text(input.immediateActions, { align: "justify" });
  }

  if (input.rootCause || input.investigationNotes) {
    sectionHeading(doc, "Investigation");
    if (input.rootCause) {
      doc.font("Helvetica-Bold").fontSize(10).text("Root cause:");
      doc.font("Helvetica").text(input.rootCause, { align: "justify" });
      doc.moveDown(0.4);
    }
    if (input.investigationNotes) {
      doc.font("Helvetica-Bold").fontSize(10).text("Notes:");
      doc.font("Helvetica").text(input.investigationNotes, { align: "justify" });
    }
  }

  if (input.aiInsights) {
    sectionHeading(doc, "AI-Generated Insights");
    doc.font("Helvetica-Oblique").fontSize(9).fillColor(MUTED).text("(Advisory only — review and validate before relying on these)");
    doc.font("Helvetica").fontSize(10).fillColor("black").text(input.aiInsights, { align: "justify" });
  }

  if (input.correctiveActions?.length) {
    sectionHeading(doc, "Corrective Actions");
    input.correctiveActions.forEach((ca, idx) => {
      doc.font("Helvetica-Bold").fontSize(10).text(`${idx + 1}. ${ca.description}`);
      doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
        `Responsible: ${ca.responsibleName || "—"}    Due: ${ca.dueDate.toISOString().slice(0, 10)}    Status: ${ca.status}`
      );
      doc.fillColor("black").moveDown(0.4);
    });
  }

  legalFooter(doc);
  doc.end();
  return streamToBuffer(doc);
}

// ============================================================
// Toolbox Talk PDF
// ============================================================
export interface ToolboxTalkPdfInput {
  reference?: string | null;
  title: string;
  topic: string;
  content: string;
  publishedAt?: Date | null;
  ackDeadline?: Date | null;
  createdByName?: string;
  company: CompanyHeader;
}

export async function buildToolboxTalkPdf(input: ToolboxTalkPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  header(doc, "TOOLBOX TALK", input.title, input.company);

  sectionHeading(doc, "Details");
  kv(doc, "Reference", input.reference || "—");
  kv(doc, "Topic", input.topic);
  kv(doc, "Published", input.publishedAt?.toISOString().slice(0, 10) || "Draft");
  kv(doc, "Acknowledgement deadline", input.ackDeadline?.toISOString().slice(0, 10) || "—");
  kv(doc, "Prepared by", input.createdByName || "—");

  sectionHeading(doc, "Content");
  doc.font("Helvetica").fontSize(10).text(input.content, { align: "justify" });

  doc.addPage();
  sectionHeading(doc, "Attendance Register");
  doc.font("Helvetica").fontSize(9).fillColor(MUTED).text(
    "Each attendee must sign below to confirm they attended this talk and understood the content.",
    { align: "left" }
  );
  doc.moveDown(0.4).fillColor("black");
  for (let i = 1; i <= 18; i++) {
    doc.text(`${String(i).padStart(2, "0")}.  Name: __________________________   ID: ____________   Signature: __________________`);
    doc.moveDown(0.3);
  }

  legalFooter(doc);
  doc.end();
  return streamToBuffer(doc);
}

// ============================================================
// Generic Document (policy / procedure / SOP) PDF
// ============================================================
export interface DocumentPdfInput {
  type: string;
  reference?: string | null;
  title: string;
  version: string;
  effectiveDate?: Date | null;
  reviewDate?: Date | null;
  content: string;
  createdByName?: string;
  company: CompanyHeader;
}

export async function buildOhsDocumentPdf(input: DocumentPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: 40 });
  header(doc, input.type.replace(/_/g, " "), input.title, input.company);

  sectionHeading(doc, "Document Control");
  kv(doc, "Reference", input.reference || "—");
  kv(doc, "Version", input.version);
  kv(doc, "Effective date", input.effectiveDate?.toISOString().slice(0, 10) || "—");
  kv(doc, "Next review", input.reviewDate?.toISOString().slice(0, 10) || "—");
  kv(doc, "Author", input.createdByName || "—");

  sectionHeading(doc, "Content");
  renderMarkdownBody(doc, input.content);

  legalFooter(doc);
  doc.end();
  return streamToBuffer(doc);
}