import { useMemo, useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Inbox,
  Search,
  UserPlus2,
  Briefcase,
  MapPin,
  Clock,
  Filter,
  X,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { suggestEngineers, type SuggestEngineer } from "@/lib/engineerSuggest";

interface ReassignEvent {
  id: string;
  job_id: string;
  engineer_id: string;
  occurred_at: string;
  meta: {
    reason?: string;
    reason_code?: string;
    reason_label?: string;
    delivered_to?: number;
  } | null;
}

const REASSIGN_REASONS: { code: string; label: string }[] = [
  { code: "vehicle_issue", label: "Vehicle / transport issue" },
  { code: "traffic", label: "Stuck in traffic / accident" },
  { code: "previous_overrun", label: "Previous job overrunning" },
  { code: "skills_mismatch", label: "Skills / parts mismatch" },
  { code: "site_access", label: "Cannot access site" },
  { code: "personal_emergency", label: "Personal emergency" },
  { code: "other", label: "Other" },
];

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default function DispatchInbox() {
  const [reasonFilter, setReasonFilter] = useState<string>("all");
  const [jobIdFilter, setJobIdFilter] = useState<string>("");
  const [overrideEvent, setOverrideEvent] = useState<ReassignEvent | null>(null);

  const { data: events = [], isLoading, refetch } = useQuery({
    queryKey: ["dispatch-reassign-inbox"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("job_events")
        .select("id, job_id, engineer_id, occurred_at, meta")
        .eq("kind", "reassign_requested")
        .order("occurred_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data ?? []) as ReassignEvent[];
    },
  });

  // Live updates
  useEffect(() => {
    const channel = supabase
      .channel("dispatch-reassign-inbox")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "job_events" },
        (payload: any) => {
          if (payload.new?.kind === "reassign_requested") refetch();
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refetch]);

  const jobIds = useMemo(
    () => Array.from(new Set(events.map((e) => e.job_id))),
    [events]
  );
  const engineerIds = useMemo(
    () => Array.from(new Set(events.map((e) => e.engineer_id).filter(Boolean))),
    [events]
  );

  const { data: jobsMap = new Map() } = useQuery({
    queryKey: ["dispatch-reassign-jobs", jobIds],
    enabled: jobIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select(
          "id, title, location, priority, status, scheduled_at, client_id, region_id, latitude, longitude, required_skills, engineer_id, previous_engineer_ids",
        )
        .in("id", jobIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((j: any) => m.set(j.id, j));
      return m;
    },
  });

  const { data: engineersMap = new Map() } = useQuery({
    queryKey: ["dispatch-reassign-engineers", engineerIds],
    enabled: engineerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id, name")
        .in("id", engineerIds);
      const m = new Map<string, any>();
      (data ?? []).forEach((e: any) => m.set(e.id, e));
      return m;
    },
  });

  // Pool of candidate engineers used for the auto-suggestion. Kept lean
  // (available only) so we don't pull the entire roster.
  const { data: candidatePool = [] } = useQuery<SuggestEngineer[]>({
    queryKey: ["dispatch-reassign-candidate-pool"],
    queryFn: async () => {
      const { data: engs } = await supabase
        .from("engineers")
        .select(
          "id, user_id, skills, region_id, is_available, rating, jobs_completed, latitude, longitude",
        )
        .eq("is_available", true)
        .limit(500);
      const list = engs ?? [];
      const userIds = list.map((e: any) => e.user_id).filter(Boolean);
      let nameByUser: Record<string, string> = {};
      if (userIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, full_name")
          .in("user_id", userIds);
        nameByUser = Object.fromEntries(
          (profs ?? []).map((p: any) => [p.user_id, p.full_name]),
        );
      }
      return list.map((e: any) => ({
        id: e.id,
        name: nameByUser[e.user_id] ?? null,
        skills: e.skills ?? null,
        region_id: e.region_id ?? null,
        is_available: e.is_available ?? null,
        rating: e.rating ?? null,
        jobs_completed: e.jobs_completed ?? null,
        latitude: e.latitude ?? null,
        longitude: e.longitude ?? null,
      }));
    },
  });

  const filtered = useMemo(() => {
    const idQuery = jobIdFilter.trim().toLowerCase();
    return events.filter((e) => {
      if (reasonFilter !== "all" && (e.meta?.reason_code ?? "") !== reasonFilter) {
        return false;
      }
      if (idQuery && !e.job_id.toLowerCase().includes(idQuery)) {
        return false;
      }
      return true;
    });
  }, [events, reasonFilter, jobIdFilter]);

  const reasonCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const e of events) {
      const code = e.meta?.reason_code ?? "unknown";
      counts.set(code, (counts.get(code) ?? 0) + 1);
    }
    return counts;
  }, [events]);

  const clearFilters = () => {
    setReasonFilter("all");
    setJobIdFilter("");
  };
  const hasFilters = reasonFilter !== "all" || jobIdFilter.length > 0;

  return (
    <AppLayout title="Dispatch Inbox" subtitle="Reassignment requests from the field">
      <div className="space-y-4 md:space-y-6 p-4 md:p-6">
        <header className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <Inbox className="w-6 h-6 text-primary" />
              Dispatch Inbox
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Reassignment requests from engineers in the field.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </header>

        {/* Filters */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Filter className="w-4 h-4" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="reason-filter" className="text-xs">
                Reason
              </Label>
              <Select value={reasonFilter} onValueChange={setReasonFilter}>
                <SelectTrigger id="reason-filter">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All reasons ({events.length})</SelectItem>
                  {REASSIGN_REASONS.map((r) => (
                    <SelectItem key={r.code} value={r.code}>
                      {r.label} ({reasonCounts.get(r.code) ?? 0})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 md:col-span-2">
              <Label htmlFor="job-id-filter" className="text-xs">
                Job ID
              </Label>
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                <Input
                  id="job-id-filter"
                  value={jobIdFilter}
                  onChange={(e) => setJobIdFilter(e.target.value)}
                  placeholder="Search by job ID (full or partial)"
                  className="pl-9"
                />
              </div>
            </div>
            {hasFilters && (
              <div className="md:col-span-3 flex justify-end">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <X className="w-3.5 h-3.5 mr-1" />
                  Clear filters
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        <div>
          <p className="text-xs text-muted-foreground mb-2">
            {isLoading
              ? "Loading…"
              : `${filtered.length} of ${events.length} request${events.length === 1 ? "" : "s"}`}
          </p>
          {!isLoading && filtered.length === 0 && (
            <Card>
              <CardContent className="p-8 text-center text-sm text-muted-foreground">
                {events.length === 0
                  ? "No reassignment requests yet."
                  : "No requests match the current filters."}
              </CardContent>
            </Card>
          )}
          <div className="space-y-3">
            {filtered.map((e) => {
              const job = jobsMap.get(e.job_id);
              const eng = engineersMap.get(e.engineer_id);
              const reasonLabel =
                e.meta?.reason_label ??
                REASSIGN_REASONS.find((r) => r.code === e.meta?.reason_code)?.label ??
                "Unspecified";
              const note = e.meta?.reason ?? "";
              return (
                <Card key={e.id} className="border-l-4 border-l-purple-500/60">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Badge variant="secondary" className="bg-purple-500/10 text-purple-600 dark:text-purple-400">
                            <UserPlus2 className="w-3 h-3 mr-1" />
                            Reassignment
                          </Badge>
                          <Badge variant="outline">{reasonLabel}</Badge>
                        </div>
                        <p className="text-sm font-semibold text-foreground mt-2">
                          {job?.title ?? "Unknown job"}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                          ID: {e.job_id}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                          <Clock className="w-3 h-3" />
                          {fmtTime(e.occurred_at)}
                        </p>
                        {typeof e.meta?.delivered_to === "number" && (
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            Alerted {e.meta.delivered_to}{" "}
                            {e.meta.delivered_to === 1 ? "person" : "people"}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs text-muted-foreground">
                      {job?.location && (
                        <p className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 shrink-0" />
                          <span className="truncate">{job.location}</span>
                        </p>
                      )}
                      <p className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0" />
                        Engineer:{" "}
                        <span className="text-foreground font-medium">
                          {eng?.name ?? "Unknown"}
                        </span>
                      </p>
                      {job?.priority && (
                        <p>
                          Priority:{" "}
                          <span className="text-foreground font-medium capitalize">
                            {job.priority}
                          </span>
                        </p>
                      )}
                      {job?.status && (
                        <p>
                          Status:{" "}
                          <span className="text-foreground font-medium capitalize">
                            {String(job.status).replace(/_/g, " ")}
                          </span>
                        </p>
                      )}
                    </div>

                    {note && (
                      <div className="rounded-md bg-muted/40 border border-border p-2.5">
                        <p className="text-[11px] uppercase font-semibold text-muted-foreground mb-1">
                          Engineer note
                        </p>
                        <p className="text-xs text-foreground whitespace-pre-wrap break-words">
                          {note}
                        </p>
                      </div>
                    )}

                    <SuggestedReassignment
                      job={job}
                      reasonCode={e.meta?.reason_code ?? null}
                      candidatePool={candidatePool}
                      sourceEventId={e.id}
                      onDone={() => refetch()}
                    />

                    <div className="flex justify-end gap-2 pt-1 flex-wrap">
                      <Button asChild variant="outline" size="sm">
                        <Link to={`/jobs/${e.job_id}`}>Open job</Link>
                      </Button>
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => setOverrideEvent(e)}
                      >
                        <ShieldCheck className="w-3.5 h-3.5 mr-1" />
                        Override
                      </Button>
                      <Button asChild variant="default" size="sm">
                        <Link to={`/dispatch?jobId=${e.job_id}`}>Reassign</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </div>

      <OverrideDialog
        event={overrideEvent}
        jobTitle={overrideEvent ? jobsMap.get(overrideEvent.job_id)?.title ?? null : null}
        engineerName={
          overrideEvent ? engineersMap.get(overrideEvent.engineer_id)?.name ?? null : null
        }
        onClose={() => setOverrideEvent(null)}
        onDone={() => {
          setOverrideEvent(null);
          refetch();
        }}
      />
    </AppLayout>
  );
}

function OverrideDialog({
  event,
  jobTitle,
  engineerName,
  onClose,
  onDone,
}: {
  event: ReassignEvent | null;
  jobTitle: string | null;
  engineerName: string | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const open = !!event;
  const [reasonCode, setReasonCode] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (event) {
      setReasonCode(event.meta?.reason_code ?? "");
      setNotes("");
    }
  }, [event]);

  const reasonLabel =
    REASSIGN_REASONS.find((r) => r.code === reasonCode)?.label ?? "";
  const originalReason =
    event?.meta?.reason_label ??
    REASSIGN_REASONS.find((r) => r.code === event?.meta?.reason_code)?.label ??
    "Unspecified";

  const submit = async () => {
    if (!event) return;
    if (!reasonCode || !reasonLabel) {
      toast.error("Pick a reason for the override");
      return;
    }
    if (reasonCode === "other" && !notes.trim()) {
      toast.error("Add a note explaining the override");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "override-reassignment",
        {
          body: {
            job_id: event.job_id,
            source_event_id: event.id,
            reason_code: reasonCode,
            reason_label: reasonLabel,
            override_notes: notes.trim() || null,
          },
        },
      );
      if (error) throw error;
      const delivered = (data as any)?.delivered_to ?? 0;
      toast.success(
        delivered > 0
          ? `Override saved — ${delivered} dispatcher${delivered === 1 ? "" : "s"} notified`
          : "Override saved",
      );
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to apply override");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !submitting && !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary" />
            Override reassignment reason
          </DialogTitle>
          <DialogDescription className="truncate">
            {jobTitle ?? "Job"}{engineerName ? ` — ${engineerName}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-md border border-border bg-muted/40 p-2.5 text-xs">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              Original reason
            </p>
            <p className="text-foreground font-medium">{originalReason}</p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="override-reason" className="text-xs">
              Updated reason
            </Label>
            <Select value={reasonCode} onValueChange={setReasonCode}>
              <SelectTrigger id="override-reason">
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

          <div className="space-y-1.5">
            <Label htmlFor="override-notes" className="text-xs">
              Override notes {reasonCode === "other" && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id="override-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              maxLength={500}
              rows={3}
              placeholder="Why are you reclassifying this request?"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={submitting || !reasonCode}>
            {submitting ? "Saving..." : "Save & notify dispatch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SuggestedReassignment({
  job,
  reasonCode,
  candidatePool,
  sourceEventId,
  onDone,
}: {
  job: any;
  reasonCode: string | null;
  candidatePool: SuggestEngineer[];
  sourceEventId: string;
  onDone: () => void;
}) {
  const [busy, setBusy] = useState(false);

  const suggestions = useMemo(() => {
    if (!job) return [];
    return suggestEngineers(
      {
        id: job.id,
        required_skills: job.required_skills ?? null,
        region_id: job.region_id ?? null,
        latitude: job.latitude ?? null,
        longitude: job.longitude ?? null,
        engineer_id: job.engineer_id ?? null,
        previous_engineer_ids: job.previous_engineer_ids ?? null,
      },
      candidatePool,
      reasonCode,
      3,
    );
  }, [job, reasonCode, candidatePool]);

  if (!job || suggestions.length === 0) return null;

  const top = suggestions[0];
  const reasonLabel =
    REASSIGN_REASONS.find((r) => r.code === reasonCode)?.label ?? "Unspecified";

  const reassignTo = async (engineerId: string, engineerName: string | null) => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        "override-reassignment",
        {
          body: {
            job_id: job.id,
            source_event_id: sourceEventId,
            reason_code: reasonCode || "other",
            reason_label: reasonLabel,
            override_notes: `Auto-suggested reassignment to ${engineerName ?? "engineer"}.`,
            new_engineer_id: engineerId,
          },
        },
      );
      if (error) throw error;
      const delivered = (data as any)?.delivered_to ?? 0;
      toast.success(
        `Reassigned to ${engineerName ?? "engineer"}${delivered ? ` — ${delivered} notified` : ""}`,
      );
      onDone();
    } catch (e: any) {
      toast.error(e.message || "Failed to reassign");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-md border border-primary/30 bg-primary/5 p-3 space-y-2">
      <div className="flex items-center gap-2 text-xs font-semibold text-foreground">
        <Sparkles className="w-3.5 h-3.5 text-primary" />
        Suggested next engineer
      </div>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground truncate">
            {top.engineer.name ?? "Engineer"}
          </p>
          {top.reasons.length > 0 && (
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {top.reasons.join(" · ")}
            </p>
          )}
        </div>
        <Button
          size="sm"
          disabled={busy}
          onClick={() => reassignTo(top.engineer.id, top.engineer.name)}
        >
          {busy ? (
            <>
              <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
              Reassigning...
            </>
          ) : (
            <>
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Reassign to {top.engineer.name?.split(" ")[0] ?? "engineer"}
            </>
          )}
        </Button>
      </div>

      {suggestions.length > 1 && (
        <div className="pt-2 border-t border-primary/15 space-y-1.5">
          <p className="text-[10px] uppercase tracking-wide text-muted-foreground">
            Alternatives
          </p>
          {suggestions.slice(1).map((s) => (
            <div
              key={s.engineer.id}
              className="flex items-center justify-between gap-2"
            >
              <div className="min-w-0">
                <p className="text-xs text-foreground truncate">
                  {s.engineer.name ?? "Engineer"}
                </p>
                {s.reasons.length > 0 && (
                  <p className="text-[10px] text-muted-foreground truncate">
                    {s.reasons.join(" · ")}
                  </p>
                )}
              </div>
              <Button
                size="sm"
                variant="outline"
                disabled={busy}
                onClick={() => reassignTo(s.engineer.id, s.engineer.name)}
              >
                Pick
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
