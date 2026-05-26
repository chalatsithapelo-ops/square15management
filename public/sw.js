// Service Worker for PWA + Push Notifications
// Version 4 - bust stale HTML/asset cache + force-reload open tabs on activate
const CACHE_NAME = "square15-v4";
const STATIC_ASSETS = [
  "/",
  "/manifest.json",
  "/logo.png",
  "/offline.html",
];

// Install: pre-cache essential assets
self.addEventListener("install", (event) => {
  console.log("Service Worker installed");
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Pre-caching static assets");
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn("Pre-cache failed for some assets:", err);
      });
    })
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener("activate", (event) => {
  console.log("Service Worker activated");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log("Removing old cache:", name);
            return caches.delete(name);
          })
      );
    }).then(() => self.clients.claim())
    .then(async () => {
      // After taking control, force every open tab to reload so it picks up
      // fresh HTML referencing the new hashed asset bundles. Without this,
      // existing tabs continue running old JS pointing at deleted assets
      // and produce 404 / white-screen errors after a deploy.
      try {
        const clients = await self.clients.matchAll({ type: "window" });
        for (const client of clients) {
          if (client.url && "navigate" in client) {
            client.navigate(client.url).catch(() => {});
          }
        }
      } catch (e) {
        console.warn("SW client reload failed:", e);
      }
    })
  );
});

// Fetch: network-first strategy for API calls, cache-first for static assets
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip API/tRPC requests — always go to network
  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/trpc/")) {
    return;
  }

  // For navigation requests (HTML pages) — always network, fall back to offline page only.
  // We intentionally do NOT cache HTML because it references hashed asset filenames
  // that change every deploy; serving stale HTML after a deploy causes white-screen
  // errors when the referenced /assets/*.js no longer exists.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => caches.match("/offline.html"))
    );
    return;
  }

  // For static assets (JS, CSS, images, fonts) — stale-while-revalidate
  if (
    url.pathname.match(/\.(js|css|png|jpg|jpeg|svg|gif|woff2?|ttf|eot|ico)$/) ||
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/")
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        const fetchPromise = fetch(request)
          .then((networkResponse) => {
            if (networkResponse.ok) {
              const responseToCache = networkResponse.clone();
              caches.open(CACHE_NAME).then((cache) => {
                cache.put(request, responseToCache);
              });
            }
            return networkResponse;
          })
          .catch(() => cachedResponse);

        return cachedResponse || fetchPromise;
      })
    );
    return;
  }
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
      icon: data.icon || "/square15-logo-design.png",
      badge: data.badge || "/square15-logo-design.png",
      tag: data.tag || "notification-" + Date.now(),
      data: data.data || {},
      requireInteraction: data.requireInteraction || false,
      vibrate: [200, 100, 200],
      silent: false,
      renotify: true,
      actions: data.actions || [],
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

  // Determine the URL based on the notification data and user role
  const role = data.recipientRole || "";
  const isArtisan = role === "ARTISAN";
  const isContractor = ["CONTRACTOR", "CONTRACTOR_SENIOR_MANAGER", "CONTRACTOR_JUNIOR_MANAGER", "CONTRACTOR_ACCOUNTANT"].includes(role);
  const isPropertyManager = ["PROPERTY_MANAGER", "PROPERTY_MANAGER_ADMIN"].includes(role);
  const isStaff = role === "STAFF";

  if (data.relatedEntityType) {
    switch (data.relatedEntityType) {
      case "ORDER":
        url = isArtisan ? "/artisan/dashboard" : isContractor ? "/contractor/orders" : isPropertyManager ? "/property-manager/orders" : "/admin/operations";
        break;
      case "PROJECT":
        url = isArtisan ? "/artisan/dashboard" : "/admin/projects";
        break;
      case "INVOICE":
        url = isContractor ? "/contractor/invoices" : isPropertyManager ? "/property-manager/invoices" : "/admin/invoices";
        break;
      case "QUOTATION":
        url = isArtisan ? "/artisan/dashboard" : isContractor ? "/contractor/quotations" : "/admin/quotations";
        break;
      case "PAYMENT_REQUEST":
        url = isArtisan ? "/artisan/dashboard" : "/admin/payment-requests";
        break;
      case "STATEMENT":
        url = "/admin/statements";
        break;
      case "LEAD":
        url = "/admin/crm";
        break;
      case "MILESTONE":
        url = isArtisan ? "/artisan/dashboard" : "/admin/projects";
        break;
      case "CONVERSATION":
        url = isArtisan ? "/artisan/dashboard" : isContractor ? "/contractor/messages" : "/admin/conversations";
        break;
      case "TASK":
        url = isStaff ? "/staff/tasks" : "/admin/tasks";
        break;
      default:
        url = isArtisan ? "/artisan/dashboard" : isContractor ? "/contractor/dashboard" : isPropertyManager ? "/property-manager/dashboard" : "/";
    }
  } else {
    // No entity type — route to the user's dashboard
    url = isArtisan ? "/artisan/dashboard" : isContractor ? "/contractor/dashboard" : isPropertyManager ? "/property-manager/dashboard" : isStaff ? "/staff/dashboard" : "/";
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
