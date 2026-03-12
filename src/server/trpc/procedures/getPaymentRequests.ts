import { z } from "zod";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser, requirePermission, PERMISSIONS } from "~/server/utils/auth";

export const getPaymentRequests = baseProcedure
  .input(
    z.object({
      token: z.string(),
      status: z.enum(["PENDING", "APPROVED", "REJECTED", "PAID"]).nullable().optional(),
    })
  )
  .query(async ({ input }) => {
    const user = await authenticateUser(input.token);

    const where: any = {};
    
    if (input.status) {
      where.status = input.status;
    }
    
    // Role-based filtering - CRITICAL: Separate Contractor and Admin portals
    if (user.role === "ARTISAN") {
      // Artisans can only see their own payment requests
      where.artisanId = user.id;
    } else if (user.role === "CONTRACTOR" || user.role === "CONTRACTOR_SENIOR_MANAGER" || user.role === "CONTRACTOR_JUNIOR_MANAGER") {
      // Contractors see payment requests from their own company's artisans ONLY.
      // NOTE: User model does not have `companyId`; without a stable company linkage to ARTISAN users,
      // we can only safely show payment requests directly tied to the current user.
      requirePermission(user, PERMISSIONS.VIEW_PAYMENT_REQUESTS);

      where.artisanId = user.id;
    } else {
      // Admin portal users (ADMIN, SENIOR_ADMIN, JUNIOR_ADMIN)
      // CRITICAL: Exclude payment requests from contractor-managed artisans
      requirePermission(user, PERMISSIONS.VIEW_PAYMENT_REQUESTS);

      // Without a stable contractor->artisan company link in schema, we cannot safely exclude
      // contractor-managed artisan payment requests here.
    }

    const paymentRequests = await db.paymentRequest.findMany({
      where,
      include: {
        artisan: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            hourlyRate: true,
            dailyRate: true,
          },
        },
        payslip: {
          select: {
            id: true,
            payslipNumber: true,
            basicSalary: true,
            netPay: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Resolve orderIds to actual order data with invoice info
    const allOrderIds = paymentRequests.flatMap((pr) => pr.orderIds || []);
    const uniqueOrderIds = [...new Set(allOrderIds)];

    let ordersMap: Record<number, any> = {};
    if (uniqueOrderIds.length > 0) {
      const orders = await db.order.findMany({
        where: { id: { in: uniqueOrderIds } },
        select: {
          id: true,
          orderNumber: true,
          serviceType: true,
          status: true,
          customerName: true,
          invoice: {
            select: {
              id: true,
              invoiceNumber: true,
              status: true,
              total: true,
            },
          },
        },
      });
      ordersMap = Object.fromEntries(orders.map((o) => [o.id, o]));
    }

    // Attach resolved orders to each payment request
    const enrichedPaymentRequests = paymentRequests.map((pr) => ({
      ...pr,
      orders: (pr.orderIds || []).map((id) => ordersMap[id]).filter(Boolean),
    }));

    return enrichedPaymentRequests;
  });
