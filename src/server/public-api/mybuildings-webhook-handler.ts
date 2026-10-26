import { eventHandler, getMethod, getHeader } from "h3";
import { upsertWorkRequestFromPayload } from "~/server/services/myBuildings/poller";
import { db } from "~/server/db";

async function readBody(event: any): Promise<string> {
  const req = event?.node?.req;
  if (!req) return "";
  return await new Promise<string>((resolve, reject) => {
    let body = "";
    req.setEncoding?.("utf8");
    req.on("data", (chunk: string) => (body += chunk));
    req.on("end", () => resolve(body));
    req.on("error", (err: unknown) => reject(err));
  });
}

const handler = eventHandler(async (event: any) => {
  const res = event.node?.res;
  if (!res) return "Internal Server Error";

  const method = getMethod(event);
  if (method === "GET") {
    res.statusCode = 200;
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    return "myBuildings webhook endpoint is live. POST work-request payloads here.";
  }
  if (method !== "POST") {
    res.statusCode = 405;
    return "Method Not Allowed";
  }

  // Optional bearer check
  const expected = process.env.MYBUILDINGS_WEBHOOK_BEARER;
  if (expected) {
    const auth = getHeader(event, "authorization") || "";
    if (!auth || auth.replace(/^Bearer\s+/i, "") !== expected) {
      await db.myBuildingsSyncLog.create({
        data: {
          direction: "IN",
          operation: "WEBHOOK_RECEIVED",
          success: false,
          errorMessage: "Unauthorized",
          statusCode: 401,
        },
      });
      res.statusCode = 401;
      return "Unauthorized";
    }
  }

  const raw = await readBody(event);
  let payload: any;
  try {
    payload = raw ? JSON.parse(raw) : {};
  } catch (e: any) {
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "IN",
        operation: "WEBHOOK_RECEIVED",
        success: false,
        errorMessage: `Invalid JSON: ${e?.message ?? e}`,
        requestBody: { raw: raw?.slice(0, 2000) } as any,
      },
    });
    res.statusCode = 400;
    return JSON.stringify({ Success: false, ErrorMessage: "Invalid JSON body" });
  }

  try {
    const result = await upsertWorkRequestFromPayload(payload);
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "IN",
        operation: "WEBHOOK_RECEIVED",
        externalRef: payload?.JobCode ?? String(payload?.WorkRequestID ?? ""),
        clientWorkOrderId: result?.id ?? null,
        success: !!result,
        errorMessage: result ? null : "Missing JobCode/WorkRequestID",
        statusCode: 200,
        requestBody: payload as any,
      },
    });
    res.statusCode = result ? 200 : 400;
    res.setHeader("Content-Type", "application/json");
    return JSON.stringify(result ? { Success: true, ClientWorkOrderId: result.id, Created: result.created } : { Success: false, ErrorMessage: "Missing JobCode or WorkRequestID" });
  } catch (e: any) {
    await db.myBuildingsSyncLog.create({
      data: {
        direction: "IN",
        operation: "WEBHOOK_RECEIVED",
        success: false,
        errorMessage: e?.message ?? String(e),
        requestBody: payload as any,
      },
    });
    res.statusCode = 500;
    return JSON.stringify({ Success: false, ErrorMessage: e?.message ?? "Internal Server Error" });
  }
});

export default handler;
