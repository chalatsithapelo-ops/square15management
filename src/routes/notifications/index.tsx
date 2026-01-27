import { createFileRoute } from '@tanstack/react-router'
import { z } from "zod";
import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Check, CheckCheck, Clock } from "lucide-react";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import toast from "react-hot-toast";

export const Route = createFileRoute('/notifications/')({
  validateSearch: (search) =>
    z
      .object({
        focus: z.coerce.number().int().positive().optional(),
      })
      .parse(search),
  component: RouteComponent,
})

function RouteComponent() {
  const trpc = useTRPC();
  const { token } = useAuthStore();
  const queryClient = useQueryClient();

  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [limit, setLimit] = useState(100);

  const { focus: focusId } = Route.useSearch();

  const unreadCountQuery = useQuery({
    ...trpc.getUnreadNotificationCount.queryOptions({ token: token! }),
    enabled: !!token,
    refetchOnWindowFocus: true,
  });

  const notificationsQuery = useQuery({
    ...trpc.getNotifications.queryOptions({
      token: token!,
      limit,
      ...(showUnreadOnly ? { isRead: false } : {}),
    }),
    enabled: !!token,
    refetchOnWindowFocus: true,
  });

  const markAsReadMutation = useMutation(
    trpc.markNotificationAsRead.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.getNotifications.queryKey() });
        await queryClient.invalidateQueries({ queryKey: trpc.getUnreadNotificationCount.queryKey() });
      },
      onError: (error) => toast.error(error.message || "Failed to mark notification as read"),
    })
  );

  const markAllAsReadMutation = useMutation(
    trpc.markAllNotificationsAsRead.mutationOptions({
      onSuccess: async () => {
        toast.success("All notifications marked as read");
        await queryClient.invalidateQueries({ queryKey: trpc.getNotifications.queryKey() });
        await queryClient.invalidateQueries({ queryKey: trpc.getUnreadNotificationCount.queryKey() });
      },
      onError: (error) => toast.error(error.message || "Failed to mark all notifications as read"),
    })
  );

  const list = notificationsQuery.data ?? [];
  const unreadCount = unreadCountQuery.data ?? 0;

  const focusRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!focusId) return;
    if (!list.length) return;

    // Scroll into view once data is available
    requestAnimationFrame(() => {
      focusRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
  }, [focusId, list.length]);

  const formatTimestamp = (date: Date) => {
    const now = new Date();
    const notificationDate = new Date(date);
    const diffMs = now.getTime() - notificationDate.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return notificationDate.toLocaleDateString();
  };

  if (!token) {
    return (
      <div className="p-6">
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-center text-sm text-gray-600">
          Please log in to view notifications.
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Notifications</h1>
          <p className="text-sm text-gray-600">{unreadCount} unread</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowUnreadOnly((v) => !v)}
            className={`rounded-md px-3 py-2 text-sm font-medium border transition-colors ${
              showUnreadOnly
                ? "bg-blue-600 text-white border-blue-600"
                : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50"
            }`}
          >
            {showUnreadOnly ? "Showing unread" : "Show unread only"}
          </button>

          <button
            onClick={() => markAllAsReadMutation.mutate({ token: token! })}
            disabled={markAllAsReadMutation.isPending || unreadCount === 0}
            className="inline-flex items-center gap-2 rounded-md bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50"
          >
            <CheckCheck className="h-4 w-4" />
            Mark all read
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white">
        {notificationsQuery.isLoading ? (
          <div className="p-10 text-center text-sm text-gray-500">Loading notifications…</div>
        ) : notificationsQuery.isError ? (
          <div className="p-6 text-sm text-red-700">
            Failed to load notifications: {(notificationsQuery.error as any)?.message ?? "Unknown error"}
          </div>
        ) : list.length === 0 ? (
          <div className="p-10 text-center">
            <Bell className="mx-auto h-12 w-12 text-gray-300" />
            <div className="mt-3 text-sm text-gray-600">No notifications found</div>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {list.map((n: any) => {
              const isFocused = focusId != null && n.id === focusId;
              const isUnread = !n.isRead;

              return (
                <div
                  key={n.id}
                  ref={isFocused ? focusRef : undefined}
                  className={`p-4 ${isFocused ? "bg-yellow-50" : isUnread ? "bg-blue-50" : "bg-white"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className={`text-sm break-words ${isUnread ? "text-gray-900 font-medium" : "text-gray-700"}`}>
                        {n.message}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-gray-500">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {formatTimestamp(n.createdAt)}
                        </span>
                        {n.type && <span>Type: {n.type}</span>}
                        {n.relatedEntityType && <span>Entity: {n.relatedEntityType}{n.relatedEntityId ? ` #${n.relatedEntityId}` : ""}</span>}
                      </div>
                    </div>

                    <div className="shrink-0">
                      {!n.isRead && (
                        <button
                          onClick={() => markAsReadMutation.mutate({ token: token!, notificationId: n.id })}
                          disabled={markAsReadMutation.isPending}
                          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
                        >
                          <Check className="h-4 w-4" />
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex justify-center">
        <button
          onClick={() => setLimit((l) => Math.min(500, l + 100))}
          disabled={notificationsQuery.isLoading || list.length < limit}
          className="rounded-md border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Load more
        </button>
      </div>
    </div>
  );
}
