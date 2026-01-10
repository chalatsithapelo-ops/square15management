import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateMilestone = baseProcedure
  .input(
    z.object({
      token: z.string(),
      milestoneId: z.number(),
      name: z.string().optional(),
      description: z.string().optional(),
      sequenceOrder: z.number().optional(),
      labourCost: z.number().optional(),
      materialCost: z.number().optional(),
      dieselCost: z.number().optional(),
      rentCost: z.number().optional(),
      adminCost: z.number().optional(),
      otherOperationalCost: z.number().optional(),
      expectedProfit: z.number().optional(),
      budgetAllocated: z.number().optional(),
      actualCost: z.number().optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      actualStartDate: z.string().optional(),
      actualEndDate: z.string().optional(),
      progressPercentage: z.number().min(0).max(100).optional(),
      status: z.enum(["PLANNING", "NOT_STARTED", "IN_PROGRESS", "ON_HOLD", "COMPLETED", "CANCELLED"]).optional(),
      assignedToId: z.number().optional(),
      notes: z.string().optional(),
      materials: z.array(z.object({
        name: z.string().min(1),
        description: z.string().optional(),
        quantity: z.number().min(0),
        unitPrice: z.number().min(0),
        supplier: z.string().optional(),
        supplierQuotationUrl: z.string().optional(),
        supplierQuotationAmount: z.number().optional(),
      })).optional(),
    })
  )
  .mutation(async ({ input }) => {
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

      // Check if milestone exists
      const milestone = await db.milestone.findUnique({
        where: { id: input.milestoneId },
      });

      if (!milestone) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Milestone not found",
        });
      }

      // Build update data
      const updateData: any = {};
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.sequenceOrder !== undefined) updateData.sequenceOrder = input.sequenceOrder;
      if (input.labourCost !== undefined) updateData.labourCost = input.labourCost;
      if (input.materialCost !== undefined) updateData.materialCost = input.materialCost;
      if (input.dieselCost !== undefined) updateData.dieselCost = input.dieselCost;
      if (input.rentCost !== undefined) updateData.rentCost = input.rentCost;
      if (input.adminCost !== undefined) updateData.adminCost = input.adminCost;
      if (input.otherOperationalCost !== undefined) updateData.otherOperationalCost = input.otherOperationalCost;
      if (input.expectedProfit !== undefined) updateData.expectedProfit = input.expectedProfit;
      if (input.budgetAllocated !== undefined) updateData.budgetAllocated = input.budgetAllocated;
      if (input.actualCost !== undefined) updateData.actualCost = input.actualCost;
      if (input.startDate !== undefined) updateData.startDate = input.startDate ? new Date(input.startDate) : null;
      if (input.endDate !== undefined) updateData.endDate = input.endDate ? new Date(input.endDate) : null;
      if (input.actualStartDate !== undefined) updateData.actualStartDate = input.actualStartDate ? new Date(input.actualStartDate) : null;
      if (input.actualEndDate !== undefined) updateData.actualEndDate = input.actualEndDate ? new Date(input.actualEndDate) : null;
      if (input.progressPercentage !== undefined) updateData.progressPercentage = input.progressPercentage;
      if (input.status !== undefined) updateData.status = input.status;
      if (input.assignedToId !== undefined) updateData.assignedToId = input.assignedToId;
      if (input.notes !== undefined) updateData.notes = input.notes;

      // If materials are provided, update them
      if (input.materials !== undefined) {
        // Delete existing materials
        await db.milestoneMaterial.deleteMany({
          where: { milestoneId: input.milestoneId },
        });
        
        // Create new materials
        if (input.materials.length > 0) {
          await db.milestoneMaterial.createMany({
            data: input.materials.map(material => ({
              milestoneId: input.milestoneId,
              name: material.name,
              description: material.description || null,
              quantity: material.quantity,
              unitPrice: material.unitPrice,
              totalCost: material.quantity * material.unitPrice,
              supplier: material.supplier || null,
              supplierQuotationUrl: material.supplierQuotationUrl || null,
              supplierQuotationAmount: material.supplierQuotationAmount || null,
            })),
          });
        }
      }

      const updatedMilestone = await db.milestone.update({
        where: { id: input.milestoneId },
        data: updateData,
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
          materials: true,
          weeklyUpdates: {
            orderBy: {
              weekStartDate: "desc",
            },
            take: 5,
          },
        },
      });

      return updatedMilestone;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
