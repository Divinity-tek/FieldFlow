import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Navigation, MapPin, Play, Pause, CheckCircle, Clock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, formatDistanceStrict } from "date-fns";
import { toast } from "sonner";

type Kind = "travel_start" | "arrived" | "started" | "paused" | "resumed" | "completed" | "note";
interface Event { id: string; kind: Kind; occurred_at: string; lat?: number | null; lng?: number | null }

interface Props {
  jobId: string;
  engineerId: string;
}

const labels: Record<Kind, string> = {
  travel_start: "Travel started",
  arrived: "Arrived on site",
  started: "Work started",
  paused: "Paused",
  resumed: "Resumed",
  completed: "Completed",
  note: "Note",
};

async function getCoords(): Promise<{ lat: number | null; lng: number | null }> {
  if (!navigator.geolocation) return { lat: null, lng: null };
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve({ lat: null, lng: null }),
      { timeout: 4000, maximumAge: 30000 },
    );
  });
}

export default function JobRunSheet({ jobId, engineerId }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState<Kind | null>(null);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["job-events", jobId],
    queryFn: async () => {
      const { data } = await supabase
        .from("job_events")
        .select("id,kind,occurred_at,lat,lng")
        .eq("job_id", jobId)
        .order("occurred_at", { ascending: true });
      return (data ?? []) as Event[];
    },
  });

  const last = events[events.length - 1]?.kind;
  const elapsed = (() => {
    const startE = events.find((e) => e.kind === "started");
    const endE = events.find((e) => e.kind === "completed");
    if (!startE) return null;
    return formatDistanceStrict(new Date(startE.occurred_at), endE ? new Date(endE.occurred_at) : new Date());
  })();

  const log = async (kind: Kind) => {
    setBusy(kind);
    try {
      const { lat, lng } = await getCoords();
      const { error } = await supabase.from("job_events").insert({
        job_id: jobId,
        engineer_id: engineerId,
        kind,
        lat,
        lng,
      });
      if (error) throw error;
      qc.invalidateQueries({ queryKey: ["job-events", jobId] });
      toast.success(labels[kind]);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to log");
    } finally {
      setBusy(null);
    }
  };

  const Btn = ({ kind, icon: Icon, label, variant = "default" as const }: { kind: Kind; icon: any; label: string; variant?: "default" | "outline" | "secondary" }) => (
    <Button size="sm" variant={variant} onClick={() => log(kind)} disabled={!!busy} className="flex-1 min-w-0">
      {busy === kind ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Icon className="w-3.5 h-3.5" />}
      <span className="ml-1.5 truncate">{label}</span>
    </Button>
  );

  return (
    <Card className="border-border/60">
      <CardContent className="p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">Run sheet</span>
          </div>
          {elapsed && <Badge variant="secondary" className="text-xs">{elapsed}</Badge>}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Btn kind="travel_start" icon={Navigation} label="Travel" variant={last === "travel_start" ? "secondary" : "outline"} />
          <Btn kind="arrived" icon={MapPin} label="Arrived" variant={last === "arrived" ? "secondary" : "outline"} />
          <Btn kind="started" icon={Play} label="Start work" variant={last === "started" ? "secondary" : "outline"} />
          {last === "paused"
            ? <Btn kind="resumed" icon={Play} label="Resume" />
            : <Btn kind="paused" icon={Pause} label="Pause" variant="outline" />}
          <Btn kind="completed" icon={CheckCircle} label="Complete" />
        </div>

        {isLoading ? (
          <div className="text-xs text-muted-foreground">Loading timeline…</div>
        ) : events.length > 0 && (
          <ul className="space-y-1 max-h-32 overflow-auto pr-1">
            {events.slice().reverse().map((e) => (
              <li key={e.id} className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">{labels[e.kind]}</span>
                <span className="text-muted-foreground/70">{format(new Date(e.occurred_at), "HH:mm")}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
