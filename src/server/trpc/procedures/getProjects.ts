import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { isRestrictedDemoAccount } from "~/server/utils/demoAccounts";

export const getProjects = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
    })
  )
  .query(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);

      // Demo accounts should not see production data
      if (isRestrictedDemoAccount(user)) {
        return [];
      }

      const where: any = {};
      
      if (input.status) {
        where.status = input.status;
      }
      
      // CRITICAL: Separate Contractor Portal and Admin Portal data
      const isContractorRole = user.role === "CONTRACTOR" || 
                              user.role === "CONTRACTOR_SENIOR_MANAGER" || 
                              user.role === "CONTRACTOR_JUNIOR_MANAGER";
      
      if (isContractorRole) {
        // Contractor Portal: Show contractor-managed projects
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

          where.assignedToId =
            companyContractorIds.length > 0
              ? { in: companyContractorIds }
              : user.id;
        } else {
          where.assignedToId = user.id;
        }
      } else if (user.role === "CUSTOMER") {
        where.customerEmail = user.email;
      } else if (user.role === "PROPERTY_MANAGER") {
        const customers = await db.propertyManagerCustomer.findMany({
          where: {
            propertyManagerId: user.id,
          },
          select: {
            email: true,
          },
        });

        const customerEmails = customers
          .map((c) => c.email?.trim())
          .filter((e): e is string => !!e);

        // If no managed tenants yet, return no projects.
        if (customerEmails.length === 0) {
          return [];
        }

        where.customerEmail = {
          in: customerEmails,
          mode: "insensitive",
        };
      } else {
        // Admin Portal: Exclude contractor-managed projects
        const contractors = await db.user.findMany({
          where: {
            role: {
              in: ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER"],
            },
          },
          select: { id: true },
        });
        const contractorIds = contractors.map((c) => c.id);

        // Exclude projects assigned to contractors.
        if (contractorIds.length > 0) {
          where.OR = [
            { assignedToId: null },
            { assignedToId: { notIn: contractorIds } },
          ];
        }
      }

      const projects = await db.project.findMany({
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
          milestones: {
            include: {
              assignedTo: {
                select: {
                  id: true,
                  firstName: true,
                  lastName: true,
                  email: true,
                },
              },
              supplierQuotations: true,
              weeklyUpdates: {
                orderBy: {
                  weekStartDate: "desc",
                },
                take: 1,
              },
              paymentRequests: {
                include: {
                  artisan: {
                    select: {
                      id: true,
                      firstName: true,
                      lastName: true,
                    },
                  },
                },
              },
              risks: {
                where: {
                  status: "OPEN",
                },
              },
              changeOrders: {
                where: {
                  status: "PENDING",
                },
              },
            },
            orderBy: {
              sequenceOrder: "asc",
            },
          },
          changeOrders: {
            where: {
              status: "PENDING",
            },
            orderBy: {
              createdAt: "desc",
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return projects;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch projects",
      });
    }
  });
