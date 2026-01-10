import nodemailer from "nodemailer";
import { env } from "~/server/env";
import { getCompanyDetails } from "~/server/utils/company-details";
import { sendEmailAsUser, getUserSmtpConfig } from "~/server/utils/email-user";
import { getBaseUrl } from "~/server/utils/base-url";

interface EmailAttachment {
  filename: string;
  content: Buffer;
  contentType?: string;
}

interface SendEmailParams {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
  userId?: number; // Optional: if provided, will attempt to send using user's personal email
}

/**
 * Create a nodemailer transporter with SMTP configuration
 */
function createTransporter() {
  const options: {
    host: string;
    port: number;
    secure: boolean;
    auth?: { user: string; pass: string };
  } = {
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
  };

  // Only include SMTP auth when credentials are provided (e.g., Gmail/App Password).
  // For local Mailhog, auth is not required.
  if (env.SMTP_USER && env.SMTP_PASSWORD) {
    options.auth = {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD,
    };
  }

  return nodemailer.createTransport(options);
}

/**
 * Send an email with optional attachments
 * If userId is provided, attempts to send using user's personal email configuration
 * Falls back to company email if user email is not configured
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    // If userId is provided, try to send using user's email
    if (params.userId) {
      const userConfig = await getUserSmtpConfig(params.userId);
      if (userConfig) {
        console.log(`Sending email via user ${params.userId}'s personal account`);
        await sendEmailAsUser(params.userId, {
          to: params.to,
          subject: params.subject,
          html: params.html,
          attachments: params.attachments,
        });
        return;
      }
      console.log(`User ${params.userId} has no email configured, falling back to company email`);
    }

    // Fall back to company email
    const companyDetails = await getCompanyDetails();
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: companyDetails.companyName,
        address: env.SMTP_USER,
      },
      to: Array.isArray(params.to) ? params.to.join(", ") : params.to,
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || "application/pdf",
      })),
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent successfully to: ${params.to}`);
  } catch (error) {
    console.error("Failed to send email:", error);
    throw error;
  }
}

/**
 * Send weekly progress report email to stakeholders
 */
export async function sendWeeklyProgressReportEmail(params: {
  recipients: string[];
  projectName: string;
  milestoneName: string;
  weekStartDate: Date;
  weekEndDate: Date;
  progressPercentage: number;
  pdfBuffer: Buffer;
  weekNumber: number;
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  
  const formattedStartDate = params.weekStartDate.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  
  const formattedEndDate = params.weekEndDate.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `Weekly Progress Report - ${params.projectName} - Week ${params.weekNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background-color: ${env.BRAND_PRIMARY_COLOR};
          color: white;
          padding: 20px;
          text-align: center;
          border-radius: 5px 5px 0 0;
        }
        .content {
          background-color: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .info-box {
          background-color: white;
          padding: 15px;
          margin: 15px 0;
          border-left: 4px solid ${env.BRAND_ACCENT_COLOR};
          border-radius: 4px;
        }
        .info-row {
          margin: 10px 0;
        }
        .label {
          font-weight: bold;
          color: #666;
        }
        .value {
          color: #1a1a1a;
        }
        .progress-bar {
          background-color: #e5e7eb;
          border-radius: 10px;
          height: 20px;
          margin: 10px 0;
          overflow: hidden;
        }
        .progress-fill {
          background-color: ${env.BRAND_SUCCESS_COLOR};
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
          font-size: 12px;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .button {
          display: inline-block;
          padding: 12px 24px;
          background-color: ${env.BRAND_PRIMARY_COLOR};
          color: white;
          text-decoration: none;
          border-radius: 5px;
          margin: 20px 0;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>Weekly Progress Report</h1>
          <p>Week ${params.weekNumber}</p>
        </div>
        
        <div class="content">
          <p>Dear Stakeholder,</p>
          
          <p>Please find attached the weekly progress report for the following project:</p>
          
          <div class="info-box">
            <div class="info-row">
              <span class="label">Project:</span>
              <span class="value">${params.projectName}</span>
            </div>
            <div class="info-row">
              <span class="label">Milestone:</span>
              <span class="value">${params.milestoneName}</span>
            </div>
            <div class="info-row">
              <span class="label">Report Period:</span>
              <span class="value">${formattedStartDate} - ${formattedEndDate}</span>
            </div>
          </div>
          
          <div class="info-box">
            <div class="info-row">
              <span class="label">Progress:</span>
            </div>
            <div class="progress-bar">
              <div class="progress-fill" style="width: ${params.progressPercentage}%">
                ${params.progressPercentage}%
              </div>
            </div>
          </div>
          
          <p>The attached PDF contains detailed information including:</p>
          <ul>
            <li>Expenditure summary</li>
            <li>Work completed this week</li>
            <li>Challenges and successes</li>
            <li>Itemized expenses</li>
            <li>Progress photos</li>
            <li>Next week's plan</li>
          </ul>
          
          <p>If you have any questions or concerns about this report, please don't hesitate to contact us.</p>
        </div>
        
        <div class="footer">
          <p><strong>${companyDetails.companyName}</strong></p>
          <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
          <p>VAT: ${companyDetails.companyVatNumber}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.recipients,
    subject,
    html,
    attachments: [
      {
        filename: `Weekly_Progress_Report_Week_${params.weekNumber}.pdf`,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });
}

/**
 * Send lead follow-up reminder email to sales person
 */
export async function sendFollowUpReminderEmail(params: {
  recipientEmail: string;
  recipientName: string;
  leadId: number;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  serviceType: string;
  description: string;
  estimatedValue?: number;
  address?: string;
  nextFollowUpDate: Date;
  daysOverdue: number;
  leadStatus: string;
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  
  const urgencyClass = params.daysOverdue > 3 ? 'urgent' : params.daysOverdue > 0 ? 'warning' : 'info';
  const urgencyColor = params.daysOverdue > 3 ? '#dc2626' : params.daysOverdue > 0 ? '#f59e0b' : '#3b82f6';
  const urgencyText = params.daysOverdue > 0 
    ? `OVERDUE by ${params.daysOverdue} day${params.daysOverdue > 1 ? 's' : ''}` 
    : 'Due Today';

  const subject = params.daysOverdue > 0 
    ? `🚨 OVERDUE: Follow-up Reminder - ${params.customerName}`
    : `📞 Follow-up Reminder - ${params.customerName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, ${urgencyColor} 0%, ${urgencyColor}dd 100%);
          color: white;
          padding: 30px 20px;
          text-align: center;
          border-radius: 8px 8px 0 0;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .urgency-badge {
          display: inline-block;
          background-color: rgba(255, 255, 255, 0.2);
          padding: 8px 16px;
          border-radius: 20px;
          margin-top: 10px;
          font-weight: bold;
          font-size: 14px;
        }
        .content {
          background-color: #f9fafb;
          padding: 30px;
          border: 1px solid #e5e7eb;
          border-top: none;
        }
        .greeting {
          font-size: 16px;
          margin-bottom: 20px;
        }
        .info-box {
          background-color: white;
          padding: 20px;
          margin: 20px 0;
          border-left: 4px solid ${urgencyColor};
          border-radius: 4px;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .info-row {
          margin: 12px 0;
          display: flex;
          align-items: start;
        }
        .label {
          font-weight: bold;
          color: #666;
          min-width: 140px;
          flex-shrink: 0;
        }
        .value {
          color: #1a1a1a;
          flex: 1;
        }
        .action-section {
          background-color: #eff6ff;
          border: 2px solid #3b82f6;
          padding: 20px;
          margin: 20px 0;
          border-radius: 8px;
        }
        .action-section h3 {
          margin-top: 0;
          color: #1e40af;
        }
        .action-list {
          margin: 10px 0;
          padding-left: 20px;
        }
        .action-list li {
          margin: 8px 0;
          color: #1e40af;
        }
        .button {
          display: inline-block;
          padding: 14px 28px;
          background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
          color: white;
          text-decoration: none;
          border-radius: 6px;
          margin: 20px 0;
          font-weight: bold;
          text-align: center;
        }
        .footer {
          text-align: center;
          padding: 20px;
          color: #666;
          font-size: 12px;
          border-top: 1px solid #e5e7eb;
        }
        .status-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          background-color: #dbeafe;
          color: #1e40af;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>🔔 Lead Follow-Up Reminder</h1>
          <div class="urgency-badge">${urgencyText}</div>
        </div>
        
        <div class="content">
          <p class="greeting">Hi ${params.recipientName},</p>
          
          <p>This is a reminder to follow up with the lead below. ${
            params.daysOverdue > 0 
              ? `<strong style="color: ${urgencyColor};">This follow-up is ${params.daysOverdue} day${params.daysOverdue > 1 ? 's' : ''} overdue.</strong>` 
              : 'The follow-up is due today.'
          }</p>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #1a1a1a;">Lead Details</h3>
            <div class="info-row">
              <span class="label">Customer Name:</span>
              <span class="value"><strong>${params.customerName}</strong></span>
            </div>
            <div class="info-row">
              <span class="label">Email:</span>
              <span class="value"><a href="mailto:${params.customerEmail}">${params.customerEmail}</a></span>
            </div>
            <div class="info-row">
              <span class="label">Phone:</span>
              <span class="value"><a href="tel:${params.customerPhone}">${params.customerPhone}</a></span>
            </div>
            ${params.address ? `
            <div class="info-row">
              <span class="label">Address:</span>
              <span class="value">${params.address}</span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">Service Type:</span>
              <span class="value">${params.serviceType}</span>
            </div>
            ${params.estimatedValue ? `
            <div class="info-row">
              <span class="label">Estimated Value:</span>
              <span class="value"><strong>R${params.estimatedValue.toLocaleString()}</strong></span>
            </div>
            ` : ''}
            <div class="info-row">
              <span class="label">Current Status:</span>
              <span class="value"><span class="status-badge">${params.leadStatus}</span></span>
            </div>
            <div class="info-row">
              <span class="label">Scheduled Follow-up:</span>
              <span class="value">${params.nextFollowUpDate.toLocaleDateString('en-ZA', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</span>
            </div>
          </div>
          
          <div class="info-box">
            <h3 style="margin-top: 0; color: #1a1a1a;">Description</h3>
            <p style="margin: 0;">${params.description}</p>
          </div>
          
          <div class="action-section">
            <h3>Recommended Next Steps:</h3>
            <ul class="action-list">
              <li>Contact the customer via phone or email</li>
              <li>Update the lead status in the CRM</li>
              <li>Schedule the next follow-up date</li>
              <li>Document any notes or outcomes from the conversation</li>
              ${params.leadStatus === 'CONTACTED' ? '<li>Consider moving to QUALIFIED status if appropriate</li>' : ''}
              ${params.leadStatus === 'QUALIFIED' ? '<li>Prepare and send a proposal</li>' : ''}
            </ul>
          </div>
          
          <div style="text-align: center;">
            <a href="${env.BASE_URL}/admin/crm" class="button">
              Open CRM Dashboard
            </a>
          </div>
          
          <p style="margin-top: 20px; font-size: 14px; color: #666;">
            <strong>Pro Tip:</strong> Following up promptly increases your chances of converting this lead. 
            Research shows that leads contacted within 24 hours are 7x more likely to convert!
          </p>
        </div>
        
        <div class="footer">
          <p><strong>${companyDetails.companyName}</strong></p>
          <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
          <p style="margin-top: 10px; font-size: 11px; color: #999;">
            This is an automated reminder from your CRM system.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.recipientEmail,
    subject,
    html,
  });
}

/**
 * Send completion report email to customer with PDF attachment and portal link
 */
export async function sendCompletionReportEmail(params: {
  customerEmail: string;
  customerName: string;
  completionType: "ORDER" | "MILESTONE" | "PROJECT";
  completionTitle: string; // e.g., order number, milestone name, project name
  completionDate: Date;
  pdfBuffer: Buffer;
  pdfFilename: string;
  additionalDetails?: string; // Optional additional context
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;
  
  const formattedDate = params.completionDate.toLocaleDateString("en-ZA", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const typeLabel = params.completionType === "ORDER" 
    ? "Job" 
    : params.completionType === "MILESTONE"
    ? "Milestone"
    : "Project";

  const subject = `${typeLabel} Completed - ${params.completionTitle}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          margin: 0;
          padding: 0;
        }
        .container {
          max-width: 600px;
          margin: 0 auto;
          padding: 0;
        }
        .header {
          background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
          color: white;
          padding: 40px 30px;
          text-align: center;
          border-radius: 0;
        }
        .header h1 {
          margin: 0 0 10px 0;
          font-size: 28px;
          font-weight: bold;
        }
        .header p {
          margin: 0;
          font-size: 16px;
          opacity: 0.95;
        }
        .content {
          background-color: #ffffff;
          padding: 40px 30px;
        }
        .greeting {
          font-size: 18px;
          margin-bottom: 20px;
          color: #1a1a1a;
        }
        .completion-badge {
          background-color: ${env.BRAND_SUCCESS_COLOR};
          color: white;
          padding: 15px 25px;
          border-radius: 8px;
          text-align: center;
          margin: 25px 0;
          font-size: 18px;
          font-weight: bold;
        }
        .info-box {
          background-color: #f9fafb;
          padding: 25px;
          margin: 25px 0;
          border-left: 4px solid ${env.BRAND_ACCENT_COLOR};
          border-radius: 4px;
        }
        .info-row {
          margin: 12px 0;
          display: flex;
          align-items: start;
        }
        .label {
          font-weight: bold;
          color: #666;
          min-width: 140px;
          flex-shrink: 0;
        }
        .value {
          color: #1a1a1a;
          flex: 1;
        }
        .section {
          margin: 30px 0;
        }
        .section h2 {
          color: ${env.BRAND_PRIMARY_COLOR};
          font-size: 20px;
          margin: 0 0 15px 0;
          padding-bottom: 10px;
          border-bottom: 2px solid ${env.BRAND_ACCENT_COLOR};
        }
        .button {
          display: inline-block;
          padding: 16px 32px;
          background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
          color: white;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
          font-size: 16px;
          text-align: center;
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        }
        .button:hover {
          opacity: 0.9;
        }
        .portal-section {
          background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
          border: 2px solid ${env.BRAND_PRIMARY_COLOR};
          padding: 25px;
          margin: 30px 0;
          border-radius: 8px;
          text-align: center;
        }
        .portal-section h3 {
          margin: 0 0 10px 0;
          color: ${env.BRAND_PRIMARY_COLOR};
          font-size: 20px;
        }
        .portal-section p {
          margin: 10px 0 20px 0;
          color: #1e40af;
        }
        .attachment-notice {
          background-color: #fef3c7;
          border-left: 4px solid ${env.BRAND_WARNING_COLOR};
          padding: 15px 20px;
          margin: 20px 0;
          border-radius: 4px;
        }
        .attachment-notice strong {
          color: #92400e;
        }
        .footer {
          background-color: #f9fafb;
          text-align: center;
          padding: 30px 20px;
          color: #666;
          font-size: 13px;
          border-top: 3px solid ${env.BRAND_ACCENT_COLOR};
        }
        .footer p {
          margin: 8px 0;
        }
        .footer strong {
          color: #1a1a1a;
        }
        ul {
          margin: 10px 0;
          padding-left: 20px;
        }
        li {
          margin: 8px 0;
          color: #333;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>✓ ${typeLabel} Completed</h1>
          <p>Your work has been successfully completed</p>
        </div>
        
        <div class="content">
          <p class="greeting">Dear ${params.customerName},</p>
          
          <p>We are pleased to inform you that your ${typeLabel.toLowerCase()} has been successfully completed!</p>
          
          <div class="completion-badge">
            ✓ COMPLETED
          </div>
          
          <div class="info-box">
            <div class="info-row">
              <span class="label">${typeLabel}:</span>
              <span class="value"><strong>${params.completionTitle}</strong></span>
            </div>
            <div class="info-row">
              <span class="label">Completion Date:</span>
              <span class="value">${formattedDate}</span>
            </div>
            ${params.additionalDetails ? `
            <div class="info-row">
              <span class="label">Details:</span>
              <span class="value">${params.additionalDetails}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="section">
            <h2>📄 Completion Report</h2>
            <p>A comprehensive completion report has been attached to this email. The report includes:</p>
            <ul>
              <li>Detailed summary of work completed</li>
              <li>Progress documentation and photos</li>
              ${params.completionType === "ORDER" ? '<li>Before and after pictures</li>' : ''}
              ${params.completionType === "MILESTONE" ? '<li>Weekly progress updates</li>' : ''}
              ${params.completionType === "PROJECT" ? '<li>All milestone summaries</li>' : ''}
              <li>Timeline and performance metrics</li>
            </ul>
          </div>
          
          <div class="attachment-notice">
            <strong>📎 Attachment:</strong> Please find the detailed completion report attached to this email as a PDF document.
          </div>
          
          <div class="portal-section">
            <h3>🔐 Access Your Customer Portal</h3>
            <p>View all your ${params.completionType === "ORDER" ? "jobs" : params.completionType === "MILESTONE" ? "milestones" : "projects"}, documents, and more in your dedicated customer portal.</p>
            <a href="${portalLink}" class="button">
              Go to Customer Portal →
            </a>
            <p style="font-size: 12px; margin-top: 15px; color: #666;">
              Or copy this link: <a href="${portalLink}" style="color: ${env.BRAND_PRIMARY_COLOR};">${portalLink}</a>
            </p>
          </div>
          
          <div class="section">
            <h2>💬 Questions or Feedback?</h2>
            <p>If you have any questions about the completed work or would like to provide feedback, please don't hesitate to contact us:</p>
            <ul>
              <li>Email: <a href="mailto:${companyDetails.companyEmail}" style="color: ${env.BRAND_PRIMARY_COLOR};">${companyDetails.companyEmail}</a></li>
              <li>Phone: ${companyDetails.companyPhone}</li>
            </ul>
          </div>
          
          <p style="margin-top: 30px;">Thank you for choosing ${companyDetails.companyName}. We look forward to serving you again!</p>
          
          <p style="margin-top: 20px;">
            Best regards,<br>
            <strong>${companyDetails.companyName} Team</strong>
          </p>
        </div>
        
        <div class="footer">
          <p><strong>${companyDetails.companyName}</strong></p>
          <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
          <p>VAT Reg: ${companyDetails.companyVatNumber}</p>
          <p style="margin-top: 15px; font-size: 11px; color: #999;">
            This is an automated notification from our project management system.
          </p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.customerEmail,
    subject,
    html,
    attachments: [
      {
        filename: params.pdfFilename,
        content: params.pdfBuffer,
        contentType: "application/pdf",
      },
    ],
  });

  console.log(`[sendCompletionReportEmail] Completion report email sent to ${params.customerEmail} for ${params.completionType}: ${params.completionTitle}`);
}

/**
 * Send RFQ notification email to contractors
 */
export async function sendRFQNotificationEmail(params: {
  contractorEmail: string;
  contractorName: string;
  propertyManagerName: string;
  propertyManagerEmail: string;
  rfqNumber: string;
  rfqTitle: string;
  rfqDescription: string;
  buildingAddress: string;
  urgency: string;
  estimatedBudget?: number | null;
  propertyManagerId?: number; // Optional: If provided, will attempt to send from PM's personal email
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/contractor/quotations`;

  const urgencyColors: Record<string, string> = {
    LOW: "#10b981",
    NORMAL: "#3b82f6",
    HIGH: "#f59e0b",
    URGENT: "#ef4444",
  };

  const urgencyColor = urgencyColors[params.urgency] || "#3b82f6";

  const subject = `New RFQ: ${params.rfqTitle} (${params.rfqNumber})`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .header h1 {
          margin: 0;
          font-size: 24px;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .info-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid ${urgencyColor};
        }
        .info-row {
          margin: 12px 0;
          display: flex;
          justify-content: space-between;
        }
        .label {
          font-weight: bold;
          color: #6b7280;
        }
        .value {
          color: #111827;
        }
        .urgency-badge {
          display: inline-block;
          padding: 4px 12px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: bold;
          color: white;
          background-color: ${urgencyColor};
        }
        .cta-button {
          display: inline-block;
          background: #0d9488;
          color: white;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🔔 New Request for Quotation</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">You've received a new RFQ from ${params.propertyManagerName}</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.contractorName}</strong>,</p>
        
        <p>You have received a new Request for Quotation (RFQ) from <strong>${params.propertyManagerName}</strong>.</p>
        
        <div class="info-box">
          <div class="info-row">
            <span class="label">RFQ Number:</span>
            <span class="value">${params.rfqNumber}</span>
          </div>
          <div class="info-row">
            <span class="label">Title:</span>
            <span class="value">${params.rfqTitle}</span>
          </div>
          <div class="info-row">
            <span class="label">Property Address:</span>
            <span class="value">${params.buildingAddress}</span>
          </div>
          <div class="info-row">
            <span class="label">Urgency:</span>
            <span class="urgency-badge">${params.urgency}</span>
          </div>
          ${params.estimatedBudget ? `
          <div class="info-row">
            <span class="label">Estimated Budget:</span>
            <span class="value">R${params.estimatedBudget.toLocaleString()}</span>
          </div>
          ` : ''}
        </div>
        
        <div class="info-box" style="border-left-color: #0d9488;">
          <p style="margin: 0 0 10px 0;"><strong>Description:</strong></p>
          <p style="margin: 0; color: #4b5563;">${params.rfqDescription}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalLink}" class="cta-button">
            View RFQ in Portal & Submit Quotation →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Next Steps:</strong><br>
          1. Login to your contractor portal<br>
          2. Review the complete RFQ details including attachments<br>
          3. Submit your quotation with pricing and timeline<br>
          4. The property manager will review and respond
        </p>
        
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #92400e; font-size: 14px;">
            <strong>⚡ Action Required:</strong> Please review and respond to this RFQ as soon as possible.
          </p>
        </div>
        
        <p style="margin-top: 20px; color: #6b7280; font-size: 13px;">
          <strong>Property Manager Contact:</strong><br>
          ${params.propertyManagerName}<br>
          📧 ${params.propertyManagerEmail}
        </p>
      </div>
      
      <div class="footer">
        <p><strong>${companyDetails.companyName}</strong></p>
        <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
        <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
      </div>
    </body>
    </html>
  `;

  // Send email from property manager's account if configured, otherwise use company email
  await sendEmail({
    to: params.contractorEmail,
    subject,
    html,
    userId: params.propertyManagerId,
  });

  console.log(`[sendRFQNotificationEmail] RFQ notification sent to ${params.contractorEmail} for ${params.rfqNumber}`);
}

/**
 * Send invoice notification email to customer
 */
export async function sendInvoiceNotificationEmail(params: {
  customerEmail: string;
  customerName: string;
  invoiceNumber: string;
  invoiceAmount: number;
  invoiceDueDate?: Date | null;
  orderNumber?: string;
  projectName?: string;
  userId?: number; // Optional: sender's user ID for personal email
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const dueDateText = params.invoiceDueDate
    ? `Due: ${params.invoiceDueDate.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}`
    : "Payment terms as agreed";

  const subject = `Invoice ${params.invoiceNumber} - R${params.invoiceAmount.toLocaleString()}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .info-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #0d9488;
        }
        .amount-box {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 20px;
          border-radius: 8px;
          text-align: center;
          margin: 20px 0;
        }
        .cta-button {
          display: inline-block;
          background: #0d9488;
          color: white;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📄 New Invoice</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Invoice for your recent service</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        
        <p>Thank you for choosing ${companyDetails.companyName}. Please find the details of your invoice below:</p>
        
        <div class="amount-box">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Total Amount</p>
          <h2 style="margin: 10px 0 0 0; font-size: 36px;">R${params.invoiceAmount.toLocaleString()}</h2>
        </div>
        
        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Invoice Number:</strong> ${params.invoiceNumber}</p>
          ${params.orderNumber ? `<p style="margin: 5px 0;"><strong>Order Number:</strong> ${params.orderNumber}</p>` : ''}
          ${params.projectName ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${params.projectName}</p>` : ''}
          <p style="margin: 5px 0;"><strong>${dueDateText}</strong></p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalLink}" class="cta-button">
            View Invoice in Customer Portal →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          You can view the complete invoice details, download a PDF copy, and make payment arrangements through your customer portal.
        </p>
        
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            <strong>Payment Information:</strong> Payment details and methods are available in the invoice. Please contact us if you have any questions.
          </p>
        </div>
      </div>
      
      <div class="footer">
        <p><strong>${companyDetails.companyName}</strong></p>
        <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
        <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
        <p>VAT: ${companyDetails.companyVatNumber}</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.customerEmail,
    subject,
    html,
    userId: params.userId,
  });

  console.log(`[sendInvoiceNotificationEmail] Invoice notification sent to ${params.customerEmail} for ${params.invoiceNumber}`);
}

/**
 * Send order notification email to customer
 */
export async function sendOrderNotificationEmail(params: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDescription: string;
  assignedToName?: string;
  userId?: number; // Optional: sender's user ID for personal email
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const subject = `Order Confirmation: ${params.orderNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .info-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #0d9488;
        }
        .cta-button {
          display: inline-block;
          background: #0d9488;
          color: white;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>✅ Order Confirmed</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your order has been received and is being processed</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        
        <p>Thank you for your order! We have received your request and our team is now working on it.</p>
        
        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Order Number:</strong> ${params.orderNumber}</p>
          <p style="margin: 5px 0;"><strong>Description:</strong> ${params.orderDescription}</p>
          ${params.assignedToName ? `<p style="margin: 5px 0;"><strong>Assigned To:</strong> ${params.assignedToName}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalLink}" class="cta-button">
            Track Order Progress →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          You can track the progress of your order, view updates, and communicate with our team through your customer portal.
        </p>
      </div>
      
      <div class="footer">
        <p><strong>${companyDetails.companyName}</strong></p>
        <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
        <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.customerEmail,
    subject,
    html,
    userId: params.userId,
  });

  console.log(`[sendOrderNotificationEmail] Order notification sent to ${params.customerEmail} for ${params.orderNumber}`);
}

/**
 * Send statement notification email to customer
 */
export async function sendStatementNotificationEmail(params: {
  customerEmail: string;
  customerName: string;
  statementNumber: string;
  statementPeriod: string;
  totalAmount: number;
  userId?: number; // Optional: sender's user ID for personal email
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const subject = `Account Statement: ${params.statementNumber}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          font-family: Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 600px;
          margin: 0 auto;
          padding: 20px;
        }
        .header {
          background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%);
          color: white;
          padding: 30px;
          border-radius: 10px 10px 0 0;
          text-align: center;
        }
        .content {
          background: #f9fafb;
          padding: 30px;
          border-radius: 0 0 10px 10px;
        }
        .info-box {
          background: white;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border-left: 4px solid #0d9488;
        }
        .cta-button {
          display: inline-block;
          background: #0d9488;
          color: white;
          padding: 14px 28px;
          text-decoration: none;
          border-radius: 8px;
          margin: 20px 0;
          font-weight: bold;
        }
        .footer {
          text-align: center;
          margin-top: 30px;
          padding-top: 20px;
          border-top: 1px solid #e5e7eb;
          color: #6b7280;
          font-size: 12px;
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📊 Account Statement</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">Your account summary for ${params.statementPeriod}</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        
        <p>Your account statement is now available for review.</p>
        
        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Statement Number:</strong> ${params.statementNumber}</p>
          <p style="margin: 5px 0;"><strong>Period:</strong> ${params.statementPeriod}</p>
          <p style="margin: 5px 0;"><strong>Total Amount:</strong> R${params.totalAmount.toLocaleString()}</p>
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalLink}" class="cta-button">
            View Statement →
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          You can view the complete statement details, including all transactions and balances, through your customer portal.
        </p>
      </div>
      
      <div class="footer">
        <p><strong>${companyDetails.companyName}</strong></p>
        <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
        <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
        <p>VAT: ${companyDetails.companyVatNumber}</p>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.customerEmail,
    subject,
    html,
    userId: params.userId,
  });

  console.log(`[sendStatementNotificationEmail] Statement notification sent to ${params.customerEmail} for ${params.statementNumber}`);
}
