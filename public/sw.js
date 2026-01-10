// Service Worker for handling push notifications
self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  console.log("Push notification received", event);

  if (!event.data) {
    console.log("Push event but no data");
    return;
  }

  try {
    const data = event.data.json();
    console.log("Push data:", data);

    const title = data.title || "New Notification";
    const options = {
      body: data.body || "",
      icon: data.icon || "/logo.png",
      badge: data.badge || "/logo.png",
      tag: data.tag || "notification",
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (error) {
    console.error("Error handling push event:", error);
  }
});

self.addEventListener("notificationclick", (event) => {
  console.log("Notification clicked", event);
  event.notification.close();

  const data = event.notification.data || {};
  let url = "/";

  // Determine the URL based on the notification data
  if (data.relatedEntityType && data.relatedEntityId) {
    switch (data.relatedEntityType) {
      case "ORDER":
        url = "/admin/operations";
        break;
      case "PROJECT":
        url = "/admin/projects";
        break;
      case "INVOICE":
        url = "/admin/invoices";
        break;
      case "QUOTATION":
        url = "/admin/quotations";
        break;
      case "PAYMENT_REQUEST":
        url = "/admin/payment-requests";
        break;
      case "STATEMENT":
        url = "/admin/statements";
        break;
      case "LEAD":
        url = "/admin/crm";
        break;
      case "MILESTONE":
        url = "/admin/projects";
        break;
      default:
        url = "/";
    }
  }

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clientList) => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes(url) && "focus" in client) {
            return client.focus();
          }
        }
        // If not, open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(url);
        }
      })
  );
});
