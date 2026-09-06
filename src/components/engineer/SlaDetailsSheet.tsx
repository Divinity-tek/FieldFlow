import { useEffect, useState } from "react";
import { AlertTriangle, CalendarClock, Clock, Flag, Hourglass, Info, ShieldCheck, Timer, Zap } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import SlaBadge from "@/components/engineer/SlaBadge";
import { computeSla, graceMinutes, type SlaJobInput } from "@/lib/jobSla";

interface SlaDetailsSheetProps {
  job: SlaJobInput & { title?: string; delayed_reason?: string | null };
}

const STATE_META: Record<string, { label: string; tone: string; icon: typeof Clock }> = {
  ok: { label: "On track", tone: "text-emerald-600 dark:text-emerald-400", icon: ShieldCheck },
  due_soon: { label: "Due soon", tone: "text-amber-600 dark:text-amber-400", icon: Clock },
  overdue: { label: "Overdue", tone: "text-destructive", icon: AlertTriangle },
  delayed: { label: "Delayed by dispatch", tone: "text-destructive", icon: Zap },
  done: { label: "Closed", tone: "text-muted-foreground", icon: Clock },
};

function formatDateTime(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function reasonText(
  state: string,
  job: SlaDetailsSheetProps["job"],
  grace: number,
  minutesRemaining: number | null,
): string {
  if (state === "delayed") {
    return job.delayed_reason
      ? `Dispatch flagged this job as delayed: "${job.delayed_reason}".`
      : "Dispatch has flagged this job as delayed. Coordinate with dispatch for next steps.";
  }
  if (state === "overdue" && minutesRemaining !== null) {
    const over = Math.abs(minutesRemaining);
    return `You passed the on-site deadline ${over}m ago. The deadline equals the scheduled time plus a ${grace}m grace window for ${job.priority || "normal"} priority.`;
  }
  if (state === "due_soon" && minutesRemaining !== null) {
    return `Less than 15m remain before the on-site deadline (scheduled time + ${grace}m grace for ${job.priority || "normal"} priority).`;
  }
  if (state === "ok") {
    if (job.started_at) return "You started work on time. SLA met for on-time start.";
    if (minutesRemaining !== null) return `On track — ${minutesRemaining}m of headroom before the deadline.`;
    return "No scheduled time set, so no SLA deadline applies.";
  }
  return "This job is closed; SLA tracking no longer applies.";
}

export default function SlaDetailsSheet({ job }: SlaDetailsSheetProps) {
  const [open, setOpen] = useState(false);
  const [, setTick] = useState(0);

  useEffect(() => {
    if (!open) return;
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, [open]);

  const sla = computeSla(job);
  if (sla.state === "done") return null;

  const grace = graceMinutes(job.priority);
  const meta = STATE_META[sla.state];
  const Icon = meta.icon;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label="View SLA details"
          className="rounded-full focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1"
        >
          <SlaBadge job={job} />
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="rounded-t-2xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left">
          <SheetTitle className="flex items-center gap-2">
            <Icon className={`w-5 h-5 ${meta.tone}`} />
            <span>SLA · {meta.label}</span>
          </SheetTitle>
          {job.title && <SheetDescription className="truncate">{job.title}</SheetDescription>}
        </SheetHeader>

        <div className="mt-4 space-y-3">
          <Row
            icon={CalendarClock}
            label="Scheduled time"
            value={formatDateTime(job.scheduled_at)}
          />
          <Row
            icon={Hourglass}
            label="Grace window"
            value={`${grace} min (${(job.priority || "normal").toLowerCase()} priority)`}
          />
          <Row
            icon={Timer}
            label="On-site deadline"
            value={sla.deadlineMs ? formatDateTime(new Date(sla.deadlineMs).toISOString()) : "—"}
          />
          <Row
            icon={Flag}
            label="Status"
            value={sla.label}
            valueClassName={meta.tone}
          />
          <Row
            icon={Clock}
            label="Started at"
            value={formatDateTime(job.started_at)}
          />

          <div className="rounded-lg border bg-muted/40 p-3 flex gap-2">
            <Info className="w-4 h-4 mt-0.5 shrink-0 text-muted-foreground" />
            <p className="text-xs text-muted-foreground leading-relaxed">
              {reasonText(sla.state, job, grace, sla.minutesRemaining)}
            </p>
          </div>

          <p className="text-[10px] text-muted-foreground/80 px-1">
            Grace windows: urgent 5m · high 15m · medium 30m · low 60m. Deadline = scheduled time + grace.
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  icon: Icon,
  label,
  value,
  valueClassName = "",
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  valueClassName?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="w-4 h-4" />
        {label}
      </span>
      <span className={`font-medium text-foreground text-right ${valueClassName}`}>{value}</span>
    </div>
  );
}
