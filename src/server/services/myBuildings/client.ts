import { db } from "~/server/db";

interface CallOptions {
  clientWorkOrderId?: number | null;
  operation: string;
  externalRef?: string | null;
}

const BASE = () => (process.env.MYBUILDINGS_BASE_URL || "https://erisproperty.mybuildings.com").replace(/\/+$/, "");
const TOKEN = () => process.env.MYBUILDINGS_API_TOKEN || "";

async function apiCall<T = any>(
  method: "GET" | "POST",
  path: string,
  body: any | null,
  opts: CallOptions,
): Promise<{ ok: boolean; status: number; data: T | null; error: string | null }> {
  if (!TOKEN()) {
    const err = "MYBUILDINGS_API_TOKEN not configured";
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "OUT",
        operation: opts.operation,
        externalRef: opts.externalRef ?? null,
        success: false,
        errorMessage: err,
        clientWorkOrderId: opts.clientWorkOrderId ?? null,
      },
    });
    return { ok: false, status: 0, data: null, error: err };
  }
  const url = `${BASE()}${path}`;
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "Authorization": `Bearer ${TOKEN()}`,
        "Content-Type": "application/json",
        "Accept": "application/json",
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* keep text */ }
    const success = res.ok && (json?.Success !== false);
    const errorMsg = success ? null : (json?.ErrorMessage || json?.error || text?.slice(0, 400) || `HTTP ${res.status}`);
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "OUT",
        operation: opts.operation,
        externalRef: opts.externalRef ?? null,
        statusCode: res.status,
        success,
        errorMessage: errorMsg,
        requestBody: (body ?? null) as any,
        responseBody: (json ?? { raw: text?.slice(0, 2000) }) as any,
        clientWorkOrderId: opts.clientWorkOrderId ?? null,
      },
    });
    console.log(`[myBuildings] ${method} ${path} → ${res.status} ${success ? "OK" : "FAIL"} (${Date.now() - started}ms)${errorMsg ? " " + errorMsg : ""}`);
    return { ok: success, status: res.status, data: json, error: errorMsg };
  } catch (err: any) {
    const errMsg = err?.message || String(err);
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "OUT",
        operation: opts.operation,
        externalRef: opts.externalRef ?? null,
        success: false,
        errorMessage: errMsg,
        requestBody: (body ?? null) as any,
        clientWorkOrderId: opts.clientWorkOrderId ?? null,
      },
    });
    return { ok: false, status: 0, data: null, error: errMsg };
  }
}

export async function listWorkRequests(): Promise<any> {
  return apiCall("GET", "/core/api/workrequests/v1", null, { operation: "LIST_WORK_REQUESTS" });
}

export async function updateWorkRequestStatus(input: {
  workRequestId?: number | null;
  jobCode?: string | null;
  newStatusId: number;
  comment?: string;
  clientWorkOrderId?: number | null;
}) {
  const body: any = { NewStatusID: input.newStatusId };
  if (input.workRequestId) body.WorkRequestID = input.workRequestId;
  if (input.jobCode) body.JobCode = input.jobCode;
  if (input.comment) body.Comment = input.comment;
  return apiCall("POST", "/core/api/workrequest/v1/update", body, {
    operation: "UPDATE_STATUS",
    externalRef: input.jobCode ?? String(input.workRequestId ?? ""),
    clientWorkOrderId: input.clientWorkOrderId,
  });
}

export async function uploadInvoice(input: {
  workRequestId?: number | null;
  jobCode?: string | null;
  invoiceNumber: string;
  invoiceDate: string;
  amountExVat: number;
  tax: number;
  invoiceAttachmentUrl: string;
  clientWorkOrderId?: number | null;
}) {
  const body: any = {
    InvoiceNumber: input.invoiceNumber,
    InvoiceDate: input.invoiceDate,
    InvoiceAmount_ExcludingTax: String(input.amountExVat),
    InvoiceTax: String(input.tax),
    InvoiceAttachmentURL: input.invoiceAttachmentUrl,
  };
  if (input.workRequestId) body.WorkRequestID = input.workRequestId;
  if (input.jobCode) body.JobCode = input.jobCode;
  return apiCall("POST", "/core/api/contractorinvoice/v1", body, {
    operation: "UPLOAD_INVOICE",
    externalRef: input.jobCode ?? String(input.workRequestId ?? ""),
    clientWorkOrderId: input.clientWorkOrderId,
  });
}

export async function uploadAttachment(input: {
  workRequestId?: number | null;
  jobCode?: string | null;
  attachmentName: string;
  attachmentUrl: string;
  attachmentExtension?: string;
  clientWorkOrderId?: number | null;
}) {
  const body: any = {
    Attachment_Name: input.attachmentName,
    Attachment_URL: input.attachmentUrl,
  };
  if (input.attachmentExtension) body.Attachment_Extension = input.attachmentExtension;
  if (input.workRequestId) body.WorkRequestID = input.workRequestId;
  if (input.jobCode) body.JobCode = input.jobCode;
  return apiCall("POST", "/core/api/workrequest/v1/attachment", body, {
    operation: "UPLOAD_ATTACHMENT",
    externalRef: input.jobCode ?? String(input.workRequestId ?? ""),
    clientWorkOrderId: input.clientWorkOrderId,
  });
}

export async function testConnection() {
  const res = await listWorkRequests();
  return { ok: res.ok, status: res.status, error: res.error };
}
