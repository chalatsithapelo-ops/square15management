import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { notifyAdmins } from "~/server/utils/notifications";
import { sendOrderNotificationEmail } from "~/server/utils/email";

const CONTRACTOR_ROLES = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"] as const;

const orderInputSchema = z.object({
  token: z.string(),
  contractorTableId: z.number().optional(), // ID from Contractor table, not User table
  contractorId: z.number().optional(), // DEPRECATED: for backward compatibility
  generatedFromRFQId: z.number().optional(),
  sourceRFQId: z.number().optional(),
  title: z.string().min(3),
  description: z.string().min(10),
  scopeOfWork: z.string().min(10),
  buildingName: z.string().optional(),
  buildingAddress: z.string().min(5),
  totalAmount: z.number().min(0),
  attachments: z.array(z.string()).optional(),
  notes: z.string().optional(),
});

export const createPropertyManagerOrder = baseProcedure
  .input(orderInputSchema)
  .mutation(async ({ input }) => {
    console.log("--- Initiating New Order Creation ---");
    console.log("Received input:", JSON.stringify(input, null, 2));

    const user = await authenticateUser(input.token);
    console.log(`Authenticated as Property Manager: ${user.email} (ID: ${user.id})`);

    let contractorUserId: number | null = null;
    let contractorDetails: { email: string; name: string } | null = null;
    let sourceRFQ:
      | {
          id: number;
          rfqNumber: string;
          title: string;
          description: string;
          buildingAddress: string;
          buildingName: string | null;
          status: string;
          propertyManagerId: number;
          generatedOrderId: number | null;
        }
      | null = null;

    let approvedQuotationForRFQ:
      | {
          createdById: number | null;
          createdBy: {
            email: string;
            firstName: string;
            lastName: string;
          } | null;
          items: any;
          quotationLineItems: any;
          subtotal: number;
          tax: number;
          total: number;
        }
      | null = null;

    const formatCurrency = (value: number) => `R ${Number(value || 0).toFixed(2)}`;

    const buildItemisedScopeFromQuotation = (quotation: {
      items: any;
      quotationLineItems: any;
      subtotal: number;
      tax: number;
      total: number;
    }) => {
      const lines: string[] = [];
      const addLineItems = (raw: any, heading: string) => {
        if (!raw) return;
        const arr = Array.isArray(raw) ? raw : typeof raw === "string" ? (() => {
          try { return JSON.parse(raw); } catch { return null; }
        })() : raw;
        if (!Array.isArray(arr) || arr.length === 0) return;

        lines.push(heading);
        arr.forEach((item: any, idx: number) => {
          const description = String(item?.description ?? item?.name ?? "").trim();
          const quantity = Number(item?.quantity || 0);
          const unitPrice = Number(item?.unitPrice ?? 0);
          const rawTotal = item?.total;
          const computedTotal = quantity * unitPrice;
          const total = rawTotal === null || rawTotal === undefined ? computedTotal : Number(rawTotal);
          const uom = String(item?.unitOfMeasure ?? item?.uom ?? "").trim();

          const qtyPart = quantity ? `${quantity}${uom ? ` ${uom}` : ""}` : "";
          const unitPart = unitPrice ? ` @ ${formatCurrency(unitPrice)}` : "";
          const totalPart = total ? ` = ${formatCurrency(total)}` : "";
          const detailPart = [qtyPart + unitPart, totalPart].filter(Boolean).join("");

          lines.push(`${idx + 1}. ${description || "Line item"}${detailPart ? ` (${detailPart})` : ""}`);
        });
        lines.push("");
      };

      addLineItems(quotation.quotationLineItems, "ITEMISED SCOPE OF WORK");
      if (lines.length === 0) {
        addLineItems(quotation.items, "ITEMISED SCOPE OF WORK");
      }

      lines.push("BILLING SUMMARY");
      lines.push(`Subtotal: ${formatCurrency(quotation.subtotal)}`);
      lines.push(`VAT/Tax: ${formatCurrency(quotation.tax)}`);
      lines.push(`Total: ${formatCurrency(quotation.total)}`);

      return lines.join("\n").trim();
    };

    if (input.contractorTableId) {
      console.log(`Contractor selected. Looking up Contractor with table ID: ${input.contractorTableId}`);
      const contractor = await db.contractor.findUnique({
        where: { id: input.contractorTableId },
      });

      if (contractor) {
        console.log(`Found contractor: ${contractor.companyName || `${contractor.firstName} ${contractor.lastName}`} (Email: ${contractor.email})`);
        console.log(`Portal Access Enabled: ${contractor.portalAccessEnabled}`);
        contractorDetails = {
          email: contractor.email,
          name:
            contractor.companyName ||
            `${contractor.firstName} ${contractor.lastName}`,
        };
        if (contractor.portalAccessEnabled) {
          console.log("Contractor has portal access. Searching for associated User account...");
          const contractorUser = await db.user.findFirst({
            where: { email: contractor.email, role: { in: [...CONTRACTOR_ROLES] } },
          });
          if (contractorUser) {
            contractorUserId = contractorUser.id;
            console.log(`Found associated User account with ID: ${contractorUserId}`);
          } else {
            console.log(`WARNING: Contractor ${contractor.email} has portal access enabled but no corresponding User account was found.`);
          }
        } else {
          console.log("Contractor does not have portal access.");
        }
      } else {
        console.error(`ERROR: Selected contractor with table ID ${input.contractorTableId} not found in database.`);
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Selected contractor not found.",
        });
      }
    } else {
      console.log("No contractor was selected for this order.");
    }

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers can create orders.",
      });
    }

    try {
      // If creating from RFQ, verify it exists and is approved
      if (input.generatedFromRFQId) {
        const rfq = await db.propertyManagerRFQ.findUnique({
          where: { id: input.generatedFromRFQId },
          select: {
            id: true,
            rfqNumber: true,
            title: true,
            description: true,
            buildingAddress: true,
            buildingName: true,
            status: true,
            propertyManagerId: true,
            generatedOrderId: true,
          },
        });

        if (!rfq) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "RFQ not found.",
          });
        }

        sourceRFQ = rfq;

        if (rfq.propertyManagerId !== user.id) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create orders from your own RFQs.",
          });
        }

        if (rfq.status !== "APPROVED") {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "Can only create orders from approved RFQs.",
          });
        }

        if (rfq.generatedOrderId) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "An order has already been generated from this RFQ.",
          });
        }
      }

      // When converting an approved RFQ to an order, always source scope/amount
      // from the APPROVED contractor quotation linked via RFQ number.
      if (sourceRFQ?.rfqNumber) {
        console.log(`Looking up approved quotation for RFQ ${sourceRFQ.rfqNumber}...`);

        const approvedQuotation = await db.quotation.findFirst({
          where: {
            clientReferenceQuoteNumber: sourceRFQ.rfqNumber,
            status: "APPROVED",
          },
          select: {
            createdById: true,
            createdBy: {
              select: {
                email: true,
                firstName: true,
                lastName: true,
              },
            },
            items: true,
            quotationLineItems: true,
            subtotal: true,
            tax: true,
            total: true,
          },
        });

        approvedQuotationForRFQ = approvedQuotation;

        // If the UI didn't explicitly pick a contractor, infer the winning contractor
        // from the approved quotation.
        if (!input.contractorTableId) {
          console.log(
            `No contractorTableId provided; attempting inference from approved quotation for RFQ ${sourceRFQ.rfqNumber}...`
          );

          const inferredEmail = approvedQuotation?.createdBy?.email;
          if (inferredEmail) {
            const inferredContractor = await db.contractor.findUnique({
              where: { email: inferredEmail },
            });

            if (inferredContractor) {
              contractorDetails = {
                email: inferredContractor.email,
                name:
                  inferredContractor.companyName ||
                  `${inferredContractor.firstName} ${inferredContractor.lastName}`,
              };

              if (inferredContractor.portalAccessEnabled) {
                const contractorUser = await db.user.findFirst({
                  where: { email: inferredContractor.email, role: { in: [...CONTRACTOR_ROLES] } },
                });
                contractorUserId = contractorUser?.id || approvedQuotation?.createdById || null;
              } else {
                contractorUserId = approvedQuotation?.createdById || null;
              }

              console.log(
                `Inferred contractor from approved quotation: ${contractorDetails.name} (${contractorDetails.email}); contractorUserId=${contractorUserId}`
              );
            } else {
              contractorDetails = {
                email: inferredEmail,
                name: approvedQuotation?.createdBy
                  ? `${approvedQuotation.createdBy.firstName} ${approvedQuotation.createdBy.lastName}`
                  : inferredEmail,
              };
              contractorUserId = approvedQuotation?.createdById || null;

              console.log(
                `Approved quotation found, but no Contractor record for ${inferredEmail}; using quotation creator as contractorUserId=${contractorUserId}`
              );
            }
          } else {
            console.log("No approved quotation found to infer contractor.");
          }
        }
      }

      // If converting from RFQ and an approved quotation exists, ensure the official order
      // captures the contractor-approved itemised scope of work and billing.
      const resolvedTitle = input.title;
      const resolvedBuildingName = input.buildingName ?? sourceRFQ?.buildingName ?? undefined;
      const resolvedBuildingAddress = sourceRFQ?.buildingAddress || input.buildingAddress;

      const resolvedDescription = approvedQuotationForRFQ
        ? `This work order is issued based on the contractor-approved quotation for RFQ ${sourceRFQ?.rfqNumber || ""}.\n\n${input.description}`.trim()
        : input.description;

      const resolvedScopeOfWork = approvedQuotationForRFQ
        ? buildItemisedScopeFromQuotation(approvedQuotationForRFQ)
        : input.scopeOfWork;

      const resolvedTotalAmount = approvedQuotationForRFQ
        ? approvedQuotationForRFQ.total
        : input.totalAmount;

      // Generate order number
      const companyDetails = await getCompanyDetails();
      const count = await db.propertyManagerOrder.count();
      const orderNumber = `${companyDetails.orderPrefix}-PM-${String(count + 1).padStart(5, "0")}`;

      // Create the order
      const order = await db.propertyManagerOrder.create({
        data: {
          orderNumber,
          propertyManagerId: user.id,
          contractorId: contractorUserId || null, // Assign contractor if provided
          generatedFromRFQId: input.generatedFromRFQId || null,
          sourceRFQId: input.sourceRFQId || null,
          title: resolvedTitle,
          description: resolvedDescription,
          scopeOfWork: resolvedScopeOfWork,
          buildingName: resolvedBuildingName || null,
          buildingAddress: resolvedBuildingAddress,
          totalAmount: resolvedTotalAmount,
          attachments: input.attachments || [],
          notes: input.notes || null,
          // PM issues the order into the contractor's Draft workflow.
          status: "DRAFT",
        },
      });

      console.log(`Order ${order.orderNumber} created successfully in database.`);
      console.log(`Order is linked to contractor User ID: ${contractorUserId}`);

      // If generated from RFQ, update RFQ status
      if (input.generatedFromRFQId) {
        await db.propertyManagerRFQ.update({
          where: { id: input.generatedFromRFQId },
          data: {
            status: "CONVERTED_TO_ORDER",
            generatedOrderId: order.id,
          },
        });
        console.log(`Updated source RFQ ${input.generatedFromRFQId} status to CONVERTED_TO_ORDER.`);
      }

      // --- NOTIFICATION LOGIC ---
      console.log("--- Determining Notification Path ---");
      if (contractorUserId) {
        // Contractor has portal access, send in-app notification
        console.log(`Contractor has User ID ${contractorUserId}. Sending in-app notification.`);
        await db.notification.create({
          data: {
            recipientId: contractorUserId,
            message: `New order ${order.orderNumber} assigned to you by ${user.firstName} ${user.lastName}`,
            type: "ORDER_ASSIGNED",
            relatedEntityId: order.id,
            relatedEntityType: "PROPERTY_MANAGER_ORDER",
            recipientRole: "CONTRACTOR",
          },
        });
        console.log("In-app notification sent.");

        // Also send email notification
        if (contractorDetails) {
          try {
            await sendOrderNotificationEmail({
              customerEmail: contractorDetails.email,
              customerName: contractorDetails.name,
              orderNumber: order.orderNumber,
              orderDescription: order.description,
              assignedToName: `${user.firstName} ${user.lastName}`, // Property Manager who created the order
              userId: user.id, // Send from PM's email if configured
            });
            console.log(`Email notification sent to contractor: ${contractorDetails.email}`);
          } catch (emailError) {
            console.error(`Failed to send email to contractor:`, emailError);
            // Don't fail the operation if email fails
          }
        }
      } else if (contractorDetails) {
        // Contractor selected but no portal access, send email notification
        console.log(`Contractor does not have a portal user. Sending email notification.`);
        try {
          await sendOrderNotificationEmail({
            customerEmail: contractorDetails.email,
            customerName: contractorDetails.name,
            orderNumber: order.orderNumber,
            orderDescription: order.description,
            assignedToName: `${user.firstName} ${user.lastName}`,
            userId: user.id,
          });
          console.log(`Email notification sent to contractor: ${contractorDetails.email}`);
        } catch (emailError) {
          console.error(`Failed to send email to contractor:`, emailError);
          // Don't fail the operation if email fails
        }
      } else {
        // No contractor was selected, notify admins
        console.log("No contractor was selected. Notifying admins.");
        await notifyAdmins({
          message: `New order ${order.orderNumber} submitted by ${user.firstName} ${user.lastName} requires a contractor to be assigned.`,
          type: "PM_ORDER_SUBMITTED",
          relatedEntityId: order.id,
          relatedEntityType: "PROPERTY_MANAGER_ORDER",
        });
        console.log("Admin notification sent.");
      }

      console.log("--- Order Creation Process Finished ---");
      return order;
    } catch (error) {
      console.error("=== ERROR CREATING PROPERTY MANAGER ORDER ===");
      console.error("Error object:", error);
      console.error("Error message:", error instanceof Error ? error.message : "Unknown error");
      console.error("Error stack:", error instanceof Error ? error.stack : "No stack trace");
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: error instanceof Error ? error.message : "Failed to create order.",
      });
    }
  });
