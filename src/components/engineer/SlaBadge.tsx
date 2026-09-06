import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ShieldCheck, Zap } from "lucide-react";
import { computeSla, type SlaJobInput } from "@/lib/jobSla";

interface Props {
  job: SlaJobInput;
  className?: string;
}

const STYLES: Record<string, string> = {
  ok: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  due_soon: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  overdue: "bg-destructive/10 text-destructive",
  delayed: "bg-destructive/10 text-destructive",
  done: "bg-muted text-muted-foreground",
};

const ICONS = {
  ok: ShieldCheck,
  due_soon: Clock,
  overdue: AlertTriangle,
  delayed: Zap,
  done: Clock,
} as const;

/** Live-updating SLA badge. Re-renders every 30s to keep the countdown fresh. */
export default function SlaBadge({ job, className = "" }: Props) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const sla = computeSla(job);
  if (sla.state === "done") return null;
  const Icon = ICONS[sla.state];

  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold whitespace-nowrap ${STYLES[sla.state]} ${className}`}
      aria-label={`SLA: ${sla.label}`}
    >
      <Icon className="w-3 h-3" />
      {sla.label}
    </span>
  );
}
