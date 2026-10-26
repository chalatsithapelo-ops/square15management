import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Send, FileText, Loader2, ExternalLink, Link2, Building2, Copy } from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/client-work-orders/$id")({
  component: ClientWorkOrderDetail,
});

const STATUS_OPTIONS = [
  { id: 2, label: "2 · In Progress" },
  { id: 3, label: "3 · On Hold" },
  { id: 6, label: "6 · Contractor Complete" },
];

function ClientWorkOrderDetail() {
  const { id: rawId } = Route.useParams();
  const id = Number(rawId);
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();

  if (!token) return null;

  const q = useQuery(trpc.getClientWorkOrder.queryOptions({ token, id }));
  const wo = q.data as any;

  const [ourStatus, setOurStatus] = useState<string>("NEW");
  const [notes, setNotes] = useState<string>("");
  const [pushStatusId, setPushStatusId] = useState<number>(2);
  const [pushComment, setPushComment] = useState<string>("");
  const [invoiceIdInput, setInvoiceIdInput] = useState<string>("");
  const [orderIdInput, setOrderIdInput] = useState<string>("");
  const [attachmentName, setAttachmentName] = useState<string>("ServiceDocket.pdf");
  const [attachmentUrl, setAttachmentUrl] = useState<string>("");
  const [invoicePublicUrl, setInvoicePublicUrl] = useState<string>("");

  // Sync UI state to fetched data
  if (wo && ourStatus === "NEW" && wo.ourStatus !== "NEW") { /* leave as-is for first load */ }

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: trpc.getClientWorkOrder.queryKey({ token, id }) });
  };

  const localMut = useMutation(
    trpc.updateClientWorkOrderLocal.mutationOptions({
      onSuccess: () => { toast.success("Saved"); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const pushStatusMut = useMutation(
    trpc.pushClientWorkOrderStatus.mutationOptions({
      onSuccess: () => { toast.success("Status pushed to Eris"); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const linkOrderMut = useMutation(
    trpc.linkOrderToClientWorkOrder.mutationOptions({
      onSuccess: (r) => { toast.success(`Order ${r.orderNumber} linked`); setOrderIdInput(""); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const linkInvoiceMut = useMutation(
    trpc.linkInvoiceToClientWorkOrder.mutationOptions({
      onSuccess: () => { toast.success("Invoice linked"); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const pushInvoiceMut = useMutation(
    trpc.pushInvoiceToMyBuildings.mutationOptions({
      onSuccess: () => { toast.success("Invoice pushed to Eris"); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const pushAttMut = useMutation(
    trpc.pushAttachmentToMyBuildings.mutationOptions({
      onSuccess: () => { toast.success("Attachment sent to Eris"); invalidate(); },
      onError: (e) => toast.error(e.message),
    }),
  );
  const genUrlMut = useMutation(
    trpc.generatePublicInvoiceUrl.mutationOptions({
      onSuccess: (r) => { setInvoicePublicUrl(r.url); toast.success("Public URL generated"); },
      onError: (e) => toast.error(e.message),
    }),
  );

  if (q.isLoading) {
    return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-teal-600" /></div>;
  }
  if (!wo) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Not found</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center gap-4">
          <Link to="/admin/client-work-orders" className="text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <div>
              <div className="text-lg font-semibold font-mono">{wo.externalJobCode}</div>
              <div className="text-xs text-gray-500">{wo.externalSite ?? "—"} · Eris ref #{wo.externalId}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* LEFT — details */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-sm font-semibold mb-3">Work order details</h2>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-gray-500">Type</div><div>{wo.title ?? "—"}</div></div>
              <div><div className="text-xs text-gray-500">Priority</div><div>{wo.priority ?? "—"}</div></div>
              <div><div className="text-xs text-gray-500">Eris status</div><div>{wo.externalStatusName ?? "—"} <span className="text-xs text-gray-400">({wo.externalStatusId})</span></div></div>
              <div><div className="text-xs text-gray-500">Client</div><div>{wo.linkedClient?.name || wo.linkedClient?.companyName || "—"}</div></div>
              <div><div className="text-xs text-gray-500">Requested</div><div>{wo.requestedAt ? new Date(wo.requestedAt).toLocaleDateString() : "—"}</div></div>
              <div><div className="text-xs text-gray-500">Required by</div><div>{wo.requiredBy ? new Date(wo.requiredBy).toLocaleDateString() : "—"}</div></div>
              <div><div className="text-xs text-gray-500">Approved amount</div><div>{wo.approvedAmount ? `R ${Number(wo.approvedAmount).toLocaleString()}` : "—"}</div></div>
              <div><div className="text-xs text-gray-500">Assigned</div><div>{wo.assignedToUser ? `${wo.assignedToUser.firstName} ${wo.assignedToUser.lastName}` : "—"}</div></div>
            </div>
            {wo.description && (
              <div className="mt-3">
                <div className="text-xs text-gray-500 mb-1">Description</div>
                <div className="bg-gray-50 rounded p-2 text-xs whitespace-pre-wrap">{wo.description}</div>
              </div>
            )}
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-sm font-semibold mb-3">Our internal state</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-gray-700">Our status</label>
                <select
                  defaultValue={wo.ourStatus}
                  onChange={(e) => setOurStatus(e.target.value)}
                  className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                >
                  {["NEW","IN_PROGRESS","ON_HOLD","CONTRACTOR_COMPLETE","INVOICED","CLOSED"].map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-gray-700">Assign to (user id)</label>
                <input
                  type="number"
                  defaultValue={wo.assignedToUserId ?? ""}
                  onChange={(e) => localMut.mutate({ token, id, assignedToUserId: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                  placeholder="Leave blank to unassign"
                />
              </div>
            </div>
            <div className="mt-3">
              <label className="text-xs font-semibold text-gray-700">Internal notes</label>
              <textarea
                defaultValue={wo.internalNotes ?? ""}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full border rounded px-2 py-1.5 text-sm mt-1"
                rows={3}
              />
            </div>
            <button
              onClick={() => localMut.mutate({ token, id, ourStatus, internalNotes: notes })}
              className="mt-3 px-3 py-1.5 bg-gray-800 text-white text-sm rounded hover:bg-gray-900"
            >Save internal changes</button>
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-2"><Link2 className="w-4 h-4" /> Link Square 15 order</h2>
            {(wo.linkedOrders ?? []).length > 0 ? (
              <div className="space-y-1 text-sm">
                {(wo.linkedOrders as any[]).map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between rounded bg-teal-50 border border-teal-100 p-2">
                    <span><b>{o.orderNumber}</b> · {o.status}</span>
                    <span className="text-xs text-teal-700">Order #{o.id} linked</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <p className="text-xs text-gray-500 mb-2">Link the Artisan Portal order to this Eris job. Once linked, the signed artisan/client job card PDF can be uploaded automatically.</p>
                <div className="flex gap-2">
                  <input value={orderIdInput} onChange={(e) => setOrderIdInput(e.target.value)} type="number" min="1" placeholder="Square 15 Order ID" className="flex-1 border rounded px-2 py-1.5 text-sm" />
                  <button disabled={!orderIdInput || linkOrderMut.isPending} onClick={() => linkOrderMut.mutate({ token, id, orderId: Number(orderIdInput) })} className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm disabled:opacity-50">Link Order</button>
                </div>
              </>
            )}
          </div>

          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2"><Send className="w-4 h-4" /> Push to Eris</h2>

            <div className="border rounded p-3 mb-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Update status on Eris</div>
              <div className="flex gap-2 items-start">
                <select value={pushStatusId} onChange={(e) => setPushStatusId(Number(e.target.value))} className="border rounded px-2 py-1.5 text-sm">
                  {STATUS_OPTIONS.map(o => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <input
                  value={pushComment}
                  onChange={(e) => setPushComment(e.target.value)}
                  placeholder="Optional comment (added to work notes on Eris)"
                  className="flex-1 border rounded px-2 py-1.5 text-sm"
                />
                <button
                  onClick={() => pushStatusMut.mutate({ token, id, newStatusId: pushStatusId, comment: pushComment || undefined })}
                  disabled={pushStatusMut.isPending}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm hover:bg-teal-700 disabled:opacity-50"
                >Push status</button>
              </div>
              {wo.pushedStatusId && (
                <div className="text-[11px] text-emerald-700 mt-1">Last pushed StatusID: {wo.pushedStatusId}{wo.lastPushAt ? ` on ${new Date(wo.lastPushAt).toLocaleString()}` : ""}</div>
              )}
            </div>

            <div className="border rounded p-3 mb-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Attachment (job card / photos)</div>
              <div className="flex gap-2 mb-2">
                <input value={attachmentName} onChange={(e) => setAttachmentName(e.target.value)} placeholder="File name" className="w-40 border rounded px-2 py-1.5 text-sm" />
                <input value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)} placeholder="Public URL to the PDF" className="flex-1 border rounded px-2 py-1.5 text-sm" />
                <button
                  disabled={!attachmentUrl || pushAttMut.isPending}
                  onClick={() => pushAttMut.mutate({ token, id, attachmentName, attachmentUrl })}
                  className="px-3 py-1.5 bg-teal-600 text-white rounded text-sm disabled:opacity-50"
                >Upload</button>
              </div>
              {wo.pushedAttachmentAt && <div className="text-[11px] text-emerald-700">Last attachment pushed {new Date(wo.pushedAttachmentAt).toLocaleString()}</div>}
            </div>

            <div className="border rounded p-3">
              <div className="text-xs font-semibold text-gray-700 mb-1">Invoice</div>
              {wo.linkedInvoice ? (
                <div className="bg-gray-50 rounded p-2 text-xs mb-2">
                  Linked: <span className="font-mono">{wo.linkedInvoice.invoiceNumber}</span> · total R {Number(wo.linkedInvoice.total).toLocaleString()} · status {wo.linkedInvoice.status}
                </div>
              ) : (
                <div className="flex gap-2 mb-2">
                  <input
                    value={invoiceIdInput}
                    onChange={(e) => setInvoiceIdInput(e.target.value)}
                    placeholder="Enter our internal Invoice ID"
                    className="flex-1 border rounded px-2 py-1.5 text-sm"
                  />
                  <button
                    onClick={() => invoiceIdInput && linkInvoiceMut.mutate({ token, id, invoiceId: Number(invoiceIdInput) })}
                    className="px-3 py-1.5 bg-gray-800 text-white rounded text-sm"
                  >Link invoice</button>
                </div>
              )}

              {wo.linkedInvoiceId && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input value={invoicePublicUrl} onChange={(e) => setInvoicePublicUrl(e.target.value)} placeholder="Public URL for invoice PDF (Eris will fetch this)" className="flex-1 border rounded px-2 py-1.5 text-xs font-mono" />
                    <button
                      onClick={() => genUrlMut.mutate({ token, invoiceId: wo.linkedInvoiceId, expiresInHours: 168 })}
                      className="px-2 py-1.5 border rounded text-xs"
                      title="Generate a signed 7-day public URL for our invoice PDF"
                    >Generate URL</button>
                    <button
                      onClick={() => {
                        if (invoicePublicUrl) {
                          navigator.clipboard.writeText(invoicePublicUrl);
                          toast.success("Copied");
                        }
                      }}
                      className="px-2 py-1.5 border rounded text-xs"
                    ><Copy className="w-3 h-3" /></button>
                  </div>
                  <button
                    disabled={!invoicePublicUrl || pushInvoiceMut.isPending || !/^awaiting (upload of )?invoice$/i.test((wo.externalStatusName ?? "").trim())}
                    onClick={() => pushInvoiceMut.mutate({ token, id, invoiceAttachmentUrl: invoicePublicUrl })}
                    className="w-full px-3 py-2 bg-emerald-600 text-white rounded text-sm font-semibold disabled:opacity-50"
                  >
                    {pushInvoiceMut.isPending ? "Uploading…" : "Push invoice to Eris"}
                  </button>
                  <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded p-2">
                    Note: Eris' API only accepts invoices when the work request is in <b>Awaiting Invoice</b> status. Current Eris status: <b>{wo.externalStatusName ?? "?"}</b>.
                  </div>
                  {wo.pushedInvoiceAt && <div className="text-[11px] text-emerald-700">Invoice pushed {new Date(wo.pushedInvoiceAt).toLocaleString()}</div>}
                </div>
              )}
            </div>
            {wo.lastPushError && (
              <div className="mt-3 bg-red-50 border border-red-200 rounded p-2 text-xs text-red-700">
                Last push error: {wo.lastPushError}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — sync log */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border p-4">
            <h2 className="text-sm font-semibold mb-2 flex items-center gap-1.5"><Link2 className="w-4 h-4" /> Sync log</h2>
            <div className="divide-y max-h-[600px] overflow-y-auto text-xs">
              {(wo.syncLogs ?? []).map((l: any) => (
                <div key={l.id} className="py-2">
                  <div className="flex items-center gap-2">
                    <span className={`font-semibold ${l.success ? "text-emerald-700" : "text-red-700"}`}>{l.success ? "OK" : "FAIL"}</span>
                    <span className="text-gray-500">{l.direction}</span>
                    <span className="font-mono">{l.operation}</span>
                    {l.statusCode && <span className="text-gray-400">HTTP {l.statusCode}</span>}
                  </div>
                  {l.errorMessage && <div className="text-red-600 mt-0.5">{l.errorMessage}</div>}
                  <div className="text-gray-400 mt-0.5">{new Date(l.createdAt).toLocaleString()}</div>
                </div>
              ))}
              {(wo.syncLogs ?? []).length === 0 && <div className="text-gray-400 py-2">No sync events yet.</div>}
            </div>
          </div>

          <a
            href={`https://erisproperty.mybuildings.com/`}
            target="_blank"
            rel="noreferrer"
            className="block bg-white border rounded-xl p-3 text-xs text-teal-700 hover:bg-gray-50 inline-flex items-center gap-1.5 w-full"
          >
            <ExternalLink className="w-3.5 h-3.5" /> Open in Eris myBuildings
          </a>
        </div>
      </div>
    </div>
  );
}
