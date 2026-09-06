import { useState, useMemo, useCallback, DragEvent } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format, addDays, startOfWeek, isSameDay, parseISO } from "date-fns";
import {
  ChevronLeft, ChevronRight, Calendar as CalendarIcon, Clock, User,
  GripVertical, MapPin, AlertTriangle,
} from "lucide-react";
import { cn } from "@/lib/utils";

const priorityColors: Record<string, string> = {
  low: "border-l-emerald-500 bg-emerald-500/5",
  medium: "border-l-blue-500 bg-blue-500/5",
  high: "border-l-amber-500 bg-amber-500/5",
  urgent: "border-l-destructive bg-destructive/5",
};

const statusColors: Record<string, string> = {
  pending: "bg-muted text-muted-foreground",
  assigned: "bg-blue-500/10 text-blue-500",
  accepted: "bg-cyan-500/10 text-cyan-500",
  on_the_way: "bg-violet-500/10 text-violet-500",
  in_progress: "bg-amber-500/10 text-amber-500",
  completed: "bg-emerald-500/10 text-emerald-500",
  cancelled: "bg-destructive/10 text-destructive",
};

const Scheduling = () => {
  const qc = useQueryClient();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [availDialog, setAvailDialog] = useState<{ engineerId: string; date: Date; existing?: any } | null>(null);
  const [availForm, setAvailForm] = useState({ is_available: true, start_time: "09:00", end_time: "17:00", notes: "" });
  const [reassignConfirm, setReassignConfirm] = useState<{ jobId: string; engineerId: string; date: string; jobTitle: string } | null>(null);

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // ── Data fetching ──
  const { data: engineers = [] } = useQuery({
    queryKey: ["sched-engineers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id, user_id, specialty, is_available, region_id")
        .order("specialty");
      return data ?? [];
    },
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["sched-profiles"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("user_id, full_name");
      return data ?? [];
    },
  });

  const { data: jobs = [] } = useQuery({
    queryKey: ["sched-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, service_type, priority, status, scheduled_at, engineer_id, location, client_id")
        .in("status", ["pending", "assigned", "accepted", "on_the_way", "in_progress"])
        .order("scheduled_at");
      return data ?? [];
    },
  });

  const { data: availability = [] } = useQuery({
    queryKey: ["sched-availability", format(weekStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const from = format(weekStart, "yyyy-MM-dd");
      const to = format(addDays(weekStart, 6), "yyyy-MM-dd");
      const { data } = await supabase
        .from("engineer_availability")
        .select("*")
        .gte("date", from)
        .lte("date", to);
      return data ?? [];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["sched-clients"],
    queryFn: async () => {
      const { data } = await supabase.from("clients").select("id, company_name");
      return data ?? [];
    },
  });

  const profileMap = useMemo(() => new Map(profiles.map((p: any) => [p.user_id, p.full_name])), [profiles]);
  const clientMap = useMemo(() => new Map(clients.map((c: any) => [c.id, c.company_name])), [clients]);

  // Unassigned jobs (draggable pool)
  const unassignedJobs = useMemo(() => jobs.filter((j: any) => !j.engineer_id && j.status === "pending"), [jobs]);

  // Jobs mapped by engineer+date
  const jobGrid = useMemo(() => {
    const grid = new Map<string, any[]>();
    jobs.forEach((j: any) => {
      if (!j.engineer_id || !j.scheduled_at) return;
      const dateKey = format(new Date(j.scheduled_at), "yyyy-MM-dd");
      const key = `${j.engineer_id}_${dateKey}`;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key)!.push(j);
    });
    return grid;
  }, [jobs]);

  // Availability lookup
  const availMap = useMemo(() => {
    const m = new Map<string, any>();
    availability.forEach((a: any) => m.set(`${a.engineer_id}_${a.date}`, a));
    return m;
  }, [availability]);

  // ── Mutations ──
  const assignJobMutation = useMutation({
    mutationFn: async ({ jobId, engineerId, date }: { jobId: string; engineerId: string; date: string }) => {
      // Check if this is a reassignment (job already has an engineer) or a new assignment
      const job = jobs.find((j: any) => j.id === jobId);
      const isReassignment = !!job?.engineer_id;
      const updatePayload: any = {
        engineer_id: engineerId,
        scheduled_at: `${date}T09:00:00`,
      };
      // Only set status to "assigned" for new assignments from the unassigned pool
      if (!isReassignment) {
        updatePayload.status = "assigned";
      }
      const { error } = await supabase
        .from("jobs")
        .update(updatePayload)
        .eq("id", jobId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-jobs"] });
      toast.success("Job reassigned successfully");
    },
    onError: () => toast.error("Failed to reassign job"),
  });

  const saveAvailMutation = useMutation({
    mutationFn: async () => {
      if (!availDialog) return;
      const dateStr = format(availDialog.date, "yyyy-MM-dd");
      if (availDialog.existing) {
        const { error } = await supabase
          .from("engineer_availability")
          .update({
            is_available: availForm.is_available,
            start_time: availForm.start_time,
            end_time: availForm.end_time,
            notes: availForm.notes || null,
          })
          .eq("id", availDialog.existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("engineer_availability")
          .insert({
            engineer_id: availDialog.engineerId,
            date: dateStr,
            is_available: availForm.is_available,
            start_time: availForm.start_time,
            end_time: availForm.end_time,
            notes: availForm.notes || null,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sched-availability"] });
      setAvailDialog(null);
      toast.success("Availability updated");
    },
    onError: () => toast.error("Failed to save availability"),
  });

  // ── Drag & Drop ──
  const handleDragStart = useCallback((e: DragEvent, jobId: string) => {
    e.dataTransfer.setData("jobId", jobId);
    e.dataTransfer.effectAllowed = "move";
  }, []);

  const handleDrop = useCallback((e: DragEvent, engineerId: string, date: Date) => {
    e.preventDefault();
    const jobId = e.dataTransfer.getData("jobId");
    if (!jobId) return;
    const job = jobs.find((j: any) => j.id === jobId);
    const activeStatuses = ["accepted", "on_the_way", "in_progress"];
    if (job?.engineer_id && activeStatuses.includes(job.status)) {
      setReassignConfirm({ jobId, engineerId, date: format(date, "yyyy-MM-dd"), jobTitle: job.title });
      return;
    }
    assignJobMutation.mutate({ jobId, engineerId, date: format(date, "yyyy-MM-dd") });
  }, [assignJobMutation, jobs]);

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }, []);

  // ── Availability dialog ──
  const openAvailDialog = (engineerId: string, date: Date) => {
    const key = `${engineerId}_${format(date, "yyyy-MM-dd")}`;
    const existing = availMap.get(key);
    setAvailForm({
      is_available: existing?.is_available ?? true,
      start_time: existing?.start_time?.slice(0, 5) ?? "09:00",
      end_time: existing?.end_time?.slice(0, 5) ?? "17:00",
      notes: existing?.notes ?? "",
    });
    setAvailDialog({ engineerId, date, existing });
  };

  const isToday = (d: Date) => isSameDay(d, new Date());

  return (
    <AppLayout title="Engineer Scheduling" subtitle="Weekly calendar view — drag jobs to assign, click cells to manage availability">
      <div className="space-y-4">
        {/* Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date(), { weekStartsOn: 1 }))}>
              Today
            </Button>
            <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <h2 className="text-sm font-semibold text-foreground ml-2">
              {format(weekStart, "MMM d")} — {format(addDays(weekStart, 6), "MMM d, yyyy")}
            </h2>
          </div>
          <Badge variant="secondary" className="text-xs">
            {unassignedJobs.length} unassigned job{unassignedJobs.length !== 1 ? "s" : ""}
          </Badge>
        </div>

        {/* Unassigned jobs pool */}
        {unassignedJobs.length > 0 && (
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                Unassigned Jobs — Drag to Calendar
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-3">
              <div className="flex flex-wrap gap-2">
                {unassignedJobs.map((job: any) => (
                  <div
                    key={job.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, job.id)}
                    className={cn(
                      "border-l-[3px] rounded-md px-3 py-2 cursor-grab active:cursor-grabbing",
                      "bg-card border border-border hover:shadow-md transition-shadow",
                      priorityColors[job.priority]
                    )}
                  >
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-medium text-foreground truncate max-w-[180px]">{job.title}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[10px] text-muted-foreground">{job.service_type}</span>
                      <Badge variant="outline" className="text-[9px] h-4">{job.priority}</Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Calendar Grid */}
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <div className="min-w-[900px]">
              {/* Header row */}
              <div className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border bg-muted/30">
                <div className="px-4 py-3 text-xs font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" /> Engineer
                </div>
                {weekDays.map((day) => (
                  <div
                    key={day.toISOString()}
                    className={cn(
                      "px-3 py-3 text-center border-l border-border",
                      isToday(day) && "bg-primary/5"
                    )}
                  >
                    <p className="text-[10px] text-muted-foreground uppercase">{format(day, "EEE")}</p>
                    <p className={cn(
                      "text-sm font-semibold mt-0.5",
                      isToday(day) ? "text-primary" : "text-foreground"
                    )}>
                      {format(day, "d")}
                    </p>
                  </div>
                ))}
              </div>

              {/* Engineer rows */}
              {engineers.map((eng: any) => {
                const name = profileMap.get(eng.user_id) || eng.specialty;
                const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

                return (
                  <div key={eng.id} className="grid grid-cols-[180px_repeat(7,1fr)] border-b border-border/50 hover:bg-muted/10">
                    {/* Engineer name cell */}
                    <div className="px-4 py-3 flex items-start gap-2.5 bg-muted/20">
                      <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-primary">{initials}</span>
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">{name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{eng.specialty}</p>
                      </div>
                    </div>

                    {/* Day cells */}
                    {weekDays.map((day) => {
                      const dateStr = format(day, "yyyy-MM-dd");
                      const key = `${eng.id}_${dateStr}`;
                      const cellJobs = jobGrid.get(key) ?? [];
                      const avail = availMap.get(key);
                      const isOff = avail?.is_available === false;

                      return (
                        <div
                          key={dateStr}
                          className={cn(
                            "border-l border-border p-1.5 min-h-[80px] transition-colors",
                            isToday(day) && "bg-primary/[0.02]",
                            isOff && "bg-destructive/[0.04]"
                          )}
                          onDragOver={handleDragOver}
                          onDrop={(e) => handleDrop(e, eng.id, day)}
                          onDoubleClick={() => openAvailDialog(eng.id, day)}
                        >
                          {/* Availability indicator */}
                          {avail && (
                            <div className={cn(
                              "text-[9px] px-1.5 py-0.5 rounded mb-1 truncate",
                              isOff ? "bg-destructive/10 text-destructive" : "bg-emerald-500/10 text-emerald-600"
                            )}>
                              {isOff ? (avail.notes || "Unavailable") : `${avail.start_time?.slice(0, 5)}–${avail.end_time?.slice(0, 5)}`}
                            </div>
                          )}

                          {/* Assigned jobs */}
                          {cellJobs.map((job: any) => (
                            <div
                              key={job.id}
                              draggable
                              onDragStart={(e) => handleDragStart(e, job.id)}
                              className={cn(
                                "border-l-2 rounded px-1.5 py-1 mb-1 cursor-grab active:cursor-grabbing",
                                "hover:shadow-sm transition-shadow",
                                priorityColors[job.priority]
                              )}
                            >
                              <p className="text-[10px] font-medium text-foreground truncate">{job.title}</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <Badge className={cn("text-[8px] h-3.5 px-1", statusColors[job.status])}>
                                  {job.status.replace(/_/g, " ")}
                                </Badge>
                              </div>
                            </div>
                          ))}

                          {/* Empty state */}
                          {cellJobs.length === 0 && !avail && (
                            <div className="h-full flex items-center justify-center opacity-0 hover:opacity-30 transition-opacity">
                              <span className="text-[10px] text-muted-foreground">Drop here</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}

              {engineers.length === 0 && (
                <div className="py-16 text-center text-sm text-muted-foreground">
                  No engineers found. Add engineers to start scheduling.
                </div>
              )}
            </div>
          </div>
        </Card>

        <p className="text-[10px] text-muted-foreground text-center">
          💡 Drag jobs between cells to reassign engineers. Drag from the unassigned pool to assign. Double-click any cell to manage availability.
        </p>
      </div>

      {/* Availability Dialog */}
      <Dialog open={!!availDialog} onOpenChange={(o) => !o && setAvailDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarIcon className="w-4 h-4" />
              Manage Availability
            </DialogTitle>
          </DialogHeader>
          {availDialog && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {profileMap.get(engineers.find((e: any) => e.id === availDialog.engineerId)?.user_id) || "Engineer"} — {format(availDialog.date, "EEEE, MMM d, yyyy")}
              </p>
              <div className="flex items-center justify-between">
                <Label>Available</Label>
                <Switch
                  checked={availForm.is_available}
                  onCheckedChange={(v) => setAvailForm((f) => ({ ...f, is_available: v }))}
                />
              </div>
              {availForm.is_available && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">Start Time</Label>
                    <Input
                      type="time"
                      value={availForm.start_time}
                      onChange={(e) => setAvailForm((f) => ({ ...f, start_time: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                  <div className="flex-1">
                    <Label className="text-xs text-muted-foreground">End Time</Label>
                    <Input
                      type="time"
                      value={availForm.end_time}
                      onChange={(e) => setAvailForm((f) => ({ ...f, end_time: e.target.value }))}
                      className="h-9 text-sm"
                    />
                  </div>
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Notes</Label>
                <Textarea
                  value={availForm.notes}
                  onChange={(e) => setAvailForm((f) => ({ ...f, notes: e.target.value }))}
                  placeholder={availForm.is_available ? "e.g. Morning training" : "e.g. PTO, Sick leave"}
                  className="text-sm mt-1"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setAvailDialog(null)}>Cancel</Button>
            <Button onClick={() => saveAvailMutation.mutate()} disabled={saveAvailMutation.isPending}>
              {saveAvailMutation.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Reassign Confirmation */}
      <AlertDialog open={!!reassignConfirm} onOpenChange={(o) => !o && setReassignConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reassign active job?</AlertDialogTitle>
            <AlertDialogDescription>
              "{reassignConfirm?.jobTitle}" is currently in progress. Reassigning it will move it to a different engineer. Are you sure?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (reassignConfirm) {
                assignJobMutation.mutate({ jobId: reassignConfirm.jobId, engineerId: reassignConfirm.engineerId, date: reassignConfirm.date });
              }
              setReassignConfirm(null);
            }}>
              Reassign
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppLayout>
  );
};

export default Scheduling;
