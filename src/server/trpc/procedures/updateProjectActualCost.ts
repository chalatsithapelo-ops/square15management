import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { assertCanAccessProject } from "~/server/utils/project-access";
import { authenticateUser } from "~/server/utils/auth";

export const updateProjectActualCost = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const user = await authenticateUser(input.token);

      // Check if project exists
      const project = await db.project.findUnique({
        where: { id: input.projectId },
      });

      if (!project) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Enforce role/ownership access to the project
      await assertCanAccessProject(user, input.projectId);

      // Only admins can update project costs
      if (user.role !== "SENIOR_ADMIN" && user.role !== "ADMIN" && user.role !== "PROPERTY_MANAGER") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only administrators can update project costs",
        });
      }

      // Calculate actual costs from related records
      
      // 1. Get all quotations for this project (only approved/completed ones count)
      const quotations = await db.quotation.findMany({
        where: {
          projectId: input.projectId,
          status: {
            in: ["APPROVED"],
          },
        },
      });

      const quotationCosts = quotations.reduce((sum, q) => sum + q.total, 0);

      // 2. Get all invoices for this project (only paid ones count as actual cost)
      const invoices = await db.invoice.findMany({
        where: {
          projectId: input.projectId,
          status: "PAID",
        },
      });

      const invoiceCosts = invoices.reduce((sum, i) => sum + i.total, 0);

      // 3. Get all milestones for this project and sum their actual costs
      const milestones = await db.milestone.findMany({
        where: {
          projectId: input.projectId,
        },
      });

      const milestoneCosts = milestones.reduce((sum, m) => sum + (m.actualCost || 0), 0);

      // Calculate total actual cost
      const actualCost = quotationCosts + invoiceCosts + milestoneCosts;

      // Update project
      const updatedProject = await db.project.update({
        where: { id: input.projectId },
        data: {
          actualCost,
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
        },
      });

      return {
        project: updatedProject,
        breakdown: {
          quotationCosts,
          invoiceCosts,
          milestoneCosts,
          totalActualCost: actualCost,
          estimatedBudget: project.estimatedBudget || 0,
          variance:
            project.estimatedBudget !== null
              ? actualCost - project.estimatedBudget
              : null,
          variancePercentage:
            project.estimatedBudget && project.estimatedBudget > 0
              ? ((actualCost - project.estimatedBudget) / project.estimatedBudget) * 100
              : null,
        },
      };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
