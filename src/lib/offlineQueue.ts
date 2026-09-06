/**
 * IndexedDB-backed queue of mutations that failed because the device was
 * offline. Items are replayed by offlineSync when the network returns.
 *
 * Critical / never-queue paths (auth, storage, edge functions) are filtered
 * out before reaching this module — see offlineFetch.ts.
 */

export type QueueStatus = "pending" | "syncing" | "failed" | "conflict";

export interface QueuedAction {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string | null;
  /** Human label, e.g. "Update job status" */
  label: string;
  /** Logical resource key, e.g. "jobs/abc-123" */
  resource: string;
  createdAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  lastError: string | null;
  status: QueueStatus;
}

const DB_NAME = "fieldflow-offline";
const DB_VERSION = 1;
const STORE = "queue";

let dbPromise: Promise<IDBDatabase> | null = null;

function openDb(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: "id" });
        store.createIndex("status", "status");
        store.createIndex("createdAt", "createdAt");
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

async function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => Promise<T> | T): Promise<T> {
  const db = await openDb();
  return new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const store = t.objectStore(STORE);
    Promise.resolve(fn(store)).then(
      (val) => {
        t.oncomplete = () => resolve(val);
        t.onerror = () => reject(t.error);
        t.onabort = () => reject(t.error);
      },
      reject
    );
  });
}

function reqToPromise<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

// ---------- subscribers ----------
type Listener = () => void;
const listeners = new Set<Listener>();
let cachedSnapshot: QueuedAction[] = [];

function emit() {
  listeners.forEach((l) => l());
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot(): QueuedAction[] {
  return cachedSnapshot;
}

async function refreshSnapshot() {
  cachedSnapshot = await listAll();
  emit();
}

// ---------- API ----------

export async function enqueue(action: Omit<QueuedAction, "id" | "createdAt" | "attempts" | "lastAttemptAt" | "lastError" | "status">): Promise<QueuedAction> {
  const item: QueuedAction = {
    id: crypto.randomUUID(),
    createdAt: Date.now(),
    attempts: 0,
    lastAttemptAt: null,
    lastError: null,
    status: "pending",
    ...action,
  };
  await tx("readwrite", (store) => reqToPromise(store.add(item)));
  await refreshSnapshot();
  return item;
}

export async function update(id: string, patch: Partial<QueuedAction>): Promise<void> {
  await tx("readwrite", async (store) => {
    const existing = (await reqToPromise(store.get(id))) as QueuedAction | undefined;
    if (!existing) return;
    await reqToPromise(store.put({ ...existing, ...patch }));
  });
  await refreshSnapshot();
}

export async function remove(id: string): Promise<void> {
  await tx("readwrite", (store) => reqToPromise(store.delete(id)));
  await refreshSnapshot();
}

export async function clear(status?: QueueStatus): Promise<void> {
  await tx("readwrite", async (store) => {
    if (!status) {
      await reqToPromise(store.clear());
      return;
    }
    const all = (await reqToPromise(store.getAll())) as QueuedAction[];
    for (const item of all) {
      if (item.status === status) await reqToPromise(store.delete(item.id));
    }
  });
  await refreshSnapshot();
}

export async function listAll(): Promise<QueuedAction[]> {
  return tx("readonly", async (store) => {
    const items = (await reqToPromise(store.getAll())) as QueuedAction[];
    return items.sort((a, b) => a.createdAt - b.createdAt);
  });
}

export async function listPending(): Promise<QueuedAction[]> {
  const all = await listAll();
  return all.filter((a) => a.status === "pending" || a.status === "failed");
}

// Initialize snapshot
if (typeof indexedDB !== "undefined") {
  refreshSnapshot().catch(() => {});
}
