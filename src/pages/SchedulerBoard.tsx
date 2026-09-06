import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DndContext, DragEndEvent, useDraggable, useDroppable, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { supabase } from "@/integrations/supabase/client";
import AppLayout from "@/components/layout/AppLayout";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GripVertical, Calendar, MapPin, User, RefreshCw } from "lucide-react";
import { format, addDays, startOfWeek } from "date-fns";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DraggableJob = ({ job }: { job: any }) => {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: job.id, data: job });
  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`p-3 rounded-lg border bg-card cursor-grab active:cursor-grabbing transition-all ${
        isDragging ? "opacity-40 scale-95" : "hover:shadow-md hover:border-primary/40"
      }`}
    >
      <div className="flex items-start gap-2">
        <GripVertical className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <p className="text-sm font-semibold text-foreground truncate">{job.title}</p>
            <Badge variant={job.priority === "urgent" ? "destructive" : "secondary"} className="text-[10px]">
              {job.priority}
            </Badge>
          </div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="w-3 h-3" />
            <span className="truncate">{job.location}</span>
          </div>
          {job.scheduled_at && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
              <Calendar className="w-3 h-3" />
              {format(new Date(job.scheduled_at), "MMM d, h:mm a")}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const EngineerColumn = ({ engineer, jobs }: { engineer: any; jobs: any[] }) => {
  const { setNodeRef, isOver } = useDroppable({ id: engineer.id, data: { engineerId: engineer.id } });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[260px] flex-1 rounded-xl border-2 p-3 transition-all ${
        isOver ? "border-primary bg-primary/5" : "border-border bg-muted/30"
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
            <User className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{engineer.name}</p>
            <p className="text-xs text-muted-foreground truncate">{engineer.specialty}</p>
          </div>
        </div>
        <Badge variant="outline" className="shrink-0">{jobs.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">
        {jobs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 italic">Drop jobs here</p>
        )}
        {jobs.map(j => <DraggableJob key={j.id} job={j} />)}
      </div>
    </div>
  );
};

const UnassignedColumn = ({ jobs }: { jobs: any[] }) => {
  const { t } = useTranslation();
  const { setNodeRef, isOver } = useDroppable({ id: "unassigned", data: { engineerId: null } });
  return (
    <div
      ref={setNodeRef}
      className={`min-w-[280px] rounded-xl border-2 p-3 transition-all ${
        isOver ? "border-primary bg-primary/5" : "border-dashed border-border bg-muted/20"
      }`}
    >
      <div className="flex items-center justify-between mb-3 pb-2 border-b">
        <p className="font-semibold text-sm">{t("scheduler.unassigned")}</p>
        <Badge variant="outline">{jobs.length}</Badge>
      </div>
      <div className="space-y-2 min-h-[120px]">
        {jobs.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-4 italic">{t("scheduler.empty")}</p>
        )}
        {jobs.map(j => <DraggableJob key={j.id} job={j} />)}
      </div>
    </div>
  );
};

const SchedulerBoard = () => {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const [weekStart] = useState(() => startOfWeek(new Date(), { weekStartsOn: 1 }));
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));

  const { data: engineers = [] } = useQuery({
    queryKey: ["scheduler-engineers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("engineers")
        .select("id, specialty, user_id, profiles:user_id(full_name)")
        .eq("is_available", true)
        .limit(8);
      return (data || []).map((e: any) => ({
        id: e.id,
        specialty: e.specialty,
        name: e.profiles?.full_name || "Engineer",
      }));
    },
  });

  const { data: jobs = [], refetch } = useQuery({
    queryKey: ["scheduler-jobs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("jobs")
        .select("id, title, location, priority, status, engineer_id, scheduled_at")
        .in("status", ["pending", "assigned", "accepted"])
        .order("created_at", { ascending: false })
        .limit(50);
      return data || [];
    },
  });

  const { unassigned, byEngineer } = useMemo(() => {
    const map: Record<string, any[]> = {};
    const un: any[] = [];
    for (const j of jobs) {
      if (j.engineer_id) {
        (map[j.engineer_id] ||= []).push(j);
      } else {
        un.push(j);
      }
    }
    return { unassigned: un, byEngineer: map };
  }, [jobs]);

  const handleDragEnd = async (e: DragEndEvent) => {
    const job = e.active.data.current as any;
    const targetEngineerId = (e.over?.data.current as any)?.engineerId ?? null;
    if (!job || job.engineer_id === targetEngineerId) return;

    const updates: any = { engineer_id: targetEngineerId };
    if (targetEngineerId && job.status === "pending") updates.status = "assigned";
    if (!targetEngineerId) updates.status = "pending";

    const { error } = await supabase.from("jobs").update(updates).eq("id", job.id);
    if (error) {
      toast.error("Failed to reassign: " + error.message);
    } else {
      const eng = engineers.find(en => en.id === targetEngineerId);
      toast.success(targetEngineerId ? `Assigned to ${eng?.name || "engineer"}` : "Unassigned");
      qc.invalidateQueries({ queryKey: ["scheduler-jobs"] });
    }
  };

  return (
    <AppLayout title={t("scheduler.title")} subtitle={t("scheduler.subtitle")}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Calendar className="w-4 h-4" />
          Week of {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d, yyyy")}
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          <RefreshCw className="w-4 h-4 mr-2" /> Refresh
        </Button>
      </div>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-4">
          <UnassignedColumn jobs={unassigned} />
          {engineers.map(eng => (
            <EngineerColumn key={eng.id} engineer={eng} jobs={byEngineer[eng.id] || []} />
          ))}
        </div>
      </DndContext>

      <Card className="mt-6 p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          💡 Drag a job card onto an engineer column to assign instantly. Drag to "Unassigned" to release. Status updates automatically.
        </p>
      </Card>
    </AppLayout>
  );
};

export default SchedulerBoard;
