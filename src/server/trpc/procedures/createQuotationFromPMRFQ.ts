import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { sendEmail } from "~/server/utils/email";
import { getBaseUrl } from "~/server/utils/base-url";

const createQuotationFromRFQSchema = z.object({
  token: z.string(),
  rfqId: z.number(),
  items: z.array(
    z.object({
      description: z.string(),
      quantity: z.number(),
      unitPrice: z.number(),
      total: z.number(),
      unitOfMeasure: z.string(),
    })
  ),
  subtotal: z.number(),
  tax: z.number().default(0),
  total: z.number(),
  validUntil: z.string().optional(),
  notes: z.string().optional(),
  assignedToId: z.number().optional(), // Artisan to assign
  companyMaterialCost: z.number().default(0),
  companyLabourCost: z.number().default(0),
  estimatedProfit: z.number().default(0),
  labourRate: z.number().optional(),
});

export const createQuotationFromPMRFQ = baseProcedure
  .input(createQuotationFromRFQSchema)
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isContractorRole =
      user.role === "CONTRACTOR" ||
      user.role === "CONTRACTOR_JUNIOR_MANAGER" ||
      user.role === "CONTRACTOR_SENIOR_MANAGER";

    if (!isContractorRole && user.role !== "ARTISAN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only contractors and artisans can create quotations from RFQs.",
      });
    }

    try {
      // Fetch the RFQ
      const rfq = await db.propertyManagerRFQ.findUnique({
        where: { id: input.rfqId },
        include: {
          propertyManager: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
        },
      });

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found.",
        });
      }

      // Verify this contractor has access to this RFQ
      const contractor = await db.contractor.findFirst({
        where: { email: user.email },
        select: { id: true },
      });

      if (!contractor) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "No contractor profile found for your account.",
        });
      }

      if (!rfq.selectedContractorIds.includes(contractor.id)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You don't have access to this RFQ.",
        });
      }

      // Generate quotation number
      const companyDetails = await getCompanyDetails();
      const count = await db.quotation.count();
      const quoteNumber = `${companyDetails.quotationPrefix}-${String(count + 1).padStart(5, "0")}`;

      // Create the quotation
      const quotation = await db.quotation.create({
        data: {
          quoteNumber,
          clientReferenceQuoteNumber: rfq.rfqNumber || null,
          customerName: `${rfq.propertyManager.firstName} ${rfq.propertyManager.lastName}`,
          customerEmail: rfq.propertyManager.email,
          customerPhone: rfq.propertyManager.phone || "",
          address: rfq.buildingAddress,
          items: input.items,
          subtotal: input.subtotal,
          tax: input.tax,
          total: input.total,
          validUntil: input.validUntil ? new Date(input.validUntil) : null,
          notes: input.notes || `Quotation for RFQ: ${rfq.title}\n\nScope: ${rfq.scopeOfWork}`,
          assignedToId: input.assignedToId || user.id, // Assign to artisan or self
          createdById: user.id, // Track who created the quotation (contractor)
          companyMaterialCost: input.companyMaterialCost,
          companyLabourCost: input.companyLabourCost,
          estimatedProfit: input.estimatedProfit,
          labourRate: input.labourRate || null,
          status: input.assignedToId ? "PENDING_ARTISAN_REVIEW" : "IN_PROGRESS",
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      });

      // Update RFQ status to indicate quotation has been provided
      await db.propertyManagerRFQ.update({
        where: { id: input.rfqId },
        data: {
          status: "QUOTED",
        },
      });

      // Notify the Property Manager
      await db.notification.create({
        data: {
          recipientId: rfq.propertyManager.id,
          message: `${user.firstName} ${user.lastName} has submitted a quotation (${quotation.quoteNumber}) for your RFQ ${rfq.rfqNumber}.`,
          type: "RFQ_QUOTED" as any,
          relatedEntityId: quotation.id,
          relatedEntityType: "QUOTATION",
          recipientRole: "PROPERTY_MANAGER",
        },
      });

      // Send email notification to Property Manager
      try {
        const portalLink = `${getBaseUrl()}/property-manager/rfqs`;
        const companyDetailsData = await getCompanyDetails();

        await sendEmail({
          to: rfq.propertyManager.email,
          subject: `New Quotation Received for RFQ ${rfq.rfqNumber}`,
          html: `
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
                <h1>📋 Quotation Received</h1>
                <p style="margin: 10px 0 0 0; opacity: 0.9;">A contractor has responded to your RFQ</p>
              </div>
              
              <div class="content">
                <p>Hello <strong>${rfq.propertyManager.firstName}</strong>,</p>
                
                <p><strong>${user.firstName} ${user.lastName}</strong> has submitted a quotation for your RFQ.</p>
                
                <div class="info-box">
                  <p><strong>RFQ Details:</strong></p>
                  <p style="margin: 5px 0;">RFQ Number: ${rfq.rfqNumber}</p>
                  <p style="margin: 5px 0;">Title: ${rfq.title}</p>
                  <p style="margin: 5px 0;">Property: ${rfq.buildingAddress}</p>
                  
                  <p style="margin-top: 15px;"><strong>Quotation Details:</strong></p>
                  <p style="margin: 5px 0;">Quote Number: ${quotation.quoteNumber}</p>
                  <p style="margin: 5px 0;">Total Amount: R${quotation.total.toLocaleString()}</p>
                  <p style="margin: 5px 0;">Contractor: ${user.firstName} ${user.lastName}</p>
                </div>
                
                <div style="text-align: center; margin: 30px 0;">
                  <a href="${portalLink}" class="cta-button">
                    View Quotation in Portal →
                  </a>
                </div>
                
                <p style="color: #6b7280; font-size: 14px;">
                  You can review the quotation details, pricing breakdown, and accept or request revisions through your Property Manager portal.
                </p>
              </div>
              
              <div class="footer">
                <p><strong>${companyDetailsData.companyName}</strong></p>
                <p>${companyDetailsData.companyAddressLine1}, ${companyDetailsData.companyAddressLine2}</p>
                <p>Tel: ${companyDetailsData.companyPhone} | Email: ${companyDetailsData.companyEmail}</p>
              </div>
            </body>
            </html>
          `,
          userId: user.id, // Send from contractor's email if configured
        });
        console.log(`Quotation notification email sent to Property Manager: ${rfq.propertyManager.email}`);
      } catch (emailError) {
        console.error("Failed to send quotation notification email:", emailError);
        // Don't fail the operation if email fails
      }

      return quotation;
    } catch (error) {
      console.error("Error creating quotation from RFQ:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create quotation from RFQ.",
      });
    }
  });
