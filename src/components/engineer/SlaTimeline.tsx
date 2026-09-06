import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
  MessageSquare,
  ShieldCheck,
  UserPlus2,
  ChevronDown,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { computeSla, type SlaJobInput } from "@/lib/jobSla";

type EventKind =
  | "dispatch_notified"
  | "eta_updated"
  | "reassign_requested"
  | "escalation_ack";

interface JobEvent {
  id: string;
  kind: EventKind | string;
  occurred_at: string;
  meta: Record<string, unknown> | null;
}

interface Props {
  job: SlaJobInput & { id: string };
}

const RELEVANT: EventKind[] = [
  "dispatch_notified",
  "eta_updated",
  "reassign_requested",
  "escalation_ack",
];

const META: Record<
  EventKind,
  { label: string; icon: typeof Clock; tone: string }
> = {
  dispatch_notified: {
    label: "Notified dispatch",
    icon: MessageSquare,
    tone: "text-blue-500",
  },
  eta_updated: {
    label: "Updated ETA",
    icon: Clock,
    tone: "text-amber-500",
  },
  reassign_requested: {
    label: "Requested reassignment",
    icon: UserPlus2,
    tone: "text-purple-500",
  },
  escalation_ack: {
    label: "Acknowledged escalation",
    icon: ShieldCheck,
    tone: "text-emerald-500",
  },
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function detail(
  kind: EventKind | string,
  meta: Record<string, unknown> | null,
): React.ReactNode {
  if (!meta) return null;
  if (kind === "dispatch_notified") {
    const m = (meta.message as string) || "";
    const to = meta.delivered_to as number | undefined;
    const parts: string[] = [];
    if (m) parts.push(`"${m}"`);
    if (typeof to === "number" && to > 0) parts.push(`delivered to ${to}`);
    return parts.join(" · ") || null;
  }
  if (kind === "eta_updated") {
    const eta = meta.eta as string | undefined;
    return eta ? `New ETA: ${fmtTime(eta)}` : null;
  }
  if (kind === "reassign_requested") {
    const code = (meta.reason_code as string | undefined) || null;
    const label = (meta.reason_label as string | undefined) || null;
    const summary = (meta.reason as string | undefined) || "";
    // The reason summary the engineer submitted is "<label>: <notes>" when
    // they added a note, or just the label when they didn't. Strip the
    // duplicate label prefix so notes render cleanly on their own line.
    let notes = summary;
    if (label && summary.startsWith(`${label}: `)) {
      notes = summary.slice(label.length + 2);
    } else if (label && summary === label) {
      notes = "";
    }
    return (
      <div className="space-y-1.5 mt-1">
        <div className="flex items-center gap-1.5 flex-wrap">
          {code && (
            <span className="text-[10px] font-mono uppercase tracking-wide px-1.5 py-0.5 rounded bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/30">
              {code}
            </span>
          )}
          {label && (
            <span className="text-[11px] font-semibold text-foreground">{label}</span>
          )}
        </div>
        {notes && (
          <p className="text-[11px] text-muted-foreground italic break-words whitespace-pre-wrap">
            “{notes}”
          </p>
        )}
        {typeof meta.delivered_to === "number" && meta.delivered_to > 0 && (
          <p className="text-[10px] text-muted-foreground">
            Dispatch alerted: {meta.delivered_to as number}
          </p>
        )}
      </div>
    );
  }
  if (kind === "escalation_ack") {
    const flags: string[] = [];
    if (meta.notify) flags.push("notified");
    if (meta.eta_updated) flags.push("ETA");
    if (meta.reassign_requested) flags.push("reassign");
    return flags.length ? `Steps: ${flags.join(", ")}` : null;
  }
  return null;
}

export default function SlaTimeline({ job }: Props) {
  const [open, setOpen] = useState(false);
  const [events, setEvents] = useState<JobEvent[]>([]);
  const [loading, setLoading] = useState(false);

  const sla = useMemo(() => computeSla(job), [job]);
  // Synthetic "became overdue" marker derived from the SLA deadline.
  const overdueMarker = useMemo(() => {
    if (!sla.deadlineMs) return null;
    if (sla.state !== "overdue" && sla.state !== "delayed") return null;
    return new Date(sla.deadlineMs).toISOString();
  }, [sla.deadlineMs, sla.state]);

  // Lightweight check so the toggle also appears for jobs that were
  // previously escalated (e.g. acknowledged and back on track).
  const [hasHistory, setHasHistory] = useState(false);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("job_events")
        .select("id", { count: "exact", head: true })
        .eq("job_id", job.id)
        .in("kind", RELEVANT as unknown as string[]);
      if (!cancelled) setHasHistory((count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [job.id]);


  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("job_events")
        .select("id, kind, occurred_at, meta")
        .eq("job_id", job.id)
        .in("kind", RELEVANT as unknown as string[])
        .order("occurred_at", { ascending: true });
      if (cancelled) return;
      setEvents((data as JobEvent[]) ?? []);
      setLoading(false);
    })();

    // Live updates while the panel is open.
    const channel = supabase
      .channel(`sla-timeline:${job.id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "job_events",
          filter: `job_id=eq.${job.id}`,
        },
        (payload: any) => {
          const row = payload.new as JobEvent;
          if (!RELEVANT.includes(row.kind as EventKind)) return;
          setEvents((prev) =>
            prev.some((e) => e.id === row.id) ? prev : [...prev, row]
          );
        }
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, [open, job.id]);

  // Don't render the timeline at all when there's nothing SLA-related
  // (no overdue marker and the engineer hasn't logged any escalation events
  // yet — checked once on first open via a quick count below).
  // To avoid an extra round-trip, we keep the toggle visible only when
  // SLA has been triggered or there's an overdue marker.
  const showToggle = !!overdueMarker || sla.state === "delayed" || hasHistory;

  if (!showToggle && !open) return null;

  return (
    <div className="pt-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground transition-colors"
      >
        <History className="w-3.5 h-3.5" />
        SLA timeline
        <ChevronDown
          className={`w-3 h-3 transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="mt-2 rounded-md border border-border bg-muted/30 p-3">
          {loading && events.length === 0 && !overdueMarker ? (
            <p className="text-xs text-muted-foreground">Loading…</p>
          ) : (
            <ol className="relative space-y-3 pl-5 before:absolute before:left-1.5 before:top-1 before:bottom-1 before:w-px before:bg-border">
              {overdueMarker && (
                <TimelineRow
                  icon={AlertTriangle}
                  tone="text-destructive"
                  title="Became overdue"
                  time={overdueMarker}
                  detail="Engineer passed the SLA on-site deadline."
                />
              )}
              {events.length === 0 && !loading && (
                <li className="text-xs text-muted-foreground pl-1">
                  No escalation actions logged yet.
                </li>
              )}
              {events.map((e) => {
                const m = META[e.kind as EventKind];
                if (!m) return null;
                return (
                  <TimelineRow
                    key={e.id}
                    icon={m.icon}
                    tone={m.tone}
                    title={m.label}
                    time={e.occurred_at}
                    detail={detail(e.kind, e.meta)}
                  />
                );
              })}
              {sla.state === "ok" && events.some((e) => e.kind === "escalation_ack") && (
                <TimelineRow
                  icon={CheckCircle2}
                  tone="text-emerald-500"
                  title="Back on track"
                  time={new Date().toISOString()}
                  detail="SLA cleared after escalation."
                />
              )}
            </ol>
          )}
        </div>
      )}
    </div>
  );
}

function TimelineRow({
  icon: Icon,
  tone,
  title,
  time,
  detail,
}: {
  icon: typeof Clock;
  tone: string;
  title: string;
  time: string;
  detail?: React.ReactNode;
}) {
  return (
    <li className="relative">
      <span
        className={`absolute -left-[18px] top-0.5 w-3 h-3 rounded-full bg-background border-2 border-current ${tone} flex items-center justify-center`}
      />
      <div className="flex items-start gap-2">
        <Icon className={`w-3.5 h-3.5 mt-0.5 ${tone}`} />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground">{title}</p>
          <p className="text-[10px] text-muted-foreground">{fmtTime(time)}</p>
          {detail && (
            <div className="text-[11px] text-muted-foreground mt-0.5 break-words">{detail}</div>
          )}
        </div>
      </div>
    </li>
  );
}
