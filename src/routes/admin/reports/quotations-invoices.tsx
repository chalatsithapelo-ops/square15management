import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  Filter,
  FileSpreadsheet,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Receipt,
  Loader2,
  Search,
  Sheet,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/admin/reports/quotations-invoices")({
  component: QuotationsInvoicesReportPage,
});

type Kind = "QUOTATION" | "INVOICE";
type IncludeMode = "BOTH" | "QUOTATION" | "INVOICE";

const JOB_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  JOB_DONE: { label: "Job Done", className: "bg-green-100 text-green-800" },
  IN_PROGRESS: { label: "In Progress", className: "bg-blue-100 text-blue-800" },
  NOT_DONE: { label: "Not Done", className: "bg-gray-100 text-gray-700" },
};

const ORDER_STATUS_LABELS: Record<string, { label: string; className: string }> = {
  HAS_ORDER: { label: "Order", className: "bg-emerald-100 text-emerald-800" },
  NO_ORDER: { label: "No Order", className: "bg-gray-100 text-gray-700" },
  PENDING_FROM_CLIENT: {
    label: "PO Pending",
    className: "bg-amber-100 text-amber-800",
  },
  NO_ORDER_REQUIRED: {
    label: "No Order Required",
    className: "bg-purple-100 text-purple-800",
  },
};

const JOB_CARD_STATUS_LABELS: Record<
  string,
  { label: string; className: string }
> = {
  SIGNED: { label: "Signed", className: "bg-green-100 text-green-800" },
  AWAITING_CLIENT_SIGNATURE: {
    label: "Awaiting Client",
    className: "bg-amber-100 text-amber-800",
  },
  NOT_SIGNED: { label: "Not Signed", className: "bg-orange-100 text-orange-800" },
  NO_JOB_CARD: { label: "No Job Card", className: "bg-gray-100 text-gray-700" },
};

function firstOfMonth(d = new Date()) {
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}
function today() {
  return new Date().toISOString().slice(0, 10);
}

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? "" : String(value);
  if (/[",\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function QuotationsInvoicesReportPage() {
  const { token, user } = useAuthStore();
  const trpc = useTRPC();
  const navigate = useNavigate();

  const [fromDate, setFromDate] = useState<string>(firstOfMonth());
  const [toDate, setToDate] = useState<string>(today());
  const [includeMode, setIncludeMode] = useState<IncludeMode>("BOTH");
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [jobStatusFilter, setJobStatusFilter] = useState<string>("ALL");
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>("ALL");
  const [jobCardFilter, setJobCardFilter] = useState<string>("ALL");
  const [kindFilter, setKindFilter] = useState<"ALL" | Kind>("ALL");

  useEffect(() => {
    if (
      user &&
      !["ADMIN", "SENIOR_ADMIN", "JUNIOR_ADMIN", "MANAGER", "TECHNICAL_MANAGER", "ACCOUNTANT"].includes(user.role)
    ) {
      navigate({ to: "/admin/dashboard" });
    }
  }, [user, navigate]);

  const include: Kind[] =
    includeMode === "BOTH" ? ["QUOTATION", "INVOICE"] : [includeMode];

  const reportQuery = useQuery(
    trpc.getQuotationInvoiceReport.queryOptions(
      {
        token: token!,
        fromDate: fromDate || undefined,
        toDate: toDate || undefined,
        include,
      },
      { enabled: !!token }
    )
  );

  const rows = reportQuery.data?.rows ?? [];
  const summary = reportQuery.data?.summary;

  const filteredRows = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((r) => {
      if (kindFilter !== "ALL" && r.kind !== kindFilter) return false;
      if (jobStatusFilter !== "ALL" && r.jobStatus !== jobStatusFilter) return false;
      if (orderStatusFilter !== "ALL" && r.orderStatus !== orderStatusFilter) return false;
      if (jobCardFilter !== "ALL" && r.jobCardStatus !== jobCardFilter) return false;
      if (!term) return true;
      const hay = [
        r.number,
        r.description,
        r.buildingName,
        r.buildingAddress,
        r.customerEmail,
        r.customerName,
        r.clientName,
        r.artisanName,
        r.orderNumber,
        r.clientOrderNumber,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, searchTerm, kindFilter, jobStatusFilter, orderStatusFilter, jobCardFilter]);

  const filteredTotal = filteredRows.reduce((s, r) => s + (r.amount || 0), 0);

  const handleExportCsv = () => {
    const headers = [
      "Type",
      "Number",
      "Date",
      "Description",
      "Building",
      "Address",
      "Contact Email",
      "Customer",
      "Client",
      "Artisan",
      "Amount",
      "Job Status",
      "Order Status",
      "Job Card Status",
      "Quotation Status",
      "Invoice Status",
      "Order Number (Internal)",
      "Client PO Number",
    ];
    const lines = [headers.join(",")];
    for (const r of filteredRows) {
      lines.push(
        [
          r.kind,
          r.number,
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
          r.description,
          r.buildingName,
          r.buildingAddress,
          r.customerEmail,
          r.customerName,
          r.clientName,
          r.artisanName,
          (r.amount ?? 0).toFixed(2),
          JOB_STATUS_LABELS[r.jobStatus]?.label ?? r.jobStatus,
          ORDER_STATUS_LABELS[r.orderStatus]?.label ?? r.orderStatus,
          JOB_CARD_STATUS_LABELS[r.jobCardStatus]?.label ?? r.jobCardStatus,
          r.quotationStatus,
          r.invoiceStatus,
          r.orderNumber,
          r.clientOrderNumber,
        ]
          .map(csvEscape)
          .join(",")
      );
    }
    // Prepend UTF-8 BOM so Excel opens Rand symbols / accents correctly.
    const csv = "\uFEFF" + lines.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    const range =
      fromDate || toDate
        ? `_${fromDate || "start"}_to_${toDate || "end"}`
        : "";
    a.download = `quotations-invoices-report${range}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 30_000);
  };

  const handleExportXlsx = async () => {
    if (!filteredRows.length) return;
    try {
      const { exportToExcel } = await import("~/utils/reportExport");
      const range =
        fromDate || toDate
          ? `_${fromDate || "start"}_to_${toDate || "end"}`
          : "";
      exportToExcel({
        title: "Quotations & Invoices",
        subtitle:
          fromDate || toDate
            ? `${fromDate || "start"} — ${toDate || "end"}`
            : "All dates",
        filename: `quotations-invoices-report${range}`,
        generatedBy: user?.email ?? undefined,
        data: filteredRows,
        columns: [
          { header: "Type", key: "kind" },
          { header: "Number", key: "number" },
          {
            header: "Date",
            key: "createdAt",
            format: (v) => (v ? new Date(v).toISOString().slice(0, 10) : ""),
          },
          { header: "Description", key: "description" },
          { header: "Building", key: "buildingName" },
          { header: "Address", key: "buildingAddress" },
          { header: "Contact Email", key: "customerEmail" },
          { header: "Customer", key: "customerName" },
          { header: "Client", key: "clientName" },
          { header: "Artisan", key: "artisanName" },
          {
            header: "Amount (R)",
            key: "amount",
            format: (v) => (typeof v === "number" ? v : 0),
          },
          {
            header: "Job Status",
            key: "jobStatus",
            format: (v) => JOB_STATUS_LABELS[v]?.label ?? String(v ?? ""),
          },
          {
            header: "Order Status",
            key: "orderStatus",
            format: (v) => ORDER_STATUS_LABELS[v]?.label ?? String(v ?? ""),
          },
          {
            header: "Job Card Status",
            key: "jobCardStatus",
            format: (v) => JOB_CARD_STATUS_LABELS[v]?.label ?? String(v ?? ""),
          },
          { header: "Quotation Status", key: "quotationStatus" },
          { header: "Invoice Status", key: "invoiceStatus" },
          { header: "Order Number", key: "orderNumber" },
          { header: "Client PO", key: "clientOrderNumber" },
        ],
      });
    } catch (err: any) {
      console.error("[XLSX export] failed", err);
      toast.error(err?.message || "Excel export failed");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="text-gray-600 hover:text-gray-900"
              aria-label="Back to dashboard"
            >
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg sm:text-xl font-semibold text-gray-900">
                Quotations &amp; Invoices Report
              </h1>
              <p className="text-xs text-gray-500">
                Unified end-to-end status across quotes, orders, job cards and invoices
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportXlsx}
              disabled={!filteredRows.length}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg bg-emerald-700 text-white hover:bg-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export as Excel (.xlsx) with a Summary sheet"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Export Excel
            </button>
            <button
              onClick={handleExportCsv}
              disabled={!filteredRows.length}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Export as CSV"
            >
              <Sheet className="h-4 w-4" />
              CSV
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Filters */}
        <div className="bg-white border border-gray-200 rounded-lg p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-700">Filters</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">From</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">To</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Include</label>
              <select
                value={includeMode}
                onChange={(e) => setIncludeMode(e.target.value as IncludeMode)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="BOTH">Quotations &amp; Invoices</option>
                <option value="QUOTATION">Quotations only</option>
                <option value="INVOICE">Invoices only</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
              <select
                value={kindFilter}
                onChange={(e) => setKindFilter(e.target.value as "ALL" | Kind)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="ALL">All</option>
                <option value="QUOTATION">Quotations</option>
                <option value="INVOICE">Invoices</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Status</label>
              <select
                value={jobStatusFilter}
                onChange={(e) => setJobStatusFilter(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="ALL">All</option>
                <option value="JOB_DONE">Job Done</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="NOT_DONE">Not Done</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Order</label>
              <select
                value={orderStatusFilter}
                onChange={(e) => setOrderStatusFilter(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="ALL">All</option>
                <option value="HAS_ORDER">Order</option>
                <option value="NO_ORDER">No Order</option>
                <option value="PENDING_FROM_CLIENT">PO Pending</option>
                <option value="NO_ORDER_REQUIRED">No Order Required</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Job Card</label>
              <select
                value={jobCardFilter}
                onChange={(e) => setJobCardFilter(e.target.value)}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 rounded"
              >
                <option value="ALL">All</option>
                <option value="SIGNED">Signed</option>
                <option value="AWAITING_CLIENT_SIGNATURE">Awaiting Client</option>
                <option value="NOT_SIGNED">Not Signed</option>
                <option value="NO_JOB_CARD">No Job Card</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Search</label>
              <div className="relative">
                <Search className="h-4 w-4 text-gray-400 absolute left-2 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Number, building, email…"
                  className="w-full pl-8 pr-2 py-1.5 text-sm border border-gray-300 rounded"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Summary tiles */}
        {summary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-4">
            <SummaryTile
              icon={<FileText className="h-4 w-4" />}
              label="Quotations"
              value={summary.quotationCount}
            />
            <SummaryTile
              icon={<Receipt className="h-4 w-4" />}
              label="Invoices"
              value={summary.invoiceCount}
            />
            <SummaryTile
              icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
              label="Jobs Done"
              value={summary.jobsDone}
            />
            <SummaryTile
              icon={<Clock className="h-4 w-4 text-blue-600" />}
              label="In Progress"
              value={summary.jobsInProgress}
            />
            <SummaryTile
              icon={<XCircle className="h-4 w-4 text-gray-500" />}
              label="Not Done"
              value={summary.jobsNotDone}
            />
            <SummaryTile
              icon={<CheckCircle2 className="h-4 w-4 text-green-600" />}
              label="Job Cards Signed"
              value={summary.jobCardsSigned}
            />
          </div>
        )}

        {/* Table */}
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          {reportQuery.isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-gray-500 text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Loading report…
            </div>
          ) : reportQuery.isError ? (
            <div className="p-8 text-center text-red-600 text-sm">
              {(reportQuery.error as any)?.message ?? "Failed to load report"}
            </div>
          ) : filteredRows.length === 0 ? (
            <div className="p-8 text-center text-gray-500 text-sm">
              No rows match the current filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase tracking-wider">
                  <tr>
                    <th className="px-3 py-2 text-left">Type</th>
                    <th className="px-3 py-2 text-left">Number</th>
                    <th className="px-3 py-2 text-left">Description</th>
                    <th className="px-3 py-2 text-left">Building</th>
                    <th className="px-3 py-2 text-left">Client</th>
                    <th className="px-3 py-2 text-left">Contact</th>
                    <th className="px-3 py-2 text-right">Amount</th>
                    <th className="px-3 py-2 text-left">Job</th>
                    <th className="px-3 py-2 text-left">Order</th>
                    <th className="px-3 py-2 text-left">Job Card</th>
                    <th className="px-3 py-2 text-left">Quote</th>
                    <th className="px-3 py-2 text-left">Invoice</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredRows.map((r) => (
                    <tr key={`${r.kind}-${r.id}`} className="hover:bg-gray-50">
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium ${
                            r.kind === "QUOTATION"
                              ? "bg-orange-100 text-orange-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {r.kind === "QUOTATION" ? (
                            <FileText className="h-3 w-3" />
                          ) : (
                            <Receipt className="h-3 w-3" />
                          )}
                          {r.kind === "QUOTATION" ? "Quote" : "Invoice"}
                        </span>
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-900 whitespace-nowrap">
                        {r.number}
                        {r.createdAt && (
                          <div className="text-[10px] text-gray-500 font-normal">
                            {new Date(r.createdAt).toLocaleDateString("en-ZA", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            })}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-xs">
                        <div className="truncate" title={r.description || ""}>
                          {r.description || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[180px]">
                        <div className="truncate" title={r.buildingName || ""}>
                          {r.buildingName || "-"}
                        </div>
                        {r.buildingAddress && (
                          <div
                            className="text-[10px] text-gray-500 truncate"
                            title={r.buildingAddress || ""}
                          >
                            {r.buildingAddress}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[160px]">
                        <div className="truncate" title={r.clientName || ""}>
                          {r.clientName || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-gray-700 max-w-[180px]">
                        <div className="truncate" title={r.customerEmail || ""}>
                          {r.customerEmail || "-"}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-right whitespace-nowrap font-medium text-gray-900">
                        R {(r.amount ?? 0).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <StatusPill
                          label={JOB_STATUS_LABELS[r.jobStatus]?.label ?? r.jobStatus}
                          className={JOB_STATUS_LABELS[r.jobStatus]?.className}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <StatusPill
                          label={ORDER_STATUS_LABELS[r.orderStatus]?.label ?? r.orderStatus}
                          className={ORDER_STATUS_LABELS[r.orderStatus]?.className}
                        />
                        {r.clientOrderNumber && (
                          <div className="text-[10px] text-gray-500 mt-0.5">
                            PO: {r.clientOrderNumber}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <StatusPill
                          label={JOB_CARD_STATUS_LABELS[r.jobCardStatus]?.label ?? r.jobCardStatus}
                          className={JOB_CARD_STATUS_LABELS[r.jobCardStatus]?.className}
                        />
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                          {r.quotationStatus.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-700">
                          {r.invoiceStatus.replace(/_/g, " ").toLowerCase()}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={6} className="px-3 py-2 text-right font-semibold text-gray-700">
                      Total ({filteredRows.length} rows)
                    </td>
                    <td className="px-3 py-2 text-right font-bold text-gray-900">
                      R {filteredTotal.toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                    <td colSpan={5} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>

        <p className="mt-3 text-xs text-gray-500">
          Statuses are computed live from the linked Order &amp; Invoice:
          <b> Job Done</b> when the artisan sets the job end time;
          <b> Order</b> when a client PO is captured (or the internal order was created via the assign flow);
          <b> Signed</b> when the client's signature is captured (in person or via the remote signing link).
        </p>
      </div>
    </div>
  );
}

function StatusPill({ label, className }: { label: string; className?: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${className ?? "bg-gray-100 text-gray-700"}`}
    >
      {label}
    </span>
  );
}

function SummaryTile({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
}) {
  return (
    <div className="bg-white border border-gray-200 rounded-lg px-3 py-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-gray-500">{label}</span>
        <span className="text-gray-500">{icon}</span>
      </div>
      <div className="mt-1 text-lg font-semibold text-gray-900">{value}</div>
    </div>
  );
}
