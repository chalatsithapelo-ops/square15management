import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { isRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const getQuotations = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum([
        "DRAFT",
        "PENDING_ARTISAN_REVIEW",
        "IN_PROGRESS",
        "PENDING_JUNIOR_MANAGER_REVIEW",
        "PENDING_SENIOR_MANAGER_REVIEW",
        "APPROVED",
        "SENT_TO_CUSTOMER",
        "REJECTED",
        "SUBMITTED" // Deprecated
      ]).nullable().optional(),
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

      // Demo accounts should not see production data
      if (isRestrictedDemoAccount(user)) {
        return [];
      }

      const where: any = {};
      const portalFilters: any[] = [];
      
      if (input.status) {
        where.status = input.status;
      }
      
      // Check if user is any contractor role
      const isContractorRole = user.role === "CONTRACTOR" || 
                              user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                              user.role === "CONTRACTOR_JUNIOR_MANAGER";
      
      if (isContractorRole) {
        // Contractors/managers see ONLY quotations created by contractor company users.
        // This ensures complete separation between contractor and admin portals.
        const contractorCompanyName = user.contractorCompanyName?.trim();

        if (contractorCompanyName) {
          const companyContractors = await db.user.findMany({
            where: {
              contractorCompanyName,
              role: {
                in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"],
              },
            },
            select: { id: true },
          });
          const companyContractorIds = companyContractors.map((c) => c.id);
          const ids = companyContractorIds.length > 0 ? companyContractorIds : [user.id];
          
          // ONLY show quotations created by contractor company users
          where.createdById = { in: ids };
        } else {
          // No company identifier; show only own records
          where.createdById = user.id;
        }
      } else if (user.role === "CUSTOMER") {
        where.customerEmail = user.email;
      } else if (user.role === "ARTISAN") {
        // Artisans can only see quotations assigned to them
        where.assignedToId = user.id;
      } else {
        // For Admin portal users (ADMIN, SENIOR_ADMIN, JUNIOR_ADMIN)
        // Show ONLY quotations created by admin users or system (null)
        // Explicitly EXCLUDE all contractor-created quotations
        const contractors = await db.user.findMany({
          where: {
            role: {
              in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"],
            },
          },
          select: { id: true },
        });
        const contractorIds = contractors.map((c) => c.id);

        if (contractorIds.length > 0) {
          // Exclude ALL quotations created by contractors.
          // Only show quotations with null createdById (system/admin-created)
          where.AND = [
            {
              OR: [
                { createdById: null },
                { createdById: { notIn: contractorIds } },
              ],
            },
          ];
        }
        // If no contractors exist, show all quotations
      }

      const quotations = await db.quotation.findMany({
        where,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
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
          expenseSlips: true,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      // Filter out sensitive cost data for CUSTOMER role.
      // NOTE: Artisans need access to their quotation assessment fields (line items, labour/duration, slips)
      // in order to edit/resubmit a quotation.
      const shouldRedactCosts = user.role === "CUSTOMER";
      
      if (shouldRedactCosts) {
        return quotations.map((quotation) => {
          const { 
            companyMaterialCost, 
            companyLabourCost, 
            estimatedProfit, 
            labourRate,
            numPeopleNeeded,
            estimatedDuration,
            durationUnit,
            quotationLineItems,
            ...rest 
          } = quotation;
          
          // Add default unitOfMeasure for backward compatibility
          const items = Array.isArray(rest.items) 
            ? rest.items.map((item: any) => ({
                ...item,
                unitOfMeasure: item.unitOfMeasure || "Sum"
              }))
            : rest.items;
          
          return {
            ...rest,
            items
          };
        });
      }

      // Add default unitOfMeasure for backward compatibility
      return quotations.map((quotation) => {
        const items = Array.isArray(quotation.items) 
          ? quotation.items.map((item: any) => ({
              ...item,
              unitOfMeasure: item.unitOfMeasure || "Sum"
            }))
          : quotation.items;
        
        return {
          ...quotation,
          items
        };
      });
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
