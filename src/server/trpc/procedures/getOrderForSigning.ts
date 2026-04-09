import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { publicProcedure } from "~/server/trpc/main";

export const getOrderForSigning = publicProcedure
  .input(
    z.object({
      signatureToken: z.string().min(1),
    })
  )
  .query(async ({ input }) => {
    // Try regular order first
    let order = await db.order.findUnique({
      where: { signatureRequestToken: input.signatureToken },
      select: {
        id: true,
        orderNumber: true,
        customerName: true,
        address: true,
        serviceType: true,
        description: true,
        status: true,
        signedJobCardUrl: true,
        clientRepName: true,
        clientRepSignDate: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (order) {
      if (order.signedJobCardUrl) {
        return {
          alreadySigned: true,
          isPMOrder: false,
          order: {
            orderNumber: order.orderNumber,
            customerName: order.customerName,
            clientRepName: order.clientRepName,
            clientRepSignDate: order.clientRepSignDate,
          },
        };
      }
      return {
        alreadySigned: false,
        isPMOrder: false,
        order: {
          id: order.id,
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          address: order.address,
          serviceType: order.serviceType,
          description: order.description,
          artisanName: order.assignedTo
            ? `${order.assignedTo.firstName} ${order.assignedTo.lastName}`
            : undefined,
          startTime: order.startTime,
          endTime: order.endTime,
          createdAt: order.createdAt,
        },
      };
    }

    // Try PM order
    let pmOrder = await db.propertyManagerOrder.findUnique({
      where: { signatureRequestToken: input.signatureToken },
      select: {
        id: true,
        orderNumber: true,
        buildingName: true,
        buildingAddress: true,
        serviceType: true,
        description: true,
        status: true,
        signedJobCardUrl: true,
        clientRepName: true,
        clientRepSignDate: true,
        startTime: true,
        endTime: true,
        createdAt: true,
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    if (pmOrder) {
      if (pmOrder.signedJobCardUrl) {
        return {
          alreadySigned: true,
          isPMOrder: true,
          order: {
            orderNumber: pmOrder.orderNumber,
            customerName: pmOrder.buildingName || "Building Manager",
            clientRepName: pmOrder.clientRepName,
            clientRepSignDate: pmOrder.clientRepSignDate,
          },
        };
      }
      return {
        alreadySigned: false,
        isPMOrder: true,
        order: {
          id: pmOrder.id,
          orderNumber: pmOrder.orderNumber,
          customerName: pmOrder.buildingName || "Building Manager",
          address: pmOrder.buildingAddress,
          serviceType: pmOrder.serviceType,
          description: pmOrder.description,
          artisanName: pmOrder.assignedTo
            ? `${pmOrder.assignedTo.firstName} ${pmOrder.assignedTo.lastName}`
            : undefined,
          startTime: pmOrder.startTime,
          endTime: pmOrder.endTime,
          createdAt: pmOrder.createdAt,
        },
      };
    }

    throw new TRPCError({
      code: "NOT_FOUND",
      message: "Invalid or expired signature request link",
    });
  });
