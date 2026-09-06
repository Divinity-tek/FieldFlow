import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { computeSla, type SlaJobInput } from "@/lib/jobSla";
import { fireBrowserNotification } from "@/lib/browserNotifications";
import { useUserPreference } from "@/hooks/useUserPreference";
import {
  DEFAULT_QUIET_HOURS,
  QUIET_HOURS_PREF_KEY,
  shouldDeliverAlert,
  type AlertSeverity,
  type QuietHoursPrefs,
} from "@/lib/quietHours";

export interface SlaTrackedJob extends SlaJobInput {
  id: string;
  title: string;
  reassign_count?: number | null;
}

type AlertKey =
  | `due_soon:${string}`
  | `overdue:${string}`
  | `delayed:${string}`
  | `cancelled:${string}`
  | `escalated:${string}`
  | `breach:${string}`;

/**
 * Watches an engineer's active jobs and surfaces alerts when:
 *  - SLA is approaching (≤15m) or breached
 *  - Dispatch flags the job as delayed
 *  - Dispatch cancels the job
 *  - The job is escalated/reassigned away
 *  - A formal sla_breach row is recorded for one of these jobs
 *
 * Pure frontend: polls jobs every 30s and listens to realtime updates that
 * the page already subscribes to via React Query invalidation.
 */
export function useEngineerSlaAlerts(jobs: SlaTrackedJob[], engineerId: string | null) {
  const firedRef = useRef<Set<AlertKey>>(new Set());
  const prevReassignRef = useRef<Map<string, number>>(new Map());
  const jobsRef = useRef<SlaTrackedJob[]>(jobs);
  jobsRef.current = jobs;

  // Quiet hours preference (persisted per user). Kept in a ref so the
  // long-lived 30s ticker and realtime subscriptions always read the
  // latest values without re-subscribing.
  const { value: quietHours } = useUserPreference<QuietHoursPrefs>(
    QUIET_HOURS_PREF_KEY,
    DEFAULT_QUIET_HOURS,
  );
  const quietRef = useRef<QuietHoursPrefs>(quietHours);
  quietRef.current = quietHours;

  /** Deliver a toast + browser notification, respecting quiet hours. */
  const deliver = (
    severity: AlertSeverity,
    toastFn: (title: string, opts: { description: string }) => void,
    title: string,
    body: string,
    key: string,
  ) => {
    if (!shouldDeliverAlert(severity, quietRef.current)) return;
    toastFn(title, { description: body });
    fireBrowserNotification({ title, body, tag: key, url: "/engineer/jobs" });
  };


  // Local SLA evaluation (due_soon / overdue) on a 30s tick
  useEffect(() => {
    const fired = firedRef.current;
    const evaluate = () => {
      for (const j of jobsRef.current) {
        if (j.status === "completed" || j.status === "cancelled") continue;
        const sla = computeSla(j);

        if (sla.state === "due_soon") {
          const key: AlertKey = `due_soon:${j.id}`;
          if (!fired.has(key)) {
            fired.add(key);
            deliver("warning", toast.warning, "SLA approaching", `${j.title} — ${sla.label.toLowerCase()}`, key);
          }
        }

        if (sla.state === "overdue") {
          const key: AlertKey = `overdue:${j.id}`;
          if (!fired.has(key)) {
            fired.add(key);
            deliver(
              "critical",
              toast.error,
              "🚨 SLA breached",
              `You're delayed on "${j.title}" — ${sla.label.toLowerCase()}`,
              key,
            );
          }
        }

        if (sla.state === "delayed") {
          const key: AlertKey = `delayed:${j.id}`;
          if (!fired.has(key)) {
            fired.add(key);
            deliver(
              "warning",
              toast.warning,
              "Job marked delayed",
              `Dispatch flagged "${j.title}" as delayed`,
              key,
            );
          }
        }
      }
    };
    evaluate();
    const id = setInterval(evaluate, 30_000);
    return () => clearInterval(id);
  }, []);

  // Track reassign_count to detect dispatch escalations/reassignments
  useEffect(() => {
    const prev = prevReassignRef.current;
    const fired = firedRef.current;
    for (const j of jobs) {
      const before = prev.get(j.id);
      const now = j.reassign_count ?? 0;
      if (before !== undefined && now > before) {
        const key: AlertKey = `escalated:${j.id}`;
        if (!fired.has(key)) {
          fired.add(key);
          deliver(
            "warning",
            toast.warning,
            "Job escalated by dispatch",
            `Dispatch escalated "${j.title}" (reassigned)`,
            key,
          );
        }
      }
      prev.set(j.id, now);
    }
  }, [jobs]);

  // Realtime: cancellations and is_delayed flips on jobs assigned to this engineer
  useEffect(() => {
    if (!engineerId) return;
    const fired = firedRef.current;
    const channel = supabase
      .channel(`eng-sla-jobs-${engineerId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "jobs",
          filter: `engineer_id=eq.${engineerId}`,
        },
        (payload) => {
          const oldRow = payload.old as any;
          const newRow = payload.new as any;
          if (!newRow) return;

          if (oldRow?.status !== newRow.status && newRow.status === "cancelled") {
            const key: AlertKey = `cancelled:${newRow.id}`;
            if (!fired.has(key)) {
              fired.add(key);
              deliver(
                "critical",
                toast.error,
                "Job cancelled by dispatch",
                `Dispatch cancelled "${newRow.title}"`,
                key,
              );
            }
          }

          if (!oldRow?.is_delayed && newRow.is_delayed) {
            const key: AlertKey = `delayed:${newRow.id}`;
            if (!fired.has(key)) {
              fired.add(key);
              const body = newRow.delayed_reason
                ? `"${newRow.title}" — ${newRow.delayed_reason}`
                : `Dispatch flagged "${newRow.title}" as delayed`;
              deliver("warning", toast.warning, "Job marked delayed", body, key);
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [engineerId]);

  // Realtime: formal SLA breach rows for this engineer's active jobs
  useEffect(() => {
    if (!engineerId) return;
    const fired = firedRef.current;
    const channel = supabase
      .channel(`eng-sla-breaches-${engineerId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "sla_breaches" },
        (payload) => {
          const row = payload.new as any;
          if (!row?.job_id) return;
          const job = jobsRef.current.find((j) => j.id === row.job_id);
          if (!job) return; // not one of mine
          const key: AlertKey = `breach:${row.id}`;
          if (fired.has(key)) return;
          fired.add(key);
          deliver(
            "critical",
            toast.error,
            "🚨 SLA breach recorded",
            `${job.title} — ${row.breach_type || "SLA"} breach (target ${row.target_minutes}m)`,
            key,
          );
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [engineerId]);
}
