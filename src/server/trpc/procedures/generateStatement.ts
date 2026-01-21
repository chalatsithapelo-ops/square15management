import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { env } from "~/server/env";
import PDFDocument from "pdfkit";
import { getCompanyLogo } from "~/server/utils/logo";
import { getCompanyDetails } from "~/server/utils/company-details";
import { minioClient, minioBaseUrl } from "~/server/minio";
import { authenticateUser, isAdmin, requireAdmin } from "~/server/utils/auth";
import { sendStatementNotificationEmail } from "~/server/utils/email";
import { notifyCustomerStatement } from "~/server/utils/notifications";

export const generateStatement = baseProcedure
  .input(
    z.object({
      token: z.string(),
      client_email: z.string().email(),
      period_start: z.string(), // ISO date string
      period_end: z.string(), // ISO date string
      customerName: z.string().optional(),
      customerPhone: z.string().optional(),
      address: z.string().optional(),
      notes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);

    if (user.role === "PROPERTY_MANAGER") {
      const managedCustomer = await db.propertyManagerCustomer.findFirst({
        where: {
          propertyManagerId: user.id,
          email: input.client_email,
        },
        select: { id: true },
      });

      if (!managedCustomer) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only generate statements for customers you manage",
        });
      }
    } else {
      // Keep existing behavior: admins only
      requireAdmin(user);
    }

    const period_start = new Date(input.period_start);
    const period_end = new Date(input.period_end);

    // Generate unique statement number in format like "Statement #281"
    const lastStatement = await db.statement.findFirst({
      orderBy: { id: "desc" },
      select: { id: true },
    });
    const nextStatementNumber = (lastStatement?.id || 0) + 1;
    const statement_number = `Statement #${nextStatementNumber}`;

    // Create statement record with prepopulated data if available
    const statement = await db.statement.create({
      data: {
        statement_number,
        client_email: input.client_email,
        client_name: input.customerName || "", // Will be populated from invoices if not provided
        customerPhone: input.customerPhone || null,
        address: input.address || null,
        statement_date: new Date(),
        period_start,
        period_end,
        notes: input.notes || null,
        status: "generated",
        invoice_details: [], // Will be populated in background process
        age_analysis: {
          current: 0,
          days_31_60: 0,
          days_61_90: 0,
          days_91_120: 0,
          over_120: 0,
        }, // Will be populated in background process
      },
    });

    // Start background generation
    generateStatementInBackground(
      statement.id,
      statement_number,
      input.client_email,
      period_start,
      period_end,
      input.customerName,
      input.customerPhone,
      input.address,
      input.notes
    ).catch(
      (error) => {
        console.error("Error generating statement:", error);
        db.statement
          .update({
            where: { id: statement.id },
            data: {
              status: "overdue",
              errorMessage: error.message || "Unknown error occurred",
            },
          })
          .catch(console.error);
      }
    );

    return { statementId: statement.id, status: "generated" };
  });

async function generateStatementInBackground(
  statementId: number,
  statement_number: string,
  client_email: string,
  period_start: Date,
  period_end: Date,
  providedCustomerName?: string,
  providedCustomerPhone?: string,
  providedAddress?: string,
  providedNotes?: string
) {
  try {
    // Fetch all unpaid invoices for this customer (regardless of creation date)
    // Also fetch invoices that were paid during the statement period
    const unpaidInvoices = await db.invoice.findMany({
      where: {
        customerEmail: client_email,
        status: { in: ["SENT", "OVERDUE"] },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            address: true,
          },
        },
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Fetch invoices that were paid during the statement period
    const paidInvoices = await db.invoice.findMany({
      where: {
        customerEmail: client_email,
        status: "PAID",
        paidDate: { gte: period_start, lte: period_end },
      },
      include: {
        order: {
          select: {
            orderNumber: true,
            address: true,
          },
        },
        project: {
          select: {
            name: true,
            projectNumber: true,
          },
        },
      },
      orderBy: {
        createdAt: "asc",
      },
    });

    // Combine both lists
    const invoices = [...unpaidInvoices, ...paidInvoices];

    if (invoices.length === 0) {
      throw new Error("No outstanding or recently paid invoices found for this customer");
    }

    // Use provided customer details if available, otherwise get from first invoice
    const client_name = providedCustomerName || invoices[0].customerName;
    const customerPhone = providedCustomerPhone || invoices[0].customerPhone;
    const address = providedAddress || invoices[0].address;

    // Previous balance is now 0 since we're including all unpaid invoices in the statement
    const previous_balance = 0;

    // Calculate statement metrics
    const invoice_ids: string[] = [];
    const invoice_details: any[] = [];
    let subtotal = 0;
    let total_interest = 0;
    let payments_received = 0;
    
    // Age analysis buckets
    const age_analysis = {
      current: 0,
      days_31_60: 0,
      days_61_90: 0,
      days_91_120: 0,
      over_120: 0,
    };

    const today = new Date();

    invoices.forEach((invoice) => {
      invoice_ids.push(invoice.id.toString());

      // Calculate payment status
      const original_amount = invoice.total;
      const amount_paid = invoice.status === "PAID" ? invoice.total : 0;
      const balance = original_amount - amount_paid;

      if (invoice.status === "PAID") {
        payments_received += amount_paid;
      }

      // Calculate days overdue and interest
      let days_overdue = 0;
      let interest_charged = 0;
      let age_category = "current";

      if (invoice.dueDate && invoice.status !== "PAID") {
        const dueDate = new Date(invoice.dueDate);
        if (today > dueDate) {
          days_overdue = Math.floor((today.getTime() - dueDate.getTime()) / (24 * 60 * 60 * 1000));
          
          // Calculate interest: 2% per month (cumulative)
          const monthsOverdue = Math.max(1, Math.floor(days_overdue / 30));
          const chargeRate = 0.02 * monthsOverdue;
          interest_charged = balance * chargeRate;
          
          // Determine age category
          if (days_overdue <= 30) {
            age_category = "current";
            age_analysis.current += balance;
          } else if (days_overdue <= 60) {
            age_category = "31-60 days";
            age_analysis.days_31_60 += balance;
          } else if (days_overdue <= 90) {
            age_category = "61-90 days";
            age_analysis.days_61_90 += balance;
          } else if (days_overdue <= 120) {
            age_category = "91-120 days";
            age_analysis.days_91_120 += balance;
          } else {
            age_category = "over 120 days";
            age_analysis.over_120 += balance;
          }
        } else {
          age_analysis.current += balance;
        }
      } else if (invoice.status !== "PAID") {
        age_analysis.current += balance;
      }

      const total_due = balance + interest_charged;
      subtotal += balance;
      total_interest += interest_charged;

      // Extract order number and building information
      const order_number = invoice.order?.orderNumber || "";
      const building = invoice.project?.name || invoice.order?.address || "";
      
      // Create description from items
      let description = "";
      if (Array.isArray(invoice.items) && invoice.items.length > 0) {
        const firstItem = invoice.items[0] as any;
        description = firstItem.description || "";
        if (invoice.items.length > 1) {
          description += ` (+${invoice.items.length - 1} more)`;
        }
      }

      // Build invoice detail object
      invoice_details.push({
        invoice_id: invoice.id.toString(),
        invoice_number: invoice.invoiceNumber,
        order_number,
        building,
        description,
        invoice_date: invoice.createdAt.toISOString().split('T')[0],
        due_date: invoice.dueDate ? invoice.dueDate.toISOString().split('T')[0] : null,
        original_amount,
        amount_paid,
        balance,
        days_overdue,
        interest_charged,
        total_due,
        age_category,
      });
    });

    const total_amount_due = subtotal + total_interest;

    // Fetch statement template from system settings
    let statementTemplate = "";
    try {
      const templateSetting = await db.systemSettings.findUnique({
        where: { key: "statement_template_content" },
      });
      statementTemplate = templateSetting?.value || "";
    } catch (error) {
      console.error("Failed to fetch statement template:", error);
      statementTemplate = "Thank you for your business. Please review the invoice details above and make payment by the due date to avoid overdue charges.";
    }

    // Add notes if provided
    if (providedNotes) {
      statementTemplate = providedNotes + "\n\n" + statementTemplate;
    }

    // Generate PDF
    const pdfBuffer = await generateStatementPdf(
      statement_number,
      client_name,
      client_email,
      customerPhone,
      address,
      period_start,
      period_end,
      invoice_details,
      subtotal,
      total_interest,
      total_amount_due,
      payments_received,
      previous_balance,
      age_analysis,
      statementTemplate
    );

    // Upload to MinIO
    const fileName = `statements/${client_email.replace(/[^a-zA-Z0-9]/g, "-")}-${period_start.getTime()}-${period_end.getTime()}.pdf`;
    await minioClient.putObject("documents", fileName, pdfBuffer, {
      "Content-Type": "application/pdf",
    });

    const pdfUrl = `${minioBaseUrl}/documents/${fileName}`;

    // Determine final status based on outstanding balance
    let finalStatus: "sent" | "paid" | "overdue" = "sent";
    if (total_amount_due === 0) {
      finalStatus = "paid";
    } else if (invoice_details.some((inv: any) => inv.days_overdue > 0)) {
      finalStatus = "overdue";
    }

    // Update statement record
    await db.statement.update({
      where: { id: statementId },
      data: {
        status: finalStatus,
        client_name,
        customerPhone,
        address,
        pdfUrl,
        invoice_ids,
        invoice_details,
        age_analysis,
        subtotal,
        total_interest,
        total_amount_due,
        payments_received,
        sent_date: new Date(),
      },
    });

    // Notify customer (email + in-app) - best effort
    try {
      const periodLabel = `${period_start.toLocaleDateString("en-ZA")} - ${period_end.toLocaleDateString("en-ZA")}`;

      await sendStatementNotificationEmail({
        customerEmail: client_email,
        customerName: client_name,
        statementNumber: statement_number,
        statementPeriod: periodLabel,
        totalAmount: total_amount_due,
      });

      const customerUser = await db.user.findUnique({
        where: { email: client_email },
        select: { id: true },
      });

      if (customerUser) {
        await notifyCustomerStatement({
          customerId: customerUser.id,
          statementNumber: statement_number,
          statementId,
          totalDue: total_amount_due,
        });
      }
    } catch (notifyError) {
      console.error("Failed to send statement notifications:", notifyError);
    }
  } catch (error) {
    console.error("Error in background statement generation:", error);
    throw error;
  }
}

async function generateStatementPdf(
  statement_number: string,
  client_name: string,
  client_email: string,
  customerPhone: string | null,
  address: string | null,
  period_start: Date,
  period_end: Date,
  invoice_details: any[],
  subtotal: number,
  total_interest: number,
  total_amount_due: number,
  payments_received: number,
  previous_balance: number,
  age_analysis: any,
  statementTemplate: string
): Promise<Buffer> {
  const doc = new PDFDocument({ margin: 50, size: "A4" });
  const chunks: Buffer[] = [];

  doc.on("data", (chunk) => chunks.push(chunk));

  return new Promise<Buffer>(async (resolve, reject) => {
    doc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      resolve(pdfBuffer);
    });

    doc.on("error", reject);

    const companyDetails = await getCompanyDetails();

    // ===== HEADER SECTION WITH BRAND BANNER =====
    
    // Brand banner at the top (primary color with secondary accent)
    doc.rect(0, 0, 595, 140).fill(env.BRAND_PRIMARY_COLOR);
    
    // Secondary color accent strip
    doc.rect(0, 135, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

    // Add company logo on the banner
    const logoBuffer = await getCompanyLogo();
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

    // ===== STATEMENT TITLE AND INFO =====
    
    doc
      .fontSize(28)
      .fillColor(env.BRAND_PRIMARY_COLOR)
      .font("Helvetica-Bold")
      .text("CUSTOMER STATEMENT", 50, 170);

    // Statement number and customer ID
    doc
      .fontSize(11)
      .fillColor("#666666")
      .font("Helvetica")
      .text(`${statement_number}`, 50, 205)
      .text(`Customer ID: ${client_email.split('@')[0].toUpperCase()}`, 320, 205, { align: "right", width: 225 });

    // Statement period with accent color
    doc
      .fontSize(10)
      .fillColor("#666666")
      .font("Helvetica")
      .text(
        `Period: ${period_start.toLocaleDateString("en-ZA", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })} - ${period_end.toLocaleDateString("en-ZA", { 
          year: "numeric", 
          month: "long", 
          day: "numeric" 
        })}`,
        50,
        225
      )
      .fillColor(env.BRAND_ACCENT_COLOR)
      .text(`Date: ${new Date().toLocaleDateString("en-ZA", { 
        day: "numeric",
        month: "short",
        year: "2-digit"
      })}`, 320, 225, { align: "right", width: 225 });

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
      .text(client_name, 60, customerBoxTop + 38, { width: 220 })
      .font("Helvetica")
      .fontSize(9)
      .fillColor("#333333")
      .text(address || "Address not provided", 60, customerBoxTop + 53, { width: 220 })
      .text(client_email, 60, customerBoxTop + 73, { width: 220 });

    if (customerPhone) {
      doc.text(`Tel: ${customerPhone}`, 60, customerBoxTop + 88, { width: 220 });
    }

    // ===== ACCOUNT SUMMARY BOX =====
    
    const summaryBoxLeft = 310;
    
    // Box with primary color border
    doc
      .rect(summaryBoxLeft, customerBoxTop, 235, 130)
      .lineWidth(2)
      .strokeColor(env.BRAND_PRIMARY_COLOR)
      .stroke();
    
    // Light background
    doc.rect(summaryBoxLeft + 1, customerBoxTop + 1, 233, 128).fill("#f9fafb");

    // Header with primary color
    doc
      .rect(summaryBoxLeft, customerBoxTop, 235, 28)
      .fill(env.BRAND_PRIMARY_COLOR);
    
    doc
      .fontSize(11)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text("ACCOUNT SUMMARY", summaryBoxLeft + 10, customerBoxTop + 8);

    // Summary items with color coding
    let summaryY = customerBoxTop + 42;
    doc.fontSize(9).font("Helvetica");

    const summaryItems = [
      { label: "Subtotal:", value: subtotal, color: "#333333" },
      { label: "Payments Received:", value: payments_received, color: env.BRAND_SUCCESS_COLOR },
      { label: "Interest Charges:", value: total_interest, color: env.BRAND_DANGER_COLOR },
      { label: "Balance Due:", value: total_amount_due, color: env.BRAND_WARNING_COLOR },
    ];

    summaryItems.forEach((item) => {
      doc
        .fillColor("#666666")
        .text(item.label, summaryBoxLeft + 10, summaryY, { width: 110 })
        .fillColor(item.color)
        .font("Helvetica-Bold")
        .text(`R${item.value.toFixed(2)}`, summaryBoxLeft + 120, summaryY, { 
          width: 105, 
          align: "right" 
        })
        .font("Helvetica");
      summaryY += 16;
    });

    // Age Analysis section
    summaryY += 10;
    doc
      .fontSize(9)
      .fillColor("#666666")
      .font("Helvetica-Bold")
      .text("Age Analysis:", summaryBoxLeft + 10, summaryY);
    summaryY += 14;

    const ageItems = [
      { label: "Current:", value: age_analysis.current },
      { label: "31-60 days:", value: age_analysis.days_31_60 },
      { label: "61-90 days:", value: age_analysis.days_61_90 },
      { label: "91-120 days:", value: age_analysis.days_91_120 },
      { label: "Over 120 days:", value: age_analysis.over_120 },
    ];

    doc.fontSize(8).font("Helvetica");
    ageItems.forEach((item) => {
      if (item.value > 0) {
        doc
          .fillColor("#666666")
          .text(item.label, summaryBoxLeft + 10, summaryY, { width: 90 })
          .fillColor("#333333")
          .text(`R${item.value.toFixed(2)}`, summaryBoxLeft + 100, summaryY, { 
            width: 125, 
            align: "right" 
          });
        summaryY += 12;
      }
    });

    // ===== TOTAL AMOUNT DUE BANNER =====
    
    const totalBannerTop = 410;
    
    // Create gradient effect with primary and secondary colors
    doc.rect(50, totalBannerTop, 495, 45).fill(env.BRAND_PRIMARY_COLOR);
    doc.rect(50, totalBannerTop + 40, 495, 5).fill(env.BRAND_SECONDARY_COLOR);

    doc
      .fontSize(12)
      .fillColor("#ffffff")
      .font("Helvetica")
      .text("TOTAL AMOUNT DUE", 60, totalBannerTop + 8);
    
    doc
      .fontSize(20)
      .font("Helvetica-Bold")
      .text(`R${total_amount_due.toFixed(2)}`, 60, totalBannerTop + 20, { 
        width: 475, 
        align: "right" 
      });

    if (total_interest > 0) {
      doc
        .fontSize(8)
        .font("Helvetica")
        .fillColor(env.BRAND_SECONDARY_COLOR)
        .text(
          `(Includes R${total_interest.toFixed(2)} in interest charges)`,
          60,
          totalBannerTop + 35,
          { width: 475, align: "right" }
        );
    }

    // ===== INVOICE DETAILS TABLE =====
    
    let yPos = 485;
    
    doc
      .fontSize(14)
      .fillColor(env.BRAND_PRIMARY_COLOR)
      .font("Helvetica-Bold")
      .text("INVOICE DETAILS", 50, yPos);
    
    yPos += 30;

    // Table header with gradient effect
    doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
    doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

    doc
      .fontSize(8)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text("Date", 55, yPos + 8, { width: 45 })
      .text("Order #", 105, yPos + 8, { width: 50 })
      .text("Invoice #", 160, yPos + 8, { width: 55 })
      .text("Building", 220, yPos + 8, { width: 65 })
      .text("Charges", 290, yPos + 8, { width: 50, align: "right" })
      .text("Credited", 345, yPos + 8, { width: 50, align: "right" })
      .text("Balance", 400, yPos + 8, { width: 50, align: "right" })
      .text("Interest", 455, yPos + 8, { width: 50, align: "right" })
      .text("Total", 510, yPos + 8, { width: 30, align: "right" });

    yPos += 30;

    // Invoice rows with enhanced styling
    invoice_details.forEach((invoice: any, index: number) => {
      // Check if we need a new page
      if (yPos > 680) {
        doc.addPage();
        yPos = 50;
        
        // Repeat table header on new page
        doc.rect(50, yPos, 495, 25).fill(env.BRAND_PRIMARY_COLOR);
        doc.rect(50, yPos + 22, 495, 3).fill(env.BRAND_SECONDARY_COLOR);

        doc
          .fontSize(8)
          .fillColor("#ffffff")
          .font("Helvetica-Bold")
          .text("Date", 55, yPos + 8, { width: 45 })
          .text("Order #", 105, yPos + 8, { width: 50 })
          .text("Invoice #", 160, yPos + 8, { width: 55 })
          .text("Building", 220, yPos + 8, { width: 65 })
          .text("Charges", 290, yPos + 8, { width: 50, align: "right" })
          .text("Credited", 345, yPos + 8, { width: 50, align: "right" })
          .text("Balance", 400, yPos + 8, { width: 50, align: "right" })
          .text("Interest", 455, yPos + 8, { width: 50, align: "right" })
          .text("Total", 510, yPos + 8, { width: 30, align: "right" });

        yPos += 30;
      }

      // Alternate row colors with subtle branding
      if (index % 2 === 0) {
        doc.rect(50, yPos - 3, 495, 18).fill("#f9fafb");
      } else {
        doc.rect(50, yPos - 3, 495, 18).fill("#ffffff");
      }

      // Add subtle left border with accent color for overdue invoices
      if (invoice.days_overdue > 0) {
        doc.rect(50, yPos - 3, 3, 18).fill(env.BRAND_DANGER_COLOR);
      } else if (invoice.amount_paid > 0) {
        doc.rect(50, yPos - 3, 3, 18).fill(env.BRAND_SUCCESS_COLOR);
      }

      const invoiceDate = new Date(invoice.invoice_date).toLocaleDateString("en-ZA", { 
        day: "2-digit", 
        month: "short" 
      });

      doc
        .fontSize(7)
        .fillColor("#333333")
        .font("Helvetica")
        .text(invoiceDate, 55, yPos, { width: 45 })
        .text(invoice.order_number || "-", 105, yPos, { width: 50, ellipsis: true })
        .text(invoice.invoice_number, 160, yPos, { width: 55, ellipsis: true })
        .text(invoice.building || "-", 220, yPos, { width: 65, ellipsis: true })
        .font("Helvetica-Bold")
        .text(`R${invoice.original_amount.toFixed(2)}`, 290, yPos, { width: 50, align: "right" })
        .fillColor(env.BRAND_SUCCESS_COLOR)
        .text(`R${invoice.amount_paid.toFixed(2)}`, 345, yPos, { width: 50, align: "right" })
        .fillColor("#333333")
        .text(`R${invoice.balance.toFixed(2)}`, 400, yPos, { width: 50, align: "right" })
        .fillColor(env.BRAND_DANGER_COLOR)
        .text(
          invoice.interest_charged > 0 ? `R${invoice.interest_charged.toFixed(2)}` : "-",
          455,
          yPos,
          { width: 50, align: "right" }
        )
        .fillColor("#333333")
        .font("Helvetica-Bold")
        .text(`R${invoice.total_due.toFixed(2)}`, 510, yPos, { width: 30, align: "right" });

      yPos += 18;
    });

    // ===== PAYMENT INSTRUCTIONS PAGE =====
    
    doc.addPage();
    yPos = 50;

    // Header with brand colors
    doc.rect(0, 0, 595, 5).fill(env.BRAND_SECONDARY_COLOR);

    doc
      .fontSize(18)
      .fillColor(env.BRAND_PRIMARY_COLOR)
      .font("Helvetica-Bold")
      .text("PAYMENT INSTRUCTIONS", 50, yPos);
    
    yPos += 35;

    doc
      .fontSize(10)
      .fillColor("#666666")
      .font("Helvetica")
      .text(
        "Please make payment to the following bank account. Use your invoice number as the payment reference to ensure proper allocation.",
        50,
        yPos,
        { width: 495, align: "justify" }
      );

    yPos += 50;

    // Banking details box with accent border
    doc
      .rect(50, yPos, 495, 120)
      .lineWidth(2)
      .strokeColor(env.BRAND_ACCENT_COLOR)
      .stroke();
    
    doc.rect(51, yPos + 1, 493, 118).fill("#f9fafb");

    // Header
    doc.rect(50, yPos, 495, 35).fill(env.BRAND_ACCENT_COLOR);
    doc
      .fontSize(12)
      .fillColor("#ffffff")
      .font("Helvetica-Bold")
      .text("BANKING DETAILS", 60, yPos + 11);

    yPos += 45;

    // Banking information with icons/labels
    const bankingDetails = [
      { label: "Bank Name:", value: companyDetails.companyBankName },
      { label: "Account Name:", value: companyDetails.companyBankAccountName },
      { label: "Account Number:", value: companyDetails.companyBankAccountNumber },
      { label: "Branch Code:", value: companyDetails.companyBankBranchCode },
    ];

    bankingDetails.forEach((detail) => {
      doc
        .fontSize(10)
        .fillColor("#666666")
        .font("Helvetica")
        .text(detail.label, 60, yPos, { width: 150 })
        .fillColor("#1a1a1a")
        .font("Helvetica-Bold")
        .text(detail.value, 210, yPos, { width: 325 });
      yPos += 18;
    });

    // Overdue notice if applicable
    const overdueInvoices = invoice_details.filter((i: any) => i.days_overdue > 0);
    if (overdueInvoices.length > 0) {
      yPos += 30;
      
      doc
        .rect(50, yPos, 495, 100)
        .lineWidth(2)
        .strokeColor(env.BRAND_DANGER_COLOR)
        .stroke();
      
      doc.rect(51, yPos + 1, 493, 98).fill("#fef2f2");

      doc
        .rect(50, yPos, 495, 35)
        .fill(env.BRAND_DANGER_COLOR);
      
      doc
        .fontSize(12)
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .text("⚠ OVERDUE NOTICE", 60, yPos + 11);

      yPos += 45;

      const totalOverdue = overdueInvoices.reduce((sum: number, inv: any) => sum + inv.balance, 0);
      
      doc
        .fontSize(9)
        .fillColor("#991b1b")
        .font("Helvetica")
        .text(
          `You have ${overdueInvoices.length} overdue invoice(s) with a total value of R${totalOverdue.toFixed(2)}. ` +
          `Interest charges of R${total_interest.toFixed(2)} (calculated at 2% per month, cumulative) have been applied to your account. ` +
          `Please settle these outstanding invoices immediately to avoid further charges and maintain your account in good standing.`,
          60,
          yPos,
          { width: 475, align: "justify", lineGap: 2 }
        );
    }

    // Statement Notes section (if template is provided)
    if (statementTemplate && statementTemplate.trim().length > 0) {
      yPos = overdueInvoices.length > 0 ? yPos + 80 : yPos + 30;
      
      // Check if we need a new page
      if (yPos > 650) {
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
        .text("IMPORTANT NOTES", 60, yPos + 9);

      yPos += 40;

      doc
        .fontSize(9)
        .fillColor("#333333")
        .font("Helvetica")
        .text(statementTemplate, 60, yPos, { width: 475, align: "justify", lineGap: 3 });
    }

    // Footer on every page
    const pageRange = doc.bufferedPageRange();
    const pageCount = pageRange.count;
    
    try {
      for (let i = 0; i < pageCount; i++) {
        // Validate page index before switching
        if (i >= 0 && i < pageCount) {
          try {
            doc.switchToPage(i);
            
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
          } catch (pageError) {
            console.error(`Error adding footer to page ${i}:`, pageError);
            // Continue to next page even if this one fails
          }
        }
      }
    } catch (error) {
      console.error("Error in footer generation loop:", error);
      // Don't fail the entire PDF generation if footer fails
    }

    doc.end();
  });
}
