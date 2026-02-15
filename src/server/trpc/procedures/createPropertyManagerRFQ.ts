import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { createNotification, notifyAdmins } from "~/server/utils/notifications";
import { sendRFQNotificationEmail } from "~/server/utils/email";
import { createExternalSubmissionInvite } from "~/server/utils/external-invites";

const rfqInputSchema = z.object({
  token: z.string(),
  title: z.string().min(3, "Title is required"),
  description: z.string().min(10, "Description is required"),
  scopeOfWork: z.string().min(10, "Scope of Work is required"),
  buildingName: z.string().optional(),
  buildingAddress: z.string().min(5, "Building address is required"),
  urgency: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  estimatedBudget: z.number().min(0).nullable().optional(),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional(),
  contractorTableIds: z.array(z.number()).optional(), // IDs from Contractor table, not User table
  externalContractorEmails: z.array(z.string().email()).optional(),
});

export const createPropertyManagerRFQ = baseProcedure
  .input(rfqInputSchema)
  .mutation(async ({ input }) => {
    console.log("--- Initiating New RFQ Creation ---");
    console.log("Received input:", JSON.stringify(input, null, 2));

    const user = await authenticateUser(input.token);
    console.log(`Authenticated as Property Manager: ${user.email} (ID: ${user.id})`);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can submit RFQs.",
      });
    }

    try {
      const contractorUserIds: number[] = [];
      const contractorsForEmail: { email: string; name: string }[] = [];

      // Add any manually-provided external contractor emails
      if (input.externalContractorEmails?.length) {
        for (const email of input.externalContractorEmails) {
          contractorsForEmail.push({ email, name: email });
        }
      }

      if (input.contractorTableIds && input.contractorTableIds.length > 0) {
        console.log(`Contractors selected. Looking up ${input.contractorTableIds.length} contractor(s) from table IDs: ${input.contractorTableIds.join(", ")}`);
        const selectedContractors = await db.contractor.findMany({
          where: { id: { in: input.contractorTableIds } },
        });

        console.log(`Found ${selectedContractors.length} matching contractors in the database.`);

        for (const contractor of selectedContractors) {
          console.log(`Processing contractor: ${contractor.companyName || `${contractor.firstName} ${contractor.lastName}`} (Portal Access: ${contractor.portalAccessEnabled})`);
          if (contractor.portalAccessEnabled) {
            console.log(`Searching for User account with email: ${contractor.email}`);
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
            });
            if (contractorUser) {
              console.log(`Found User ID: ${contractorUser.id}`);
              contractorUserIds.push(contractorUser.id);
            } else {
              console.log(`WARNING: Contractor ${contractor.email} has portal access enabled but no corresponding User account was found.`);
              console.log("Falling back to email notification for this contractor.");
              contractorsForEmail.push({
                email: contractor.email,
                name:
                  contractor.companyName ||
                  `${contractor.firstName} ${contractor.lastName}`,
              });
            }
          } else {
            console.log("Contractor does not have portal access. Adding to email list.");
            contractorsForEmail.push({
              email: contractor.email,
              name:
                contractor.companyName ||
                `${contractor.firstName} ${contractor.lastName}`,
            });
          }
        }
      } else {
        console.log("No contractors were selected for this RFQ.");
      }

      const companyDetails = await getCompanyDetails();
      const count = await db.propertyManagerRFQ.count();
      const rfqNumber = `${companyDetails.quotationPrefix}-PM-RFQ-${String(count + 1).padStart(5, "0")}`;

      const rfq = await db.propertyManagerRFQ.create({
        data: {
          rfqNumber,
          propertyManagerId: user.id,
          title: input.title,
          description: input.description,
          scopeOfWork: input.scopeOfWork,
          buildingName: input.buildingName || null,
          buildingAddress: input.buildingAddress,
          urgency: input.urgency,
          estimatedBudget: input.estimatedBudget || null,
          attachments: input.attachments || [],
          submittedDate: new Date(),
          status: "SUBMITTED",
          notes: input.notes || null,
          // Store Contractor table IDs for portal visibility / access checks.
          // (Contractor portal maps logged-in User.email -> Contractor.id)
          selectedContractorIds: input.contractorTableIds || [],
        },
      });

      console.log(`RFQ ${rfq.rfqNumber} created successfully in database.`);
      console.log(`RFQ is linked to contractor table IDs: [${(input.contractorTableIds || []).join(", ")}]`);
      console.log(`Resolved contractor portal User IDs (for notifications): [${contractorUserIds.join(", ")}]`);

      // --- NOTIFICATION LOGIC ---
      console.log("--- Determining Notification Path ---");
      if (contractorUserIds.length > 0) {
        // Notify contractors with portal access
        console.log(`Sending in-app + push notifications to ${contractorUserIds.length} users.`);
        for (const userId of contractorUserIds) {
          await createNotification({
            recipientId: userId,
            recipientRole: "CONTRACTOR",
            message: `You have received a new RFQ (${rfq.rfqNumber}) from ${user.firstName} ${user.lastName}.`,
            type: "RFQ_SUBMITTED",
            relatedEntityId: rfq.id,
            relatedEntityType: "PROPERTY_MANAGER_RFQ",
          });

          // Also send email notification
          const contractorUser = await db.user.findUnique({
            where: { id: userId },
            select: { email: true, firstName: true, lastName: true },
          });

          if (contractorUser) {
            try {
              await sendRFQNotificationEmail({
                contractorEmail: contractorUser.email,
                contractorName: `${contractorUser.firstName} ${contractorUser.lastName}`,
                propertyManagerName: `${user.firstName} ${user.lastName}`,
                propertyManagerEmail: user.email,
                rfqNumber: rfq.rfqNumber,
                rfqTitle: rfq.title,
                rfqDescription: rfq.description,
                buildingAddress: rfq.buildingAddress,
                urgency: rfq.urgency,
                estimatedBudget: rfq.estimatedBudget,
                propertyManagerId: user.id, // Send from PM's personal email if configured
              });
              console.log(`Email notification sent to ${contractorUser.email}`);
            } catch (emailError) {
              console.error(`Failed to send email to ${contractorUser.email}:`, emailError);
              // Don't fail the whole operation if email fails
            }
          }
        }
        console.log("In-app notifications sent.");
      }

      if (contractorsForEmail.length > 0) {
        // Send email notifications to contractors without portal access
        console.log(`Sending email notifications to ${contractorsForEmail.length} contractors.`);
        for (const contractor of contractorsForEmail) {
          try {
            // Create secure external submission link for email-only contractors
            const { link: quoteSubmissionLink } = await createExternalSubmissionInvite({
              type: "RFQ_QUOTE",
              email: contractor.email,
              name: contractor.name,
              rfqId: rfq.id,
              expiresInDays: 14,
            });

            await sendRFQNotificationEmail({
              contractorEmail: contractor.email,
              contractorName: contractor.name,
              propertyManagerName: `${user.firstName} ${user.lastName}`,
              propertyManagerEmail: user.email,
              rfqNumber: rfq.rfqNumber,
              rfqTitle: rfq.title,
              rfqDescription: rfq.description,
              buildingAddress: rfq.buildingAddress,
              urgency: rfq.urgency,
              estimatedBudget: rfq.estimatedBudget,
              propertyManagerId: user.id,
              quoteSubmissionLink,
            });
            console.log(`Email sent to ${contractor.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to ${contractor.email}:`, emailError);
            // Don't fail the whole operation if email fails
          }
        }
      }

      if (
        contractorUserIds.length === 0 &&
        contractorsForEmail.length === 0
      ) {
        // No contractors were selected, or none were found, notify admins
        console.log("No contractors were selected or found. Notifying admins.");
        await notifyAdmins({
          message: `New RFQ ${rfq.rfqNumber} submitted by ${user.firstName} ${user.lastName} requires attention.`,
          type: "RFQ_SUBMITTED",
          relatedEntityId: rfq.id,
          relatedEntityType: "PROPERTY_MANAGER_RFQ",
        });
        console.log("Admin notification sent.");
      }

      console.log("--- RFQ Creation Process Finished ---");
      return rfq;
    } catch (error) {
      console.error("Error creating Property Manager RFQ:", error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to submit RFQ.",
      });
    }
  });
