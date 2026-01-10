import nodemailer from "nodemailer";
import { db } from "~/server/db";
import { getCompanyDetails } from "~/server/utils/company-details";

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
}

interface UserSmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  password: string;
}

/**
 * Get a user's SMTP configuration from the database
 */
export async function getUserSmtpConfig(userId: number): Promise<UserSmtpConfig | null> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      userEmailSmtpHost: true,
      userEmailSmtpPort: true,
      userEmailSmtpSecure: true,
      userEmailSmtpUser: true,
      userEmailSmtpPassword: true,
    },
  });

  if (
    !user ||
    !user.userEmailSmtpHost ||
    !user.userEmailSmtpPort ||
    user.userEmailSmtpSecure === null ||
    !user.userEmailSmtpUser ||
    !user.userEmailSmtpPassword
  ) {
    return null;
  }

  return {
    host: user.userEmailSmtpHost,
    port: user.userEmailSmtpPort,
    secure: user.userEmailSmtpSecure,
    user: user.userEmailSmtpUser,
    password: user.userEmailSmtpPassword,
  };
}

/**
 * Create a nodemailer transporter using a user's personal SMTP configuration
 */
export async function createUserTransporter(userId: number) {
  const config = await getUserSmtpConfig(userId);
  
  if (!config) {
    throw new Error("User has not configured their email account");
  }

  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });
}

/**
 * Send an email using a user's personal email account
 */
export async function sendEmailAsUser(
  userId: number,
  params: SendEmailParams
): Promise<void> {
  try {
    const config = await getUserSmtpConfig(userId);
    
    if (!config) {
      throw new Error("User has not configured their email account");
    }

    const companyDetails = await getCompanyDetails();
    const transporter = await createUserTransporter(userId);

    // Get user details for the "from" name
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true },
    });

    const fromName = user 
      ? `${user.firstName} ${user.lastName} - ${companyDetails.companyName}`
      : companyDetails.companyName;

    const mailOptions = {
      from: {
        name: fromName,
        address: config.user,
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
    console.log(`Email sent successfully via user ${userId}'s account to: ${params.to}`);
    
    // Update last tested timestamp
    await db.user.update({
      where: { id: userId },
      data: { userEmailLastTestedAt: new Date() },
    });
  } catch (error) {
    console.error(`Failed to send email via user ${userId}'s account:`, error);
    throw error;
  }
}

/**
 * Test a user's email configuration by attempting to verify the connection
 */
export async function testUserEmailConfig(config: UserSmtpConfig): Promise<void> {
  const transporter = nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: {
      user: config.user,
      pass: config.password,
    },
  });

  // Verify the connection
  await transporter.verify();
}
