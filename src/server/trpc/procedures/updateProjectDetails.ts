import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateProjectDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      projectId: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      customerName: z.string().min(1).optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      projectType: z.string().min(1).optional(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      estimatedBudget: z.number().optional(),
      assignedToId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      z.object({ userId: z.number() }).parse(verified);

      // Check if project exists
      const existingProject = await db.project.findUnique({
        where: { id: input.projectId },
      });

      if (!existingProject) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Project not found",
        });
      }

      // Build update data object with only provided fields
      const updateData: any = {};
      
      if (input.name !== undefined) updateData.name = input.name;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.projectType !== undefined) updateData.projectType = input.projectType;
      if (input.startDate !== undefined) {
        updateData.startDate = input.startDate ? new Date(input.startDate) : null;
      }
      if (input.endDate !== undefined) {
        updateData.endDate = input.endDate ? new Date(input.endDate) : null;
      }
      if (input.estimatedBudget !== undefined) {
        updateData.estimatedBudget = input.estimatedBudget || null;
      }
      if (input.assignedToId !== undefined) {
        updateData.assignedToId = input.assignedToId || null;
      }

      // Update the project
      const project = await db.project.update({
        where: { id: input.projectId },
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
        },
      });

      return project;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
