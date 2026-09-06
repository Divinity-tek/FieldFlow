// Lightweight wrapper around the Web Notifications API.
// Fires an OS-level notification when the tab is backgrounded
// (browser must still be running). For true closed-browser push,
// a service worker + Web Push provider is required.

export type BrowserNotifyOptions = {
  title: string;
  body?: string;
  tag?: string;
  url?: string; // navigated to on click
  icon?: string;
};

const ICON_DEFAULT = "/placeholder.svg";

export function browserNotificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getBrowserNotificationPermission(): NotificationPermission | "unsupported" {
  if (!browserNotificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestBrowserNotificationPermission(): Promise<NotificationPermission | "unsupported"> {
  if (!browserNotificationsSupported()) return "unsupported";
  if (Notification.permission === "granted" || Notification.permission === "denied") {
    return Notification.permission;
  }
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

export function fireBrowserNotification({ title, body, tag, url, icon }: BrowserNotifyOptions) {
  if (!browserNotificationsSupported()) return;
  if (Notification.permission !== "granted") return;
  // Skip if the tab is already focused — the in-app toast will be visible
  if (typeof document !== "undefined" && document.visibilityState === "visible" && document.hasFocus()) {
    return;
  }
  try {
    const n = new Notification(title, {
      body,
      tag,
      icon: icon ?? ICON_DEFAULT,
      badge: icon ?? ICON_DEFAULT,
    });
    n.onclick = () => {
      window.focus();
      if (url) {
        try {
          window.location.assign(url);
        } catch {
          /* ignore */
        }
      }
      n.close();
    };
  } catch {
    /* ignore */
  }
}
