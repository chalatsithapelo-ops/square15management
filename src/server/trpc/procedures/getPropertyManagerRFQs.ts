import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, isAdmin } from "~/server/utils/auth";
import { TRPCError } from "@trpc/server";

export const getPropertyManagerRFQs = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.string().nullish(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const isContractorRole =
      user.role === "CONTRACTOR" ||
      user.role === "CONTRACTOR_JUNIOR_MANAGER" ||
      user.role === "CONTRACTOR_SENIOR_MANAGER";

    const userIsAdmin = isAdmin(user);

    if (!userIsAdmin && user.role !== "PROPERTY_MANAGER" && !isContractorRole) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only Property Managers, Contractors, and Admins can view this resource.",
      });
    }

    const where: any = {};

    if (user.role === "PROPERTY_MANAGER") {
      // Property managers see their own RFQs
      where.propertyManagerId = user.id;
    } else if (isContractorRole) {
      // Contractors see RFQs sent to their Contractor-table record.
      // The RFQ stores Contractor IDs (not User IDs).
      const contractor = await db.contractor.findFirst({
        where: { email: user.email },
        select: { id: true },
      });

      if (!contractor) {
        // No matching Contractor record → no RFQs can be targeted to this user.
        return [];
      }

      where.selectedContractorIds = {
        has: contractor.id,
      };
    } else if (userIsAdmin) {
      // Admins only see RFQs with NO contractors assigned
      where.selectedContractorIds = {
        isEmpty: true,
      };
    }

    if (input.status) {
      where.status = input.status;
    }

    const rfqs = await db.propertyManagerRFQ.findMany({
      where,
      include: {
        adminQuote: true,
        generatedOrder: true,
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
      orderBy: {
        createdAt: "desc",
      },
    });

    // For RFQs that are in review flow, fetch the related contractor quotation
    const rfqsWithQuotations = await Promise.all(
      rfqs.map(async (rfq) => {
        // Defensive: some legacy records may have status CONVERTED_TO_ORDER but be missing the generatedOrder relation.
        // Attempt to recover by finding the PropertyManagerOrder created from this RFQ.
        if (rfq.status === "CONVERTED_TO_ORDER" && !(rfq as any).generatedOrder) {
          const fallbackOrder = await db.propertyManagerOrder.findFirst({
            where: { generatedFromRFQId: rfq.id },
            select: { id: true, orderNumber: true },
            orderBy: { createdAt: "desc" },
          });

          if (fallbackOrder) {
            const rfqAny = rfq as any;
            // Backfill generatedOrderId so future reads include the relation.
            if (!rfqAny.generatedOrderId) {
              await db.propertyManagerRFQ.update({
                where: { id: rfq.id },
                data: { generatedOrderId: fallbackOrder.id },
              });
            }

            rfq = {
              ...(rfq as any),
              generatedOrder: fallbackOrder,
              generatedOrderId: fallbackOrder.id,
            } as any;
          }
        }

        const shouldAttachContractorQuotation =
          (rfq.status === "RECEIVED" || rfq.status === "UNDER_REVIEW" || rfq.status === "APPROVED") &&
          !!rfq.propertyManager?.email;

        if (shouldAttachContractorQuotation) {
          const contractorQuotation = await db.quotation.findFirst({
            where: {
              status: { in: ["SENT_TO_CUSTOMER", "APPROVED", "REJECTED"] as any },
              OR: [
                // Preferred link: contractor fills in the RFQ number
                { clientReferenceQuoteNumber: rfq.rfqNumber },
                // Fallback link: email-based (legacy)
                { customerEmail: rfq.propertyManager.email },
              ],
            },
            include: {
              createdBy: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                  contractorCompanyName: true,
                },
              },
            },
            orderBy: {
              createdAt: "desc",
            },
          });

          return {
            ...rfq,
            contractorQuotation,
          };
        }
        return rfq;
      })
    );

    return rfqsWithQuotations;
  });
