import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useMemo, useState } from "react";
import {
  ArrowLeft,
  Download,
  FileText,
  Loader2,
  Mail,
  Receipt,
} from "lucide-react";
import toast from "react-hot-toast";

export const Route = createFileRoute("/property-manager/statements/")({
  beforeLoad: ({ location }) => {
    if (typeof window === "undefined") return;

    const { user } = useAuthStore.getState();
    if (!user || user.role !== "PROPERTY_MANAGER") {
      throw redirect({
        to: "/",
        search: { redirect: location.href },
      });
    }
  },
  component: PropertyManagerStatementsPage,
});

type StatementView = "RECEIVED" | "ISSUED";

function PropertyManagerStatementsPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const [activeView, setActiveView] = useState<StatementView>("RECEIVED");
  const [generatingPdfId, setGeneratingPdfId] = useState<number | null>(null);

  const queryDefaults = {
    enabled: !!token,
    refetchOnWindowFocus: true,
    refetchInterval: 30000,
  };

  const receivedQuery = useQuery(
    trpc.getStatements.queryOptions(
      {
        token: token || "",
        view: "RECEIVED",
      },
      queryDefaults
    )
  );

  const issuedQuery = useQuery(
    trpc.getStatements.queryOptions(
      {
        token: token || "",
        view: "ISSUED",
      },
      queryDefaults
    )
  );

  const statements = activeView === "RECEIVED" ? receivedQuery.data || [] : issuedQuery.data || [];

  const generateStatementPdfMutation = useMutation(
    trpc.generateStatementPdf.mutationOptions({
      onSuccess: (data, variables) => {
        const byteCharacters = atob(data.pdf);
        const byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
          byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        const byteArray = new Uint8Array(byteNumbers);
        const blob = new Blob([byteArray], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;

        const statement = statements.find((s: any) => s.id === variables.statementId);
        link.download = `statement-${statement?.statement_number || variables.statementId}.pdf`;

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        window.URL.revokeObjectURL(url);

        toast.success("Statement PDF downloaded successfully!");
        setGeneratingPdfId(null);
      },
      onError: (error) => {
        toast.error(error.message || "Failed to download statement PDF");
        setGeneratingPdfId(null);
      },
    })
  );

  const handleDownloadPdf = (statementId: number) => {
    if (!token) return;
    setGeneratingPdfId(statementId);
    generateStatementPdfMutation.mutate({
      token,
      statementId,
    });
  };

  const viewMeta = useMemo(
    () =>
      ({
        RECEIVED: {
          label: "Statements Received",
          description: "Statements addressed to you (typically from contractors/suppliers).",
          icon: Mail,
        },
        ISSUED: {
          label: "Statements Issued",
          description: "Statements issued to customers/tenants you manage.",
          icon: Receipt,
        },
      }) satisfies Record<StatementView, { label: string; description: string; icon: any }>,
    []
  );

  const active = viewMeta[activeView];
  const Icon = active.icon;

  const isLoading = activeView === "RECEIVED" ? receivedQuery.isLoading : issuedQuery.isLoading;
  const error = activeView === "RECEIVED" ? receivedQuery.error : issuedQuery.error;

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-teal-50/30 to-blue-50/30">
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link
                to="/property-manager/dashboard"
                className="inline-flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
              <div className="h-6 w-px bg-gray-200" />
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-teal-600" />
                <h1 className="text-xl font-semibold text-gray-900">Statements</h1>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setActiveView("RECEIVED")}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeView === "RECEIVED"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Received
              </button>
              <button
                type="button"
                onClick={() => setActiveView("ISSUED")}
                className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                  activeView === "ISSUED"
                    ? "bg-teal-600 text-white border-teal-600"
                    : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
                }`}
              >
                Issued
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <div className="flex items-start justify-between gap-6">
            <div className="flex items-start gap-3">
              <div className="p-2 rounded-lg bg-teal-50 border border-teal-100">
                <Icon className="h-5 w-5 text-teal-700" />
              </div>
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{active.label}</h2>
                <p className="text-sm text-gray-600 mt-1">{active.description}</p>
              </div>
            </div>
          </div>

          <div className="mt-6">
            {isLoading && (
              <div className="flex items-center gap-2 text-sm text-gray-600">
                <Loader2 className="h-4 w-4 animate-spin" />
                Loading statements…
              </div>
            )}

            {error && (
              <div className="text-sm text-red-600">{(error as any).message || "Failed to load statements"}</div>
            )}

            {!isLoading && !error && statements.length === 0 && (
              <div className="text-sm text-gray-600">No statements found.</div>
            )}

            {!isLoading && !error && statements.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-gray-600 border-b">
                      <th className="py-3 pr-4 font-medium">Statement</th>
                      <th className="py-3 pr-4 font-medium">Client</th>
                      <th className="py-3 pr-4 font-medium">Period</th>
                      <th className="py-3 pr-4 font-medium">Total Due</th>
                      <th className="py-3 pr-4 font-medium">Status</th>
                      <th className="py-3 pr-0 font-medium text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {statements.map((s: any) => (
                      <tr key={s.id} className="text-gray-900">
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <div className="font-medium">{s.statement_number}</div>
                          <div className="text-xs text-gray-500">{new Date(s.statement_date).toLocaleDateString()}</div>
                        </td>
                        <td className="py-3 pr-4">
                          <div className="font-medium">{s.client_name || "—"}</div>
                          <div className="text-xs text-gray-500">{s.client_email}</div>
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                          {new Date(s.period_start).toLocaleDateString()} – {new Date(s.period_end).toLocaleDateString()}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap text-gray-700">
                          {(s.total_amount_due ?? 0).toLocaleString(undefined, {
                            style: "currency",
                            currency: "ZAR",
                          })}
                        </td>
                        <td className="py-3 pr-4 whitespace-nowrap">
                          <StatusBadge status={s.status} />
                        </td>
                        <td className="py-3 pr-0 whitespace-nowrap text-right">
                          <button
                            type="button"
                            onClick={() => handleDownloadPdf(s.id)}
                            disabled={generatingPdfId === s.id || generateStatementPdfMutation.isPending}
                            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 text-gray-700 disabled:opacity-60"
                          >
                            {generatingPdfId === s.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Download className="h-4 w-4" />
                            )}
                            Download
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const meta: Record<string, { label: string; className: string }> = {
    generated: { label: "Generated", className: "bg-blue-50 text-blue-700 border-blue-200" },
    sent: { label: "Sent", className: "bg-indigo-50 text-indigo-700 border-indigo-200" },
    viewed: { label: "Viewed", className: "bg-gray-50 text-gray-700 border-gray-200" },
    paid: { label: "Paid", className: "bg-green-50 text-green-700 border-green-200" },
    overdue: { label: "Overdue", className: "bg-red-50 text-red-700 border-red-200" },
  };

  const m = meta[status] || meta.generated;
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full border text-xs font-medium ${m.className}`}>
      {m.label}
    </span>
  );
}
