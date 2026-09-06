// Service worker registration with strict guards.
// - Never registers in dev
// - Never registers inside an iframe (embedded previews)
// - Never registers on localhost
// - On those contexts, actively unregisters any pre-existing SW so we don't
//   serve stale content.
import { toast } from "sonner";

const isInIframe = (() => {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

const host = window.location.hostname;
const isPreviewHost =
  host === "localhost" ||
  host === "127.0.0.1";

export function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  if (isInIframe || isPreviewHost || import.meta.env.DEV) {
    // Clean up any previously installed SW so the editor preview is never stale.
    navigator.serviceWorker.getRegistrations?.().then((regs) => {
      regs.forEach((r) => r.unregister().catch(() => {}));
    });
    return;
  }

  // Lazy import so workbox-window isn't pulled into the editor preview bundle path.
  import("workbox-window").then(({ Workbox }) => {
    const wb = new Workbox("/sw.js");

    wb.addEventListener("waiting", () => {
      toast("New version available", {
        description: "Reload to get the latest update.",
        action: {
          label: "Reload",
          onClick: () => {
            wb.addEventListener("controlling", () => window.location.reload());
            wb.messageSkipWaiting();
          },
        },
        duration: 10000,
      });
    });

    wb.register().catch(() => {
      // silent — offline mode is non-critical
    });
  });
}
