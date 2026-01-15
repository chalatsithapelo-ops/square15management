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
      name: "push-notification-settings",
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
