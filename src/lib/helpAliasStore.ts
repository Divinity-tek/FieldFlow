// Runtime store of admin-managed help path aliases (path → slug).
// Loaded from the `help_path_aliases` table once at app startup, then kept in
// sync via Supabase Realtime. Falls back to an empty object if the table can't
// be read (unauthenticated, network issues, etc.).

import { supabase } from "@/integrations/supabase/client";

type AliasMap = Record<string, string>;

let cache: AliasMap = {};
const listeners = new Set<(map: AliasMap) => void>();

export function getRuntimeAliases(): AliasMap {
  return cache;
}

export function subscribeRuntimeAliases(cb: (map: AliasMap) => void): () => void {
  listeners.add(cb);
  cb(cache);
  return () => listeners.delete(cb);
}

function emit() {
  for (const l of listeners) l(cache);
}

export async function reloadRuntimeAliases(): Promise<AliasMap> {
  const { data, error } = await supabase
    .from("help_path_aliases")
    .select("path, slug");
  if (error || !data) return cache;
  const next: AliasMap = {};
  for (const row of data) next[row.path] = row.slug;
  cache = next;
  emit();
  return cache;
}

let started = false;
export function startRuntimeAliasSync() {
  if (started) return;
  started = true;
  reloadRuntimeAliases();
  supabase
    .channel("help_path_aliases_sync")
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "help_path_aliases" },
      () => {
        reloadRuntimeAliases();
      },
    )
    .subscribe();
}
