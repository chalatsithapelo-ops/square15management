import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";
import { buildPayfastCheckout, mapPayfastPaymentMethod } from "~/server/payments/payfast";
import { env } from "~/server/env";

export const createCustomerPayfastCheckout = baseProcedure
  .input(
    z.object({
      token: z.string(),
      paymentType: z.enum(["RENT", "UTILITIES", "CLAIM"]),
      amount: z.number().min(0.01),
      paymentOption: z.enum([
        "CARD",
        "S_PAY",
        "INSTANT_EFT",
        "SNAPSCAN",
        "ZAPPER",
        "MASTERPASS",
        "FNB_PAY",
      ]),
      paymentMonth: z.string().optional(),
      notes: z.string().optional(),
      expectedAmount: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only customers can create payments.",
      });
    }

    // Fetch customer profile (PropertyManagerCustomer linked via userId)
    const userWithProfile = await db.user.findUnique({
      where: { id: user.id },
      include: { customerProfile: true },
    });

    let customerProfile = userWithProfile?.customerProfile ?? null;

    // Repair: link tenant record by email if it exists but isn't linked yet
    if (!customerProfile) {
      const tenantByEmail = await db.propertyManagerCustomer.findFirst({
        where: {
          email: user.email,
          userId: null,
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      if (tenantByEmail) {
        customerProfile = await db.propertyManagerCustomer.update({
          where: { id: tenantByEmail.id },
          data: { userId: user.id },
        });
      }
    }

    if (!customerProfile) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Customer profile not found. Please contact your property manager.",
      });
    }

    // Generate payment number
    const paymentCount = await db.customerPayment.count();
    const paymentNumber = `PAY-${(paymentCount + 1).toString().padStart(6, "0")}`;

    // Parse payment month if provided
    let paymentMonth: Date | undefined;
    if (input.paymentMonth) {
      paymentMonth = new Date(input.paymentMonth + "-01");
    }

    const payment = await db.customerPayment.create({
      data: {
        paymentNumber,
        paymentType: input.paymentType,
        amount: input.amount,
        expectedAmount: input.expectedAmount,
        paymentMethod: input.paymentOption,
        status: "PENDING",
        paymentDate: new Date(),
        paymentMonth,
        notes: input.notes,
        customerId: user.id,
        tenantId: customerProfile.id,
        buildingId: customerProfile.buildingId,
        propertyManagerId: customerProfile.propertyManagerId,
      },
    });

    const payfastMethod = mapPayfastPaymentMethod(input.paymentOption);

    const checkout = buildPayfastCheckout({
      name_first: user.firstName,
      name_last: user.lastName,
      email_address: user.email,

      m_payment_id: `custpay_${payment.id}`,
      amount: input.amount.toFixed(2),
      item_name: `Square 15 - ${input.paymentType} Payment`,
      item_description: `Tenant payment (${input.paymentType}) by ${user.email}`,

      return_url: `${env.BASE_URL}/customer/dashboard?payment=success`,
      cancel_url: `${env.BASE_URL}/customer/dashboard?payment=cancel`,
      // Vinxi mounts http routers at base + router name (e.g. /health/health).
      notify_url: `${env.BASE_URL}/api/payments/payfast/notify/payfast-notify`,

      ...(payfastMethod ? { payment_method: payfastMethod } : {}),

      // Helpful metadata
      custom_str1: String(payment.id),
      custom_str2: input.paymentOption,
    });

    return {
      customerPaymentId: payment.id,
      ...checkout,
    };
  });
