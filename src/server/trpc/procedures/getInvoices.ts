import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getInvoices = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["DRAFT", "PENDING_REVIEW", "PENDING_APPROVAL", "SENT", "PAID", "OVERDUE", "CANCELLED", "REJECTED"]).nullable().optional(),
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
      
      // CRITICAL: Contractor Portal and Admin Portal are COMPLETELY SEPARATE
      // Invoices created in Contractor Portal must NEVER appear in Admin Portal
      // Invoices created in Admin Portal must NEVER appear in Contractor Portal
      
      if (user.role === "CONTRACTOR") {
        // Contractor Portal: ONLY show invoices created by this specific contractor
        where.createdById = user.id;
      } 
      else if (user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") {
        // Contractor Managers: Show invoices from THEIR COMPANY only.
        // NOTE: User model does not have `companyId`; use `contractorCompanyName` when available.
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

          where.createdById =
            companyContractorIds.length > 0 ? { in: companyContractorIds } : user.id;
        } else {
          // No company identifier; fall back to only their own invoices.
          where.createdById = user.id;
        }
      }
      else if (user.role === "CUSTOMER") {
        // Customers see invoices addressed to them
        where.customerEmail = user.email;
      }
      else if (user.role === "PROPERTY_MANAGER") {
        // Property Managers see invoices addressed to them (as customer)
        // BUT only invoices that have been approved and sent (not drafts or under review)
        where.customerEmail = user.email;
        // Only show invoices with status SENT, PAID, OVERDUE, or REJECTED
        // Exclude DRAFT, PENDING_REVIEW, PENDING_APPROVAL
        if (!input.status) {
          // If no status filter specified, only show finalized invoices
          where.status = { in: ["SENT", "PAID", "OVERDUE", "REJECTED"] };
        } else {
          // If a specific status is requested, only allow if it's a finalized status
          if (["SENT", "PAID", "OVERDUE", "REJECTED"].includes(input.status)) {
            where.status = input.status;
          } else {
            // Don't show draft/pending invoices - return empty
            where.status = "SENT"; // Use a valid status but add impossible condition
            where.id = -1; // This will return no results
          }
        }
      } 
      else {
        // Admin Portal users (ADMIN, SENIOR_ADMIN, JUNIOR_ADMIN, etc.)
        // EXCLUDE ALL contractor-created invoices
        const contractors = await db.user.findMany({
          where: {
            role: {
              in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"]
            }
          },
          select: { id: true },
        });
        const contractorIds = contractors.map(c => c.id);

        // Admin Portal: Exclude contractor-created invoices.
        // Also include auto-generated invoices that may have legacy `createdById: null`.
        const adminVisibilityFilter = contractorIds.length > 0
          ? {
              OR: [
                // Normal case: createdById is set and is not a contractor
                { createdById: { notIn: contractorIds, not: null } },
                // Legacy/auto-generated case: createdById is null but invoice is linked to an order
                {
                  AND: [
                    { createdById: null },
                    { orderId: { not: null } },
                    { notes: { contains: "Auto-generated invoice for completed order" } },
                  ],
                },
              ],
            }
          : {
              OR: [
                { createdById: { not: null } },
                {
                  AND: [
                    { createdById: null },
                    { orderId: { not: null } },
                    { notes: { contains: "Auto-generated invoice for completed order" } },
                  ],
                },
              ],
            };

        if (where.status) {
          where.AND = [{ status: where.status }, adminVisibilityFilter];
          delete where.status;
        } else {
          Object.assign(where, adminVisibilityFilter);
        }
      }

      const invoices = await db.invoice.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              orderNumber: true,
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
        orderBy: {
          createdAt: "desc",
        },
      });

      // Add default unitOfMeasure for backward compatibility
      return invoices.map((invoice) => {
        const items = Array.isArray(invoice.items) 
          ? invoice.items.map((item: any) => ({
              ...item,
              unitOfMeasure: item.unitOfMeasure || "Sum"
            }))
          : invoice.items;
        
        return {
          ...invoice,
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
