/**
 * Client-side utilities for managing Web Push notifications
 */

/**
 * Detect if running inside a TWA (Trusted Web Activity)
 */
export function isTWA(): boolean {
  if (typeof window === 'undefined') return false;
  // TWA sets document.referrer to android-app://package.name
  if (document.referrer.startsWith('android-app://')) return true;
  // Check for standalone display mode (TWA or installed PWA)
  if (window.matchMedia('(display-mode: standalone)').matches) return true;
  // iOS standalone
  if ((window.navigator as any).standalone === true) return true;
  return false;
}

/**
 * Check if the browser supports push notifications.
 * In TWA context, the Notification API may not be in window,
 * but PushManager + service worker still work for receiving push.
 */
export function isPushNotificationSupported(): boolean {
  // Core requirements: service worker + PushManager
  const hasCore = "serviceWorker" in navigator && "PushManager" in window;
  if (!hasCore) return false;
  // In TWA, Notification may not exist in window but push still works
  // via service worker's self.registration.showNotification()
  return true;
}

/**
 * Check the current notification permission state
 */
export function getNotificationPermission(): NotificationPermission {
  if (!isPushNotificationSupported()) {
    return "denied";
  }
  // Prefer Notification API if available
  if ("Notification" in window) {
    return Notification.permission;
  }
  // In TWA without Notification API, assume granted
  // (the Android app handles permission at OS level)
  return "granted";
}

/**
 * Request notification permission from the user
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  // Use Notification API if available
  if ("Notification" in window) {
    const permission = await Notification.requestPermission();
    return permission;
  }

  // In TWA, try using the Permissions API as fallback
  try {
    const status = await navigator.permissions.query({ name: 'notifications' as PermissionName });
    return status.state as NotificationPermission;
  } catch {
    // If Permissions API also unavailable, assume granted (TWA handles at OS level)
    return "granted";
  }
}

/**
 * Register the service worker
 */
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  if (!("serviceWorker" in navigator)) {
    throw new Error("Service workers are not supported in this browser");
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js", {
      scope: "/",
      updateViaCache: "none",
    });
    // Force update check
    registration.update().catch(() => {});
    console.log("Service Worker registered successfully:", registration);
    return registration;
  } catch (error) {
    console.error("Service Worker registration failed:", error);
    throw error;
  }
}

/**
 * Convert a base64 string to Uint8Array (for VAPID key)
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Subscribe to push notifications
 */
export async function subscribeToPushNotifications(
  vapidPublicKey: string
): Promise<PushSubscription> {
  if (!isPushNotificationSupported()) {
    throw new Error("Push notifications are not supported in this browser");
  }

  try {
    // Get or register service worker
    let registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      registration = await registerServiceWorker();
    }

    // Wait for service worker to be ready
    await navigator.serviceWorker.ready;

    // Check if already subscribed
    let subscription = await registration.pushManager.getSubscription();
    
    if (subscription) {
      console.log("Already subscribed to push notifications");
      return subscription;
    }

    // Subscribe to push notifications
    const convertedVapidKey = urlBase64ToUint8Array(vapidPublicKey);
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: convertedVapidKey as unknown as BufferSource,
    });

    console.log("Successfully subscribed to push notifications");
    return subscription;
  } catch (error) {
    console.error("Failed to subscribe to push notifications:", error);
    throw error;
  }
}

/**
 * Unsubscribe from push notifications
 */
export async function unsubscribeFromPushNotifications(): Promise<boolean> {
  if (!isPushNotificationSupported()) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return false;
    }

    const subscription = await registration.pushManager.getSubscription();
    if (!subscription) {
      return false;
    }

    const success = await subscription.unsubscribe();
    console.log("Unsubscribed from push notifications:", success);
    return success;
  } catch (error) {
    console.error("Failed to unsubscribe from push notifications:", error);
    return false;
  }
}

/**
 * Get the current push subscription
 */
export async function getCurrentPushSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) {
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (!registration) {
      return null;
    }

    return await registration.pushManager.getSubscription();
  } catch (error) {
    console.error("Failed to get current push subscription:", error);
    return null;
  }
}

/**
 * Get a device identifier (simple browser fingerprint)
 */
export function getDeviceIdentifier(): string {
  const nav = navigator as any;
  const screen = window.screen;
  
  const components = [
    nav.userAgent,
    nav.language,
    screen.colorDepth,
    screen.width,
    screen.height,
    new Date().getTimezoneOffset(),
  ];
  
  return btoa(components.join("|"));
}
