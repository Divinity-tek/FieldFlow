import { useEffect, useState } from "react";
import { Bell, BellOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import {
  enablePushNotifications,
  disablePushNotifications,
  isPushSupported,
  getNotificationPermission,
  getCurrentSubscription,
} from "@/lib/pushNotifications";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "fieldflow:push-prompt-dismissed";
const DISMISS_DAYS = 14;

const recentlyDismissed = () => {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const EnableNotificationsBanner = () => {
  const { user } = useAuth();
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      if (!user) return;
      if (!isPushSupported()) return;
      if (recentlyDismissed()) return;
      const perm = getNotificationPermission();
      if (perm === "denied" || perm === "unsupported") return;
      const sub = await getCurrentSubscription();
      if (sub) return; // already subscribed
      if (!cancelled) setShow(true);
    };
    // Delay so the page settles first.
    const t = window.setTimeout(check, 2500);
    return () => { cancelled = true; window.clearTimeout(t); };
  }, [user]);

  if (!show) return null;

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    setShow(false);
  };

  const enable = async () => {
    setBusy(true);
    const result = await enablePushNotifications();
    setBusy(false);
    if (result.ok) {
      toast.success("Push notifications enabled");
      setShow(false);
    } else {
      toast.error(result.reason ?? "Couldn't enable notifications");
      // If permission was denied we shouldn't keep nagging.
      if (result.reason?.toLowerCase().includes("denied")) dismiss();
    }
  };

  return (
    <div
      role="dialog"
      aria-label="Enable push notifications"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[55] glass-card rounded-2xl border border-border/60 shadow-elegant p-4 animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Bell className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Get real-time alerts</p>
          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
            Stay on top of new job assignments, schedule changes, and SLA escalations even when FieldFlow is closed.
          </p>
          <div className="flex gap-2 mt-3">
            <Button size="sm" onClick={enable} disabled={busy} className="h-8">
              <Bell className="w-3.5 h-3.5 mr-1.5" />
              {busy ? "Enabling…" : "Enable"}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
              Not now
            </Button>
          </div>
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss notification prompt"
          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default EnableNotificationsBanner;

/**
 * Compact toggle row for the Settings page.
 */
export const PushNotificationsToggle = () => {
  const [perm, setPerm] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setPerm(getNotificationPermission());
    const sub = await getCurrentSubscription();
    setSubscribed(!!sub);
  };

  useEffect(() => { refresh(); }, []);

  if (!isPushSupported()) {
    const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
    const iOS = /iphone|ipad|ipod/i.test(ua);
    return (
      <div className="rounded-lg border border-border bg-muted/30 p-4 text-sm">
        <div className="flex items-center gap-2 font-medium text-foreground">
          <BellOff className="w-4 h-4" />
          Push notifications unavailable
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {iOS
            ? "On iPhone/iPad, install FieldFlow to your home screen first (Share → Add to Home Screen) and ensure iOS 16.4 or later."
            : "Your browser doesn't support web push, or you're viewing inside a preview."}
        </p>
      </div>
    );
  }

  const onToggle = async () => {
    setBusy(true);
    if (subscribed || perm === "granted") {
      const r = await disablePushNotifications();
      if (r.ok) toast.success("Push notifications disabled");
      else toast.error(r.reason ?? "Couldn't disable");
    } else {
      const r = await enablePushNotifications();
      if (r.ok) toast.success("Push notifications enabled");
      else toast.error(r.reason ?? "Couldn't enable");
    }
    await refresh();
    setBusy(false);
  };

  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
        {subscribed ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-muted-foreground" />}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium">Push notifications</p>
        <p className="text-xs text-muted-foreground">
          {perm === "denied"
            ? "Permission blocked — re-enable in your browser settings."
            : subscribed
              ? "Enabled on this device."
              : "Get alerts even when FieldFlow is closed."}
        </p>
      </div>
      <Button
        size="sm"
        variant={subscribed ? "outline" : "default"}
        onClick={onToggle}
        disabled={busy || perm === "denied"}
      >
        {busy ? "…" : subscribed ? "Disable" : "Enable"}
      </Button>
    </div>
  );
};
