import { useSyncExternalStore } from "react";
import { subscribe, getSnapshot, type QueuedAction } from "@/lib/offlineQueue";

export function useOfflineQueue(): QueuedAction[] {
  return useSyncExternalStore(subscribe, getSnapshot, () => []);
}

export function useOfflineCounts() {
  const items = useOfflineQueue();
  return {
    items,
    pending: items.filter((i) => i.status === "pending" || i.status === "syncing").length,
    failed: items.filter((i) => i.status === "failed").length,
    conflict: items.filter((i) => i.status === "conflict").length,
    total: items.length,
  };
}
