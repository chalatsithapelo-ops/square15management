import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import jwt from "jsonwebtoken";
import { env } from "~/server/env";

export const getArtisanExpenseTracker = baseProcedure
  .input(
    z.object({
      token: z.string(),
    })
  )
  .query(async ({ input }) => {
    try {
      const verified = jwt.verify(input.token, env.JWT_SECRET);
      const parsed = z.object({ userId: z.number() }).parse(verified);

      const user = await db.user.findUnique({
        where: { id: parsed.userId },
      });

      if (!user) {
        throw new TRPCError({ code: "NOT_FOUND", message: "User not found" });
      }

      if (user.role !== "SENIOR_ADMIN" && user.role !== "JUNIOR_ADMIN") {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Only admins can access artisan expense tracking",
        });
      }

      // Get all artisan users
      const artisans = await db.user.findMany({
        where: { role: "ARTISAN" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          hourlyRate: true,
          dailyRate: true,
        },
      });

      // Get all orders with artisan assignments
      const orders = await db.order.findMany({
        where: {
          assignedToId: { not: null },
        },
        select: {
          id: true,
          orderNumber: true,
          customerName: true,
          serviceType: true,
          status: true,
          createdAt: true,
          assignedToId: true,
          materialCost: true,
          labourCost: true,
          totalCost: true,
          expenseSlips: {
            select: {
              id: true,
              category: true,
              amount: true,
              description: true,
              createdAt: true,
            },
          },
          jobActivities: {
            select: {
              id: true,
              artisanId: true,
              durationMinutes: true,
              startTime: true,
              endTime: true,
            },
          },
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              total: true,
              paidDate: true,
            },
          },
        },
      });

      // Get all payment requests
      const paymentRequests = await db.paymentRequest.findMany({
        select: {
          id: true,
          requestNumber: true,
          artisanId: true,
          orderIds: true,
          hoursWorked: true,
          daysWorked: true,
          hourlyRate: true,
          dailyRate: true,
          calculatedAmount: true,
          status: true,
          createdAt: true,
          approvedDate: true,
          paidDate: true,
          notes: true,
        },
      });

      // Build per-artisan aggregation
      const artisanData = artisans.map((artisan) => {
        const artisanOrders = orders.filter(
          (o) => o.assignedToId === artisan.id
        );
        const artisanPayments = paymentRequests.filter(
          (pr) => pr.artisanId === artisan.id
        );

        // Order-level costs
        const totalMaterialCost = artisanOrders.reduce(
          (sum, o) => sum + (o.materialCost || 0),
          0
        );
        const totalLabourCost = artisanOrders.reduce(
          (sum, o) => sum + (o.labourCost || 0),
          0
        );

        // Expense slips from their orders
        const allExpenseSlips = artisanOrders.flatMap((o) =>
          o.expenseSlips.map((es) => ({ ...es, orderNumber: o.orderNumber }))
        );
        const totalExpenseSlips = allExpenseSlips.reduce(
          (sum, es) => sum + (es.amount || 0),
          0
        );
        const expenseSlipsByCategory = allExpenseSlips.reduce(
          (acc, es) => {
            acc[es.category] = (acc[es.category] || 0) + (es.amount || 0);
            return acc;
          },
          {} as Record<string, number>
        );

        // Payment request breakdown
        const paidPayments = artisanPayments.filter(
          (pr) => pr.status === "PAID"
        );
        const pendingPayments = artisanPayments.filter(
          (pr) => pr.status === "PENDING"
        );
        const approvedPayments = artisanPayments.filter(
          (pr) => pr.status === "APPROVED"
        );

        const totalPaid = paidPayments.reduce(
          (sum, pr) => sum + pr.calculatedAmount,
          0
        );
        const totalPending = pendingPayments.reduce(
          (sum, pr) => sum + pr.calculatedAmount,
          0
        );
        const totalApproved = approvedPayments.reduce(
          (sum, pr) => sum + pr.calculatedAmount,
          0
        );

        // Time tracked from job activities
        const artisanActivities = artisanOrders.flatMap((o) =>
          o.jobActivities.filter((ja) => ja.artisanId === artisan.id)
        );
        const totalMinutesWorked = artisanActivities.reduce(
          (sum, ja) => sum + (ja.durationMinutes || 0),
          0
        );

        // Order status breakdown
        const completedOrders = artisanOrders.filter(
          (o) => o.status === "COMPLETED"
        ).length;
        const activeOrders = artisanOrders.filter(
          (o) =>
            o.status === "IN_PROGRESS" ||
            o.status === "ASSIGNED"
        ).length;

        // Total cost to company for this artisan
        const totalCostToCompany =
          totalMaterialCost + totalLabourCost + totalPaid + totalExpenseSlips;

        // Average cost per job
        const avgCostPerJob =
          artisanOrders.length > 0
            ? totalCostToCompany / artisanOrders.length
            : 0;

        // Red flags
        const flags: string[] = [];

        // Flag: high material costs vs labour (materials > 3x labour could indicate overspend)
        if (totalMaterialCost > 0 && totalLabourCost > 0 && totalMaterialCost > totalLabourCost * 3) {
          flags.push("Material costs unusually high relative to labour");
        }

        // Flag: payments without completed jobs
        if (totalPaid > 0 && completedOrders === 0) {
          flags.push("Payments made but no completed jobs");
        }

        // Flag: frequent expense slip submissions (>5 per job average)
        if (artisanOrders.length > 0 && allExpenseSlips.length / artisanOrders.length > 5) {
          flags.push("High expense slip frequency per job");
        }

        // Flag: pending payments exceeding paid (cash flow risk)
        if (totalPending > totalPaid && totalPending > 0) {
          flags.push("Pending payments exceed total paid");
        }

        return {
          artisan: {
            id: artisan.id,
            firstName: artisan.firstName,
            lastName: artisan.lastName,
            email: artisan.email,
            phone: artisan.phone,
            hourlyRate: artisan.hourlyRate,
            dailyRate: artisan.dailyRate,
          },
          summary: {
            totalOrders: artisanOrders.length,
            completedOrders,
            activeOrders,
            totalMaterialCost,
            totalLabourCost,
            totalExpenseSlips,
            totalPaid,
            totalPending,
            totalApproved,
            totalCostToCompany,
            avgCostPerJob,
            totalMinutesWorked,
          },
          expenseSlipsByCategory,
          flags,
          // Detail arrays for drill-down
          orders: artisanOrders.map((o) => {
            // Find payment requests linked to this order
            const orderPayments = artisanPayments.filter(
              (pr) => pr.orderIds.includes(o.id)
            );
            const latestPayment = orderPayments.length > 0
              ? orderPayments.sort(
                  (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
                )[0]
              : null;

            return {
              id: o.id,
              orderNumber: o.orderNumber,
              customerName: o.customerName,
              serviceType: o.serviceType,
              status: o.status,
              createdAt: o.createdAt,
              materialCost: o.materialCost,
              labourCost: o.labourCost,
              totalCost: o.totalCost,
              expenseSlipCount: o.expenseSlips.length,
              expenseSlipTotal: o.expenseSlips.reduce(
                (sum, es) => sum + (es.amount || 0),
                0
              ),
              // Invoice lifecycle
              invoiceStatus: o.invoice?.status || null,
              invoiceNumber: o.invoice?.invoiceNumber || null,
              invoiceTotal: o.invoice?.total || null,
              invoicePaidDate: o.invoice?.paidDate || null,
              // Payment request lifecycle
              paymentStatus: latestPayment?.status || null,
              paymentRequestNumber: latestPayment?.requestNumber || null,
              paymentAmount: latestPayment?.calculatedAmount || null,
              paymentCount: orderPayments.length,
            };
          }),
          paymentRequests: artisanPayments.map((pr) => ({
            id: pr.id,
            requestNumber: pr.requestNumber,
            calculatedAmount: pr.calculatedAmount,
            status: pr.status,
            createdAt: pr.createdAt,
            paidDate: pr.paidDate,
            hoursWorked: pr.hoursWorked,
            daysWorked: pr.daysWorked,
            notes: pr.notes,
          })),
          expenseSlips: allExpenseSlips,
        };
      });

      // Sort by total cost to company descending (highest spenders first)
      artisanData.sort(
        (a, b) => b.summary.totalCostToCompany - a.summary.totalCostToCompany
      );

      // Global totals
      const globalTotals = {
        totalArtisans: artisans.length,
        totalPaid: artisanData.reduce((s, a) => s + a.summary.totalPaid, 0),
        totalPending: artisanData.reduce(
          (s, a) => s + a.summary.totalPending,
          0
        ),
        totalMaterialCost: artisanData.reduce(
          (s, a) => s + a.summary.totalMaterialCost,
          0
        ),
        totalLabourCost: artisanData.reduce(
          (s, a) => s + a.summary.totalLabourCost,
          0
        ),
        totalExpenseSlips: artisanData.reduce(
          (s, a) => s + a.summary.totalExpenseSlips,
          0
        ),
        totalCostToCompany: artisanData.reduce(
          (s, a) => s + a.summary.totalCostToCompany,
          0
        ),
        totalFlaggedArtisans: artisanData.filter((a) => a.flags.length > 0)
          .length,
      };

      return { artisanData, globalTotals };
    } catch (error) {
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: "INTERNAL_SERVER_ERROR",
        message: "Failed to fetch artisan expense tracker data",
      });
    }
  });
