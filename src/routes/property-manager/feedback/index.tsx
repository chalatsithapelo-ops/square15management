import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo } from "react";
import toast from "react-hot-toast";
import {
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock,
  MessageSquare,
} from "lucide-react";

import { useAuthStore } from "~/stores/auth";
import { useTRPC } from "~/trpc/react";

export const Route = createFileRoute("/property-manager/feedback/")({
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
  component: PropertyManagerFeedbackPage,
});

function statusBadgeClass(status: string) {
  switch (status) {
    case "OPEN":
      return "bg-blue-50 text-blue-700 border-blue-200";
    case "IN_PROGRESS":
      return "bg-yellow-50 text-yellow-700 border-yellow-200";
    case "RESOLVED":
      return "bg-green-50 text-green-700 border-green-200";
    default:
      return "bg-gray-50 text-gray-700 border-gray-200";
  }
}

function PropertyManagerFeedbackPage() {
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const listQuery = useQuery(
    trpc.getTenantFeedbackForPM.queryOptions(
      { token: token!, take: 100 },
      { enabled: !!token }
    )
  );

  const analyticsQuery = useQuery(
    trpc.getTenantFeedbackAnalyticsForPM.queryOptions(
      { token: token! },
      { enabled: !!token }
    )
  );

  const updateStatusMutation = useMutation(
    trpc.updateTenantFeedbackStatus.mutationOptions({
      onSuccess: () => {
        toast.success("Updated");
        queryClient.invalidateQueries({
          queryKey: trpc.getTenantFeedbackForPM.queryKey({ token: token!, take: 100 }),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getTenantFeedbackAnalyticsForPM.queryKey({ token: token! }),
        });
      },
      onError: (error: any) => {
        toast.error(error?.message || "Failed to update");
      },
    })
  );

  const items: any[] = useMemo(() => {
    const data = listQuery.data;
    return Array.isArray(data) ? (data as any[]) : [];
  }, [listQuery.data]);
  const totals = analyticsQuery.data?.totals;
  const byCategory = analyticsQuery.data?.byCategory ?? [];
  const byBuilding = analyticsQuery.data?.byBuilding ?? [];

  const quickCounts = useMemo(() => {
    return {
      open: items.filter((i: any) => i.status === "OPEN").length,
      inProgress: items.filter((i: any) => i.status === "IN_PROGRESS").length,
      resolved: items.filter((i: any) => i.status === "RESOLVED").length,
    };
  }, [items]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 lg:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <Link
            to="/property-manager/dashboard"
            className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to dashboard
          </Link>

          <h1 className="mt-3 text-3xl font-bold text-gray-900 flex items-center">
            <MessageSquare className="h-8 w-8 mr-3 text-teal-600" />
            Complaints &amp; Compliments
          </h1>
          <p className="text-gray-600 mt-2">
            Review tenant feedback, update status, and track trends.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Total</p>
            <p className="text-2xl font-bold text-gray-900">{totals?.total ?? items.length}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Open</p>
            <p className="text-2xl font-bold text-gray-900">{quickCounts.open}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">In Progress</p>
            <p className="text-2xl font-bold text-gray-900">{quickCounts.inProgress}</p>
          </div>
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
            <p className="text-sm text-gray-600">Resolved</p>
            <p className="text-2xl font-bold text-gray-900">{quickCounts.resolved}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">By category</h2>
            </div>
            <div className="p-6">
              {analyticsQuery.isLoading && <p className="text-gray-600">Loading...</p>}
              {!analyticsQuery.isLoading && byCategory.length === 0 && (
                <p className="text-gray-600">No data yet.</p>
              )}
              {byCategory.length > 0 && (
                <div className="space-y-3">
                  {byCategory.slice(0, 8).map((row: any) => (
                    <div key={row.category} className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{row.category}</p>
                      <p className="text-sm text-gray-600">
                        {row.total} (C: {row.complaints}, +: {row.complements})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center gap-2">
              <BarChart3 className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">By building</h2>
            </div>
            <div className="p-6">
              {analyticsQuery.isLoading && <p className="text-gray-600">Loading...</p>}
              {!analyticsQuery.isLoading && byBuilding.length === 0 && (
                <p className="text-gray-600">No data yet.</p>
              )}
              {byBuilding.length > 0 && (
                <div className="space-y-3">
                  {byBuilding.slice(0, 8).map((row: any) => (
                    <div key={row.buildingId} className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-900">{row.buildingName}</p>
                      <p className="text-sm text-gray-600">
                        {row.total} (C: {row.complaints}, +: {row.complements})
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-500" />
              <h2 className="font-semibold text-gray-900">Latest submissions</h2>
            </div>
            <button
              onClick={() => {
                listQuery.refetch();
                analyticsQuery.refetch();
              }}
              className="text-sm text-gray-600 hover:text-gray-900"
            >
              Refresh
            </button>
          </div>

          <div className="divide-y divide-gray-200">
            {listQuery.isLoading && <div className="p-6 text-gray-600">Loading...</div>}

            {!listQuery.isLoading && items.length === 0 && (
              <div className="p-6 text-gray-600">No tenant feedback yet.</div>
            )}

            {items.map((item: any) => (
              <div key={item.id} className="p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900">
                        {item.type === "COMPLEMENT" ? "Complement" : "Complaint"} · {item.category}
                      </p>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full border ${statusBadgeClass(item.status)}`}
                      >
                        {item.status}
                      </span>
                    </div>

                    <p className="mt-2 text-gray-700 whitespace-pre-wrap">{item.message}</p>

                    <p className="mt-3 text-sm text-gray-600">
                      {item.customer?.firstName} {item.customer?.lastName}
                      {item.customer?.unitNumber ? ` · Unit ${item.customer.unitNumber}` : ""}
                      {item.building?.name ? ` · ${item.building.name}` : ""}
                    </p>

                    <p className="mt-1 text-xs text-gray-500">
                      Submitted {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <select
                      value={item.status}
                      onChange={(e) => {
                        const nextStatus = e.target.value as "OPEN" | "IN_PROGRESS" | "RESOLVED";
                        updateStatusMutation.mutate({
                          token: token!,
                          id: item.id,
                          status: nextStatus,
                        });
                      }}
                      className="rounded-lg border-gray-300 focus:border-teal-500 focus:ring-teal-500"
                      disabled={updateStatusMutation.isPending}
                    >
                      <option value="OPEN">OPEN</option>
                      <option value="IN_PROGRESS">IN_PROGRESS</option>
                      <option value="RESOLVED">RESOLVED</option>
                    </select>

                    <div className="inline-flex items-center text-sm text-gray-500">
                      <CheckCircle2 className="h-4 w-4 mr-1" />
                      Manage
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
