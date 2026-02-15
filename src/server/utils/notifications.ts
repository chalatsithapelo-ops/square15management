import { db } from "~/server/db";
import { NotificationType } from "@prisma/client";
import { notificationEvents } from "~/server/utils/notification-events";
import { sendPushNotificationToUser, sendPushNotificationToUsers } from "~/server/utils/web-push";

/**
 * Helper function to create a notification for a specific user
 */
export async function createNotification(params: {
  recipientId: number;
  recipientRole: string;
  message: string;
  type: NotificationType;
  relatedEntityId?: number;
  relatedEntityType?: string;
}) {
  try {
    // Check if the user has disabled this notification type
    const recipient = await db.user.findUnique({
      where: { id: params.recipientId },
      select: { disabledNotificationTypes: true, role: true },
    });

    if (recipient?.disabledNotificationTypes.includes(params.type)) {
      // User has disabled this notification type, skip creation
      return;
    }

    const notification = await db.notification.create({
      data: {
        recipientId: params.recipientId,
        // Store the recipient's actual role to keep data consistent even if callers pass a generic role
        // (e.g. CONTRACTOR vs CONTRACTOR_SENIOR_MANAGER).
        recipientRole: recipient?.role ?? params.recipientRole,
        message: params.message,
        type: params.type,
        relatedEntityId: params.relatedEntityId,
        relatedEntityType: params.relatedEntityType,
      },
    });

    // Emit notification event for real-time push
    notificationEvents.emitNotification(params.recipientId, notification);

    // Send Web Push notification (non-blocking)
    sendPushNotificationToUser(params.recipientId, {
      title: "Square 15",
      body: params.message,
      icon: "/square15-logo-design.png",
      badge: "/square15-logo-design.png",
      data: {
        notificationId: notification.id,
        type: params.type,
        recipientRole: recipient?.role ?? params.recipientRole,
        relatedEntityId: params.relatedEntityId,
        relatedEntityType: params.relatedEntityType,
      },
      tag: `notification-${notification.id}`,
    }).catch((error) => {
      console.error("Failed to send push notification:", error);
    });

    return notification;
  } catch (error) {
    console.error("Failed to create notification:", error);
    // Don't throw - notifications are not critical to the main operation
  }
}

/**
 * Notify all admins about an event
 */
export async function notifyAdmins(params: {
  message: string;
  type: NotificationType;
  relatedEntityId?: number;
  relatedEntityType?: string;
}) {
  try {
    const admins = await db.user.findMany({
      where: {
        role: {
          in: ["ADMIN", "JUNIOR_ADMIN", "SENIOR_ADMIN"],
        },
      },
      select: {
        id: true,
        role: true,
        disabledNotificationTypes: true,
      },
    });

    // Filter out admins who have disabled this notification type
    const eligibleAdmins = admins.filter(
      (admin) => !admin.disabledNotificationTypes.includes(params.type)
    );

    const notifications = await Promise.all(
      eligibleAdmins.map(async (admin) => {
        const notification = await db.notification.create({
          data: {
            recipientId: admin.id,
            recipientRole: admin.role,
            message: params.message,
            type: params.type,
            relatedEntityId: params.relatedEntityId,
            relatedEntityType: params.relatedEntityType,
          },
        });

        // Emit notification event for real-time push
        notificationEvents.emitNotification(admin.id, notification);

        return notification;
      })
    );

    // Send Web Push notifications to eligible admins (non-blocking)
    const eligibleAdminIds = eligibleAdmins.map((admin) => admin.id);
    if (eligibleAdminIds.length > 0) {
      sendPushNotificationToUsers(eligibleAdminIds, {
        title: "Square 15 - Admin",
        body: params.message,
        icon: "/square15-logo-design.png",
        badge: "/square15-logo-design.png",
        data: {
          type: params.type,
          recipientRole: "ADMIN",
          relatedEntityId: params.relatedEntityId,
          relatedEntityType: params.relatedEntityType,
        },
        requireInteraction: true, // Require interaction for admin notifications
      }).catch((error) => {
        console.error("Failed to send push notifications to admins:", error);
      });
    }

    return notifications;
  } catch (error) {
    console.error("Failed to notify admins:", error);
  }
}

/**
 * Notify artisan about order assignment
 */
export async function notifyArtisanOrderAssigned(params: {
  artisanId: number;
  orderNumber: string;
  orderId: number;
}) {
  await createNotification({
    recipientId: params.artisanId,
    recipientRole: "ARTISAN",
    message: `You have been assigned to order ${params.orderNumber}`,
    type: "ORDER_ASSIGNED",
    relatedEntityId: params.orderId,
    relatedEntityType: "ORDER",
  });
}

/**
 * Notify customer about order status change
 */
export async function notifyCustomerOrderStatus(params: {
  customerId: number;
  orderNumber: string;
  orderId: number;
  newStatus: string;
}) {
  const statusMessages: Record<string, string> = {
    ASSIGNED: `Your order ${params.orderNumber} has been assigned to an artisan`,
    IN_PROGRESS: `Work has started on your order ${params.orderNumber}`,
    COMPLETED: `Your order ${params.orderNumber} has been completed`,
    CANCELLED: `Your order ${params.orderNumber} has been cancelled`,
  };

  const message = statusMessages[params.newStatus] || `Your order ${params.orderNumber} status has been updated`;

  await createNotification({
    recipientId: params.customerId,
    recipientRole: "CUSTOMER",
    message,
    type: "ORDER_STATUS_UPDATED",
    relatedEntityId: params.orderId,
    relatedEntityType: "ORDER",
  });
}

/**
 * Notify admins about payment request
 */
export async function notifyAdminsPaymentRequest(params: {
  artisanName: string;
  amount: number;
  paymentRequestId: number;
}) {
  await notifyAdmins({
    message: `${params.artisanName} has submitted a payment request for R${params.amount.toLocaleString()}`,
    type: "PAYMENT_REQUEST_CREATED",
    relatedEntityId: params.paymentRequestId,
    relatedEntityType: "PAYMENT_REQUEST",
  });
}

/**
 * Notify artisan about payment request status
 */
export async function notifyArtisanPaymentStatus(params: {
  artisanId: number;
  paymentRequestId: number;
  status: "APPROVED" | "REJECTED" | "PAID";
  amount: number;
  rejectionReason?: string;
}) {
  const messages: Record<"APPROVED" | "REJECTED" | "PAID", string> = {
    APPROVED: `Your payment request for R${params.amount.toLocaleString()} has been approved`,
    REJECTED: `Your payment request for R${params.amount.toLocaleString()} has been rejected${params.rejectionReason ? `: ${params.rejectionReason}` : ""}`,
    PAID: `Your payment of R${params.amount.toLocaleString()} has been processed`,
  };

  const types: Record<"APPROVED" | "REJECTED" | "PAID", NotificationType> = {
    APPROVED: "PAYMENT_REQUEST_APPROVED",
    REJECTED: "PAYMENT_REQUEST_REJECTED",
    PAID: "PAYMENT_REQUEST_PAID",
  };

  await createNotification({
    recipientId: params.artisanId,
    recipientRole: "ARTISAN",
    message: messages[params.status],
    type: types[params.status],
    relatedEntityId: params.paymentRequestId,
    relatedEntityType: "PAYMENT_REQUEST",
  });
}

/**
 * Notify artisan about quotation assignment
 */
export async function notifyArtisanQuotationAssigned(params: {
  artisanId: number;
  quoteNumber: string;
  quotationId: number;
}) {
  await createNotification({
    recipientId: params.artisanId,
    recipientRole: "ARTISAN",
    message: `You have been assigned to quotation ${params.quoteNumber}`,
    type: "QUOTATION_ASSIGNED",
    relatedEntityId: params.quotationId,
    relatedEntityType: "QUOTATION",
  });
}

/**
 * Notify admins about quotation ready for review
 */
export async function notifyAdminsQuotationReady(params: {
  quoteNumber: string;
  quotationId: number;
  artisanName: string;
}) {
  await notifyAdmins({
    message: `${params.artisanName} has completed quotation ${params.quoteNumber} and submitted it for review`,
    type: "QUOTATION_READY_FOR_REVIEW",
    relatedEntityId: params.quotationId,
    relatedEntityType: "QUOTATION",
  });
}

/**
 * Notify customer about quotation status
 */
export async function notifyCustomerQuotationStatus(params: {
  customerId: number;
  quoteNumber: string;
  quotationId: number;
  status: "APPROVED" | "REJECTED";
  rejectionReason?: string;
}) {
  const messages: Record<"APPROVED" | "REJECTED", string> = {
    APPROVED: `Your quotation ${params.quoteNumber} has been approved`,
    REJECTED: `Your quotation ${params.quoteNumber} has been rejected${params.rejectionReason ? `: ${params.rejectionReason}` : ""}`,
  };

  await createNotification({
    recipientId: params.customerId,
    recipientRole: "CUSTOMER",
    message: messages[params.status],
    type: "QUOTATION_STATUS_UPDATED",
    relatedEntityId: params.quotationId,
    relatedEntityType: "QUOTATION",
  });
}

/**
 * Notify customer about invoice
 */
export async function notifyCustomerInvoice(params: {
  customerId: number;
  invoiceNumber: string;
  invoiceId: number;
  status: "SENT" | "OVERDUE";
  amount: number;
}) {
  const messages: Record<"SENT" | "OVERDUE", string> = {
    SENT: `Invoice ${params.invoiceNumber} for R${params.amount.toLocaleString()} has been sent to you`,
    OVERDUE: `Invoice ${params.invoiceNumber} for R${params.amount.toLocaleString()} is now overdue`,
  };

  await createNotification({
    recipientId: params.customerId,
    recipientRole: "CUSTOMER",
    message: messages[params.status],
    type: params.status === "SENT" ? "INVOICE_CREATED" : "INVOICE_STATUS_UPDATED",
    relatedEntityId: params.invoiceId,
    relatedEntityType: "INVOICE",
  });
}

/**
 * Notify admins about invoice payment
 */
export async function notifyAdminsInvoicePaid(params: {
  invoiceNumber: string;
  invoiceId: number;
  amount: number;
  customerName: string;
}) {
  await notifyAdmins({
    message: `${params.customerName} has paid invoice ${params.invoiceNumber} (R${params.amount.toLocaleString()})`,
    type: "INVOICE_STATUS_UPDATED",
    relatedEntityId: params.invoiceId,
    relatedEntityType: "INVOICE",
  });
}

/**
 * Notify artisan about project assignment
 */
export async function notifyArtisanProjectAssigned(params: {
  artisanId: number;
  projectName: string;
  projectId: number;
}) {
  await createNotification({
    recipientId: params.artisanId,
    recipientRole: "ARTISAN",
    message: `You have been assigned to project: ${params.projectName}`,
    type: "PROJECT_ASSIGNED",
    relatedEntityId: params.projectId,
    relatedEntityType: "PROJECT",
  });
}

/**
 * Notify artisan about milestone assignment
 */
export async function notifyArtisanMilestoneAssigned(params: {
  artisanId: number;
  milestoneName: string;
  milestoneId: number;
  projectName: string;
}) {
  await createNotification({
    recipientId: params.artisanId,
    recipientRole: "ARTISAN",
    message: `You have been assigned to milestone "${params.milestoneName}" in project ${params.projectName}`,
    type: "MILESTONE_ASSIGNED",
    relatedEntityId: params.milestoneId,
    relatedEntityType: "MILESTONE",
  });
}

/**
 * Notify customer about statement generation
 */
export async function notifyCustomerStatement(params: {
  customerId: number;
  statementNumber: string;
  statementId: number;
  totalDue: number;
}) {
  await createNotification({
    recipientId: params.customerId,
    recipientRole: "CUSTOMER",
    message: `Your statement ${params.statementNumber} is ready. Total due: R${params.totalDue.toLocaleString()}`,
    type: "STATEMENT_GENERATED",
    relatedEntityId: params.statementId,
    relatedEntityType: "STATEMENT",
  });
}

/**
 * Notify sales person about lead follow-up reminder
 */
export async function notifyLeadFollowUpReminder(params: {
  assignedToId: number;
  leadId: number;
  customerName: string;
  serviceType: string;
  daysOverdue: number;
}) {
  const urgencyText = params.daysOverdue > 0 
    ? `OVERDUE by ${params.daysOverdue} day${params.daysOverdue > 1 ? 's' : ''}` 
    : 'is due today';

  await createNotification({
    recipientId: params.assignedToId,
    recipientRole: "JUNIOR_ADMIN" as any, // Sales person role
    message: `Follow-up reminder: ${params.customerName} (${params.serviceType}) ${urgencyText}`,
    type: "LEAD_FOLLOW_UP_REMINDER",
    relatedEntityId: params.leadId,
    relatedEntityType: "LEAD",
  });
}

/**
 * Notify admins about expiring HR documents
 */
export async function notifyAdminsDocumentExpiry(params: {
  documentId: number;
  employeeName: string;
  documentTitle: string;
  documentType: string;
  expiryDate: Date;
  daysUntilExpiry: number;
}) {
  const urgencyText = params.daysUntilExpiry <= 0
    ? 'has EXPIRED'
    : params.daysUntilExpiry === 1
    ? 'expires TOMORROW'
    : `expires in ${params.daysUntilExpiry} days`;

  await notifyAdmins({
    message: `HR Document Alert: ${params.employeeName}'s ${params.documentTitle} (${params.documentType}) ${urgencyText}`,
    type: "SYSTEM_ALERT",
    relatedEntityId: params.documentId,
    relatedEntityType: "HR_DOCUMENT",
  });
}
