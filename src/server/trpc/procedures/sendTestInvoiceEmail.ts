import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

export const sendTestInvoiceEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      const companyDetails = await getCompanyDetails();
      
      const testInvoiceNumber = "INV-TEST-00123";
      const testCustomerName = "Test Customer";
      const testAmount = 8625.00;
      const testDueDate = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000); // 14 days from now
      
      const subject = `Invoice ${testInvoiceNumber} from ${companyDetails.companyName}`;
      
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
              background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .content {
              background-color: #f9fafb;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .info-box {
              background-color: white;
              padding: 20px;
              margin: 20px 0;
              border-left: 4px solid ${env.BRAND_ACCENT_COLOR};
              border-radius: 4px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .info-row {
              margin: 12px 0;
              display: flex;
              justify-content: space-between;
            }
            .label {
              font-weight: bold;
              color: #666;
            }
            .value {
              color: #1a1a1a;
            }
            .amount-box {
              background-color: #dbeafe;
              border: 2px solid #3b82f6;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
            }
            .amount {
              font-size: 36px;
              font-weight: bold;
              color: #1e40af;
              margin: 10px 0;
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
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #666;
              font-size: 12px;
              border-top: 1px solid #e5e7eb;
            }
            .warning-box {
              background-color: #fef3c7;
              border-left: 4px solid ${env.BRAND_WARNING_COLOR};
              padding: 15px;
              margin: 20px 0;
              border-radius: 4px;
            }
            .test-badge {
              background-color: rgba(255, 255, 255, 0.2);
              padding: 4px 12px;
              border-radius: 12px;
              font-size: 11px;
              font-weight: bold;
              display: inline-block;
              margin-left: 10px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🧾 New Invoice <span class="test-badge">TEST EMAIL</span></h1>
              <div style="margin-top: 10px; font-size: 16px;">${testInvoiceNumber}</div>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">Dear ${testCustomerName},</p>
              
              <p>Thank you for your business! We have generated invoice ${testInvoiceNumber} for your recent order.</p>
              
              <div class="warning-box">
                <strong>⚠️ This is a test email</strong><br>
                This invoice contains sample data for testing purposes only. No actual payment is required.
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">Invoice Details</h3>
                <div class="info-row">
                  <span class="label">Invoice Number:</span>
                  <span class="value"><strong>${testInvoiceNumber}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Invoice Date:</span>
                  <span class="value">${new Date().toLocaleDateString('en-ZA')}</span>
                </div>
                <div class="info-row">
                  <span class="label">Due Date:</span>
                  <span class="value"><strong>${testDueDate.toLocaleDateString('en-ZA')}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Customer:</span>
                  <span class="value">${testCustomerName}</span>
                </div>
              </div>
              
              <div class="amount-box">
                <div style="font-size: 14px; color: #1e40af;">Amount Due</div>
                <div class="amount">R${testAmount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size: 12px; color: #1e40af;">Due by ${testDueDate.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">Payment Instructions</h3>
                <p style="margin: 10px 0; color: #666;">Please make payment to the following bank account:</p>
                <div class="info-row">
                  <span class="label">Bank:</span>
                  <span class="value">${companyDetails.companyBankName}</span>
                </div>
                <div class="info-row">
                  <span class="label">Account Name:</span>
                  <span class="value">${companyDetails.companyBankAccountName}</span>
                </div>
                <div class="info-row">
                  <span class="label">Account Number:</span>
                  <span class="value">${companyDetails.companyBankAccountNumber}</span>
                </div>
                <div class="info-row">
                  <span class="label">Branch Code:</span>
                  <span class="value">${companyDetails.companyBankBranchCode}</span>
                </div>
                <div class="info-row">
                  <span class="label">Reference:</span>
                  <span class="value"><strong>${testInvoiceNumber}</strong></span>
                </div>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                <strong>Important:</strong> Please use the invoice number as your payment reference to ensure proper allocation.
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you have any questions about this invoice, please don't hesitate to contact us.
              </p>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                <strong>Note:</strong> This is a test email sent from the admin settings panel to verify email delivery configuration.
              </p>
            </div>
            
            <div class="footer">
              <p><strong>${companyDetails.companyName}</strong></p>
              <p>${companyDetails.companyAddressLine1}, ${companyDetails.companyAddressLine2}</p>
              <p>Tel: ${companyDetails.companyPhone} | Email: ${companyDetails.companyEmail}</p>
              <p>VAT: ${companyDetails.companyVatNumber}</p>
              <p style="margin-top: 10px; font-size: 11px; color: #999;">
                Test email sent by ${user.firstName} ${user.lastName} at ${new Date().toLocaleString()}
              </p>
            </div>
          </div>
        </body>
        </html>
      `;

      await sendEmail({
        to: input.recipientEmail,
        subject,
        html,
      });

      return {
        success: true,
        message: "Test invoice email sent successfully",
        testData: {
          invoiceNumber: testInvoiceNumber,
          customerName: testCustomerName,
          amount: testAmount,
          dueDate: testDueDate.toISOString(),
        },
      };
    } catch (error) {
      console.error("Failed to send test invoice email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test invoice email: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test invoice email due to an unknown error",
      });
    }
  });
