import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Persists a user preference to the database (user_preferences table).
 * Falls back to localStorage when user is not logged in.
 */
export function useUserPreference<T>(key: string, defaultValue: T) {
  const { user } = useAuth();
  const [value, setValue] = useState<T>(defaultValue);
  const [loaded, setLoaded] = useState(false);

  // Load from DB on mount / user change
  useEffect(() => {
    if (!user?.id) {
      // Fallback to localStorage for unauthenticated users
      try {
        const stored = localStorage.getItem(key);
        if (stored) setValue(JSON.parse(stored));
      } catch { /* ignore */ }
      setLoaded(true);
      return;
    }

    let cancelled = false;
    const load = async () => {
      const { data } = await supabase
        .from("user_preferences")
        .select("value")
        .eq("user_id", user.id)
        .eq("key", key)
        .maybeSingle();
      if (!cancelled) {
        if (data?.value !== undefined && data?.value !== null) {
          setValue(data.value as T);
        }
        setLoaded(true);
      }
    };
    load();
    return () => { cancelled = true; };
  }, [user?.id, key]);

  const update = useCallback(async (newValue: T) => {
    setValue(newValue);

    if (!user?.id) {
      localStorage.setItem(key, JSON.stringify(newValue));
      return;
    }

    await supabase
      .from("user_preferences")
      .upsert(
        { user_id: user.id, key, value: newValue as any },
        { onConflict: "user_id,key" }
      );
  }, [user?.id, key]);

  const remove = useCallback(async () => {
    setValue(defaultValue);

    if (!user?.id) {
      localStorage.removeItem(key);
      return;
    }

    await supabase
      .from("user_preferences")
      .delete()
      .eq("user_id", user.id)
      .eq("key", key);
  }, [user?.id, key, defaultValue]);

  return { value, update, remove, loaded };
}
