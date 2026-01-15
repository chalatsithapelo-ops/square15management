import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

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
      const user = await authenticateUser(input.token);

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
          const existingCustomerUser = await db.user.findFirst({
            where: {
              email: {
                equals: input.customerEmail,
                mode: "insensitive",
              },
              role: "CUSTOMER",
            },
            select: {
              id: true,
              customerProfile: {
                select: {
                  propertyManagerId: true,
                },
              },
            },
          });

          if (
            existingCustomerUser?.customerProfile &&
            existingCustomerUser.customerProfile.propertyManagerId !== user.id
          ) {
            throw new TRPCError({
              code: "FORBIDDEN",
              message: "This customer is managed by a different property manager",
            });
          }

          const [firstNameRaw, ...rest] = input.customerName.trim().split(/\s+/);
          const firstName = firstNameRaw || "Customer";
          const lastName = rest.join(" ") || "";

          await db.propertyManagerCustomer.create({
            data: {
              propertyManagerId: user.id,
              userId: existingCustomerUser?.id ?? null,
              firstName,
              lastName,
              email: input.customerEmail,
              phone: input.customerPhone || null,
              address: input.address,
              onboardingStatus: "PENDING",
              status: "PENDING",
            },
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
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to create project",
      });
    }
  });
