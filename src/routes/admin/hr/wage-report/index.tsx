import { createFileRoute, Link } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  ArrowLeft, Wallet, Download, Users, Mail, Plus, X, ChevronDown, ChevronRight,
  RefreshCw, Send, CheckCircle2, AlertTriangle, DollarSign, Link as LinkIcon,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/hr/wage-report/")({
  component: WageReportPage,
});

const fmtR = (n: number | null | undefined) =>
  "R" + (n ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const STATUS_COLOR: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 border-amber-200",
  APPROVED: "bg-emerald-100 text-emerald-800 border-emerald-200",
  PAID: "bg-teal-100 text-teal-800 border-teal-200",
  REJECTED: "bg-red-100 text-red-800 border-red-200",
};

function WageReportPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const qc = useQueryClient();
  const [periodKey, setPeriodKey] = useState<"current" | "previous" | "custom">("current");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [expandedArtisan, setExpandedArtisan] = useState<Set<number>>(new Set());
  const [selectedRequests, setSelectedRequests] = useState<Set<number>>(new Set());
  const [newRecipEmail, setNewRecipEmail] = useState("");
  const [newRecipName, setNewRecipName] = useState("");
  const [paymentRef, setPaymentRef] = useState("");

  if (!token || !user || !["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "HR", "TECHNICAL_MANAGER"].includes(user.role)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl p-8 text-center border max-w-md">
          <h1 className="text-lg font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-sm text-gray-600">HR / Admin / Technical Manager only.</p>
          <Link to="/admin/dashboard" className="mt-4 inline-block text-emerald-700 font-medium">Back to Dashboard</Link>
        </div>
      </div>
    );
  }

  const report = useQuery(
    trpc.getFortnightWageReport.queryOptions({
      token,
      periodKey,
      customStart: periodKey === "custom" ? customStart : undefined,
      customEnd: periodKey === "custom" ? customEnd : undefined,
    }),
  );

  const recipientsQ = useQuery(trpc.getWageReportRecipients.queryOptions({ token }));

  const csvQ = useQuery({
    ...trpc.generateNedbankWagePaymentCsv.queryOptions({
      token,
      periodKey,
      customStart: periodKey === "custom" ? customStart : undefined,
      customEnd: periodKey === "custom" ? customEnd : undefined,
      onlyApproved: true,
    }),
    enabled: false,
  });

  const addRecipient = useMutation({
    ...trpc.addWageReportRecipient.mutationOptions(),
    onSuccess: () => {
      toast.success("Recipient added");
      setNewRecipEmail("");
      setNewRecipName("");
      qc.invalidateQueries({ queryKey: trpc.getWageReportRecipients.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeRecipient = useMutation({
    ...trpc.removeWageReportRecipient.mutationOptions(),
    onSuccess: () => {
      toast.success("Recipient removed");
      qc.invalidateQueries({ queryKey: trpc.getWageReportRecipients.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const markPaid = useMutation({
    ...trpc.bulkMarkPaymentRequestsPaid.mutationOptions(),
    onSuccess: (res: any) => {
      toast.success(`Marked ${res.count} requests as PAID`);
      setSelectedRequests(new Set());
      setPaymentRef("");
      qc.invalidateQueries({ queryKey: trpc.getFortnightWageReport.queryKey() });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendNow = useMutation({
    ...trpc.sendFortnightWageReportEmailNow.mutationOptions(),
    onSuccess: (res: any) => toast.success(`Sent to ${res.sent} recipient(s)`),
    onError: (e: any) => toast.error(e.message),
  });

  const data = report.data;

  async function downloadCsv() {
    const res = await csvQ.refetch();
    if (!res.data) {
      toast.error("Failed to build CSV");
      return;
    }
    const { csv, filename, rowCount, missingBank } = res.data;
    if (!rowCount) {
      toast.error("No APPROVED payment requests in this period.");
      return;
    }
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    if (missingBank.length) {
      toast(
        `⚠ ${missingBank.length} artisan(s) skipped (no bank details): ${missingBank.slice(0, 3).join(", ")}${missingBank.length > 3 ? "…" : ""}`,
        { duration: 6000 },
      );
    } else {
      toast.success(`CSV downloaded (${rowCount} beneficiaries)`);
    }
  }

  const toggleArtisan = (id: number) => {
    const s = new Set(expandedArtisan);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setExpandedArtisan(s);
  };

  const toggleRequest = (id: number) => {
    const s = new Set(selectedRequests);
    if (s.has(id)) s.delete(id);
    else s.add(id);
    setSelectedRequests(s);
  };

  const periodLabel = useMemo(() => {
    if (!data?.period) return "";
    const s = new Date(data.period.start).toLocaleDateString("en-ZA");
    const e = new Date(new Date(data.period.end).getTime() - 1).toLocaleDateString("en-ZA");
    return `${s} — ${e}`;
  }, [data]);

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <Link to="/admin/hr" className="p-2 hover:bg-gray-100 rounded-lg">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </Link>
            <div className="bg-gradient-to-br from-emerald-700 to-emerald-900 p-2 rounded-xl shadow">
              <Wallet className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Fortnight Artisan Wage Report</h1>
              <p className="text-xs text-gray-500">{periodLabel || "Loading period…"}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => report.refetch()}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${report.isRefetching ? "animate-spin" : ""}`} /> Refresh
            </button>
            <button
              onClick={downloadCsv}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-emerald-300 text-emerald-800 rounded-lg text-sm hover:bg-emerald-50"
              title="Download Nedbank Business Online bulk-payment CSV (APPROVED requests only)"
            >
              <Download className="w-4 h-4" /> Nedbank payment CSV
            </button>
            <button
              onClick={() => sendNow.mutate({ token, periodKey: periodKey === "current" ? "current" : "previous" })}
              disabled={sendNow.isPending}
              className="inline-flex items-center gap-1.5 px-3 py-2 bg-emerald-800 text-white rounded-lg text-sm hover:bg-emerald-900 disabled:opacity-50"
            >
              <Send className="w-4 h-4" /> {sendNow.isPending ? "Sending…" : "Send email now"}
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-4">
        {/* Period selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold text-gray-700">Period:</span>
          {(["current", "previous", "custom"] as const).map((k) => (
            <button
              key={k}
              onClick={() => setPeriodKey(k)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border ${
                periodKey === k ? "bg-emerald-700 text-white border-emerald-700" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
              }`}
            >
              {k === "current" ? "Current fortnight" : k === "previous" ? "Previous fortnight" : "Custom range"}
            </button>
          ))}
          {periodKey === "custom" && (
            <>
              <input
                type="date"
                value={customStart}
                onChange={(e) => setCustomStart(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
              <span className="text-xs text-gray-500">to</span>
              <input
                type="date"
                value={customEnd}
                onChange={(e) => setCustomEnd(e.target.value)}
                className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm"
              />
            </>
          )}
        </div>

        {/* Summary cards */}
        {data && (data.grand.pending > 50000 || data.grand.approved > 50000) && (
          <div data-testid="wage-backlog-banner" className="bg-red-50 border-2 border-red-300 rounded-xl p-4 flex items-center gap-3">
            <div className="text-red-700 font-bold text-lg">!</div>
            <div className="flex-1">
              <div className="font-semibold text-red-900">Wage backlog alert</div>
              <div className="text-sm text-red-800">
                {"R" + (data.grand.pending + data.grand.approved).toLocaleString("en-ZA", { minimumFractionDigits: 2 })} in unpaid wages (PENDING + APPROVED). Review and process without delay.
              </div>
            </div>
          </div>
        )}
        {data && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard label="Pending" value={fmtR(data.grand.pending)} tone="amber" />
            <SummaryCard label="Approved (ready to pay)" value={fmtR(data.grand.approved)} tone="emerald" />
            <SummaryCard label="Paid" value={fmtR(data.grand.paid)} tone="teal" />
            <SummaryCard label="Total (all statuses)" value={fmtR(data.grand.all)} tone="gray" />
          </div>
        )}

        {/* Payment action bar */}
        {selectedRequests.size > 0 && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-emerald-900">
              {selectedRequests.size} request(s) selected
            </span>
            <input
              value={paymentRef}
              onChange={(e) => setPaymentRef(e.target.value)}
              placeholder="Payment reference (e.g. Nedbank batch #123)"
              className="flex-1 min-w-[200px] px-3 py-1.5 border border-emerald-300 rounded-lg text-sm bg-white"
            />
            <button
              onClick={() =>
                markPaid.mutate({
                  token,
                  requestIds: Array.from(selectedRequests),
                  paymentReference: paymentRef || undefined,
                })
              }
              disabled={markPaid.isPending}
              className="px-4 py-1.5 bg-emerald-700 text-white rounded-lg text-sm font-semibold hover:bg-emerald-800 disabled:opacity-50"
            >
              {markPaid.isPending ? "Marking…" : "Mark as PAID"}
            </button>
            <button
              onClick={() => setSelectedRequests(new Set())}
              className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-white"
            >
              Clear
            </button>
          </div>
        )}

        {/* Per-artisan table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200">
            <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
              <Users className="w-4 h-4 text-emerald-700" /> By artisan
            </h2>
          </div>
          {report.isLoading ? (
            <div className="p-8 text-center text-gray-500 text-sm">Loading report…</div>
          ) : !data || data.artisans.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No payment requests in this period.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase text-gray-600">
                <tr>
                  <th className="w-8 px-3 py-2"></th>
                  <th className="text-left px-3 py-2">Artisan</th>
                  <th className="text-right px-3 py-2">Requests</th>
                  <th className="text-right px-3 py-2 text-amber-700">Pending</th>
                  <th className="text-right px-3 py-2 text-emerald-700">Approved</th>
                  <th className="text-right px-3 py-2 text-teal-700">Paid</th>
                  <th className="text-right px-3 py-2 font-bold">Total</th>
                </tr>
              </thead>
              <tbody>
                {data.artisans.map((a: any) => {
                  const artisanId = a.artisan.id;
                  const isOpen = expandedArtisan.has(artisanId);
                  const name = `${a.artisan.firstName ?? ""} ${a.artisan.lastName ?? ""}`.trim();
                  const hasBankDetails = !!a.artisan.contractorCompanyBankAccountNumber;
                  return (
                    <>
                      <tr
                        key={artisanId}
                        className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer"
                        onClick={() => toggleArtisan(artisanId)}
                      >
                        <td className="px-3 py-2">
                          {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                        </td>
                        <td className="px-3 py-2">
                          <div className="font-semibold text-gray-900">{name || `#${artisanId}`}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-2">
                            {a.artisan.hourlyRate ? `R${a.artisan.hourlyRate}/hr` : ""}
                            {a.artisan.hourlyRate && a.artisan.dailyRate ? " · " : ""}
                            {a.artisan.dailyRate ? `R${a.artisan.dailyRate}/day` : ""}
                            {!hasBankDetails && (
                              <span className="inline-flex items-center gap-1 text-amber-700">
                                <AlertTriangle className="w-3 h-3" /> No bank details
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">{a.rows.length}</td>
                        <td className="px-3 py-2 text-right text-amber-700">{fmtR(a.totalPending)}</td>
                        <td className="px-3 py-2 text-right text-emerald-700">{fmtR(a.totalApproved)}</td>
                        <td className="px-3 py-2 text-right text-teal-700">{fmtR(a.totalPaid)}</td>
                        <td className="px-3 py-2 text-right font-bold">{fmtR(a.totalAll)}</td>
                      </tr>
                      {isOpen && (
                        <tr>
                          <td colSpan={7} className="bg-gray-50 px-4 py-3">
                            <div className="space-y-2">
                              {a.rows.map((r: any) => (
                                <div
                                  key={r.id}
                                  className="bg-white border border-gray-200 rounded-lg p-3"
                                >
                                  <div className="flex items-center justify-between flex-wrap gap-2">
                                    <div className="flex items-center gap-2">
                                      {(r.status === "APPROVED" || r.status === "PENDING") && (
                                        <input
                                          type="checkbox"
                                          checked={selectedRequests.has(r.id)}
                                          onChange={() => toggleRequest(r.id)}
                                          className="w-4 h-4 accent-emerald-700"
                                        />
                                      )}
                                      <span className="font-mono text-xs text-gray-700">{r.requestNumber}</span>
                                      <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded border ${STATUS_COLOR[r.status] || "bg-gray-100"}`}>
                                        {r.status}
                                      </span>
                                      <span className="text-xs text-gray-600">
                                        {r.rateType === "HOURLY"
                                          ? `${r.hoursWorked ?? "?"}h @ R${r.hourlyRate}/hr`
                                          : `${r.daysWorked ?? "?"}d @ R${r.dailyRate}/day`}
                                      </span>
                                    </div>
                                    <div className="font-bold text-gray-900">{fmtR(r.amount)}</div>
                                  </div>
                                  <div className="mt-2 space-y-1">
                                    {r.orders.map((o: any) => (
                                      <div key={o.orderId} className="text-xs text-gray-700 flex items-center gap-2 flex-wrap">
                                        <span className="font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">
                                          {o.orderNumber}
                                        </span>
                                        <span className="text-gray-500">{o.serviceType} — {o.client}</span>
                                        {o.description && <span className="italic text-gray-500 truncate max-w-[280px]">"{o.description}"</span>}
                                        {o.joinCode && (
                                          <span
                                            className="inline-flex items-center gap-1 text-[10px] font-mono bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded"
                                            title={o.joinedViaCode ? `Joined this job using code ${o.joinCode}` : `LEAD on this job; shared code ${o.joinCode}`}
                                          >
                                            <LinkIcon className="w-2.5 h-2.5" /> code {o.joinCode} · {o.role}
                                          </span>
                                        )}
                                        {o.clientOrderNumber ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded">
                                            PO: {o.clientOrderNumber}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-gray-400 italic">no PO</span>
                                        )}
                                        {o.invoice ? (
                                          <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-50 text-emerald-700 px-1.5 py-0.5 rounded">
                                            {o.invoice.invoiceNumber} · {o.invoice.status}
                                          </span>
                                        ) : (
                                          <span className="text-[10px] text-amber-700 italic">not invoiced</span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
              </tbody>
              {data && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50">
                    <td></td>
                    <td className="px-3 py-2 font-bold text-right">Grand total →</td>
                    <td className="px-3 py-2 text-right font-semibold">{data.requestCount}</td>
                    <td className="px-3 py-2 text-right font-bold text-amber-700">{fmtR(data.grand.pending)}</td>
                    <td className="px-3 py-2 text-right font-bold text-emerald-700">{fmtR(data.grand.approved)}</td>
                    <td className="px-3 py-2 text-right font-bold text-teal-700">{fmtR(data.grand.paid)}</td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">{fmtR(data.grand.all)}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          )}
        </div>

        {/* Recipients */}
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <h2 className="text-sm font-semibold text-gray-900 flex items-center gap-2 mb-3">
            <Mail className="w-4 h-4 text-emerald-700" /> Email recipients (fortnight report)
          </h2>
          <div className="space-y-1 mb-3">
            {(recipientsQ.data ?? []).filter((r: any) => r.isActive).map((r: any) => (
              <div key={r.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
                <div>
                  <div className="font-medium text-gray-900">{r.name || r.email}</div>
                  {r.name && <div className="text-xs text-gray-500">{r.email}</div>}
                </div>
                <button
                  onClick={() => removeRecipient.mutate({ token, id: r.id })}
                  className="text-gray-400 hover:text-red-600"
                  title="Remove"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            {(recipientsQ.data ?? []).filter((r: any) => r.isActive).length === 0 && (
              <div className="text-xs text-gray-500 italic">No recipients yet.</div>
            )}
          </div>
          <div className="flex gap-2 flex-wrap">
            <input
              value={newRecipEmail}
              onChange={(e) => setNewRecipEmail(e.target.value)}
              placeholder="email@example.com"
              className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <input
              value={newRecipName}
              onChange={(e) => setNewRecipName(e.target.value)}
              placeholder="Name (optional)"
              className="w-[180px] px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
            <button
              onClick={() => addRecipient.mutate({ token, email: newRecipEmail, name: newRecipName || undefined })}
              disabled={!newRecipEmail || addRecipient.isPending}
              className="inline-flex items-center gap-1 px-3 py-2 bg-emerald-700 text-white rounded-lg text-sm hover:bg-emerald-800 disabled:opacity-50"
            >
              <Plus className="w-4 h-4" /> Add
            </button>
          </div>
        </div>

        {/* Payment execution info */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm">
          <h3 className="font-semibold text-blue-900 flex items-center gap-2 mb-2">
            <DollarSign className="w-4 h-4" /> Paying artisans via the system
          </h3>
          <ol className="list-decimal list-inside space-y-1 text-blue-900">
            <li>Review the report and confirm PENDING requests are correct.</li>
            <li>Approve requests on the <Link to="/admin/payment-requests" className="underline">Payment Requests page</Link>.</li>
            <li>Download the <b>Nedbank payment CSV</b> — includes only APPROVED requests, one row per artisan with consolidated totals.</li>
            <li>Upload the CSV to Nedbank Business Online → <i>Payments → Bulk file upload</i>.</li>
            <li>Come back and use the check-boxes above + <b>Mark as PAID</b> once the bank confirms the batch.</li>
          </ol>
          <p className="text-xs text-blue-800 mt-2">
            Requires each artisan to have bank details set on their user profile
            (Contractor bank fields: name, account number, branch code).
            A future upgrade will push disbursements directly via Stitch Pay so uploads become unnecessary.
          </p>
        </div>
      </main>
    </div>
  );
}

function SummaryCard({ label, value, tone }: { label: string; value: string; tone: "amber" | "emerald" | "teal" | "gray" }) {
  const toneCls: Record<string, string> = {
    amber: "bg-amber-50 border-amber-200 text-amber-800",
    emerald: "bg-emerald-50 border-emerald-200 text-emerald-800",
    teal: "bg-teal-50 border-teal-200 text-teal-800",
    gray: "bg-gray-50 border-gray-200 text-gray-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${toneCls[tone]}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}
