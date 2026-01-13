import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getOrders = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PENDING", "ASSIGNED", "IN_PROGRESS", "COMPLETED", "CANCELLED"]).optional(),
      assignedToId: z.number().optional(),
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
      
      if (input.assignedToId) {
        where.assignedToId = input.assignedToId;
      } else if (isContractorRole) {
        // User model does not have `companyId`; fall back to strictly own assignments.
        where.assignedToId = user.id;
      } else if (user.role === "ARTISAN") {
        // Artisans can only see their own orders
        where.assignedToId = user.id;
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
      } else if (user.role === "ADMIN" || user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN") {
        // Admins can view regular orders.
        // Note: Property Manager orders live in `PropertyManagerOrder` (separate table),
        // so there is no need to filter the `Order` table by any `propertyManagerId` field.
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
          notes: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN" || (user.role === "ARTISAN" && where.assignedToId === user.id),
          assignedToId: true,
          leadId: true,
          startTime: true,
          endTime: true,
          materialCost: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
          labourCost: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
          labourRate: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
          callOutFee: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
          totalCost: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
          totalMaterialBudget: true,
          numLabourersNeeded: true,
          totalLabourCostBudget: true,
          beforePictures: true,
          afterPictures: true,
          contractorSlipUrls: true,
          signedJobCardUrl: true,
          documents: true,
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
              phone: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN",
            },
          },
          materials: true,
          jobActivities: true,
          expenseSlips: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN" || user.role === "ARTISAN",
          invoice: user.role === "SENIOR_ADMIN" || user.role === "JUNIOR_ADMIN" ? {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
            }
          } : false,
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
