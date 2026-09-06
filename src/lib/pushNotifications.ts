/**
 * Push notification subscription manager.
 * - Registers /sw-push.js (separate from Workbox /sw.js)
 * - Subscribes via PushManager and persists to push_subscriptions
 * - Provides helpers to enable/disable
 *
 * Limitations:
 *  - Local dev / iframes / embedded previews: skipped (SW disabled there).
 *  - iOS: requires the PWA to be installed (Add to Home Screen) AND iOS 16.4+.
 *  - User must have granted Notification permission first.
 */
import { supabase } from "@/integrations/supabase/client";

// Public VAPID key — safe to ship in the client bundle.
export const VAPID_PUBLIC_KEY =
  "BDiYr0BeLEVLXv190i-JK2RYsqfzIyrUv13vPhmsDqNQOY92yvAUw9pv5wmDdTQgY24j8TiXGb07PEN1zHgslZ0";

const SW_PATH = "/sw-push.js";

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

function arrayBufferToBase64Url(buf: ArrayBuffer | null): string {
  if (!buf) return "";
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function detectPlatform(): string {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/macintosh|windows|linux|cros/i.test(ua)) return "desktop";
  return "other";
}

export function isPushSupported(): boolean {
  if (typeof window === "undefined") return false;
  if (!("serviceWorker" in navigator)) return false;
  if (!("PushManager" in window)) return false;
  if (!("Notification" in window)) return false;

  // Skip preview/iframe contexts.
  try {
    if (window.self !== window.top) return false;
  } catch {
    return false;
  }
  const host = window.location.hostname;
  if (host === "localhost" || host === "127.0.0.1") return false;

  // iOS quirk: needs to be installed PWA AND >= 16.4
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;
    if (!isStandalone) return false;
  }
  return true;
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (!("Notification" in window)) return "unsupported";
  return Notification.permission;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  // Use an explicit scope so it doesn't conflict with the Workbox SW at /
  return navigator.serviceWorker.register(SW_PATH, { scope: "/" });
}

/**
 * Ask for permission (if not already granted) and create a push subscription,
 * persisting it server-side. Returns true if the device is now subscribed.
 */
export async function enablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!isPushSupported()) {
    return { ok: false, reason: "Push notifications aren't supported in this browser/context." };
  }

  // 1. Permission
  let perm = Notification.permission;
  if (perm === "default") {
    perm = await Notification.requestPermission();
  }
  if (perm !== "granted") {
    return { ok: false, reason: "Notification permission denied." };
  }

  // 2. Service worker
  const registration = await registerServiceWorker();
  // Wait for it to be ready/active.
  await navigator.serviceWorker.ready;

  // 3. Existing subscription?
  let sub = await registration.pushManager.getSubscription();
  if (!sub) {
    sub = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY).buffer as ArrayBuffer,
    });
  }

  // 4. Persist server-side
  const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } };
  const endpoint = json.endpoint ?? sub.endpoint;
  const p256dh =
    json.keys?.p256dh ?? arrayBufferToBase64Url(sub.getKey("p256dh"));
  const auth = json.keys?.auth ?? arrayBufferToBase64Url(sub.getKey("auth"));

  if (!endpoint || !p256dh || !auth) {
    return { ok: false, reason: "Failed to read subscription keys." };
  }

  const { data: userData, error: authErr } = await supabase.auth.getUser();
  if (authErr || !userData.user) {
    return { ok: false, reason: "You need to be signed in to enable push notifications." };
  }

  const { error: upsertErr } = await supabase
    .from("push_subscriptions")
    .upsert(
      {
        user_id: userData.user.id,
        endpoint,
        p256dh,
        auth,
        user_agent: navigator.userAgent.slice(0, 500),
        platform: detectPlatform(),
        is_active: true,
        last_seen_at: new Date().toISOString(),
        failure_count: 0,
      },
      { onConflict: "user_id,endpoint" }
    );

  if (upsertErr) {
    return { ok: false, reason: upsertErr.message };
  }

  return { ok: true };
}

/**
 * Unsubscribe locally and mark the subscription inactive server-side.
 */
export async function disablePushNotifications(): Promise<{ ok: boolean; reason?: string }> {
  if (!("serviceWorker" in navigator)) return { ok: true };
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    const sub = await registration?.pushManager.getSubscription();
    if (sub) {
      await supabase
        .from("push_subscriptions")
        .update({ is_active: false })
        .eq("endpoint", sub.endpoint);
      await sub.unsubscribe();
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e instanceof Error ? e.message : String(e) };
  }
}

export async function getCurrentSubscription(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const registration = await navigator.serviceWorker.getRegistration(SW_PATH);
    return (await registration?.pushManager.getSubscription()) ?? null;
  } catch {
    return null;
  }
}
