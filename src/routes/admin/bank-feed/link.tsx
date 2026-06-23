import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useAuthStore } from "~/stores/auth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "~/trpc/react";
import { useState } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  Link2,
  Unlink,
  RefreshCw,
  CheckCircle,
  AlertTriangle,
  Loader2,
  Landmark,
  ShieldCheck,
  Clock,
} from "lucide-react";

export const Route = createFileRoute("/admin/bank-feed/link")({
  component: LinkBankAccountPage,
  validateSearch: (raw: Record<string, unknown>) => ({
    status: typeof raw.status === "string" ? raw.status : undefined,
    reason: typeof raw.reason === "string" ? raw.reason : undefined,
    account: typeof raw.account === "string" ? raw.account : undefined,
  }),
});

function LinkBankAccountPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const search = useSearch({ from: "/admin/bank-feed/link" }) as {
    status?: string;
    reason?: string;
    account?: string;
  };
  const [busyId, setBusyId] = useState<number | null>(null);

  const accountsQuery = useQuery({
    ...trpc.getBankAccounts.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const providersQuery = useQuery({
    ...trpc.getBankFeedProviders.queryOptions({ token: token! }),
    enabled: !!token,
  });

  const accounts = accountsQuery.data || [];
  const providers = providersQuery.data?.providers || [];
  const enabledProviders = providers.filter((p) => p.enabled);

  const startLink = useMutation({
    ...trpc.linkBankAccountStart.mutationOptions(),
    onSuccess: (data) => {
      window.location.href = data.authorizeUrl;
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to start linking");
      setBusyId(null);
    },
  });

  const unlink = useMutation({
    ...trpc.unlinkBankAccountFeed.mutationOptions(),
    onSuccess: () => {
      toast.success("Bank account unlinked");
      queryClient.invalidateQueries({ queryKey: trpc.getBankAccounts.queryKey() });
      setBusyId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Failed to unlink");
      setBusyId(null);
    },
  });

  const backfill = useMutation({
    ...trpc.backfillBankAccountFeed.mutationOptions(),
    onSuccess: (r: any) => {
      toast.success(`Backfilled: ${r.newCount} new, ${r.duplicateCount} duplicates`);
      queryClient.invalidateQueries({ queryKey: trpc.getBankAccounts.queryKey() });
      setBusyId(null);
    },
    onError: (err: any) => {
      toast.error(err?.message || "Backfill failed");
      setBusyId(null);
    },
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 flex items-center gap-3">
          <Link
            to="/admin/bank-feed"
            className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Bank Feed
          </Link>
        </div>

        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Link2 className="w-8 h-8 text-blue-600" /> Direct Bank Link
          </h1>
          <p className="text-gray-600 mt-2">
            Connect your bank account through a regulated SA aggregator (Stitch or Mono) for live,
            automatic transaction sync. No credentials are stored on our servers — you log in
            on the provider's secure portal and approve consent.
          </p>
        </div>

        {/* Callback flash messages */}
        {search.status === "linked" && (
          <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 flex items-start gap-3">
            <CheckCircle className="w-5 h-5 text-green-600 mt-0.5" />
            <div>
              <div className="font-semibold text-green-800">Bank account linked</div>
              <div className="text-sm text-green-700">
                Initial backfill of the last 90 days has started. New transactions will arrive
                via webhook in real time.
              </div>
            </div>
          </div>
        )}
        {search.status === "error" && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5" />
            <div>
              <div className="font-semibold text-red-800">Linking failed</div>
              <div className="text-sm text-red-700">{search.reason || "Unknown error"}</div>
            </div>
          </div>
        )}

        {/* Security card */}
        <div className="mb-6 rounded-lg border border-blue-200 bg-blue-50 p-4 flex items-start gap-3">
          <ShieldCheck className="w-5 h-5 text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-900">
            <div className="font-semibold">How it works</div>
            <ul className="mt-1 space-y-1 list-disc list-inside">
              <li>You click <strong>Link with Stitch</strong> below.</li>
              <li>Stitch redirects you to your bank's official login. We never see your credentials.</li>
              <li>You approve read-only access to transactions.</li>
              <li>We receive a refresh token, encrypt it (AES-256-GCM), and use it to pull your transactions.</li>
              <li>You can unlink at any time.</li>
            </ul>
          </div>
        </div>

        {/* Account list */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
            <h2 className="font-semibold text-gray-800">Bank Accounts</h2>
            <button
              onClick={() => accountsQuery.refetch()}
              className="text-xs text-gray-500 hover:text-gray-800"
            >
              <RefreshCw className="w-3 h-3 inline mr-1" /> Refresh
            </button>
          </div>

          {accountsQuery.isLoading ? (
            <div className="p-12 text-center text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mx-auto" />
            </div>
          ) : accounts.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No bank accounts yet.{" "}
              <Link to="/admin/bank-feed" className="text-blue-600 underline">
                Create one first
              </Link>
              .
            </div>
          ) : (
            <ul className="divide-y">
              {accounts.map((a: any) => {
                const linked = !!a.externalProvider;
                const consentExpired =
                  a.externalConsentExpiry && new Date(a.externalConsentExpiry) < new Date();
                return (
                  <li key={a.id} className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center">
                        <Landmark className="w-5 h-5 text-gray-600" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-gray-900 truncate">
                          {a.accountName}
                        </div>
                        <div className="text-xs text-gray-500">
                          {a.bankName} · ****{a.accountNumber}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs">
                          {linked ? (
                            <>
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                                <CheckCircle className="w-3 h-3" /> {a.externalProvider}
                              </span>
                              {a.externalLastSyncAt && (
                                <span className="inline-flex items-center gap-1 text-gray-500">
                                  <Clock className="w-3 h-3" />
                                  Last sync:{" "}
                                  {new Date(a.externalLastSyncAt).toLocaleString()}
                                </span>
                              )}
                              {consentExpired && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-800">
                                  <AlertTriangle className="w-3 h-3" /> Re-consent needed
                                </span>
                              )}
                              {a.externalLastError && (
                                <span
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-100 text-red-700 max-w-xs truncate"
                                  title={a.externalLastError}
                                >
                                  <AlertTriangle className="w-3 h-3" /> Error
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-500">Not linked</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {linked ? (
                        <>
                          <button
                            disabled={busyId === a.id}
                            onClick={() => {
                              setBusyId(a.id);
                              backfill.mutate({
                                token: token!,
                                bankAccountId: a.id,
                                sinceDays: 30,
                              });
                            }}
                            className="px-3 py-1.5 text-sm rounded-md border border-gray-300 hover:bg-gray-50 disabled:opacity-50"
                          >
                            {busyId === a.id && backfill.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <RefreshCw className="w-4 h-4 inline mr-1" /> Sync 30d
                              </>
                            )}
                          </button>
                          <button
                            disabled={busyId === a.id}
                            onClick={() => {
                              if (
                                !confirm(
                                  `Unlink ${a.accountName}? Existing transactions stay in the system.`
                                )
                              )
                                return;
                              setBusyId(a.id);
                              unlink.mutate({ token: token!, bankAccountId: a.id });
                            }}
                            className="px-3 py-1.5 text-sm rounded-md border border-red-300 text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <Unlink className="w-4 h-4 inline mr-1" /> Unlink
                          </button>
                        </>
                      ) : enabledProviders.length === 0 ? (
                        <span className="text-xs text-gray-500 italic">
                          No direct-bank provider is configured on this server.
                        </span>
                      ) : (
                        <div className="flex items-center gap-2">
                          {enabledProviders.map((p) => (
                            <button
                              key={p.id}
                              disabled={busyId === a.id}
                              onClick={() => {
                                setBusyId(a.id);
                                startLink.mutate({
                                  token: token!,
                                  bankAccountId: a.id,
                                  provider: p.id,
                                });
                              }}
                              className={
                                p.id === "MONO"
                                  ? "px-3 py-1.5 text-sm rounded-md bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                                  : "px-3 py-1.5 text-sm rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
                              }
                            >
                              {busyId === a.id && startLink.isPending ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <Link2 className="w-4 h-4 inline mr-1" /> Link with {p.label}
                                </>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
