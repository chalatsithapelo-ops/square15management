import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import {
  ArrowLeft,
  Loader2,
  UserPlus,
  FileText,
  CheckCircle2,
  Wrench,
  Receipt,
  DollarSign,
  Clock,
  ChevronRight,
} from "lucide-react";

const PIPELINE_ROLES = new Set([
  "ADMIN",
  "SENIOR_ADMIN",
  "JUNIOR_ADMIN",
  "MANAGER",
  "TECHNICAL_MANAGER",
  "ACCOUNTANT",
  "SUPERVISOR",
  "SALES_AGENT",
]);

export const Route = createFileRoute("/admin/pipeline/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;
    const { user } = useAuthStore.getState();
    if (!user || !PIPELINE_ROLES.has(user.role as any)) {
      throw redirect({
        to: "/",
        search: { redirect: location.href },
      });
    }
  },
  component: PipelinePage,
});

function fmtMoney(n: number | null | undefined) {
  return `R${(n || 0).toLocaleString()}`;
}

function PipelinePage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();

  const { data, isLoading } = useQuery(
    trpc.getPipeline.queryOptions({ token: token! })
  );

  if (isLoading || !data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-brand-secondary-600" />
      </div>
    );
  }

  const columns: Array<{
    key: string;
    title: string;
    icon: any;
    color: string;
    items: any[];
    render: (item: any) => { title: string; subtitle?: string; meta?: string; href?: string };
    totalLabel?: string;
    total?: number;
  }> = [
    {
      key: "leads",
      title: "Leads",
      icon: UserPlus,
      color: "bg-blue-50 border-blue-200",
      items: data.leads,
      render: (l) => ({
        title: l.customerName || "Untitled lead",
        subtitle: l.serviceType || l.customerEmail || l.customerPhone,
        meta: l.estimatedValue ? fmtMoney(l.estimatedValue) : l.status,
        href: `/admin/leads/`,
      }),
      totalLabel: "Est. value",
      total: data.leads.reduce((s, l: any) => s + (l.estimatedValue || 0), 0),
    },
    {
      key: "quotationsOpen",
      title: "Quotations (Draft)",
      icon: FileText,
      color: "bg-amber-50 border-amber-200",
      items: data.quotationsOpen,
      render: (q) => ({
        title: q.quoteNumber || `Quote #${q.id}`,
        subtitle: q.customerName,
        meta: fmtMoney(q.total),
        href: `/admin/quotations/`,
      }),
      total: data.quotationsOpen.reduce((s, q: any) => s + (q.total || 0), 0),
    },
    {
      key: "quotationsApproved",
      title: "Approved Quotes",
      icon: CheckCircle2,
      color: "bg-emerald-50 border-emerald-200",
      items: data.quotationsApproved,
      render: (q) => ({
        title: q.quoteNumber || `Quote #${q.id}`,
        subtitle: q.customerName,
        meta: fmtMoney(q.total),
        href: `/admin/quotations/`,
      }),
      total: data.quotationsApproved.reduce((s, q: any) => s + (q.total || 0), 0),
    },
    {
      key: "ordersInProgress",
      title: "Jobs In Progress",
      icon: Wrench,
      color: "bg-indigo-50 border-indigo-200",
      items: data.ordersInProgress,
      render: (o) => ({
        title: o.orderNumber || `Order #${o.id}`,
        subtitle: o.customerName,
        meta: o.slaDueAt
          ? `SLA: ${new Date(o.slaDueAt).toLocaleDateString()}`
          : fmtMoney(o.totalCost),
        href: `/admin/operations/`,
      }),
      total: data.ordersInProgress.reduce((s, o: any) => s + (o.totalCost || 0), 0),
    },
    {
      key: "ordersCompletedNoInvoice",
      title: "Completed (Awaiting Invoice)",
      icon: Clock,
      color: "bg-orange-50 border-orange-200",
      items: data.ordersCompletedNoInvoice,
      render: (o) => ({
        title: o.orderNumber || `Order #${o.id}`,
        subtitle: o.customerName,
        meta: fmtMoney(o.totalCost),
        href: `/admin/operations/`,
      }),
      total: data.ordersCompletedNoInvoice.reduce((s, o: any) => s + (o.totalCost || 0), 0),
    },
    {
      key: "invoicesUnpaid",
      title: "Invoices (Unpaid)",
      icon: Receipt,
      color: "bg-red-50 border-red-200",
      items: data.invoicesUnpaid,
      render: (i) => ({
        title: i.invoiceNumber || `INV #${i.id}`,
        subtitle: i.customerName,
        meta: fmtMoney(i.total),
        href: `/admin/invoices/`,
      }),
      total: data.invoicesUnpaid.reduce((s, i: any) => s + (i.total || 0), 0),
    },
    {
      key: "invoicesPaid",
      title: "Paid",
      icon: DollarSign,
      color: "bg-green-50 border-green-200",
      items: data.invoicesPaid,
      render: (i) => ({
        title: i.invoiceNumber || `INV #${i.id}`,
        subtitle: i.customerName,
        meta: fmtMoney(i.total),
        href: `/admin/invoices/`,
      }),
      total: data.invoicesPaid.reduce((s, i: any) => s + (i.total || 0), 0),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 py-3">
        <div className="max-w-[1800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              to="/admin/dashboard"
              className="p-2 hover:bg-gray-100 rounded-lg"
            >
              <ArrowLeft className="h-5 w-5 text-gray-600" />
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">Sales & Job Pipeline</h1>
              <p className="text-xs text-gray-500">
                Live snapshot · {new Date(data.generatedAt as any).toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="p-4 overflow-x-auto">
        <div className="flex gap-4 min-w-max pb-4">
          {columns.map((col) => {
            const Icon = col.icon;
            return (
              <div
                key={col.key}
                className={`w-80 flex-shrink-0 rounded-xl border ${col.color}`}
              >
                <div className="p-3 border-b border-black/5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Icon className="h-4 w-4 text-gray-700" />
                      <h2 className="text-sm font-semibold text-gray-900">{col.title}</h2>
                    </div>
                    <span className="text-xs font-bold bg-white px-2 py-0.5 rounded-full text-gray-700">
                      {col.items.length}
                    </span>
                  </div>
                  {typeof col.total === "number" && col.total > 0 && (
                    <div className="text-xs text-gray-600 mt-1">
                      {col.totalLabel || "Total"}: {fmtMoney(col.total)}
                    </div>
                  )}
                </div>
                <div className="p-2 space-y-2 max-h-[calc(100vh-220px)] overflow-y-auto">
                  {col.items.length === 0 && (
                    <div className="text-xs text-gray-400 text-center py-6">
                      No items
                    </div>
                  )}
                  {col.items.map((item: any) => {
                    const r = col.render(item);
                    const Card = (
                      <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100 hover:shadow-md hover:border-brand-secondary-300 transition-all cursor-pointer group">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-semibold text-gray-900 truncate">
                              {r.title}
                            </div>
                            {r.subtitle && (
                              <div className="text-xs text-gray-600 truncate mt-0.5">
                                {r.subtitle}
                              </div>
                            )}
                            {r.meta && (
                              <div className="text-xs font-medium text-gray-700 mt-1">
                                {r.meta}
                              </div>
                            )}
                          </div>
                          <ChevronRight className="h-4 w-4 text-gray-300 group-hover:text-brand-secondary-600 flex-shrink-0" />
                        </div>
                      </div>
                    );
                    return r.href ? (
                      <Link key={item.id} to={r.href as any}>
                        {Card}
                      </Link>
                    ) : (
                      <div key={item.id}>{Card}</div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
