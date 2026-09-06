import { useEffect, useState, useCallback } from "react";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  BellOff,
  Smartphone,
  Download,
  CheckCircle2,
  AlertCircle,
  Info,
  Loader2,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import {
  enablePushNotifications,
  disablePushNotifications,
  isPushSupported,
  getNotificationPermission,
  getCurrentSubscription,
} from "@/lib/pushNotifications";

type InstallState = "installed" | "installable" | "not-installable";
type Platform = "ios" | "android" | "desktop" | "other";

const detectPlatform = (): Platform => {
  const ua = navigator.userAgent || "";
  if (/iphone|ipad|ipod/i.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  if (/macintosh|windows|linux|cros/i.test(ua)) return "desktop";
  return "other";
};

const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  (window.navigator as any).standalone === true;

const DeviceSettings = () => {
  const [permission, setPermission] = useState<NotificationPermission | "unsupported">("default");
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [installState, setInstallState] = useState<InstallState>("not-installable");
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [platform] = useState<Platform>(detectPlatform());
  const supported = isPushSupported();

  const refresh = useCallback(async () => {
    setPermission(getNotificationPermission());
    const sub = await getCurrentSubscription();
    setSubscribed(!!sub);
  }, []);

  useEffect(() => {
    refresh();

    if (isStandalone()) {
      setInstallState("installed");
    }

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setInstallState((s) => (s === "installed" ? s : "installable"));
    };
    const onInstalled = () => {
      setInstallState("installed");
      setDeferredPrompt(null);
    };

    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, [refresh]);

  const handleEnable = async () => {
    setBusy(true);
    const result = await enablePushNotifications();
    setBusy(false);
    if (result.ok) {
      toast.success("Push notifications enabled");
    } else {
      toast.error(result.reason ?? "Couldn't enable notifications");
    }
    await refresh();
  };

  const handleDisable = async () => {
    setBusy(true);
    const result = await disablePushNotifications();
    setBusy(false);
    if (result.ok) {
      toast.success("Push notifications disabled");
    } else {
      toast.error(result.reason ?? "Couldn't disable notifications");
    }
    await refresh();
  };

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === "accepted") {
      toast.success("App installed");
      setInstallState("installed");
    }
    setDeferredPrompt(null);
  };

  const permissionBadge = () => {
    if (permission === "granted")
      return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">Granted</Badge>;
    if (permission === "denied")
      return <Badge variant="destructive">Blocked</Badge>;
    if (permission === "unsupported")
      return <Badge variant="secondary">Not supported</Badge>;
    return <Badge variant="outline">Not requested</Badge>;
  };

  const installBadge = () => {
    if (installState === "installed")
      return <Badge className="bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/30">Installed</Badge>;
    if (installState === "installable")
      return <Badge className="bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30">Available</Badge>;
    return <Badge variant="secondary">Not available here</Badge>;
  };

  return (
    <AppLayout title="Device & Notifications">
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Device & Notifications</h1>
          <p className="text-muted-foreground mt-1">
            Manage push notification permissions and see how this app is installed on your device.
          </p>
        </div>

        {/* Install status */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <CardTitle>App installation</CardTitle>
                  <CardDescription>Install for offline access and a native-app feel</CardDescription>
                </div>
              </div>
              {installBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Display mode</div>
                <div className="font-medium">{isStandalone() ? "Standalone (app)" : "Browser tab"}</div>
              </div>
              <div>
                <div className="text-muted-foreground">Platform</div>
                <div className="font-medium capitalize">{platform}</div>
              </div>
            </div>

            {installState === "installed" && (
              <div className="flex items-start gap-2 rounded-lg bg-green-500/10 border border-green-500/20 p-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 shrink-0" />
                <span>You're using the installed app. All features including offline mode and push notifications work here.</span>
              </div>
            )}

            {installState === "installable" && (
              <Button onClick={handleInstall} className="w-full sm:w-auto">
                <Download className="w-4 h-4 mr-2" />
                Install app
              </Button>
            )}

            {installState === "not-installable" && platform === "ios" && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-sm">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium mb-1">Install on iPhone / iPad</div>
                  <div className="text-muted-foreground">
                    Tap the Share button in Safari, then choose <strong>Add to Home Screen</strong>. Push notifications require iOS 16.4 or newer and the installed app.
                  </div>
                </div>
              </div>
            )}

            {installState === "not-installable" && platform !== "ios" && (
              <div className="flex items-start gap-2 rounded-lg bg-muted/50 border border-border p-3 text-sm">
                <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                <span className="text-muted-foreground">
                  Your browser hasn't offered an install prompt yet. Try visiting again later or use Chrome / Edge for best results.
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Notification permission */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  {subscribed ? <Bell className="w-5 h-5 text-primary" /> : <BellOff className="w-5 h-5 text-primary" />}
                </div>
                <div>
                  <CardTitle>Push notifications</CardTitle>
                  <CardDescription>Real-time alerts for jobs, chat, and SLA escalations</CardDescription>
                </div>
              </div>
              {permissionBadge()}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Browser permission</div>
                <div className="font-medium capitalize">{permission}</div>
              </div>
              <div>
                <div className="text-muted-foreground">This device</div>
                <div className="font-medium">{subscribed ? "Subscribed" : "Not subscribed"}</div>
              </div>
            </div>

            <Separator />

            {!supported && (
              <div className="flex items-start gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 text-sm">
                <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium mb-1">Not available in this context</div>
                  <div className="text-muted-foreground">
                    {platform === "ios"
                      ? "On iPhone / iPad, push only works after installing the app to your home screen (iOS 16.4+)."
                      : "Push notifications need a supported browser running outside of preview iframes."}
                  </div>
                </div>
              </div>
            )}

            {supported && permission === "denied" && (
              <div className="flex items-start gap-2 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm">
                <ShieldAlert className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <div className="font-medium mb-1">Notifications are blocked</div>
                  <div className="text-muted-foreground">
                    Re-enable them in your browser's site settings (lock icon in the address bar), then come back and turn them on here.
                  </div>
                </div>
              </div>
            )}

            {supported && permission !== "denied" && (
              <div className="flex flex-wrap gap-2">
                {!subscribed ? (
                  <Button onClick={handleEnable} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Bell className="w-4 h-4 mr-2" />}
                    Enable notifications
                  </Button>
                ) : (
                  <Button variant="outline" onClick={handleDisable} disabled={busy}>
                    {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <BellOff className="w-4 h-4 mr-2" />}
                    Disable on this device
                  </Button>
                )}
                <Button variant="ghost" onClick={refresh} disabled={busy}>
                  Refresh status
                </Button>
              </div>
            )}

            <p className="text-xs text-muted-foreground">
              Notifications are managed per-device. Enabling here won't affect your other phones, tablets, or computers.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DeviceSettings;
