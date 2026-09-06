/**
 * FieldFlow push notification service worker.
 * Handles `push` and `notificationclick` events. Loaded separately from the
 * Workbox-generated /sw.js so the two concerns don't entangle.
 */
/* eslint-disable */
self.addEventListener("install", (event) => {
  // @ts-ignore
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  // @ts-ignore
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "FieldFlow", body: event.data ? event.data.text() : "" };
  }

  const title = data.title || "FieldFlow";
  const options = {
    body: data.body || "",
    icon: "/icon-192.png",
    badge: "/icon-mono-192.png",
    tag: data.tag || "fieldflow",
    data: {
      url: data.url || "/notifications",
      notification_id: data.notification_id,
      type: data.type,
    },
    requireInteraction: data.type === "ticket" || data.type === "sla",
    renotify: true,
  };

  event.waitUntil(
    // @ts-ignore
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || "/notifications";

  event.waitUntil(
    (async () => {
      // @ts-ignore
      const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // Focus an existing tab if any FieldFlow tab is open; navigate it to the target.
      for (const client of clients) {
        try {
          const u = new URL(client.url);
          if (u.origin === self.location.origin) {
            await client.focus();
            if ("navigate" in client) {
              try { await client.navigate(targetUrl); } catch { /* ignore */ }
            }
            return;
          }
        } catch { /* ignore */ }
      }
      // @ts-ignore
      await self.clients.openWindow(targetUrl);
    })()
  );
});

self.addEventListener("pushsubscriptionchange", (event) => {
  // The browser rotated the subscription. The client will re-subscribe on
  // next page load; nothing to do server-side here.
});
