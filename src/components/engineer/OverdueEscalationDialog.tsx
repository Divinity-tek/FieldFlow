import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Clock, MessageSquare, UserPlus2 } from "lucide-react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const REASSIGN_REASONS: { code: string; label: string }[] = [
  { code: "vehicle_issue", label: "Vehicle / transport issue" },
  { code: "traffic", label: "Stuck in traffic / accident" },
  { code: "previous_overrun", label: "Previous job overrunning" },
  { code: "skills_mismatch", label: "Skills / parts mismatch" },
  { code: "site_access", label: "Cannot access site" },
  { code: "personal_emergency", label: "Personal emergency" },
  { code: "other", label: "Other (add a note)" },
];
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

// ETA must be a real datetime, at least ~1 minute in the future and within
// the next 24 hours (anything further is almost certainly a typo).
const MAX_ETA_HOURS = 24;
const etaSchema = z
  .string()
  .min(1, "Pick a new on-site time")
  .refine((v) => !Number.isNaN(new Date(v).getTime()), "Invalid date / time")
  .refine((v) => new Date(v).getTime() > Date.now() + 60_000, "ETA must be in the future")
  .refine(
    (v) => new Date(v).getTime() <= Date.now() + MAX_ETA_HOURS * 3600_000,
    `ETA must be within ${MAX_ETA_HOURS} hours`,
  );


// Acknowledgement persistence is handled centrally by the
// `useEscalationAcks` hook (source of truth: `job_events` table).

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string;
  jobTitle: string;
  engineerId: string;
  scheduledAt?: string | null;
  onAcknowledged?: () => void;
}

type StepKey = "notify" | "eta" | "reassign";

const DEFAULT_NOTIFY = "Running late — see notes for details.";

function defaultEtaIso(scheduledAt?: string | null): string {
  // Suggest 30 min from now as the new ETA, formatted for <input type="datetime-local">
  const base = new Date();
  base.setMinutes(base.getMinutes() + 30);
  base.setSeconds(0, 0);
  // datetime-local needs YYYY-MM-DDTHH:mm in local time
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${base.getFullYear()}-${pad(base.getMonth() + 1)}-${pad(base.getDate())}T${pad(base.getHours())}:${pad(base.getMinutes())}`;
}

export default function OverdueEscalationDialog({
  open,
  onOpenChange,
  jobId,
  jobTitle,
  engineerId,
  scheduledAt,
  onAcknowledged,
}: Props) {
  const [done, setDone] = useState<Record<StepKey, boolean>>({
    notify: false,
    eta: false,
    reassign: false,
  });
  const [notifyMsg, setNotifyMsg] = useState(DEFAULT_NOTIFY);
  const [etaLocal, setEtaLocal] = useState(() => defaultEtaIso(scheduledAt));
  const [reassignReason, setReassignReason] = useState("");
  const [reassignCode, setReassignCode] = useState<string>("");
  const [busy, setBusy] = useState<StepKey | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmReassignOpen, setConfirmReassignOpen] = useState(false);

  // Reset when dialog reopens for a different job
  useEffect(() => {
    if (open) {
      setDone({ notify: false, eta: false, reassign: false });
      setNotifyMsg(DEFAULT_NOTIFY);
      setEtaLocal(defaultEtaIso(scheduledAt));
      setReassignReason("");
      setReassignCode("");
    }
  }, [open, jobId, scheduledAt]);

  // Re-validate ETA every 30s so "in the future" stays accurate while open.
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    const t = setInterval(() => setTick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, [open]);

  // Live validation result for the ETA input.
  const etaValidation = useMemo(() => {
    const r = etaSchema.safeParse(etaLocal);
    if (r.success) {
      const mins = Math.max(
        0,
        Math.round((new Date(r.data).getTime() - Date.now()) / 60_000),
      );
      return { ok: true as const, error: null, minutesFromNow: mins };
    }
    return {
      ok: false as const,
      error: r.error.issues[0]?.message ?? "Invalid ETA",
      minutesFromNow: 0,
    };
  }, [etaLocal]);

  // datetime-local min/max bounds (refreshed by the tick above).
  const etaBounds = useMemo(() => {
    const pad = (n: number) => String(n).padStart(2, "0");
    const fmt = (d: Date) =>
      `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { min: fmt(new Date()), max: fmt(new Date(Date.now() + MAX_ETA_HOURS * 3600_000)) };
  }, [open]);


  const logEvent = async (kind: string, meta: Record<string, unknown>) => {
    const { error } = await supabase.from("job_events").insert([
      { job_id: jobId, engineer_id: engineerId, kind, meta: meta as any },
    ]);
    if (error) throw error;
  };

  const runNotify = async () => {
    if (!notifyMsg.trim()) {
      toast.error("Add a short message for dispatch");
      return;
    }
    setBusy("notify");
    try {
      // If the engineer already filled in an ETA above, include it so dispatch
      // gets the full picture in a single notification.
      const etaMs = new Date(etaLocal).getTime();
      const etaIso =
        etaLocal && !Number.isNaN(etaMs) && etaMs > Date.now() - 60_000
          ? new Date(etaMs).toISOString()
          : null;

      const { data, error } = await supabase.functions.invoke("notify-dispatch", {
        body: {
          job_id: jobId,
          message: notifyMsg.trim().slice(0, 500),
          eta: etaIso,
        },
      });
      if (error) throw error;
      const delivered = (data as any)?.delivered_to ?? 0;
      setDone((d) => ({ ...d, notify: true }));
      toast.success(
        delivered > 0
          ? `Dispatch notified (${delivered} ${delivered === 1 ? "person" : "people"})`
          : "Dispatch notified",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to notify dispatch");
    } finally {
      setBusy(null);
    }
  };

  const runEta = async () => {
    const parsed = etaSchema.safeParse(etaLocal);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Pick a valid ETA");
      return;
    }
    const ms = new Date(parsed.data).getTime();
    setBusy("eta");
    try {
      await logEvent("eta_updated", { eta: new Date(ms).toISOString() });
      // Also flag the job as delayed with the new ETA so dispatch sees it live
      await supabase
        .from("jobs")
        .update({
          is_delayed: true,
          delayed_at: new Date().toISOString(),
          delayed_reason: `Engineer ETA: ${new Date(ms).toLocaleString()}`,
        })
        .eq("id", jobId);
      setDone((d) => ({ ...d, eta: true }));
      toast.success("ETA shared with dispatch");
    } catch (e: any) {
      toast.error(e.message || "Failed to update ETA");
    } finally {
      setBusy(null);
    }
  };

  const runReassign = async () => {
    if (!reassignCode) {
      toast.error("Pick a reassignment reason");
      return;
    }
    const reasonMeta = REASSIGN_REASONS.find((r) => r.code === reassignCode);
    const notes = reassignReason.trim().slice(0, 500);
    if (reassignCode === "other" && !notes) {
      toast.error("Add a short note explaining the reason");
      return;
    }
    setBusy("reassign");
    try {
      // Build a single human-readable summary used both as event reason and
      // as the dispatch notification body.
      const summary = notes
        ? `${reasonMeta?.label}: ${notes}`
        : (reasonMeta?.label ?? "Engineer unable to complete on time");

      // notify-dispatch fans out a notification to dispatchers AND inserts the
      // `reassign_requested` job event using the service role.
      const { data, error } = await supabase.functions.invoke("notify-dispatch", {
        body: {
          job_id: jobId,
          message: summary,
          kind: "reassign_requested",
          reason_code: reassignCode,
          reason_label: reasonMeta?.label ?? null,
        },
      });
      if (error) throw error;
      const delivered = (data as any)?.delivered_to ?? 0;
      setDone((d) => ({ ...d, reassign: true }));
      toast.success(
        delivered > 0
          ? `Reassignment requested (dispatch alerted: ${delivered})`
          : "Reassignment requested",
      );
    } catch (e: any) {
      toast.error(e.message || "Failed to request reassignment");
    } finally {
      setBusy(null);
    }
  };

  const requiredDone = done.notify && done.eta;

  const finish = async () => {
    if (!requiredDone) return;
    setSubmitting(true);
    try {
      await logEvent("escalation_ack", {
        notify: done.notify,
        eta_updated: done.eta,
        reassign_requested: done.reassign,
      });
      // Persistence is handled by `useEscalationAcks` (DB-backed).
      toast.success("Escalation logged — you can continue");
      onAcknowledged?.();
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e.message || "Failed to log escalation");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && onOpenChange(v)}>
      <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            SLA overdue — escalate before continuing
          </DialogTitle>
          <DialogDescription className="truncate">{jobTitle}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 mt-2">
          <Step
            n={1}
            icon={MessageSquare}
            title="Notify dispatch"
            done={done.notify}
            required
          >
            <Textarea
              value={notifyMsg}
              onChange={(e) => setNotifyMsg(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="Tell dispatch what's happening"
              disabled={done.notify}
            />
            <Button
              size="sm"
              onClick={runNotify}
              disabled={done.notify || busy === "notify"}
              className="w-full"
            >
              {done.notify ? "Notified" : busy === "notify" ? "Sending..." : "Send to dispatch"}
            </Button>
          </Step>

          <Step n={2} icon={Clock} title="Update ETA" done={done.eta} required>
            <div className="space-y-1.5">
              <Label htmlFor="esc-eta" className="text-xs text-muted-foreground">
                New on-site time
              </Label>
              <Input
                id="esc-eta"
                type="datetime-local"
                value={etaLocal}
                onChange={(e) => setEtaLocal(e.target.value)}
                min={etaBounds.min}
                max={etaBounds.max}
                disabled={done.eta}
                aria-invalid={!done.eta && !etaValidation.ok}
                aria-describedby="esc-eta-hint"
                className={
                  !done.eta && !etaValidation.ok
                    ? "border-destructive focus-visible:ring-destructive"
                    : undefined
                }
              />
              <p
                id="esc-eta-hint"
                className={`text-[11px] ${
                  done.eta
                    ? "text-muted-foreground"
                    : etaValidation.ok
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-destructive"
                }`}
              >
                {done.eta
                  ? "ETA shared with dispatch."
                  : etaValidation.ok
                    ? `In ${etaValidation.minutesFromNow} min — must be within ${MAX_ETA_HOURS}h.`
                    : etaValidation.error}
              </p>
            </div>
            <Button
              size="sm"
              onClick={runEta}
              disabled={done.eta || busy === "eta" || !etaValidation.ok}
              className="w-full"
            >
              {done.eta ? "ETA shared" : busy === "eta" ? "Updating..." : "Share ETA"}
            </Button>
          </Step>

          <Step n={3} icon={UserPlus2} title="Request reassignment" done={done.reassign}>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Reason</Label>
              <Select
                value={reassignCode}
                onValueChange={setReassignCode}
                disabled={done.reassign}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Pick a reason" />
                </SelectTrigger>
                <SelectContent>
                  {REASSIGN_REASONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Textarea
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder={
                reassignCode === "other"
                  ? "Required — explain the reason"
                  : "Optional — add context for dispatch"
              }
              disabled={done.reassign}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (!reassignCode) {
                  toast.error("Pick a reassignment reason");
                  return;
                }
                if (reassignCode === "other" && !reassignReason.trim()) {
                  toast.error("Add a short note explaining the reason");
                  return;
                }
                setConfirmReassignOpen(true);
              }}
              disabled={
                done.reassign ||
                busy === "reassign" ||
                !reassignCode ||
                (reassignCode === "other" && !reassignReason.trim())
              }
              className="w-full"
            >
              {done.reassign
                ? "Reassignment requested"
                : busy === "reassign"
                  ? "Requesting..."
                  : "Request reassignment"}
            </Button>
          </Step>
        </div>

        <DialogFooter className="mt-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={submitting}>
            Close
          </Button>
          <Button onClick={finish} disabled={!requiredDone || submitting}>
            {submitting ? "Saving..." : "Acknowledge & continue"}
          </Button>
        </DialogFooter>
      </DialogContent>

      <AlertDialog
        open={confirmReassignOpen}
        onOpenChange={(v) => {
          if (busy === "reassign") return;
          setConfirmReassignOpen(v);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus2 className="w-4 h-4 text-primary" />
              Confirm reassignment request
            </AlertDialogTitle>
            <AlertDialogDescription>
              Dispatch will be alerted immediately. Please review before sending.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2 text-sm">
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Reason</p>
              <p className="font-medium text-foreground">
                {REASSIGN_REASONS.find((r) => r.code === reassignCode)?.label ?? "—"}
              </p>
              {reassignCode && (
                <p className="text-[11px] font-mono text-muted-foreground mt-0.5">
                  {reassignCode}
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Note</p>
              <p className="text-foreground whitespace-pre-wrap break-words">
                {reassignReason.trim() || (
                  <span className="italic text-muted-foreground">No note added</span>
                )}
              </p>
            </div>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy === "reassign"}>
              Back to edit
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={busy === "reassign"}
              onClick={async (e) => {
                e.preventDefault();
                await runReassign();
                setConfirmReassignOpen(false);
              }}
            >
              {busy === "reassign" ? "Sending..." : "Confirm & send"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}

function Step({
  n,
  icon: Icon,
  title,
  done,
  required,
  children,
}: {
  n: number;
  icon: typeof Clock;
  title: string;
  done: boolean;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-lg border p-3 space-y-2 transition ${
        done ? "border-emerald-500/40 bg-emerald-500/5" : "border-border"
      }`}
    >
      <div className="flex items-center gap-2">
        <span
          className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
            done
              ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {done ? <CheckCircle2 className="w-3.5 h-3.5" /> : n}
        </span>
        <Icon className="w-4 h-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground flex-1">{title}</p>
        {required && !done && (
          <span className="text-[10px] text-destructive font-semibold uppercase">Required</span>
        )}
      </div>
      {children}
    </div>
  );
}
