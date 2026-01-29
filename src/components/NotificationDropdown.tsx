import { Menu, Transition, Portal } from "@headlessui/react";
import { Bell, Check, CheckCheck, Clock, X, BellRing, BellOff, Settings } from "lucide-react";
import { Fragment, useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSubscription } from "@trpc/tanstack-react-query";
import { useTRPC } from "~/trpc/react";
import { useAuthStore } from "~/stores/auth";
import { Link } from "@tanstack/react-router";
import toast from "react-hot-toast";
import { usePushNotificationStore } from "~/stores/push-notifications";
import {
  requestNotificationPermission,
  subscribeToPushNotifications,
  unsubscribeFromPushNotifications,
  getDeviceIdentifier,
} from "~/utils/push-notifications";
import { NotificationSettingsModal } from "~/components/NotificationSettingsModal";

interface Notification {
  id: number;
  createdAt: Date;
  message: string;
  type: string;
  isRead: boolean;
  relatedEntityId: number | null;
  relatedEntityType: string | null;
}

export function NotificationDropdown() {
  // Temporary debug flag: pin dropdown to top-right to verify overlay behavior
  const PIN_TOP_RIGHT_DEBUG = false;
  const { token } = useAuthStore();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const pushStore = usePushNotificationStore();
  const [isEnablingPush, setIsEnablingPush] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const updatePosition = () => {
    if (buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      return {
        top: rect.bottom + 8,
        right: window.innerWidth - rect.right
      };
    }
    return { top: 0, right: 0 };
  };

  // Fetch unread count (without polling - subscription will keep it fresh)
  const unreadCountQuery = useQuery(
    trpc.getUnreadNotificationCount.queryOptions(
      {
        token: token!,
      },
      {
        refetchOnWindowFocus: true,
        // Fallback polling so notifications still update if realtime subscriptions are unavailable.
        refetchInterval: 30000,
        enabled: !!token,
      }
    )
  );

  // Fetch recent notifications (without polling - subscription will keep it fresh)
  const notificationsQuery = useQuery(
    trpc.getNotifications.queryOptions(
      {
        token: token!,
        limit: 20,
      },
      {
        refetchOnWindowFocus: true,
        // Fallback polling so notifications still update if realtime subscriptions are unavailable.
        refetchInterval: 30000,
        enabled: !!token,
      }
    )
  );

  // Subscribe to real-time notification updates
  useSubscription(
    trpc.notificationsSubscription.subscriptionOptions(
      {
        token: token!,
      },
      {
        enabled: !!token,
        onData: (notification) => {
          // Update the notifications list by invalidating queries
          queryClient.invalidateQueries({
            queryKey: trpc.getNotifications.queryKey(),
          });
          queryClient.invalidateQueries({
            queryKey: trpc.getUnreadNotificationCount.queryKey(),
          });
        },
        onError: (error) => {
          console.error("Notification subscription error:", error);
          // Silently handle subscription errors - queries will still work
        },
      }
    )
  );

  // Mark single notification as read
  const markAsReadMutation = useMutation(
    trpc.markNotificationAsRead.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: trpc.getNotifications.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getUnreadNotificationCount.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to mark notification as read");
      },
    })
  );

  // Mark all notifications as read
  const markAllAsReadMutation = useMutation(
    trpc.markAllNotificationsAsRead.mutationOptions({
      onSuccess: () => {
        toast.success("All notifications marked as read");
        queryClient.invalidateQueries({
          queryKey: trpc.getNotifications.queryKey(),
        });
        queryClient.invalidateQueries({
          queryKey: trpc.getUnreadNotificationCount.queryKey(),
        });
      },
      onError: (error) => {
        toast.error(error.message || "Failed to mark all notifications as read");
      },
    })
  );

  const handleMarkAsRead = (notificationId: number) => {
    markAsReadMutation.mutate({
      token: token!,
      notificationId,
    });
  };

  const handleMarkAllAsRead = () => {
    markAllAsReadMutation.mutate({
      token: token!,
    });
  };

  const handleEnablePushNotifications = async () => {
    setIsEnablingPush(true);
    try {
      // Request permission
      const permission = await requestNotificationPermission();
      pushStore.setPermission(permission);

      if (permission !== "granted") {
        toast.error("Notification permission was denied");
        return;
      }

      // Get VAPID public key
      const queryClient = trpc.getQueryClient();
      const vapidResult = await queryClient.fetchQuery(
        trpc.getVapidPublicKey.queryOptions({ token: token! })
      );

      if (!vapidResult.enabled || !vapidResult.publicKey) {
        toast.error("Push notifications are not configured on the server");
        return;
      }

      // Subscribe to push notifications
      const subscription = await subscribeToPushNotifications(vapidResult.publicKey);

      // Register with server
      const subscriptionData = subscription.toJSON();
      const response = await fetch('/trpc/subscribeToPush', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          token: token!,
          subscription: subscriptionData,
          deviceIdentifier: getDeviceIdentifier(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to register push subscription");
      }

      pushStore.setSubscriptionEndpoint(subscription.endpoint);
      pushStore.setEnabled(true);

      toast.success("Push notifications enabled!");
    } catch (error) {
      console.error("Failed to enable push notifications:", error);
      toast.error("Failed to enable push notifications");
    } finally {
      setIsEnablingPush(false);
    }
  };

  const handleDisablePushNotifications = async () => {
    try {
      // Unsubscribe from push
      await unsubscribeFromPushNotifications();

      // Unregister from server
      if (pushStore.subscriptionEndpoint) {
        await fetch('/trpc/unsubscribeFromPush', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            token: token!,
            endpoint: pushStore.subscriptionEndpoint,
          }),
        });
      }

      pushStore.setSubscriptionEndpoint(null);
      pushStore.setEnabled(false);

      toast.success("Push notifications disabled");
    } catch (error) {
      console.error("Failed to disable push notifications:", error);
      toast.error("Failed to disable push notifications");
    }
  };

  // Always route to the global notifications page.
  // Deep-linking directly into /admin/* breaks for non-admin portals.

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

  const unreadCount = unreadCountQuery.data || 0;
  const notifications = notificationsQuery.data || [];

  return (
    <>
      <Menu as="div" className="relative inline-block text-left">
        {({ open }) => (
          <>
            <Menu.Button ref={buttonRef} className="relative inline-flex items-center justify-center p-2 rounded-lg text-white bg-white/10 backdrop-blur-sm hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/30 transition-all duration-200">
              <Bell className="h-6 w-6" />
              {unreadCount > 0 && (
                <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full shadow-lg animate-pulse">
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </Menu.Button>

            <Portal>
              <Transition
                as={Fragment}
                show={open}
                unmount={false}
                enter="transition ease-out duration-100"
                enterFrom="transform opacity-0 scale-95"
                enterTo="transform opacity-100 scale-100"
                leave="transition ease-in duration-75"
                leaveFrom="transform opacity-100 scale-100"
                leaveTo="transform opacity-0 scale-95"
              >
                <Menu.Items
                  static
                  className="fixed w-full sm:w-96 max-w-[calc(100vw-2rem)] origin-top-right rounded-lg bg-white shadow-2xl ring-1 ring-black ring-opacity-5 focus:outline-none"
                  style={{
                    top: PIN_TOP_RIGHT_DEBUG
                      ? 80
                      : buttonRef.current
                        ? buttonRef.current.getBoundingClientRect().bottom + 8
                        : 80,
                    left: PIN_TOP_RIGHT_DEBUG
                      ? undefined
                      : buttonRef.current
                        ? Math.max(buttonRef.current.getBoundingClientRect().left - 320 + 40, 16)
                        : undefined,
                    right: PIN_TOP_RIGHT_DEBUG || !buttonRef.current ? 16 : undefined,
                    zIndex: 99999,
                  }}
                >
                      <div className="absolute -top-2 right-6 w-3 h-3 bg-white rotate-45 shadow-md" style={{ zIndex: 99999 }} />
                      
                      <div className="p-4 border-b border-gray-200">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Notifications
                          </h3>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setIsSettingsOpen(true)}
                              className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                              title="Notification settings"
                            >
                              <Settings className="h-4 w-4" />
                            </button>
                            {unreadCount > 0 && (
                              <button
                                onClick={handleMarkAllAsRead}
                                disabled={markAllAsReadMutation.isPending}
                                className="text-sm text-blue-600 hover:text-blue-700 font-medium disabled:opacity-50"
                              >
                                <CheckCheck className="h-4 w-4 inline mr-1" />
                                Mark all read
                              </button>
                            )}
                          </div>
                        </div>
                      </div>

                      {pushStore.isSupported && (
                        <div className="border-b border-gray-200 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {pushStore.isEnabled ? (
                                <BellRing className="h-5 w-5 text-green-600" />
                              ) : (
                                <BellOff className="h-5 w-5 text-gray-400" />
                              )}
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  Push Notifications
                                </p>
                                <p className="text-xs text-gray-500">
                                  {pushStore.isEnabled
                                    ? "Receive notifications even when app is closed"
                                    : pushStore.permission === "denied"
                                    ? "Permission denied by browser"
                                    : "Get notified of important updates"}
                                </p>
                              </div>
                            </div>
                            {pushStore.permission !== "denied" && (
                              <button
                                onClick={
                                  pushStore.isEnabled
                                    ? handleDisablePushNotifications
                                    : handleEnablePushNotifications
                                }
                                disabled={isEnablingPush}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                                  pushStore.isEnabled
                                    ? "bg-gray-100 text-gray-700 hover:bg-gray-200"
                                    : "bg-blue-600 text-white hover:bg-blue-700"
                                } disabled:opacity-50`}
                              >
                                {isEnablingPush
                                  ? "Enabling..."
                                  : pushStore.isEnabled
                                  ? "Disable"
                                  : "Enable"}
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      <div className="max-h-96 overflow-y-auto">
                        {notifications.length === 0 ? (
                          <div className="p-8 text-center">
                            <Bell className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                            <p className="text-sm text-gray-600">No notifications yet</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-gray-100">
                            {notifications.map((notification) => {
                              const NotificationContent = (
                                <div
                                  className={`p-4 hover:bg-gray-50 transition-colors ${
                                    !notification.isRead ? "bg-blue-50" : ""
                                  }`}
                                >
                                  <div className="flex items-start justify-between mb-2 gap-2">
                                    <p
                                      className={`text-sm flex-1 break-words ${
                                        notification.isRead
                                          ? "text-gray-700"
                                          : "text-gray-900 font-medium"
                                      }`}
                                    >
                                      {notification.message}
                                    </p>
                                    {!notification.isRead && (
                                      <button
                                        onClick={(e) => {
                                          e.preventDefault();
                                          e.stopPropagation();
                                          handleMarkAsRead(notification.id);
                                        }}
                                        className="ml-2 p-1.5 text-blue-600 hover:text-blue-700 rounded hover:bg-blue-100 flex-shrink-0"
                                        title="Mark as read"
                                      >
                                        <Check className="h-4 w-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex items-center text-xs text-gray-500">
                                    <Clock className="h-3 w-3 mr-1 flex-shrink-0" />
                                    {formatTimestamp(notification.createdAt)}
                                  </div>
                                </div>
                              );

                              return (
                                <Menu.Item key={notification.id}>
                                  <Link
                                    to="/notifications/"
                                    search={{ focus: notification.id }}
                                    onClick={() => {
                                      if (!notification.isRead) {
                                        handleMarkAsRead(notification.id);
                                      }
                                    }}
                                  >
                                    {NotificationContent}
                                  </Link>
                                </Menu.Item>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {notifications.length > 0 && (
                        <div className="p-3 border-t border-gray-200 text-center">
                          <Link
                            to="/notifications/"
                            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                          >
                            View all notifications
                          </Link>
                        </div>
                      )}
                </Menu.Items>
              </Transition>
            </Portal>
          </>
        )}
      </Menu>

      <NotificationSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />
    </>
  );
}
