import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

export const sendTestStatementEmail = baseProcedure
  .input(
    z.object({
      token: z.string(),
      recipientEmail: z.string().email(),
    })
  )
  .mutation(async ({ input }) => {
    // Authenticate user and require admin privileges
    const user = await authenticateUser(input.token);
    requireAdmin(user);

    try {
      const companyDetails = await getCompanyDetails();
      
      // Generate test statement data
      const testStatementNumber = "STMT-TEST-001";
      const testCustomerName = "Test Customer";
      const testTotalDue = 15750.00;
      const testStatementDate = new Date();
      
      const subject = `Statement ${testStatementNumber} - ${companyDetails.companyName}`;
      
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
              padding: 30px 20px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
            }
            .badge {
              display: inline-block;
              background-color: rgba(255, 255, 255, 0.2);
              padding: 8px 16px;
              border-radius: 20px;
              margin-top: 10px;
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
              border-left: 4px solid ${env.BRAND_ACCENT_COLOR};
              border-radius: 4px;
              box-shadow: 0 1px 3px rgba(0,0,0,0.1);
            }
            .info-row {
              margin: 12px 0;
              display: flex;
              justify-content: space-between;
              align-items: center;
            }
            .label {
              font-weight: bold;
              color: #666;
            }
            .value {
              color: #1a1a1a;
              font-weight: bold;
            }
            .total-box {
              background: linear-gradient(135deg, ${env.BRAND_PRIMARY_COLOR} 0%, ${env.BRAND_ACCENT_COLOR} 100%);
              color: white;
              padding: 20px;
              border-radius: 8px;
              text-align: center;
              margin: 20px 0;
            }
            .total-amount {
              font-size: 36px;
              font-weight: bold;
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
              background-color: #fef3c7;
              color: ${env.BRAND_WARNING_COLOR};
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
              <h1>📄 Account Statement <span class="test-badge">TEST EMAIL</span></h1>
              <div class="badge">${testStatementNumber}</div>
            </div>
            
            <div class="content">
              <p class="greeting">Dear ${testCustomerName},</p>
              
              <p>Please find below your account statement as of ${testStatementDate.toLocaleDateString('en-ZA', { year: 'numeric', month: 'long', day: 'numeric' })}.</p>
              
              <div class="warning-box">
                <strong>⚠️ This is a test email</strong><br>
                This statement contains sample data for testing purposes only. No actual payment is required.
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">Statement Summary</h3>
                <div class="info-row">
                  <span class="label">Statement Number:</span>
                  <span class="value">${testStatementNumber}</span>
                </div>
                <div class="info-row">
                  <span class="label">Statement Date:</span>
                  <span class="value">${testStatementDate.toLocaleDateString('en-ZA')}</span>
                </div>
                <div class="info-row">
                  <span class="label">Customer:</span>
                  <span class="value">${testCustomerName}</span>
                </div>
              </div>
              
              <div class="total-box">
                <div style="font-size: 16px; opacity: 0.9;">Total Amount Due</div>
                <div class="total-amount">R${testTotalDue.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size: 14px; opacity: 0.9;">Please arrange payment at your earliest convenience</div>
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">Payment Details</h3>
                <div class="info-row">
                  <span class="label">Bank Name:</span>
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
                  <span class="value">${testStatementNumber}</span>
                </div>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you have any questions about this statement or have already made payment, please contact us at ${companyDetails.companyEmail} or ${companyDetails.companyPhone}.
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
        message: "Test statement email sent successfully",
        testData: {
          statementNumber: testStatementNumber,
          customerName: testCustomerName,
          totalDue: testTotalDue,
        },
      };
    } catch (error) {
      console.error("Failed to send test statement email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test statement email: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test statement email due to an unknown error",
      });
    }
  });
