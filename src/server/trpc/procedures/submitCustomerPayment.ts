import { z } from "zod";
import { publicProcedure } from "~/server/trpc/main";
import { TRPCError } from "@trpc/server";
import { authenticateUser } from "~/server/utils/auth";
import { db } from "~/server/db";

export const submitCustomerPayment = publicProcedure
  .input(
    z.object({
      token: z.string(),
      paymentType: z.enum(["RENT", "UTILITIES", "CLAIM"]),
      amount: z.number().min(0.01),
      paymentMethod: z.enum(["BANK_TRANSFER", "CASH", "CARD", "EFT"]),
      transactionReference: z.string().optional(),
      paymentDate: z.string(),
      paymentMonth: z.string().optional(),
      deviationReason: z.string().optional(),
      notes: z.string().optional(),
      proofOfPayment: z.array(z.string()),
      expectedAmount: z.number().optional(),
    })
  )
  .mutation(async ({ input }) => {
    const user = await authenticateUser(input.token);

    if (user.role !== "CUSTOMER") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "Only customers can submit payments.",
      });
    }

    // Fetch customer profile
    const userWithProfile = await db.user.findUnique({
      where: { id: user.id },
      include: {
        customerProfile: true,
      },
    });

    if (!userWithProfile?.customerProfile) {
      throw new TRPCError({
        code: "BAD_REQUEST",
        message: "Customer profile not found. Please contact your property manager.",
      });
    }

    const customerProfile = userWithProfile.customerProfile;

    // Generate payment number
    const paymentCount = await db.customerPayment.count();
    const paymentNumber = `PAY-${(paymentCount + 1).toString().padStart(6, "0")}`;

    // Parse payment date
    const paymentDate = new Date(input.paymentDate);

    // Parse payment month if provided
    let paymentMonth: Date | undefined;
    if (input.paymentMonth) {
      paymentMonth = new Date(input.paymentMonth + "-01");
    }

    // Create the payment
    const payment = await db.customerPayment.create({
      data: {
        paymentNumber,
        paymentType: input.paymentType,
        amount: input.amount,
        expectedAmount: input.expectedAmount,
        deviationReason: input.deviationReason,
        paymentMethod: input.paymentMethod,
        transactionReference: input.transactionReference,
        proofOfPayment: input.proofOfPayment,
        status: "PENDING",
        paymentDate,
        paymentMonth,
        notes: input.notes,
        customerId: user.id,
        tenantId: customerProfile.id,
        buildingId: customerProfile.buildingId,
        propertyManagerId: customerProfile.propertyManagerId,
      },
    });

    // Create notification for property manager
    if (customerProfile.propertyManagerId) {
      await db.notification.create({
        data: {
          recipientId: customerProfile.propertyManagerId,
          recipientRole: "PROPERTY_MANAGER",
          type: "CUSTOMER_PAYMENT_SUBMITTED",
          message: `${user.firstName} ${user.lastName} submitted a ${input.paymentType.toLowerCase()} payment of R${input.amount.toFixed(2)} for review.`,
          isRead: false,
          relatedEntityType: "CUSTOMER_PAYMENT",
          relatedEntityId: payment.id,
        },
      });
    }

    return {
      success: true,
      payment,
    };
  });
