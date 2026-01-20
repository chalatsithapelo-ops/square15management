import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";

const tenantFeedbackTypeSchema = z.enum(["COMPLAINT", "COMPLEMENT"]);
const tenantFeedbackStatusSchema = z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]);

// NOTE: Prisma client typings in this workspace can lag behind `prisma generate`.
// Casting here avoids false-positive TS errors while keeping runtime behavior correct.
const prisma = db as any;

export const submitTenantFeedback = baseProcedure
  .input(
    z.object({
      token: z.string(),
      type: tenantFeedbackTypeSchema,
      category: z.string().min(2).max(60),
      message: z.string().min(10).max(5000),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only tenants can submit complaints and compliments.",
      });
    }

    const tenant = await db.propertyManagerCustomer.findFirst({
      where: { userId: user.id },
      select: {
        id: true,
        propertyManagerId: true,
        buildingId: true,
      },
    });

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant profile not found. Please ensure you are registered as a tenant.",
      });
    }

    return prisma.tenantFeedback.create({
      data: {
        customerId: tenant.id,
        propertyManagerId: tenant.propertyManagerId,
        buildingId: tenant.buildingId ?? undefined,
        type: input.type,
        category: input.category,
        message: input.message,
        status: "OPEN",
      },
    });
  });

export const getMyTenantFeedback = baseProcedure
  .input(
    z.object({
      token: z.string(),
      take: z.number().int().min(1).max(100).optional().default(20),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only tenants can view their complaints and compliments.",
      });
    }

    const tenant = await db.propertyManagerCustomer.findFirst({
      where: { userId: user.id },
      select: { id: true },
    });

    if (!tenant) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Tenant profile not found.",
      });
    }

    return prisma.tenantFeedback.findMany({
      where: { customerId: tenant.id },
      orderBy: { createdAt: "desc" },
      take: input.take,
    });
  });

export const getTenantFeedbackForPM = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: tenantFeedbackStatusSchema.optional(),
      type: tenantFeedbackTypeSchema.optional(),
      buildingId: z.number().optional(),
      category: z.string().min(1).max(60).optional(),
      take: z.number().int().min(1).max(200).optional().default(50),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view tenant feedback.",
      });
    }

    return prisma.tenantFeedback.findMany({
      where: {
        propertyManagerId: user.id,
        status: input.status,
        type: input.type,
        buildingId: input.buildingId,
        category: input.category,
      },
      include: {
        customer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            unitNumber: true,
            buildingName: true,
          },
        },
        building: {
          select: {
            id: true,
            name: true,
            address: true,
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: input.take,
    });
  });

export const updateTenantFeedbackStatus = baseProcedure
  .input(
    z.object({
      token: z.string(),
      id: z.number().int(),
      status: tenantFeedbackStatusSchema,
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can update tenant feedback.",
      });
    }

    const existing = await prisma.tenantFeedback.findUnique({
      where: { id: input.id },
      select: { id: true, propertyManagerId: true },
    });

    if (!existing || existing.propertyManagerId !== user.id) {
      throw new TRPCError({
        code: "NOT_FOUND",
        message: "Feedback item not found.",
      });
    }

    return prisma.tenantFeedback.update({
      where: { id: input.id },
      data: {
        status: input.status,
        resolvedAt: input.status === "RESOLVED" ? new Date() : null,
      },
    });
  });

export const getTenantFeedbackAnalyticsForPM = baseProcedure
  .input(
    z.object({
      token: z.string(),
      startDate: z.string().optional(),
      endDate: z.string().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "PROPERTY_MANAGER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only property managers can view feedback analytics.",
      });
    }

    const endDate = input.endDate ? new Date(input.endDate) : new Date();
    const startDate = input.startDate
      ? new Date(input.startDate)
      : new Date(endDate.getTime() - 90 * 24 * 60 * 60 * 1000);

    const feedback = await prisma.tenantFeedback.findMany({
      where: {
        propertyManagerId: user.id,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        type: true,
        category: true,
        status: true,
        buildingId: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });

    const buildings = await db.building.findMany({
      where: { propertyManagerId: user.id },
      select: { id: true, name: true },
    });

    const buildingNameById = new Map<number, string>(
      buildings.map((b) => [b.id, b.name])
    );

    const totals = {
      total: feedback.length,
      complaints: feedback.filter((f: any) => f.type === "COMPLAINT").length,
      complements: feedback.filter((f: any) => f.type === "COMPLEMENT").length,
      open: feedback.filter((f: any) => f.status === "OPEN").length,
      inProgress: feedback.filter((f: any) => f.status === "IN_PROGRESS").length,
      resolved: feedback.filter((f: any) => f.status === "RESOLVED").length,
    };

    const byCategoryMap = new Map<
      string,
      { category: string; complaints: number; complements: number; total: number }
    >();

    const byBuildingMap = new Map<
      number,
      {
        buildingId: number;
        buildingName: string;
        complaints: number;
        complements: number;
        total: number;
      }
    >();

    for (const item of feedback) {
      const categoryKey = item.category || "Uncategorized";
      const categoryRow = byCategoryMap.get(categoryKey) || {
        category: categoryKey,
        complaints: 0,
        complements: 0,
        total: 0,
      };
      categoryRow.total += 1;
      if (item.type === "COMPLAINT") categoryRow.complaints += 1;
      if (item.type === "COMPLEMENT") categoryRow.complements += 1;
      byCategoryMap.set(categoryKey, categoryRow);

      if (item.buildingId) {
        const buildingName = buildingNameById.get(item.buildingId) || "Unknown";
        const buildingRow = byBuildingMap.get(item.buildingId) || {
          buildingId: item.buildingId,
          buildingName,
          complaints: 0,
          complements: 0,
          total: 0,
        };
        buildingRow.total += 1;
        if (item.type === "COMPLAINT") buildingRow.complaints += 1;
        if (item.type === "COMPLEMENT") buildingRow.complements += 1;
        byBuildingMap.set(item.buildingId, buildingRow);
      }
    }

    const byCategory = Array.from(byCategoryMap.values()).sort(
      (a, b) => b.total - a.total
    );

    const byBuilding = Array.from(byBuildingMap.values()).sort(
      (a, b) => b.total - a.total
    );

    return {
      totals,
      byCategory,
      byBuilding,
      dateRange: {
        startDate,
        endDate,
      },
    };
  });
