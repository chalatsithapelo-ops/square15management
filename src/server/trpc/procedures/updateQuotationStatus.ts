import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateQuotationStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      quotationId: z.number(),
      status: z.enum([
        "DRAFT",
        "PENDING_ARTISAN_REVIEW",
        "IN_PROGRESS",
        "PENDING_JUNIOR_MANAGER_REVIEW",
        "PENDING_SENIOR_MANAGER_REVIEW",
        "APPROVED",
        "SENT_TO_CUSTOMER",
        "REJECTED",
      ]),
      rejectionReason: z.string().optional(),
      beforePictures: z.array(z.string()).optional(),
      materialCost: z.number().optional(),
      expenseSlips: z.array(
        z.object({
          url: z.string(),
          category: z.enum(["MATERIALS", "TOOLS", "TRANSPORTATION", "OTHER"]),
          description: z.string().optional(),
          amount: z.number().optional(),
        })
      ).optional(),
      numPeopleNeeded: z.number().optional(),
      estimatedDuration: z.number().optional(),
      durationUnit: z.enum(["HOURLY", "DAILY"]).optional(),
      labourRate: z.number().optional(),
      quotationLineItems: z.array(
        z.object({
          description: z.string(),
          category: z.string(),
          quantity: z.number().optional(),
          notes: z.string().optional(),
          unitOfMeasure: z.string().optional(),
        })
      ).optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      // Get the quotation
      const existingQuotation = await db.quotation.findUnique({
        where: { id: input.quotationId },
        include: { assignedTo: true },
      });

      if (!existingQuotation) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Quotation not found",
        });
      }

      // Check if this is a contractor quotation
      const isContractorQuotation = existingQuotation.assignedTo && 
        (existingQuotation.assignedTo.role === "CONTRACTOR" || 
         existingQuotation.assignedTo.role === "CONTRACTOR_SENIOR_MANAGER" || 
         existingQuotation.assignedTo.role === "CONTRACTOR_JUNIOR_MANAGER");

      // For contractor quotations, use similar approval workflow as invoices
      // Map quotation statuses to invoice-like workflow:
      // DRAFT -> PENDING_JUNIOR_MANAGER_REVIEW -> PENDING_SENIOR_MANAGER_REVIEW -> APPROVED -> SENT_TO_CUSTOMER
      if (isContractorQuotation) {
        // Junior Manager can move from DRAFT to PENDING_JUNIOR_MANAGER_REVIEW
        if (user.role === "CONTRACTOR_JUNIOR_MANAGER") {
          if (existingQuotation.status === "DRAFT" && 
              input.status === "PENDING_JUNIOR_MANAGER_REVIEW") {
            // Valid transition
          } else if (input.status === "REJECTED" || input.status === "DRAFT") {
            // Can reject or send back to draft
          } else {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "Junior Manager can only move quotations from DRAFT to PENDING_JUNIOR_MANAGER_REVIEW",
            });
          }
        }
        // Senior Manager and Contractor (who is the senior manager of their company)
        // have full control over quotation status changes
        else if (user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR") {
          // Senior managers and contractors have full approval authority - no restrictions
          // They can change status to anything needed
        }
      }

      // Prepare update data
      const updateData: any = {
        status: input.status,
        rejectionReason: input.rejectionReason || null,
      };

      // Handle status-specific requirements
      if (input.status === "IN_PROGRESS") {
        if (input.beforePictures && input.beforePictures.length > 0) {
          updateData.beforePictures = input.beforePictures;
          updateData.startTime = new Date();
        }
      }

      if (input.status === "PENDING_JUNIOR_MANAGER_REVIEW" || input.status === "PENDING_SENIOR_MANAGER_REVIEW") {
        updateData.endTime = new Date();
        
        // Store artisan's quotation line items
        if (input.quotationLineItems !== undefined) {
          updateData.quotationLineItems = input.quotationLineItems;
        }
        
        // Store labour estimation fields - ensure all are saved together
        if (input.numPeopleNeeded !== undefined) {
          updateData.numPeopleNeeded = input.numPeopleNeeded;
        }
        if (input.estimatedDuration !== undefined) {
          updateData.estimatedDuration = input.estimatedDuration;
        }
        if (input.durationUnit !== undefined) {
          updateData.durationUnit = input.durationUnit;
        }
        
        // Store the artisan-provided labour rate
        if (input.labourRate !== undefined) {
          updateData.labourRate = input.labourRate;
        }
        
        // Calculate company material cost from expense slips
        if (input.expenseSlips && input.expenseSlips.length > 0) {
          const totalMaterialCost = input.expenseSlips.reduce(
            (sum, slip) => sum + (slip.amount || 0),
            0
          );
          updateData.companyMaterialCost = totalMaterialCost;
        } else if (input.materialCost !== undefined) {
          updateData.companyMaterialCost = input.materialCost;
        }
        
        // Calculate company labour cost using artisan-provided rate
        // Formula: People x Duration x rate amount
        if (
          input.numPeopleNeeded !== undefined &&
          input.estimatedDuration !== undefined &&
          input.labourRate !== undefined
        ) {
          const calculatedLabourCost = input.numPeopleNeeded * input.estimatedDuration * input.labourRate;
          updateData.companyLabourCost = calculatedLabourCost;
        }
        
        // Recalculate estimated profit if we have all the data
        if (updateData.companyMaterialCost !== undefined && updateData.companyLabourCost !== undefined) {
          const totalCost = updateData.companyMaterialCost + updateData.companyLabourCost;
          updateData.estimatedProfit = existingQuotation.total - totalCost;
        }
      }

      // Update quotation
      const quotation = await db.quotation.update({
        where: { id: input.quotationId },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              role: true,
            },
          },
          lead: {
            select: {
              id: true,
              customerName: true,
              serviceType: true,
            },
          },
          project: {
            select: {
              id: true,
              name: true,
              projectNumber: true,
            },
          },
        },
      });

      // Handle expense slips if provided
      // IMPORTANT: Replace existing slips to avoid duplicates on resubmission.
      if (input.expenseSlips && input.expenseSlips.length > 0) {
        await db.quotationExpenseSlip.deleteMany({
          where: { quotationId: input.quotationId },
        });

        await db.quotationExpenseSlip.createMany({
          data: input.expenseSlips.map((slip) => ({
            quotationId: input.quotationId,
            url: slip.url,
            category: slip.category,
            description: slip.description,
            amount: slip.amount,
          })),
        });
      }

      // When quotation is sent to customer, update related PropertyManagerRFQ to RECEIVED
      if (input.status === "SENT_TO_CUSTOMER" && quotation.customerEmail) {
        // Find PropertyManagerRFQ that matches this quotation's customer
        const relatedRFQ = await db.propertyManagerRFQ.findFirst({
          where: {
            propertyManager: {
              email: quotation.customerEmail
            },
            status: {
              in: ["SUBMITTED", "UNDER_REVIEW"]
            }
          },
          orderBy: {
            createdAt: "desc"
          }
        });

        if (relatedRFQ) {
          await db.propertyManagerRFQ.update({
            where: { id: relatedRFQ.id },
            data: {
              status: "RECEIVED",
              quotedDate: new Date()
            }
          });
        }
      }

      // Notify the assigned artisan/user about quotation status changes
      if (quotation.assignedTo && input.status && input.status !== existingQuotation.status) {
        try {
          const { createNotification, notifyAdmins } = await import('~/server/utils/notifications');
          
          // Notify the assigned user (artisan or contractor)
          await createNotification({
            recipientId: quotation.assignedTo.id,
            recipientRole: quotation.assignedTo.role || 'ARTISAN',
            message: `Quotation ${quotation.quoteNumber} status updated to ${input.status.replace(/_/g, ' ')}`,
            type: 'QUOTATION_STATUS_UPDATED',
            relatedEntityId: quotation.id,
            relatedEntityType: 'QUOTATION',
          }).catch((err: any) => console.error('Failed to notify assigned user about quotation status:', err));

          // Notify admins about quotation status changes
          await notifyAdmins({
            message: `Quotation ${quotation.quoteNumber} status updated to ${input.status.replace(/_/g, ' ')}`,
            type: 'QUOTATION_STATUS_UPDATED',
            relatedEntityId: quotation.id,
            relatedEntityType: 'QUOTATION',
          }).catch((err: any) => console.error('Failed to notify admins about quotation status:', err));
        } catch (notifyError) {
          console.error('Failed to send quotation status notifications:', notifyError);
        }
      }

      return quotation;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
