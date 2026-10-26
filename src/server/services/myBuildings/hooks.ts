import { db } from "~/server/db";
import { updateWorkRequestStatus, uploadAttachment, uploadInvoice } from "./client";

export async function pushJobCardIfLinked(orderId: number): Promise<void> {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: {
      id: true, orderNumber: true, clientWorkOrderId: true,
      signedJobCardUrl: true, clientRepSignDate: true, clientUnavailableToSign: true,
      artisanSignatureUrl: true, artisanSignDate: true, pushedJobCardPdfAt: true,
    },
  });
  if (!order?.clientWorkOrderId || order.pushedJobCardPdfAt) return;
  const artisanSigned = Boolean(order.artisanSignatureUrl && order.artisanSignDate);
  const clientSignedOrUnavailable = Boolean((order.signedJobCardUrl && order.clientRepSignDate) || order.clientUnavailableToSign);
  if (!artisanSigned || !clientSignedOrUnavailable) return;

  const workOrder = await db.clientWorkOrder.findUnique({ where: { id: order.clientWorkOrderId } });
  if (!workOrder) return;

  try {
    const base = (process.env.BASE_URL || process.env.APP_URL || "https://square15management.co.za").replace(/\/+$/, "");
    const token = await db.myBuildingsJobCardPublicToken.create({
      data: { orderId: order.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
      select: { token: true },
    });
    const attachmentUrl = `${base}/api/public/mybuildings-jobcard/${token.token}.pdf`;
    const attachment = await uploadAttachment({
      workRequestId: workOrder.externalId,
      jobCode: workOrder.externalJobCode,
      attachmentName: `JobCard-${order.orderNumber || order.id}.pdf`,
      attachmentUrl,
      attachmentExtension: ".pdf",
      clientWorkOrderId: workOrder.id,
    });
    if (!attachment.ok) {
      await db.clientWorkOrder.update({ where: { id: workOrder.id }, data: { lastPushError: attachment.error } });
      return;
    }
    await db.order.update({ where: { id: order.id }, data: { pushedJobCardPdfAt: new Date() } });
    await db.clientWorkOrder.update({ where: { id: workOrder.id }, data: { pushedAttachmentAt: new Date(), ourStatus: "CONTRACTOR_COMPLETE" } });
    const status = await updateWorkRequestStatus({
      workRequestId: workOrder.externalId,
      jobCode: workOrder.externalJobCode,
      newStatusId: 6,
      comment: `Auto: signed job card PDF attached from Square 15 Order ${order.orderNumber || order.id}`,
      clientWorkOrderId: workOrder.id,
    });
    await db.clientWorkOrder.update({
      where: { id: workOrder.id },
      data: { pushedStatusId: status.ok ? 6 : undefined, lastPushAt: new Date(), lastPushError: status.error },
    });
  } catch (error: any) {
    console.error("[myBuildings] job-card auto-push failed:", error?.message ?? error);
    await db.clientWorkOrder.update({ where: { id: workOrder.id }, data: { lastPushError: error?.message ?? String(error) } }).catch(() => {});
  }
}

export async function pushInvoiceIfLinked(invoiceId: number): Promise<void> {
  const invoice = await db.invoice.findUnique({ where: { id: invoiceId }, include: { clientWorkOrders: true } });
  if (!invoice) return;
  const base = (process.env.BASE_URL || "https://square15management.co.za").replace(/\/+$/, "");
  for (const workOrder of invoice.clientWorkOrders ?? []) {
    if (workOrder.pushedInvoiceAt) continue;
    if (!/^awaiting (upload of )?invoice$/i.test((workOrder.externalStatusName ?? "").trim())) continue;
    try {
      const token = await db.myBuildingsInvoicePublicToken.create({
        data: { invoiceId: invoice.id, expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000) },
        select: { token: true },
      });
      const pdfUrl = `${base}/api/public/mybuildings-invoice/${token.token}.pdf`;
      const result = await uploadInvoice({
        workRequestId: workOrder.externalId,
        jobCode: workOrder.externalJobCode,
        invoiceNumber: invoice.invoiceNumber,
        invoiceDate: invoice.createdAt.toISOString().slice(0, 10),
        amountExVat: Number(invoice.subtotal),
        tax: Number(invoice.tax),
        invoiceAttachmentUrl: pdfUrl,
        clientWorkOrderId: workOrder.id,
      });
      await db.clientWorkOrder.update({
        where: { id: workOrder.id },
        data: result.ok ? { pushedInvoiceAt: new Date(), ourStatus: "INVOICED", lastPushError: null } : { lastPushError: result.error },
      });
    } catch (error: any) {
      console.error("[myBuildings] invoice auto-push failed:", error?.message ?? error);
    }
  }
}
