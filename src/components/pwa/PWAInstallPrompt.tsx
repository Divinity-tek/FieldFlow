import { useEffect, useState } from "react";
import { Download, X, Share } from "lucide-react";
import { Button } from "@/components/ui/button";
import FieldFlowMark from "@/components/branding/FieldFlowMark";
const trackInstallEvent = (_event: string) => {};

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "fieldflow:pwa-install-dismissed";
const DISMISS_DAYS = 14;

const isStandalone = () =>
  typeof window !== "undefined" &&
  (window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari
    (window.navigator as any).standalone === true);

const isIos = () =>
  typeof window !== "undefined" &&
  /iphone|ipad|ipod/i.test(window.navigator.userAgent) &&
  !/CriOS|FxiOS|EdgiOS/.test(window.navigator.userAgent);

const isInIframe = () => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
};

const recentlyDismissed = () => {
  try {
    const ts = Number(localStorage.getItem(DISMISS_KEY));
    if (!ts) return false;
    return Date.now() - ts < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
};

const PWAInstallPrompt = () => {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [showIos, setShowIos] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isStandalone() || isInIframe() || recentlyDismissed()) return;

    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setVisible(true);
      trackInstallEvent("impression");
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);

    // Fire once when the app is actually installed (Chrome/Android).
    const onInstalled = () => trackInstallEvent("installed");
    window.addEventListener("appinstalled", onInstalled);

    // iOS doesn't fire beforeinstallprompt — show manual hint after a delay
    if (isIos()) {
      const t = setTimeout(() => {
        setShowIos(true);
        setVisible(true);
        trackInstallEvent("impression");
        trackInstallEvent("ios_hint_shown");
      }, 4000);
      return () => {
        clearTimeout(t);
        window.removeEventListener("beforeinstallprompt", onBeforeInstall);
        window.removeEventListener("appinstalled", onInstalled);
      };
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const dismiss = () => {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch {}
    trackInstallEvent("dismiss");
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    if (outcome === "accepted") {
      trackInstallEvent("accept");
      setVisible(false);
    } else {
      // userChoice "dismissed" — count it as a dismiss.
      dismiss();
    }
    setDeferred(null);
  };

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Install FieldFlow"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-4 sm:max-w-sm z-[60] glass-card rounded-2xl border border-border/60 shadow-elegant p-4 animate-fade-in"
    >
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-xl bg-secondary p-1.5 shrink-0">
          <FieldFlowMark variant="icon" width={48} height={48} className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Install FieldFlow</p>
          {showIos ? (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Tap <Share className="inline w-3.5 h-3.5 align-text-bottom" /> Share, then
              <span className="font-medium text-foreground"> "Add to Home Screen"</span> for the full app experience.
            </p>
          ) : (
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              Add FieldFlow to your home screen for faster access and a full-screen experience.
            </p>
          )}
          {!showIos && (
            <div className="flex gap-2 mt-3">
              <Button size="sm" onClick={install} className="h-8">
                <Download className="w-3.5 h-3.5 mr-1.5" />
                Install
              </Button>
              <Button size="sm" variant="ghost" onClick={dismiss} className="h-8">
                Not now
              </Button>
            </div>
          )}
        </div>
        <button
          onClick={dismiss}
          aria-label="Dismiss install prompt"
          className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default PWAInstallPrompt;
