import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface PushNotificationState {
  isEnabled: boolean;
  isSupported: boolean;
  permission: NotificationPermission;
  subscriptionEndpoint: string | null;
  setEnabled: (enabled: boolean) => void;
  setSupported: (supported: boolean) => void;
  setPermission: (permission: NotificationPermission) => void;
  setSubscriptionEndpoint: (endpoint: string | null) => void;
}

/**
 * Use a different storage key for standalone/TWA mode so push subscription
 * state is independent from the browser session.
 */
function getPushStorageKey(): string {
  if (typeof window === "undefined") return "push-notification-settings";
  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true;
  return isStandalone ? "push-notification-settings-app" : "push-notification-settings";
}

export const usePushNotificationStore = create<PushNotificationState>()(
  persist(
    (set) => ({
      isEnabled: false,
      isSupported: false,
      permission: "default",
      subscriptionEndpoint: null,
      setEnabled: (enabled) => set({ isEnabled: enabled }),
      setSupported: (supported) => set({ isSupported: supported }),
      setPermission: (permission) => set({ permission }),
      setSubscriptionEndpoint: (endpoint) => set({ subscriptionEndpoint: endpoint }),
    }),
    {
      name: getPushStorageKey(),
      storage: createJSONStorage(() => {
        if (typeof window === "undefined") {
          return {
            getItem: () => null,
            setItem: () => {},
            removeItem: () => {},
          };
        }

        return localStorage;
      }),
    }
  )
);
