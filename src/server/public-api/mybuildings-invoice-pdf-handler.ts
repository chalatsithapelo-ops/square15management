import { eventHandler } from "h3";
import jwt from "jsonwebtoken";
import { db } from "~/server/db";
import { env } from "~/server/env";

async function adminToken(): Promise<string> {
  const admin = await db.user.findFirst({
    where: { role: "SENIOR_ADMIN", deletedAt: null },
    select: { id: true },
    orderBy: { id: "asc" },
  });
  if (!admin) throw new Error("No active senior admin available to render the invoice");
  return jwt.sign({ userId: admin.id }, env.JWT_SECRET, { expiresIn: "2m" });
}

export default eventHandler(async (event: any) => {
  const res = event.node?.res;
  if (!res) return "Internal Server Error";
  try {
    // Vinxi's custom HTTP router can expose a request without a valid forwarded
    // host; parse the raw path against a fixed local base instead.
    const requestPath = String(event.node?.req?.url ?? "/");
    const segments = new URL(requestPath, "http://localhost").pathname.split("/").filter(Boolean);
    const token = segments.at(-1)?.replace(/\.pdf$/i, "");
    if (!token) { res.statusCode = 404; return "Not Found"; }
    const record = await db.myBuildingsInvoicePublicToken.findUnique({ where: { token } });
    if (!record) { res.statusCode = 404; return "Invoice link not found"; }
    if (record.expiresAt <= new Date()) { res.statusCode = 410; return "Invoice link expired"; }

    const port = process.env.PORT || "3000";
    const response = await fetch(`http://127.0.0.1:${port}/trpc/generateInvoicePdf`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ json: { token: await adminToken(), invoiceId: record.invoiceId } }),
      signal: AbortSignal.timeout(90_000),
    });
    const payloadResult: any = await response.json().catch(() => null);
    const pdfBase64 = payloadResult?.result?.data?.json?.pdf;
    if (!response.ok || !pdfBase64) {
      const reason = payloadResult?.error?.json?.message || payloadResult?.error?.message || `PDF service returned HTTP ${response.status}`;
      throw new Error(reason);
    }
    const pdf = Buffer.from(pdfBase64, "base64");
    await db.myBuildingsInvoicePublicToken.update({ where: { id: record.id }, data: { usedCount: { increment: 1 } } });
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `inline; filename="invoice-${record.invoiceId}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store, max-age=0");
    res.setHeader("Content-Length", String(pdf.length));
    res.end(pdf);
  } catch (error: any) {
    console.error("[myBuildings] public invoice render failed:", error?.message ?? error);
    if (!res.headersSent) res.statusCode = 500;
    res.end("Invoice PDF unavailable");
  }
});
