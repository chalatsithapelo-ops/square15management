import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const updateOrderDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      orderNumber: z.string().min(1).optional(),
      customerName: z.string().min(1).optional(),
      customerEmail: z.string().email().optional(),
      customerPhone: z.string().min(1).optional(),
      address: z.string().min(1).optional(),
      serviceType: z.string().min(1).optional(),
      description: z.string().min(1).optional(),
      assignedToId: z.number().nullable().optional(),
      callOutFee: z.number().optional(),
      labourRate: z.number().nullable().optional(),
      materialCost: z.number().optional(),
      labourCost: z.number().optional(),
      totalMaterialBudget: z.number().optional(),
      numLabourersNeeded: z.number().int().optional(),
      totalLabourCostBudget: z.number().optional(),
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
      z.object({ userId: z.number() }).parse(verified);

      // Get current order to calculate totalCost
      const currentOrder = await db.order.findUnique({
        where: { id: input.orderId },
      });

      if (!currentOrder) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      // If orderNumber is being updated, check for uniqueness
      if (input.orderNumber !== undefined && input.orderNumber !== currentOrder.orderNumber) {
        const existingOrder = await db.order.findUnique({
          where: { orderNumber: input.orderNumber },
        });

        if (existingOrder) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: `Order number "${input.orderNumber}" is already in use. Please choose a different number.`,
          });
        }
      }

      // Build update data object with only provided fields
      const updateData: any = {};

      if (input.orderNumber !== undefined) updateData.orderNumber = input.orderNumber;
      if (input.customerName !== undefined) updateData.customerName = input.customerName;
      if (input.customerEmail !== undefined) updateData.customerEmail = input.customerEmail;
      if (input.customerPhone !== undefined) updateData.customerPhone = input.customerPhone;
      if (input.address !== undefined) updateData.address = input.address;
      if (input.serviceType !== undefined) updateData.serviceType = input.serviceType;
      if (input.description !== undefined) updateData.description = input.description;
      if (input.assignedToId !== undefined) {
        updateData.assignedToId = input.assignedToId;
        // Auto-update status to ASSIGNED when an artisan is assigned
        if (input.assignedToId !== null && currentOrder.status === 'PENDING') {
          updateData.status = 'ASSIGNED';
        }
      }
      if (input.callOutFee !== undefined) updateData.callOutFee = input.callOutFee;
      if (input.labourRate !== undefined) updateData.labourRate = input.labourRate;
      if (input.materialCost !== undefined) updateData.materialCost = input.materialCost;
      if (input.labourCost !== undefined) updateData.labourCost = input.labourCost;
      if (input.totalMaterialBudget !== undefined) updateData.totalMaterialBudget = input.totalMaterialBudget;
      if (input.numLabourersNeeded !== undefined) updateData.numLabourersNeeded = input.numLabourersNeeded;
      if (input.totalLabourCostBudget !== undefined) updateData.totalLabourCostBudget = input.totalLabourCostBudget;
      if (input.notes !== undefined) updateData.notes = input.notes;

      // Recalculate total cost if any cost fields were updated
      const materialCost = input.materialCost !== undefined ? input.materialCost : currentOrder.materialCost;
      const labourCost = input.labourCost !== undefined ? input.labourCost : currentOrder.labourCost;
      const callOutFee = input.callOutFee !== undefined ? input.callOutFee : currentOrder.callOutFee;
      
      updateData.totalCost = materialCost + labourCost + callOutFee;

      // If materials are provided, update them
      if (input.materials !== undefined) {
        // Delete existing materials
        await db.material.deleteMany({
          where: { orderId: input.orderId },
        });
        
        // Create new materials
        if (input.materials.length > 0) {
          await db.material.createMany({
            data: input.materials.map(material => ({
              orderId: input.orderId,
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

      const order = await db.order.update({
        where: { id: input.orderId },
        data: updateData,
        include: {
          assignedTo: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
            },
          },
          materials: true,
          jobActivities: true,
        },
      });

      return order;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
