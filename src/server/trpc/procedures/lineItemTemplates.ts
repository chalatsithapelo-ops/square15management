import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const ALLOWED_ROLES = [
  "JUNIOR_ADMIN",
  "SENIOR_ADMIN",
  "TECHNICAL_MANAGER",
  "MANAGER",
  "CONTRACTOR",
  "CONTRACTOR_SENIOR_MANAGER",
  "CONTRACTOR_JUNIOR_MANAGER",
];

function ensureAccess(role: string) {
  if (!ALLOWED_ROLES.includes(role)) {
    throw new TRPCError({
      code: "FORBIDDEN",
      message: "You do not have permission to manage line item templates.",
    });
  }
}

export const getLineItemTemplates = baseProcedure
  .input(
    z.object({
      token: z.string(),
      includeInactive: z.boolean().optional(),
      category: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    const templates = await db.lineItemTemplate.findMany({
      where: {
        ...(input.includeInactive ? {} : { isActive: true }),
        ...(input.category ? { category: input.category } : {}),
      },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });

    return templates;
  });

export const createLineItemTemplate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      name: z.string().min(1),
      description: z.string().min(1),
      unitPrice: z.number().nonnegative(),
      unitOfMeasure: z.string().default("Sum"),
      category: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    return db.lineItemTemplate.create({
      data: {
        name: input.name,
        description: input.description,
        unitPrice: input.unitPrice,
        unitOfMeasure: input.unitOfMeasure || "Sum",
        category: input.category || null,
        createdById: user.id,
      },
    });
  });

export const updateLineItemTemplate = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number(),
      name: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      unitPrice: z.number().nonnegative().optional(),
      unitOfMeasure: z.string().optional(),
      category: z.string().nullable().optional(),
      isActive: z.boolean().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    const { token: _t, id, ...rest } = input;
    return db.lineItemTemplate.update({
      where: { id },
      data: rest,
    });
  });

export const deleteLineItemTemplate = baseProcedure
  .input(z.object({ token: z.string(), id: z.number() }))
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);
    ensureAccess(user.role);

    await db.lineItemTemplate.delete({ where: { id: input.id } });
    return { success: true };
  });
