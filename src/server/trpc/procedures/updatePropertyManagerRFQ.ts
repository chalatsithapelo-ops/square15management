import { db } from "~/server/db";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { notifyAdmins, createNotification } from "~/server/utils/notifications";
import { sendRFQNotificationEmail } from "~/server/utils/email";
import { createExternalSubmissionInvite } from "~/server/utils/external-invites";
import * as z from "zod";

const updatePropertyManagerRFQSchema = z.object({
  token: z.string(),
  rfqId: z.number(),
  title: z.string().optional(),
  description: z.string().optional(),
  scopeOfWork: z.string().optional(),
  buildingName: z.string().optional(),
  buildingAddress: z.string().optional(),
  urgency: z.string().optional(),
  estimatedBudget: z.number().nullable().optional(),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional(),
  status: z.string().optional(),
  selectedContractorIds: z.array(z.number()).optional(),
});

export const updatePropertyManagerRFQ = baseProcedure
  .input(updatePropertyManagerRFQSchema)
  .mutation(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);
      if (user.role !== "PROPERTY_MANAGER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only Property Managers can update RFQs.",
        });
      }

      const rfq = await db.propertyManagerRFQ.findUnique({
        where: { id: input.rfqId },
      });

      if (!rfq) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "RFQ not found.",
        });
      }

      // Allow editing RFQs in any status (Property Manager can edit submitted RFQs)
      // No status restriction - PM can edit at any time

      if (rfq.propertyManagerId !== user.id) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own RFQs.",
        });
      }

      const updateData: any = {};
      
      if (input.title) updateData.title = input.title;
      if (input.description) updateData.description = input.description;
      if (input.scopeOfWork) updateData.scopeOfWork = input.scopeOfWork;
      if (input.buildingName !== undefined) updateData.buildingName = input.buildingName;
      if (input.buildingAddress) updateData.buildingAddress = input.buildingAddress;
      if (input.urgency) updateData.urgency = input.urgency;
      if (input.estimatedBudget !== undefined) updateData.estimatedBudget = input.estimatedBudget;
      if (input.attachments !== undefined) updateData.attachments = input.attachments;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.selectedContractorIds !== undefined) updateData.selectedContractorIds = input.selectedContractorIds;
      
      // If status is being changed to SUBMITTED, set the submittedDate
      const wasSubmitted = rfq.status === "SUBMITTED";
      if (input.status === "SUBMITTED" && !wasSubmitted) {
        updateData.status = "SUBMITTED";
        updateData.submittedDate = new Date();
      }

      const updatedRFQ = await db.propertyManagerRFQ.update({
        where: { id: input.rfqId },
        data: updateData,
      });

      // If this mutation is the moment the RFQ gets submitted, emit notifications/emails.
      if (input.status === "SUBMITTED" && !wasSubmitted) {
        const contractorTableIds =
          input.selectedContractorIds !== undefined
            ? input.selectedContractorIds
            : rfq.selectedContractorIds;

        const contractorUserIds: number[] = [];
        const contractorsForEmail: { email: string; name: string }[] = [];

        if (contractorTableIds && contractorTableIds.length > 0) {
          const selectedContractors = await db.contractor.findMany({
            where: { id: { in: contractorTableIds } },
          });

          for (const contractor of selectedContractors) {
            if (contractor.portalAccessEnabled) {
              const contractorUser = await db.user.findFirst({
                where: {
                  email: contractor.email,
                  role: {
                    in: [
                      "CONTRACTOR",
                      "CONTRACTOR_JUNIOR_MANAGER",
                      "CONTRACTOR_SENIOR_MANAGER",
                    ],
                  },
                },
                select: { id: true, email: true, firstName: true, lastName: true },
              });

              if (contractorUser) {
                contractorUserIds.push(contractorUser.id);
              } else {
                contractorsForEmail.push({
                  email: contractor.email,
                  name:
                    contractor.companyName ||
                    `${contractor.firstName} ${contractor.lastName}`,
                });
              }
            } else {
              contractorsForEmail.push({
                email: contractor.email,
                name:
                  contractor.companyName ||
                  `${contractor.firstName} ${contractor.lastName}`,
              });
            }
          }
        }

        // In-app + email to portal contractors
        for (const contractorUserId of contractorUserIds) {
          await createNotification({
            recipientId: contractorUserId,
            recipientRole: "CONTRACTOR",
            message: `You have received a new RFQ (${updatedRFQ.rfqNumber}) from ${user.firstName} ${user.lastName}.`,
            type: "RFQ_SUBMITTED",
            relatedEntityId: updatedRFQ.id,
            relatedEntityType: "PROPERTY_MANAGER_RFQ",
          });

          const contractorUser = await db.user.findUnique({
            where: { id: contractorUserId },
            select: { email: true, firstName: true, lastName: true },
          });

          if (contractorUser) {
            try {
              await sendRFQNotificationEmail({
                contractorEmail: contractorUser.email,
                contractorName: `${contractorUser.firstName} ${contractorUser.lastName}`,
                propertyManagerName: `${user.firstName} ${user.lastName}`,
                propertyManagerEmail: user.email,
                rfqNumber: updatedRFQ.rfqNumber,
                rfqTitle: updatedRFQ.title,
                rfqDescription: updatedRFQ.description,
                buildingAddress: updatedRFQ.buildingAddress,
                urgency: updatedRFQ.urgency,
                estimatedBudget: updatedRFQ.estimatedBudget,
                propertyManagerId: user.id,
              });
            } catch (emailError) {
              console.error("Failed to send RFQ email to contractor:", emailError);
            }
          }
        }

        // Email-only contractors (external submission link)
        for (const contractor of contractorsForEmail) {
          try {
            const { link: quoteSubmissionLink } = await createExternalSubmissionInvite({
              type: "RFQ_QUOTE",
              email: contractor.email,
              name: contractor.name,
              rfqId: updatedRFQ.id,
              expiresInDays: 14,
            });

            await sendRFQNotificationEmail({
              contractorEmail: contractor.email,
              contractorName: contractor.name,
              propertyManagerName: `${user.firstName} ${user.lastName}`,
              propertyManagerEmail: user.email,
              rfqNumber: updatedRFQ.rfqNumber,
              rfqTitle: updatedRFQ.title,
              rfqDescription: updatedRFQ.description,
              buildingAddress: updatedRFQ.buildingAddress,
              urgency: updatedRFQ.urgency,
              estimatedBudget: updatedRFQ.estimatedBudget,
              propertyManagerId: user.id,
              quoteSubmissionLink,
            });
          } catch (emailError) {
            console.error("Failed to send RFQ email to external contractor:", emailError);
          }
        }

        if (contractorUserIds.length === 0 && contractorsForEmail.length === 0) {
          await notifyAdmins({
            message: `RFQ ${updatedRFQ.rfqNumber} was submitted by ${user.firstName} ${user.lastName} with no contractors selected and requires attention.`,
            type: "RFQ_SUBMITTED",
            relatedEntityId: updatedRFQ.id,
            relatedEntityType: "PROPERTY_MANAGER_RFQ",
          });
        }
      }

      return updatedRFQ;
    } catch (error) {
      console.error("Error updating RFQ:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to update RFQ.",
      });
    }
  });
