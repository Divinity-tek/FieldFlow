import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Loads the set of job IDs the engineer has already acknowledged an SLA
 * escalation for. Source of truth is the `job_events` table (kind =
 * 'escalation_ack'), so it persists across refreshes and devices.
 *
 * A localStorage mirror is kept so the gate unlocks instantly on the next
 * load even before the network round-trip finishes.
 */

const LS_KEY = (engineerId: string) => `engineer.sla.escalation_ack.set:${engineerId}`;

function readCache(engineerId: string): Set<string> {
  try {
    const raw = localStorage.getItem(LS_KEY(engineerId));
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

function writeCache(engineerId: string, set: Set<string>) {
  try {
    localStorage.setItem(LS_KEY(engineerId), JSON.stringify(Array.from(set)));
  } catch {
    /* ignore */
  }
}

export function useEscalationAcks(engineerId: string | undefined) {
  const [acked, setAcked] = useState<Set<string>>(() =>
    engineerId ? readCache(engineerId) : new Set()
  );
  const [loaded, setLoaded] = useState(false);
  const engineerIdRef = useRef(engineerId);
  engineerIdRef.current = engineerId;

  // Load from DB on mount / engineer change
  useEffect(() => {
    if (!engineerId) {
      setAcked(new Set());
      setLoaded(false);
      return;
    }
    setAcked(readCache(engineerId));

    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("job_events")
        .select("job_id")
        .eq("engineer_id", engineerId)
        .eq("kind", "escalation_ack");
      if (cancelled) return;
      if (!error && data) {
        const next = new Set<string>(data.map((r: any) => r.job_id).filter(Boolean));
        setAcked(next);
        writeCache(engineerId, next);
      }
      setLoaded(true);
    })();

    // Realtime: pick up acks from other devices
    const channel = supabase
      .channel(`escalation-acks:${engineerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_events",
          filter: `engineer_id=eq.${engineerId}`,
        },
        (payload: any) => {
          const row = payload.new;
          if (row?.kind !== "escalation_ack" || !row?.job_id) return;
          setAcked((prev) => {
            if (prev.has(row.job_id)) return prev;
            const next = new Set(prev);
            next.add(row.job_id);
            if (engineerIdRef.current) writeCache(engineerIdRef.current, next);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [engineerId]);

  const markAcked = useCallback(
    (jobId: string) => {
      setAcked((prev) => {
        if (prev.has(jobId)) return prev;
        const next = new Set(prev);
        next.add(jobId);
        if (engineerIdRef.current) writeCache(engineerIdRef.current, next);
        return next;
      });
    },
    []
  );

  const isAcked = useCallback((jobId: string) => acked.has(jobId), [acked]);

  return { acked, isAcked, markAcked, loaded };
}
