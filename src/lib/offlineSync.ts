/**
 * Drains the offline queue when the device reconnects.
 *
 * Conflict policy: "Server wins, notify user".
 *   - 2xx           → mark synced, remove from queue
 *   - 4xx (non-401) → conflict — server rejected the change. Mark, notify, keep
 *                      in queue for manual review (UI offers Discard).
 *   - 401/403       → auth issue — keep as failed; user must re-login
 *   - 5xx / network → transient — leave pending, retry on next online event
 *                     with exponential backoff.
 */
import { toast } from "sonner";
import { listPending, update, getSnapshot, type QueuedAction } from "./offlineQueue";

const MAX_ATTEMPTS = 8;
let draining = false;
let backoffTimer: number | null = null;

function backoffDelay(attempts: number): number {
  // 5s, 10s, 20s, 40s, 80s, 160s, 320s, capped at 5 min
  return Math.min(5_000 * Math.pow(2, attempts), 5 * 60 * 1000);
}

async function replay(action: QueuedAction): Promise<{ ok: boolean; status?: number; error?: string }> {
  try {
    // Use the original fetch so we don't recurse through the interceptor.
    // The interceptor only queues when offline, so this is safe — but we
    // still bypass to keep the replay path explicit.
    const res = await fetch(action.url, {
      method: action.method,
      headers: action.headers,
      body: action.body ?? undefined,
    });
    if (res.ok) return { ok: true, status: res.status };
    let errorBody = "";
    try { errorBody = await res.text(); } catch { /* ignore */ }
    return { ok: false, status: res.status, error: errorBody.slice(0, 500) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export async function drainQueue(): Promise<void> {
  if (draining) return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  draining = true;
  try {
    const pending = await listPending();
    if (pending.length === 0) return;

    let synced = 0;
    let conflicted = 0;
    let stillPending = 0;

    for (const action of pending) {
      await update(action.id, { status: "syncing", lastAttemptAt: Date.now() });
      const result = await replay(action);

      if (result.ok) {
        // Remove from queue entirely on success — leave no trail.
        const { remove } = await import("./offlineQueue");
        await remove(action.id);
        synced++;
        continue;
      }

      const status = result.status ?? 0;
      const isClientConflict = status >= 400 && status < 500 && status !== 401 && status !== 403 && status !== 408 && status !== 429;
      const isAuthIssue = status === 401 || status === 403;
      const isTransient = !status /* network */ || status >= 500 || status === 408 || status === 429;

      const nextAttempts = action.attempts + 1;

      if (isClientConflict) {
        await update(action.id, {
          status: "conflict",
          attempts: nextAttempts,
          lastError: `HTTP ${status}: ${result.error || "rejected by server"}`,
        });
        conflicted++;
      } else if (isAuthIssue) {
        await update(action.id, {
          status: "failed",
          attempts: nextAttempts,
          lastError: `Authentication required (HTTP ${status})`,
        });
        stillPending++;
      } else if (isTransient && nextAttempts < MAX_ATTEMPTS) {
        await update(action.id, {
          status: "pending",
          attempts: nextAttempts,
          lastError: result.error ?? `HTTP ${status}`,
        });
        stillPending++;
      } else {
        await update(action.id, {
          status: "failed",
          attempts: nextAttempts,
          lastError: result.error ?? `HTTP ${status}`,
        });
        stillPending++;
      }
    }

    if (synced > 0) {
      toast.success(synced === 1 ? "Synced 1 offline change" : `Synced ${synced} offline changes`);
    }
    if (conflicted > 0) {
      toast.error(
        conflicted === 1
          ? "1 offline change couldn't be applied"
          : `${conflicted} offline changes couldn't be applied`,
        { description: "Server state changed since you made the edit. Open the queue to review." }
      );
    }

    // If there are still transient failures, schedule a backoff retry.
    if (stillPending > 0) {
      const remaining = (await listPending()).filter((a) => a.status === "pending");
      if (remaining.length > 0) {
        const maxAttempts = Math.max(...remaining.map((r) => r.attempts));
        scheduleRetry(backoffDelay(maxAttempts));
      }
    }
  } finally {
    draining = false;
  }
}

function scheduleRetry(delay: number) {
  if (backoffTimer != null) window.clearTimeout(backoffTimer);
  backoffTimer = window.setTimeout(() => {
    backoffTimer = null;
    drainQueue().catch(() => {});
  }, delay);
}

export async function retryAction(id: string) {
  const all = getSnapshot();
  const action = all.find((a) => a.id === id);
  if (!action) return;
  await update(id, { status: "pending", lastError: null });
  drainQueue();
}

export function startOfflineSync() {
  if (typeof window === "undefined") return;

  const onOnline = () => {
    drainQueue().catch(() => {});
  };
  window.addEventListener("online", onOnline);

  // Also try to drain on page load in case there's a stale queue.
  if (navigator.onLine) {
    // Slight delay so auth tokens etc. settle before we replay.
    window.setTimeout(() => drainQueue().catch(() => {}), 1500);
  }

  // Best-effort Background Sync registration (Chrome/Edge/Android only).
  // The actual replay still happens in the foreground via the listener above —
  // this just tells the OS to wake the SW when network returns even if the
  // tab is closed. Currently we don't ship a custom SW handler for it, so
  // this is a no-op until the SW knows the 'fieldflow-sync' tag.
  if ("serviceWorker" in navigator && "SyncManager" in window) {
    navigator.serviceWorker.ready
      .then((reg) => (reg as any).sync?.register?.("fieldflow-sync"))
      .catch(() => { /* unsupported — fine, foreground sync still works */ });
  }
}
