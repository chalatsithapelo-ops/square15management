import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: typeof autoTable;
  }
}

interface OrderPDFData {
  orderNumber: string;
  companyName: string;
  companyEmail: string;
  companyPhone: string;
  contactPerson: string;
  address: string;
  description: string;
  urgencyLevel: string;
  startDate?: string;
  endDate?: string;
  budgetInfo?: {
    callOutFee?: number;
    labourRate?: number;
    totalMaterialBudget?: number;
    numLabourersNeeded?: number;
    totalLabourCostBudget?: number;
  };
}

interface InvoicePDFData {
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  customerAddress: string;
  items: Array<{
    description: string;
    unitOfMeasure: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
  subtotal: number;
  vat: number;
  total: number;
  notes?: string;
}

interface RFQPDFData {
  title: string;
  description: string;
  scopeOfWork: string;
  buildingAddress: string;
  buildingName?: string;
  urgency: string;
  estimatedBudget?: number;
  notes?: string;
  contractors?: Array<{ name: string; email: string }>;
}

interface MaintenanceRequestPDFData {
  title: string;
  description: string;
  category: string;
  urgency: string;
  contractorInfo?: {
    companyName: string;
    email: string;
    phone: string;
  };
  buildingName?: string;
}

export const generateOrderPDF = (data: OrderPDFData): jsPDF => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(20, 184, 166); // Teal color
  doc.text("Work Order", 105, 20, { align: "center" });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Order #: ${data.orderNumber}`, 105, 28, { align: "center" });
  
  // Company Information
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Contractor Information", 20, 45);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Company: ${data.companyName}`, 20, 55);
  doc.text(`Contact Person: ${data.contactPerson}`, 20, 62);
  doc.text(`Email: ${data.companyEmail}`, 20, 69);
  doc.text(`Phone: ${data.companyPhone}`, 20, 76);
  
  // Work Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Work Details", 20, 90);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Address: ${data.address}`, 20, 100);
  doc.text(`Urgency: ${data.urgencyLevel}`, 20, 107);
  
  if (data.startDate) {
    doc.text(`Start Date: ${data.startDate}`, 20, 114);
  }
  if (data.endDate) {
    doc.text(`End Date: ${data.endDate}`, 20, 121);
  }
  
  // Description
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Description", 20, 135);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitDescription = doc.splitTextToSize(data.description, 170);
  doc.text(splitDescription, 20, 145);
  
  // Budget Information (if provided)
  if (data.budgetInfo && Object.keys(data.budgetInfo).length > 0) {
    const yPos = 145 + (splitDescription.length * 7) + 10;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Budget Information", 20, yPos);
    
    const budgetData = [];
    if (data.budgetInfo.callOutFee) {
      budgetData.push(["Call-Out Fee", `R${data.budgetInfo.callOutFee.toLocaleString()}`]);
    }
    if (data.budgetInfo.labourRate) {
      budgetData.push(["Labour Rate (per hour)", `R${data.budgetInfo.labourRate.toLocaleString()}`]);
    }
    if (data.budgetInfo.totalMaterialBudget) {
      budgetData.push(["Total Material Budget", `R${data.budgetInfo.totalMaterialBudget.toLocaleString()}`]);
    }
    if (data.budgetInfo.numLabourersNeeded) {
      budgetData.push(["Number of Labourers", String(data.budgetInfo.numLabourersNeeded)]);
    }
    if (data.budgetInfo.totalLabourCostBudget) {
      budgetData.push(["Total Labour Budget", `R${data.budgetInfo.totalLabourCostBudget.toLocaleString()}`]);
    }
    
    autoTable(doc, {
      startY: yPos + 5,
      head: [["Item", "Amount"]],
      body: budgetData,
      theme: "striped",
      headStyles: { fillColor: [20, 184, 166] },
    });
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    105,
    280,
    { align: "center" }
  );
  
  return doc;
};

export const generateInvoicePDF = (data: InvoicePDFData): jsPDF => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(24);
  doc.setTextColor(20, 184, 166);
  doc.text("INVOICE", 105, 20, { align: "center" });
  
  // Invoice Details
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Invoice #: ${data.invoiceNumber}`, 20, 35);
  doc.text(`Date: ${data.invoiceDate}`, 20, 42);
  doc.text(`Due Date: ${data.dueDate}`, 20, 49);
  
  // Customer Information
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Bill To:", 20, 65);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(data.customerName, 20, 73);
  doc.text(data.customerEmail, 20, 80);
  doc.text(data.customerPhone, 20, 87);
  doc.text(data.customerAddress, 20, 94);
  
  // Line Items Table
  const tableData = data.items.map((item) => [
    item.description,
    item.unitOfMeasure,
    item.quantity.toString(),
    `R${item.unitPrice.toFixed(2)}`,
    `R${item.total.toFixed(2)}`,
  ]);
  
  autoTable(doc, {
    startY: 105,
    head: [["Description", "UoM", "Qty", "Unit Price", "Total"]],
    body: tableData,
    theme: "striped",
    headStyles: { fillColor: [20, 184, 166] },
    columnStyles: {
      2: { halign: "center" },
      3: { halign: "right" },
      4: { halign: "right" },
    },
  });
  
  // Financial Summary
  const finalY = (doc as any).lastAutoTable.finalY || 105;
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  
  const summaryX = 140;
  doc.text("Subtotal:", summaryX, finalY + 15);
  doc.text(`R${data.subtotal.toFixed(2)}`, 180, finalY + 15, { align: "right" });
  
  doc.setTextColor(34, 197, 94); // Green for VAT
  doc.text("VAT (15%):", summaryX, finalY + 23);
  doc.text(`R${data.vat.toFixed(2)}`, 180, finalY + 23, { align: "right" });
  
  // Total with background
  doc.setFillColor(20, 184, 166);
  doc.rect(summaryX - 5, finalY + 28, 50, 10, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.text("TOTAL:", summaryX, finalY + 35);
  doc.text(`R${data.total.toFixed(2)}`, 180, finalY + 35, { align: "right" });
  
  // Notes
  if (data.notes) {
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text("Notes:", 20, finalY + 55);
    const splitNotes = doc.splitTextToSize(data.notes, 170);
    doc.text(splitNotes, 20, finalY + 63);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    105,
    280,
    { align: "center" }
  );
  
  return doc;
};

export const generateRFQPDF = (data: RFQPDFData): jsPDF => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(139, 92, 246); // Purple color
  doc.text("Request for Quotation", 105, 20, { align: "center" });
  
  // Property Information
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Property Information", 20, 40);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  if (data.buildingName) {
    doc.text(`Building: ${data.buildingName}`, 20, 50);
  }
  doc.text(`Address: ${data.buildingAddress}`, 20, 57);
  doc.text(`Urgency Level: ${data.urgency}`, 20, 64);
  
  if (data.estimatedBudget) {
    doc.text(`Estimated Budget: R${data.estimatedBudget.toLocaleString()}`, 20, 71);
  }
  
  // RFQ Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("RFQ Title", 20, 85);
  
  doc.setFontSize(12);
  doc.setTextColor(60);
  doc.text(data.title, 20, 93);
  
  // Description
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Description", 20, 107);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitDesc = doc.splitTextToSize(data.description, 170);
  doc.text(splitDesc, 20, 115);
  
  // Scope of Work
  const scopeY = 115 + (splitDesc.length * 7) + 8;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Scope of Work", 20, scopeY);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitScope = doc.splitTextToSize(data.scopeOfWork, 170);
  doc.text(splitScope, 20, scopeY + 8);
  
  // Contractors (if specified)
  if (data.contractors && data.contractors.length > 0) {
    const contractorY = scopeY + 8 + (splitScope.length * 7) + 10;
    
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Selected Contractors", 20, contractorY);
    
    const contractorData = data.contractors.map((c) => [c.name, c.email]);
    
    autoTable(doc, {
      startY: contractorY + 5,
      head: [["Company Name", "Email"]],
      body: contractorData,
      theme: "striped",
      headStyles: { fillColor: [139, 92, 246] },
    });
  }
  
  // Notes
  if (data.notes) {
    const notesY = (doc as any).lastAutoTable?.finalY 
      ? (doc as any).lastAutoTable.finalY + 15 
      : scopeY + 8 + (splitScope.length * 7) + 20;
      
    doc.setFontSize(12);
    doc.setTextColor(0);
    doc.text("Internal Notes", 20, notesY);
    
    doc.setFontSize(10);
    doc.setTextColor(60);
    const splitNotes = doc.splitTextToSize(data.notes, 170);
    doc.text(splitNotes, 20, notesY + 8);
  }
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    105,
    280,
    { align: "center" }
  );
  
  return doc;
};

export const generateMaintenanceRequestPDF = (data: MaintenanceRequestPDFData): jsPDF => {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.setTextColor(168, 85, 247); // Purple
  doc.text("Maintenance Request", 105, 20, { align: "center" });
  
  // Request Details
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Request Information", 20, 40);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.text(`Title: ${data.title}`, 20, 50);
  doc.text(`Category: ${data.category}`, 20, 57);
  doc.text(`Urgency Level: ${data.urgency}`, 20, 64);
  
  if (data.buildingName) {
    doc.text(`Property: ${data.buildingName}`, 20, 71);
  }
  
  // Contractor Information (if provided)
  if (data.contractorInfo) {
    doc.setFontSize(14);
    doc.setTextColor(0);
    doc.text("Assigned Contractor", 20, 85);
    
    doc.setFontSize(10);
    doc.setTextColor(60);
    doc.text(`Company: ${data.contractorInfo.companyName}`, 20, 95);
    doc.text(`Email: ${data.contractorInfo.email}`, 20, 102);
    doc.text(`Phone: ${data.contractorInfo.phone}`, 20, 109);
  }
  
  // Description
  const descY = data.contractorInfo ? 125 : 85;
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text("Description", 20, descY);
  
  doc.setFontSize(10);
  doc.setTextColor(60);
  const splitDesc = doc.splitTextToSize(data.description, 170);
  doc.text(splitDesc, 20, descY + 8);
  
  // Footer
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Generated on ${new Date().toLocaleString()}`,
    105,
    280,
    { align: "center" }
  );
  
  return doc;
};

// Helper function to download PDF
export const downloadPDF = (doc: jsPDF, filename: string) => {
  doc.save(filename);
};

// Helper function to get PDF as blob for upload
export const getPDFBlob = (doc: jsPDF): Blob => {
  return doc.output("blob");
};
