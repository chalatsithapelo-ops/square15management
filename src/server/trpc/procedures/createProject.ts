import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const createProject = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1),
      description: z.string().min(1),
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(1),
      address: z.string().min(1),
      projectType: z.string().min(1),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
      estimatedBudget: z.number().optional(),
      assignedToId: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "User not found",
        });
      }

      if (user.role === "PROPERTY_MANAGER") {
        const managesCustomer = await db.propertyManagerCustomer.findFirst({
          where: {
            propertyManagerId: user.id,
            email: {
              equals: input.customerEmail,
              mode: "insensitive",
            },
          },
          select: { id: true },
        });

        if (!managesCustomer) {
          throw new TRPCError({
            code: "FORBIDDEN",
            message: "You can only create projects for tenants you manage",
          });
        }
      }

      // Generate unique project number
      const count = await db.project.count();
      const projectNumber = `PRJ-${String(count + 1).padStart(5, "0")}`;

      const project = await db.project.create({
        data: {
          projectNumber,
          name: input.name,
          description: input.description,
          customerName: input.customerName,
          customerEmail: input.customerEmail,
          customerPhone: input.customerPhone,
          address: input.address,
          projectType: input.projectType,
          startDate: input.startDate ? new Date(input.startDate) : null,
          endDate: input.endDate ? new Date(input.endDate) : null,
          estimatedBudget: input.estimatedBudget || null,
          assignedToId: input.assignedToId || null,
          status: "PLANNING",
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

      return project;
    } catch (error) {
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
