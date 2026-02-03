import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { db } from "~/server/db";
import { baseProcedure } from "~/server/trpc/main";
import { authenticateUser } from "~/server/utils/auth";
import { getCompanyDetails } from "~/server/utils/company-details";
import { notifyAdmins } from "~/server/utils/notifications";
import { sendOrderNotificationEmail } from "~/server/utils/email";

export const createOrder = baseProcedure
  .input(
    z.object({
      token: z.string(),
      orderNumber: z.preprocess(
        (val) => (val === "" ? undefined : val),
        z.string().min(1).optional()
      ),
      customerName: z.string().min(1),
      customerEmail: z.string().email(),
      customerPhone: z.string().min(1),
      address: z.string().min(1),
      serviceType: z.string().min(1),
      description: z.string().min(1),
      assignedToId: z.number().optional(),
      leadId: z.number().optional(),
      callOutFee: z.number().default(0),
      labourRate: z.number().optional(),
      totalMaterialBudget: z.number().optional(),
      numLabourersNeeded: z.number().int().optional(),
      totalLabourCostBudget: z.number().optional(),
      documentUrls: z.array(z.string()).optional(),
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
    const user = await authenticateUser(input.token);

    if (user.role !== "CONTRACTOR" && user.role !== "JUNIOR_ADMIN" && user.role !== "SENIOR_ADMIN") {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: "You do not have permission to create orders.",
      });
    }

    const companyDetails = await getCompanyDetails();
    const count = await db.order.count();
    const orderNumber = `${companyDetails.orderPrefix}-${String(
      count + 1
    ).padStart(5, "0")}`;

    // Determine assignment and status based on role and input
    let assignedToId = input.assignedToId || null;
    let status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' = 'PENDING';

    if (user.role === 'CONTRACTOR') {
      // If contractor provided an assignedToId (e.g., artisan), use it
      // Otherwise assign to themselves
      if (input.assignedToId) {
        assignedToId = input.assignedToId;
        status = 'ASSIGNED'; // Assigned to artisan
      } else {
        assignedToId = user.id;
        status = 'IN_PROGRESS'; // Contractor doing it themselves
      }
    } else {
      // Admin users
      if (input.assignedToId) {
        status = 'ASSIGNED';
      }
    }

    const order = await db.order.create({
      data: {
        orderNumber,
        customerName: input.customerName,
        customerEmail: input.customerEmail,
        customerPhone: input.customerPhone,
        address: input.address,
        serviceType: input.serviceType,
        description: input.description,
        assignedToId,
        status,
        leadId: input.leadId || null,
        callOutFee: input.callOutFee || 0,
        labourRate: input.labourRate || null,
        totalMaterialBudget: input.totalMaterialBudget || null,
        numLabourersNeeded: input.numLabourersNeeded || null,
        totalLabourCostBudget: input.totalLabourCostBudget || null,
        documents: input.documentUrls || [],
        notes: input.notes || null,
      },
      include: {
        assignedTo: {
          select: {
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    // Send email notification to customer (best effort, non-blocking)
    void sendOrderNotificationEmail({
      customerEmail: order.customerEmail,
      customerName: order.customerName,
      orderNumber: order.orderNumber,
      orderDescription: order.description,
      assignedToName: order.assignedTo ? `${order.assignedTo.firstName} ${order.assignedTo.lastName}` : undefined,
      userId: user.id, // Send from the user who created the order
    })
      .then(() => {
        console.log(`Order notification email sent to ${order.customerEmail}`);
      })
      .catch((emailError) => {
        console.error("Failed to send order notification email:", emailError);
      });

    // Only notify admins if an admin created the order without assigning it.
    if ((user.role === "JUNIOR_ADMIN" || user.role === "SENIOR_ADMIN") && !input.assignedToId) {
      // Best effort, non-blocking
      void notifyAdmins({
        message: `New order ${order.orderNumber} created by ${user.firstName} ${user.lastName}`,
        type: "PM_ORDER_SUBMITTED",
        relatedEntityId: order.id,
        relatedEntityType: "ORDER",
      }).catch((notifyError) => {
        console.error("Failed to notify admins about new order:", notifyError);
      });
    }

    return order;
  });
