import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";
import { SlipCategory } from "@prisma/client";

export const updateCompletedOrderDetails = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderId: z.number(),
      afterPictures: z.array(z.string()).optional(),
      signedJobCardUrl: z.string().optional(),
      clientRepName: z.string().optional(),
      clientRepSignDate: z.string().datetime().optional(),
      materialCost: z.number().optional(),
      expenseSlips: z.array(z.object({
        url: z.string(),
        category: z.nativeEnum(SlipCategory),
        description: z.string().optional(),
        amount: z.number().optional(),
      })).optional(),
      // Payment request update fields
      paymentRequestId: z.number().optional(),
      hoursWorked: z.number().optional(),
      daysWorked: z.number().optional(),
      hourlyRate: z.number().optional(),
      dailyRate: z.number().optional(),
      paymentNotes: z.string().optional(),
    })
  )
  .mutation(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      // Verify the order exists and is completed
      const order = await db.order.findUnique({
        where: { id: input.orderId },
        include: {
          assignedTo: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: "NOT_FOUND",
          message: "Order not found",
        });
      }

      if (order.status !== "COMPLETED") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Can only update details of completed orders",
        });
      }

      // Verify the user is the assigned artisan
      if (order.assignedToId !== parsed.userId) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "You can only update your own completed jobs",
        });
      }

      const updateData: any = {};

      // Update order fields if provided
      if (input.afterPictures !== undefined) {
        if (input.afterPictures.length < 3) {
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "At least 3 after pictures are required",
          });
        }
        updateData.afterPictures = input.afterPictures;
      }

      if (input.signedJobCardUrl !== undefined) {
        updateData.signedJobCardUrl = input.signedJobCardUrl;
      }

      if (input.clientRepName !== undefined) {
        updateData.clientRepName = input.clientRepName;
      }

      if (input.clientRepSignDate !== undefined) {
        updateData.clientRepSignDate = new Date(input.clientRepSignDate);
      }

      if (input.materialCost !== undefined) {
        updateData.materialCost = input.materialCost;
        // Recalculate total cost
        updateData.totalCost = input.materialCost + order.labourCost + order.callOutFee;
      }

      // Update expense slips if provided
      if (input.expenseSlips !== undefined) {
        // Delete existing expense slips for this order
        await db.expenseSlip.deleteMany({
          where: { orderId: input.orderId },
        });

        // Create new expense slips
        if (input.expenseSlips.length > 0) {
          await db.expenseSlip.createMany({
            data: input.expenseSlips.map((slip) => ({
              orderId: input.orderId,
              url: slip.url,
              category: slip.category,
              description: slip.description,
              amount: slip.amount,
            })),
          });

          // If materialCost is not explicitly provided, calculate it from expense slips
          if (input.materialCost === undefined) {
            const totalFromSlips = input.expenseSlips.reduce(
              (sum, slip) => sum + (slip.amount || 0),
              0
            );
            if (totalFromSlips > 0) {
              updateData.materialCost = totalFromSlips;
              updateData.totalCost = totalFromSlips + order.labourCost + order.callOutFee;
            }
          }
        }
      }

      // Update the order
      const updatedOrder = await db.order.update({
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
          expenseSlips: true,
        },
      });

      // Update payment request if payment details are provided
      if (input.paymentRequestId) {
        const paymentUpdateData: any = {};
        
        if (input.hoursWorked !== undefined) {
          paymentUpdateData.hoursWorked = input.hoursWorked;
        }
        
        if (input.daysWorked !== undefined) {
          paymentUpdateData.daysWorked = input.daysWorked;
        }
        
        if (input.hourlyRate !== undefined) {
          paymentUpdateData.hourlyRate = input.hourlyRate;
        }
        
        if (input.dailyRate !== undefined) {
          paymentUpdateData.dailyRate = input.dailyRate;
        }
        
        if (input.paymentNotes !== undefined) {
          paymentUpdateData.notes = input.paymentNotes;
        }

        // Recalculate amount if rate or time changed
        if (input.hoursWorked !== undefined || input.hourlyRate !== undefined || 
            input.daysWorked !== undefined || input.dailyRate !== undefined) {
          const paymentRequest = await db.paymentRequest.findUnique({
            where: { id: input.paymentRequestId },
          });

          if (paymentRequest) {
            const hours = input.hoursWorked ?? paymentRequest.hoursWorked ?? 0;
            const days = input.daysWorked ?? paymentRequest.daysWorked ?? 0;
            const hRate = input.hourlyRate ?? paymentRequest.hourlyRate ?? 0;
            const dRate = input.dailyRate ?? paymentRequest.dailyRate ?? 0;

            if (hours > 0 && hRate > 0) {
              paymentUpdateData.calculatedAmount = hours * hRate;
            } else if (days > 0 && dRate > 0) {
              paymentUpdateData.calculatedAmount = days * dRate;
            }
          }
        }

        if (Object.keys(paymentUpdateData).length > 0) {
          await db.paymentRequest.update({
            where: { id: input.paymentRequestId },
            data: paymentUpdateData,
          });
        }
      }

      // Update the associated invoice if it exists
      if (updateData.materialCost !== undefined || updateData.totalCost !== undefined) {
        const invoice = await db.invoice.findFirst({
          where: { orderId: input.orderId },
        });

        if (invoice) {
          const newSubtotal = updateData.totalCost ?? updatedOrder.totalCost;
          const newTax = newSubtotal * 0.15;
          const newTotal = newSubtotal + newTax;

          await db.invoice.update({
            where: { id: invoice.id },
            data: {
              subtotal: newSubtotal,
              tax: newTax,
              total: newTotal,
              companyMaterialCost: updateData.materialCost ?? updatedOrder.materialCost,
              estimatedProfit: newTotal - (updateData.materialCost ?? updatedOrder.materialCost) - updatedOrder.labourCost,
            },
          });
        }
      }

      return updatedOrder;
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      });
    }
  });
