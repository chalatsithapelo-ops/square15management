import {
  Outlet,
  createRootRoute,
  useRouterState,
} from "@tanstack/react-router";
import { Toaster } from "react-hot-toast";
import { TRPCReactProvider, useTRPC } from "~/trpc/react";
import { AuthUser, useAuthStore } from "~/stores/auth";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useEffect } from "react";
import { usePushNotificationStore } from "~/stores/push-notifications";
import {
  isPushNotificationSupported,
  getNotificationPermission,
  subscribeToPushNotifications,
  getCurrentPushSubscription,
  getDeviceIdentifier,
} from "~/utils/push-notifications";
import { ErrorBoundary } from "~/components/ErrorBoundary";

export const Route = createRootRoute<{
  user: AuthUser | null;
}>({
  component: RootComponent,
});

function RootComponent() {
  const isFetching = useRouterState({ select: (s) => s.isLoading });
  const locationHref = useRouterState({ select: (s) => s.location.href });

  return (
    <TRPCReactProvider>
      <Toaster position="top-right" />
      <RootInnerComponent isFetching={isFetching} locationHref={locationHref} />
    </TRPCReactProvider>
  );
}

function RootInnerComponent({
  isFetching,
  locationHref,
}: {
  isFetching: boolean;
  locationHref: string;
}) {
  const { token, setAuth, clearAuth } = useAuthStore();
  const trpc = useTRPC();
  const pushStore = usePushNotificationStore();

  const subscribeToPushMutation = useMutation(
    trpc.subscribeToPush.mutationOptions()
  );

  const currentUserQuery = useQuery(
    trpc.getCurrentUser.queryOptions(
      { token: token! },
      {
        enabled: !!token, // Only run if a token exists
        retry: (failureCount, error) => {
          // If it's a startup/service unavailable error (503), retry up to 5 times
          if (error instanceof Error && error.message.includes("Service temporarily unavailable")) {
            return failureCount < 5;
          }
          // For other errors (like authentication errors), don't retry
          return false;
        },
        retryDelay: (attemptIndex) => {
          // Exponential backoff: 2s, 4s, 8s, 16s, 32s
          return Math.min(1000 * Math.pow(2, attemptIndex), 32000);
        },
        staleTime: Infinity, // User data is considered fresh until manually invalidated
      }
    )
  );

  // Update auth state when user query succeeds or fails
  useEffect(() => {
    if (currentUserQuery.isSuccess) {
      setAuth(token!, currentUserQuery.data);
    }
    if (currentUserQuery.isError) {
      // Only clear auth if it's not a startup/connection error
      const isStartupError = currentUserQuery.error instanceof Error && 
        currentUserQuery.error.message.includes("Service temporarily unavailable");
      
      if (!isStartupError) {
        // If the token is invalid, clear the auth state
        clearAuth();
      }
    }
  }, [
    currentUserQuery.isSuccess,
    currentUserQuery.isError,
    currentUserQuery.data,
    setAuth,
    clearAuth,
    token,
  ]);

  // Check if push notifications are supported (runs once on mount)
  useEffect(() => {
    const isSupported = isPushNotificationSupported();
    pushStore.setSupported(isSupported);
    
    if (!isSupported) {
      console.log("Push notifications are not supported in this browser");
      return;
    }
    
    // Update permission state
    const permission = getNotificationPermission();
    pushStore.setPermission(permission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount
  
  // Subscribe to push notifications when user is authenticated and permission is granted
  useEffect(() => {
    if (!token || !currentUserQuery.isSuccess) {
      return;
    }
    
    const initializePushNotifications = async () => {
      try {
        const permission = getNotificationPermission();
        pushStore.setPermission(permission);
        
        // Only proceed if permission is granted
        if (permission !== "granted") {
          return;
        }
        
        // Get VAPID public key from server
        const queryClient = trpc.getQueryClient();
        const vapidResult = await queryClient.fetchQuery(
          trpc.getVapidPublicKey.queryOptions({ token })
        );
        
        if (!vapidResult.enabled || !vapidResult.publicKey) {
          console.log("Push notifications are not configured on the server");
          return;
        }
        
        // Check if already subscribed
        const existingSubscription = await getCurrentPushSubscription();
        
        if (existingSubscription) {
          pushStore.setSubscriptionEndpoint(existingSubscription.endpoint);
          pushStore.setEnabled(true);
          
          // Re-register with server in case it was lost
          const subscriptionData = existingSubscription.toJSON();
          
          try {
            await subscribeToPushMutation.mutateAsync({
              token,
              subscription: subscriptionData,
              deviceIdentifier: getDeviceIdentifier(),
            });
            
            console.log("Push notifications already enabled");
          } catch (error) {
            console.error("Failed to re-register push subscription:", error);
          }
          return;
        }
        
        // Subscribe to push notifications
        const subscription = await subscribeToPushNotifications(vapidResult.publicKey);
        
        // Register subscription with server
        const subscriptionData = subscription.toJSON();
        
        try {
          await subscribeToPushMutation.mutateAsync({
            token,
            subscription: subscriptionData,
            deviceIdentifier: getDeviceIdentifier(),
          });
          
          pushStore.setSubscriptionEndpoint(subscription.endpoint);
          pushStore.setEnabled(true);
          
          console.log("Push notifications enabled successfully");
        } catch (error) {
          console.error("Failed to register push subscription:", error);
          pushStore.setEnabled(false);
        }
      } catch (error) {
        console.error("Failed to initialize push notifications:", error);
        pushStore.setEnabled(false);
      }
    };
    
    initializePushNotifications();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, currentUserQuery.isSuccess]); // Only re-run when auth state changes

  // Defensive cleanup: if a Headless UI Portal/backdrop ever gets orphaned,
  // it can leave a full-screen overlay that blocks clicks ("dim screen").
  // On every route change (and periodically), remove portal containers that no longer contain dialogs.
  useEffect(() => {
    const cleanupOrphanedOverlays = () => {
      const portalRoots = Array.from(
        document.querySelectorAll<HTMLElement>(
          '#headlessui-portal-root, [data-headlessui-portal]'
        )
      );

      for (const root of portalRoots) {
        const hasDialog =
          !!root.querySelector('[role="dialog"], [aria-modal="true"]');

        // If there is no dialog left inside the portal, the remaining nodes are stale.
        if (!hasDialog) {
          root.remove();
        }
      }

      // Also clear any scroll-lock that may have been left behind.
      const anyDialogOpen =
        !!document.querySelector('[role="dialog"], [aria-modal="true"]');

      if (!anyDialogOpen) {
        document.body.style.overflow = '';
        document.documentElement.style.overflow = '';
      }
    };

    cleanupOrphanedOverlays();
    const intervalId = window.setInterval(cleanupOrphanedOverlays, 1500);
    return () => window.clearInterval(intervalId);
  }, [locationHref]);

  // Show loading state during initial load or retries
  if (isFetching || (token && currentUserQuery.isLoading) || (token && currentUserQuery.isFetching)) {
    const isRetrying = currentUserQuery.failureCount > 0;
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="mb-4 inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="text-sm font-medium text-gray-900">
            {isRetrying ? "Starting up..." : "Loading..."}
          </p>
          {isRetrying && (
            <p className="mt-2 text-xs text-gray-500">
              The application is initializing. This may take a moment.
              <br />
              (Attempt {currentUserQuery.failureCount + 1} of 5)
            </p>
          )}
        </div>
      </div>
    );
  }

  // Only show error screen if we have a token, the query failed, and it's not a startup error that's still retrying
  if (currentUserQuery.isError && token) {
    const errorMessage = currentUserQuery.error instanceof Error 
      ? currentUserQuery.error.message 
      : "Unable to connect to the server";
    
    const isStartupError = errorMessage.includes("Service temporarily unavailable");
    
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
          <div className="mb-4 flex items-center justify-center">
            <div className={`rounded-full p-3 ${isStartupError ? 'bg-yellow-100' : 'bg-red-100'}`}>
              <svg
                className={`h-6 w-6 ${isStartupError ? 'text-yellow-600' : 'text-red-600'}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
            </div>
          </div>
          <h1 className="mb-2 text-center text-xl font-semibold text-gray-900">
            {isStartupError ? "Service Starting Up" : "Connection Error"}
          </h1>
          <p className="mb-4 text-center text-sm text-gray-600">
            {isStartupError 
              ? "The application server is still starting up. This usually takes 30-60 seconds during initial deployment or restart."
              : errorMessage
            }
          </p>
          <div className="space-y-3">
            <button
              onClick={() => currentUserQuery.refetch()}
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Try Again
            </button>
            <button
              onClick={() => clearAuth()}
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Sign Out
            </button>
          </div>
          <p className="mt-4 text-center text-xs text-gray-500">
            {isStartupError 
              ? "Please wait a moment and click 'Try Again'. The server will be ready shortly."
              : "If this problem persists, please contact support."
            }
          </p>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Outlet />
    </ErrorBoundary>
  );
}
