import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getProjects = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PLANNING", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
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
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
