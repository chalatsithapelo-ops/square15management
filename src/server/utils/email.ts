import nodemailer from "nodemailer";
import { Resend } from "resend";
import { env } from "~/server/env";
import { db } from "~/server/db";
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
 * Get Resend config from DB (SystemSettings) or env vars
 * DB takes priority over env vars so admin can configure via UI
 */
async function getResendConfig(): Promise<{ apiKey: string; fromEmail: string } | null> {
  try {
    const rows = await db.systemSettings.findMany({
      where: { key: { in: ["resend_api_key", "resend_from_email"] } },
    });
    const map: Record<string, string> = {};
    for (const r of rows) if (r.value) map[r.key] = r.value;

    if (map.resend_api_key) {
      return {
        apiKey: map.resend_api_key,
        fromEmail: map.resend_from_email || env.SMTP_USER,
      };
    }
  } catch (e) {
    console.error("Failed to read Resend config from DB:", e);
  }

  // Fallback to env vars
  if (env.RESEND_API_KEY) {
    return {
      apiKey: env.RESEND_API_KEY,
      fromEmail: env.RESEND_FROM_EMAIL || env.SMTP_USER,
    };
  }

  return null;
}

/**
 * Generate a reusable HTML block showing customer login credentials.
 * Returns empty string if no credentials are provided.
 */
function getLoginCredentialsHtml(credentials?: { email: string; password: string }, portalLink?: string): string {
  if (!credentials) return '';
  return `
    <div style="background: #ecfdf5; border: 2px solid #10b981; padding: 20px; border-radius: 8px; margin: 20px 0;">
      <h3 style="margin: 0 0 12px 0; color: #065f46; font-size: 16px;">🔑 Your Customer Portal Login Details</h3>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 6px 0; color: #065f46; font-weight: bold; width: 100px;">Email:</td>
          <td style="padding: 6px 0; color: #1a1a1a;">${credentials.email}</td>
        </tr>
        <tr>
          <td style="padding: 6px 0; color: #065f46; font-weight: bold;">Password:</td>
          <td style="padding: 6px 0; color: #1a1a1a;">${credentials.password}</td>
        </tr>
        ${portalLink ? `<tr>
          <td style="padding: 6px 0; color: #065f46; font-weight: bold;">Portal:</td>
          <td style="padding: 6px 0;"><a href="${portalLink}" style="color: #0d9488;">${portalLink}</a></td>
        </tr>` : ''}
      </table>
      <p style="margin: 12px 0 0 0; font-size: 12px; color: #065f46;">Please save these details. You can change your password after logging in.</p>
    </div>
  `;
}

/**
 * Send email via Resend HTTP API (bypasses SMTP port blocks)
 */
async function sendViaResend(apiKey: string, params: {
  from: string;
  to: string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}): Promise<void> {
  const resend = new Resend(apiKey);

  const result = await resend.emails.send({
    from: params.from,
    to: params.to,
    subject: params.subject,
    html: params.html,
    attachments: params.attachments?.map((att) => ({
      filename: att.filename,
      content: att.content,
      contentType: att.contentType || "application/pdf",
    })),
  });

  if (result.error) {
    throw new Error(`Resend error: ${result.error.message}`);
  }

  console.log(`Email sent via Resend to: ${params.to.join(", ")} (id: ${result.data?.id})`);
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
 * Priority: 1) User's personal SMTP 2) Resend HTTP API 3) System SMTP
 * Resend is preferred over system SMTP because it bypasses port-blocking by hosting providers
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
      console.log(`User ${params.userId} has no email configured, falling back to system email`);
    }

    const companyDetails = await getCompanyDetails();
    const toArray = Array.isArray(params.to) ? params.to : [params.to];

    // Try Resend first (HTTP-based, bypasses SMTP port blocks)
    const resendConfig = await getResendConfig();
    if (resendConfig) {
      const fromAddress = `${companyDetails.companyName} <${resendConfig.fromEmail}>`;
      try {
        await sendViaResend(resendConfig.apiKey, {
          from: fromAddress,
          to: toArray,
          subject: params.subject,
          html: params.html,
          attachments: params.attachments,
        });
        return;
      } catch (resendError) {
        console.error("Resend failed, falling back to SMTP:", resendError);
      }
    }

    // Fall back to SMTP
    const transporter = createTransporter();

    const mailOptions = {
      from: {
        name: companyDetails.companyName,
        address: env.SMTP_USER,
      },
      to: toArray.join(", "),
      subject: params.subject,
      html: params.html,
      attachments: params.attachments?.map((att) => ({
        filename: att.filename,
        content: att.content,
        contentType: att.contentType || "application/pdf",
      })),
    };

    await transporter.sendMail(mailOptions);
    console.log(`Email sent via SMTP to: ${params.to}`);
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
  loginCredentials?: { email: string; password: string };
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
          
          ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

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
  quoteSubmissionLink?: string; // Optional: email-only contractors can submit without portal login
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/contractor/quotations`;
  const registrationLink = `${getBaseUrl()}/register`;
  const primaryLink = params.quoteSubmissionLink || portalLink;

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
          <a href="${primaryLink}" class="cta-button">
            ${params.quoteSubmissionLink ? "Submit Your Quotation →" : "View RFQ in Portal & Submit Quotation →"}
          </a>
        </div>
        
        <p style="color: #6b7280; font-size: 14px;">
          <strong>Next Steps:</strong><br>
          1. Review the RFQ details<br>
          2. Submit your quotation (price + notes + optional attachment)<br>
          3. The property manager will review and respond
        </p>

        <div style="background: #eef2ff; border-left: 4px solid #6366f1; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #3730a3; font-size: 14px;">
            <strong>Want faster approvals?</strong> Create a free account to manage RFQs, upload documents, track statuses, and receive notifications.<br>
            <a href="${registrationLink}" style="color: #3730a3; font-weight: bold;">Register here →</a>
          </p>
        </div>
        
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
  loginCredentials?: { email: string; password: string };
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
        
        ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

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
 * Send quotation notification email to customer when quotation is sent to them.
 */
export async function sendQuotationNotificationEmail(params: {
  customerEmail: string;
  customerName: string;
  quoteNumber: string;
  quotationAmount: number;
  validUntil?: Date | null;
  projectName?: string;
  serviceType?: string;
  address?: string;
  userId?: number;
  loginCredentials?: { email: string; password: string };
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const validUntilText = params.validUntil
    ? `Valid Until: ${params.validUntil.toLocaleDateString("en-ZA", { year: "numeric", month: "long", day: "numeric" })}`
    : "";

  // Build enriched subject with service type and location
  const _addr = params.address;
  const _loc = _addr
    ? _addr.split(/\s*[,\n\r]|\s+C\/O\s|\s+Cor\.?\s|\s+Corner\s|\s+Street|\s+Str\b|\s+Road|\s+Rd\b|\s+Ave\b/i)[0]
        .replace(/\s*\(Pty\)\s*Ltd\.?/i, '').trim()
    : undefined;
  const _shortLoc = _loc && _loc.length > 40 ? _loc.slice(0, 37) + '...' : _loc;
  const jobParts = [params.serviceType, _shortLoc].filter(Boolean).join(' at ');
  const subject = jobParts
    ? `Quotation ${params.quoteNumber} \u2013 ${jobParts} \u2013 R${params.quotationAmount.toLocaleString()}`
    : `Quotation ${params.quoteNumber} - R${params.quotationAmount.toLocaleString()}`;

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
        <h1>📋 New Quotation</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">A quotation has been prepared for you</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        
        <p>Thank you for your enquiry. Please find the details of your quotation below:</p>
        
        <div class="amount-box">
          <p style="margin: 0; font-size: 14px; opacity: 0.9;">Quoted Amount</p>
          <h2 style="margin: 10px 0 0 0; font-size: 36px;">R${params.quotationAmount.toLocaleString()}</h2>
        </div>
        
        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Quotation Number:</strong> ${params.quoteNumber}</p>
          ${params.projectName ? `<p style="margin: 5px 0;"><strong>Project:</strong> ${params.projectName}</p>` : ''}
          ${params.serviceType ? `<p style="margin: 5px 0;"><strong>Service Type:</strong> ${params.serviceType}</p>` : ''}
          ${params.address ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${params.address}</p>` : ''}
          ${validUntilText ? `<p style="margin: 5px 0;"><strong>${validUntilText}</strong></p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${portalLink}" class="cta-button">
            View Quotation in Customer Portal →
          </a>
        </div>
        
        ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

        <p style="color: #6b7280; font-size: 14px;">
          You can view the complete quotation details and accept/decline through your customer portal.
        </p>
        
        <div style="background: #dbeafe; border-left: 4px solid #3b82f6; padding: 15px; border-radius: 4px; margin: 20px 0;">
          <p style="margin: 0; color: #1e40af; font-size: 14px;">
            <strong>Questions?</strong> If you have any questions about this quotation, please don't hesitate to contact us.
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

  console.log(`[sendQuotationNotificationEmail] Quotation notification sent to ${params.customerEmail} for ${params.quoteNumber}`);
}

/**
 * Send order notification email to customer
 */
export async function sendOrderNotificationEmail(params: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  orderDescription: string;
  serviceType?: string;
  address?: string;
  assignedToName?: string;
  userId?: number; // Optional: sender's user ID for personal email
  recipientType?: "CUSTOMER" | "CONTRACTOR";
  orderAcceptLink?: string;
  invoiceUploadLink?: string;
  attachments?: EmailAttachment[];
  loginCredentials?: { email: string; password: string };
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;
  const registrationLink = `${getBaseUrl()}/register`;

  const isContractor = (params.recipientType || "CUSTOMER") === "CONTRACTOR";

  // Informative subject with short building name only
  const loc = params.address
    ? params.address
        .split(/\s*[,\n\r]|\s+C\/O\s|\s+Cor\.?\s|\s+Corner\s|\s+Street|\s+Str\b|\s+Road|\s+Rd\b|\s+Ave\b/i)[0]
        .replace(/\s*\(Pty\)\s*Ltd\.?/i, "")
        .trim()
        .slice(0, 40)
    : "";
  const jobCtx = params.serviceType
    ? ` – ${params.serviceType}${loc ? ` at ${loc}` : ""}`
    : "";
  const subject = `Order Confirmation: ${params.orderNumber}${jobCtx}`;

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
        <h1>${isContractor ? "🧰 New Work Order" : "✅ Order Confirmed"}</h1>
        <p style="margin: 10px 0 0 0; opacity: 0.9;">${isContractor ? "You have received a new order" : "Your order has been received and is being processed"}</p>
      </div>
      
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        
        <p>${isContractor ? "A Property Manager has issued a new order to you. Please review and accept the order to confirm availability." : "Thank you for your order! We have received your request and our team is now working on it."}</p>
        
        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Order Number:</strong> ${params.orderNumber}</p>
          ${params.serviceType ? `<p style="margin: 5px 0;"><strong>Service Type:</strong> ${params.serviceType}</p>` : ''}
          ${params.address ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${params.address}</p>` : ''}
          <p style="margin: 5px 0;"><strong>Description:</strong> ${params.orderDescription}</p>
          ${params.assignedToName ? `<p style="margin: 5px 0;"><strong>Assigned To:</strong> ${params.assignedToName}</p>` : ''}
        </div>
        
        <div style="text-align: center; margin: 30px 0;">
          <a href="${isContractor && params.orderAcceptLink ? params.orderAcceptLink : portalLink}" class="cta-button">
            ${isContractor && params.orderAcceptLink ? "Accept Order →" : "Track Order Progress →"}
          </a>
        </div>

        ${isContractor && params.invoiceUploadLink ? `
          <div style="text-align: center; margin: 10px 0 25px 0;">
            <a href="${params.invoiceUploadLink}" class="cta-button" style="background: #2563eb;">
              Upload Invoice (after work) →
            </a>
          </div>
        ` : ""}
        
        <p style="color: #6b7280; font-size: 14px;">
          ${isContractor ? "You can accept the order and later upload your invoice using the links above." : "You can track the progress of your order, view updates, and communicate with our team through your customer portal."}
        </p>

        ${!isContractor ? getLoginCredentialsHtml(params.loginCredentials, portalLink) : ""}

        ${isContractor ? `
          <div style="background: #eef2ff; border-left: 4px solid #6366f1; padding: 15px; border-radius: 4px; margin: 20px 0;">
            <p style="margin: 0; color: #3730a3; font-size: 14px;">
              <strong>Get the full portal experience:</strong> track orders, upload documents, receive notifications, and manage invoices in one place.<br>
              <a href="${registrationLink}" style="color: #3730a3; font-weight: bold;">Register here →</a>
            </p>
          </div>
        ` : ""}
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
    attachments: params.attachments,
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
  loginCredentials?: { email: string; password: string };
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
        
        ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

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

/**
 * Send order status update email to customer
 */
export async function sendOrderStatusUpdateEmail(params: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  serviceType?: string;
  address?: string;
  newStatus: string;
  assignedToName?: string;
  userId?: number; // Optional: sender's user ID for personal email
  loginCredentials?: { email: string; password: string };
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const statusLabel = params.newStatus.replace(/_/g, " ");
  // Build informative subject with short building name only
  const loc = params.address
    ? params.address
        .split(/\s*[,\n\r]|\s+C\/O\s|\s+Cor\.?\s|\s+Corner\s|\s+Street|\s+Str\b|\s+Road|\s+Rd\b|\s+Ave\b/i)[0]
        .replace(/\s*\(Pty\)\s*Ltd\.?/i, "")
        .trim()
        .slice(0, 40)
    : "";
  const jobCtx = params.serviceType
    ? ` – ${params.serviceType}${loc ? ` at ${loc}` : ""}`
    : "";
  const subject = `Order Update: ${params.orderNumber}${jobCtx} – ${statusLabel}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 24px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 24px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 16px; border-radius: 8px; margin: 18px 0; border-left: 4px solid #0d9488; }
        .cta-button { display: inline-block; background: #0d9488; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; margin: 16px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>📣 Order Status Update</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Your order has been updated</p>
      </div>
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        <p>We have an update on your order.</p>

        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Order Number:</strong> ${params.orderNumber}</p>
          ${params.serviceType ? `<p style="margin: 5px 0;"><strong>Service Type:</strong> ${params.serviceType}</p>` : ""}
          ${params.address ? `<p style="margin: 5px 0;"><strong>Location:</strong> ${params.address}</p>` : ""}
          <p style="margin: 5px 0;"><strong>New Status:</strong> ${statusLabel}</p>
          ${params.assignedToName ? `<p style="margin: 5px 0;"><strong>Assigned To:</strong> ${params.assignedToName}</p>` : ""}
        </div>

        <div style="text-align: center;">
          <a href="${portalLink}" class="cta-button">View Order →</a>
        </div>

        ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

        <p style="color: #6b7280; font-size: 14px;">You can track progress and view updates in your customer portal.</p>
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

  console.log(`[sendOrderStatusUpdateEmail] Order status update sent to ${params.customerEmail} for ${params.orderNumber}`);
}

/**
 * Send maintenance request status update email to customer
 */
export async function sendMaintenanceRequestStatusEmail(params: {
  customerEmail: string;
  customerName: string;
  requestNumber: string;
  requestTitle: string;
  newStatus: string;
  responseNotes?: string;
  rejectionReason?: string;
  userId?: number; // Optional: sender's user ID for personal email
  loginCredentials?: { email: string; password: string };
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/customer/dashboard`;

  const statusLabel = params.newStatus.replace(/_/g, " ");
  const subject = `Maintenance Update: ${params.requestNumber} - ${statusLabel}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #0d9488 0%, #14b8a6 100%); color: white; padding: 24px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 24px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 16px; border-radius: 8px; margin: 18px 0; border-left: 4px solid #0d9488; }
        .cta-button { display: inline-block; background: #0d9488; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; margin: 16px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛠️ Maintenance Status Update</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Your request has been updated</p>
      </div>
      <div class="content">
        <p>Hello <strong>${params.customerName}</strong>,</p>
        <p>We have an update on your maintenance request.</p>

        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Request Number:</strong> ${params.requestNumber}</p>
          <p style="margin: 5px 0;"><strong>Title:</strong> ${params.requestTitle}</p>
          <p style="margin: 5px 0;"><strong>New Status:</strong> ${statusLabel}</p>
          ${params.responseNotes ? `<p style="margin: 10px 0 0 0;"><strong>Notes:</strong><br/>${params.responseNotes}</p>` : ""}
          ${params.rejectionReason ? `<p style="margin: 10px 0 0 0;"><strong>Rejection Reason:</strong><br/>${params.rejectionReason}</p>` : ""}
        </div>

        <div style="text-align: center;">
          <a href="${portalLink}" class="cta-button">View Request →</a>
        </div>

        ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}

        <p style="color: #6b7280; font-size: 14px;">You can view details and follow updates in your customer portal.</p>
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

  console.log(`[sendMaintenanceRequestStatusEmail] Maintenance update sent to ${params.customerEmail} for ${params.requestNumber}`);
}

/**
 * Send maintenance request email to a contractor (for contractors without portal access)
 */
export async function sendMaintenanceRequestToContractorEmail(params: {
  contractorEmail: string;
  contractorName: string;
  requestNumber: string;
  requestTitle: string;
  requestDescription: string;
  urgency: string;
  category: string;
  buildingName?: string | null;
  unitNumber?: string | null;
  address: string;
  photos?: string[];
  propertyManagerName?: string;
  propertyManagerEmail?: string;
  userId?: number; // Optional: sender's user ID for personal email
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${getBaseUrl()}/contractor/login`;

  const subject = `New Maintenance Request: ${params.requestNumber} - ${params.requestTitle}`;

  const photosHtml = (params.photos || []).length
    ? `
      <div class="info-box">
        <p style="margin: 0 0 10px 0;"><strong>Photos:</strong></p>
        <ul style="margin: 0; padding-left: 18px;">
          ${(params.photos || [])
            .map((url) => `<li style="margin: 6px 0;"><a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a></li>`)
            .join("")}
        </ul>
      </div>
    `
    : "";

  const pmContactHtml = params.propertyManagerEmail
    ? `<p style="margin: 0;"><strong>Property Manager Contact:</strong> ${params.propertyManagerName || ""} ${params.propertyManagerEmail}</p>`
    : "";

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: linear-gradient(135deg, #1d4ed8 0%, #3b82f6 100%); color: white; padding: 24px; border-radius: 10px 10px 0 0; text-align: center; }
        .content { background: #f9fafb; padding: 24px; border-radius: 0 0 10px 10px; }
        .info-box { background: white; padding: 16px; border-radius: 8px; margin: 18px 0; border-left: 4px solid #1d4ed8; }
        .cta-button { display: inline-block; background: #1d4ed8; color: white; padding: 12px 22px; text-decoration: none; border-radius: 8px; margin: 16px 0; font-weight: bold; }
        .footer { text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px; }
      </style>
    </head>
    <body>
      <div class="header">
        <h1>🛠️ New Maintenance Request</h1>
        <p style="margin: 8px 0 0 0; opacity: 0.9;">Request ${params.requestNumber}</p>
      </div>
      <div class="content">
        <p>Hello <strong>${params.contractorName}</strong>,</p>
        <p>You have received a new maintenance request.</p>

        <div class="info-box">
          <p style="margin: 5px 0;"><strong>Title:</strong> ${params.requestTitle}</p>
          <p style="margin: 5px 0;"><strong>Urgency:</strong> ${params.urgency}</p>
          <p style="margin: 5px 0;"><strong>Category:</strong> ${params.category}</p>
          ${params.buildingName ? `<p style="margin: 5px 0;"><strong>Building:</strong> ${params.buildingName}</p>` : ""}
          ${params.unitNumber ? `<p style="margin: 5px 0;"><strong>Unit:</strong> ${params.unitNumber}</p>` : ""}
          <p style="margin: 5px 0;"><strong>Address:</strong> ${params.address}</p>
        </div>

        <div class="info-box">
          <p style="margin: 0 0 10px 0;"><strong>Description</strong></p>
          <div style="white-space: pre-wrap;">${params.requestDescription}</div>
        </div>

        ${photosHtml}

        ${pmContactHtml}

        <div style="text-align: center;">
          <a href="${portalLink}" class="cta-button">Open Contractor Portal →</a>
        </div>

        <p style="color: #6b7280; font-size: 14px;">If you do not have portal access, you can reply to this email to coordinate with the Property Manager.</p>
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
    to: params.contractorEmail,
    subject,
    html,
    userId: params.userId,
  });

  console.log(`[sendMaintenanceRequestToContractorEmail] Sent to ${params.contractorEmail} for ${params.requestNumber}`);
}

/**
 * Send a review request email to a customer after job completion
 */
export async function sendReviewRequestEmail(params: {
  customerEmail: string;
  customerName: string;
  orderNumber: string;
  serviceType: string;
  completionDate: Date;
  loginCredentials?: { email: string; password: string };
}): Promise<void> {
  const companyDetails = await getCompanyDetails();
  const portalLink = `${env.BASE_URL}/login`;
  
  const formattedDate = params.completionDate.toLocaleDateString("en-ZA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  const subject = `How was our service? - ${companyDetails.companyName}`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR || "#1e40af"} 0%, ${env.BRAND_ACCENT_COLOR || "#3b82f6"} 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${companyDetails.companyName}</h1>
          <p style="margin: 5px 0 0; font-size: 14px; opacity: 0.9;">We'd Love Your Feedback</p>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          <p>Dear ${params.customerName},</p>
          
          <p>Thank you for choosing <strong>${companyDetails.companyName}</strong> for your <strong>${params.serviceType}</strong> needs. We hope the work on order <strong>${params.orderNumber}</strong>, completed on ${formattedDate}, met your expectations.</p>
          
          <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 25px 0; border-radius: 0 8px 8px 0;">
            <p style="margin: 0; font-weight: bold; color: #92400e;">⭐ Your Feedback Matters!</p>
            <p style="margin: 10px 0 0; color: #78350f;">Your review helps us improve our service and helps other customers make informed decisions. It only takes a moment!</p>
          </div>
          
          <div style="text-align: center; margin: 30px 0;">
            <a href="${portalLink}" style="display: inline-block; background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR || "#1e40af"} 0%, ${env.BRAND_ACCENT_COLOR || "#3b82f6"} 100%); color: white; padding: 14px 35px; text-decoration: none; border-radius: 8px; font-weight: bold; font-size: 16px;">
              Leave Your Review
            </a>
          </div>
          
          <p style="color: #6b7280; font-size: 14px; text-align: center;">Log in to your Customer Portal to rate your experience</p>
          
          ${getLoginCredentialsHtml(params.loginCredentials, portalLink)}
          
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin: 25px 0;">
            <h3 style="margin-top: 0; color: #166534;">What to Rate:</h3>
            <ul style="margin: 0; padding-left: 20px; color: #15803d;">
              <li><strong>Service Quality</strong> - Was the work done properly?</li>
              <li><strong>Professionalism</strong> - Was our team courteous and professional?</li>
              <li><strong>Timeliness</strong> - Was the job completed on time?</li>
              <li><strong>Overall Experience</strong> - How was your overall experience?</li>
            </ul>
          </div>
          
          <p>If you have any questions or concerns about the completed work, please don't hesitate to contact us directly.</p>
          
          <p>Thank you for your time and support!</p>
          
          <p>Warm regards,<br><strong>${companyDetails.companyName} Team</strong></p>
        </div>
        
        <div style="background: #f9fafb; text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p><strong>${companyDetails.companyName}</strong></p>
          <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
        </div>
      </div>
    </body>
    </html>
  `;

  await sendEmail({
    to: params.customerEmail,
    subject,
    html,
  });

  console.log(`[sendReviewRequestEmail] Sent to ${params.customerEmail} for order ${params.orderNumber}`);
}

/**
 * Send a lead nurture / follow-up email to a cold or inactive lead
 */
export async function sendLeadNurtureEmail(params: {
  recipientEmail: string;
  recipientName: string;
  serviceType: string;
  leadId: number;
  nurtureType: "WELCOME" | "FOLLOW_UP" | "RE_ENGAGEMENT";
}): Promise<void> {
  const companyDetails = await getCompanyDetails();

  let subject: string;
  let bodyCopy: string;

  switch (params.nurtureType) {
    case "WELCOME":
      subject = `Welcome to ${companyDetails.companyName} - We're Here to Help!`;
      bodyCopy = `
        <p>Dear ${params.recipientName},</p>
        <p>Thank you for expressing interest in our <strong>${params.serviceType}</strong> services. We're excited to have the opportunity to assist you!</p>
        <p>At <strong>${companyDetails.companyName}</strong>, we pride ourselves on delivering quality work with professionalism and efficiency. Whether it's a quick repair or a major project, we've got you covered.</p>
        <h3 style="color: ${env.BRAND_PRIMARY_COLOR || "#1e40af"};">What Happens Next?</h3>
        <ol>
          <li>A member of our team will review your requirements</li>
          <li>We'll reach out to discuss the scope and provide a free quotation</li>
          <li>Once approved, we'll schedule the work at your convenience</li>
        </ol>
        <p>If you have any questions in the meantime, feel free to get in touch!</p>
      `;
      break;

    case "FOLLOW_UP":
      subject = `Checking In - ${companyDetails.companyName}`;
      bodyCopy = `
        <p>Dear ${params.recipientName},</p>
        <p>We recently discussed your <strong>${params.serviceType}</strong> requirements and wanted to follow up to see if you had any questions or if you're ready to proceed.</p>
        <p>We understand that making decisions about property maintenance and improvements takes time. We're here whenever you're ready!</p>
        <div style="background: #eff6ff; border-radius: 8px; padding: 20px; margin: 20px 0;">
          <h3 style="margin-top: 0; color: ${env.BRAND_PRIMARY_COLOR || "#1e40af"};">Why Choose ${companyDetails.companyName}?</h3>
          <ul>
            <li>✅ Professional, experienced team</li>
            <li>✅ Competitive pricing with transparent quotations</li>
            <li>✅ Quality workmanship guaranteed</li>
            <li>✅ Timely project completion</li>
          </ul>
        </div>
        <p>Would you like us to prepare a detailed quotation for your project? Simply reply to this email or give us a call!</p>
      `;
      break;

    case "RE_ENGAGEMENT":
      subject = `We Miss You! - ${companyDetails.companyName}`;
      bodyCopy = `
        <p>Dear ${params.recipientName},</p>
        <p>It's been a while since we last chatted about your <strong>${params.serviceType}</strong> needs, and we wanted to reach out to let you know we're still here for you.</p>
        <p>If your requirements have changed or you've found a solution, we completely understand. However, if you still need assistance, we'd love to help!</p>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px 20px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0; font-weight: bold; color: #92400e;">🎯 Special Offer for Returning Clients</p>
          <p style="margin: 10px 0 0; color: #78350f;">Contact us this week and receive a priority consultation with a complimentary assessment of your requirements.</p>
        </div>
        <p>We value your interest and look forward to the opportunity to serve you.</p>
      `;
      break;
  }

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; margin: 0; padding: 0;">
      <div style="max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR || "#1e40af"} 0%, ${env.BRAND_ACCENT_COLOR || "#3b82f6"} 100%); color: white; padding: 30px 20px; text-align: center;">
          <h1 style="margin: 0; font-size: 24px;">${companyDetails.companyName}</h1>
        </div>
        
        <div style="background: #fff; padding: 30px; border: 1px solid #e5e7eb; border-top: none;">
          ${bodyCopy}
          
          <p>Best regards,<br><strong>${companyDetails.companyName} Team</strong></p>
          <p style="font-size: 13px; color: #6b7280;">
            Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}
          </p>
        </div>
        
        <div style="background: #f9fafb; text-align: center; padding: 20px; color: #666; font-size: 12px;">
          <p><strong>${companyDetails.companyName}</strong></p>
          <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
          <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
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

  console.log(`[sendLeadNurtureEmail] Sent ${params.nurtureType} email to ${params.recipientEmail} for lead #${params.leadId}`);
}
