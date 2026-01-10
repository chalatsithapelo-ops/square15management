import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createMilestone = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      name: z.string().min(1),
      description: z.string().min(1),
      sequenceOrder: z.number(),
      labourCost: z.number().default(0),
      materialCost: z.number().default(0),
      dieselCost: z.number().default(0),
      rentCost: z.number().default(0),
      adminCost: z.number().default(0),
      otherOperationalCost: z.number().default(0),
      expectedProfit: z.number().default(0),
      budgetAllocated: z.number().default(0),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
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

      // Only admins can create milestones
      if (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can create milestones",
        });
      }

      // Verify project exists and get its current status
      const project = await db.project.findUnique({
        where: { id: input.projectId },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Determine initial milestone status based on project status
      // If project is IN_PROGRESS, create milestone as NOT_STARTED so artisans can start immediately
      // Otherwise, create as PLANNING
      let initialStatus: "PLANNING" | "NOT_STARTED" = "PLANNING";
      if (project.status === "IN_PROGRESS") {
        initialStatus = "NOT_STARTED";
      }

      const milestone = await db.milestone.create({
        data: {
          projectId: input.projectId,
          name: input.name,
          description: input.description,
          sequenceOrder: input.sequenceOrder,
          labourCost: input.labourCost,
          materialCost: input.materialCost,
          dieselCost: input.dieselCost,
          rentCost: input.rentCost,
          adminCost: input.adminCost,
          otherOperationalCost: input.otherOperationalCost,
          expectedProfit: input.expectedProfit,
          budgetAllocated: input.budgetAllocated,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          assignedToId: input.assignedToId || null,
          notes: input.notes || null,
          status: initialStatus,
          materials: input.materials ? {
            create: input.materials.map(material => ({
              name: material.name,
              description: material.description || null,
              quantity: material.quantity,
              unitPrice: material.unitPrice,
              totalCost: material.quantity * material.unitPrice,
              supplier: material.supplier || null,
              supplierQuotationUrl: material.supplierQuotationUrl || null,
              supplierQuotationAmount: material.supplierQuotationAmount || null,
            }))
          } : undefined,
        },
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          materials: true,
        },
      });

      return milestone;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
