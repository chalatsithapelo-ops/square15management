import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { applyDemoIsolation } from "~/server/utils/demoAccounts";
import {
  portfolioMineWhereForDoc,
  unassignedDocWhere,
} from "~/server/services/portfolioOwnership";

export const getOrders = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum([
        "SELF_INITIATED",
        "AWAITING_ORDER_NUMBER",
        "PENDING_REVIEW",
        "PENDING",
        "ASSIGNED",
        "IN_PROGRESS",
        "COMPLETED",
        "CANCELLED",
      ]).optional(),
      assignedToId: z.number().optional(),
      scope: z.enum(["MINE", "ALL", "UNASSIGNED"]).optional(),
      ownerId: z.number().optional(),
    })
  )
  .query(async ({ input }) => {
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

      const where: any = {};
      
      if (input.status) {
        where.status = input.status;
      }
      
      // Check if user is any contractor role
      const isContractorRole = user.role === "CONTRACTOR" || 
                              user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                              user.role === "CONTRACTOR_JUNIOR_MANAGER";

      // Admin-tier roles that should see the full Order data set incl. invoice linkage and costs.
      // TECHNICAL_MANAGER is an internal admin-tier role that participates in the operational
      // workflow (job dispatch & invoicing) — must be treated like JUNIOR_ADMIN here.
      const isAdminTier = user.role === "SENIOR_ADMIN" ||
                          user.role === "JUNIOR_ADMIN" ||
                          user.role === "ADMIN" ||
                          user.role === "TECHNICAL_MANAGER" ||
                          user.role === "MANAGER";

      if (input.assignedToId) {
        where.assignedToId = input.assignedToId;
      } else if (user.role === "CONTRACTOR") {
        // Individual contractors: their own assignments PLUS crew memberships
        // (they can join other jobs via the 6-digit join code just like ARTISANs).
        where.OR = [
          { assignedToId: user.id },
          { crew: { some: { userId: user.id, leftAt: null } } },
        ];
      } else if (isContractorRole) {
        // CONTRACTOR_SENIOR_MANAGER / CONTRACTOR_JUNIOR_MANAGER — company managers,
        // don't join crews personally, keep strict own-assignments.
        where.assignedToId = user.id;
      } else if (user.role === "ARTISAN") {
        // PR-6: artisan sees jobs assigned to them OR jobs they're an active crew member on
        where.OR = [
          { assignedToId: user.id },
          { crew: { some: { userId: user.id, leftAt: null } } },
        ];
      } else if (user.role === "CUSTOMER") {
        // Customers can only see orders with their email
        where.customerEmail = user.email;
      } else if (user.role === "PROPERTY_MANAGER") {
        // Property Managers see orders for contractors they manage
        // They can see orders assigned to contractors they created
        const propertyManagerContractors = await db.contractor.findMany({
          where: { propertyManagerId: user.id },
          select: { email: true },
        });
        const contractorEmails = propertyManagerContractors.map(c => c.email);
        
        if (contractorEmails.length > 0) {
          // Find User IDs for these contractor emails
          const contractorUsers = await db.user.findMany({
            where: { email: { in: contractorEmails } },
            select: { id: true },
          });
          const contractorUserIds = contractorUsers.map(u => u.id);
          
          if (contractorUserIds.length > 0) {
            where.assignedToId = { in: contractorUserIds };
          } else {
            where.id = -1; // Match nothing
          }
        } else {
          // Property manager has no contractors yet
          where.id = -1; // Match nothing
        }
      } else if (user.role === "ADMIN" || user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN" || user.role === "TECHNICAL_MANAGER" || user.role === "MANAGER") {
        // Admins (incl. Technical Manager / Manager) can view all regular orders.
        // Note: Property Manager orders live in `PropertyManagerOrder` (separate table),
        // so there is no need to filter the `Order` table by any `propertyManagerId` field.
      }

      // Demo data isolation
      await applyDemoIsolation(where, user, db, 'assignedToId');

      // ─── PR-9 portfolio scope for admin-tier users ────────────────────
      if (isAdminTier) {
        const scope =
          input.scope ??
          ((user as any).defaultPortfolioView === "MINE" ? "MINE" : "ALL");
        if (scope === "MINE") {
          const targetUserId = input.ownerId ?? user.id;
          const mine = await portfolioMineWhereForDoc(targetUserId);
          where.AND = [...(where.AND ?? []), mine];
        } else if (scope === "UNASSIGNED") {
          where.AND = [...(where.AND ?? []), unassignedDocWhere()];
        } else if (input.ownerId) {
          const mine = await portfolioMineWhereForDoc(input.ownerId);
          where.AND = [...(where.AND ?? []), mine];
        }
      }

      const orders = await db.order.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          updatedAt: true,
          orderNumber: true,
          customerName: true,
          customerEmail: true,
          customerPhone: true,
          address: true,
          serviceType: true,
          description: true,
          status: true,
          isPaused: true,
          pausedAt: true,
          slaHours: true,
          slaStartedAt: true,
          slaDueAt: true,
          notes: isAdminTier || user.role === "ARTISAN",
          assignedToId: true,
          leadId: true,
          startTime: true,
          endTime: true,
          materialCost: isAdminTier || user.role === "ARTISAN",
          labourCost: isAdminTier,
          labourRate: isAdminTier,
          callOutFee: isAdminTier,
          totalCost: isAdminTier,
          totalMaterialBudget: true,
          numLabourersNeeded: true,
          totalLabourCostBudget: true,
          beforePictures: true,
          afterPictures: true,
          contractorSlipUrls: true,
          signedJobCardUrl: true,
          clientRepName: true,
          clientRepSignDate: true,
          clientUnavailableToSign: true,
          artisanSignatureUrl: true,
          artisanSignedByName: true,
          artisanSignDate: true,
          // Surfaced so UI can show "Link sent" status / disable duplicate sends.
          signatureRequestToken: true,
          signatureRequestSentAt: true,
          documents: true,
          // Self-initiated (artisan-started) flow markers — surfaced on the
          // admin Operations view so these jobs follow the normal route with
          // clear badges (self-initiated, missing PO#, awaiting review).
          selfInitiated: true,
          clientOrderNumber: true,
          orderNumberStatus: true,
          noOrderReason: true,
          adminReviewedAt: isAdminTier,
          selfInitiatedRejected: isAdminTier,
          selfInitiatedRejectReason: isAdminTier,
          invoicingBlockers: isAdminTier,
          initiatedBy: isAdminTier ? {
            select: { id: true, firstName: true, lastName: true, email: true },
          } : false,
          draftPaymentType: user.role === "ARTISAN",
          draftHoursWorked: user.role === "ARTISAN",
          draftDaysWorked: user.role === "ARTISAN",
          draftHourlyRate: user.role === "ARTISAN",
          draftDailyRate: user.role === "ARTISAN",
          draftPaymentNotes: user.role === "ARTISAN",
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: isAdminTier,
              phone: isAdminTier,
            },
          },
          materials: true,
          jobActivities: true,
          expenseSlips: isAdminTier || user.role === "ARTISAN",
          invoice: isAdminTier || isContractorRole ? {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              paidDate: true,
              dueDate: true,
              total: true,
            }
          } : false,
          quotation: {
            select: {
              id: true,
              quoteNumber: true,
              status: true,
              total: true,
              // PR-QF — include line items + deposit so the admin invoice
              // form can pre-populate directly from the accepted quote when
              // the client's PO comes in. Also allows the "Ready for
              // Invoicing" card to show the quoted amount.
              items: true,
              depositRequestedPercent: true,
              depositRequestedAmount: true,
              validUntil: true,
            },
          },
          client: {
            select: {
              id: true,
              name: true,
              companyName: true,
            },
          },
          clientBuilding: {
            select: {
              id: true,
              name: true,
              address: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // For artisans, also fetch PropertyManagerOrders assigned to them
      let pmOrders: any[] = [];
      if (user.role === "ARTISAN") {
        pmOrders = await db.propertyManagerOrder.findMany({
          where: {
            assignedToId: user.id,
            ...(input.status ? { status: input.status } : {}),
          },
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
            contractor: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            assignedTo: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
              },
            },
            progressUpdates: {
              orderBy: {
                createdAt: "desc",
              },
              take: 5,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
        });

        // Normalize PM orders to match regular order structure
        pmOrders = pmOrders.map((pmOrder) => ({
          ...pmOrder,
          orderNumber: pmOrder.orderNumber || `PM-${pmOrder.id}`,
          customerName: pmOrder.propertyManager?.firstName && pmOrder.propertyManager?.lastName
            ? `${pmOrder.propertyManager.firstName} ${pmOrder.propertyManager.lastName}`
            : "Property Manager",
          customerEmail: pmOrder.propertyManager?.email || "",
          customerPhone: pmOrder.propertyManager?.phone || "",
          serviceType: pmOrder.serviceCategory || "GENERAL",
          totalMaterialBudget: pmOrder.estimatedCost || 0,
          isPMOrder: true, // Flag to identify PM orders
        }));
      }

      return [...orders, ...pmOrders];
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
