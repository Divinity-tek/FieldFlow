// Lightweight, priority-based SLA computation for engineer-side jobs.
// Derived purely on the client from fields available on jobs_engineer_safe.

export type SlaState = "ok" | "due_soon" | "overdue" | "delayed" | "done";

export interface SlaJobInput {
  status: string;
  priority?: string | null;
  scheduled_at?: string | null;
  started_at?: string | null;
  completed_at?: string | null;
  is_delayed?: boolean | null;
}

export interface SlaInfo {
  state: SlaState;
  /** Deadline (ms epoch) by which the engineer is expected to be on-site / starting work. */
  deadlineMs: number | null;
  /** Minutes remaining (negative = overdue). null when no deadline. */
  minutesRemaining: number | null;
  /** Human label for badges. */
  label: string;
}

const DUE_SOON_MIN = 15;

/** Grace period (minutes) added to scheduled_at before flagging overdue. */
export function graceMinutes(priority?: string | null): number {
  switch ((priority || "").toLowerCase()) {
    case "urgent":
      return 5;
    case "high":
      return 15;
    case "medium":
    case "normal":
      return 30;
    case "low":
      return 60;
    default:
      return 30;
  }
}

export function computeSla(job: SlaJobInput, now: number = Date.now()): SlaInfo {
  // Done states — SLA no longer alertable
  if (job.status === "completed" || job.status === "cancelled") {
    return { state: "done", deadlineMs: null, minutesRemaining: null, label: "—" };
  }

  // Dispatch flagged the job as delayed — surface immediately
  if (job.is_delayed) {
    return { state: "delayed", deadlineMs: null, minutesRemaining: null, label: "Delayed" };
  }

  if (!job.scheduled_at) {
    return { state: "ok", deadlineMs: null, minutesRemaining: null, label: "No SLA" };
  }

  const scheduled = new Date(job.scheduled_at).getTime();
  if (Number.isNaN(scheduled)) {
    return { state: "ok", deadlineMs: null, minutesRemaining: null, label: "No SLA" };
  }

  const deadline = scheduled + graceMinutes(job.priority) * 60_000;
  const remainingMs = deadline - now;
  const remainingMin = Math.round(remainingMs / 60_000);

  // If the engineer already started, treat the SLA as met for "on-time start"
  if (job.started_at && new Date(job.started_at).getTime() <= deadline) {
    return { state: "ok", deadlineMs: deadline, minutesRemaining: remainingMin, label: "On time" };
  }

  if (remainingMs <= 0) {
    const overdueBy = Math.abs(remainingMin);
    return {
      state: "overdue",
      deadlineMs: deadline,
      minutesRemaining: remainingMin,
      label: `Overdue ${formatDuration(overdueBy)}`,
    };
  }

  if (remainingMin <= DUE_SOON_MIN) {
    return {
      state: "due_soon",
      deadlineMs: deadline,
      minutesRemaining: remainingMin,
      label: `Due in ${formatDuration(remainingMin)}`,
    };
  }

  return {
    state: "ok",
    deadlineMs: deadline,
    minutesRemaining: remainingMin,
    label: `Due in ${formatDuration(remainingMin)}`,
  };
}

function formatDuration(min: number): string {
  if (min < 60) return `${min}m`;
  const h = Math.floor(min / 60);
  const m = min % 60;
  return m === 0 ? `${h}h` : `${h}h ${m}m`;
}
