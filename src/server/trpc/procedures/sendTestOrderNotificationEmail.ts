import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requireAdmin } from "~/server/utils/auth";
import { sendEmail } from "~/server/utils/email";
import { getCompanyDetails } from "~/server/utils/company-details";
import { env } from "~/server/env";

export const sendTestOrderNotificationEmail = baseProcedure
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
      
      const testOrderNumber = "ORD-TEST-000456";
      const testCustomerName = "Test Customer";
      const testServiceType = "Plumbing Repair";
      const testArtisanName = "John Smith";
      const testStatus = "IN_PROGRESS";
      
      const subject = `Order ${testOrderNumber} Status Update - Work in Progress`;
      
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
            .status-badge {
              background-color: #dbeafe;
              color: #1e40af;
              padding: 10px 20px;
              border-radius: 20px;
              display: inline-block;
              margin: 20px 0;
              font-weight: bold;
              font-size: 14px;
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
            .progress-section {
              background: linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%);
              padding: 20px;
              border-radius: 8px;
              margin: 20px 0;
            }
            .progress-steps {
              display: flex;
              justify-content: space-between;
              margin-top: 15px;
            }
            .step {
              text-align: center;
              flex: 1;
            }
            .step-circle {
              width: 40px;
              height: 40px;
              border-radius: 50%;
              margin: 0 auto 8px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-weight: bold;
              font-size: 18px;
            }
            .step-active {
              background-color: ${env.BRAND_SUCCESS_COLOR};
              color: white;
            }
            .step-inactive {
              background-color: #e5e7eb;
              color: #9ca3af;
            }
            .step-label {
              font-size: 11px;
              color: #666;
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
              <h1>🔧 Order Status Update <span class="test-badge">TEST EMAIL</span></h1>
              <div style="margin-top: 10px; font-size: 16px;">${testOrderNumber}</div>
            </div>
            
            <div class="content">
              <p style="font-size: 16px; margin-bottom: 20px;">Dear ${testCustomerName},</p>
              
              <p>We have an update on your order! Work is now in progress.</p>
              
              <div class="warning-box">
                <strong>⚠️ This is a test email</strong><br>
                This notification contains sample data for testing purposes only.
              </div>
              
              <div class="status-badge">
                ✓ Work In Progress
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">Order Details</h3>
                <div class="info-row">
                  <span class="label">Order Number:</span>
                  <span class="value"><strong>${testOrderNumber}</strong></span>
                </div>
                <div class="info-row">
                  <span class="label">Service Type:</span>
                  <span class="value">${testServiceType}</span>
                </div>
                <div class="info-row">
                  <span class="label">Assigned Artisan:</span>
                  <span class="value">${testArtisanName}</span>
                </div>
                <div class="info-row">
                  <span class="label">Status:</span>
                  <span class="value"><strong style="color: ${env.BRAND_SUCCESS_COLOR};">In Progress</strong></span>
                </div>
              </div>
              
              <div class="progress-section">
                <h3 style="margin-top: 0; color: #1e40af;">Order Progress</h3>
                <div class="progress-steps">
                  <div class="step">
                    <div class="step-circle step-active">✓</div>
                    <div class="step-label">Received</div>
                  </div>
                  <div class="step">
                    <div class="step-circle step-active">✓</div>
                    <div class="step-label">Assigned</div>
                  </div>
                  <div class="step">
                    <div class="step-circle step-active">⚡</div>
                    <div class="step-label">In Progress</div>
                  </div>
                  <div class="step">
                    <div class="step-circle step-inactive">○</div>
                    <div class="step-label">Completed</div>
                  </div>
                </div>
              </div>
              
              <div class="info-box">
                <h3 style="margin-top: 0; color: #1a1a1a;">What's Happening Now?</h3>
                <p style="margin: 10px 0; color: #666;">
                  ${testArtisanName} has started working on your ${testServiceType} order. They will keep you updated on the progress and notify you once the work is completed.
                </p>
                <p style="margin: 10px 0; color: #666;">
                  <strong>Estimated completion:</strong> We will update you as soon as we have more information.
                </p>
              </div>
              
              <p style="margin-top: 20px; font-size: 14px; color: #666;">
                If you have any questions or concerns about your order, please feel free to contact us at ${companyDetails.companyPhone} or ${companyDetails.companyEmail}.
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
        message: "Test order notification email sent successfully",
        testData: {
          orderNumber: testOrderNumber,
          customerName: testCustomerName,
          serviceType: testServiceType,
          artisanName: testArtisanName,
          status: testStatus,
        },
      };
    } catch (error) {
      console.error("Failed to send test order notification email:", error);
      
      if (error instanceof Error) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: `Failed to send test order notification email: ${error.message}`,
          cause: error,
        });
      }
      
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to send test order notification email due to an unknown error",
      });
    }
  });
