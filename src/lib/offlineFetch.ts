/**
 * Global fetch interceptor that captures Supabase REST mutations made while
 * the device is offline (or the network errors out) and persists them to
 * the offline queue for later replay.
 *
 * Scope (per user choice "All non-critical mutations"):
 *   - Captures POST/PATCH/PUT/DELETE to *.supabase.co/rest/v1/<table>
 *   - Skips auth, storage, edge functions, and a deny-list of critical tables
 *   - Skips reads (GET / HEAD)
 *
 * Behaviour when offline:
 *   - Persist the request to the queue
 *   - Return a synthetic 202 success response so the calling code's optimistic
 *     UI doesn't show a hard error. The actual write happens on reconnect.
 *   - Show a toast informing the user the action is queued.
 */
import { toast } from "sonner";
import { enqueue } from "./offlineQueue";

const CRITICAL_TABLES = new Set([
  // Anything money-related — never silently queue.
  "payments",
  "payment_intents",
  "wallets",
  "wallet_transactions",
  "wallet_topups",
  "payouts",
  "payout_claims",
  "invoices",
  "invoice_items",
  "invoice_payments",
  "transactions",
  // Identity / role changes — never silently queue.
  "user_roles",
  "profiles_admin",
]);

function parseSupabaseRest(url: string): { table: string } | null {
  try {
    const u = new URL(url, window.location.href);
    if (!/\.supabase\.co$/i.test(u.hostname) && !/\.supabase\.in$/i.test(u.hostname)) return null;
    const m = u.pathname.match(/^\/rest\/v1\/([^/?]+)/);
    if (!m) return null;
    return { table: decodeURIComponent(m[1]) };
  } catch {
    return null;
  }
}

function methodMutates(m: string): boolean {
  const u = m.toUpperCase();
  return u === "POST" || u === "PATCH" || u === "PUT" || u === "DELETE";
}

function shouldQueue(url: string, method: string): { ok: true; table: string } | { ok: false } {
  if (!methodMutates(method)) return { ok: false };
  const parsed = parseSupabaseRest(url);
  if (!parsed) return { ok: false };
  if (CRITICAL_TABLES.has(parsed.table)) return { ok: false };
  return { ok: true, table: parsed.table };
}

function describeAction(method: string, table: string, body: string | null): string {
  const verb =
    method === "POST" ? "Create" :
    method === "DELETE" ? "Delete" :
    "Update";
  // Try to extract an id-ish field for context
  let suffix = "";
  if (body) {
    try {
      const parsed = JSON.parse(body);
      const obj = Array.isArray(parsed) ? parsed[0] : parsed;
      if (obj?.id) suffix = ` #${String(obj.id).slice(0, 8)}`;
      else if (obj?.title) suffix = ` "${String(obj.title).slice(0, 30)}"`;
      else if (obj?.name) suffix = ` "${String(obj.name).slice(0, 30)}"`;
    } catch { /* ignore */ }
  }
  return `${verb} ${table.replace(/_/g, " ")}${suffix}`;
}

/** Headers to persist. Strip hop-by-hop and request-specific noise. */
const HEADER_DENYLIST = new Set([
  "host", "connection", "content-length", "accept-encoding",
  "user-agent", "referer", "origin", "cookie",
]);

function serializeHeaders(h: HeadersInit | undefined, fallback: Headers): Record<string, string> {
  const out: Record<string, string> = {};
  const copy = (key: string, value: string) => {
    if (HEADER_DENYLIST.has(key.toLowerCase())) return;
    out[key] = value;
  };
  if (h) {
    if (h instanceof Headers) {
      h.forEach((v, k) => copy(k, v));
    } else if (Array.isArray(h)) {
      for (const [k, v] of h) copy(k, v);
    } else {
      for (const [k, v] of Object.entries(h)) copy(k, v as string);
    }
  } else {
    fallback.forEach((v, k) => copy(k, v));
  }
  return out;
}

function syntheticQueuedResponse(method: string, body: string | null): Response {
  // For Supabase REST, returning [] for selects and 200 status is the safest
  // synthetic response. The real result will appear after sync completes and
  // queries refetch. We do NOT echo the body as a fake row because it lacks
  // server-generated fields (id, created_at) and would corrupt caches.
  const responseBody = method === "DELETE" ? null : "[]";
  return new Response(responseBody, {
    status: 200,
    statusText: "OK (Offline Queued)",
    headers: {
      "Content-Type": "application/json",
      "X-Offline-Queued": "1",
    },
  });
}

let installed = false;
let suppressNextQueueToast = false;

export function suppressOfflineToastOnce() {
  suppressNextQueueToast = true;
}

export function installOfflineFetchInterceptor() {
  if (installed) return;
  installed = true;

  const originalFetch = window.fetch.bind(window);
  let pendingToastTimer: number | null = null;
  let pendingToastCount = 0;

  const flushToast = () => {
    if (pendingToastCount > 0 && !suppressNextQueueToast) {
      toast("Saved offline", {
        description:
          pendingToastCount === 1
            ? "We'll sync this change when you're back online."
            : `${pendingToastCount} changes will sync when you're back online.`,
      });
    }
    suppressNextQueueToast = false;
    pendingToastCount = 0;
    pendingToastTimer = null;
  };

  const queueToast = () => {
    pendingToastCount += 1;
    if (pendingToastTimer == null) {
      pendingToastTimer = window.setTimeout(flushToast, 400);
    }
  };

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = (init?.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

    const queueDecision = shouldQueue(url, method);
    if (!queueDecision.ok) {
      return originalFetch(input as RequestInfo, init);
    }

    // Read the body once, up front, so we can persist if needed.
    let bodyText: string | null = null;
    try {
      if (input instanceof Request) {
        // We may have been given a Request — clone to read body without consuming.
        const cloned = input.clone();
        bodyText = await cloned.text();
      } else if (init?.body != null) {
        if (typeof init.body === "string") bodyText = init.body;
        else if (init.body instanceof Blob) bodyText = await init.body.text();
        else if (init.body instanceof FormData) bodyText = null; // not supported in queue
        else bodyText = JSON.stringify(init.body);
      }
    } catch {
      bodyText = null;
    }

    const tryQueue = async (reason: "offline" | "network-error", err?: unknown) => {
      const headers = serializeHeaders(
        init?.headers,
        input instanceof Request ? input.headers : new Headers()
      );
      const label = describeAction(method, queueDecision.table, bodyText);
      const resource = `${queueDecision.table}/${(() => {
        try {
          const u = new URL(url, window.location.href);
          return u.searchParams.get("id") || u.search || "new";
        } catch { return "new"; }
      })()}`;
      try {
        await enqueue({ url, method, headers, body: bodyText, label, resource });
        queueToast();
      } catch (e) {
        // If we can't even queue it, fall back to the original error.
        if (reason === "network-error") throw err;
      }
      return syntheticQueuedResponse(method, bodyText);
    };

    // 1. Already offline — queue immediately.
    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      return tryQueue("offline");
    }

    // 2. Try the request; if it errors with a network failure, queue it.
    try {
      // If `input` was a Request we already consumed its body, so we must
      // rebuild the request with explicit method/headers/body.
      let target: RequestInfo | URL;
      let replayInit: RequestInit;
      if (input instanceof Request) {
        replayInit = {
          method: input.method,
          headers: input.headers,
          body: bodyText ?? undefined,
          credentials: input.credentials,
          mode: input.mode,
          cache: input.cache,
          redirect: input.redirect,
          referrer: input.referrer,
          integrity: input.integrity,
          ...(init || {}),
        };
        if (bodyText != null) replayInit.body = bodyText;
        target = url;
      } else {
        replayInit = init ? { ...init } : {};
        if (bodyText != null && !(init?.body instanceof FormData)) {
          replayInit.body = bodyText;
        }
        target = input;
      }
      return await originalFetch(target, replayInit);
    } catch (err) {
      // TypeError from fetch === network failure (DNS, offline, CORS pre-fetch)
      if (err instanceof TypeError) {
        return tryQueue("network-error", err);
      }
      throw err;
    }
  };
}
